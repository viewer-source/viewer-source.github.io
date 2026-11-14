// cd_edit's process square against cdrender's: the editor places a CellDesigner reaction's square (its GraphML node, the
// frame its modifiers and links are written in) where the drawing puts it (the click data's at). Both place it from the
// main line's ends cut at the shape alone, before the visual ends are cut at state variables and units of information
// (2026-11-14: the editor took the visual ends and its square moved by up to 4 px on 53 reactions).
//   node tests/cd-square.js [CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var ed = require(path.join(here, 'renderers/converter/cd_edit.js')), cdr = require(path.join(here, 'renderers/converter/cdrender.js'));
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p)) { var t = fs.readFileSync(p, 'utf8').slice(0, 3000); if (/<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0) files.push(p); }
});
var SB = 'http://www.sbml.org/sbml/level2/version4', tot = 0, bad = 0;
files.forEach(function (f) {
  var text = fs.readFileSync(f, 'utf8'), hits = cdr.renderHits(text, { DOMParser: DP })[1].reactions, d = ed.drawing(text);
  Array.prototype.slice.call(d.model.getElementsByTagNameNS('*', 'reaction')).forEach(function (rx) {
    var r; try { r = ed.lines(d, rx); } catch (e) { return; }
    var h = hits[rx.getAttribute('id')];
    if (!r || !r.glyph || !h || !h.at) return;
    tot++;
    if (Math.abs(Math.round(r.sq[0] * 10) / 10 - h.at[0]) > 0.11 || Math.abs(Math.round(r.sq[1] * 10) / 10 - h.at[1]) > 0.11) {
      if (++bad <= 8) console.log(path.relative(here, f), rx.getAttribute('id'), r.sq, h.at);
    }
  });
});
console.log(files.length + ' maps, ' + tot + ' reactions with a square: ' + (tot - bad) + ' placed the same by the editor and the drawing, ' + bad + ' not');
process.exit(bad ? 1 : 0);
