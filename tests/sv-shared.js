// Once a variable, always a variable, on the live styles page, an
// SBGN-ML map: a state variable added on one PKA-C appears on its two other copies (one a complex member) at the same
// place; its variable typed (P@S13) is written on the copies with their own empty value; one undo takes the naming back
// everywhere, another the state variables; moved by the arrow keys on every copy; a glyph renamed PKA-C takes the variable; Delete removes it from every copy.
// CellDesigner: on a map with one protein entry per species, a state variable added on one HSL shows on every HSL.
// No script error.
//   node tests/sv-shared.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var esc = async function () { for (var n = 0; n < 3; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); } };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  // every macromolecule: id, name, box, state variables [value, variable, centre ratio]
  var macros = function () {
    return page.evaluate(function () {
      var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), out = {};
      var kid = function (x, n) { return Array.prototype.filter.call(x.children, function (c) { return c.localName === n; }); };
      var bb = function (x) { var q = kid(x, 'bbox')[0]; return ['x', 'y', 'w', 'h'].map(function (k) { return +q.getAttribute(k); }); };
      Array.prototype.forEach.call(d.getElementsByTagName('glyph'), function (g) {
        if (!/^macromolecule/.test(g.getAttribute('class'))) return;
        var B = bb(g), l = kid(g, 'label')[0];
        out[g.getAttribute('id')] = { name: l ? l.getAttribute('text') : '', box: B, sv: kid(g, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }).map(function (c) {
          var s = kid(c, 'state')[0], p = bb(c);
          return [s ? s.getAttribute('value') || '' : '', s ? s.getAttribute('variable') || '' : '', [Math.round(((p[0] + p[2] / 2 - B[0]) / B[2] - 0.5) * 100) / 100, Math.round(((p[1] + p[3] / 2 - B[1]) / B[3] - 0.5) * 100) / 100]];
        }) };
      });
      return out;
    });
  };
  var named = function (M, nm) { return Object.keys(M).filter(function (k) { return M[k].name === nm; }); };
  var screen = async function (id, M, j) {   // a state variable's centre on the screen
    var r = await rect(id), B = M[id].box, s = M[id].sv[j][2], sx = r[2] / B[2];   // the drawn group may be wider than the box by the icons: the box's middle kept
    return [r[0] + r[2] / 2 + s[0] * B[2] * sx, r[1] + r[3] / 2 + s[1] * B[3] * sx];
  };
  await page.goto(base + '#glycolysis-sbgn', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  if (!(await page.$('#m2-editwin button[data-make]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var M0 = await macros(), pc = named(M0, 'PKA-C');
  ok('three PKA-C, none with a state variable', pc.length === 3 && pc.every(function (k) { return !M0[k].sv.length; }), JSON.stringify(pc));
  var free = pc.filter(function (k) { return k === 'n6'; })[0] || pc[pc.length - 1], r = await rect(free);
  await esc(); await page.mouse.click(r[0] + r[2] / 2, r[1] + r[3] / 2, { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Add state variable")'); await page.waitForTimeout(900);
  var M1 = await macros();
  ok('added on every copy', pc.every(function (k) { return M1[k].sv.length === 1; }), JSON.stringify(pc.map(function (k) { return M1[k].sv; })));
  ok('at the same place', pc.every(function (k) { return M1[k].sv[0] && JSON.stringify(M1[k].sv[0][2]) === JSON.stringify(M1[free].sv[0][2]); }), JSON.stringify(pc.map(function (k) { return M1[k].sv[0] && M1[k].sv[0][2]; })));
  var P = await screen(free, M1, 0);
  await page.mouse.click(P[0], P[1]); await page.waitForTimeout(600);   // selected already: a click opens its text
  if (!(await page.$('input.m2-ed-type'))) { await page.mouse.dblclick(P[0], P[1]); await page.waitForTimeout(600); }
  ok('its text opened', !!(await page.$('input.m2-ed-type')));
  await page.keyboard.type('P@S13'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  var M2 = await macros();
  ok('typed: P@S13 on the glyph', M2[free].sv[0] && M2[free].sv[0][0] === 'P' && M2[free].sv[0][1] === 'S13', JSON.stringify(M2[free].sv));
  ok('the copies: S13 with their own empty value', pc.filter(function (k) { return k !== free; }).every(function (k) { return M2[k].sv.length === 1 && M2[k].sv[0][0] === '' && M2[k].sv[0][1] === 'S13'; }), JSON.stringify(pc.map(function (k) { return M2[k].sv; })));
  await esc(); await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  var M3 = await macros();
  ok('one undo: the naming gone everywhere', pc.every(function (k) { return M3[k].sv.length === 1 && !M3[k].sv[0][1]; }), JSON.stringify(pc.map(function (k) { return M3[k].sv; })));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  var M4 = await macros();
  ok('two undos: no state variable on any copy', pc.every(function (k) { return !M4[k].sv.length; }));
  await page.keyboard.press('Control+y'); await page.waitForTimeout(600); await page.keyboard.press('Control+y'); await page.waitForTimeout(800);
  var M5 = await macros();
  ok('redone: S13 on every copy', pc.every(function (k) { return M5[k].sv.length === 1 && M5[k].sv[0][1] === 'S13'; }), JSON.stringify(pc.map(function (k) { return M5[k].sv; })));
  // moved by the arrow keys: every copy to the same place
  var Pm = await screen(free, M5, 0);
  await esc(); await page.mouse.click(Pm[0], Pm[1]); await page.waitForTimeout(500);
  await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(500);
  var Mm = await macros();
  ok('moved on every copy to the same place', JSON.stringify(Mm[free].sv[0][2]) !== JSON.stringify(M5[free].sv[0][2]) && pc.every(function (k) { return JSON.stringify(Mm[k].sv[0][2]) === JSON.stringify(Mm[free].sv[0][2]); }), JSON.stringify(pc.map(function (k) { return Mm[k].sv[0][2]; })));
  M5 = Mm;
  // a glyph named PKA-C takes the variable
  var other = named(M5, 'PFK1')[0], ro = await rect(other);
  await esc(); await page.mouse.dblclick(ro[0] + ro[2] / 2, ro[1] + ro[3] / 2); await page.waitForTimeout(600);
  ok('name opened', !!(await page.$('input.m2-ed-type')));
  await page.keyboard.press('Control+a'); await page.keyboard.type('PKA-C'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  var M6 = await macros();
  ok('renamed PKA-C: it has S13', M6[other].name === 'PKA-C' && M6[other].sv.some(function (q) { return q[1] === 'S13' && q[0] === ''; }), JSON.stringify(M6[other]));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  var M7 = await macros();
  ok('undone in one step: PFK1, no state variable', M7[other].name === 'PFK1' && !M7[other].sv.length, JSON.stringify(M7[other]));
  // Delete on one: gone from every copy
  var Q = await screen(free, M7, 0);
  await esc(); await page.mouse.click(Q[0], Q[1]); await page.waitForTimeout(500); await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  var M8 = await macros();
  ok('deleted from every copy', pc.every(function (k) { return !M8[k].sv.length; }), JSON.stringify(pc.map(function (k) { return M8[k].sv; })));
  // copies with value-only state variables of their own (PFKFB2: P on one, fvdfcvfgv on the other, at other places):
  // the P deleted on one leaves the other's own
  var pf = named(M8, 'PFKFB2'), withP = pf.filter(function (k) { return M8[k].sv.some(function (q) { return q[0] === 'P'; }); })[0], rest = pf.filter(function (k) { return k !== withP; });
  var jP = M8[withP].sv.map(function (q) { return q[0]; }).indexOf('P'), QP = await screen(withP, M8, jP);
  await esc(); await page.mouse.click(QP[0], QP[1]); await page.waitForTimeout(500); await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  var M9 = await macros();
  ok('P deleted on its PFKFB2', !M9[withP].sv.some(function (q) { return q[0] === 'P'; }), JSON.stringify(M9[withP].sv));
  ok('the other PFKFB2 keeps its own fvdfcvfgv', rest.every(function (k) { return M9[k].sv.some(function (q) { return q[0] === 'fvdfcvfgv'; }); }), JSON.stringify(rest.map(function (k) { return M9[k].sv; })));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  ok('the other glyphs untouched', Object.keys(M0).filter(function (k) { return pc.indexOf(k) < 0; }).every(function (k) { return JSON.stringify(M8[k].sv.map(function (q) { return q.slice(0, 2); })) === JSON.stringify(M0[k].sv.map(function (q) { return q.slice(0, 2); })); }));
  // CellDesigner: a map with one protein entry per species (the TAG map: HSL four times, each its own entry); a state
  // variable added on one HSL shows on every HSL, the states the map had kept, one undo takes it all back
  await page.goto(base + '#sites-tag-2026-celldesigner', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.waitForSelector('#m2-editwin button[data-make]', { state: 'visible', timeout: 60000 }); await page.waitForTimeout(3000);
  var cdHsl = function () {
    return page.evaluate(function () {
      var t = window.m2EditNow().text, M = window.cd_make, out = {}, sp = {};
      t.replace(/<(?:celldesigner:)?species [^>]*>/g, function (g) { var id = / id="([^"]+)"/.exec(g), nm = / name="([^"]+)"/.exec(g); if (id && nm) sp[id[1]] = nm[1]; });
      t.replace(/<celldesigner:(?:speciesAlias|complexSpeciesAlias) [^>]*>/g, function (g) { var a = / id="([^"]+)"/.exec(g)[1], s = / species="([^"]+)"/.exec(g); if (s && sp[s[1]] === 'HSL') out[a] = M.features(t, a).residues.length; });
      return { res: out, mods: (t.match(/<celldesigner:modification residue=/g) || []).length };
    });
  };
  var H0 = await cdHsl(), ha = Object.keys(H0.res);
  ok('CellDesigner: HSL shown ' + ha.length + ' times', ha.length >= 2, JSON.stringify(H0));
  var hr = await rect(ha.filter(function (a) { return !/n\d+_n\d+_n/.test(a); })[0] || ha[0]);
  await esc(); await page.mouse.click(hr[0] + hr[2] / 2, hr[1] + hr[3] / 2, { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Add state variable")'); await page.waitForTimeout(2500); await esc();
  var H1 = await cdHsl(), most = Math.max.apply(null, ha.map(function (a) { return H0.res[a]; }));
  ok('CellDesigner: on every HSL, the residues of all its entries joined', ha.every(function (a) { return H1.res[a] === H1.res[ha[0]] && H1.res[a] >= most + 1; }), JSON.stringify([H0.res, H1.res]));
  ok('CellDesigner: the states the map had kept (and the new one\'s)', H1.mods === H0.mods + 1, H0.mods + ' ' + H1.mods);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  var H2 = await cdHsl();
  ok('CellDesigner: one undo, as it was', JSON.stringify(H2) === JSON.stringify(H0), JSON.stringify(H2));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
