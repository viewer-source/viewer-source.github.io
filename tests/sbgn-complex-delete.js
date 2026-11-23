// A complex with members deleted on an SBGN-ML map with them and every line at them: by the Delete key and the menu's
// Delete, one undo step each; Cmd+A then Delete leaves no complex, compartments with contents stay. Nothing is saved.
//   node tests/sbgn-complex-delete.js [address] [--local: the working tree's editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), local = process.argv.indexOf('--local') > 0, base = process.argv[2] && process.argv[2] !== '--local' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var ed = local ? require('./editor-now.js')(here) : null;
(async () => {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', e => errs.push(e.message));
  if (local) await page.route('**/editor/editor.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }));
  if (local) await page.route('**/renderers/converter/*.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }));
  var ok = (w, v, m) => { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + w + (m ? '  ' + m : '')); };
  var sbgn = () => page.evaluate(() => { var n = window.m2EditNow && window.m2EditNow(); return n ? n.text : ''; });
  var glyphs = t => (t.match(/<glyph /g) || []).length, arcs = t => (t.match(/<arc /g) || []).length;
  var MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.goto(base + '#glycogen-muscle-sbgn', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  await page.keyboard.press('e'); await page.waitForSelector('#m2-editwin button[data-make="macromolecule"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  // a complex with members, and a point inside it off its members
  var spot = await page.evaluate(() => {
    var gs = [...document.querySelectorAll('#m2-img [data-n]')], byId = {};
    gs.forEach(g => { (byId[g.getAttribute('data-n')] = byId[g.getAttribute('data-n')] || []).push(g.getBoundingClientRect()); });
    var t = window.m2EditNow().text, d = new DOMParser().parseFromString(t, 'application/xml');
    var cx = [...d.getElementsByTagName('glyph')].filter(g => g.getAttribute('class') === 'complex' && g.getElementsByTagName('glyph').length >= 2);
    for (var c of cx) {
      var id = c.getAttribute('id'), r = (byId[id] || [])[0]; if (!r || r.width < 30) continue;
      var kids = [...c.getElementsByTagName('glyph')].map(k => k.getAttribute('id')).filter(k => byId[k]).map(k => byId[k][0]);
      for (var y = r.top + 3; y < r.bottom - 3; y += 2) for (var x = r.left + 3; x < r.right - 3; x += 2) {
        if (x < 330 || y < 60 || x > 1390 || y > 890) continue;
        if (!kids.some(k => x >= k.left - 2 && x <= k.right + 2 && y >= k.top - 2 && y <= k.bottom + 2)) return { id: id, x: x, y: y, members: c.getElementsByTagName('glyph').length };
      }
    }
    return null;
  });
  ok('a complex with members found', !!spot, JSON.stringify(spot));
  if (!spot) { await b.close(); process.exit(1); }
  var t0 = await sbgn(), g0 = glyphs(t0), a0 = arcs(t0);
  await page.mouse.click(spot.x, spot.y); await page.waitForTimeout(400);
  await page.keyboard.press('Delete'); await page.waitForTimeout(3000);
  var t1 = await sbgn();
  ok('Delete key: the complex and its members gone', t1.indexOf('id="' + spot.id + '"') < 0 && glyphs(t1) <= g0 - 1 - spot.members, g0 + ' -> ' + glyphs(t1) + ' glyphs, ' + a0 + ' -> ' + arcs(t1) + ' arcs');
  var ends = await page.evaluate(t => { var d = new DOMParser().parseFromString(t, 'application/xml'), ids = new Set([...d.querySelectorAll('[id]')].map(e => e.getAttribute('id'))); return [...d.getElementsByTagName('arc')].filter(a => !ids.has(a.getAttribute('source')) || !ids.has(a.getAttribute('target'))).length; }, t1);
  ok('no line left pointing at a deleted glyph', ends === 0, String(ends));
  await page.keyboard.press(MOD + '+z'); await page.waitForTimeout(3000);
  ok('one undo brings all back', (await sbgn()) === t0);
  // the menu's Delete
  await page.mouse.click(spot.x, spot.y, { button: 'right' }); await page.waitForTimeout(400);
  var items = await page.$$eval('.m2-cx button', l => l.map(x => x.textContent.trim()));
  ok('the menu over the complex has Delete', items.some(x => /^Delete/.test(x)), items.join(' / '));
  await page.click('.m2-cx button:has-text("Delete")'); await page.waitForTimeout(3000);
  ok('the menu Delete: the same', (await sbgn()) === t1);
  await page.keyboard.press(MOD + '+z'); await page.waitForTimeout(3000);
  ok('undone', (await sbgn()) === t0);
  // Cmd+A, Delete: no complex left
  await page.keyboard.press('Escape'); await page.keyboard.press(MOD + '+a'); await page.waitForTimeout(300); await page.keyboard.press('Delete'); await page.waitForTimeout(3000);
  var left = await page.evaluate(t => [...new DOMParser().parseFromString(t, 'application/xml').getElementsByTagName('glyph')].filter(g => g.parentNode.localName === 'map').map(g => g.getAttribute('class')), await sbgn());
  ok('Cmd+A, Delete: no complex left (compartments with contents stay)', !left.includes('complex'), left.join(','));
  await page.keyboard.press(MOD + '+z'); await page.waitForTimeout(3000);
  ok('undone', (await sbgn()) === t0);
  ok('no script error', !errs.length, errs.join(' | '));
  await page.evaluate(() => indexedDB.deleteDatabase('atlas-edit-drafts'));
  console.log(bad ? bad + ' wrong' : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();
