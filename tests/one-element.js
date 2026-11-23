// One node or one line drawn alone (plan 3 step 5, item 6): yrender.one and cdrender.one give the drawing of one element
// by id, and it equals that element's part of the whole drawing, on every map of the test set and the demo.
//   GraphML (the demo's and the test set's yEd maps): every node and arc, yrender.one
//     with classes is its group's text in render(t, { classes, groups }), standing on lines of its own there.
//   CellDesigner (every map): every species and compartment alias, its group's pieces in the whole drawing's species
//     layer; every reaction, cdrender.one by a line's id (re|a), its halo and its lines as the whole drawing draws that
//     reaction among the others.
//   node tests/one-element.js [files or folders ...]   (default: the test set, test-maps/test-set/; maps/ for the whole demo)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), yr = require(path.join(here, 'renderers/yrender/yrender.js')), cr = require(path.join(here, 'renderers/converter/cdrender.js'));
var DP = require('@xmldom/xmldom').DOMParser;
var args = process.argv.slice(2), files = [];
(args.length ? args : ['test-maps/test-set'].map(function (p) { return path.join(here, p); })).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.(graphml|xml)$/.test(p)) files.push(p);
});
var bad = 0, nodes = 0, lines = 0, maps = 0, said = 0;
function no(tag, m) { bad++; if (said++ < 12) console.log('DIFF ' + tag + ': ' + m); }
function groupOf(list, mark) {   // the entries from mark to its closing </g>, groups inside counted
  var i = list.indexOf(mark);
  if (i < 0) return null;
  for (var k = i, depth = 0; k < list.length; k++) {
    if (/^<g data-/.test(list[k]) && !/<\/g>$/.test(list[k])) depth++;
    else if (list[k] === '</g>' && --depth === 0) return list.slice(i, k + 1);
  }
  return null;
}
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), name = path.relative(here, f);
  if (/\.xml$/.test(f)) {
    if (t.slice(0, 3000).indexOf('celldesigner') < 0) return;
    maps++;
    var D = new cr.Drawing(t, { DOMParser: DP, groups: true });
    D.compartments(); D.species(); D.texts();
    var parts = {};   // each reaction's pieces as the whole drawing draws it among the others
    var R = new DP().parseFromString(t, 'application/xml').getElementsByTagNameNS('*', 'reaction');
    Array.prototype.forEach.call(R, function (rx) {
      if (rx.parentNode.localName !== 'listOfReactions') return;
      var id = rx.getAttribute('id') || rx.getAttribute('metaid'), h0 = D.halo.length, l0 = D.lines.length;
      D.cur = id;
      var el = Array.prototype.filter.call(D.model.getElementsByTagNameNS('*', 'reaction'), function (r) { return (r.getAttribute('id') || r.getAttribute('metaid')) === id && r.parentNode.localName === 'listOfReactions'; })[0];
      try { D.reaction(el); } catch (e) { D.log(id + ': ' + e.message); }
      parts[id] = [D.halo.slice(h0), D.lines.slice(l0)];
    });
    var CE = cr.elements(t, { DOMParser: DP });
    D.alias.forEach(function (a, id) {
      nodes++;
      var o = CE.one(id);
      if (!o || JSON.stringify(o.out) !== JSON.stringify(groupOf(D.out, '<g data-n="' + id.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">'))) no(name + ' ' + id, 'not as in the whole drawing');
    });
    Object.keys(parts).forEach(function (id) {
      lines++;
      var o = CE.one(id + '|a');
      if (!o || JSON.stringify([o.halo, o.lines]) !== JSON.stringify(parts[id]) || o.out.length) no(name + ' ' + id, 'the reaction alone not as among the others');
    });
    // the whole drawing as render() gives it is these pieces in this order (so the parts above are its parts)
    var whole = cr.render(t, { DOMParser: DP, groups: true });
    if (whole.indexOf(D.out.join('\n')) < 0) no(name, 'the species layer is not the whole drawing\'s');
    Object.keys(parts).forEach(function (id) { if (parts[id][1].length && whole.indexOf(parts[id][1].join('\n')) < 0) no(name + ' ' + id, 'its lines are not in the whole drawing'); });
    return;
  }
  if (t.indexOf('graphml') < 0) return;
  maps++;
  var whole, doc;
  try { whole = yr.render(t, { DOMParser: DP, classes: true, groups: true }).svg; } catch (e) { return no(name, 'not drawn: ' + e.message); }
  doc = new DP().parseFromString(t, 'application/xml');
  var ids = function (tag) { return Array.prototype.map.call(doc.getElementsByTagNameNS('http://graphml.graphdrawing.org/xmlns', tag), function (e) { return e.getAttribute('id'); }); };
  var YE = yr.elements(t, { DOMParser: DP, classes: true });
  if (!YE) return no(name, 'not drawn');
  ids('node').forEach(function (id) {
    var o = YE.one(id);
    if (o == null) return;   // a node drawn as nothing (a group's closed realizer, a node with no geometry)
    nodes++;
    if (whole.indexOf('\n' + o + '\n') < 0) no(name + ' node ' + id, 'not its part of the whole drawing');
  });
  ids('edge').forEach(function (id) {
    var o = YE.one(id);
    if (o == null) return;
    lines++;
    if (whole.indexOf('\n' + o + '\n') < 0) no(name + ' edge ' + id, 'not its part of the whole drawing');
  });
});
console.log(maps + ' drawings, ' + nodes + ' nodes and ' + lines + ' lines drawn alone: ' + (bad ? bad + ' different' : 'each as in the whole drawing'));
process.exit(bad || !maps ? 1 : 0);
