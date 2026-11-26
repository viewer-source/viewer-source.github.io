// Opening a map in a browser test so the test knows what it is looking at: a site map by its address, checked against
// the map the list shows as chosen (an address of a map no longer listed opens another map, which would otherwise be
// tested under the wrong name), or a file from the test set added by Add map from file, as a person outside adds one.
// The format is read from the map shown (its extension in the list), never from the address.
var path = require('path'), fs = require('fs'), os = require('os');
var FORMAT = { '.xml': 'CellDesigner', '.sbgn': 'SBGN-ML', '.graphml': 'GraphML' };
// the map the list shows as chosen: { id, name, ext, format }
async function shown(page) {
  return page.evaluate(function () {
    var e = document.querySelector('#m2-list .m2-item.m2-on'); if (!e) return null;
    var fx = e.querySelector('.m2-fx'), nm = e.querySelector('.m2-name');
    return { id: e.getAttribute('data-id'), name: nm ? nm.textContent : e.textContent, ext: fx ? fx.textContent.trim() : '' };
  }).then(function (s) { if (s) s.format = FORMAT[s.ext] || null; return s; });
}
// a site map by its address; throws when the list shows another map
async function byAddress(page, base, id) {
  await page.goto(base + '#' + id, { waitUntil: 'load' });
  await page.waitForSelector('#m2-list .m2-item.m2-on', { state: 'attached', timeout: 30000 });   // the list may be behind the Edit window
  var s = await shown(page);
  if (!s || s.id !== id) throw new Error('asked for the map ' + id + ', the list shows ' + (s ? s.id + ' (' + s.name + s.ext + ')' : 'none') + ': not listed any more?');
  return s;
}
// a file added by Add map from file (no token: kept in this browser); throws when it is not added and shown
async function byFile(page, base, file) {
  if (!fs.existsSync(file)) throw new Error('no file ' + file + ' (the data repository cloned beside this one?)');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-map-')), copy = path.join(dir, path.basename(file));
  fs.copyFileSync(file, copy);
  if (page.url().split('#')[0] !== base.split('#')[0]) await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('input[type=file][accept*=".sbgn"]', { state: 'attached', timeout: 30000 });
  await page.setInputFiles('input[type=file][accept*=".sbgn"]', copy);
  await page.waitForFunction(function (n) {
    var e = document.querySelector('#m2-list .m2-item.m2-on .m2-name');
    return location.hash.indexOf('#mine') === 0 && e && e.textContent === n;
  }, path.basename(file).replace(/\.[^.]+$/, ''), { timeout: 60000 });
  return shown(page);
}
// maps the tests use that live in the test set, not on the site, so deleting a map from the site's list never touches a
// test: a test asks for one by this name, and resolve() adds the file once per browser and gives the address it got
var TESTSET = { 'testing-glycolysis-sbgn': 'test-maps/test-set/maps/testing-glycolysis-sbgn.sbgn' };
function dataDir() {   // --data=<clone of the site's data repository> on the test's command line
  var a = process.argv.filter(function (x) { return /^--data=/.test(x); })[0];
  if (!a) throw new Error('give --data=<clone of the site\'s data repository> (its test set)');
  return a.slice(7);
}
var added = new WeakMap();   // browser context -> { name: address }
// the address to use for a map: a site map's own, or for a test-set name the address of its copy in this browser
async function resolve(page, base, ref) {
  if (!TESTSET[ref]) return ref;
  var ctx = page.context(), got = added.get(ctx) || {};
  if (got[ref]) {
    var gone = await page.evaluate(function (id) {   // a list in sight without it (the browser's storage cleared): added again
      return !!document.querySelector('#m2-list .m2-map') && !document.querySelector('#m2-list .m2-map[data-id="' + id + '"]'); }, got[ref]).catch(function () { return false; });
    if (!gone) return got[ref];
  }
  var s = await byFile(page, base, path.join(dataDir(), TESTSET[ref]));
  got[ref] = s.id; added.set(ctx, got);
  return s.id;
}
// open a map by a site address or a test-set name; throws when the list shows another map
async function open(page, base, ref) { return byAddress(page, base, await resolve(page, base, ref)); }
module.exports = { shown: shown, byAddress: byAddress, byFile: byFile, resolve: resolve, open: open, TESTSET: TESTSET, FORMAT: FORMAT };
