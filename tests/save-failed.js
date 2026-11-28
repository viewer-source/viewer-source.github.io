// A save that fails, then leaving the editor and going back: the moves are not lost. GitHub is played by this script
// (page.route on api.github.com, files from a clone of the site's data repository): the first save is refused
// with 500, the next ones go through. On the root page, Glycolysis (GraphML) moved by the arrow keys:
// the save refused and said; leaving the editor keeps the warning; going back starts from the moved file and saves it.
// Then the same with GitHub changed meanwhile: the moves are not taken up and that is said.
//   node tests/save-failed.js <base address> <clone of the site's data repository>
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/';
var data = process.argv[3];   // a clone of the site's data repository
if (!data) { console.log('usage: node tests/save-failed.js <base address> <clone of the data repository>'); process.exit(2); }
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var sha = {}, puts = [], failNext = 1, body = {};
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (rest === '') return json(200, { permissions: { push: true } });
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && r.method() === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      puts.push(p);
      if (failNext > 0) { failNext--; return json(500, { message: 'test: refused' }); }
      if (sha[p] && d.sha !== sha[p]) return json(409, { message: 'test: sha does not match' });   // as GitHub: a save on an older version refused
      body[p] = Buffer.from(d.content, 'base64').toString('utf8'); sha[p] = 'saved' + puts.length;
      return json(200, { content: { sha: sha[p] } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]), f = path.join(data, p2);
      var text = body[p2] != null ? body[p2] : fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
      if (text == null) return json(404, { message: 'Not Found' });
      if (!sha[p2]) sha[p2] = 'start';
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text });
      return json(200, { sha: sha[p2], content: Buffer.from(text).toString('base64') });
    }
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    return json(404, { message: 'Not Found' });
  });
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  var now = function () { return page.evaluate(function () { var n = window.m2EditNow(); return n ? n.text : null; }); };
  var edit = async function () {
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var leave = async function () { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800); };
  var moveOne = async function () {
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.left > 300 && r.top > 100 && r.right < 1380 && r.bottom < 880) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(300);
    for (var i = 0; i < 3; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(120); }
    await page.waitForTimeout(400);
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await edit();
  var t0 = await now();
  await moveOne();
  var moved = await now();
  ok('a node moved', moved && moved !== t0);
  await page.waitForTimeout(5000);
  ok('the save refused and said', puts.length === 1 && /Not saved/.test(await status()), puts.length + ' | ' + (await status()));
  await leave();
  ok('leaving the editor keeps a warning', /not saved on GitHub/.test(await status()), await status());
  await edit();
  ok('going back starts from the moved file', (await now()) === moved);
  await page.waitForTimeout(5000);
  var p = puts[0];
  ok('and saves it', puts.length === 2 && body[p] != null, puts.length + ' | ' + (await status()));
  ok('the file saved has the moves', body[p] === moved);

  // GitHub changed meanwhile
  failNext = 1;
  await moveOne();
  var moved2 = await now();
  await page.waitForTimeout(5000);
  await leave();
  ok('a second refused save, warning kept', /not saved on GitHub/.test(await status()), await status());
  var other = moved.replace(/<\/graphml>\s*$/, '<!-- another tab -->\n</graphml>\n');
  sha[p] = 'someone-else'; body[p] = other;   // another tab saved meanwhile
  await edit(); await page.waitForTimeout(6000);
  ok('GitHub changed meanwhile: its file not overwritten', body[p] === other && moved2 !== other);
  ok('and that is said', /could not be taken up|changed on GitHub/.test(await status()), await status());
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
