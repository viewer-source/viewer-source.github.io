// Compartments and complexes on a CellDesigner map (editor/src/cdcreate.js, cd_make.js): a compartment's sign dragged from
// the palette drawn as the map draws it (its colour, 12 between its lines), placed 160 by 160; Properties for a complex
// (Width, Height, Fill, Border width, Font size, written whole; no Multimer) and for a compartment (Width, Height, Fill, Membrane, Outer line, Inner
// line: its double line, a number under CellDesigner's limits set to the nearest allowed, silently), its name dragged to one of nine places, each value written into the
// file and undone; a modifier's Line colour and a reaction's (no ports' rows), written and drawn, the reaction's added
// reactants and products keeping their own. Nothing is saved (no token). No script error.
//   node tests/cd-props.js [address] [viewer folder: its editor and renderers served in place of the page's]
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
  var aliasOf = function (t, id) { var m = new RegExp('<celldesigner:(?:complexSpeciesAlias|compartmentAlias) id="' + id + '"[\\s\\S]*?</celldesigner:(?:complexSpeciesAlias|compartmentAlias)>').exec(t); return m ? m[0] : ''; };
  var rows = function () { return page.$$eval('.m2-ed-pnode tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var select = async function (id) {   // a click inside the node, near its top left corner, on nothing else
    await page.keyboard.press('Escape');
    var P = await page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + 4, r.top + 4]; });
    await page.mouse.click(P[0], P[1]); await page.waitForTimeout(500);
  };
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:COMPARTMENT"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:COMPARTMENT"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);

  // the compartment's sign dragged: its ghost as the map draws a compartment
  var sg = await page.$eval('#m2-editwin button[data-make="cd:COMPARTMENT"]', function (x) { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  var before = await ids();
  await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(1150, 600, { steps: 8 });
  var ghost = await page.evaluate(function () { var s = Array.prototype.slice.call(document.querySelectorAll('svg')).filter(function (x) { return /fill-opacity="0.25"/.test(x.innerHTML) && !x.closest('#m2-img'); })[0]; return s ? s.innerHTML : ''; });
  // a new compartment's colour follows Colours (its Default paint #dfdbce; CellDesigner's yellow #cccc00 under CellDesigner)
  var COL = /#(dfdbce|cccc00)/i;
  ok('the dragged compartment drawn in its colour with its band', COL.test(ghost) && /fill-rule="evenodd"/.test(ghost), ghost.slice(0, 300));
  ok('12 between its two lines, as on the map', /<rect x="12" y="12" width="136" height="136" rx="8"/.test(ghost), ghost.slice(0, 600));
  await page.mouse.up(); await page.waitForTimeout(1200);
  var comp = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0], t = await now(), A = aliasOf(t, comp);
  ok('a compartment dropped, 160 by 160', /^ca/.test(comp || '') && /w="160\.0" h="160\.0"/.test(A), A.slice(0, 300));
  var drawn = await page.$eval('#m2-img [data-n="' + comp + '"]', function (g) { return g.innerHTML; });
  ok('drawn on the map as its ghost was', (COL.exec(drawn) || [])[1] === (COL.exec(ghost) || [])[1] && /rx="8"/.test(drawn));

  // Properties of the compartment
  await select(comp);
  var rc = await rows();
  ok('a compartment: Label, Width, Height, Fill colour, Membrane, Outer line, Inner line', JSON.stringify(rc) === JSON.stringify(['label', 'w', 'h', 'fill', 'mem', 'outer', 'inner']), JSON.stringify(rc));
  var fv = function (k) { return page.$eval('#m2-ed-' + k, function (f) { return f.value; }); };
  var dl = function (t) { var m = /<celldesigner:doubleLine [^>]*>/.exec(aliasOf(t, comp)); return m ? m[0] : ''; };
  ok('its double line shown: 12, 2, 1', (await fv('mem')) === '12' && (await fv('outer')) === '2' && (await fv('inner')) === '1');
  // its name dragged by itself to the bottom right: it lands at that place (the membrane + 5 from the right, + 0.5 from
  // the bottom line), one undo step; a press with no move selects the compartment
  var npt = function (t) { var m = /namePoint x="([^"]*)" y="([^"]*)"/.exec(aliasOf(t, comp)); return m ? [parseFloat(m[1]), parseFloat(m[2])] : null; };
  var bnd = function (t) { var m = /bounds x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(aliasOf(t, comp)); return m.slice(1).map(parseFloat); };
  var nameAt = function () { return page.$eval('#m2-img [data-n="' + comp + '"] text', function (x) { var r = x.getBoundingClientRect(), o = x.closest('[data-n]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, o.right, o.bottom, o.left, o.top]; }); };
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  var na = await nameAt(), t0n = npt(await now());
  await page.mouse.click(na[0], na[1]); await page.waitForTimeout(400);   // the compartment selected first: a drag on the name of one not selected moves the map
  await page.mouse.move(na[0], na[1]); await page.mouse.down(); await page.mouse.move(na[0] + 20, na[1] + 30, { steps: 4 }); await page.mouse.move(na[2] - 30, na[3] - 15, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
  var tb = await now(), bb = bnd(tb), pb = npt(tb);
  ok('the name dragged to the bottom right lands there', !!pb && Math.abs(bb[1] + bb[3] - 12.5 - 23 - pb[1]) < 0.06 && pb[0] > bb[0] + bb[2] / 2, JSON.stringify([bb, pb]));
  var nb = await nameAt();
  ok('drawn at the bottom right, inside', nb[2] - nb[0] > 0 && nb[2] - nb[0] < 60 && nb[3] - nb[1] > 0 && nb[3] - nb[1] < 40, JSON.stringify(nb));
  await type('mem', '30'); var p30 = npt(await now()), b30 = bnd(await now());
  ok('the name follows a membrane of 30', Math.abs(b30[1] + b30[3] - 30.5 - 23 - p30[1]) < 0.06, JSON.stringify([b30, p30]));
  for (var u0 = 0; u0 < 2; u0++) { await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); }
  ok('undone: the name at the top again', JSON.stringify(npt(await now())) === JSON.stringify(t0n) && /thickness="12\.0"/.test(dl(await now())), JSON.stringify([npt(await now()), t0n]));
  await page.keyboard.press('Escape'); na = await nameAt();
  await page.mouse.click(na[0], na[1]); await page.waitForTimeout(500);
  ok('a click on the name selects the compartment', JSON.stringify(await rows()) === JSON.stringify(['label', 'w', 'h', 'fill', 'mem', 'outer', 'inner']) && JSON.stringify(npt(await now())) === JSON.stringify(t0n));
  await select(comp);
  await type('mem', '24');
  ok('Membrane 24 written', /thickness="24\.0" outerWidth="2\.0" innerWidth="1\.0"/.test(dl(await now())), dl(await now()));
  ok('drawn 24 between its lines', /<rect x="[\d.]+" y="[\d.]+" width="112" height="112"/.test(await page.$eval('#m2-img [data-n="' + comp + '"]', function (g) { return g.innerHTML; })));
  await select(comp); await type('mem', '0.1');
  ok('Membrane 0.1 set to 2', /thickness="2\.0"/.test(dl(await now())) && (await fv('mem')) === '2', dl(await now()));
  await select(comp); await type('outer', '0.5');
  ok('Outer line 0.5 with inner 1 kept at 2', /outerWidth="2\.0"/.test(dl(await now())) && (await fv('outer')) === '2', dl(await now()));
  await select(comp); await type('inner', '3');
  ok('Inner line 3 with outer 2 kept at 1', /innerWidth="1\.0"/.test(dl(await now())) && (await fv('inner')) === '1', dl(await now()));
  await select(comp); await type('mem', '200');
  ok('Membrane 200 on a 160 box set to 77, room left inside', /thickness="77\.0"/.test(dl(await now())), dl(await now()));
  await select(comp); await type('mem', '2');
  await select(comp); await type('outer', '5'); await select(comp); await type('inner', '3');
  ok('Outer line 5, Inner line 3 written', /outerWidth="5\.0" innerWidth="3\.0"/.test(dl(await now())), dl(await now()));
  for (var u = 0; u < 6; u++) { await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); }
  await select(comp); await type('w', '0');
  ok('Width 0 on a compartment set to 30, silently', /w="30\.0" h="160\.0"/.test(aliasOf(await now(), comp)), aliasOf(await now(), comp).slice(0, 300));
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  ok('undone: 12, 2, 1 again', /thickness="12\.0" outerWidth="2\.0" innerWidth="1\.0"/.test(dl(await now())), dl(await now()));
  await select(comp);
  var paint0 = (/<celldesigner:paint color="ff([0-9a-f]{6})"/i.exec(aliasOf(await now(), comp)) || [])[1];
  ok('its fill shown', (await page.$eval('#m2-ed-fill', function (f) { return f.value; })) === '#' + paint0);
  var mid = function () { return page.$eval('#m2-img [data-n="' + comp + '"]', function (g) {   // its name's centre and its own, on screen
    var tx = g.querySelector('text'), r = g.getBoundingClientRect(), q = tx.getBoundingClientRect(); return [q.left + q.width / 2, r.left + r.width / 2, q.top - r.top]; }); };
  var lab = await page.$eval('#m2-ed-label', function (f) { return f.value; }), m0 = await mid();
  ok('its name shown in Label, as drawn', /^c\d+$/.test(lab), lab);
  ok('its name at the top middle', Math.abs(m0[0] - m0[1]) < 2 && m0[2] < 20, JSON.stringify(m0));
  await type('label', 'Endoplasmic reticulum'); var m1 = await mid();
  ok('renamed: still at the top middle', Math.abs(m1[0] - m1[1]) < 2, JSON.stringify(m1));
  await select(comp); await type('w', '300'); var m2 = await mid();
  ok('resized: still at the top middle', Math.abs(m2[0] - m2[1]) < 2, JSON.stringify(m2));
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  await select(comp);
  await type('fill', '#3366cc');
  ok('its colour written', /<celldesigner:paint color="ff3366cc"/.test(aliasOf(await now(), comp)));
  ok('drawn in the new colour', /#3366cc/i.test(await page.$eval('#m2-img [data-n="' + comp + '"]', function (g) { return g.innerHTML; })));
  await select(comp); await type('w', '240');
  ok('its width written, its centre kept', /x="[\d.]+" y="[\d.]+" w="240\.0" h="160\.0"/.test(aliasOf(await now(), comp)), aliasOf(await now(), comp).slice(0, 300));
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  ok('undone: the first colour and size', /w="160\.0" h="160\.0"/.test(aliasOf(await now(), comp)) && new RegExp('color="ff' + paint0 + '"', 'i').test(aliasOf(await now(), comp)));

  // a complex dropped, then its Properties
  before = await ids();
  var cs = await page.$eval('#m2-editwin button[data-make="cd:COMPLEX"]', function (x) { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(cs[0], cs[1]); await page.mouse.down(); await page.mouse.move(700, 400, { steps: 6 }); await page.mouse.move(1250, 250, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1200);
  var cx = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  ok('a complex dropped', /^csa/.test(cx || ''));
  await select(cx);
  var rx = await rows();
  ok('a complex: Label, Font size, Width, Height, Fill colour, Border width', JSON.stringify(rx) === JSON.stringify(['label', 'font', 'w', 'h', 'fill', 'width']), JSON.stringify(rx));
  await type('font', '17.6');
  ok('its font size written, a whole number', /<celldesigner:font size="18"\/>/.test(aliasOf(await now(), cx)), aliasOf(await now(), cx).slice(0, 400));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  ok('its font size undone', /<celldesigner:font size="12"\/>/.test(aliasOf(await now(), cx)), aliasOf(await now(), cx).slice(0, 400));
  await select(cx); await type('fill', '#ffffff');
  ok('its fill written white', /<celldesigner:paint color="ffffffff"/.test(aliasOf(await now(), cx)));
  await select(cx); await type('h', '200');
  ok('its height written', /h="200\.0"/.test(aliasOf(await now(), cx)), aliasOf(await now(), cx).slice(0, 300));
  await select(cx); await type('width', '3');
  ok('its border width written', /<celldesigner:singleLine width="3\.0"/.test(aliasOf(await now(), cx)));
  await select(cx); await type('width', '0');
  ok('Border width 0 set to 0.25, silently', /<celldesigner:singleLine width="0\.25"/.test(aliasOf(await now(), cx)), aliasOf(await now(), cx).slice(0, 400));
  await select(cx); await type('width', '3');

  // a member put in the complex, then the complex typed narrower than its member: it stops where the member still fits
  await page.keyboard.press('Escape'); await page.click('#m2-editwin button[data-make="cd:PROTEIN"]');
  var cc = await page.$eval('#m2-img [data-n="' + cx + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(cc[0], cc[1]); await page.waitForTimeout(1500); await page.keyboard.press('Escape');
  await select(cx); await type('w', '10');
  var bw = function (t, id) { var m = new RegExp('<celldesigner:(?:complexSpeciesAlias|speciesAlias) id="' + id + '"[\\s\\S]*?<celldesigner:bounds [^>]*w="([\\d.]+)"').exec(t); return m ? +m[1] : null; };
  var tx2 = await now(), mem = new RegExp('<celldesigner:speciesAlias id="([^"]+)"[^>]*complexSpeciesAlias="' + cx + '"').exec(tx2);
  var cn = await page.evaluate(function (a) {   // the complex's name: centre to the box's, the box's bottom to its bottom, its top to the member's bottom
    var g = document.querySelector('#m2-img [data-n="' + a[0] + '"]'), t = g.querySelector('text'), r = g.getBoundingClientRect(), q = t.getBoundingClientRect();
    var m = document.querySelector('#m2-img [data-n="' + a[1] + '"]').getBoundingClientRect();
    return [q.left + q.width / 2 - (r.left + r.width / 2), r.bottom - q.bottom, q.top - m.bottom]; }, [cx, mem ? mem[1] : '']);
  ok('a complex with a member: its name at the bottom middle, under the member', Math.abs(cn[0]) < 2 && cn[1] < 10 && cn[2] > -1, JSON.stringify(cn));
  ok('a complex typed narrower than its member stops round it', !!mem && bw(tx2, cx) >= bw(tx2, mem[1]), mem && bw(tx2, cx) + ' ' + bw(tx2, mem[1]));

  // a modifier's line and a reaction's main line: Line colour alone, written into its own line, drawn in it
  var lineAt = function (id) { return page.evaluate(function (id) {   // the middle of the line's longest drawn part, on screen
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var es = await page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); });
  var mod = es.filter(function (e) { return /\|m\d+$/.test(e); })[0], main = es.filter(function (e) { return /\|a$/.test(e); })[0];
  var erows = function () { return page.$$eval('.m2-ed-pedge tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var drawnIn = function (id) { return page.$$eval('#m2-img [data-e="' + id + '"] *', function (l) { return l.map(function (x) { return (x.getAttribute('stroke') || '') + ' ' + (x.getAttribute('fill') || ''); }).join(' '); }); };
  for (var L of [mod, main]) {
    await page.keyboard.press('Escape'); await page.mouse.click(10, 880);
    await page.mouse.click.apply(page.mouse, await lineAt(L)); await page.waitForTimeout(500);
    var er = await erows();
    var rev = await page.$eval('.m2-ed-prx', function (x) { return !x.hidden; });
    ok(L + (L === mod ? ': Line colour alone' : ': Reversible and Line colour'), JSON.stringify(er) === JSON.stringify(['ecol']) && rev === (L !== mod), JSON.stringify(er) + ' ' + rev);
    var links = function (t) { var r = new RegExp('<reaction [^>]*id="' + L.split('|')[0] + '"[\\s\\S]*?</reaction>').exec(t)[0]; return (r.match(/<celldesigner:(reactantLink|productLink) [\s\S]*?<\/celldesigner:\1>/g) || []).join(''); }, links0 = links(await now());
    await type('ecol', '#ff0000');
    var tx = await now(), rid = L.split('|')[0], rx = new RegExp('<reaction [^>]*id="' + rid + '"[\\s\\S]*?</reaction>').exec(tx)[0];
    var mseg = /<celldesigner:modification [\s\S]*?<\/celldesigner:modification>/.exec(rx), lmain = rx.replace(/<celldesigner:listOfModification>[\s\S]*?<\/celldesigner:listOfModification>/, '');
    ok(L + ': its own line written red', L === mod ? /color="ffff0000"/.test(mseg ? mseg[0] : '') && !/color="ffff0000"/.test(lmain) : /<celldesigner:line [^>]*color="ffff0000"/.test(lmain) && links(tx) === links0, rx.slice(0, 1500));   // its added reactants and products keep their own
    ok(L + ': drawn red', /#ff0000/i.test(await drawnIn(L)));
    ok(L + ': still selected', (await erows()).length === 1);
    if (L === main) ok(L + ': the whole reaction red, its other half too', /#ff0000/i.test(await drawnIn(rid + '|b')));
  }

  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
