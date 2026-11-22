// Hostile files: the page keeps a write token and draws maps from anywhere, so a map's text must never run as code. A
// GraphML, a CellDesigner and an SBGN-ML map (made from small maps of the check files) carry markup and script in their
// labels, colours, font, notes and file names; each is added from the list (no token), shown, opened in the editor
// and a node of it selected (a file the editor cannot read is refused, said in red). Checked after every step: no payload ran (window.__pwned), no element anywhere in the
// page carries a payload's event handler or script, the list shows the name as text.
// Measured at the same time: what the page needs to run under a Content-Security-Policy. The page is served with a
// strict policy as Report-Only (nothing blocked), every violation is collected, and the policy the page would need
// is printed with the counts behind each source. Printed, not checked.
//   node tests/hostile-files.js [base address] [viewer folder: its renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var checks = path.join(__dirname, '..', '..', 'notes', 'check-files');
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

var LABEL = '<img src=x onerror="window.__pwned=\'label\'"><script>window.__pwned=\'label-script\'</script>"\'&';
var COLOUR = '#ff0000" onload="window.__pwned=\'colour\'';
var FONT = 'Dialog" onload="window.__pwned=\'font\'';
var ID = 'x" onmouseover="window.__pwned=\'id\'';
var NAME = '<img src=x onerror="window.__pwned=\'name\'">';
var NOTES = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title/></head><body><script>window.__pwned=\'notes\'</script>' +
  '<img src="x" onerror="window.__pwned=\'notes-img\'"/></body></html>';

function graphml() {
  var t = fs.readFileSync(path.join(checks, 'glycolysis-graphml-edited-v01.graphml'), 'utf8'), n = 0;
  t = t.replace(/(<y:NodeLabel[^>]*>)cAMP/, function (a, b) { n++; return b + esc(LABEL); });
  t = t.replace(/<y:Fill color="#DBEBDB"/, function () { n++; return '<y:Fill color="' + esc(COLOUR) + '"'; });
  t = t.replace(/fontFamily="Dialog"/, function () { n++; return 'fontFamily="' + esc(FONT) + '"'; });
  t = t.replace(/(id|source|target)="n0"/g, function (a, k) { n++; return k + '="' + esc(ID) + '"'; });
  if (n < 5) throw new Error('GraphML: ' + n + ' payloads placed');
  return t;
}
function celldesigner(ids) {
  var t = fs.readFileSync(path.join(checks, 'or-gate-one-input-v01.xml'), 'utf8'), n = 0;
  t = t.replace(/name="S1"/, function () { n++; return 'name="' + esc(LABEL) + '"'; });
  t = t.replace(/<celldesigner:paint color="ffccffcc"/, function () { n++; return '<celldesigner:paint color="' + esc(COLOUR) + '"'; });
  t = t.replace(/(<species [^>]*name="[^"]*"[^>]*>)/, function (a) { n++; return a + '<notes>' + NOTES + '</notes>'; });
  if (ids) t = t.replace(/"re1"/g, function () { n++; return '"' + esc(ID) + '"'; });
  if (n < (ids ? 5 : 3)) throw new Error('CellDesigner: ' + n + ' payloads placed');
  return t;
}
function sbgnml() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="viewer-new-map" language="process description">\n' +
    '    <extension>\n      <renderInformation xmlns="http://www.sbml.org/sbml/level3/version1/render/version1" id="renderInformation">\n' +
    '        <listOfColorDefinitions>\n          <colorDefinition id="color_e1" value="#000000"/>\n          <colorDefinition id="color_e2" value="' + esc(COLOUR) + '"/>\n        </listOfColorDefinitions>\n' +
    '        <listOfStyles>\n          <style id="style_e1" idList="g1"><g stroke="color_e1" stroke-width="1" fill="color_e2" font-family="' + esc(FONT) + '"/></style>\n        </listOfStyles>\n' +
    '      </renderInformation>\n    </extension>\n' +
    '    <glyph id="g1" class="macromolecule"><label text="' + esc(LABEL) + '"/><bbox x="100" y="100" w="80" h="40"/></glyph>\n' +
    '    <glyph id="g2" class="simple chemical"><label text="ATP"/><bbox x="260" y="100" w="40" h="40"/></glyph>\n' +
    '  </map>\n</sbgn>\n';
}

