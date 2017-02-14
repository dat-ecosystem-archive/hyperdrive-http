var assert = require('assert')
var stream = require('stream')
var pump = require('pump')
var TimeoutStream = require('through-timeout')
var cbTimeout = require('callback-timeout')
var mime = require('mime')
var rangeParser = require('range-parser')
var ndjson = require('ndjson')
var encoding = require('dat-encoding')
var through2 = require('through2')
var debug = require('debug')('hyperhttp')

module.exports = function (getArchive, opts) {
  assert.ok(getArchive, 'hyperhttp: getArchive|archive required')

  var archive
  if (typeof (getArchive) !== 'function') {
    // Make a getArchive function to get the single archive by default
    archive = getArchive
    getArchive = function (datUrl, cb) {
      cb(null, archive)
    }
  }
  // Sanity check =)
  assert.equal(typeof getArchive, 'function', 'hyperhttp: getArchive must be function')

  var that = onrequest
  that.parse = parse
  that.get = serveFeedOrArchive
  that.file = serveFile

  return that

  function onrequest (req, res) {
    var datUrl = parse(req)
    if (!datUrl) return onerror(404, res) // TODO: explain error in res

    getArchive(datUrl, function (err, archive) {
      if (err) return onerror(err, res) // TODO: explain error in res
      if (!archive) return onerror(404, res) // TODO: explain error in res

      if (datUrl.op === 'upload') {
        var ws = archive.createFileWriteStream('file')
        ws.on('finish', () => res.end(encoding.encode(archive.key)))
        pump(req, ws)
        return
      } else if (!datUrl.filename || !archive.metadata) {
        // serve archive or hypercore feed
        serveFeedOrArchive(req, res, archive, datUrl).pipe(res)
      } else {
        serveFile(req, res, archive, datUrl.filename)
      }
    })
  }

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
      encoding.decode(key)
    } catch (e) {
      filename = segs.length ? [key].concat(segs).join('/') : key
      key = null
    }

    if (/\.changes$/.test(req.url)) {
      op = 'changes'
      if (filename) filename = filename.replace(/\.changes$/, '')
    } else if (req.method === 'POST') {
      op = 'upload'
    }

    var results = {
      key: key,
      filename: filename,
      op: op
    }
    debug('parse() results', results)
    return results
  }
}

function serveFeedOrArchive (req, res, archive, urlOpts) {
  debug('serveFeedOrArchive', archive.key.toString('hex'))
  var opts = { live: urlOpts.op === 'changes' }
  var through = new stream.PassThrough()
  var src = archive.metadata ? archive.list(opts) : archive.createReadStream(opts)
  var timeout = TimeoutStream({
    objectMode: true,
    duration: 10000
  }, () => {
    onerror(404, res)
    src.destroy()
  })

  res.setHeader('Content-Type', 'application/json')
  if (archive.metadata) return pump(src, timeout, ndjson.serialize(), through)
  return pump(src, timeout, through2.obj(function (chunk, enc, cb) {
    cb(null, chunk.toString())
  }), ndjson.serialize(), through)
}

function serveFile (req, res, archive, filename) {
  debug('serveFile', archive.key.toString('hex'), 'filename', [filename])

  archive.get(filename, cbTimeout((err, entry) => {
    if (err && err.code === 'ETIMEDOUT') return onerror(404, res)
    if (err || !entry || entry.type !== 'file') return onerror(404, res)

    var range = req.headers.range && rangeParser(entry.length, req.headers.range)[0]

    res.setHeader('Access-Ranges', 'bytes')
    res.setHeader('Content-Type', mime.lookup(filename))

    if (!range || range < 0) {
      res.setHeader('Content-Length', entry.length)
      if (req.method === 'HEAD') return res.end()
      return pump(archive.createFileReadStream(entry), res)
    } else {
      res.statusCode = 206
      res.setHeader('Content-Length', range.end - range.start + 1)
      res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + entry.length)
      if (req.method === 'HEAD') return res.end()
      return pump(archive.createFileReadStream(entry, {start: range.start, end: range.end + 1}), res)
    }
  }, 10000))
}

function onerror (status, res) {
  if (typeof status !== 'number') status = 404
  res.statusCode = status
  res.end()
}
