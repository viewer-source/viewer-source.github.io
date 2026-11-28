// The editor stays silent on gestures a rule refuses (core.js settle, cdcreate.js cdApply's refused, create.js linkMake
// l.how.no): each is taken back or not done, and nothing appears in the Edit window (its text the same before and after,
// #m2-ed-status empty, not red), no dialog, no script error. On the root page, full editing (atlas-edit-level full):
//   CellDesigner, Glycolysis (glycolysis-celldesigner):
//   1. a species with lines (sa_n22) dragged onto a complex (sa_n3): the move taken back, the file as before.
//   2. Add reactant dragged from one species to another: nothing made.
//   3. Catalysis dragged between two species (Reduced notation ticked; CellDesigner has no reduced catalysis): nothing made.
//   CellDesigner, Carnitine (carnitine-celldesigner):
//   5. a compartment's member (sa_n0_n1) pushed against its compartment's border: the compartment grows, no Hold Shift hint.
//   4. one copy of a species drawn twice (sa_n9, both copies in no compartment) carried by Shift with the arrow keys
//      toward the compartment ca_n0: the step that would put it fully inside (cd_edit.nestCheck: every copy of a species
//      in one compartment) not done, it never inside, still in no compartment.
//   SBGN-ML, Testing Glycolysis (testing-glycolysis-sbgn):
//   6. Catalysis dragged from one macromolecule to another (a catalysis ends only at a process): nothing made.
//   7. a glyph with lines dragged onto a complex: the move taken back.
//   node tests/silent-editor.js [base address] --data=<clone of the data repository>   (Testing Glycolysis from its test set, added as a person adds a file)
var { chromium } = require('playwright');
var base = process.argv.slice(2).filter(function (a) { return a.slice(0, 2) !== '--'; })[0] || 'https://viewer-source.github.io/';
var OM = require('./lib/open-map.js');   // a map by its address, checked; a test-set map added from its file
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], dialogs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { if (d.type() === 'beforeunload') return d.accept().catch(function () {}); dialogs.push(d.message()); d.dismiss().catch(function () {}); });   // leaving a map with changes: the browser's own question
  await page.addInitScript(function () { try { localStorage.setItem('atlas-edit-level', 'full'); } catch (e) {} });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var said = function () { return page.evaluate(function () { var s = document.getElementById('m2-ed-status'), w = document.getElementById('m2-editwin'); return { text: w ? Array.from(w.children).filter(function (c) { return c.id !== 'm2-ed-local' && c.id !== 'm2-ed-gh'; }).map(function (c) { var t = c.innerText; c.querySelectorAll('.m2-ed-props').forEach(function (q) { if (q.innerText) t = t.replace(q.innerText, ''); }); return c.matches('.m2-ed-props') ? '' : t; }).join('\n') : '', status: s ? s.textContent : '', red: !!s && s.classList.contains('m2-ed-warn') }; }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, r.left, r.top]; }); };
  var open = async function (hash, mark) {
    var id = await OM.resolve(page, base, hash);
    await page.goto('about:blank'); await OM.byAddress(page, base, id);
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2500);
  };
  var calm = async function () { await page.keyboard.press('Escape'); await page.mouse.click(1380, 885); await page.waitForTimeout(400); };
  var drag = async function (A, B, id) {   // id: the node dragged, its drawing measured before the release (it went with the pointer)
    await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 8, { steps: 3 }); await page.mouse.move(B[0], B[1], { steps: 12 });
    await page.waitForTimeout(200); var mid = id ? await at(id) : null; await page.mouse.up(); await page.waitForTimeout(2500);
    return mid && Math.hypot(mid[0] - B[0], mid[1] - B[1]) < Math.hypot(A[0] - B[0], A[1] - B[1]) / 3;
  };
  // a gesture: the file and the Edit window's words compared before and after (the file: same, or same but for `allow`);
  // Properties left out, as it shows whatever is selected
  var silent = async function (name, fn, same) {
    await calm();
    var t0 = await now(), s0 = await said();
    var extra = await fn();
    var s1m = await said(); await calm();
    var t1 = await now(), s1 = await said();
    if (s1m.status) s1 = s1m;
    if (same !== false) ok(name + ': not done, the file as before', t1 === t0, t1.length - t0.length + ' characters');
    ok(name + ': nothing said', s1.text === s0.text && !s1.status && !s1.red, JSON.stringify(s1.status || s1.text.slice(0, 200)));
    return [t0, t1, extra];
  };
  var box = function (t, id) { var m = new RegExp('<celldesigner:(?:species|complexSpecies)Alias id="' + id + '"[\\s\\S]*?<celldesigner:bounds ([^/]*)/>').exec(t); return m ? ['x', 'y', 'w', 'h'].map(function (k) { return +new RegExp(k + '="([^"]+)"').exec(m[1])[1]; }) : null; };

  // CellDesigner
  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var r1 = await silent('1. CellDesigner: a species with lines dropped on a complex', async function () {
    var A = await at('sa_n22'); await page.mouse.click(A[0], A[1]); await page.waitForTimeout(300);
    return drag(A, await at('sa_n3'), 'sa_n22');
  });
  ok('1. the species went with the pointer onto the complex before the release', r1[2]);
  await silent('2. CellDesigner: Add reactant between two species', async function () {
    await page.click('#m2-editwin button[data-make="cd:ADD_REACTANT"]'); await drag(await at('sa_n20'), await at('sa_n0'));
  });
  await silent('3. CellDesigner: Catalysis between two species', async function () {
    await page.click('#m2-editwin button[data-make="cd:CATALYSIS"]'); await drag(await at('sa_n20'), await at('sa_n0'));
  });
  await open('carnitine-celldesigner', 'cd:PROTEIN');
  var r5 = await silent('5. CellDesigner: a member pushed against its compartment’s border', async function () {
    var A = await at('sa_n0_n1'); await page.mouse.click(A[0], A[1]); await page.waitForTimeout(300);
    await drag(A, [A[0] - 150, A[1] - 40]);
  }, false);
  ok('5. the compartment grew (the move done)', r5[1] !== r5[0]);
  var ca = box(r5[1], 'ca_n0');
  var cbox = function (t, id) { var m = new RegExp('<celldesigner:compartmentAlias id="' + id + '"[\\s\\S]*?<celldesigner:bounds ([^/]*)/>').exec(t); return m ? ['x', 'y', 'w', 'h'].map(function (k) { return +new RegExp(k + '="([^"]+)"').exec(m[1])[1]; }) : null; };
  var inside = false;
  var r4 = await silent('4. CellDesigner: arrow keys carrying one copy of a species drawn twice (sa_n9) into a compartment', async function () {
    var P = await at('sa_n9'); await page.mouse.click(P[0], P[1]); await page.waitForTimeout(300);
    for (var k = 0; k < 60; k++) {
      await page.keyboard.press(k < 24 ? 'Shift+ArrowLeft' : 'Shift+ArrowUp'); await page.waitForTimeout(120);
      if (k % 6 === 5 || k > 50) { var t = await now(), q = box(t, 'sa_n9'), c = cbox(t, 'ca_n0'); if (q && c && q[0] >= c[0] && q[1] >= c[1] && q[0] + q[2] <= c[0] + c[2] && q[1] + q[3] <= c[1] + c[3]) inside = true; }
    }
    await page.waitForTimeout(2000);
  }, false);
  var b0 = box(r4[0], 'sa_n9'), b1 = box(r4[1], 'sa_n9'), c1 = cbox(r4[1], 'ca_n0');
  ok('4. it moved as far as allowed, never fully inside the compartment', b1[0] < b0[0] && b1[1] < b0[1] && !inside && !(b1[1] >= c1[1] && b1[1] + b1[3] <= c1[1] + c1[3] && b1[0] >= c1[0] && b1[0] + b1[2] <= c1[0] + c1[2]), JSON.stringify([b0, b1, c1]));
  console.log('      sa_n9 ' + JSON.stringify(b0) + ' -> ' + JSON.stringify(b1) + ', ca_n0 ' + JSON.stringify(c1));
  ok('4. still in no compartment', !/compartmentAlias=/.test((/<celldesigner:speciesAlias id="sa_n9"[^>]*>/.exec(r4[1]) || [''])[0]));

  // SBGN-ML
  await open('testing-glycolysis-sbgn', 'macromolecule');
  var sb = await page.evaluate(function () {
    var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), G = Array.from(d.getElementsByTagName('*')).filter(function (e) { return e.localName === 'glyph'; });
    var arcs = Array.from(d.getElementsByTagName('*')).filter(function (e) { return e.localName === 'arc'; }), ends = {};
    arcs.forEach(function (a) { ends[a.getAttribute('source')] = 1; ends[a.getAttribute('target')] = 1; });
    var top = G.filter(function (g) { return g.parentNode.localName === 'map'; });
    return { macro: top.filter(function (g) { return g.getAttribute('class') === 'macromolecule'; }).map(function (g) { return [g.getAttribute('id'), !!ends[g.getAttribute('id')]]; }),
      complex: top.filter(function (g) { return g.getAttribute('class') === 'complex'; }).map(function (g) { return g.getAttribute('id'); }),
      chem: top.filter(function (g) { return g.getAttribute('class') === 'simple chemical' && ends[g.getAttribute('id')]; }).map(function (g) { return g.getAttribute('id'); }) };
  });
  var mm = sb.macro.map(function (x) { return x[0]; });
  if (mm.length >= 2) await silent('6. SBGN-ML: Catalysis between two macromolecules', async function () {
    await page.click('#m2-editwin button[data-make="catalysis"]'); await drag(await at(mm[0]), await at(mm[1]));
  });
  else ok('6. two macromolecules on the map', false, JSON.stringify(sb));
  var withLines = sb.macro.filter(function (x) { return x[1]; }).map(function (x) { return x[0]; }).concat(sb.chem)[0];
  if (sb.complex.length && withLines) await silent('7. SBGN-ML: a glyph with lines dropped on a complex', async function () {
    var A = await at(withLines); await page.mouse.click(A[0], A[1]); await page.waitForTimeout(300);
    ok('7. the glyph went with the pointer onto the complex before the release', await drag(A, await at(sb.complex[0]), withLines));
  });
  else ok('7. a complex and a glyph with lines on the map', false, JSON.stringify(sb));

  ok('no dialog', !dialogs.length, dialogs.join(' | '));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
