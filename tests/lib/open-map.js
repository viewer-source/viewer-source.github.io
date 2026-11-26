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
  await page.waitForSelector('#m2-list .m2-item.m2-on', { timeout: 30000 });
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
module.exports = { shown: shown, byAddress: byAddress, byFile: byFile, FORMAT: FORMAT };
