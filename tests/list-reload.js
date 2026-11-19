// The map list kept where it was over a reload of the tab (view mode): the list scrolled so the shown map sits near the
// top, the page reloaded, the list's scroll the same and the shown map at the same height. Runs on the live page by default.
//   node tests/list-reload.js [address] [--local]
// --local: the viewer of the working tree routed into the live page (the styles copy's changes since REV, default HEAD;
// run styles/update.sh first)
var { chromium } = require('playwright'), path = require('path'), cp = require('child_process');
var url = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; })[0] || 'https://viewer-source.github.io/styles/#glycogen-muscle-graphml';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '../styles/_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString(), out = [];
  d.split(/\n(?=@@ )/).slice(1).forEach(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    out.push([o.join('\n'), n.join('\n')]);
  });
  return out;
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 800 } }), bad = 0, errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) {
    var hunks = viewerHunks();
    await page.route(function (u) { return u.href.split('#')[0] === url.split('#')[0]; }, async function (r) {
      var res = await r.fetch(), t = await res.text(), miss = 0;
      hunks.forEach(function (h) { if (t.indexOf(h[0]) < 0) miss++; else t = t.replace(h[0], function () { return h[1]; }); });
      if (miss) console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')');
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  var where = function () {
    return page.evaluate(function () {
      var box = document.getElementById('m2-list'), on = box.querySelector('.m2-on');
      return { top: box.scrollTop, y: on ? Math.round(on.getBoundingClientRect().top - box.getBoundingClientRect().top) : null, name: on && on.textContent.trim() };
    });
  };
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#m2-list .m2-on', { timeout: 30000 }); await page.waitForTimeout(1500);
  // the shown map near the list's top
  await page.evaluate(function () { var box = document.getElementById('m2-list'), on = box.querySelector('.m2-on'); box.scrollTop += on.getBoundingClientRect().top - box.getBoundingClientRect().top - 40; });
  await page.waitForTimeout(300);
  var a = await where();
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#m2-list .m2-on', { timeout: 30000 }); await page.waitForTimeout(2500);
  var c = await where();
  ok('the list kept over a reload', Math.abs(a.top - c.top) <= 2 && Math.abs(a.y - c.y) <= 2, JSON.stringify(a) + ' -> ' + JSON.stringify(c));
  // a new visit (not a reload) still shows the map in view as before
  await page.goto('about:blank'); await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#m2-list .m2-on', { timeout: 30000 }); await page.waitForTimeout(1500);
  var d = await where(), h = await page.evaluate(function () { return document.getElementById('m2-list').clientHeight; });
  ok('a new visit: the shown map in sight', d.y >= 0 && d.y < h, JSON.stringify(d));
  // after the reload, arrow keys move on as before (the list follows the map again)
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#m2-list .m2-on', { timeout: 30000 }); await page.waitForTimeout(1500);
  for (var k = 0; k < 12; k++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120); }
  var e = await where();
  ok('arrow keys after a reload: the map stays in sight', e.y >= 0 && e.y < h, JSON.stringify(e));
  ok('no page errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? 'FAIL' : 'all ok'); process.exit(bad ? 1 : 0);
})();
