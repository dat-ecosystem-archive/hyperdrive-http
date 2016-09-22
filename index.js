var pump = require('pump')
var TimeoutStream = require('through-timeout')
var cbTimeout = require('callback-timeout')
var mime = require('mime')
var rangeParser = require('range-parser')
var ndjson = require('ndjson')
var encoding = require('dat-encoding')
var through = require('through2')

module.exports = HyperdriveHttp

function HyperdriveHttp (getArchive) {
  var archive
  if (typeof (getArchive) !== 'function') {
    archive = getArchive
    getArchive = function (datUrl, cb) {
      cb(null, archive)
    }
  }
  var onrequest = function (req, res) {
    var datUrl = parse(req)
    if (!datUrl) return onerror(404, res)
    getArchive(datUrl, function (err, archive) {
      if (err) return onerror(err, res)
      archiveResponse(datUrl, archive, req, res)
    })
  }

  return onrequest

  function parse (req) {
    var segs = req.url.split('/').filter(Boolean)
    var key = archive
      ? encoding.encode(archive.key)
      : segs.shift()
    var filename = segs.join('/')
    var op = 'get'

    try {
      // check if we are serving archive at root
      key = key.replace(/\.changes$/, '')
      encoding.encode(Buffer.from(key, 'hex'))
    } catch (e) {
      filename = segs.length ? [key, segs].join('/') : key
      key = null
    }

    if (/\.changes$/.test(req.url)) {
      op = 'changes'
      if (filename) filename = filename.replace(/\.changes$/, '')
    } else if (req.method === 'POST') {
      op = 'upload'
    }

    return {
      key: key,
      filename: filename,
      op: op
    }
  }
}

function archiveResponse (datUrl, archive, req, res) {
  if (!archive) onerror(404, res)

  if (datUrl.op === 'upload') {
    var ws = archive.createFileWriteStream('file')
    ws.on('finish', () => res.end(encoding.encode(archive.key)))
    pump(req, ws)
    return
  }

  if (!datUrl.filename || !archive.metadata) {
    var opts = {live: datUrl.op === 'changes'}
    var src = archive.metadata ? archive.list(opts) : archive.createReadStream(opts)
    var timeout = TimeoutStream({
      objectMode: true,
      duration: 10000
    }, () => {
      onerror(404, res)
      src.destroy()
    })

    res.setHeader('Content-Type', 'application/json')
    if (archive.metadata) return pump(src, timeout, ndjson.serialize(), res)
    return pump(src, timeout, through.obj(function (chunk, enc, cb) {
      cb(null, chunk.toString())
    }), ndjson.serialize(), res)
  }

  archive.get(datUrl.filename, cbTimeout((err, entry) => {
    if (err && err.code === 'ETIMEOUT') return onerror(404, res)
    if (err || !entry || entry.type !== 'file') return onerror(404, res)

    var range = req.headers.range && rangeParser(entry.length, req.headers.range)[0]

    res.setHeader('Access-Ranges', 'bytes')
    res.setHeader('Content-Type', mime.lookup(datUrl.filename))

    if (!range || range < 0) {
      res.setHeader('Content-Length', entry.length)
      if (req.method === 'HEAD') return res.end()
      pump(archive.createFileReadStream(entry), res)
    } else {
      res.statusCode = 206
      res.setHeader('Content-Length', range.end - range.start + 1)
      res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + entry.length)
      if (req.method === 'HEAD') return res.end()
      pump(archive.createFileReadStream(entry, {start: range.start, end: range.end + 1}), res)
    }
  }, 10000))
}

function onerror (status, res) {
  if (typeof status !== 'number') {
    // console.error(status)
    status = 404
  }
  res.statusCode = status
  res.end()
}
