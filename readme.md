# Hyperdrive Http

Serve a Hyperdrive over HTTP. 

## Usage

```javascript
var hyperdriveHttp = require('hyperdrive-http')

var opts = {port: 8000}
var getArchive = function (datInfo, cb) {
  var archive = cache.get(dat.discoveryKey)
  if (!archive) {
    archive = drive.createArchive(dat.key, {file: file})
    sw.join(archive.discoveryKey)
  }
  cb(null, archive) // callback with your archive
}

var server = hyperdriveHttp(getArchive, opts)
```

Pass an archive lookup function for the first argument of `hyperdriveHttp`. The function is called with `datInfo` and a callback.

```javascript
datInfo = {
  key: archive.key,
  discoveryKey: archive.discoveryKey,
  filename: someFile.txt,
}
```