const http = require('http')
const request = require('request')
const ram = require('random-access-memory')
const hyperdrive = require('hyperdrive')
const tape = require('tape')
const hyperdriveHttp = require('..')

const PORT = 8000
const BASE = `http://localhost:${PORT}`
tape.only('basic get', t => {
  const server = http.createServer()
  const drive = hyperdrive(ram)
  const onrequest = hyperdriveHttp(drive)

  server.listen(PORT)
  server.once('request', onrequest)

  drive.writeFile('hello', 'world', (err) => {
    t.error(err, 'write ok')
    request(BASE + '/hello', (err, res, body) => {
      t.error(err, 'no request error')
      t.equal(res.statusCode, 200)
      t.ok(body, 'responds with file')
      t.equal(body, 'world', 'content matches')
      server.close()
      t.end()
    })
  })
})
