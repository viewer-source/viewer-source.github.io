// Make reversible and Make irreversible on SBGN-ML processes (sbgn_edit.reversible), on the live page: every process of
// Glycolysis (SBGN-ML) in view that has a consumption, through its right-click menu: Make reversible turns each
// consumption into a production leaving from the process's port in (none left, the productions one more each), the file
// read back by the converter's rules (each production's source the process or its port); Make irreversible then gives
// the consumptions back, the same count; one undo step each; the saved file unchanged after both (no other arc, glyph or
// port moved, the turned productions written from the process's port in); Properties' Reversible tick box on a process
// selected alone, both ways, undone. No script error.
//   node tests/sbgn-reversible.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), { DOMParser } = require('@xmldom/xmldom');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var arcs = function (t, pid) {   // the process's arcs in the SBGN-ML file: [consumptions, productions], by their ends (the process or its ports)
    var d = new DOMParser({ onError: function () {} }).parseFromString(t, 'application/xml'), g = Array.prototype.filter.call(d.getElementsByTagName('glyph'), function (x) { return x.getAttribute('id') === pid; })[0];
    var mine = [pid].concat(Array.prototype.map.call(g ? g.getElementsByTagName('port') : [], function (q) { return q.getAttribute('id'); }));
    var a = Array.prototype.slice.call(d.getElementsByTagName('arc'));
    return [a.filter(function (x) { return x.getAttribute('class') === 'consumption' && mine.indexOf(x.getAttribute('target')) >= 0; }).length,
            a.filter(function (x) { return x.getAttribute('class') === 'production' && mine.indexOf(x.getAttribute('source')) >= 0; }).length];
  };
  var ports = function (t, pid) {   // the process's ports as written ({ at: id@x,y list, from1: productions leaving its first port })
    var d = new DOMParser({ onError: function () {} }).parseFromString(t, 'application/xml'), g = Array.prototype.filter.call(d.getElementsByTagName('glyph'), function (x) { return x.getAttribute('id') === pid; })[0];
    var ps = Array.prototype.slice.call(g ? g.getElementsByTagName('port') : []), first = ps[0] ? ps[0].getAttribute('id') : null;
    return { at: ps.map(function (q) { return q.getAttribute('id') + '@' + q.getAttribute('x') + ',' + q.getAttribute('y'); }),
             from1: Array.prototype.filter.call(d.getElementsByTagName('arc'), function (a) { return a.getAttribute('class') === 'production' && a.getAttribute('source') === first; }).length };
  };
  var esc = async function () { for (var n = 0; n < 3; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(60); } };
  var menu = async function (id) {
    await esc();
    var r = await page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var q = g.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    await page.mouse.click(r[0], r[1], { button: 'right' }); await page.waitForTimeout(300);
    return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); });
  };
  var pick = async function (label) { await page.click('.m2-cx button:text-is("' + label + '")'); await page.waitForTimeout(900); };
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  if (!(await page.$('#m2-editwin button[data-make="macromolecule"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="macromolecule"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var t0 = await now();
  var procs = await page.evaluate(function (t) {   // processes with a consumption, in view
    var d = new DOMParser().parseFromString(t, 'application/xml');
    return Array.prototype.filter.call(d.getElementsByTagName('glyph'), function (g) { return g.getAttribute('class') === 'process'; }).map(function (g) { return g.getAttribute('id'); }).filter(function (id) {
      var e = document.querySelector('#m2-img [data-n="' + id + '"]'); if (!e) return false; var r = e.getBoundingClientRect(); return r.left > 330 && r.right < 1380 && r.top > 90 && r.bottom < 870;
    });
  }, t0);
  var done = 0;
  for (var pid of procs) {
    var a0 = arcs(t0, pid);
    if (!a0[0]) continue;
    var items = await menu(pid);
    ok(pid + ': Make reversible offered, after Change identity', items.indexOf('Make reversible') === items.findIndex(function (x) { return x.indexOf('Change identity') === 0; }) + 1, items.join('|'));
    if (items.indexOf('Make reversible') < 0) continue;
    await pick('Make reversible');
    var t1 = await now(), a1 = arcs(t1, pid);
    ok(pid + ': reversible: no consumption, ' + (a0[1] + a0[0]) + ' productions', a1[0] === 0 && a1[1] === a0[1] + a0[0], JSON.stringify([a0, a1]));
    var P0 = ports(t0, pid), P1 = ports(t1, pid);
    ok(pid + ': its ports where they were, the turned productions from its port in (.1)', JSON.stringify(P0.at) === JSON.stringify(P1.at) && P1.from1 === a0[0], JSON.stringify([P0, P1]));
    items = await menu(pid);
    ok(pid + ': then Make irreversible offered', items.indexOf('Make irreversible') >= 0, items.join('|'));
    await pick('Make irreversible');
    var t2 = await now(), a2 = arcs(t2, pid);
    ok(pid + ': irreversible again: the counts as before', JSON.stringify(a2) === JSON.stringify(a0), JSON.stringify([a0, a2]));
    await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
    ok(pid + ': one undo: reversible again', JSON.stringify(arcs(await now(), pid)) === JSON.stringify(a1));
    await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
    ok(pid + ': a second undo: the file as it was', (await now()) === t0);
    t0 = await now();
    if (++done >= 3) break;
  }
  ok('three processes tried', done === 3, done);
  // Properties' Reversible tick box: a process selected alone shows it under its own rows, unticked; ticked, the process
  // is reversible (no consumption left); unticked again, as before; one undo step each
  var tp = null, t3 = await now();
  for (var q of procs) if (arcs(t3, q)[0]) { tp = q; break; }
  if (tp) {
    await esc();
    var R = await page.$eval('#m2-img [data-n="' + tp + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(R[0], R[1]); await page.waitForTimeout(500);
    var box = function () { return page.evaluate(function () { var f = document.getElementById('m2-ed-rev'), t = f && f.closest('table'); return f && t && !t.hidden && f.offsetParent ? f.checked : null; }); };
    var rowsShown = await page.$$eval('.m2-ed-pnode tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).length; });
    ok(tp + ': selected alone, Properties shows Reversible, unticked, under its own rows', (await box()) === false && rowsShown > 0, (await box()) + ' ' + rowsShown);
    var c0 = arcs(t3, tp);
    await page.click('#m2-ed-rev'); await page.waitForTimeout(1000);
    var c1 = arcs(await now(), tp);
    ok(tp + ': ticked: reversible in the file, the box ticked, the process still selected', c1[0] === 0 && c1[1] === c0[0] + c0[1] && (await box()) === true, JSON.stringify([c0, c1]) + ' ' + (await box()));
    await page.click('#m2-ed-rev'); await page.waitForTimeout(1000);
    ok(tp + ': unticked: as before', JSON.stringify(arcs(await now(), tp)) === JSON.stringify(c0) && (await box()) === false);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(900); await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
    ok(tp + ': two undos: the file as it was', (await now()) === t3);
  } else ok('a process for the tick box', false);
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
