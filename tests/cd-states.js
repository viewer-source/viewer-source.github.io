// State variables and units of information on a CellDesigner map (editor/src/cdcreate.js through create.js's svList,
// svAt, typeIn): on a protein made from the palette, the right-click menu's Add state variable (only an empty circle, no
// window), a double click opening its window below the protein, quiet (Site, then Modification as CellDesigner's list
// writes it, no other text or example, no field focused), Y705 phosphorylated, Enter closing it; Esc drops a site typed;
// the residue's own menu (Edit, Change state, Delete), Edit's modification written at once; the residue (at the bottom middle, the first place) dragged round
// the border to the right; Add structural state typed in its ellipse at the top middle of a monomer, moved to the bottom
// by Add unit of information (N:2, chosen in its window); Open chosen in its window, undone; on a multimer a new
// structural state at the bottom; the unit's window (CellDesigner's Edit Information: Prefix, then Label as a list for
// pc, mt and ct, a text for N and free input) and its own menu (Edit, Change unit); the residue deleted by the Delete key and undone. Nothing is saved (no token). No
// script error.
//   node tests/cd-states.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#acly-celldesigner', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var menu = async function (P) { for (var n = 0; n < 2 && (await page.$('.m2-cx')); n++) await page.keyboard.press('Escape');
    await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var pick = async function (label) { await page.click('.m2-cx button:text-is("' + label + '")'); await page.waitForTimeout(800); };
  var type = async function (v) { await page.waitForSelector('input.m2-ed-type', { timeout: 3000 }); await page.fill('input.m2-ed-type', v); await page.press('input.m2-ed-type', 'Enter'); await page.waitForTimeout(900); };
  var protein = function (t, sid) { var m = new RegExp('<species [^>]*id="' + sid + '"[\\s\\S]*?<celldesigner:proteinReference>([^<]*)<').exec(t); if (!m) return ''; var p = new RegExp('<celldesigner:protein [^>]*id="' + m[1] + '"([^>]*/>|[\\s\\S]*?</celldesigner:protein>)').exec(t); return p ? p[0] : ''; };
  var speciesOf = function (t, alias) { var m = new RegExp('<celldesigner:speciesAlias id="' + alias + '" species="([^"]*)"').exec(t); return m ? m[1] : ''; };
  var speciesText = function (t, sid) { var m = new RegExp('<species [^>]*id="' + sid + '"[\\s\\S]*?</species>').exec(t); return m ? m[0] : ''; };
  var aliasText = function (t, a) { var m = new RegExp('<celldesigner:speciesAlias id="' + a + '"[\\s\\S]*?</celldesigner:speciesAlias>').exec(t); return m ? m[0] : ''; };

  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var a0 = await ids(); await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(1150, 300); await page.waitForTimeout(900);
  var p = (await ids()).filter(function (i) { return a0.indexOf(i) < 0; })[0];
  await page.keyboard.press('Escape');
  ok('a protein made', !!p);
  var R = await rect(p), C = [R[0] + R[2] / 2, R[1] + R[3] / 2], B = [R[0] + R[2] / 2, R[1] + R[3] - 1], T = [R[0] + R[2] - 1, R[1] + R[3] / 2];
  var t = await now(), sid = speciesOf(t, p);
  var items = await menu(C);
  ok('the protein\'s menu offers Add state variable, Add structural state, Add unit of information first', items.slice(0, 3).join('|') === 'Add state variable|Add structural state|Add unit of information', items.join('|'));
  await pick('Add state variable');
  t = await now();
  ok('an empty residue on the protein, its state empty on the species', /<celldesigner:modificationResidue [^>]*id="rs\d+"/.test(protein(t, sid)) && /<celldesigner:modification residue="rs\d+" state="empty"\/>/.test(speciesText(t, sid)), protein(t, sid));
  var a1 = /<celldesigner:modificationResidue angle="([^"]*)"/.exec(protein(t, sid));
  ok('at the first place of the order: the bottom middle', a1 && Math.abs(+a1[1] - 3 * Math.PI / 2) < 0.01, a1 && a1[1]);
  ok('Add state variable: only the circle, no window', !(await page.$('.m2-cdsv')) && !(await page.$('input.m2-ed-type')));
  await page.mouse.dblclick(B[0], B[1]); await page.waitForSelector('.m2-cdsv', { timeout: 3000 }); await page.waitForTimeout(200);
  ok('a double click opens its window: Site, then Modification, no other text or example', (await page.$$eval('.m2-cdsv label span', function (l) { return l.map(function (x) { return x.textContent; }).join('|'); })) === 'Site|Modification' && !(await page.$('.m2-cdsv p')) && !(await page.$('.m2-cdsv [placeholder]')));
  ok('nothing focused in it: the window itself has the keys', (await page.evaluate(function () { var a = document.activeElement; return a && a.classList.contains('m2-cdsv'); })));
  var wb = await page.$eval('.m2-cdsv', function (x) { var r = x.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  ok('the window below the protein', wb[1] >= R[1] + R[3], wb.join(','));
  var names = await page.$$eval('.m2-cdsv option', function (l) { return l.map(function (x) { return x.textContent; }).join('|'); });
  ok('Modification as CellDesigner writes it: lowercase, no symbols', names.indexOf('phosphorylated|acetylated') === 0 && !/[A-Z(]/.test(names), names);
  await page.fill('.m2-cdsv input', 'Y705'); await page.selectOption('.m2-cdsv select', 'phosphorylated'); await page.waitForTimeout(600);
  await page.press('.m2-cdsv input', 'Enter'); await page.waitForTimeout(900);
  t = await now();
  ok('Y705, phosphorylated: written, the window closed by Enter', / name="Y705"/.test(protein(t, sid)) && /state="phosphorylated"/.test(speciesText(t, sid)) && !(await page.$('.m2-cdsv')), protein(t, sid));
  await page.mouse.dblclick(B[0], B[1]); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('a double click opens its window with its site and modification', (await page.$eval('.m2-cdsv input', function (x) { return x.value; })) === 'Y705' && (await page.$eval('.m2-cdsv select', function (x) { return x.value; })) === 'phosphorylated');
  ok('only CellDesigner\'s modifications offered', (await page.$$eval('.m2-cdsv option', function (l) { return l.length; })) >= 13 && !(await page.$('input.m2-ed-type')));
  await page.fill('.m2-cdsv input', 'Y999'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Esc closes it, the site typed not kept', (await now()) === t && !(await page.$('.m2-cdsv')));
  items = await menu(B);
  ok('the residue\'s own menu: Edit, Change state and Delete, no species items', items.indexOf('Edit') === 0 && items.some(function (x) { return /^Change state/.test(x); }) && items.indexOf('Delete') >= 0 && items.indexOf('Change identity') < 0 && items.indexOf('Add state variable') < 0, items.join('|'));
  var items2 = await menu([B[0] - 5, B[1]]);
  ok('over the residue\'s outer half, out of the protein: its own menu, no map items', items2.join('|') === items.join('|'), items2.join('|'));
  await menu(B); await pick('Edit');
  await page.selectOption('.m2-cdsv select', 'ubiquitinated'); await page.waitForTimeout(900);
  t = await now();
  ok('Edit, ubiquitinated chosen: written at once, the site kept', /state="ubiquitinated"/.test(speciesText(t, sid)) && / name="Y705"/.test(protein(t, sid)));
  await page.mouse.click(5, 450); await page.waitForTimeout(300);
  ok('a click outside closes it', !(await page.$('.m2-cdsv')));
  await page.keyboard.press('Escape');
  await page.mouse.dblclick(B[0], B[1]); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('Site holds the site only', (await page.$eval('.m2-cdsv input', function (x) { return x.value; })) === 'Y705');
  await page.fill('.m2-cdsv input', 'Y701'); await page.press('.m2-cdsv input', 'Enter'); await page.waitForTimeout(900);
  t = await now();
  ok('the site retyped: Y701, the state kept', / name="Y701"/.test(protein(t, sid)) && /state="ubiquitinated"/.test(speciesText(t, sid)));
  await page.keyboard.press('Escape');
  await page.mouse.click(B[0], B[1]); await page.waitForTimeout(300);   // selected
  await page.mouse.move(B[0], B[1]); await page.mouse.down(); await page.mouse.move(B[0] + 10, B[1] - 10, { steps: 3 }); await page.mouse.move(T[0], T[1], { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(900);
  t = await now();
  var ang = /<celldesigner:modificationResidue angle="([^"]*)"/.exec(protein(t, sid));
  ok('dragged to the right side\'s middle: its angle 0', ang && Math.abs(+ang[1]) < 0.01, ang && ang[1]);
  await page.keyboard.press('Escape');
  await menu(C); await pick('Add state variable');
  ok('a second residue, empty, no window', (protein(await now(), sid).match(/<celldesigner:modificationResidue /g) || []).length === 2 && !(await page.$('.m2-cdsv')));
  await page.keyboard.press('Escape');
  await page.mouse.dblclick(T[0], T[1]); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('the first residue\'s window: Y701', (await page.$eval('.m2-cdsv input', function (x) { return x.value; })) === 'Y701');
  for (var tb = 0; tb < 3; tb++) await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  ok('Tab stays in the window', !!(await page.evaluate(function () { return document.activeElement && document.activeElement.closest('.m2-cdsv'); })));
  await page.keyboard.press('Escape');
  await menu(C); await pick('Add structural state');
  ok('Add structural state: its text typed in the ellipse, no window', !(await page.$('.m2-cdsv')) && !!(await page.$('input.m2-ed-type')));
  await type('active');
  t = await now();
  var sa = /<celldesigner:structuralState angle="([^"]*)"/.exec(aliasText(t, p));
  ok('active, at the top middle (a monomer, no unit of information, no multimer of it on the map)', /<celldesigner:structuralState structuralState="active"\/>/.test(speciesText(t, sid)) && sa && Math.abs(+sa[1] - Math.PI / 2) < 0.01, sa && sa[1]);
  items = await menu(C);
  ok('no second Add structural state', items.indexOf('Add structural state') < 0 && items.indexOf('Add unit of information') >= 0, items.join('|'));
  await pick('Add unit of information'); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('Add unit of information: its window, Prefix and Label, pc and T shown, nothing written yet', (await page.$$eval('.m2-cdsv label:not([hidden]) span', function (l) { return l.map(function (x) { return x.textContent; }).join('|'); })) === 'Prefix|Label'
    && (await page.$eval('.m2-cdsv select', function (x) { return x.value; })) === 'pc' && !/<celldesigner:info state="open"/.test(aliasText(await now(), p)));
  await page.selectOption('.m2-cdsv select', 'N'); await page.waitForTimeout(300);
  ok('N chosen: a text field for the label', !!(await page.$('.m2-cdsv label:not([hidden]) input')));
  await page.fill('.m2-cdsv input', '2'); await page.press('.m2-cdsv input', 'Enter'); await page.waitForTimeout(900);
  t = await now();
  sa = /<celldesigner:structuralState angle="([^"]*)"/.exec(aliasText(t, p));
  ok('Add unit of information N:2 from its window; the structural state moved off the top (no room beside the unit) to the first free place: the bottom middle and its quarters near the second residue, the right taken by the first, so the left middle', /<celldesigner:info state="open" prefix="N" label="2"/.test(aliasText(t, p)) && sa && Math.abs(+sa[1] - Math.PI) < 0.01, sa && sa[1]);
  await page.mouse.dblclick(R[0] + 1, R[1] + R[3] / 2); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('the structural state\'s window by a double click: Text, active', (await page.$eval('.m2-cdsv select', function (x) { return x.value; })) === '' && (await page.$eval('.m2-cdsv input', function (x) { return x.value; })) === 'active');
  await page.selectOption('.m2-cdsv select', 'open'); await page.waitForTimeout(900);
  ok('Open chosen: written at once', /structuralState="open"/.test(speciesText(await now(), sid)));
  await page.selectOption('.m2-cdsv select', ''); await page.waitForTimeout(300);
  ok('Text chosen: the field shows open', (await page.$eval('.m2-cdsv input', function (x) { return x.value; })) === 'open');
  await page.mouse.click(5, 450); await page.waitForTimeout(600);
  ok('left with nothing typed: the structural state kept', /structuralState="open"/.test(speciesText(await now(), sid)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  ok('undo gives active back', (await now()) === t);
  var a1 = await ids(); await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(1150, 520); await page.waitForTimeout(900);
  var p2 = (await ids()).filter(function (i) { return a1.indexOf(i) < 0; })[0];
  await page.keyboard.press('Escape');
  var R2 = await rect(p2), C2 = [R2[0] + R2[2] / 2, R2[1] + R2[3] / 2];
  await menu(C2); await pick('Make multimer');
  await menu(C2); await pick('Add structural state'); await page.keyboard.type('x'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  sa = /<celldesigner:structuralState angle="([^"]*)"/.exec(aliasText(await now(), p2));
  ok('on a multimer: at the bottom middle (its count takes the top)', sa && Math.abs(+sa[1] - 3 * Math.PI / 2) < 0.01, sa && sa[1]);
  for (var u = 0; u < 3; u++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(700); }
  ok('undone back to the first protein\'s state', (await now()) === t);
  items = await menu(C);
  ok('no second unit of information offered', items.indexOf('Add unit of information') < 0, items.join('|'));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // the unit of information as CellDesigner's Edit Information window: its prefixes with their labels, N, free input
  var U = [R[0] + R[2] / 2, R[1] + 1], unit = function (t) { var m = /<celldesigner:info state="open" prefix="([^"]*)" label="([^"]*)"/.exec(aliasText(t, p)); return m ? m[1] + '|' + m[2] : ''; };
  items = await menu(U);
  ok('the unit\'s own menu: Edit, Change unit and Delete', items[0] === 'Edit' && items.some(function (x) { return /^Change unit/.test(x); }) && items.indexOf('Delete') >= 0 && items.indexOf('Change identity') < 0, items.join('|'));
  await page.click('.m2-cx button:has-text("Change unit")'); await page.waitForTimeout(400);
  var kinds = await page.$$eval('.m2-ci button', function (l) { return l.map(function (x) { return x.textContent; }); });
  ok('Change unit lists CellDesigner\'s 14 prefixed labels', kinds.length === 14 && kinds[0] === 'pc:T' && kinds.indexOf('mt:psac') >= 0 && kinds[13] === 'ct:mRNA', kinds.join('|'));
  await page.click('.m2-ci button:text-is("ct:mRNA")'); await page.waitForTimeout(800);
  ok('ct:mRNA picked: prefix ct, label mRNA', unit(await now()) === 'ct|mRNA', unit(await now()));
  await page.keyboard.press('Escape');
  await page.mouse.dblclick(U[0], U[1]); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('a double click opens its window: ct, mRNA', (await page.$eval('.m2-cdsv select', function (x) { return x.value; })) === 'ct' && (await page.$eval('.m2-cdsv-list select', function (x) { return x.value; })) === 'mRNA');
  var opts = await page.$eval('.m2-cdsv select', function (x) { return Array.prototype.map.call(x.options, function (o) { return o.value; }).join('|'); });
  ok('Prefix offers pc, mt, ct, N, free input', opts === 'pc|mt|ct|N|free input', opts);
  var tb = await now(); await page.selectOption('.m2-cdsv select', 'N'); await page.waitForTimeout(300); await page.selectOption('.m2-cdsv select', 'ct'); await page.waitForTimeout(600);
  ok('to N and back to ct with nothing typed: mRNA kept, nothing written', (await now()) === tb && (await page.$eval('.m2-cdsv-list select', function (x) { return x.value; })) === 'mRNA');
  await page.selectOption('.m2-cdsv select', 'mt'); await page.waitForTimeout(800);
  var mts = await page.$eval('.m2-cdsv-list select', function (x) { return Array.prototype.map.call(x.options, function (o) { return o.value; }).join('|'); });
  ok('mt chosen: its labels listed, its first written at once', mts === 'ion|rad|rna|dna|prot|psac' && unit(await now()) === 'mt|ion', mts + ' ' + unit(await now()));
  await page.selectOption('.m2-cdsv-list select', 'prot'); await page.waitForTimeout(800);
  ok('prot chosen: mt:prot', unit(await now()) === 'mt|prot', unit(await now()));
  await page.selectOption('.m2-cdsv select', 'free input'); await page.waitForTimeout(300);
  await page.fill('.m2-cdsv input', 'pc:X'); await page.press('.m2-cdsv input', 'Enter'); await page.waitForTimeout(900);
  ok('free input takes any text, pc:X too', unit(await now()) === 'free input|pc:X', unit(await now()));
  await page.mouse.dblclick(U[0], U[1]); await page.waitForSelector('.m2-cdsv', { timeout: 3000 });
  ok('reopened: free input, its text', (await page.$eval('.m2-cdsv select', function (x) { return x.value; })) === 'free input' && (await page.$eval('.m2-cdsv input', function (x) { return x.value; })) === 'pc:X');
  await page.selectOption('.m2-cdsv select', 'N'); await page.waitForTimeout(300);
  await page.fill('.m2-cdsv input', '2'); await page.press('.m2-cdsv input', 'Enter'); await page.waitForTimeout(900);
  ok('N:2 again', unit(await now()) === 'N|2', unit(await now()));
  await page.keyboard.press('Escape'); await page.mouse.click(R[0] - 60, R[1] - 60); await page.waitForTimeout(300);
  var t1 = await now();
  await page.mouse.click(T[0], T[1]); await page.waitForTimeout(300); await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  t = await now();
  ok('the residue selected and deleted by the Delete key (the empty one stays), the structural state kept', !/name="Y701"/.test(protein(t, sid)) && (protein(t, sid).match(/<celldesigner:modificationResidue /g) || []).length === 1 && /structuralState="active"/.test(speciesText(t, sid)));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  ok('undo gives it back', (await now()) === t1);
  ok('no script error', !errs.length, errs.join(' / '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all right');
  process.exit(bad ? 1 : 0);
})();
