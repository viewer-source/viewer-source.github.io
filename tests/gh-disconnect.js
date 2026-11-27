// Disconnect from GitHub and connect again while editing a site's map (core.js askOff, disconnect, the token's Connect):
// Disconnect asks first (Cancel focused, Esc, Enter and a click beside it leave everything as it was), says it in red once
// done; moves made while disconnected are kept in the browser and saved when the token is pasted again, with no false
// "changed elsewhere" after saves made before the Disconnect; a map really changed
// elsewhere meanwhile keeps the reader's moves beside it. GitHub is played by this script. On the styles page, the
// tag map (CellDesigner).
//   node tests/gh-disconnect.js [base address] [viewer folder: its editor served in place of the page's] [clone of the data repository]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], data = process.argv[4], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
if (!data) { console.log('usage: node tests/gh-disconnect.js <base address> <viewer folder or ""> <clone of the data repository>'); process.exit(2); }
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
var P = 'maps/tag-celldesigner.xml', files = {}, errs = [];
files[P] = fs.readFileSync(path.join(data, P), 'utf8');
files['maps/tag-celldesigner.md'] = fs.readFileSync(path.join(data, 'maps/tag-celldesigner.md'), 'utf8');
var prot = function () { return (files[P].match(/<celldesigner:class>PROTEIN</g) || []).length; };
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file', sha: gitSha(files[p]) }; }));
    var c = rest.match(/^\/contents\/([^?]+)/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      if (files[p] != null && d.sha !== gitSha(files[p])) return json(409, { message: 'test: sha does not match' });
      files[p] = Buffer.from(d.content, 'base64').toString('utf8');
      return json(200, { content: { sha: gitSha(files[p]) } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]);
      if (files[p2] == null) return json(404, { message: 'Not Found' });
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: files[p2] });
      return json(200, { sha: gitSha(files[p2]), content: Buffer.from(files[p2]).toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  });
  var status = function () { return page.$eval('#m2-ed-status', function (e) { return e.textContent; }); };
  var tok = function () { return page.evaluate(function () { return localStorage.getItem('atlas-edit-token'); }); };
  var dlg = function () { return page.$('.m2-ask'); };
  var make = async function (x, y) { await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); };
  var connect = async function () { await page.fill('#m2-ed-gh-token', 'test-token'); await page.click('#m2-ed-gh-go'); await page.waitForTimeout(6000); };
  await page.goto(base + '#tag-celldesigner', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var n0 = prot();

  // 1. a save made while connected
  await make(800, 400); await page.waitForTimeout(6000);
  ok('1. connected: the protein saved to GitHub', prot() === n0 + 1, prot() + ' | ' + (await status()));

  // 2. Disconnect asks; Esc, Enter on Cancel and a click beside leave the token
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(300);
  ok('2. Disconnect opens a question, Cancel focused', !!(await dlg()) && (await page.evaluate(function () { return document.activeElement && document.activeElement.className; })) === 'm2-ask-no');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('2. Esc: closed, still connected', !(await dlg()) && (await tok()) === 'test-token');
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  ok('2. Enter (on Cancel): closed, still connected', !(await dlg()) && (await tok()) === 'test-token');
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(300); await page.mouse.click(20, 880); await page.waitForTimeout(200);
  ok('2. a click beside: closed, still connected', !(await dlg()) && (await tok()) === 'test-token');
  // the circled i: its text in a window beside the dialog, level with its card; a click anywhere closes that window
  // only, the dialog stays; with none open, a click beside closes the dialog
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(300);
  var bx = async function (sel) { return page.$eval(sel, function (e) { var r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }).catch(function () { return null; }); };
  ok('2. two cards of one height, each with a circled i', await page.evaluate(function () {
    var c = Array.prototype.map.call(document.querySelectorAll('.m2-ask-opt > button:first-child'), function (b) { return b.offsetHeight; });
    return c.length >= 1 && c.every(function (h) { return h === c[0]; }) && document.querySelectorAll('.m2-ask-opt .m2-itip').length === c.length;
  }));
  await page.click('.m2-ask-opt:last-of-type .m2-itip'); await page.waitForTimeout(200);
  var d = await bx('.m2-ask'), p = await bx('.m2-ipop'), o = await bx('.m2-ask-opt:last-of-type');
  ok('2. the circled i: its text beside the dialog, level with its card, not over it', !!(d && p && o) && p.l >= d.r && Math.abs(p.t - o.t) < 2, JSON.stringify([d, p, o]));
  await page.mouse.click(20, 880); await page.waitForTimeout(200);
  ok('2. a click beside with the text open: the text closed, the dialog kept', !(await page.$('.m2-ipop')) && !!(await dlg()));
  await page.click('.m2-ask-opt:last-of-type .m2-itip'); await page.waitForTimeout(200); await page.click('.m2-ask-opt:last-of-type .m2-itip'); await page.waitForTimeout(200);
  ok('2. the circled i again closes its text', !(await page.$('.m2-ipop')) && !!(await dlg()));
  await page.click('.m2-ask-opt:last-of-type .m2-itip'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('2. Esc with the text open: the text closed, the dialog kept', !(await page.$('.m2-ipop')) && !!(await dlg()));
  await page.mouse.click(20, 880); await page.waitForTimeout(200);
  ok('2. then a click beside closes the dialog, still connected', !(await dlg()) && (await tok()) === 'test-token');
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(300); await page.click('.m2-ask-yes'); await page.waitForTimeout(500);
  ok('2. Disconnect: token gone, said in red, the token field shown', !(await dlg()) && !(await tok()) && /Disconnected from GitHub/.test(await status()) &&
    (await page.$eval('#m2-ed-status', function (e) { return e.classList.contains('m2-ed-warn'); })) && !!(await page.$('#m2-ed-gh-token:visible')), await status());

  // 3. a move while disconnected stays in the browser; connected again it is saved, with no false clash
  await make(900, 450); await page.waitForTimeout(3000);
  ok('3. disconnected: the move not on GitHub', prot() === n0 + 1, String(prot()));
  ok('3. the red line still says it after the move', /Disconnected from GitHub/.test(await status()), await status());
  await connect();
  ok('3. connected again: no false "changed elsewhere"', !/changed elsewhere|newer than/.test(await status()), await status());
  ok('3. the move made while disconnected saved', prot() === n0 + 2, prot() + ' | ' + (await status()));
  await make(950, 500); await page.waitForTimeout(6000);
  ok('3. saving goes on after', prot() === n0 + 3, String(prot()));

  // 4. changed elsewhere while disconnected, with a move: the two joined by element (editor/src/merge.js), silently, as
  // they changed different things (a protein made here, a comment written there)
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(300); await page.click('.m2-ask-yes'); await page.waitForTimeout(500);
  await make(1000, 550); await page.waitForTimeout(2000);
  files[P] = files[P].replace('</sbml>', '</sbml>\n<!-- changed elsewhere -->');
  await connect(); await page.waitForTimeout(4000);
  var gl = await page.$eval('#m2-ed-wait', function (x) { return x.hidden ? '' : x.textContent; }).catch(function () { return null; });   // null: a page older than the line (only the editor served)
  ok('4. changed elsewhere, something else: both kept, nothing said', /<!-- changed elsewhere -->/.test(files[P]) && prot() === n0 + 4 && !gl && !/newer than|Not saved|changed elsewhere/.test(await status()), prot() + '/' + (n0 + 4) + ' comment ' + /<!-- changed elsewhere -->/.test(files[P]) + ' | ' + gl + ' | ' + (await status()));

  ok('no script errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
