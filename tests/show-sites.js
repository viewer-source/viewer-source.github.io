// Show sites (Settings, Display; notes/hidden-sites.md): a state variable drawn with its value alone (P, not P@S139)
// and a CellDesigner residue's name left out, unless the tick box is ticked; the sites kept in the files. Tests from
// the design: each format unticked and ticked (the text drawn, the circle's width), the tick kept over a reload, undo and
// redo of the setting, the editor's drawing following it at once while editing goes on, the field showing the whole
// text, a move keeping every variable and residue name byte for byte, the SVG download as on screen.
//   node tests/show-sites.js [base address]   (default: the styles page, where the Edit tab is)
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var SB = 'external-newt-unstable-atm-mediated-phosphorylation-of-repair-proteins-nwt', CD = 'sites-ifng-stat1-2023-celldesigner';
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }), page = await ctx.newPage();
  var errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { d.accept().catch(function () {}); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var settle = async function () { await page.waitForSelector('.m2-ri[data-win="set"]', { timeout: 30000 }); await page.waitForTimeout(2500); };
  var ticked = function () { return page.$eval('#m2-set-sites', function (x) { return x.checked; }); };
  var openSet = async function () { await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(700); };
  // the picture on screen as text: an image's file (a blob when the viewer put the setting into it), or the editor's drawing
  var picText = function () {
    return page.evaluate(function () {
      var im = document.getElementById('m2-img');
      if (!im) return null;
      if (im.namespaceURI === 'http://www.w3.org/2000/svg') return im.outerHTML;
      return fetch(im.currentSrc || im.src).then(function (r) { return r.text(); });
    });
  };
  // what an image shows: drawn into an off-screen page, the shown site texts and the shown value circles' widths
  var seen = async function (t) {
    var p2 = await ctx.newPage();
    await p2.setContent('<body style="margin:0">' + t.replace(/^<\?xml[^>]*>/, '') + '</body>');
    var r = await p2.evaluate(function () {
      var vis = function (e) { for (; e && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; };
      var texts = [].slice.call(document.querySelectorAll('text')).filter(vis).map(function (e) { return e.textContent; });
      return { at: texts.filter(function (s) { return /@/.test(s); }).length, sites: [].slice.call(document.querySelectorAll('.sv-site')).filter(vis).length,
        values: [].slice.call(document.querySelectorAll('.sv-value')).filter(vis).length, texts: texts };
    });
    await p2.close();
    return r;
  };

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });

  console.log('-- SBGN-ML map (Newt), view mode');
  await page.goto(base + '#' + SB, { waitUntil: 'load' }); await settle();
  await openSet();
  ok('Settings: Display, Show sites, unticked by default', await page.$eval('#m2-set-sites', function (x) { return !!x.offsetParent; }) && !(await ticked()));
  ok('its circled i says what it does', /only the value \(P\)/.test(await page.$eval('.m2-set-disp .m2-itip', function (x) { return x.getAttribute('data-info'); })));
  var t0 = await picText(), s0 = await seen(t0);
  ok('unticked: no text with a site drawn', s0.at === 0 && s0.values > 0, s0.values + ' values, ' + s0.at + ' with @');
  ok('unticked: P drawn where P@S139 is', s0.texts.indexOf('P') >= 0 && s0.texts.indexOf('P@S139') < 0);
  await page.click('#m2-set-sites'); await page.waitForTimeout(2500);
  var t1 = await picText(), s1 = await seen(t1);
  ok('ticked: kept in the browser', (await page.evaluate(function () { return localStorage.getItem('atlas-show-sites'); })) === 'on');
  ok('ticked: the sites drawn, the value-only circles hidden', s1.at > 0 && s1.values === 0 && s1.texts.indexOf('P@S139') >= 0, s1.at + ' with @');
  var widths = ['sv-site', 'sv-value'].map(function (cls) {   // the first circle's width in a group of that class, from its path
    var d = t0.match(new RegExp('<g class="' + cls + '"[^>]*><path d="([^"]*)"'))[1], xs = d.match(/-?[\d.]+ -?[\d.]+/g).map(function (q) { return +q.split(' ')[0]; });
    return Math.max.apply(null, xs) - Math.min.apply(null, xs);
  });
  ok('the value alone in a narrower circle than value@site', widths[1] < widths[0], widths.map(Math.round).join(' < '));
  await page.reload({ waitUntil: 'load' }); await settle(); await openSet();
  ok('a reload keeps it ticked', await ticked());
  var dl = page.waitForEvent('download', { timeout: 15000 }).catch(function () { return null; });
  await page.evaluate(function () { var a = [].slice.call(document.querySelectorAll('a,button')).filter(function (x) { return /^\s*SVG\s*$/.test(x.textContent) && x.offsetParent; })[0]; if (a) a.click(); });
  var d = await dl, dt = d ? require('fs').readFileSync(await d.path(), 'utf8') : '';
  ok('Download SVG as on screen: the sites shown', d && /class="m2-pic m2-sv"/.test(dt) && (await seen(dt)).at > 0, d ? '' : 'no download');

  console.log('-- undo and redo of the setting');
  await page.click('#m2-set-sites'); await page.waitForTimeout(1500);
  ok('unticked again', !(await ticked()) && (await seen(await picText())).at === 0);
  await page.keyboard.press('Control+KeyZ'); await page.waitForTimeout(1500);
  ok('Cmd+Z: ticked, sites drawn', (await ticked()) && (await seen(await picText())).at > 0);
  await page.keyboard.press('Control+Shift+KeyZ'); await page.waitForTimeout(1500);
  ok('Cmd+Shift+Z: unticked, sites hidden', !(await ticked()) && (await seen(await picText())).at === 0);

  console.log('-- CellDesigner map, view mode');
  await page.goto(base + '#' + CD, { waitUntil: 'load' }); await settle(); await openSet();
  var c0 = await seen(await picText());
  ok('unticked: no residue name drawn', c0.sites === 0 && c0.texts.indexOf('Y701') < 0);
  await page.click('#m2-set-sites'); await page.waitForTimeout(2500);
  var c1 = await seen(await picText());
  ok('ticked: residue names drawn', c1.sites > 0 && c1.texts.indexOf('Y701') >= 0, c1.sites + ' names');

  console.log('-- while editing (CellDesigner)');
  await page.evaluate(function () { localStorage.setItem('atlas-edit-side', 'right'); localStorage.setItem('atlas-edit-level', 'full'); });
  await page.goto(base + '#' + CD, { waitUntil: 'load' }); await settle();
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(2500);
  var shownNames = function () { return page.$$eval('#m2-img .sv-site', function (l) { return l.filter(function (e) { return getComputedStyle(e).display !== 'none'; }).length; }); };
  ok('the editor\'s drawing: residue names shown (ticked)', (await shownNames()) > 0);
  var names = function (t) { return (t.match(/<celldesigner:modificationResidue\b[^>]*>/g) || []).join('\n'); };
  var f0 = await page.evaluate(function () { return window.m2EditNow().text; });
  await openSet(); await page.click('#m2-set-sites'); await page.waitForTimeout(800);
  var editing = await page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing') && !!window.m2EditNow(); });
  ok('unticked while editing: names hidden at once, editing goes on', (await shownNames()) === 0 && editing);
  await page.keyboard.press('Control+KeyZ'); await page.waitForTimeout(800);
  ok('Cmd+Z while editing: names shown again', (await shownNames()) > 0 && (await ticked()));
  var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 40 && r.width < 200 && r.left > 300 && r.top > 120 && r.right < 1000 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
  if (c) {
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400);
    for (var i = 0; i < 3; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(150); }
    await page.waitForTimeout(2500);
  }
  var f1 = await page.evaluate(function () { return window.m2EditNow().text; });
  ok('a move: the file changed, every residue and its name kept byte for byte', c && f1 !== f0 && names(f1) === names(f0) && names(f0).length > 0);

  console.log('-- while editing (SBGN-ML)');
  await page.goto(base + '#' + SB, { waitUntil: 'load' }); await settle();
  if (await page.evaluate(function () { return !document.querySelector('.m2').classList.contains('m2-editing'); })) await page.click('.m2-ri[data-win="edit"]');
  var started = await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }).then(function () { return true; }, function () { return false; });
  if (!started) console.log('-     this map is not edited on this page');
  else {
    await page.waitForTimeout(2500);
    var shown = function () { return page.evaluate(function () { var im = document.getElementById('m2-img'); return [].slice.call(im.querySelectorAll('text')).filter(function (e) { return e.getClientRects().length; }).map(function (e) { return e.textContent; }); }); };
    ok('ticked: P@S139 in the editor\'s drawing', (await shown()).indexOf('P@S139') >= 0);
    await openSet(); await page.click('#m2-set-sites'); await page.waitForTimeout(800);
    var sh = await shown();
    ok('unticked: P alone, editing goes on', sh.indexOf('P@S139') < 0 && sh.indexOf('P') >= 0 && !!(await page.evaluate(function () { return window.m2EditNow(); })));
    var st = function (t) { return (t.match(/<state\b[^>]*>/g) || []).join('\n'); };
    var fb = await page.evaluate(function () { return window.m2EditNow().text; });
    ok('the file keeps every site', /variable="S139"/.test(fb));
    // the field: the state variable's own text, the site with it
    var at = await page.evaluate(function () {
      var g = [].slice.call(document.querySelectorAll('#m2-img .sv-value')).filter(function (e) { return e.getClientRects().length; })[0];
      if (!g) return null; var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
    });
    if (at) {
      await page.mouse.dblclick(at[0], at[1]); await page.waitForTimeout(800);
      var v = await page.evaluate(function () { var f = document.activeElement; return f && /INPUT|TEXTAREA/.test(f.tagName) ? f.value : f && f.isContentEditable ? f.textContent : null; });
      ok('the field shows the whole text with its site', !!v && /@/.test(v), String(v));
      await page.keyboard.press('Escape');
    } else ok('a state variable shown', false);
    var f2 = await page.evaluate(function () { return window.m2EditNow().text; });
    ok('after the field: every state kept byte for byte', st(f2) === st(fb));
  }

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
