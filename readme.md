# Hyperdrive Http

Handle Hyperdrive HTTP Requests

Expects you to:
* Bring your own http server
* Manage your own hyperdrive archives
* Connect to the swarm before callback

## Usage

```javascript
var hyperdriveHttp = require('hyperdrive-http')

var getArchive = function (datInfo, cb) {
  // find the archive to serve
  var archive = cache.get(datInfo.discoveryKey)
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
  discoveryKey: archive.discoveryKey,
  filename: someFile.txt,
}
```