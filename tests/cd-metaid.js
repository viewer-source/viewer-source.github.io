// A reaction with a metaid and no id (SBML requires one; ReconMap 2's re227 is such a reaction): the editor's
// CellDesigner code and cdrender read it by its metaid, so the map is drawn, placed and drawn live, never stopped.
//   node tests/cd-metaid.js [CellDesigner file]   (default: the first CellDesigner map in maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), conv = path.join(here, 'renderers/converter');
var cd = require(path.join(conv, 'cdrender.js')), ed = require(path.join(conv, 'cd_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var f = process.argv[2] || fs.readdirSync(path.join(here, 'maps')).filter(function (n) { return /\.xml$/.test(n); }).map(function (n) { return path.join(here, 'maps', n); })[0];
var t = fs.readFileSync(f, 'utf8'), m = /<reaction ([^>]*)\bid="([^"]+)"/.exec(t);
if (!m) { console.log('no reaction in ' + f); process.exit(1); }
var rid = m[2], cut = t.replace(m[0], m[0].replace(/\s\bid="[^"]+"/, ''));   // that reaction's id taken away, its metaid kept
if (!new RegExp('<reaction [^>]*metaid="' + rid + '"').test(cut)) cut = cut.replace(/<reaction (?![^>]*\bid=)/, '<reaction metaid="' + rid + '" ');
var bad = [];
try {
  var svg = cd.render(cut, { classes: true, groups: true, DOMParser: DP });
  if (svg.indexOf('data-e="' + rid + '|') < 0) bad.push('cdrender: no lines keyed ' + rid);
  if (svg.indexOf('data-e="null|') >= 0) bad.push('cdrender: lines keyed null');
  var g = ed.graphml(cut, null, opt), q = ed.draw(cut, g, Object.assign({ fit: true, block: 8 }, opt));
  if (q[1].indexOf('metaid="' + rid + '"') < 0) bad.push('cd_edit: the reaction lost its metaid');
  var lv = ed.live(cut, g, opt);
  if (!lv) bad.push('cd_edit: live not made');
} catch (e) { bad.push(e.stack.split('\n').slice(0, 3).join(' ')); }
console.log(path.basename(f) + ', reaction ' + rid + ' with a metaid only: ' + (bad.length ? bad.join('; ') : 'drawn, placed and drawn live'));
process.exit(bad.length ? 1 : 0);
