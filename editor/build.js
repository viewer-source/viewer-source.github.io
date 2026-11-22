// Builds editor/editor.js, the one file the viewer loads, from the modules in editor/src/ (entry src/main.js), unminified,
// with editor/editor.js.map (a stack trace on a site reads as src/ lines; the sources themselves are served beside it).
// Run after any change in editor/src/:   node editor/build.js
// release/check.js builds it again and refuses a release whose editor.js or map differs from its sources.
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'editor.js');
const HEAD = '// Built by editor/build.js from editor/src/ (entry src/main.js); edit the sources, then run the build.\n';
function files(esbuild) {   // { js, map }
  const r = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'src', 'main.js')], bundle: true, format: 'iife', write: false,
    absWorkingDir: path.join(__dirname, '..'), outfile: OUT, sourcemap: 'linked', sourcesContent: false, banner: { js: HEAD.trim() },
    legalComments: 'none', charset: 'ascii', logLevel: 'silent' });
  const get = ext => r.outputFiles.find(f => f.path.endsWith(ext)).text;
  return { js: get('.js'), map: get('.js.map') };
}
function bundle(esbuild) { return files(esbuild).js; }
module.exports = { bundle, files, OUT };
if (require.main === module) {
  const f = files(require('esbuild'));
  fs.writeFileSync(OUT, f.js); fs.writeFileSync(OUT + '.map', f.map);
  console.log('editor/editor.js and its map written');
}
