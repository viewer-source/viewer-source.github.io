// MINERVA's pictures put on where the person works (step 3 of the pack, notes/minerva-pack-plan.md), live, as a person
// outside would on a CellDesigner map in edit mode:
//   1. Properties' Picture row on a species: Upload a PNG; drawn in place of its shape and name, the note in the file;
//      undo and redo by the keys. Fit box to picture by the right-click: the box at the picture's proportions (3:1),
//      its centre and width kept, one undo step. Remove picture by the right-click.
//   2. A compartment: an SVG chosen, kept as SVG and drawn as SVG, its note naming the PNG; its name still drawn.
//   3. A complex: a PNG dropped on it. A picture dropped on empty space: a background added there, selected; undone.
//   4. A file that is no picture (a text named .png): refused with the reason, nothing written.
//   5. A background as an object: Add background image... on empty map space, drawn under the network and selected
//      (handles; its row under Background in the panel shaded); the empty space's menu holds Add alone; a drag inside it
//      where nothing else is moves it, one undo step; Esc lets it go; a click where nothing else is selects it again;
//      a click on a species selects the species instead; Shift on a corner handle keeps its proportions; its own
//      right-click menu (Replace image..., Fit box to image, Delete); a click on its panel row selects it; Delete
//      removes it, undone; the row's Remove; the panel's Upload.
//   5b. With Drag selects an area ticked: nothing selected, a drag on empty space draws an area (the background stays);
//      selected, a drag inside it moves it; a drag that starts on a species never moves the background.
//   6. The page opened again (no token): the species' and compartment's pictures drawn from this browser.
//   7. A folder chosen later: the pictures kept in this browser follow the map into its glyphs/ once it is drawn; a
//      picture put on is written there.
//   8. With a token (GitHub played here): a picture put on is sent to maps/glyphs/ before the note is written.
//   node tests/minerva-pic-live.js [base address] [--local] --data=<clone of the data repository>   (--local: the editor and renderers
//   of the working tree routed into the page; --data: the files GitHub gives in case 8)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), zlib = require('zlib');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, data = (process.argv.filter(function (a) { return /^--data=/.test(a); })[0] || '').slice(7), here = path.join(__dirname, '..'), bad = 0;
var t0 = Date.now(), ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '') + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)'); };
function png(w, h, rgb) {   // a plain PNG of one colour
  var raw = Buffer.alloc((w * 3 + 1) * h); for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  var ch = function (t, d) { var l = Buffer.alloc(4); l.writeUInt32BE(d.length); var c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0); return Buffer.concat([l, Buffer.from(t), d, c]); };
  var hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', hd), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
