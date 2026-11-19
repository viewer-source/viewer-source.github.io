// The ? sign at the end of the icons does what the ? key does: Gestures and keys outside editing, beside the left panel, (a second click, Esc or
// a click elsewhere closes it), the editor's own help while editing; Settings has no Gestures and keys button.
//   node tests/help-sign.js [page address]
var { chromium } = require('playwright');
var URL0 = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what); };
  var page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForFunction(function () { var i = document.getElementById('m2-img'); return i && i.style.width; }, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  var sign = '#m2-rail .m2-ri[data-win="help"]', shown = function (id) { return page.evaluate(function (id) { var x = document.getElementById(id); return !!(x && !x.hidden); }, id); };
  ok('the sign is shown, after Info', await page.evaluate(function (s) { var h = document.querySelector(s), i = document.querySelector('#m2-rail .m2-ri[data-win="info"]'); return !!(h && h.offsetParent && i && (i.compareDocumentPosition(h) & 4)); }, sign));
  await page.click(sign); await page.waitForTimeout(300);
  ok('a click opens Gestures and keys', await shown('m2-tips'));
  var at = await page.evaluate(function (s) { var t = document.getElementById('m2-tips').getBoundingClientRect(), g = document.querySelector(s).getBoundingClientRect(), n = document.querySelector('.m2-nav').getBoundingClientRect(); return { left: t.left, top: t.top, nav: n.right, sign: g.top }; }, sign);
  ok('beside the left panel, level with the sign', at.left >= at.nav && at.left - at.nav < 40 && Math.abs(at.top - at.sign) < 2);
  await page.click(sign); await page.waitForTimeout(300);
  ok('a second click closes it', !(await shown('m2-tips')));
  await page.click(sign); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('Esc closes it', !(await shown('m2-tips')));
  await page.click(sign); await page.mouse.click(1385, 885); await page.waitForTimeout(200);
  ok('a click elsewhere closes it', !(await shown('m2-tips')));
  await page.keyboard.press('?'); await page.waitForTimeout(200);
  ok('the ? key still opens it', await shown('m2-tips'));
  await page.keyboard.press('Escape');
  ok('Settings has no Gestures and keys button', await page.evaluate(function () { return !document.getElementById('m2-set-tips') && !/Gestures and keys/.test(document.getElementById('m2-setwin').textContent); }));
  await page.keyboard.press('e');
  await page.waitForSelector('.m2-editing', { timeout: 15000 }); await page.waitForTimeout(1500);
  await page.click(sign); await page.waitForTimeout(300);
  ok('while editing, the editor\'s help opens', await shown('m2-ed-help-box'));
  ok('while editing, Gestures and keys stays shut', !(await shown('m2-tips')));
  await page.click(sign); await page.waitForTimeout(300);
  ok('a second click closes the editor\'s help', !(await shown('m2-ed-help-box')));
  ok('no page errors', !errs.length); if (errs.length) console.log(errs.join('\n'));
  await b.close(); console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
