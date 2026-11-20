// Select all of this kind and Properties for several nodes (editor/src/create.js m2EditNodeItems, selectKind, propsMany):
// on the styles page, the right-click menu over a node in edit mode ends with Select all of this kind before Delete; chosen,
// every node of that kind is selected (SBGN-ML: its class, a macromolecule multimer counted with the macromolecules;
// CellDesigner: the species class; GraphML: the node's kind), and no other. Properties then shows only the rows every one
// has (never Label, never Set as default; no Width or Height on complexes); a row whose values differ is an empty field
// with the grey background (tr.m2-mixed); a fill typed goes to every selected node in one undo step, Width typed keeps
// each node's centre (GraphML maps have no Properties: there the selection alone is checked). Maps: Testing
// Glycolysis (SBGN-ML), Glycolysis (CellDesigner), Glycolysis (GraphML). Nothing is saved (no token). No script error.
//   node tests/select-kind.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var open = async function (hash) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin', { state: 'visible', timeout: 30000 }); await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(3000);
  };
  // a point on screen inside node id's box and off every smaller node box inside it (its members), nearest its centre
  // (the drawing takes no pointer events, so the boxes are read, not elementFromPoint)
  var spot = function (id) { return page.evaluate(function (id) {
    var g = document.querySelector('#m2-img [data-n="' + id + '"]'), r = g.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, best = null;
    var kids = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')).filter(function (q) { return q !== g; }).map(function (q) { return q.getBoundingClientRect(); })
      .filter(function (q) { return q.width * q.height < r.width * r.height && q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1; });
    for (var y = r.top + 3; y < r.bottom - 2; y += 2) for (var x = r.left + 3; x < r.right - 2; x += 2) {
      if (kids.some(function (q) { return x > q.left - 3 && x < q.right + 3 && y > q.top - 3 && y < q.bottom + 3; })) continue;
      var d = Math.hypot(x - cx, y - cy); if (!best || d < best[2]) best = [x, y, d];
    }
    return best; }, id); };
  var menu = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  // the nodes selected: each has eight handles round its box (core.js handleMarks), matched to the drawn node nearest in
  // centre and size (a CellDesigner node gets no grey fill, darkSel)
  var selected = function () { return page.evaluate(function () {
    var hs = Array.prototype.slice.call(document.querySelectorAll('.m2-ed-handle')).map(function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    var ns = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')).map(function (g) { return [g.getAttribute('data-n'), g.getBoundingClientRect()]; }), out = [];
    for (var i = 0; i + 7 < hs.length; i += 8) {
      var L = hs[i][0], T = hs[i][1], R = hs[i + 7][0], B = hs[i + 7][1], cx = (L + R) / 2, cy = (T + B) / 2, best = null;
      ns.forEach(function (n) { var r = n[1], d = Math.abs(r.left + r.width / 2 - cx) + Math.abs(r.top + r.height / 2 - cy) + Math.abs(r.width - (R - L)) + Math.abs(r.height - (B - T)); if (!best || d < best[1]) best = [n[0], d]; });
      if (best) out.push(best[0]);
    }
    return Array.from(new Set(out)).sort(); }); };
  var rows = function () { return page.$$eval('.m2-ed-pnode tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k + (r.classList.contains('m2-mixed') ? '*' : ''); }); }); };
  var centre = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1500); };
  var undo = async function () { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500); };
  // every drawn node right-clicked at its own spot; Select all of this kind chosen: [id, menu, selected, rows]
  var survey = async function () {
    var ids = await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (g) { return g.getAttribute('data-n'); }); }), out = [];
    for (var id of ids) {
      var P = await spot(id); if (!P) continue;
      var m = await menu(P), s = [], r = [];
      if (m.indexOf('Select all of this kind') >= 0) { await page.click('.m2-cx button:text-is("Select all of this kind")'); await page.waitForTimeout(500); s = await selected(); r = await rows(); }
      out.push({ id: id, P: P, menu: m, sel: s, rows: r });
    }
    return out;
  };
  var groups = function (sv) {   // the selections found, each once, with the nodes that gave them
    var g = {}; sv.forEach(function (x) { if (!x.sel.length) return; var k = x.sel.join(','); (g[k] = g[k] || { sel: x.sel, from: [], rows: x.rows, P: x.P }).from.push(x.id); }); return Object.values(g);
  };
  var selectAll = async function (P) { await menu(P); await page.click('.m2-cx button:text-is("Select all of this kind")'); await page.waitForTimeout(600); };

  // SBGN-ML
  await open('glycolysis-sbgn');
  var t0 = await now(), cls = {};
  (t0.match(/<glyph [^>]*>/g) || []).forEach(function (g) { var c = /class="([^"]+)"/.exec(g)[1]; cls[c] = (cls[c] || 0) + 1; });
  var sv = await survey(), gs = groups(sv);
  var withItem = sv.filter(function (x) { return x.menu.indexOf('Select all of this kind') >= 0; });
  ok('SBGN-ML: Select all of this kind the last item before Delete', withItem.length > 0 && withItem.every(function (x) { var i = x.menu.indexOf('Select all of this kind'); return x.menu[i + 1] === 'Delete' || x.menu.indexOf('Delete') < 0 || x.menu.indexOf('Delete') > i; }), JSON.stringify(withItem.map(function (x) { return x.menu; })[0]));
  ok('SBGN-ML: each selection is closed (every node in it gives the same selection)', gs.every(function (g) { return g.sel.every(function (i) { var s = sv.filter(function (x) { return x.id === i; })[0]; return !s || !s.sel.length || s.sel.join(',') === g.sel.join(','); }); }), JSON.stringify(gs.map(function (g) { return [g.sel, g.from]; })));
  var size = function (n) { return gs.filter(function (g) { return g.sel.length === n; })[0]; };
  var macro = size(cls['macromolecule'] + (cls['macromolecule multimer'] || 0)), chem = size(cls['simple chemical']), cpx = size(cls['complex']), proc = size(cls['process']);
  ok('SBGN-ML: macromolecules with their multimers selected together (' + (cls['macromolecule'] + cls['macromolecule multimer']) + ')', !!macro, JSON.stringify(gs.map(function (g) { return g.sel.length; })));
  ok('SBGN-ML: simple chemicals selected (' + cls['simple chemical'] + ')', !!chem);
  ok('SBGN-ML: complexes selected (' + cls['complex'] + ')', !!cpx);
  console.log('note  SBGN-ML: processes (' + cls['process'] + '): ' + (proc ? 'selected together' : 'no selection of that size') + '; selections found: ' + gs.map(function (g) { return g.sel.length; }).join(', '));
  if (macro) {
    ok('SBGN-ML macromolecules: rows Font size, Width, Height, Fill, Line, Border width, Multimer (no Label)', macro.rows.map(function (r) { return r.replace('*', ''); }).join(' ') === 'font w h fill line width multimer', macro.rows.join(' '));
    ok('SBGN-ML macromolecules: Multimer differs (mixed)', macro.rows.indexOf('multimer*') >= 0, macro.rows.join(' '));
    await selectAll(macro.P);
    var def = await page.$eval('.m2-ed-pdef', function (x) { return x.hidden || !!x.closest('[hidden]'); });
    ok('SBGN-ML macromolecules: no Set as default', def);
    var mb = await page.$eval('#m2-ed-multimer', function (f) { return f.indeterminate; });
    ok('SBGN-ML macromolecules: the Multimer tick box neither ticked nor not', mb);
    var mixedFill = macro.rows.indexOf('fill*') >= 0;
    if (mixedFill) {
      var fv = await page.$eval('#m2-ed-fill', function (f) { return [f.value, getComputedStyle(f).backgroundColor]; });
      ok('SBGN-ML macromolecules: a differing Fill shown empty and grey', fv[0] === '' && fv[1] === 'rgb(243, 244, 245)', JSON.stringify(fv));
    } else console.log('note  SBGN-ML macromolecules: Fill the same for all on this map, the grey field not seen here');
    var c0 = await Promise.all(macro.sel.map(centre));
    await type('fill', '#ff0000');
    var t1 = await now(), red = function () { return page.evaluate(function () {   // the glyphs whose style fills them red, by class (colour definitions resolved)
      var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), all = d.getElementsByTagName('*'), cols = {}, o = {}, cls = {};
      var at = function (e, n) { for (var i = 0; i < e.attributes.length; i++) if (e.attributes[i].localName === n) return e.attributes[i].value; return null; };
      Array.prototype.forEach.call(all, function (e) { if (e.localName === 'colorDefinition') cols[at(e, 'id')] = at(e, 'value'); if (e.localName === 'glyph') cls[at(e, 'id')] = at(e, 'class'); });
      Array.prototype.forEach.call(all, function (e) {
        if (e.localName !== 'style') return; var g = Array.prototype.filter.call(e.getElementsByTagName('*'), function (q) { return q.localName === 'g'; })[0], f = g && at(g, 'fill');
        if (f && cols[f]) f = cols[f]; if (!f || !/^#ff0000/i.test(f)) return;
        (at(e, 'idList') || '').split(/\s+/).forEach(function (id) { if (cls[id]) o[cls[id]] = (o[cls[id]] || 0) + 1; });
      });
      return o; }); };
    var r1 = await red();
    ok('SBGN-ML: Fill #ff0000 written to every macromolecule and multimer, nothing else', r1['macromolecule'] === cls['macromolecule'] && r1['macromolecule multimer'] === cls['macromolecule multimer'] && Object.keys(r1).length === 2, JSON.stringify(r1));
    ok('SBGN-ML: all still selected after the change', (await selected()).join(',') === macro.sel.join(','), (await selected()).join(','));
    ok('SBGN-ML: the Fill row now one value', (await rows()).indexOf('fill') >= 0 && (await page.inputValue('#m2-ed-fill')).toLowerCase() === '#ff0000', (await rows()).join(' '));
    await undo();
    ok('SBGN-ML: one undo puts the file back', (await now()) === t0);
    await selectAll(macro.P);
    await type('w', '100');
    var c1 = await Promise.all(macro.sel.map(centre)), t2 = await now();
    var moved = c0.map(function (c, j) { return Math.hypot(c[0] - c1[j][0], c[1] - c1[j][1]); }).filter(function (d) { return d > 1.5; });
    ok('SBGN-ML: Width 100 typed, each keeps its centre', !moved.length, JSON.stringify(moved));
    var w100 = await page.evaluate(function () {   // macromolecules (multimers too) whose bbox is 100 wide
      var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml');
      return Array.prototype.filter.call(d.getElementsByTagName('*'), function (e) { return e.localName === 'glyph' && /^macromolecule( multimer)?$/.test(e.getAttribute('class')); })
        .filter(function (e) { var bb = Array.prototype.filter.call(e.children, function (c) { return c.localName === 'bbox'; })[0]; return bb && Math.abs(parseFloat(bb.getAttribute('w')) - 100) < 0.01; }).length; });
    ok('SBGN-ML: Width 100 written to all ' + macro.sel.length, w100 === macro.sel.length, w100);
    await undo();
    ok('SBGN-ML: one undo puts the file back', (await now()) === t0);
  }
  if (cpx) ok('SBGN-ML complexes: no Width or Height rows', !cpx.rows.some(function (r) { return /^[wh]\*?$/.test(r); }) && cpx.rows.length > 0, cpx.rows.join(' '));

  // CellDesigner
  await open('glycolysis-celldesigner');
  var c0t = await now();
  var cdCls = await page.evaluate(function () {   // alias id -> species class, from the file
    var t = window.m2EditNow().text, sp = {}, out = {};
    (t.match(/<species [^>]*id="[^"]+"[\s\S]*?<\/species>/g) || []).concat(t.match(/<celldesigner:species id="[^"]+"[\s\S]*?<\/celldesigner:species>/g) || []).forEach(function (s) { var id = /id="([^"]+)"/.exec(s)[1], c = /<celldesigner:class>([^<]+)</.exec(s); if (c) sp[id] = c[1]; });
    (t.match(/<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="[^"]+" species="[^"]+"/g) || []).forEach(function (a) { var m = /id="([^"]+)" species="([^"]+)"/.exec(a); out[m[1]] = sp[m[2]]; });
    return out;
  });
  var byCls = {}; Object.keys(cdCls).forEach(function (a) { byCls[cdCls[a]] = (byCls[cdCls[a]] || 0) + 1; });
  sv = await survey(); gs = groups(sv);
  ok('CellDesigner: each selection one species class, all of it', gs.length > 0 && gs.every(function (g) { var cs = Array.from(new Set(g.sel.map(function (a) { return cdCls[a] || (/^ca/.test(a) ? 'compartment' : '?'); }))); return cs.length === 1 && (cs[0] === 'compartment' || g.sel.length === byCls[cs[0]]); }),
    JSON.stringify(gs.map(function (g) { return [g.sel.length, Array.from(new Set(g.sel.map(function (a) { return cdCls[a] || a; })))]; })) + ' ' + JSON.stringify(byCls));
  var prot = gs.filter(function (g) { return cdCls[g.sel[0]] === 'PROTEIN'; })[0];
  ok('CellDesigner: all ' + byCls.PROTEIN + ' proteins selected by one', !!prot && prot.sel.length === byCls.PROTEIN, prot && prot.sel.length);
  if (prot) {
    ok('CellDesigner proteins: no Label row', prot.rows.length > 0 && prot.rows.every(function (r) { return !/^label/.test(r); }), prot.rows.join(' '));
    await selectAll(prot.P);
    await type('fill', '#00ff00');
    var t3 = await now(), green = prot.sel.filter(function (a) { var m = new RegExp('<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="' + a + '"[\\s\\S]*?</celldesigner:(?:speciesAlias|complexSpeciesAlias)>').exec(t3); return m && /<celldesigner:paint color="ff00ff00"/i.test(m[0]); });
    ok('CellDesigner: Fill #00ff00 written to every protein (' + green.length + ' of ' + prot.sel.length + ')', green.length === prot.sel.length);
    var others = (t3.match(/color="ff00ff00"/gi) || []).length;
    ok('CellDesigner: and to nothing else', others === prot.sel.length, others);
    await undo();
    ok('CellDesigner: one undo puts the file back', (await now()) === c0t);
  }

  // GraphML
  await open('glycolysis-graphml');
  var g0 = await now();
  sv = await survey(); gs = groups(sv);
  ok('GraphML: Select all of this kind gives selections of several nodes', gs.some(function (g) { return g.sel.length > 1; }), JSON.stringify(gs.map(function (g) { return g.sel.length; })));
  var big = gs.sort(function (u, v) { return v.sel.length - u.sel.length; })[0];
  if (big) console.log('note  GraphML: ' + big.sel.length + ' selected; Properties rows: ' + (big.rows.join(' ') || 'none (no Properties on GraphML maps)'));
  if (big && big.rows.some(function (r) { return /^fill/.test(r); })) {
    await selectAll(big.P);
    await type('fill', '#0000ff');
    var g1 = await now(), blue = (g1.match(/<y:Fill color="#0000FF"/gi) || []).length;
    ok('GraphML: Fill written to all ' + big.sel.length + ' selected', blue >= big.sel.length, blue + ' of ' + big.sel.length);
    await undo();
    ok('GraphML: one undo puts the file back', (await now()) === g0);
  }

  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
