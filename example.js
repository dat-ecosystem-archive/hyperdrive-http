var http = require('http')
var path = require('path')
var memdb = require('memdb')
var hyperdrive = require('hyperdrive')
var raf = require('random-access-file')
var hyperdriveHttp = require('.')

var drive = hyperdrive(memdb())
var archive = drive.createArchive({
  file: function (name) {
    return raf(path.join(__dirname, name))
  }
})
var onrequest = hyperdriveHttp(archive)
var server = http.createServer()

archive.append('readme.md')
archive.append('package.json')
archive.append('index.js')

server.listen(8000)
server.on('request', onrequest)

console.info('Now listening on localhost:8000')
console.info('Visit in your browser to see metadata')
