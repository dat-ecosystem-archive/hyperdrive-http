# Hyperdrive Http

Serve a [hyperdrive](https://github.com/mafintosh/hyperdrive) archive or [hypercore](https://github.com/mafintosh/hypercore) feed over HTTP. For an example of use, see [dat.haus](https://github.com/juliangruber/dat.haus).

[![Travis](https://api.travis-ci.org/joehand/hyperdrive-http.svg)](https://travis-ci.org/joehand/hyperdrive-http)

## Usage

Hyperdrive-http returns a function to call when you receive a http request:

```js
var server = http.createServer()
server.on('request', hyperdriveHttp(archive))
```

### Setup

To use hyperdrive-http you will need to:
* Create your own http server
* Setup your hyperdrive archive(s)
* Connect to the swarm before serving archive

### API

Hyperdrive works with many archives/feeds or a single archive. 

#### Multiple Archives

If you have multiple archives, you will need to look the archive to return using the key.

Initiate with an archive lookup function:
`var onrequest = hyperdriveHttp(getArchive)`

The archive lookup function may look like this:

```js
var getArchive = function (datInfo, cb) {
  // datInfo = {
  //   key: archive.key,
  //   filename: filename.txt // If file is requested in URL
  //   op: 'get' or 'changes'
  // }

  // Find the archive to return:
  var archive = cache.get(datInfo.key)
  if (!archive) {
    archive = drive.createArchive(datInfo.key)
    // Make sure you join the swarm before callback
    sw.join(archive.discoveryKey)
  }
  cb(null, archive) // callback with your found archive
}
```

#### Single Archive
Hyperdrive-http works great with a single archive too. It exposes the metadata at the root path and files are available without using the key.

Pass a single archive on initiation:
`var onrequest = hyperdriveHttp(archive)`

Now your archive metadata will be available at http://example.com/

#### Hypercore Feed(s)
You can also use a hypercore feed: `hyperdriveHttp(feed)` (or using a similar getArchive function)

### URL Format

Hyperdrive-http responds to any URL with a specific format. If the URL does cannot be parsed, it will return a 404.

#### Multiple archives on one site

* Get metadata for archive: `http://dat.haus/c5dbfe5521d8dddba683544ee4b1c7f6ce1c7b23bd387bd850397e4aaf9afbd9/`
* Get file from archive: `http://dat.haus/c5dbfe5521d8dddba683544ee4b1c7f6ce1c7b23bd387bd850397e4aaf9afbd9/filename.pdf`
* Upload file: `POST http://archive-example.com/` or `POST http://archive-example.com/c5dbfe5521d8dddba683544ee4b1c7f6ce1c7b23bd387bd850397e4aaf9afbd9`

#### Single Archive Mode

* Get metadata for archive: `http://archive-example.com/`
* Get file from archive: `http://archive-example.com/filename.pdf`
* Upload file: `POST http://archive-example.com/`

#### Hypercore Mode

For hypercore feeds, the data is available with the same logic as above for a single or multiple feeds.


## Example

```javascript
var hyperdriveHttp = require('hyperdrive-http')

var getArchive = function (datInfo, cb) {
  // find the archive to serve
  var discoveryKey = crypto.createHmac('sha256', Buffer(datInfo.key, 'hex')).update('hypercore').digest('hex')
  var archive = cache.get(discoveryKey)
  if (!archive) {
    archive = drive.createArchive(datInfo.key)
    // connect to swarm, if necessary
    sw.join(archive.discoveryKey)
  }
  cb(null, archive) // callback with your found archive
}

var onrequest = hyperdriveHttp(getArchive)
var server = http.createServer()
server.listen(8000)
server.on('request', onrequest)
```

Pass an archive lookup function for the first argument of `hyperdriveHttp`. The function is called with `datInfo` and a callback.

```javascript
datInfo = {
  key: archive.key,
  filename: someFile.txt,
  op: 'get' // or 'changes'
}
```