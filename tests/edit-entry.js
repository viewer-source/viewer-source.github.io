// Entering edit on the picture as it is: a map whose picture is already the editor's drawing (grouped: the site's build,
// render.js groups, and a reader's own map, drawText) is taken as it is (core.js adopt), nothing drawn again; a change
// after it is drawn as before. Per file: the map added from the computer (no token), the renderers' calls counted from
// the page's start: one, the adding's own drawing (drawText), through the read-ahead after it and E pressed, to 3 s after
// editing started; the page's picture an inline SVG with the groups; then all selected and moved by the arrow key: drawn
// again, no warning, the groups still there. With the time to edit mode. A CellDesigner file's XML parsed once over that
// first span (the adding's drawing, the editor's GraphML and the live session of a drag sharing one document, plan 3
// step 4; three parses before), and at most twice for the move (cd_edit.place's own, written into, and one for the
// new drawing, its GraphML and the live session after it). The file is added as a copy with a comment at its end, so
// the site's own map of the same file, read ahead by the page, is not counted with it.
//   node tests/edit-entry.js [base address] [map files ...] [--local]   (default: the root page, two demo maps)
// --local: the working tree's editor routed into the live page.
var path = require('path'), fs = require('fs'), { chromium } = require('playwright'), editorNow = require('./editor-now.js');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var base = args[0] && /^https?:/.test(args[0]) ? args.shift() : 'https://viewer-source.github.io/';
var here = path.join(__dirname, '..');
var files = args.length ? args : [path.join(here, 'maps', 'srebp-celldesigner.xml'), path.join(here, 'maps', 'srebp-graphml.graphml')];
(async function () {
  var b = await chromium.launch(), bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  for (var i = 0; i < files.length; i++) {
    var f = files[i], ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
    page.setDefaultTimeout(600000);
    page.on('pageerror', function (e) { errs.push(e.message + ' ' + String(e.stack || '').split('\n').slice(1, 4).join(' ')); });
    if (local) {   // the working tree's editor and renderers in place of the page's
      var ed = editorNow(here);
      await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
      await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) {
        var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
        if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
      });
    }
    var MARK = 'edit-entry copy', copy = path.join(require('os').tmpdir(), 'edit-entry-' + process.pid, path.basename(f));
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.writeFileSync(copy, fs.readFileSync(f, 'utf8').replace(/\s*$/, '\n<!-- ' + MARK + ' -->\n'));
    var txt = fs.readFileSync(copy, 'utf8'), sig = { mark: MARK, len: txt.length, nodes: (txt.match(/<node /g) || []).length, alias: (txt.match(/<celldesigner:speciesAlias /g) || []).length };
    await page.addInitScript(function (sig) {   // every drawing of this map the editor could make, counted from the renderers' arrival
      window.__draws = 0; window.__parses = 0;
      var P = DOMParser.prototype.parseFromString;   // the map's own file parsed as XML (CellDesigner: an sbml text of its size)
      DOMParser.prototype.parseFromString = function (t, type) { if (typeof t === 'string' && sig.alias && /^\s*(<\?xml[^>]*>\s*)?<sbml[\s>]/.test(t.slice(0, 400)) && t.indexOf(sig.mark, t.length - 200) >= 0) window.__parses++; return P.apply(this, arguments); };
      var mine = function (a) {   // the map's text (or the GraphML made of it, or its document): by size and counts
        if (typeof a === 'string') return Math.abs(a.length - sig.len) < sig.len * 0.02 || (sig.alias && (a.match(/<node /g) || []).length >= sig.alias) || (sig.nodes && (a.match(/<node /g) || []).length === sig.nodes);
        if (a && a.nodeType === 9 && a.lastChild && a.lastChild.nodeType === 8) return a.lastChild.data.indexOf(sig.mark) >= 0;   // the CellDesigner file's parsed document
        return !!(a && a.getElementsByTagName) && a.getElementsByTagName('node').length === (sig.nodes || -1);
      };
      var wrap = function (o, ks) { ks.forEach(function (k) { if (o && o[k] && !o[k].__n) { var f = o[k], w = function (a) { if (mine(a)) window.__draws++; return f.apply(this, arguments); }; w.__n = 1; o[k] = w; } }); return o; };
      [['cdrender', ['render']], ['yrender', ['render']], ['cd_edit', ['draw', 'place']]].forEach(function (q) {
        var v; Object.defineProperty(window, q[0], { configurable: true, get: function () { return v; }, set: function (x) { v = wrap(x, q[1]); } });
      });
    }, sig);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type=file][accept*=".sbgn"]', { state: 'attached' });
    await page.setInputFiles('input[type=file][accept*=".sbgn"]', copy);
    await page.waitForFunction(function () { return location.hash.indexOf('#mine') === 0; }, null, { polling: 200 });
    await page.waitForTimeout(3000);
    var t0 = Date.now();
    await page.keyboard.press('e');
    await page.waitForFunction(function () { return document.querySelector('.m2-editing') !== null; }, null, { polling: 100 });
    var took = Date.now() - t0;
    await page.waitForTimeout(3000);
    var s = await page.evaluate(function () { var p = document.getElementById('m2-img'); return { parses: window.__parses, draws: window.__draws, svg: !!p && p.tagName.toLowerCase() === 'svg', groups: p ? p.querySelectorAll('[data-n]').length : 0, warn: (document.querySelector('#m2-ed-status') || {}).textContent || '' }; });
    var name = path.basename(f);
    ok(name + ': drawn once, on adding: nothing drawn again ahead or on entering edit', s.draws === 1, s.draws + ' drawings, edit mode in ' + took + ' ms');
    ok(name + ': the picture in place is the grouped drawing', s.svg && s.groups > 0, s.groups + ' groups');
    if (sig.alias) ok(name + ': its XML parsed once, from adding to the live session after entry', s.parses === 1, s.parses + ' parses');
    await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+a');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(function () { return window.__draws > 1; }, null, { polling: 200, timeout: 600000 }).catch(function () {});
    await page.waitForTimeout(1500);
    var s2 = await page.evaluate(function () { var p = document.getElementById('m2-img'); return { parses: window.__parses, draws: window.__draws, groups: p ? p.querySelectorAll('[data-n]').length : 0, warn: (document.querySelector('#m2-ed-status') || {}).textContent || '' }; });
    ok(name + ': a move after it is drawn', s2.draws > 1 && s2.groups > 0 && !/Not drawn|Cannot/.test(s2.warn), s2.draws + ' drawings, ' + s2.groups + ' groups' + (s2.warn ? ', said: ' + s2.warn : ''));
    if (sig.alias) ok(name + ': the move parsed at most twice (place, then one for the drawing, GraphML and live session)', s2.parses - s.parses <= 2, (s2.parses - s.parses) + ' parses');
    ok(name + ': no page errors', !errs.length, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all right');
  process.exit(bad ? 1 : 0);
})();
