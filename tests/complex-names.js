// Complex and compartment names in place, and Name by members (create.js membersName, m2EditNameHere, the double click
// and nameAt; cdcreate.js's double click; the page's right-click menu), on the styles page, Full and Layout editing:
//   - a double click on a complex's empty space (SBGN-ML, CellDesigner, GraphML) or on a compartment off its contents
//     (Estrogen GraphML) opens the name field in a band at the drawn name (a CellDesigner complex's at its bottom, an
//     unnamed SBGN-ML complex's bottom band), not over the whole group; a name typed there is written, undo takes it back;
//   - a double click on a CellDesigner member (Full) opens its own name; on an SBGN-ML member in Layout editing and on a
//     GraphML member nothing opens;
//   - right click inside a complex: Name by members directly above Repack complex; chosen, the complex is named by its
//     direct members' drawn names joined by colons in reading order (rows from the top, each from the left); greyed
//     when the complex already has that name (Glycolysis CellDesigner's PKA-R:cAMP, f001-glycolysis's s4:s2:s3); one
//     undo step. Nothing is saved (no token). No script error.
//   node tests/complex-names.js [base address] [--local]   (--local: the working tree's editor and renderers routed in)
var { chromium } = require('playwright');
var path = require('path'), fs = require('fs'), editorNow = require('./editor-now.js'), here = path.join(__dirname, '..');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var base = args[0] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page, errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var newPage = async function (level) {   // Full or Layout editing, as the edit window's switch keeps it
    if (page) await page.close();
    page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', function (e) { errs.push(e.message); });
    if (local) {   // the working tree's editor and renderers routed in
      var ed = editorNow(here);
      await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
      await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) {
        var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
        if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
      });
    }
    await page.addInitScript(function (l) { try { localStorage.setItem('atlas-edit-level', l); } catch (e) {} }, level);
  };
  var open = async function (hash) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.waitForTimeout(2500); if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(4000);
  };
  var box = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }); };
  // a point inside the group on none of its contents, on no line and off its drawn texts (the map is not hit in the page:
  // geometry only), 8 in from its box (4 in a tight complex), clear of a complex's cut corners
  var empty = function (id) { return page.evaluate(function (id) {
    var g = document.querySelector('#m2-img [data-n="' + id + '"]'), c = g.getBoundingClientRect();
    var kids = Array.prototype.filter.call(document.querySelectorAll('#m2-img [data-n]'), function (k) { var r = k.getBoundingClientRect(); return k !== g && r.left >= c.left - 0.5 && r.top >= c.top - 0.5 && r.right <= c.right + 0.5 && r.bottom <= c.bottom + 0.5 && r.width < c.width; }).map(function (k) { return k.getBoundingClientRect(); });
    Array.prototype.forEach.call(g.querySelectorAll('text'), function (t) { kids.push(t.getBoundingClientRect()); });
    var pts = [];   // the lines' points on screen, every 3 units
    document.querySelectorAll('#m2-img [data-e] path, #m2-img [data-e] polyline, #m2-img [data-e] line').forEach(function (q) {
      if (!q.getTotalLength) return;
      var L = q.getTotalLength(), m = q.getScreenCTM();
      for (var s = 0; s <= L; s += 3) { var p = q.getPointAtLength(s); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    });
    pts = pts.filter(function (p) { return p[0] > c.left - 10 && p[0] < c.right + 10 && p[1] > c.top - 10 && p[1] < c.bottom + 10; });
    var cut = Math.min(14, c.width / 4, c.height / 4);
    for (var M of [[8, 5, 7], [4, 3, 5]])   // in from the box, from contents, from lines: wide first, then closer in a tight complex
    for (var y = c.top + M[0]; y < c.bottom - M[0]; y += 1) for (var x = c.left + M[0]; x < c.right - M[0]; x += 1) {
      if ((x < c.left + cut || x > c.right - cut) && (y < c.top + cut || y > c.bottom - cut)) continue;
      if (kids.some(function (r) { return x > r.left - M[1] && x < r.right + M[1] && y > r.top - M[1] && y < r.bottom + M[1]; })) continue;
      if (pts.some(function (p) { return Math.abs(p[0] - x) < M[2] && Math.abs(p[1] - y) < M[2]; })) continue;
      return [x, y];
    }
    return null; }, id); };
  // the name Name by members should give: the direct members' drawn names (the text nearest each one's middle), rows
  // from the top (a member joins a row whose first member's middle is within half that one's height), each from the left
  var byMembers = function (id) { return page.evaluate(function (id) {
    var g = document.querySelector('#m2-img [data-n="' + id + '"]'), c = g.getBoundingClientRect(), R = function (k) { return k.getBoundingClientRect(); };
    var inn = function (r, o) { return r.left >= o.left - 0.5 && r.top >= o.top - 0.5 && r.right <= o.right + 0.5 && r.bottom <= o.bottom + 0.5; };
    var kids = Array.prototype.filter.call(document.querySelectorAll('#m2-img [data-n]'), function (k) { return k !== g && inn(R(k), c) && R(k).width < c.width; });
    kids = kids.filter(function (k) { return !kids.some(function (o) { return o !== k && inn(R(k), R(o)) && R(k).width < R(o).width; }); });
    var mid = function (k, d) { var r = R(k); return d ? r.top + r.height / 2 : r.left + r.width / 2; }, rows = [];
    kids.sort(function (a, b) { return mid(a, 1) - mid(b, 1); }).forEach(function (k) { var r = rows[rows.length - 1]; if (r && mid(k, 1) - mid(r[0], 1) <= R(r[0]).height / 2) r.push(k); else rows.push([k]); });
    var texts = Array.prototype.slice.call(document.querySelectorAll('#m2-img text'));
    var name = function (k) { var r = R(k), best = null, d0 = 1e9; texts.forEach(function (t) { var q = t.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2; if (!t.textContent.trim() || x < r.left || x > r.right || y < r.top || y > r.bottom) return; var d = Math.hypot(x - mid(k, 0), y - mid(k, 1)); if (d < d0) { d0 = d; best = t.textContent.trim(); } }); return best; };
    return [].concat.apply([], rows.map(function (r) { return r.sort(function (a, b) { return mid(a, 0) - mid(b, 0); }); })).map(name).filter(Boolean).join(':'); }, id); };
  var menu = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(400); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return [x.textContent, x.disabled]; }); }); };
  var item = function (l, s) { var k = l.findIndex(function (q) { return q[0] === s; }); return k < 0 ? null : { at: k, off: l[k][1] }; };
  var choose = async function (s) { await page.click('.m2-cx button:text-is("' + s + '")'); await page.waitForTimeout(1500); };
  var field = function () { return page.$$eval('input.m2-ed-type', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return { v: x.value, r: [r.left, r.top, r.right, r.bottom] }; })[0] || null; }); };
  var dbl = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(200); await page.mouse.dblclick(P[0], P[1]); await page.waitForTimeout(700); return field(); };
  var undo = async function () { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500); };
  var drawn = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { return Array.prototype.map.call(g.querySelectorAll('text'), function (t) { return t.textContent; }).join('|'); }); };
  var cdName = function (id) { return page.evaluate(function (id) { return window.cd_make.aliasInfo(window.m2EditNow().text, id).name; }, id); };
  // a band, not the whole group: inside it, under half its height
  var band = function (f, B) { return !!f && f.r[0] >= B[0] - 2 && f.r[2] <= B[2] + 2 && f.r[1] >= B[1] - 2 && f.r[3] <= B[3] + 2 && (f.r[3] - f.r[1]) < (B[3] - B[1]) / 2; };
  // Name by members on a complex with no name: offered above Repack complex, chosen names it, greyed then, one undo step
  var byMembersCase = async function (tag, id, P, nameNow) {
    var want = await byMembers(id), t0 = await now(), l = await menu(P), nb = item(l, 'Name by members'), rp = item(l, 'Repack complex');
    ok(tag + ': Name by members offered, directly above Repack complex, not greyed', !!nb && !!rp && nb.at === rp.at - 1 && !nb.off, JSON.stringify(l));
    if (!nb || nb.off) { await page.keyboard.press('Escape'); return; }
    await choose('Name by members');
    var got = await nameNow();
    ok(tag + ': named by its members in reading order (' + want + ')', !!want && /:/.test(want) && got === want, JSON.stringify([got, want]));
    ok(tag + ': drawn', (await drawn(id)).split('|').indexOf(want) >= 0, await drawn(id));
    var l2 = await menu(P), nb2 = item(l2, 'Name by members');
    ok(tag + ': greyed once so named', !!nb2 && nb2.off, JSON.stringify(l2));
    await undo();
    ok(tag + ': one undo, the file as it was', (await now()) === t0);
  };
  var sbLabel = function (id) { return function () { return now().then(function (t) { var m = new RegExp('<glyph [^>]*id="' + id + '"[^>]*>\\s*<label text="([^"]*)"').exec(t); return m ? m[1] : ''; }); }; };
  var gmLabel = function (id) { return function () { return now().then(function (t) { var s = t.indexOf('<node id="' + id + '"'), e = t.indexOf('<graph', s), m = /<y:NodeLabel\b[^>]*>([^<]*)</.exec(t.slice(s, e)); return m ? m[1] : ''; }); }; };

  // ---- Full editing
  await newPage('full');
  // SBGN-ML: an unnamed complex
  await open('glycolysis-sbgn');
  var P = await empty('n1');
  ok('glycolysis-sbgn: a point on the complex n1 off its members', !!P);
  if (P) {
    await byMembersCase('glycolysis-sbgn n1', 'n1', P, sbLabel('n1'));
    var B = await box('n1'), t0 = await now(), f = await dbl(P);
    ok('glycolysis-sbgn: double click on the complex off its members opens the name field', !!f && f.v === '', JSON.stringify(f));
    ok('glycolysis-sbgn: in a band at the bottom, not over the whole complex', band(f, B) && f.r[1] > (B[1] + B[3]) / 2 - 2, JSON.stringify([f, B]));
    if (f) { await page.keyboard.type('Test complex'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
    ok('glycolysis-sbgn: the name typed written', (await sbLabel('n1')()) === 'Test complex');
    await undo();
    ok('glycolysis-sbgn: undone, the file as it was', (await now()) === t0);
  }
  // CellDesigner: a named complex, its name at the bottom; a member
  await open('glycolysis-celldesigner');
  var c0 = await now(), Bc = await box('sa_n1'), cn0 = await cdName('sa_n1');   // as the file spells it (PKA_minus_R:cAMP)
  var nm = await page.$eval('#m2-img [data-n="sa_n1"] text', function (t) { var r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, t.textContent]; }).catch(function () { return null; });
  ok('glycolysis-celldesigner: sa_n1 drawn with its name PKA-R:cAMP', !!nm && nm[2] === 'PKA-R:cAMP', JSON.stringify(nm));
  if (nm) {
    var fn = await dbl(nm);
    ok('glycolysis-celldesigner: double click on the name: the field with the name, at the name', !!fn && fn.v === 'PKA-R:cAMP' && Math.abs((fn.r[1] + fn.r[3]) / 2 - nm[1]) <= 6, JSON.stringify([fn, nm]));
    ok('glycolysis-celldesigner: a band, not over the whole complex', band(fn, Bc), JSON.stringify([fn, Bc]));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    ok('glycolysis-celldesigner: Escape, nothing written', (await now()) === c0);
  }
  var Pc = await empty('sa_n1');
  ok('glycolysis-celldesigner: a point on sa_n1 off its members', !!Pc);
  if (Pc) {
    var lc = await menu(Pc), nbc = item(lc, 'Name by members');
    ok('glycolysis-celldesigner: Name by members greyed, the complex already so named', !!nbc && nbc.off && !!item(lc, 'Repack complex') && nbc.at === item(lc, 'Repack complex').at - 1, JSON.stringify(lc));
    var fe = await dbl(Pc);
    ok('glycolysis-celldesigner: double click off the members opens the same field at the name', !!fe && fe.v === 'PKA-R:cAMP' && !!nm && Math.abs((fe.r[1] + fe.r[3]) / 2 - nm[1]) <= 6, JSON.stringify([fe, nm]));
    if (fe) { await page.keyboard.press('Control+a'); await page.keyboard.type('Kinase'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
    ok('glycolysis-celldesigner: renamed Kinase', (await cdName('sa_n1')) === 'Kinase', await cdName('sa_n1'));
    var lk = await menu(Pc), nbk = item(lk, 'Name by members');
    ok('glycolysis-celldesigner: renamed, Name by members no longer greyed', !!nbk && !nbk.off, JSON.stringify(lk));
    if (nbk && !nbk.off) await choose('Name by members');
    ok('glycolysis-celldesigner: Name by members gives PKA-R:cAMP again, written as the file had it', (await cdName('sa_n1')) === cn0, JSON.stringify([await cdName('sa_n1'), cn0]));
    await undo(); ok('glycolysis-celldesigner: one undo, Kinase', (await cdName('sa_n1')) === 'Kinase');
    await undo(); ok('glycolysis-celldesigner: two undos, the file as it was', (await now()) === c0);
  }
  var Bm = await box('sa_n1_n0'), mn = await drawn('sa_n1_n0'), fm = await dbl([(Bm[0] + Bm[2]) / 2, (Bm[1] + Bm[3]) / 2]);
  ok('glycolysis-celldesigner: double click on a member opens its own name, over the member', !!fm && mn.split('|').indexOf(fm.v) >= 0 && fm.r[0] >= Bm[0] - 2 && fm.r[2] <= Bm[2] + 2 && fm.r[1] >= Bm[1] - 2 && fm.r[3] <= Bm[3] + 2, JSON.stringify([fm, mn, Bm]));
  await page.keyboard.press('Escape');
  // f001-glycolysis: members still named after their ids, the complex named s4:s2:s3: greyed
  await open('f001-glycolysis');
  var Bf = await box('sa2'), lf = await menu([(Bf[0] + Bf[2]) / 2, (Bf[1] + Bf[3]) / 2]), nbf = item(lf, 'Name by members');
  ok('f001-glycolysis: on a member of csa1 (s4:s2:s3), Name by members greyed', !!nbf && nbf.off && (await cdName('csa1')) === (await byMembers('csa1')), JSON.stringify([lf, await cdName('csa1'), await byMembers('csa1')]));
  await page.keyboard.press('Escape');
  // GraphML: a compartment's name, and a member that cannot be named there
  await open('estrogen-graphml');
  var Pe = await empty('n0'), e0 = await now(), Be = await box('n0');
  var cyt = await page.$eval('#m2-img [data-n="n0"] text', function (t) { var r = t.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  ok('estrogen-graphml: a point in CYTOPLASM off its contents', !!Pe);
  if (Pe) {
    var fc = await dbl(Pe);
    ok('estrogen-graphml: double click there opens the field with CYTOPLASM', !!fc && fc.v === 'CYTOPLASM', JSON.stringify(fc));
    ok('estrogen-graphml: the field at the drawn name, a band', band(fc, Be) && fc.r[1] <= cyt[3] && fc.r[3] >= cyt[1], JSON.stringify([fc, cyt]));
    if (fc) { await page.keyboard.press('Control+a'); await page.keyboard.type('CYTOSOL'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
    ok('estrogen-graphml: CYTOSOL written', (await gmLabel('n0')()) === 'CYTOSOL', await gmLabel('n0')());
    await undo(); ok('estrogen-graphml: undone, the file as it was', (await now()) === e0);
  }
  var Bg = await box('n0::n3::n0'), fg = await dbl([(Bg[0] + Bg[2]) / 2, (Bg[1] + Bg[3]) / 2]);
  ok('estrogen-graphml: double click on a complex\'s member: no field', !fg, JSON.stringify(fg));
  await page.keyboard.press('Escape');

  // ---- Layout editing
  await newPage('layout');
  await open('glycolysis-graphml');
  ok('Layout editing: no palette', !(await page.$('#m2-editwin button[data-make]:visible')));
  var Pg = await empty('n1');
  ok('glycolysis-graphml (Layout): a point on the complex n1 off its members', !!Pg);
  if (Pg) {
    await byMembersCase('glycolysis-graphml n1 (Layout)', 'n1', Pg, gmLabel('n1'));
    var Bl = await box('n1'), fl = await dbl(Pg);
    ok('glycolysis-graphml (Layout): double click off the members opens the name field, a band', !!fl && band(fl, Bl), JSON.stringify([fl, Bl]));
    await page.keyboard.press('Escape');
  }
  await open('glycolysis-sbgn');
  var Ps = await empty('n3');
  if (Ps) await byMembersCase('glycolysis-sbgn n3 (Layout)', 'n3', Ps, sbLabel('n3'));
  else ok('glycolysis-sbgn (Layout): a point on the complex n3 off its members', false);
  var Bs = await box('n3__n0'), fm = await dbl([(Bs[0] + Bs[2]) / 2, (Bs[1] + Bs[3]) / 2]);
  ok('glycolysis-sbgn (Layout): double click on a member: no field', !fm, JSON.stringify(fm));
  await page.keyboard.press('Escape');
  await open('glycolysis-celldesigner');
  var Pl = await empty('sa_n1'), Bcl = await box('sa_n1'), fcl = Pl ? await dbl(Pl) : null;
  ok('glycolysis-celldesigner (Layout): double click off the members opens the name field at the bottom', !!fcl && fcl.v === 'PKA-R:cAMP' && band(fcl, Bcl) && fcl.r[1] > (Bcl[1] + Bcl[3]) / 2 - 2, JSON.stringify([fcl, Bcl]));
  await page.keyboard.press('Escape');
  var ll = Pl ? await menu(Pl) : [], nbl = item(ll, 'Name by members');
  ok('glycolysis-celldesigner (Layout): Name by members offered, greyed (already so named)', !!nbl && nbl.off, JSON.stringify(ll));
  await page.keyboard.press('Escape');
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
