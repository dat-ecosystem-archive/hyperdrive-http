# Hyperdrive Http

Serve a [hyperdrive](https://github.com/mafintosh/hyperdrive) drive over HTTP. For an example of use, see [dat.haus](https://github.com/juliangruber/dat.haus).

[![Travis](https://api.travis-ci.org/joehand/hyperdrive-http.svg)](https://travis-ci.org/joehand/hyperdrive-http)

## Usage

Hyperdrive-http returns a function to call when you receive a http request:

```js
var server = http.createServer().listen(8000)
server.on('request', hyperdriveHttp(drive))
```

Supports manifest options in `dat.json`:

* `web_root` - change directory to serve on index
* `fallback_page` - fallback for 404 errors

### Setup

To use hyperdrive-http you will need to:

* Create your own http server
* Setup your hyperdrive drive
* For remote drives, connect to the swarm

## API

Hyperdrive works with many drives/feeds or a single drive.

#### Options

- `exposeHeaders` - If set to `true`, hyperdrive-http will add custom `Hyperdrive-` HTTP headers to directory listing requests (default: `false`):
  ```http
  Hyperdrive-Key: de2a51bbaf8a5545eff82c999f15e1fd29637b3f16db94633cb6e2e0c324f833
  Hyperdrive-Version: 4
  ```
- `live` - If set to `true` will reload a directly listing if the drive receives updates.
- `footer` - Add a footer to your HTML page. Automatically adds drive version number to footer.

### URL Format

Hyperdrive-http responds to any URL with a specific format. If the URL does cannot be parsed, it will return a 404.

* Get drive listing: `http://drive-example.com/`
* Get file from drive: `http://drive-example.com/filename.pdf`

If a directory in the drive contains an `index.html` page that file is returned instead of the directory listing. If you'd like to view files use a query string:

* View files: `http://drive-example.com/?viewSource=true`


## CLI

There is also a CLI that can be used for demo + testing. Pass it a dat link or a path to an existing dat folder:

```
node cli.js <dat-key>
node cli.js /path/do/existing/dat
```
