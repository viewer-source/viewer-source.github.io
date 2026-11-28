// The page fits its window: on the root page, at a laptop's window sizes, no horizontal scroll
// (the page no wider than the window, scrolled to its left edge), every row of the list and the map window's buttons
// inside it, after the page opens on a map and after a click on a map of the list. Prints what sticks out.
//   node tests/page-width.js [base address ...]   (BROWSER=webkit: Safari's engine)
var engine = require('playwright')[process.env.BROWSER || 'chromium'];   // BROWSER=webkit or firefox: the same test in another engine
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var bases = process.argv.slice(2); if (!bases.length) bases = ['https://viewer-source.github.io/'];
var bad = 0, ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await engine.launch();
  for (var base of bases) for (var vw of [[1400, 820], [1280, 760], [1512, 860]]) {
    var page = await b.newPage({ viewport: { width: vw[0], height: vw[1] } }), errs = [];
    page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
    await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' }); await page.waitForTimeout(3000);
    var m = function () {
      return page.evaluate(function () {
        var W = document.documentElement.clientWidth, out = [];
        document.querySelectorAll('body *').forEach(function (e) {
          var r = e.getBoundingClientRect(), s = getComputedStyle(e);
          if (!r.width || s.visibility === 'hidden' || s.display === 'none') return;
          if ((r.right > W + 1 + window.scrollX && r.left < W + window.scrollX) || r.left + window.scrollX < -1) {
            var p = e.parentElement, pr = p && p.getBoundingClientRect();
            if (pr && (pr.right > W + 1 + window.scrollX || pr.left + window.scrollX < -1)) return;   // its parent sticks out too: name the outermost
            out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) + ' ' + Math.round(r.left + window.scrollX) + '..' + Math.round(r.right + window.scrollX));
          }
        });
        return { W: W, sw: document.documentElement.scrollWidth, x: window.scrollX, out: out.slice(0, 6) };
      });
    };
    var at = base.replace(/^https:\/\//, '') + ' ' + vw.join('x');
    var a = await m();
    ok(at + ': opened, no horizontal scroll', a.sw <= a.W + 1 && a.x === 0, 'width ' + a.W + ', page ' + a.sw + ', scrolled ' + a.x + ' | ' + a.out.join(', '));
    var it = await page.$('#m2-list .m2-map >> nth=3');
    if (it) { await it.click(); await page.waitForTimeout(1500); var c = await m(); ok(at + ': a map clicked in the list, still none', c.sw <= c.W + 1 && c.x === 0, 'page ' + c.sw + ', scrolled ' + c.x + ' | ' + c.out.join(', ')); }
    ok(at + ': no script error', !errs.length, errs.slice(0, 2).join(' | '));
    await page.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
