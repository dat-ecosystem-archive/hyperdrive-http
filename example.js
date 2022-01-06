var http = require('http')
var fs = require('fs')
var hyperdrive = require('hyperdrive')
var ram = require('random-access-memory')
var serve = require('.')

var drive = hyperdrive(ram)

var server = http.createServer(serve(drive, { exposeHeaders: true, live: true }))

drive.writeFile('readme.md', fs.readFileSync('readme.md'))
drive.writeFile('package.json', fs.readFileSync('package.json'))
drive.writeFile('index.js', fs.readFileSync('index.js'))
drive.writeFile('foo/index.html', '<h1>INDEX PAGE YO</h1>')

server.listen(8000)

console.info('Now listening on http://localhost:8000')
console.info('Visit in your browser to see metadata')
