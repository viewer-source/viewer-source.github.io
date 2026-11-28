// Width, Height and Border width typed out of range in Properties (create.js inW, inH: 1 to 5000; sbSet width and the
// CellDesigner part's: 0.25 to 20), set to the nearest limit silently: on Testing Glycolysis (SBGN-ML) and Glycolysis
// (CellDesigner), a protein dropped from the palette and selected, Width 0, Width 9000, Height 0, Height 9000, Border
// width 0 and Border width 50 typed one after another: each written into the file at the limit (SBGN-ML: the glyph's
// bbox and the stroke-width of its style; CellDesigner: the alias's bounds and its singleLine width), shown at the limit
// in its field, no warning in the Edit window's status line. Nothing is saved (no token). No script error.
//   node tests/props-range.js [base address]
var engine = require('playwright')[process.env.BROWSER || 'chromium'];   // BROWSER=webkit or firefox: the same test in another engine
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var base = process.argv[2] || 'https://viewer-source.github.io/';
var MAPS = [['glycolysis-sbgn', 'macromolecule'], ['glycolysis-celldesigner', 'cd:PROTEIN']];
(async function () {
  var b = await engine.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var glyphs = function () { return page.evaluate(function () { return (window.m2EditNow().text.match(/<glyph [^>]*\bid="[^"]+"/g) || []).map(function (g) { return /\bid="([^"]+)"/.exec(g)[1]; }); }); };
  // the protein's [w, h, border width] in the file
  var look = function (fmt, id) { return page.evaluate(function (a) {
    var t = window.m2EditNow().text;
    if (a[0] === 'cd') {
      var al = new RegExp('<celldesigner:speciesAlias id="' + a[1] + '"[\\s\\S]*?</celldesigner:speciesAlias>').exec(t)[0], bb = /bounds [^>]*w="([^"]*)" h="([^"]*)"/.exec(al), sl = /<celldesigner:singleLine width="([^"]*)"/.exec(al);
      return [parseFloat(bb[1]), parseFloat(bb[2]), sl ? parseFloat(sl[1]) : null];
    }
    var d = new DOMParser().parseFromString(t, 'application/xml'), all = Array.prototype.slice.call(d.getElementsByTagName('*'));
    var at = function (e, n) { for (var i = 0; i < e.attributes.length; i++) if (e.attributes[i].localName === n) return e.attributes[i].value; return null; };
    var g = all.filter(function (e) { return e.localName === 'glyph' && e.getAttribute('id') === a[1]; })[0], bb2 = Array.prototype.filter.call(g.children, function (c) { return c.localName === 'bbox'; })[0];
    var st = all.filter(function (e) { return e.localName === 'style' && (at(e, 'idList') || '').split(/\s+/).indexOf(a[1]) >= 0; })[0], gg = st && Array.prototype.filter.call(st.getElementsByTagName('*'), function (q) { return q.localName === 'g'; })[0];
    return [parseFloat(bb2.getAttribute('w')), parseFloat(bb2.getAttribute('h')), gg && at(gg, 'stroke-width') != null ? parseFloat(at(gg, 'stroke-width')) : null]; }, [fmt, id]); };
  var status = function () { return page.evaluate(function () { var s = document.querySelector('.m2-ed-warn'); return s && s.offsetParent ? s.textContent.trim() : ''; }); };   // a warning: the status line in red (core.js warn)

  for (var M of MAPS) {
    var h = M[0], fmt = /celldesigner/.test(h) ? 'cd' : 'sb';
    await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + M[1] + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(3000);
    var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    var before = await ids(), g0 = fmt === 'sb' ? await glyphs() : [];
    var s = await page.$eval('#m2-editwin button[data-make="' + M[1] + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    var X = view[2] - 300, Y = view[3] - 200;
    await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(X, Y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    var nid = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0], fid = fmt === 'sb' ? (await glyphs()).filter(function (i) { return g0.indexOf(i) < 0; })[0] : nid;
    ok(h + ': a protein dropped', !!nid && !!fid, nid + ' ' + fid);
    if (!nid || !fid) continue;
    var select = async function () {   // a click inside it near its top left corner
      var r = await page.$eval('#m2-img [data-n="' + nid + '"]', function (g) { var q = g.getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; });
      await page.keyboard.press('Escape'); await page.mouse.click(r[0] + Math.min(6, r[2] / 2), r[1] + Math.min(6, r[3] / 2)); await page.waitForTimeout(500);
    };
    var cases = [['w', '0', 0, 1], ['w', '9000', 0, 5000], ['w', '80', 0, 80], ['h', '0', 1, 1], ['h', '9000', 1, 5000], ['h', '40', 1, 40], ['width', '0', 2, 0.25], ['width', '50', 2, 20]];
    await select();   // selected once: a value set keeps it selected (keepSel), and a box 5000 wide reaches off screen
    for (var c of cases) {
      if (!(await page.$('#m2-ed-' + c[0] + ':visible'))) { ok(h + ': ' + c[0] + ' row shown, the protein still selected', false); continue; }
      await page.fill('#m2-ed-' + c[0], c[1]); await page.press('#m2-ed-' + c[0], 'Enter'); await page.waitForTimeout(1500);
      await page.evaluate(function () { document.activeElement && document.activeElement.blur && document.activeElement.blur(); }); await page.waitForTimeout(300);
      var L = await look(fmt, fid), v = L[c[2]], f = parseFloat(await page.inputValue('#m2-ed-' + c[0]));
      ok(h + ': ' + c[0] + ' ' + c[1] + ' typed: ' + c[3] + ' in the file and in the field', v != null && Math.abs(v - c[3]) < 0.01 && Math.abs(f - c[3]) < 0.01, JSON.stringify([L, f]));
    }
    var st = await status();
    ok(h + ': no warning in the status line', !st, st);
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
