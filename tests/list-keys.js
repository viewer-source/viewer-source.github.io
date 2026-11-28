// Arrow keys in the map list: stepping down (then up) through every map, the chosen map stays inside the list's box
// with room to spare (about one item above and below), also under the page's CSS zoom. Runs on the live page by default.
//   node tests/list-keys.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/#glycolysis-celldesigner';
(async function () {
  var browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1000, height: 530 } });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#m2-list .m2-on', { timeout: 30000 });
  var n = await page.evaluate(function () { return document.querySelectorAll('#m2-list .m2-map').length; }), bad = [];
  for (var key of ['ArrowDown', 'ArrowUp']) for (var k = 0; k < n - 1; k++) {
    await page.keyboard.press(key); await page.waitForTimeout(150);
    var r = await page.evaluate(function () {
      var box = document.getElementById('m2-list'), on = box.querySelector('.m2-on');
      if (!on || box.scrollHeight <= box.clientHeight) return null;
      var b = box.getBoundingClientRect(), o = on.getBoundingClientRect();
      return { name: on.textContent.trim(), above: o.top - b.top, below: b.bottom - o.bottom, h: o.height, top: box.scrollTop, max: box.scrollHeight - box.clientHeight };
    });
    if (!r) continue;
    // at the list's top or bottom end there is no more room to give (the last item may sit a fraction of a pixel past the edge)
    var need = r.h * 0.5;
    if ((r.above < need && r.top > 1) || (r.below < need && r.top < r.max - 1) || r.above < -1 || r.below < -1) bad.push(key + ' ' + r.name + ' ' + JSON.stringify(r));
  }
  await browser.close();
  if (bad.length) { console.log('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('ok: ' + n + ' maps, the chosen one always in sight');
})();
