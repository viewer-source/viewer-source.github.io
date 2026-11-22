// The editor as a page would load it, from a viewer folder's sources: bundled now from editor/src/ by editor/build.js
// (so a test never runs a stale editor.js), or for a folder from before the modules (no build.js) its editor.js joined
// as Jekyll joined it.
var fs = require('fs'), path = require('path');
module.exports = function (dir) {
  var b = path.join(path.resolve(dir), 'editor', 'build.js');
  if (fs.existsSync(b)) return require(b).bundle(require(require.resolve('esbuild', { paths: [path.dirname(b), __dirname] })));
  var read = function (f) { return fs.readFileSync(path.join(dir, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
};
