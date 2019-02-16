#!/usr/bin/env node

var http = require('http')
var ram = require('random-access-memory')
var hyperdrive = require('hyperdrive')
var discovery = require('hyperdiscovery')
var getDatKey = require('dat-link-resolve')
var serve = require('.')

var link = process.argv[2]
var storage = ram
var port = 8080

if (!link) {
  console.log('link to a dat required')
  process.exit(1)
}

getDatKey(link, (err, key) => {
  if (err) throw err
  start(key)
})

function start (key) {
  var archive = hyperdrive(storage, key, { sparse: true })
  var server = http.createServer(serve(archive, { live: true }))
  server.listen(port)
  console.log(`Visit http://localhost:${port} to see archive`)

  if (key) {
    archive.ready(function () {
      discovery(archive, { live: true })
    })
  }
}
