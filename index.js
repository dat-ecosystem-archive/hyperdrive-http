var toHTML = require('directory-index-html')
var pump = require('pump')
var mime = require('mime')
var range = require('range-parser')
var qs = require('querystring')
var corsify = require('corsify')
var pkg = require('./package.json')
var debug = require('debug')('hyperdrive-http')

module.exports = serve

function serve (drive, opts) {
  if (!opts) opts = {}

  drive.ready(() => {
    debug('serving', drive.key.toString('hex'))
  })

  return corsify(onrequest)

  function onrequest (req, res) {
    if (req.method === 'GET') {
      ongetfile(drive, opts, req, res)
    } else {
      res.statusCode = 500
      res.end('illegal method')
    }
  }
}

function ongetfile (drive, opts, req, res) {
  var name = decodeURI(req.url.split('?')[0])
  var query = qs.parse(req.url.split('?')[1] || '')
  opts.viewSource = false // reset for each request

  var wait = (query.wait && Number(query.wait.toString())) || 0
  var have = drive.metadata ? drive.metadata.length : -1

  if (wait <= have) return checkWebroot()
  waitFor(drive, wait, checkWebroot)

  function checkWebroot () {
    if (opts.web_root) return ready() // used cached version
    getManifest(drive, (err, data) => {
      if (err || !data) return ready()
      if (data.web_root) opts.web_root = data.web_root
      ready()
    })
  }

  function ready () {
    var arch = /^\d+$/.test(query.version) ? drive.checkout(Number(query.version)) : drive
    if (query.viewSource) {
      debug('view source', query)
      opts.viewSource = true
    }
    debug('view', name, 'view dir', name[name.length - 1] === '/')
    if (name[name.length - 1] === '/') ondirectory(arch, name, req, res, opts)
    else onfile(arch, name, req, res, opts)
  }
}

function onfile (drive, name, req, res, opts) {
  drive.stat(name, function (err, st) {
    if (err) return on404(drive, req, res)

    if (st.isDirectory()) {
      res.statusCode = 302
      res.setHeader('Location', name + '/')
      ondirectory(drive, name + '/', req, res, opts)
      return
    }

    var r = req.headers.range && range(st.size, req.headers.range)[0]
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', mime.getType(name))

    if (r) {
      res.statusCode = 206
      res.setHeader('Content-Range', 'bytes ' + r.start + '-' + r.end + '/' + st.size)
      res.setHeader('Content-Length', r.end - r.start + 1)
    } else {
      res.setHeader('Content-Length', st.size)
    }

    if (req.method === 'HEAD') return res.end()
    pump(drive.createReadStream(name, r), res)
  })
}

function on404 (drive, req, res) {
  getManifest(drive, function (err, parsed) {
    if (err) return onerror(res, 404, err)

    var fallbackPage = parsed.fallback_page

    if (!fallbackPage) return onerror(res, 404, new Error('Not Found, No Fallback'))

    drive.stat((parsed.web_root || '/') + fallbackPage, function (err) {
      if (err) return onerror(res, 404, err)
      onfile(drive, fallbackPage, req, res)
    })
  })
}

function ondirectory (drive, name, req, res, opts) {
  debug('ondirectory:', name, 'options', opts)
  if (opts.viewSource) return ondirectoryindex(drive, name, req, res, opts)

  if (name === '/' && opts.web_root) name = opts.web_root
  if (name[name.length - 1] !== '/') name = name + '/'
  drive.stat(name + 'index.html', function (err) {
    if (err) return ondirectoryindex(drive, name, req, res, opts)
    onfile(drive, name + 'index.html', req, res)
  })
}

function ondirectoryindex (drive, name, req, res, opts) {
  list(drive, name, function (err, entries) {
    if (err) entries = []

    var wait = drive.metadata ? drive.metadata.length + 1 : 0
    var script = `
      function liveUpdate () {
        var xhr = new XMLHttpRequest()
        xhr.open("GET", ".${name}?wait=${wait}", true)
        xhr.onload = function () {
          if (xhr.status !== 200) return onerror()
          document.open()
          document.write(xhr.responseText)
          document.close()
        }
        xhr.onerror = onerror
        xhr.send(null)

        function onerror () {
          setTimeout(liveUpdate, 1000)
        }
      }

      liveUpdate()
    `

    var footer = opts.footer ? 'Archive version: ' + drive.version : null
    var html = toHTML({ directory: name, script: (!opts.live || drive._checkout) ? null : script, footer: footer }, entries)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(html))
    if (opts.exposeHeaders) {
      res.setHeader('Hyperdrive-Key', drive.key.toString('hex'))
      res.setHeader('Hyperdrive-Version', drive.version)
      res.setHeader('Hyperdrive-Http-Version', pkg.version)
    }
    res.end(html)
  })
}

function getManifest (drive, cb) {
  drive.readFile('/dat.json', 'utf-8', function (err, data) {
    if (err) return cb(err)
    try {
      var parsed = JSON.parse(data)
    } catch (e) {
      return cb(err)
    }

    if (!parsed || Array.isArray(parsed) || (typeof parsed !== 'object')) {
      return cb(new Error('Invalid dat.json format'))
    }

    cb(null, parsed)
  })
}

function waitFor (drive, until, cb) { // this feels a bit hacky, TODO: make less complicated?
  drive.setMaxListeners(0)
  if (!drive.metadata) drive.once('ready', waitFor.bind(null, drive, until, cb))
  if (drive.metadata.length >= until) return cb()
  drive.metadata.setMaxListeners(0)
  drive.metadata.update(waitFor.bind(null, drive, until, cb))
}

function onerror (res, status, err) {
  res.statusCode = status
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  }
  res.end(err.stack)
}

function list (drive, name, cb) {
  drive.readdir(name, function (err, names) {
    if (err) return cb(err)

    var error = null
    var missing = names.length
    var entries = []

    if (!missing) return cb(null, [])
    for (var i = 0; i < names.length; i++) stat(name + names[i], names[i])

    function stat (name, base) {
      drive.stat(name, function (err, st) {
        if (err) error = err

        if (st) {
          entries.push({
            type: st.isDirectory() ? 'directory' : 'file',
            name: base,
            size: st.size,
            mtime: st.mtime
          })
        }

        if (--missing) return
        if (error) return cb(error)
        cb(null, entries.sort(sort))
      })
    }
  })
}

function sort (a, b) {
  return a.name.localeCompare(b.name)
}
