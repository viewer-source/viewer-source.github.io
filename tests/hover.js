// The Edit window's sign buttons (tools, "?", palette signs, the notation PD or AF; AF's two views are round choices, not sign buttons) under the pointer: each one not on must show the one hover of
// the sign buttons: the light grey square, no frame, the sign unchanged. Runs on a page with the
// editor, by default the styles page on an SBGN-ML map (Editing on Full, so the palette shows); on a CellDesigner map its own palette.
//   node tests/hover.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
var WANT = { bg: 'rgb(241, 243, 244)', border: 'rgba(0, 0, 0, 0)', color: 'rgb(128, 134, 139)' };
(async function () {
  var browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });   // not networkidle: the page loads every map quietly after the first
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { var b = document.querySelector('#m2-ed-undo'); return b && document.querySelectorAll('#m2-editwin .m2-ed-psigns button').length > 0; }, null, { timeout: 30000 }).catch(function () {});
  var sel = '#m2-editwin .m2-ed-tools button, #m2-editwin .m2-ed-palette .m2-ed-psigns button, #m2-editwin .m2-ed-pnot button', n = await page.locator(sel).count(), bad = 0, seen = 0;
  for (var i = 0; i < n; i++) {
    var b = page.locator(sel).nth(i);
    if (!(await b.isVisible()) || await b.isDisabled() || (await b.getAttribute('aria-pressed')) === 'true') continue;
    await b.hover(); await page.waitForTimeout(50);
    var got = await b.evaluate(function (e) { var c = getComputedStyle(e); return { name: e.getAttribute('aria-label'), bg: c.backgroundColor, border: c.borderTopWidth === '0px' ? 'rgba(0, 0, 0, 0)' : c.borderTopColor, color: c.color }; });
    seen++;
    if (got.bg !== WANT.bg || got.border !== WANT.border || got.color !== WANT.color) { bad++; console.log('different hover:', JSON.stringify(got)); }
  }
  // the circled i: no shade or highlight under the pointer, closed or open
  var langs = await page.locator('#m2-editwin button[data-lang="pd"]').isVisible() ? ['pd', 'af'] : [null];   // a CellDesigner map has no PD and AF
  for (var lang of langs) {
    if (lang) { await page.click('#m2-editwin button[data-lang="' + lang + '"]'); await page.waitForTimeout(200); }
    for (var k of await page.locator('#m2-editwin .m2-ed-pinfo:visible').all()) {
      for (var round = 0; round < 2; round++) {
        await k.hover(); await page.waitForTimeout(50);
        var c = await k.evaluate(function (e) { var c = getComputedStyle(e); return { name: e.getAttribute('aria-label'), bg: c.backgroundColor, color: c.color }; });
        seen++;
        if (c.bg !== 'rgba(0, 0, 0, 0)' || c.color !== WANT.color) { bad++; console.log('circled i highlighted:', JSON.stringify(c)); }
        if (!(await k.getAttribute('aria-expanded'))) break;   // the arcs' opens How to edit
        await k.click();
      }
    }
  }
  if (langs[0]) await page.click('#m2-editwin button[data-lang="pd"]');
  await page.mouse.move(0, 0);
  console.log(seen + ' sign buttons and circled i under the pointer, ' + bad + ' different');
  await browser.close();
  process.exit(bad || !seen ? 1 : 0);
})();
