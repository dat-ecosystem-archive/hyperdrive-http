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
  var drive = hyperdrive(storage, key, { sparse: true })
  var server = http.createServer(serve(drive, { live: true }))
  server.listen(port)
  console.log(`Visit http://localhost:${port} to see drive`)

  if (key) {
    drive.ready(function () {
      discovery(drive, { live: true })
    })
  }
}
