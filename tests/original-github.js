// Colours' Original across computers (create.js origPut, origGh): with a token, the map's own colours kept when another
// choice is made go to GitHub too (maps/colours/<id>.json, no site build started); a second browser with nothing kept
// (another computer), opening the map as saved, gets them back with Original. GitHub is played by this script (a
// repository in memory, shared by the two browsers). On the styles page, the triacylglycerol map (CellDesigner).
//   node tests/original-github.js [base address] [viewer folder: its editor served in place of the page's] [clone of the data repository]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
var files = {}, builds = 0, errs = [], recPuts = 0;
var data = process.argv[4];   // the data repository's clone: the map as GitHub holds it
if (!data) { console.log('usage: node tests/original-github.js <base address> <viewer folder or ""> <clone of the data repository>'); process.exit(2); }
files['maps/tag-celldesigner.xml'] = fs.readFileSync(path.join(data, 'maps/tag-celldesigner.xml'), 'utf8');
files['maps/tag-celldesigner.md'] = fs.readFileSync(path.join(data, 'maps/tag-celldesigner.md'), 'utf8');
async function computer(b) {
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/(sbgn_edit|cd_make)\.js/, function (r) { var f = /(sbgn_edit|cd_make)\.js/.exec(r.request().url())[0]; r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', f), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) { builds++; return route.fulfill({ status: 204, body: '' }); }
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file' }; }));
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      if (/^maps\/colours\//.test(p)) recPuts++;
      if (files[p] != null && d.sha !== gitSha(files[p])) return json(409, { message: 'test: sha does not match' });
      files[p] = Buffer.from(d.content, 'base64').toString('utf8');
      return json(200, { content: { sha: gitSha(files[p]) } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]);
      if (files[p2] == null) return json(404, { message: 'Not Found' });
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: files[p2] });
      return json(200, { sha: gitSha(files[p2]), content: Buffer.from(files[p2]).toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  });
  await page.goto(base + '#tag-celldesigner', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector(F, { state: 'visible', timeout: 30000 });
  await page.waitForFunction(function () { var n = window.m2EditNow && window.m2EditNow(); return n && n.svg; }, null, { timeout: 30000 }); await page.waitForTimeout(2000);
  return { ctx: ctx, page: page };
}
var F = '#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd';
var val = function (page) { return page.$eval(F, function (e) { return e.firstChild.textContent; }); };
var paint = function (page) { return page.evaluate(function () {
  var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml');
  return Array.from(d.querySelectorAll('[fill]')).map(function (e) { return e.getAttribute('fill'); }).join(' ').toLowerCase();
}); };
var pick = async function (page, name) { await page.click(F); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(3000); };
(async function () {
  var b = await chromium.launch();
  var A = await computer(b), p0 = await paint(A.page);
  ok('First computer: opens on Original', (await val(A.page)) === 'Original', await val(A.page));
  var b0 = builds;
  await pick(A.page, 'Confetti'); await A.page.waitForTimeout(6000);   // the map's save (a few seconds after the change) and the record's
  var rec = files['maps/colours/tag-celldesigner.json'];
  ok('The map’s own colours kept on GitHub', !!rec && /"fill"/.test(rec) && /"at"/.test(rec), rec ? rec.slice(0, 80) : 'none');
  ok('The map saved on GitHub in Confetti', !!files['maps/tag-celldesigner.xml']);
  await A.ctx.close();
  var B = await computer(b);   // another computer: nothing kept in its browser
  ok('Second computer: the map as saved, Confetti', (await val(B.page)) === 'Confetti', await val(B.page));
  ok('Second computer: nothing kept in its browser', await B.page.evaluate(function () { return !localStorage.getItem('atlas-edit-originals'); }));
  await pick(B.page, 'Original');
  ok('Second computer: Original puts back the first computer’s own colours', (await paint(B.page)) === p0);
  ok('Second computer: Original shown', (await val(B.page)) === 'Original', await val(B.page));
  var n0 = recPuts;
  await pick(B.page, 'Mist and sage'); await B.page.waitForTimeout(2000);
  ok('Second computer: the same colours not written to GitHub again', recPuts === n0, (recPuts - n0) + ' writes');
  await B.page.evaluate(function () { localStorage.removeItem('atlas-edit-originals'); });   // as if this browser had lost its record
  await pick(B.page, 'Original');
  ok('Second computer: Original from GitHub alone, the drawing as it was', (await paint(B.page)) === p0);
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
