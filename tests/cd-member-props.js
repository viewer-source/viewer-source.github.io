// Properties for a CellDesigner complex's member (create.js propNode, cdcreate.js's format part, cd_make): on the styles
// page, f001-glycolysis, the protein sa2 inside the complex csa1 selected by a click: Properties shows Label, Width,
// Height, Fill colour, Border width and Multimer with the alias' own values; a name typed in Label is written as its
// species' name and drawn; Fill colour, Width, Border width and Multimer each written into the alias (paint, bounds,
// singleLine) or its species (homodimer), one undo step each; undo puts the file back as it was. The member complex
// sa_n5_n0 inside sa_n5 on Glycolysis CellDesigner shows a complex's rows (no Multimer). Nothing is saved (no token).
// No script error.
//   node tests/cd-member-props.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var rows = function () { return page.$$eval('.m2-ed-pnode tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var fv = function (k) { return page.$eval('#m2-ed-' + k, function (f) { return f.type === 'checkbox' ? f.checked : f.value; }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var alias = function (t, id) { var m = new RegExp('<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="' + id + '"[\\s\\S]*?</celldesigner:(?:speciesAlias|complexSpeciesAlias)>').exec(t); return m ? m[0] : ''; };
  var info = function (id) { return page.evaluate(function (id) { var A = window.cd_make.aliasInfo(window.m2EditNow().text, id); return { name: A.name, id: A.id, cls: A.cls }; }, id); };
  var open = async function (hash) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var select = async function (id, dx, dy) {   // a click inside the node (dx, dy from its top left; its middle by default)
    await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(200);
    var P = await page.$eval('#m2-img [data-n="' + id + '"]', function (g, d) { var r = g.getBoundingClientRect(); return [r.left + (d[0] == null ? r.width / 2 : d[0]), r.top + (d[1] == null ? r.height / 2 : d[1])]; }, [dx, dy]);
    await page.mouse.click(P[0], P[1]); await page.waitForTimeout(600);
  };
  var undo = async function () { await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };

  await open('f001-glycolysis');
  var t0 = await now(), A0 = alias(t0, 'sa2');
  ok('sa2 is a member of csa1 in the file', /complexSpeciesAlias="csa1"/.test(A0), A0.slice(0, 200));
  await select('sa2');
  var r = await rows();
  ['label', 'w', 'h', 'fill', 'width', 'multimer'].forEach(function (k) { ok('member: Properties shows ' + k, r.indexOf(k) >= 0, JSON.stringify(r)); });
  var i0 = await info('sa2');
  ok('member: Label shows its name as drawn', (await fv('label')) === (i0.name || i0.id), JSON.stringify([await fv('label'), i0]));
  ok('member: Width and Height its bounds (80, 40)', +(await fv('w')) === 80 && +(await fv('h')) === 40, JSON.stringify([await fv('w'), await fv('h')]));
  ok('member: Fill colour its paint (#B8EABC)', /^#?b8eabc$/i.test(await fv('fill')), await fv('fill'));
  ok('member: Border width 1', +(await fv('width')) === 1, await fv('width'));
  ok('member: Multimer unticked', (await fv('multimer')) === false);

  // rename in Label
  await type('label', 'GLUT4');
  var t1 = await now(), i1 = await info('sa2');
  ok('renamed: written as its species\' name', i1.name === 'GLUT4', JSON.stringify(i1));
  ok('renamed: drawn', (await page.$eval('#m2-img [data-n="sa2"]', function (g) { return g.textContent; })).indexOf('GLUT4') >= 0);
  ok('renamed: still a member of csa1', /complexSpeciesAlias="csa1"/.test(alias(t1, 'sa2')));
  // fill
  await select('sa2'); await type('fill', '#ff8800');
  var t2 = await now();
  ok('fill: written into the alias\' paint', /<celldesigner:usualView>[\s\S]*?<celldesigner:paint color="ffff8800"/i.test(alias(t2, 'sa2')), (/<celldesigner:usualView>[\s\S]*?<celldesigner:paint [^>]*>/.exec(alias(t2, 'sa2')) || [''])[0]);
  ok('fill: drawn', /#ff8800|rgb\(255, ?136, ?0\)/i.test(await page.$eval('#m2-img [data-n="sa2"]', function (g) { return g.innerHTML; })));
  // width
  await select('sa2'); await type('w', '100');
  var t3 = await now();
  ok('width: bounds 100 wide', /<celldesigner:bounds [^>]*w="100(\.0)?"/.test(alias(t3, 'sa2')), (/<celldesigner:bounds [^>]*>/.exec(alias(t3, 'sa2')) || [''])[0]);
  var cb = function (t) { var m = /<celldesigner:bounds x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(alias(t, 'csa1')); return m ? m.slice(1).map(parseFloat) : null; };
  var sb = function (t) { var m = /<celldesigner:bounds x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(alias(t, 'sa2')); return m ? m.slice(1).map(parseFloat) : null; };
  var C3 = cb(t3), S3 = sb(t3);
  ok('width: the complex still round the member', !!C3 && !!S3 && C3[0] <= S3[0] && C3[0] + C3[2] >= S3[0] + S3[2], JSON.stringify([C3, S3]));
  // border width
  await select('sa2'); await type('width', '3');
  var t4 = await now();
  ok('border width: written 3', /<celldesigner:usualView>[\s\S]*?<celldesigner:singleLine width="3(\.0)?"/.test(alias(t4, 'sa2')), (/<celldesigner:usualView>[\s\S]*?<celldesigner:singleLine [^>]*>/.exec(alias(t4, 'sa2')) || [''])[0]);
  // multimer
  await select('sa2'); await page.click('#m2-ed-multimer'); await page.waitForTimeout(1500);
  var t5 = await now(), sp = /species="([^"]+)"/.exec(alias(t5, 'sa2'))[1];
  var spEl = function (t) { var m = new RegExp('<celldesigner:species id="' + sp + '"[\\s\\S]*?</celldesigner:species>|<species [^>]*id="' + sp + '"[\\s\\S]*?</species>').exec(t); return m ? m[0] : ''; };
  ok('multimer: written as a homodimer of its species', /<celldesigner:homodimer>2<\/celldesigner:homodimer>/.test(spEl(t5)) && !/homodimer>2/.test(spEl(t4)), spEl(t5).slice(0, 600));
  await select('sa2');
  ok('multimer: shown ticked', (await fv('multimer')) === true);
  // undo, one step each
  var steps = [t4, t3, t2, t1, t0], back = [];
  for (var s of steps) { await undo(); back.push((await now()) === s); }
  ok('five undos, each one change back, the file as it was', back.every(Boolean), JSON.stringify(back));

  // a member complex: a complex's rows
  await open('glycolysis-celldesigner');
  await select('sa_n5_n0', 4, 4);
  var rc = await rows();
  ok('member complex: a complex\'s rows, no Multimer', rc.indexOf('w') >= 0 && rc.indexOf('fill') >= 0 && rc.indexOf('multimer') < 0, JSON.stringify(rc));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
