// Download as MINERVA zip while one is being made (own.js packItem): the menu item greyed and saying so, in place of the
// pop-up it gave before; back to itself once the zip is downloaded. No token, a demo map.
//   node tests/minerva-busy.js [base address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await chromium.launch(), page = await (await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true })).newPage(), errs = [], said = [];
  if (local) { var ed = require('./editor-now.js')(local); await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); }); }
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { if (d.type() !== 'beforeunload') said.push(d.message()); d.dismiss().catch(function () {}); });
  await page.goto(base + '#colour-test', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="list"]', { timeout: 30000 }); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  var row = '#m2-list .m2-map[data-id="colour-test"]';
  await page.waitForSelector(row, { state: 'visible', timeout: 30000 });
  var menu = async function () { await page.click(row, { button: 'right' }); await page.waitForSelector('.m2-cx', { timeout: 5000 }); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return [x.textContent, x.disabled]; }); }); };
  var it0 = await menu();
  ok('1. the item there, open', it0.some(function (x) { return x[0] === 'Download as MINERVA zip' && !x[1]; }), JSON.stringify(it0));
  var dl = page.waitForEvent('download', { timeout: 120000 }).catch(function () { return null; });
  // the click and a second right-click in the same moment, before the zip (fast for one small map) is done
  var it1 = await page.evaluate(function (row) {
    var go = Array.prototype.filter.call(document.querySelectorAll('.m2-cx button'), function (x) { return x.textContent === 'Download as MINERVA zip'; })[0];
    go.click();
    var r = document.querySelector(row), bx = r.getBoundingClientRect();
    r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: bx.left + 10, clientY: bx.top + 5 }));
    return Array.prototype.map.call(document.querySelectorAll('.m2-cx button'), function (x) { return [x.textContent, x.disabled]; });
  }, row);
  ok('2. while the zip is made: greyed, saying so', it1.some(function (x) { return x[0] === 'Making the MINERVA zip...' && x[1]; }) && !it1.some(function (x) { return x[0] === 'Download as MINERVA zip'; }), JSON.stringify(it1));
  await page.keyboard.press('Escape');
  var d = await dl;
  ok('3. the zip downloaded', !!d);
  await page.waitForTimeout(300);
  var it2 = await menu();
  ok('4. after it: the item back', it2.some(function (x) { return x[0] === 'Download as MINERVA zip' && !x[1]; }), JSON.stringify(it2));
  await page.keyboard.press('Escape');
  ok('no pop-up, no script errors', !said.length && !errs.length, said.concat(errs).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log('WRONG ' + e.message); process.exit(1); });
