// State by lifetime (plan 3 step 4, editor/src/state.js): editing moves from one map to another, each pair of formats
// (GraphML, CellDesigner, SBGN-ML), with the first map left holding a selection and a move. On the second map every field
// of the map, gesture, drawing and cache lifetimes is as at the start but what the opening itself gives (its text, its
// format, its process glyphs, the CellDesigner live session's base): nothing of the first map carried over, the format
// fields those of the second map alone. The page's fields are left as they were. Full editing, no token (the moves kept
// as drafts in this browser). A CellDesigner document kept by the editor is never the first map's once the second is
// shown. Read through window.m2EditState, which only reads.
//   node tests/map-switch.js [base address] [--local] --data=<clone of the data repository>   (--local: the working tree's editor and renderers routed in)
var path = require('path'), fs = require('fs'), { chromium } = require('playwright'), editorNow = require('./editor-now.js'), OM = require('./lib/open-map.js');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a.slice(0, 2) !== '--'; });
var base = args[0] || 'https://viewer-source.github.io/', here = path.join(__dirname, '..');
var MAPS = { graphml: 'glycolysis-graphml', celldesigner: 'glycolysis-celldesigner', sbgn: 'testing-glycolysis-sbgn' };
// what the opening of a map sets, by format: checked apart
var OPENED = ['text', 'F', 'cd', 'sb', 'sbLast', 'procs', 'cdBase'];   // F: the map's format object (state.js formats)
(async function () {
  var b = await chromium.launch(), bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) {
    var ed = editorNow(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) {
      var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
      if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
    });
  }
  var state = function () {   // the fields as plain values: a list by its length, an object as present or not
    return page.evaluate(function () {
      var s = window.m2EditState && window.m2EditState(), out = {};
      if (!s) return null;
      ['page', 'map', 'gesture', 'drawing', 'cache'].forEach(function (kind) { out[kind] = {}; Object.keys(s[kind]).forEach(function (k) { var v = s[kind][k]; out[kind][k] = Array.isArray(v) ? { list: v.length } : v && typeof v === 'object' ? { set: true } : typeof v === 'string' ? { text: v.length } : v; }); });
      out.cdKept = s.cdKept;
      out.fmtName = s.map.F && s.map.F.name;   // the format object the opening chose
      out.strictFresh = s.cache.cdStrictMemo[0] !== '__planted';   // the tick box's memo, read again for this map or empty
      out.hpOwn = !s.cache.hpMemo || s.cache.hpMemo[0] === s.map.text;   // the ports cache, when filled, of this map's own text (its drawing fills it)
      return out;
    });
  };
  var editingOn = function (id) {
    return page.waitForFunction(function (id) { var n = window.m2EditNow && window.m2EditNow(); return !!(n && n.id === id); }, id, { timeout: 60000 }).then(function () { return page.waitForTimeout(1500); });
  };
  var pickNode = async function () {
    // a node in sight, its centre not under a panel (a map added from a file opens at its own scale, not fitted)
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850 && (document.elementFromPoint(x, y) || {}).id === 'm2-view') return [x, y]; } return null; });
    if (!c) return false;
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400);
    return true;
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-edit-side', 'right'); });
  MAPS.sbgn = await OM.resolve(page, base, MAPS.sbgn);   // after the storage is cleared: the test-set map's address in this browser
  var kinds = Object.keys(MAPS), first = true;
  for (var i = 0; i < kinds.length; i++) for (var j = 0; j < kinds.length; j++) {
    if (i === j) continue;
    var A = MAPS[kinds[i]], B = MAPS[kinds[j]];
    console.log('-- ' + kinds[i] + ' then ' + kinds[j]);
    if (first) {
      await OM.byAddress(page, base, A);
      await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
      await page.click('.m2-ri[data-win="edit"]'); first = false;
    } else await page.click('.m2-map[data-id="' + A + '"]');
    await editingOn(A);
    // the first map left busy: a node selected and moved by the keys (dirty, an undo step, the keys' run)
    var picked = await pickNode();
    await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(600);   // past the keys' settle
    // and fields no gesture here sets, planted: a selected state variable, a CellDesigner unit being typed, a gate being
    // made, the caches; each one a switch before this step did not clear
    await page.evaluate(function () { window.m2EditPlant({ svSel: { id: '__planted', j: 0 }, cdPend: { id: '__planted', kind: 'x', angle: 0 }, cdGate: { kind: 'and', inputs: [] }, hpMemo: ['__planted', {}], cdStrictMemo: ['__planted', true] }); });
    var a = await state();
    ok(kinds[i] + ': a node selected and moved before leaving, fields planted', picked && a && a.map.selN.list > 0 && a.map.dirty === true && a.map.svSel && a.gesture.cdPend, a ? 'selected ' + a.map.selN.list + ', dirty ' + a.map.dirty : 'no state');
    var page0 = a && a.page;
    await page.click('.m2-map[data-id="' + B + '"]');
    await editingOn(B);
    var s = await state();
    if (!s) { ok(kinds[j] + ': editing state read', false); continue; }
    var left = [];
    ['map', 'gesture', 'drawing', 'cache'].forEach(function (kind) {
      Object.keys(s[kind]).forEach(function (k) {
        if (OPENED.indexOf(k) >= 0 || (k === 'hpMemo' && s.hpOwn)) return;
        var v = s[kind][k], start = v === null || v === false || (v && v.list === 0) || (k === 'cdStrictMemo' && s.strictFresh);
        if (!start) left.push(kind + '.' + k + '=' + JSON.stringify(v));
      });
    });
    ok(kinds[j] + ': nothing of the first map carried over', !left.length, left.join(', '));
    var cd = kinds[j] === 'celldesigner', sb = kinds[j] === 'sbgn';
    ok(kinds[j] + ': its format alone (cd, sb, sbLast)', !!s.map.cd === cd && !!s.map.sb === sb && !!s.map.sbLast === sb,
      'cd ' + JSON.stringify(s.map.cd) + ', sb ' + JSON.stringify(s.map.sb) + ', sbLast ' + JSON.stringify(s.map.sbLast));
    ok(kinds[j] + ': its format object', s.fmtName === { graphml: 'graphml', celldesigner: 'cd', sbgn: 'sb' }[kinds[j]], 'F ' + s.fmtName);
    ok(kinds[j] + ': its own text, of this map', s.map.text && s.map.text.text > 0);
    ok(kinds[j] + ': no parsed document of the first map kept', kinds[j] === 'celldesigner' ? s.cdKept === null || s.cdKept === B : s.cdKept === null, 'kept for ' + s.cdKept);
    ok(kinds[j] + ': the page\'s fields left as they were', page0 && Object.keys(page0).every(function (k) { return k === 'palShown' || k === 'afSbgn' || JSON.stringify(page0[k]) === JSON.stringify(s.page[k]); }));
  }
  ok('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all right');
  process.exit(bad ? 1 : 0);
})();
