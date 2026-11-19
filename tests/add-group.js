// Add group: the group made at once at the top of the reader's groups, its name typed in place as a rename.
//   1. Add group: a field in place of a heading New group, first among the reader's groups, its text selected.
//   2. A name typed and Enter: the group named so, still first. 3. Add group then Esc: no group left behind.
//   node tests/add-group.js [base address] [--local]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
function editorNow() {
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) { var ed = editorNow(); await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); }); }
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  var add = async function () { await page.click('#m2-list .m2-map >> nth=3', { button: 'right' }); await page.waitForTimeout(300); await page.click('.m2-cx button:text-is("Add group")'); await page.waitForTimeout(500); };
  var groups = function () { return page.$$eval('#m2-list .m2-group, #m2-list input.m2-group-edit', function (l) { return l.map(function (x) { return x.tagName === 'INPUT' ? '[' + x.value + ']' : x.textContent; }); }); };
  await add();
  var g1 = await groups(), sel = await page.evaluate(function () { var f = document.activeElement; return f && f.classList.contains('m2-group-edit') && f.selectionStart === 0 && f.selectionEnd === f.value.length; });
  ok('1. a field New group at the top of the groups, its text selected', g1[0] === '[New group]' && sel, g1.slice(0, 3).join(' | '));
  await page.keyboard.type('My set'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  var g2 = await groups();
  ok('2. named in place, still first', g2[0] === 'My set' && g2.indexOf('New group') < 0, g2.slice(0, 3).join(' | '));
  await add(); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  var g3 = await groups();
  ok('3. Esc: no group left behind', g3.join() === g2.join(), g3.slice(0, 3).join(' | '));
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
