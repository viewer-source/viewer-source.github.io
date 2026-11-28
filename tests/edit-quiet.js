// The Edit window's own quiet style: greys only. Every visible control in it (buttons, fields, lists, tick boxes,
// links), at rest and under the pointer, is checked for a colour in its background, edge, text or tick; any channel
// spread above SPREAD counts as a colour. Left out: what shows the map's own colours (a colour field's swatch, a
// picture's preview) and the status line's warning. Runs on an SBGN-ML map and a CellDesigner map (a node selected so
// Properties shows, a picture put on so Remove shows). [css] adds a style sheet first (to try a change before it is
// pushed).
//   node tests/edit-quiet.js [base address] [css]
var { chromium } = require('playwright'), fs = require('fs');
var base = process.argv[2] && !/\.css$/.test(process.argv[2]) ? process.argv[2] : 'https://viewer-source.github.io/';
var css = process.argv.filter(function (a) { return /\.css$/.test(a); })[0];
var SPREAD = 30, CASES = [['glycolysis-sbgn', 'ADCY', false], ['pdh-celldesigner', 'PDK', true]];
var PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function look(id) {   // in the page: the colours of every visible control, keyed by a readable name
  var SKIP = 'input[type="color"], .m2-ed-ppic img, #m2-ed-status';
  var out = {}, n = {};
  document.getElementById(id).querySelectorAll('button, input, select, textarea, a, label, .m2-ed-pdd').forEach(function (e) {
    if (!e.offsetParent || e.matches(SKIP)) return;
    var cs = getComputedStyle(e), k = e.id || e.getAttribute('aria-label') || e.title || (e.textContent || '').trim().slice(0, 24) || e.tagName;
    n[k] = (n[k] || 0) + 1; if (n[k] > 1) k += '#' + n[k];
    var c = { background: cs.backgroundColor, edge: cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none' ? cs.borderTopColor : '', text: cs.color };
    if (e.type === 'checkbox' || e.type === 'radio' || e.type === 'range') c.tick = cs.accentColor === 'auto' ? 'auto' : cs.accentColor;
    out[k] = c;
  });
  return out;
}
function coloured(v) {   // 'rgb(65, 131, 196)' -> true; transparent and greys -> false; an unset tick ('auto') is the browser's blue
  if (v === 'auto') return true;
  var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(v || ''); if (!m || m[4] === '0') return false;
  var c = [+m[1], +m[2], +m[3]]; return Math.max.apply(null, c) - Math.min.apply(null, c) > SPREAD;
}
(async function () {
  var browser = await chromium.launch(), bad = 0, seen = 0;
  for (var cs of CASES) {
    var page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(base + '#' + cs[0], { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (css) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
    await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
    var box = await page.getByText(cs[1], { exact: true }).first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('#m2-editwin .m2-ed-props:not([hidden])', { timeout: 5000 });
    if (cs[2]) {
      var got = await Promise.all([page.waitForEvent('filechooser'), page.click('#m2-ed-pic')]);
      await got[0].setFiles({ name: 'cell.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(1500);
    }
    var rest = await page.evaluate(look, 'm2-editwin');
    for (var k in rest) for (var p in rest[k]) { seen++; if (coloured(rest[k][p])) { bad++; console.log(cs[0] + ': ' + k + ', ' + p + ' ' + rest[k][p] + ' at rest'); } }
    var btns = await page.$$('#m2-editwin button, #m2-editwin a');
    for (var b of btns) {
      if (!(await b.isVisible())) continue;
      var name = await b.evaluate(function (e) { return e.id || e.getAttribute('aria-label') || e.title || e.textContent.trim().slice(0, 24); });
      await b.hover().catch(function () {}); await page.waitForTimeout(60);
      var h = await b.evaluate(function (e) { var s = getComputedStyle(e); return [s.backgroundColor, s.borderTopWidth !== '0px' ? s.borderTopColor : '', s.color]; });
      seen++; if (h.some(coloured)) { bad++; console.log(cs[0] + ': ' + name + ' under the pointer: ' + h.join(' / ')); }
    }
    await page.close();
  }
  console.log(seen + ' colours checked in the Edit window, ' + bad + ' not grey');
  await browser.close();
  process.exit(bad || !seen ? 1 : 0);
})();
