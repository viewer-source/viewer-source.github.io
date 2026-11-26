// Panel widths: at the panel's usual 240 px every visible control lies inside the panel's visible area; with the panel
// dragged wider, nothing in the Edit and Settings windows may stretch or move, and Settings' blocks span the same width as the Edit window's (the icon row's). Opens each window at the panel's usual width and at a wide one, with a macromolecule selected so
// Properties shows, and compares every visible control's place and size. Runs on a page with the editor, by default
// the styles page on an SBGN-ML map; [css] adds a style sheet first (to try a change before it is pushed).
//   node tests/panel-width.js [address] [css]
var { chromium } = require('playwright'), fs = require('fs');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', css = process.argv[3];
var WIDE = 520, NODE = 'ADCY';
async function shot(browser, wide, win) {
  var page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  if (wide) await page.addInitScript(function (w) { localStorage.setItem('atlas-list-width:' + location.pathname, String(w)); }, WIDE);
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#m2-img', { state: 'attached', timeout: 30000 });
  if (css) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
  await page.click('.m2-ri[data-win="' + win + '"]');
  if (win === 'edit') {
    await page.waitForSelector('#m2-editwin .m2-ed-palette button', { timeout: 20000 });
    var box = await page.getByText(NODE, { exact: true }).first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('#m2-editwin .m2-ed-props:not([hidden])', { timeout: 5000 });
  }
  await page.waitForTimeout(300);
  var got = await page.evaluate(function (id) {
    var w = document.getElementById(id), o = w.getBoundingClientRect(), out = {}, n = {};
    w.querySelectorAll('input, select, button, textarea, table').forEach(function (e) {
      if (!e.offsetParent) return;
      var k = e.id || e.getAttribute('aria-label') || e.tagName, r = e.getBoundingClientRect();
      n[k] = (n[k] || 0) + 1; k += '#' + n[k];
      out[k] = [r.left - o.left, r.top - o.top, r.width, r.height].map(Math.round).join(',');
    });
    var clip = w; while (clip && clip.parentElement && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;   // what cuts the window off: the panel
    var edge = Math.min(clip.getBoundingClientRect().right, innerWidth);
    out._out = [];   // controls reaching past the panel's visible edge at the usual width
    w.querySelectorAll('input, select, button, textarea').forEach(function (e) {
      if (e.offsetParent && e.getBoundingClientRect().right > edge + 0.5) out._out.push((e.id || e.getAttribute('aria-label') || e.textContent.trim() || e.tagName) + ' ends ' + Math.round(e.getBoundingClientRect().right - edge) + ' px past it');
    });
    var l = 1e9, rt = -1e9;   // the span of the window's visible blocks, from its left edge
    Array.prototype.forEach.call(w.children, function (e) {
      if (!e.offsetParent) return; var r = e.getBoundingClientRect(); l = Math.min(l, r.left - o.left); rt = Math.max(rt, r.right - o.left);
    });
    out._span = Math.round(l) + '..' + Math.round(rt);
    return out;
  }, 'm2-' + win + 'win');
  await page.close();
  return got;
}
(async function () {
  var browser = await chromium.launch(), bad = 0, seen = 0, span = {};
  for (var win of ['edit', 'set']) {
    var a = await shot(browser, false, win), b = await shot(browser, true, win);
    span[win] = a._span;
    a._out.forEach(function (m) { bad++; console.log(win + ' at 240 px: ' + m); }); delete a._out; delete b._out;
    for (var k in a) { seen++; if (a[k] !== b[k]) { bad++; console.log(win + ' ' + k + ': ' + a[k] + ' at 240 px, ' + (b[k] || 'gone') + ' at ' + WIDE + ' px'); } }
  }
  if (span.set !== span.edit) { bad++; console.log('Settings spans ' + span.set + ', the Edit window ' + span.edit + ' (screen px from the window\'s edge)'); }
  console.log(seen + ' controls compared, ' + bad + ' moved or stretched with the panel wider');
  await browser.close();
  process.exit(bad || !seen ? 1 : 0);
})();
