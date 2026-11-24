// Help signs: no ? among the top icons; the ? at the top of Settings opens Gestures and keys (viewing only, no While
// editing section) in view and edit mode alike, beside the left panel level with it (a second click, Esc or a click
// elsewhere closes it); the ? key opens it outside editing; the Edit window's ? opens the editor's own help, the one
// source of the editing rows, its mark drawn as the Settings one.
//   node tests/help-sign.js [page address]
var { chromium } = require('playwright');
var URL0 = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what); };
  var page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(URL0, { waitUntil: 'load' });
  await page.wai  var sign = '#m2-set-help', shown = function (id) { return page.evaluate(function (id) { var x = document.getElementById(id); return !!(x && !x.hidden); }, id); };
  ok('no ? among the top icons', await page.evaluate(function () { return !document.querySelector('#m2-rail .m2-ri[data-win="help"]'); }));
  await page.click('#m2-rail .m2-ri[data-win="set"]'); await page.waitForTimeout(300);
  ok('the ? is first in Settings', await page.evaluate(function (s) { var h = document.querySelector(s), w = document.getElementById('m2-setwin'); return !!(h && h.offsetParent && w.firstElementChild.contains(h)); }, sign));
  await page.click(sign); await page.waitForTimeout(300);
  ok('a click opens Gestures and keys', await shown('m2-tips'));
  ok('Gestures and keys holds viewing only: Main and More', await page.evaluate(function () { return [].map.call(document.querySelectorAll('#m2-tips h4'), function (x) { return x.textContent; }).join('|') === 'Main|More'; }));
  var at = await page.evaluate(function (s) { var t = document.getElementById('m2-tips').getBoundingClientRect(), g = document.querySelector(s).getBoundingClientRect(), n = document.querySelector('.m2-nav').getBoundingClientRect(); return { left: t.left, top: t.top, sign: g.top, nav: n.right }; }, sign);
  ok('beside the left panel, level with the sign', at.left >= at.nav && at.left - at.nav < 40 && Math.abs(at.top - at.sign) < 2);
  await page.click(sign); await page.waitForTimeout(300);
  ok('a second click closes it', !(await shown('m2-tips')));
  await page.click(sign); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('Esc closes it', !(await shown('m2-tips')));
  await page.click(sign); await page.mouse.click(1385, 885); await page.waitForTimeout(200);
  ok('a click elsewhere closes it', !(await shown('m2-tips')));
  await page.keyboard.press('?'); await page.waitForTimeout(200);
  ok('the ? key opens it', await shown('m2-tips'));
  await page.keyboard.press('Escape');
  ok('the two ? marks drawn alike', await page.evaluate(function () { return document.querySelector('#m2-set-help svg').innerHTML === document.querySelector('#m2-ed-help svg').innerHTML; }));
  await page.keyboard.press('e');
  await page.waitForSelector('.m2-editing', { timeout: 15000 }); await page.waitForTimeout(1500);
  await page.click('#m2-ed-help'); await page.waitForTimeout(300);
  ok('while editing, the Edit window\'s ? opens the editor\'s help', await shown('m2-ed-help-box'));
  ok('the editor\'s help is the short one: While editing and Less obvious, 19 rows with a Maps column', await page.evaluate(function () {
    var h = document.getElementById('m2-ed-help-box'), t = h.querySelectorAll('table'), hs = [].map.call(h.querySelectorAll('h4'), function (x) { return x.textContent; });
    return hs.join('|') === 'While editing|Less obvious' && t.length === 2 && t[1].querySelectorAll('tr').length === 20 && /Maps/.test(t[1].rows[0].textContent);
  }));
  ok('as wide as Gestures and keys', await page.evaluate(function () { return Math.abs(document.getElementById('m2-ed-help-box').offsetWidth - 760) < 2; }));
  var hb = await page.evaluate(function () { var r = document.getElementById('m2-ed-help-box').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(hb.x, hb.y);
  var y0 = await page.evaluate(function () { return window.scrollY; });
  for (var i = 0; i < 12; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  ok('scrolling the editor\'s help to its end leaves the page where it was', await page.evaluate(function (y0) {
    var h = document.getElementById('m2-ed-help-box'); return window.scrollY === y0 && h.scrollTop + h.clientHeight >= h.scrollHeight - 2;
  }, y0));
  await page.click('#m2-ed-help'); await page.waitForTimeout(300);
  ok('a second click closes the editor\'s help', !(await shown('m2-ed-help-box')));
  await page.keyboard.press('?'); await page.waitForTimeout(300);
  ok('while editing, the ? key opens the editor\'s help', await shown('m2-ed-help-box') && !(await shown('m2-tips')));
  await page.keyboard.press('Escape');
  await page.click('#m2-rail .m2-ri[data-win="set"]'); await page.waitForTimeout(300);
  await page.click(sign); await page.waitForTimeout(300);
  ok('while editing, the Settings ? opens Gestures and keys', await shown('m2-tips') && !(await shown('m2-ed-help-box')));
ght - 2;
  }, y0));
  await page.click(sign); await page.waitForTimeout(300);
  ok('a second click closes the editor\'s help', !(await shown('m2-ed-help-box')));
  ok('no page errors', !errs.length); if (errs.length) console.log(errs.join('\n'));
  await b.close(); console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
