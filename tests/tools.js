// Places for tools (editor/src/tools.js), under Node: a tool's command registered for the kinds of map it takes, with
// an id, a test of whether it applies and a run (notes in the working repository, plan 3, step 8).
//   node tests/tools.js
var path = require('path');
var esbuild = require(require.resolve('esbuild', { paths: [path.join(__dirname, '..')] }));
var code = esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', 'editor', 'src', 'tools.js')], bundle: true, format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text;
var mod = { exports: {} }; new Function('module', 'exports', code)(mod, mod.exports);
var registry = mod.exports.registry, bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var throws = function (f) { try { f(); return false; } catch (e) { return true; } };
var ids = function (l) { return l.map(function (t) { return t.id; }).join(','); };

(async function () {
  var r = registry(), sb = { id: 'a', name: 'A', kind: 'SBGN-ML' }, cd = { id: 'b', name: 'B', kind: 'CellDesigner' }, gm = { id: 'c', name: 'C', kind: 'GraphML' };
  var off = r.register({ id: 'to-af', label: 'AF map', kinds: ['SBGN-ML'], applies: function (m) { return m.id === 'a'; }, run: function (ctx) { return ctx.add('x', 'y'); } });
  r.register({ id: 'any', kinds: '*', run: function () { return 1; } });
  r.register({ id: 'cd', label: 'CD tool', kinds: ['CellDesigner', 'GraphML'], run: function () { return 2; } });
  r.register({ id: 'boom', kinds: ['*'], applies: function () { throw new Error('x'); }, run: function () { return 3; } });
  ok('a tool for SBGN-ML maps whose test says yes, and a tool for any map', ids(r.forMap(sb)) === 'to-af,any', ids(r.forMap(sb)));
  ok('tools for CellDesigner, in the order registered', ids(r.forMap(cd)) === 'any,cd', ids(r.forMap(cd)));
  ok('its test saying no leaves a tool out', ids(r.forMap({ id: 'z', kind: 'SBGN-ML' })) === 'any');
  ok('a test that throws counts as no', ids(r.forMap(gm)).indexOf('boom') < 0, ids(r.forMap(gm)));
  ok('no map: no tool', r.forMap(null).length === 0);
  ok('the label given, else the id', r.label('to-af') === 'AF map' && r.label('any') === 'any');
  ok('a second tool with the same id refused', throws(function () { r.register({ id: 'any', kinds: '*', run: function () {} }); }));
  ok('a tool without an id, a run or a kind refused', throws(function () { r.register({ kinds: '*', run: function () {} }); }) && throws(function () { r.register({ id: 'n', kinds: '*' }); }) && throws(function () { r.register({ id: 'n', run: function () {} }); }));
  var got = await r.run('to-af', sb, { add: function (t, n) { return Promise.resolve(t + n); } });
  ok('a run is handed the context and its result given back', got === 'xy', got);
  ok('a run as a plain value is a promise too', (await r.run('cd', gm, {})) === 2);
  var no = await r.run('to-af', cd, {}).then(function () { return ''; }, function (e) { return e.message; });
  ok('a run refused where the tool does not apply', /does not apply/.test(no), no);
  no = await r.run('nothing', sb, {}).then(function () { return ''; }, function (e) { return e.message; });
  ok('a run of no such tool refused', /no tool/.test(no), no);
  r.register({ id: 'throws', kinds: '*', run: function () { throw new Error('inside'); } });
  no = await r.run('throws', sb, {}).then(function () { return ''; }, function (e) { return e.message; });
  ok('a run that throws gives a refused promise', no === 'inside', no);
  off();
  ok('unregistered: gone from the list, its id free again', ids(r.forMap(sb)) === 'any,throws' && !throws(function () { r.register({ id: 'to-af', kinds: '*', run: function () {} }); }));
  ok('each registry its own list', registry().forMap(sb).length === 0);
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
