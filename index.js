var crypto = require('crypto')
var pump = require('pump')
var TimeoutStream = require('through-timeout')
var cbTimeout = require('callback-timeout')
var mime = require('mime')
var rangeParser = require('range-parser')
var JSONStream = require('JSONStream')

module.exports = HyperdriveHttp

function HyperdriveHttp (getArchive) {
  var onrequest = function (req, res) {
    var dat = parse(req.url)
    if (!dat) return onerror(404, res)
    getArchive(dat, function (err, archive) {
      if (err) return onerror(err)
      archiveResponse(archive, req, res)
    })
  }

  return onrequest
}

function archiveResponse (archive, req, res) {
  if (!archive) onerror(404, res)

  var dat = parse(req.url)

  if (!dat.filename) {
    var src = archive.list({live: false})
    var timeout = TimeoutStream({
      objectMode: true,
      duration: 10000
    }, () => {
      onerror(404, res)
      src.destroy()
    })
    var stringify = JSONStream.stringify('[', ',', ']\n', 2)
    pump(src, timeout, stringify, res)
  }

  archive.get(dat.filename, cbTimeout((err, entry) => {
    if (err && err.code === 'ETIMEOUT') return onerror(404, res)
    if (err || !entry || entry.type !== 'file') return onerror(404, res)

    var range = req.headers.range && rangeParser(entry.length, req.headers.range)[0]

    res.setHeader('Access-Ranges', 'bytes')
    res.setHeader('Content-Type', mime.lookup(dat.filename))

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
  res.statusCode = status
  res.end()
}

function parse (url) {
  var key = url.slice(1, 65)
  if (!/^[0-9a-f]{64}$/.test(key)) return null

  var filename = url.slice(66)

  return {
    key: key,
    discoveryKey: crypto.createHmac('sha256', Buffer(key, 'hex')).update('hypercore').digest('hex'),
    filename: filename
  }
}