(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], said = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) await page.route(/\/renderers\/(converter|yrender)\/[a-z_]+\.js/, function (r) { var f = /\/renderers\/(converter|yrender)\/([a-z_]+\.js)/.exec(r.request().url()); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers', f[1], f[2]), 'utf8') }); });
  page.on('dialog', function (d) { said.push(d.message()); d.accept().catch(function () {}); });
  var POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'";
  await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
    var res = await r.fetch();
    r.fulfill({ response: res, headers: Object.assign({}, res.headers(), { 'content-security-policy-report-only': POLICY }) });
  });
  await page.addInitScript(function () {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', function (e) {
      window.__csp.push({ d: e.effectiveDirective, u: e.blockedURI, s: (e.sample || '').slice(0, 60), f: (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber });
    });
  });
  var harmless = async function (when) {
    var r = await page.evaluate(function () {
      var hits = [];
      document.querySelectorAll('*').forEach(function (el) {
        for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (/^on/i.test(a.name) && /__pwned/.test(a.value)) hits.push(el.tagName + ' ' + a.name); }
        if (el.tagName.toLowerCase() === 'script' && /__pwned/.test(el.textContent)) hits.push('script');
      });
      return { ran: window.__pwned || null, hits: hits };
    });
    ok(when + ': nothing ran', !r.ran && !said.length, r.ran ? 'ran: ' + r.ran : said.join(' | '));
    ok(when + ': no live handler or script in the page', !r.hits.length, r.hits.slice(0, 4).join(', '));
  };
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  var files = [['GraphML', NAME + '.graphml', graphml()], ['CellDesigner', NAME + ' cd.xml', celldesigner()], ['CellDesigner, a quote in an id', NAME + ' id.xml', celldesigner(true)], ['SBGN-ML', NAME + ' sb.sbgn', sbgnml()]];
  for (var f of files) {
    console.log('-- ' + f[0]);
    await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
    var chooser = page.waitForEvent('filechooser');
    await page.click('.m2-cx button:text-is("Add map from file")');
    await (await chooser).setFiles([{ name: f[1], mimeType: 'text/xml', buffer: Buffer.from(f[2]) }]);
    await page.waitForTimeout(6000);
    var shown = await page.$$eval('#m2-list .m2-map .m2-name', function (l, n) { return l.some(function (x) { return x.textContent === n; }); }, f[1].replace(/\.[^.]+$/, ''));
    ok('added and listed with its name as text', shown);
    await harmless('added and shown');
    if (!(await page.$('.m2-ri[data-win="edit"]:visible'))) { ok('the Edit tab offered', false); continue; }
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }).catch(function () {});
    await page.waitForTimeout(2500);
    var hasMap = await page.evaluate(function () { return !!window.m2EditNow(); });
    var st = hasMap ? '' : await page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; });
    ok('opened in the editor, or refused and said', hasMap || /Cannot edit/.test(st), st);   // an id holding a quote is no SBML id: refusing it is fine
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 10 && r.left > 300 && r.top > 80 && r.right < 1380 && r.bottom < 880) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    if (c) { await page.mouse.click(c[0], c[1]); await page.waitForTimeout(800); }
    await harmless('edited, a node selected');
    await page.keyboard.press('Escape');
    await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  }
  ok('no script error', !errs.length, errs.slice(0, 3).join(' | '));

  // the policy the page needs: each directive with the sources its violations ask for
  var v = await page.evaluate(function () { return window.__csp; }), need = {};
  v.forEach(function (x) {
    var src = x.u === 'inline' ? "'unsafe-inline'" : x.u === 'eval' ? "'unsafe-eval'" : /^(data|blob):?$/.test(x.u) ? x.u.replace(/:?$/, ':') : (function () { try { return new URL(x.u).origin; } catch (e) { return x.u; } })();
    var k = x.d + ' ' + src; need[k] = need[k] || { n: 0, at: x.f, s: x.s }; need[k].n++;
  });
  console.log('-- Content-Security-Policy, strict, Report-Only: ' + v.length + ' violations');
  Object.keys(need).sort().forEach(function (k) { console.log('need  ' + k + '  ' + need[k].n + ' times, first at ' + need[k].at + (need[k].s ? '  "' + need[k].s + '"' : '')); });
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