var RED = png(300, 100, [220, 30, 30]), BLUE = png(60, 60, [30, 30, 220]), BG = png(400, 100, [240, 240, 200]);
var SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect width="300" height="100" fill="#3a3"/><text x="10" y="50" font-size="6">small text</text></svg>');
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], said = [];
  page.on('pageerror', function (e) { errs.push(e.message || String(e.stack || e)); });
  page.on('dialog', function (d) { if (d.type() !== 'beforeunload') said.push(d.type() + ': ' + d.message()); d.accept().catch(function () {}); });
  if (local) {
    var ed = require('./editor-now.js')(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/[a-z_]+\.js/, function (r) {
      var f = new URL(r.request().url()).pathname.split('/').pop();
      r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers', 'converter', f), 'utf8') });
    });
  }
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var status = function () { return page.evaluate(function () { return (document.querySelector('#m2-ed-status') || {}).textContent || ''; }); };
  var box = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }).catch(function () { return null; }); };
  var imgs = function () { return page.evaluate(function () { return Array.prototype.map.call(document.querySelectorAll('#m2-img image'), function (i) { return { href: (i.getAttribute('href') || i.getAttribute('xlink:href') || '').slice(0, 30), x: +i.getAttribute('x'), y: +i.getAttribute('y'), w: +i.getAttribute('width'), h: +i.getAttribute('height'), g: (i.closest('[data-n]') || { getAttribute: function () { return ''; } }).getAttribute('data-n') }; }); }); };
  var select = async function (id, dx, dy) {
    await page.keyboard.press('Escape');
    var r = await box(id); await page.mouse.click(r[0] + (dx || 4), r[1] + (dy || 4)); await page.waitForTimeout(500);
  };
  var menu = async function (x, y, item) {
    await page.mouse.click(x, y, { button: 'right' }); await page.waitForTimeout(400);
    var it = await page.$('.m2-cx button:text-is("' + item + '")');
    if (!it) { var all = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); return all; }
    return it;
  };
  var choose = async function (trigger, file) { var ch = page.waitForEvent('filechooser'); await trigger(); await (await ch).setFiles(file); await page.waitForTimeout(2500); };
  var undo = async function () { await page.keyboard.press('Control+z'); await page.waitForTimeout(1500); };
  var redo = async function () { await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(1500); };
  var glyph = function (t, el, id) {   // the picture note of a species' or compartment's notes
    var re = el === 'c' ? new RegExp('<compartment [^>]*id="' + id + '"[\\s\\S]*?</compartment>') : new RegExp('<species [^>]*id="' + id + '"[\\s\\S]*?</species>'), m = re.exec(t);
    var g = m && /Glyph: ([^\n<]+)/.exec(m[0]); return g ? g[1] : null;
  };
  var drop = function (id, b64, name, type, at) {   // a file dropped on the map, on node id (or at a screen point)
    return page.evaluate(function (q) {
      var bin = atob(q.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var dt = new DataTransfer(); dt.items.add(new File([u], q.name, { type: q.type }));
      var P = q.at; if (!P) { var r = document.querySelector('#m2-img [data-n="' + q.id + '"]').getBoundingClientRect(); P = [r.left + 6, r.top + 6]; }
      var el = document.elementFromPoint(P[0], P[1]);
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: P[0], clientY: P[1], bubbles: true, cancelable: true }));
    }, { id: id, b64: b64.toString('base64'), name: name, type: type, at: at });
  };
  var handles = function () { return page.$$eval('#m2-view .m2-ed-handle', function (l) { return l.length; }); };
  var bgBox = async function () { var m = /<celldesigner:layerSpeciesAlias[^>]*>[\s\S]*?<celldesigner:bounds ([^>]*)>/.exec(await now()); return m ? m[1] : null; };
  var bgRows = function () { return page.$$eval('#m2-editwin tr.m2-ed-pbg', function (l) { return l.filter(function (r) { return r.offsetParent; }).map(function (r) { return [r.dataset.k, r.textContent, r.classList.contains('m2-ed-pbgsel')]; }); }); };
  var freeIn = async function (skip) {   // a screen point on the background where no node, line or compartment is: off every alias's box (from the file, the
    // background's picture giving the map's place on screen), then checked by the right click (empty map space: Add background image…)
    var t = await now(), bb = /<celldesigner:layerSpeciesAlias[^>]*>[\s\S]*?<celldesigner:bounds ([^>]*)>/.exec(t);
    if (!bb) return null;
    var g = function (q, k) { return +new RegExp('\\b' + k + '="([^"]+)"').exec(q)[1]; }, B = ['x', 'y', 'w', 'h'].map(function (k) { return g(bb[1], k); });
    var R = await page.evaluate(function () { var i = Array.prototype.filter.call(document.querySelectorAll('#m2-img image'), function (x) { return x.getAttribute('pointer-events') === 'none'; })[0]; if (!i) return null; var r = i.getBoundingClientRect(), v = document.getElementById('m2-view').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, v.left, v.top, v.right, v.bottom]; });
    if (!R) return null;
    var boxes = [], re = /<celldesigner:(?:speciesAlias|complexSpeciesAlias|compartmentAlias) [\s\S]*?<celldesigner:bounds ([^>]*)>/g, m;
    while ((m = re.exec(t))) boxes.push(['x', 'y', 'w', 'h'].map(function (k) { return g(m[1], k); }));
    for (var a = 0.1; a < 0.95; a += 0.04) for (var c = 0.1; c < 0.95; c += 0.04) {
      var X = B[0] + B[2] * a, Y = B[1] + B[3] * c, x = R[0] + R[2] * a, y = R[1] + R[3] * c;
      if (x < R[4] + 280 || x > R[6] - 30 || y < R[5] + 30 || y > R[7] - 30) continue;   // off the panel, inside the map's window
      if (boxes.some(function (q) { return X > q[0] - 12 && X < q[0] + q[2] + 12 && Y > q[1] - 12 && Y < q[1] + q[3] + 12; })) continue;
      if (skip && skip-- > 0) continue;
      var it_ = await menu(x, y, '__none__'); await page.waitForTimeout(200);   // menu() closed it with its Esc
      if (Array.isArray(it_) && (it_.indexOf('Add background image…') >= 0 || (it_[0] === 'Replace image…' && it_.indexOf('Remove image') < 0))) return [x, y];   // empty space, or the selected background's own menu
    }
    return null;
  };
  var enter = async function (hash) {   // the page opened anew (a hash alone would keep the page and what it holds)
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="cd:COMPARTMENT"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="cd:COMPARTMENT"]', { state: 'visible', timeout: 60000 }); await page.waitForTimeout(2000);
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await enter('srebp-celldesigner');
  // 1. a species: Upload a PNG in Properties
  var SP = 'sa_n3', CP = 'ca_n2', CX = 'sa_n1', t1 = await now(), b0 = await box(SP);
  await select(SP);
  var row = await page.$eval('.m2-ed-pnode tr[data-k="pic"]', function (r) { return !r.hidden && !r.closest('[hidden]') ? r.textContent : null; }).catch(function () { return null; });
  ok('1. Properties of a species: a Picture row, none yet', row && /none/.test(row), row);
  await choose(function () { return page.click('#m2-ed-pic'); }, { name: 'red cell.png', mimeType: 'image/png', buffer: RED });
  var t2 = await now(), im = (await imgs()).filter(function (x) { return /^data:image\/png/.test(x.href); });
  ok('1. the note written (the file\'s name made safe)', glyph(t2, 's', 's_n3') === 'glyphs/red-cell.png', glyph(t2, 's', 's_n3'));
  ok('1. drawn in place of the species', im.length === 1, JSON.stringify(im));
  var rowNow = await page.$eval('.m2-ed-pnode tr[data-k="pic"]', function (r) { return [r.textContent, r.querySelector('img').hidden, (r.querySelector('img').getAttribute('src') || '').slice(0, 20), r.hidden, !!r.closest('[hidden]')]; });
  ok('1. the row shows its name and a preview', /red-cell\.png/.test(rowNow[0]) && !rowNow[1] && /^data:image\/png/.test(rowNow[2]), JSON.stringify(rowNow));
  var btns = function () { return page.$eval('.m2-ed-pnode tr[data-k="pic"]', function (r) { var c = r; while (c.parentElement && getComputedStyle(c).overflowX === 'visible') c = c.parentElement;   // the panel's visible edge
      var edge = c.getBoundingClientRect().right, fit = Array.prototype.every.call(r.querySelectorAll('button'), function (b) { return b.hidden || b.getBoundingClientRect().right <= edge + 0.5; });
      return [r.querySelector('#m2-ed-pic').hidden, r.querySelector('.m2-ed-ppicoff').hidden, fit]; }); };
  ok('1. with a picture: Remove shown, Upload hidden (one button, the row fits 240 px)', JSON.stringify(await btns()) === '[true,false,true]', JSON.stringify(await btns()));
  await undo();
  ok('1. undone: no note, no picture', glyph(await now(), 's', 's_n3') === null && (await imgs()).length === 0);
  await redo();
  ok('1. redone', glyph(await now(), 's', 's_n3') === 'glyphs/red-cell.png' && (await imgs()).length === 1);
  var r1 = await box(SP), it = await menu(r1[0] + 6, r1[1] + 6, 'Fit box to image');
  if (Array.isArray(it)) ok('1. right-click: Fit box to picture', false, it.join(' | ')); else { await it.click(); await page.waitForTimeout(2000); }
  var a1 = /<celldesigner:speciesAlias id="sa_n3"[\s\S]*?<celldesigner:bounds ([^>]*)>/.exec(await now())[1], wv = +/w="([^"]+)"/.exec(a1)[1], hv = +/h="([^"]+)"/.exec(a1)[1];
  var a0 = /<celldesigner:speciesAlias id="sa_n3"[\s\S]*?<celldesigner:bounds ([^>]*)>/.exec(t1)[1], w0 = +/w="([^"]+)"/.exec(a0)[1], h0 = +/h="([^"]+)"/.exec(a0)[1], y0 = +/y="([^"]+)"/.exec(a0)[1], y1 = +/y="([^"]+)"/.exec(a1)[1];
  ok('1. Fit box to picture: 3:1, width and centre kept', Math.abs(wv - w0) < 0.01 && Math.abs(hv - w0 / 3) < 0.02 && Math.abs((y1 + hv / 2) - (y0 + h0 / 2)) < 0.02, [w0, h0, wv, hv].join());
  await undo();
  var a2 = /<celldesigner:speciesAlias id="sa_n3"[\s\S]*?<celldesigner:bounds ([^>]*)>/.exec(await now())[1];
  ok('1. Fit box undone in one step', a2 === a0 && glyph(await now(), 's', 's_n3') === 'glyphs/red-cell.png', a0 + ' / ' + a1 + ' / ' + a2 + ' ' + glyph(await now(), 's', 's_n3'));
  // 2. a compartment: an SVG
  await select(CP);
  await choose(function () { return page.click('#m2-ed-pic'); }, { name: 'nucleus.svg', mimeType: 'image/svg+xml', buffer: SVG });
  var t3 = await now(), svgs = (await imgs()).filter(function (x) { return /^data:image\/svg/.test(x.href); });
  ok('2. a compartment: the note names the PNG, the SVG drawn', glyph(t3, 'c', 'c_n2') === 'glyphs/nucleus.png' && svgs.length === 1, glyph(t3, 'c', 'c_n2') + ' ' + JSON.stringify(svgs));
  // 3. a complex: dropped
  await drop(CX, BLUE, 'blue.png', 'image/png'); await page.waitForTimeout(2500);
  ok('3. a PNG dropped on a complex: put on', glyph(await now(), 's', 's_n1') === 'glyphs/blue.png', glyph(await now(), 's', 's_n1'));
  var t4 = await now();
  await drop(null, BLUE, 'blue.png', 'image/png', [1300, 860]); await page.waitForTimeout(2500);
  ok('3. dropped on empty space: a background added, selected', /name="Background images"[\s\S]*Glyph: glyphs\/blue(-\d+)?\.png/.test(await now()) && (await handles()) >= 8, await status());
  await undo();
  ok('3. the dropped background undone in one step, its handles gone', (await now()) === t4 && (await handles()) === 0);
  ok('3. a dropped picture never added as a map', !(await page.$('#m2-list .m2-map[data-title="blue"]')));
  // 1 (end). Remove picture by the right-click
  r1 = await box(SP); it = await menu(r1[0] + 6, r1[1] + 6, 'Remove image');
  if (Array.isArray(it)) ok('1. right-click: Remove picture', false, it.join(' | ')); else { await it.click(); await page.waitForTimeout(2000); }
  ok('1. Remove picture: the note gone, the species drawn again', glyph(await now(), 's', 's_n3') === null && !(await imgs()).some(function (x) { return /png/.test(x.href) && x.g === SP; }));
  await select(SP);
  ok('1. without a picture: Upload shown, Remove hidden', JSON.stringify(await btns()) === '[false,true,true]', JSON.stringify(await btns()));
  // 1b. several selected: the Image row on all of them; one image on both kept once in the drawing
  var rowOf = function () { return page.$eval('.m2-ed-pnode tr[data-k="pic"]', function (r) { return { shown: !r.hidden && !r.closest('[hidden]'), name: r.querySelector('.m2-ed-ppicname').textContent, mixed: r.classList.contains('m2-mixed') }; }).catch(function () { return null; }); };
  var rc = await box(CX); await page.keyboard.down('Shift'); await page.mouse.click(rc[0] + 4, rc[1] + 4); await page.keyboard.up('Shift'); await page.waitForTimeout(600);
  var rm = await rowOf();
  ok('1b. a species without and a complex with an image selected: the Image row, mixed, Upload shown', rm && rm.shown && rm.name === 'mixed' && rm.mixed && JSON.stringify(await btns()) === '[false,true,true]', JSON.stringify(rm) + ' ' + JSON.stringify(await btns()));
  var tb = await now();
  await choose(function () { return page.click('#m2-ed-pic'); }, { name: 'red cell.png', mimeType: 'image/png', buffer: RED });
  var tb2 = await now(), rs = await rowOf();
  ok('1b. Upload: the image on both', glyph(tb2, 's', 's_n3') === 'glyphs/red-cell.png' && glyph(tb2, 's', 's_n1') === 'glyphs/red-cell.png', glyph(tb2, 's', 's_n3') + ' ' + glyph(tb2, 's', 's_n1'));
  ok('1b. the row shows the one image and Remove', rs && rs.name === 'red-cell.png' && !rs.mixed && JSON.stringify(await btns()) === '[true,false,true]', JSON.stringify(rs));
  var shared1 = await page.evaluate(function () {
    var s = document.getElementById('m2-img'), t = window.m2EditNow().svg || '';
    var uses = s ? s.querySelectorAll('use').length : -1, syms = s ? s.querySelectorAll('symbol').length : -1, copies = (t.match(/href="data:image\/png[^"]*"/g) || []).length;
    return new Promise(function (res) {   // the drawing as an image (view mode, downloads): red where each node is
      var im = new Image(); im.onload = function () {
        var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; var x = c.getContext('2d'); x.drawImage(im, 0, 0);
        var at = Array.prototype.map.call(new DOMParser().parseFromString(t, 'image/svg+xml').querySelectorAll('use'), function (u) { var d = x.getImageData(+u.getAttribute("x") + 3, +u.getAttribute("y") + 3, 1, 1).data; return d[0] > 180 && d[1] < 80 && d[2] < 80; });
        res({ uses: uses, syms: syms, copies: copies, red: at });
      }; im.onerror = function () { res({ uses: uses, syms: syms, copies: copies, red: null }); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t);
    });
  });
  ok('1b. the drawing keeps the image once, both nodes drawn by <use>, red where each is as an image', shared1.uses === 2 && shared1.syms === 1 && shared1.copies === 1 && shared1.red && shared1.red.length === 2 && shared1.red.every(Boolean), JSON.stringify(shared1));
  await undo();
  ok('1b. undone in one step: as before', (await now()) === tb, glyph(await now(), 's', 's_n3') + ' ' + glyph(await now(), 's', 's_n1'));
  await redo();
  await select(SP); rc = await box(CX); await page.keyboard.down('Shift'); await page.mouse.click(rc[0] + 4, rc[1] + 4); await page.keyboard.up('Shift'); await page.waitForTimeout(600);   // undo and redo clear the selection (core.js)
  await page.click('.m2-ed-pnode tr[data-k="pic"] .m2-ed-ppicoff'); await page.waitForTimeout(2000);
  ok('1b. Remove: off both', glyph(await now(), 's', 's_n3') === null && glyph(await now(), 's', 's_n1') === null);
  await undo(); await undo();
  ok('1b. two undos: back to before the Upload', (await now()) === tb);
  await select(SP);   // step 4 works on the species alone
  // 4. not a picture (on the species, its picture removed)
  t4 = await now();
  await choose(function () { return page.click('#m2-ed-pic'); }, { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  ok('4. a text named .png: refused with the reason, nothing written', (await now()) === t4 && /PNG or SVG only/.test(await status()), await status());
  // 5. a background as an object
  var t5 = await now();
  it = await menu(1300, 860, 'Add background image…');
  if (Array.isArray(it)) ok('5. Add background image on empty space', false, it.join(' | ')); else await choose(function () { return it.click(); }, { name: 'tissue.png', mimeType: 'image/png', buffer: BG });
  var bgs = await page.evaluate(function () { var s = document.getElementById('m2-img'), i = Array.prototype.filter.call(s.querySelectorAll('image'), function (x) { return x.getAttribute('pointer-events') === 'none'; })[0], g = s.querySelector('g[data-n]'); return i ? { under: !!(g && (i.compareDocumentPosition(g) & 4)), x: +i.getAttribute('x'), y: +i.getAttribute('y') } : null; });
  ok('5. the background drawn under the network, its layer and note written', bgs && bgs.under && /name="Background images"[\s\S]*Glyph: glyphs\/tissue\.png\nZ-Index: -1/.test(await now()), JSON.stringify(bgs));
  ok('5. added and selected: its eight handles shown', (await handles()) >= 8, await handles());
  var rows = await bgRows();
  ok('5. the panel: Background, its row shaded, then Upload', rows.length === 2 && /Background/.test(rows[0][1]) && /tissue\.png/.test(rows[0][1]) && rows[0][2] && rows[1][0] === 'bgadd' && /^Upload$/.test(rows[1][1]), JSON.stringify(rows));
  var fp = await freeIn();
  ok('5. a free point on the background found', !!fp, fp);
  var mm = await menu(1300, 860, '__none__');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('5. empty space outside it: Add background image alone, no item per background', Array.isArray(mm) && mm.indexOf('Add background image…') >= 0 && !mm.some(function (x) { return /Move and resize|Remove background|Fit background/.test(x); }), JSON.stringify(mm));
  await page.mouse.click(fp[0], fp[1]); await page.waitForTimeout(600);   // the right-click's Escape let it go: a click selects it again
  var bb = await bgBox(), tb = await now();
  ok('5. a click where nothing else is: selected', (await handles()) >= 8, await handles());
  await page.mouse.move(fp[0], fp[1]); await page.mouse.down(); await page.mouse.move(fp[0] + 40, fp[1] + 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(2000);
  var ba = await bgBox(), dxm = +/x="([^"]+)"/.exec(ba)[1] - +/x="([^"]+)"/.exec(bb)[1];
  ok('5. a drag inside moves it, its size kept', dxm > 5 && /w="([^"]+)"/.exec(ba)[1] === /w="([^"]+)"/.exec(bb)[1], bb + ' -> ' + ba);
  ok('5. the network not moved by that drag', (/<celldesigner:speciesAlias id="sa_n8"[\s\S]*?<\/celldesigner:speciesAlias>/.exec(await now()) || [])[0] === (/<celldesigner:speciesAlias id="sa_n8"[\s\S]*?<\/celldesigner:speciesAlias>/.exec(tb) || [])[0]);
  await undo();
  ok('5. the move undone in one step, still selected', (await bgBox()) === bb && (await handles()) >= 8);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  ok('5. Esc: let go, the handles gone, the row no longer shaded', (await handles()) === 0 && !(await bgRows())[0][2]);
  await page.mouse.click(fp[0], fp[1]); await page.waitForTimeout(600);
  await page.keyboard.press('Control+a'); await page.waitForTimeout(600);
  var tA = await now(); await page.keyboard.press('Delete'); await page.waitForTimeout(2000);
  ok('5. Select all after the background: Delete deletes the selection, the background stays', /Glyph: glyphs\/tissue\.png/.test(await now()) && !/id="sa_n8"/.test(await now()) && (await now()) !== tA);
  await undo(); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.mouse.click(fp[0], fp[1]); await page.waitForTimeout(600);
  var c8 = await box('sa_n8'); await page.mouse.click(c8[0] + 6, c8[1] + 6); await page.waitForTimeout(600);
  var pm = await page.$eval('#m2-editwin .m2-ed-pmap', function (x) { return x.hidden; });
  ok('5. a click on a species over it: the species selected, the background let go', pm === true && (await page.$eval('#m2-editwin .m2-ed-props', function (x) { return !x.hidden; })), pm);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('5. after Esc: no background selected', (await handles()) === 0 && !(await bgRows())[0][2]);
  await page.mouse.click(fp[0], fp[1]); await page.waitForTimeout(600);
  var hr = await page.$$eval('#m2-view .m2-ed-handle', function (l) { return l.map(function (h) { var r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); });
  var br = hr.reduce(function (a, q) { return !a || q[0] + q[1] > a[0] + a[1] ? q : a; }, null), b0r = await bgBox();
  await page.keyboard.down('Shift'); await page.mouse.move(br[0], br[1]); await page.mouse.down(); await page.mouse.move(br[0] - 80, br[1] - 5, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(2000);
  var b1r = await bgBox(), rat = function (q) { return +/w="([^"]+)"/.exec(q)[1] / +/h="([^"]+)"/.exec(q)[1]; };
  ok('5. Shift on a corner handle dragged left: smaller, its proportions kept', +/w="([^"]+)"/.exec(b0r)[1] - +/w="([^"]+)"/.exec(b1r)[1] > 20 && Math.abs(rat(b1r) / rat(b0r) - 1) < 0.01, b0r + ' -> ' + b1r);
  await undo();
  var fp2 = await freeIn() || fp;
  it = await menu(fp2[0], fp2[1], '__none__');
  ok('5. its own right-click menu: Replace image…, Fit box to image, Delete; nothing of the whole map', Array.isArray(it) && it.indexOf('Replace image…') >= 0 && it.indexOf('Fit box to image') >= 0 && it.some(function (x) { return /^Delete/.test(x); }) && !it.some(function (x) { return /Add background|Show grid|Snap map/.test(x); }), JSON.stringify(it));
  if ((await handles()) < 8) { await page.mouse.click(fp2[0], fp2[1]); await page.waitForTimeout(600); }
  it = await menu(fp2[0], fp2[1], 'Fit box to image');
  if (Array.isArray(it)) ok('5. Fit box to image', false, it.join(' | ')); else { await it.click(); await page.waitForTimeout(2000); }
  var bf = await bgBox();
  ok('5. Fit box to image: 4:1', Math.abs(rat(bf) - 4) < 0.01, bf);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.click('#m2-editwin tr.m2-ed-pbg[data-k^="bg"]:not([data-k="bgadd"]) .m2-ed-ppicname'); await page.waitForTimeout(600);
  ok('5. a click on its row in the panel selects it on the map', (await handles()) >= 8 && (await bgRows())[0][2]);
  await page.keyboard.press('Delete'); await page.waitForTimeout(2000);
  ok('5. Delete removes it: the file as before, no handles, Background with Upload alone', (await now()) === t5 && (await handles()) === 0 && JSON.stringify((await bgRows()).map(function (r) { return r[0]; })) === '["bgadd"]');
  await undo();
  ok('5. Delete undone: back, its row back', /Glyph: glyphs\/tissue\.png/.test(await now()) && (await bgRows()).length === 2);
  await page.click('#m2-editwin tr.m2-ed-pbg[data-k^="bg"]:not([data-k="bgadd"]) .m2-ed-ppicoff'); await page.waitForTimeout(2000);
  ok('5. its row\'s Remove: the file as before the background', (await now()) === t5);
  await choose(function () { return page.click('#m2-editwin tr.m2-ed-pbg[data-k="bgadd"] button'); }, { name: 'tissue.png', mimeType: 'image/png', buffer: BG });
  ok('5. the panel\'s Upload: added and selected', /Glyph: glyphs\/tissue\.png/.test(await now()) && (await handles()) >= 8);
  fp = await freeIn();
  it = await menu(fp[0], fp[1], 'Delete');
  if (Array.isArray(it)) ok('5. the right-click\'s Delete', false, it.join(' | ')); else { await it.click(); await page.waitForTimeout(2000); }
  ok('5. the right-click\'s Delete: the file as before', (await now()) === t5);
  // 5b. Settings, Gestures, Drag selects an area ticked
  await page.evaluate(function () { localStorage.setItem('atlas-drag-moves', 'off'); });
  await enter('srebp-celldesigner');
  it = await menu(1300, 860, 'Add background image…');
  if (Array.isArray(it)) ok('5b. Add background image', false, it.join(' | ')); else await choose(function () { return it.click(); }, { name: 'tissue.png', mimeType: 'image/png', buffer: BG });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  fp = await freeIn();
  var b5 = await bgBox();
  await page.mouse.move(fp[0], fp[1]); await page.mouse.down(); await page.mouse.move(fp[0] + 50, fp[1] + 40, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(1500);
  ok('5b. nothing selected: a drag on empty space over it draws an area, the background stays', (await bgBox()) === b5 && (await handles()) === 0, await bgBox());
  await page.mouse.click(fp[0], fp[1]); await page.waitForTimeout(600);
  await page.mouse.move(fp[0], fp[1]); await page.mouse.down(); await page.mouse.move(fp[0] + 50, fp[1] + 40, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(2000);
  var a5 = await bgBox();
  ok('5b. selected: a drag inside it moves it', a5 !== b5, b5 + ' -> ' + a5);
  var c5 = await box('sa_n8'), s5 = (/<celldesigner:speciesAlias id="sa_n8"[\s\S]*?<\/celldesigner:speciesAlias>/.exec(await now()) || [])[0];
  await page.mouse.move(c5[0] + 6, c5[1] + 6); await page.mouse.down(); await page.mouse.move(c5[0] + 60, c5[1] + 46, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(2000);
  ok('5b. a drag that starts on a species: the background not moved, the species not moved', (await bgBox()) === a5 && (/<celldesigner:speciesAlias id="sa_n8"[\s\S]*?<\/celldesigner:speciesAlias>/.exec(await now()) || [])[0] === s5, await bgBox());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('#m2-editwin tr.m2-ed-pbg[data-k^="bg"]:not([data-k="bgadd"]) .m2-ed-ppicname'); await page.waitForTimeout(600);
  await page.keyboard.press('Delete'); await page.waitForTimeout(2000);
  ok('5b. removed, no handles left', (await handles()) === 0 && !/Background images/.test(await now()));
  await page.evaluate(function () { localStorage.removeItem('atlas-drag-moves'); });
  // 6. the page opened again: drawn from this browser
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#m2-img', { timeout: 30000 }); await page.waitForTimeout(6000);
  var t6 = await page.evaluate(function () { return window.m2EditNow ? window.m2EditNow().text : ''; });
  var i6 = await imgs();
  ok('6. opened again: the compartment\'s SVG and the complex\'s PNG drawn from this browser', i6.filter(function (x) { return /^data:image\/svg/.test(x.href); }).length === 1 && i6.filter(function (x) { return /^data:image\/png/.test(x.href); }).length === 1, JSON.stringify(i6) + ' ' + (t6 || '').length);
  ok('no message box, no script errors (no token)', !said.length && !errs.length, said.concat(errs).join(' | '));
  // 7. a folder (the browser's private file system handed out as the chosen folder)
  await page.evaluate(function () {
    return navigator.storage.getDirectory().then(function (r) { return r.removeEntry('pics', { recursive: true }).catch(function () {}).then(function () { return r.getDirectoryHandle('pics', { create: true }); }); })
      .then(function (d) {
        localStorage.setItem('atlas-edit-folder', 'pics');
        return new Promise(function (res, rej) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var t = q.result.transaction('folder', 'readwrite'); t.objectStore('folder').put(d, 'dir'); t.objectStore('folder').put({}, 'files'); t.oncomplete = function () { q.result.close(); res(); }; t.onerror = rej; }; q.onerror = rej; });
      });
  });
  await enter('srebp-celldesigner');
  await page.waitForTimeout(3000);
  var followed = await page.evaluate(function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('pics'); }).then(function (d) { return d.getDirectoryHandle('glyphs'); }).then(function (g) { var out = []; return (async function () { for await (var k of g.keys()) out.push(k); return out.sort(); })(); }).catch(function (e) { return String(e); }); });
  ok('7. a folder chosen later: the pictures kept in this browser followed the map into its glyphs/ once drawn', Array.isArray(followed) && followed.indexOf('nucleus.svg') >= 0 && followed.indexOf('blue.png') >= 0, JSON.stringify(followed));
  await select(SP);
  await choose(function () { return page.click('#m2-ed-pic'); }, { name: 'folder pic.png', mimeType: 'image/png', buffer: BLUE });
  var inFolder = await page.evaluate(function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('pics'); }).then(function (d) { return d.getDirectoryHandle('glyphs'); }).then(function (g) { return g.getFileHandle('folder-pic.png'); }).then(function (h) { return h.getFile(); }).then(function (f) { return f.size; }).catch(function (e) { return String(e); }); });
  ok('7. a folder: the picture written into its glyphs/', inFolder === BLUE.length, inFolder);
  ok('no message box, no script errors (folder)', !said.length && !errs.length, said.concat(errs).join(' | '));
  // 8. a token, GitHub played here: a picture put on goes to maps/glyphs/ at once
  var puts = [];
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (st, o) { return route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps/glyphs') return json(200, puts.map(function (p) { return { name: p.path.slice(12), path: p.path, type: 'file', sha: 's' + p.path }; }));
    if (/^\/contents\/maps\/glyphs\/[^/]+$/.test(rest) && meth === 'PUT') { var bd = JSON.parse(r.postData()); puts.push({ path: decodeURIComponent(rest.slice(10)), size: Buffer.from(bd.content, 'base64').length }); return json(201, { content: { sha: 'x' } }); }
    var real = function (f) { var p = data && path.join(data, f); return p && fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p) : null; };   // the data repository's own files, as GitHub has them
    var sha = function (d) { return require('crypto').createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + d.length + '\0'), d])).digest('hex'); };
    if (rest === '/contents/maps') return json(200, data ? fs.readdirSync(path.join(data, 'maps')).filter(function (f) { return fs.statSync(path.join(data, 'maps', f)).isFile(); }).map(function (f) { return { name: f, path: 'maps/' + f, type: 'file', sha: sha(real('maps/' + f)) }; }) : []);
    if (/^\/contents\/[^?]+$/.test(rest) && meth === 'GET') { var fp = decodeURIComponent(rest.slice(10)), d = real(fp); return d ? json(200, { content: d.toString('base64'), encoding: 'base64', sha: sha(d), path: fp }) : json(404, { message: 'Not Found' }); }
    return json(404, { message: 'Not Found' });
  });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.removeItem('atlas-edit-folder'); });
  await enter('srebp-celldesigner');
  await page.waitForTimeout(4000);
  var n0 = puts.length;
  await select('sa_n8');
  await choose(function () { return page.click('#m2-ed-pic'); }, { name: 'gh.png', mimeType: 'image/png', buffer: RED });
  ok('8. a picture put on sent to maps/glyphs/ before the note is written', puts.slice(n0).some(function (p) { return p.path === 'maps/glyphs/gh.png' && p.size === RED.length; }) && glyph(await now(), 's', 's_n8') === 'glyphs/gh.png', JSON.stringify(puts.slice(n0)));
  ok('no message box, no script errors (token)', !said.length && !errs.length, said.concat(errs).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
