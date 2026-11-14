// The Edit window's sign buttons (tools, "?", palette) under the pointer: each one not on must show the one hover of
// the sign buttons (CLAUDE.md, Buttons): the light grey square, no frame, the sign unchanged. Runs on a page with the
// editor, by default the styles page on an SBGN-ML map (Editing on Full, so the palette shows).
//   node tests/hover.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
var WANT = { bg: 'rgb(241, 243, 244)', border: 'rgba(0, 0, 0, 0)', color: 'rgb(128, 134, 139)' };
(async function () {
  var browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { var b = document.querySelector('#m2-ed-undo'); return b && document.querySelectorAll('#m2-editwin .m2-ed-palette button').length > 0; }, null, { timeout: 20000 }).catch(function () {});
  var sel = '#m2-editwin .m2-ed-tools button, #m2-editwin .m2-ed-palette button', n = await page.locator(sel).count(), bad = 0, seen = 0;
  for (var i = 0; i < n; i++) {
    var b = page.locator(sel).nth(i);
    if (!(await b.isVisible()) || await b.isDisabled() || (await b.getAttribute('aria-pressed')) === 'true') continue;
    await b.hover(); await page.waitForTimeout(50);
    var got = await b.evaluate(function (e) { var c = getComputedStyle(e); return { name: e.getAttribute('aria-label'), bg: c.backgroundColor, border: c.borderTopWidth === '0px' ? 'rgba(0, 0, 0, 0)' : c.borderTopColor, color: c.color }; });
    seen++;
    if (got.bg !== WANT.bg || got.border !== WANT.border || got.color !== WANT.color) { bad++; console.log('different hover:', JSON.stringify(got)); }
  }
  await page.mouse.move(0, 0);
  console.log(seen + ' sign buttons under the pointer, ' + bad + ' different');
  await browser.close();
  process.exit(bad || !seen ? 1 : 0);
})();
