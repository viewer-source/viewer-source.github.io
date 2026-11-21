// The live drawing of a move on maps the yEd renderer draws (GraphML, SBGN-ML) against the drawing after the release:
// every shape and line visible in the picture mid-move, in screen pixels (each element through its own transforms, so a
// shift of the map's places after the release, which moves nothing on screen, is no difference),
// compared with the same after the release, when the renderer has drawn the whole map again. They should be the same:
// a product or a reactant dragged turns its process's antennas and moves the port its line leaves from, the process
// itself dragged, a bend point dragged, the arrow keys. The working tree's editor and renderers routed into the live
// /styles/ page.
//   node tests/live-yed.js [viewer folder]   (needs Playwright; run from viewer/)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var here = process.argv[2] || path.join(__dirname, '..'), URL = 'https://viewer-source.github.io/styles/#';
function editor() {   // editor.js joined as Jekyll joins it
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
}
async function open(browser, map) {
  var p = await browser.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  await p.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: editor() }); });
  await p.route(/\/styles\/renderers\/.*\.js/, function (r) {
    var f = /renderers\/(.*\.js)/.exec(r.request().url())[1]; r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers', f), 'utf8') });
  });
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.addInitScript(function () { try { localStorage.setItem('atlas-edit-level', 'full'); } catch (e) {} });
  await p.goto(URL + map, { waitUntil: 'load' });
  await p.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await p.click('.m2-ri[data-win="edit"]');
  await p.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()) && !!document.querySelector('#m2-img [data-e]'); }, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  p.errs = errs;
  return p;
}
// what is drawn: every visible path and polygon of the editor's drawing, its points on screen, rounded to half a pixel
function drawn(p) {
  return p.evaluate(function () {
    var img = document.querySelector('#m2-img [data-e]').ownerSVGElement, out = [];   // the editor's drawing, not the site's picture under it
    img.querySelectorAll('path, polygon, polyline').forEach(function (el) {
      for (var q0 = el; q0 && q0 !== img; q0 = q0.parentNode) if (q0.classList.contains('m2-ed-dark') || getComputedStyle(q0).display === 'none') return;
      var d = el.getAttribute(el.localName === 'path' ? 'd' : 'points') || '';
      if (/[AaHhVvCcSsTt]/.test(d)) return;   // arcs and short forms: shapes, not lines
      var m = el.getScreenCTM(), v = d.match(/-?[\d.]+(?:e-?\d+)?/g) || [], q = [];
      for (var i = 0; i + 1 < v.length; i += 2) { var x = +v[i], y = +v[i + 1]; q.push(Math.round((m.a * x + m.c * y + m.e) * 2) / 2 + ',' + Math.round((m.b * x + m.d * y + m.f) * 2) / 2); }
      out.push(q.join(' '));
    });
    return out.sort();
  });
}
function at(p, id) { return p.evaluate(function (id) { var q = document.querySelector('#m2-img [data-n="' + id + '"]').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id); }
async function drag(p, id, dx, dy, also, inside) {   // also: another node added to the selection by Shift and a click first;
  // inside: pressed just inside the box's top left corner (a compartment, whose middle holds other nodes)
  var r = inside ? await p.evaluate(function (id) { var q = document.querySelector('#m2-img [data-n="' + id + '"]').getBoundingClientRect(); return [q.left + 14, q.top + 14]; }, id) : await at(p, id);
  await p.mouse.click(r[0], r[1]); await p.waitForTimeout(250);
  if (also) { var r2 = await at(p, also); await p.keyboard.down('Shift'); await p.mouse.click(r2[0], r2[1]); await p.keyboard.up('Shift'); await p.waitForTimeout(250); }
  await p.mouse.move(r[0], r[1]); await p.mouse.down();
  for (var k = 1; k <= 12; k++) { await p.mouse.move(r[0] + dx * k / 12, r[1] + dy * k / 12); await p.waitForTimeout(30); }
  await p.waitForTimeout(300);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-mid.png' });
  var mid = await drawn(p);
  await p.mouse.up(); await p.waitForTimeout(3000);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-after.png' });
  return [mid, await drawn(p)];
}
async function area(p, a, b, dx, dy) {   // nodes a and b selected by Shift with a drag round both, then b dragged
  var R = await p.evaluate(function (ids) {
    var rs = ids.map(function (id) { return document.querySelector('#m2-img [data-n="' + id + '"]').getBoundingClientRect(); });
    return [Math.min(rs[0].left, rs[1].left) - 4, Math.min(rs[0].top, rs[1].top) - 4, Math.max(rs[0].right, rs[1].right) + 4, Math.max(rs[0].bottom, rs[1].bottom) + 4];
  }, [a, b]);
  await p.keyboard.down('Shift'); await p.mouse.move(R[0], R[1]); await p.mouse.down(); await p.mouse.move((R[0] + R[2]) / 2, (R[1] + R[3]) / 2); await p.mouse.move(R[2], R[3]); await p.mouse.up(); await p.keyboard.up('Shift');
  await p.waitForTimeout(300);
  var r = await at(p, b);
  await p.mouse.move(r[0], r[1]); await p.mouse.down();
  for (var k = 1; k <= 12; k++) { await p.mouse.move(r[0] + dx * k / 12, r[1] + dy * k / 12); await p.waitForTimeout(30); }
  await p.waitForTimeout(300);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-mid.png' });
  var mid = await drawn(p);
  await p.mouse.up(); await p.waitForTimeout(3000);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-after.png' });
  return [mid, await drawn(p)];
}
async function endDrag(p, dx, dy) {   // a line's end dragged: the first line with both ends in view, selected, its target end moved
  var e = await p.evaluate(function () {
    var view = function (q) { return q.x > 320 && q.x < 1360 && q.y > 100 && q.y < 860; };
    var l = Array.prototype.map.call(document.querySelectorAll('#m2-img [data-e]'), function (g) {
      var q = g.querySelector('path'); if (!q || !q.getTotalLength) return null;
      var L = q.getTotalLength(), m = q.getScreenCTM(), at = function (f) { var r = q.getPointAtLength(L * f); return { x: m.a * r.x + m.c * r.y + m.e, y: m.b * r.x + m.d * r.y + m.f }; };
      return L > 60 && view(at(0)) && view(at(1)) ? [g.getAttribute('data-e'), at(0.5), at(1)] : null;
    }).filter(Boolean).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    return l[0] || null;
  });
  if (!e) return [['no line'], []];
  await p.mouse.click(e[1].x, e[1].y); await p.waitForTimeout(300);
  await p.mouse.move(e[2].x, e[2].y); await p.mouse.down();
  for (var k = 1; k <= 12; k++) { await p.mouse.move(e[2].x + dx * k / 12, e[2].y + dy * k / 12); await p.waitForTimeout(30); }
  await p.waitForTimeout(300);
  var mid = await drawn(p);
  await p.mouse.up(); await p.waitForTimeout(3000);
  return [mid, await drawn(p)];
}
async function keys(p, id, key, n) {   // key with Shift+: steps of 10, pressed one by one
  var r = await at(p, id); await p.mouse.click(r[0], r[1]); await p.waitForTimeout(250);
  for (var k = 0; k < n; k++) { if (/^Shift\+/.test(key)) await p.keyboard.press(key); else await p.keyboard.down(key); await p.waitForTimeout(25); }
  await p.waitForTimeout(40);   // before the keys' settling redraw (150 ms), so the live drawing is what is read
  var mid = await drawn(p);
  if (!/^Shift\+/.test(key)) await p.keyboard.up(key);
  await p.waitForTimeout(3000);
  return [mid, await drawn(p)];
}
// the nodes of a process: a product, a reactant and the process itself, found in the editor's drawing by the classes of
// the lines at a process (a product: the line with an arrowhead leaving it)
function roles(p) {
  return p.evaluate(function () {
    var ids = Array.prototype.map.call(document.querySelectorAll('#m2-img [data-n]'), function (g) { return g.getAttribute('data-n'); });
    return ids;
  });
}
var G6P = '\u03b1-D-glucose-6P', PPI = 'PPi';
var CASES = [
  ['GraphML product dragged across its process', 'glycolysis-graphml', function (p, n) { return drag(p, n.prod, 64, 168); }, G6P],
  ['GraphML product dragged sideways', 'glycolysis-graphml', function (p, n) { return drag(p, n.prod, 160, 8); }, G6P],
  ['GraphML reactant dragged', 'glycolysis-graphml', function (p, n) { return drag(p, n.reac, 40, 88); }, G6P],
  ['GraphML process dragged', 'glycolysis-graphml', function (p, n) { return drag(p, n.proc, 64, -48); }, G6P],
  ['GraphML second product dragged', 'glycolysis-graphml', function (p, n) { return drag(p, n.prod, 80, 104); }, PPI],
  ['GraphML arrow keys on a product', 'glycolysis-graphml', function (p, n) { return keys(p, n.prod, 'ArrowRight', 20); }, G6P],
  ['GraphML arrow keys down on a product', 'glycolysis-graphml', function (p, n) { return keys(p, n.prod, 'ArrowDown', 24); }, G6P],
  ['GraphML Shift with the arrow keys on a product', 'glycolysis-graphml', function (p, n) { return keys(p, n.prod, 'Shift+ArrowDown', 14); }, G6P],
  ['GraphML reactant and its process dragged together', 'glycolysis-graphml', function (p, n) { return drag(p, n.proc, 72, 56, n.reac); }, G6P],
  ['GraphML two nodes with a bent line between dragged together', 'glycolysis-graphml', function (p) { return area(p, 'n4', 'n1', 60, 90); }, G6P],
  ['GraphML compartment dragged with what it holds', 'carnitine-graphml', function (p, n) { return drag(p, n.grp, 40, 64, null, true); }, null],
  ['SBGN-ML product dragged across its process', 'glycolysis-sbgn', function (p, n) { return drag(p, n.prod, 64, 168); }, G6P],
  ['GraphML line end dragged', 'glycolysis-graphml', function (p) { return endDrag(p, 30, 20); }, G6P],
  ['SBGN-ML line end dragged', 'glycolysis-sbgn', function (p) { return endDrag(p, 30, 20); }, G6P],
  ['SBGN-ML process dragged', 'glycolysis-sbgn', function (p, n) { return drag(p, n.proc, 64, -48); }, G6P]
];
(async function () {
  var browser = await chromium.launch(), bad = 0, ran = 0;
  for (var c of CASES.filter(function (c) { return !process.env.ONLY || c[0].indexOf(process.env.ONLY) >= 0; })) {
    var p = await open(browser, c[1]);
    // the case's product found by its name, its process and a reactant of that process
    var n = await p.evaluate(function (name) {
      var t = window.m2EditNow().text, d = new DOMParser().parseFromString(t, 'application/xml'), Y = 'http://www.yworks.com/xml/graphml', E = [], P = {}, byName = {};
      if (d.getElementsByTagName('glyph').length) {   // an SBGN-ML map: glyphs and arcs, an arc's end at a process's port taken to the process
        var own = {};
        Array.prototype.forEach.call(d.getElementsByTagName('glyph'), function (g) {
          var id = g.getAttribute('id'), l = Array.prototype.filter.call(g.children, function (c) { return c.localName === 'label'; })[0];
          own[id] = id;
          Array.prototype.forEach.call(g.children, function (c) { if (c.localName === 'port') own[c.getAttribute('id')] = id; });
          if (/process$/.test(g.getAttribute('class') || '')) P[id] = 1;
          if (l && l.getAttribute('text') && !byName[l.getAttribute('text')]) byName[l.getAttribute('text')] = id;
        });
        Array.prototype.forEach.call(d.getElementsByTagName('arc'), function (a) { E.push([own[a.getAttribute('source')], own[a.getAttribute('target')]]); });
      } else {
        Array.prototype.forEach.call(d.getElementsByTagName('edge'), function (e) { E.push([e.getAttribute('source'), e.getAttribute('target')]); });
        Array.prototype.forEach.call(d.getElementsByTagName('node'), function (n) {
          var r = n.getElementsByTagNameNS(Y, 'GenericNode')[0] || n.getElementsByTagNameNS(Y, 'ShapeNode')[0], l = r && r.getElementsByTagNameNS(Y, 'NodeLabel')[0];
          if (r && /Process$/.test(r.getAttribute('configuration') || '')) P[n.getAttribute('id')] = 1;
          if (l && l.textContent.trim() && !byName[l.textContent.trim()]) byName[l.textContent.trim()] = n.getAttribute('id');
        });
      }
      if (!name) {   // a group holding a process, for a group dragged with what it holds
        var grp0 = Array.prototype.filter.call(d.getElementsByTagName('node'), function (n) {
          var gr = Array.prototype.filter.call(n.children, function (c) { return c.localName === 'graph'; })[0];
          return gr && Array.prototype.some.call(gr.getElementsByTagName('node'), function (m) { return P[m.getAttribute('id')]; }) && document.querySelector('#m2-img [data-n="' + n.getAttribute('id') + '"]');
        })[0];
        return grp0 ? { grp: grp0.getAttribute('id') } : null;
      }
      var prod = byName[name], e = E.filter(function (q) { return q[1] === prod && P[q[0]]; })[0];
      if (!e) return null;
      var r = E.filter(function (q) { return q[1] === e[0] && !P[q[0]]; })[0];
      return r ? { prod: prod, proc: e[0], reac: r[0] } : null;
    }, c[3]);
    ran++;
    if (!n) { bad++; console.log('WRONG ' + c[0] + ': no process found'); await p.close(); continue; }
    var r = await c[2](p, n), A = r[0], B = r[1];
    // what x has that y has not, an element matching one of y's when every point is within a pixel (the picture may sit
    // a fraction of a pixel differently after the release)
    var only = function (x, y) {
      var pts = function (l) { return l.split(' ').map(function (q) { return q.split(',').map(Number); }); }, left = y.map(pts);
      return x.filter(function (l) {
        var P = pts(l), j = left.findIndex(function (Q) { return Q && Q.length === P.length && Q.every(function (q, i) { return Math.abs(q[0] - P[i][0]) <= 1 && Math.abs(q[1] - P[i][1]) <= 1; }); });
        if (j < 0) return true;
        left[j] = null; return false;
      });
    };
    var a = only(A, B), b = only(B, A), ok = !a.length && !b.length && !p.errs.length;
    if (!ok) bad++;
    console.log((ok ? 'ok    ' : 'WRONG ') + c[0] + ' (' + (n.prod ? n.prod + ', ' + n.proc + ', ' + n.reac : n.grp) + ')' + (ok ? '' : ': mid-move only ' + a.length + ', after only ' + b.length + (p.errs.length ? ', errors ' + p.errs.join('; ').slice(0, 200) : '')));
    if (!ok && process.env.SHOW) { console.log('  mid:  ' + a.slice(0, 6).join('\n        ')); console.log('  after: ' + b.slice(0, 6).join('\n        ')); }
    await p.close();
  }
  await browser.close();
  console.log(ran + ' cases: ' + bad + ' wrong');
  process.exit(bad ? 1 : 0);
})();
