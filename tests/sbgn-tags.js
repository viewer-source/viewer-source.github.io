// Tags and submap terminals in sbgn_edit.js against the converter (renderers/converter/mapconv, Python), on a small
// Process Description map with a submap, two terminals and a tag (made here), and on the given SBGN-ML maps: a free tag
// made pointing up, a terminal made on a submap's border, an existing tag turned left, a terminal slid along its side,
// a tag's name changed, a line drawn from an entity to the new tag; then s2 = write(s, g2). Checks:
//   1. the converter's GraphML of s2 is drawn by yrender exactly as g2, and graphml(s2, conv(s)) too;
//   2. write(s2, conv(s2)) is s2; s2 holds the tag (class tag, orientation up), the terminal inside its submap
//      (orientation by its side), the turned tag's orientation left, and an equivalence arc from the entity to the tag.
//   node tests/sbgn-tags.js [python] [SBGN-ML files ...]
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var X = require('@xmldom/xmldom'), DP = X.DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), py = args[0] && !/\.(sbgn|nwt)$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-tags-'));
var SMALL = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="m" language="process description">\n' +
  '    <glyph class="macromolecule" id="ras">\n      <label text="RAS"/>\n      <bbox x="40" y="100" w="80" h="40"/>\n    </glyph>\n' +
  '    <glyph class="macromolecule" id="erk">\n      <label text="ERK"/>\n      <bbox x="420" y="100" w="80" h="40"/>\n    </glyph>\n' +
  '    <glyph class="submap" id="sm">\n      <label text="MAPK cascade"/>\n      <bbox x="180" y="60" w="180" h="120"/>\n' +
  '      <glyph class="terminal" id="t1" orientation="left">\n        <label text="RAS"/>\n        <bbox x="180" y="105" w="50" h="30"/>\n      </glyph>\n' +
  '      <glyph class="terminal" id="t2" orientation="right">\n        <label text="ERK"/>\n        <bbox x="310" y="105" w="50" h="30"/>\n      </glyph>\n    </glyph>\n' +
  '    <glyph class="tag" id="tg" orientation="horizontal">\n      <label text="ERK"/>\n      <bbox x="435" y="200" w="50" h="30"/>\n    </glyph>\n' +
  '    <arc class="equivalence arc" id="e1" source="ras" target="t1">\n      <start x="120" y="120"/>\n      <end x="180" y="120"/>\n    </arc>\n' +
  '    <arc class="equivalence arc" id="e2" source="erk" target="t2">\n      <start x="420" y="120"/>\n      <end x="360" y="120"/>\n    </arc>\n' +
  '    <arc class="equivalence arc" id="e3" source="erk" target="tg">\n      <start x="460" y="140"/>\n      <end x="460" y="200"/>\n    </arc>\n  </map>\n</sbgn>\n';
var small = path.join(tmp, 'small.sbgn');
fs.writeFileSync(small, SMALL);
var files = [small].concat(args);
var DRIVER = [
  'import sys, json, contextlib, io',
  'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report',
  'out = []',
  'for f in json.load(sys.stdin):',
  '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))',
  '    except Exception as e: out.append(None)',
  'json.dump(out, sys.stdout)'].join('\n');
function conv(paths) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(paths), maxBuffer: 1 << 30 }).toString()); }
function draw(g) { return yr.render(g, { DOMParser: DP }).svg; }
function d3(svg) { return svg.replace(/-?\d+\.\d+/g, function (v) { return String(Math.round(parseFloat(v) * 1000) / 1000); }); }
function doc(s) { return new DP().parseFromString(s.replace(/^﻿/, ''), 'application/xml'); }
function glyphs(s) {   // of the first map (the converter reads that one)
  var m = doc(s).getElementsByTagNameNS('*', 'map')[0];
  return Array.prototype.map.call(m.getElementsByTagNameNS('*', 'glyph'), function (g) {
    var b = Array.prototype.filter.call(g.childNodes, function (c) { return c.localName === 'bbox'; })[0], l = Array.prototype.filter.call(g.childNodes, function (c) { return c.localName === 'label'; })[0];
    return { el: g, id: g.getAttribute('id'), cls: g.getAttribute('class'), way: g.getAttribute('orientation'), up: g.parentNode.getAttribute && g.parentNode.getAttribute('id'),
             label: l ? l.getAttribute('text') : '', box: b ? ['x', 'y', 'w', 'h'].map(function (k) { return parseFloat(b.getAttribute(k)); }) : null };
  });
}
function arcs(s) { return Array.prototype.map.call(doc(s).getElementsByTagNameNS('*', 'arc'), function (a) { return { id: a.getAttribute('id'), cls: a.getAttribute('class'), s: a.getAttribute('source'), t: a.getAttribute('target') }; }); }
function firstDiff(a, b) {   // where two drawings part: the element each has there
  a = a.split(/(?=<)/); b = b.split(/(?=<)/);
  for (var i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return ' (' + (a[i] || '').slice(0, 160) + ' | ' + (b[i] || '').slice(0, 160) + ')';
  return '';
}
var bases = conv(files), bad = 0, ran = 0;
files.forEach(function (f, i) {
  var g = bases[i], name = f === small ? 'the small map' : path.basename(f), why = [];
  if (!g) { console.log('NO BASE ' + name); bad++; return; }
  var s = fs.readFileSync(f, 'utf8'), all = glyphs(s), g2 = g;
  var sub = all.filter(function (q) { return q.cls === 'submap' && q.box; })[0], tag = all.filter(function (q) { return q.cls === 'tag'; })[0];
  var term = all.filter(function (q) { return q.cls === 'terminal' && q.box; })[0], ent = all.filter(function (q) { return q.cls === 'macromolecule' && q.box; })[0];
  var right = Math.max.apply(null, all.filter(function (q) { return q.box; }).map(function (q) { return q.box[0] + q.box[2]; }));
  var D = se.defaults(s, opt, 'tag');   // the map's font and fill, as the palette makes it
  g2 = se.add(g2, { id: 'tagA', cls: 'tag', label: 'Out', box: [right + 100, 50, 40, 60], way: 'up', font: D.font, fill: D.fill }, opt);   // a free tag pointing up
  if (sub) {   // a terminal on the submap's bottom side, pointing down
    var B = sub.box;
    g2 = se.add(g2, { id: 'termA', cls: 'tag', label: 'In', box: [B[0] + B[2] / 2 - 20, B[1] + B[3] - 60, 40, 60], way: 'down', font: D.font, fill: D.fill }, opt);
    g2 = se.terminal(g2, 'termA', true, opt);
  }
  if (tag) g2 = se.way(g2, tag.id, 'left', opt), g2 = se.label(g2, tag.id, 'Renamed tag', opt);
  if (term) {   // slid along its side by 10
    var tb = term.box, onSide = tb[0] <= sub.box[0] + 1 || tb[0] + tb[2] >= sub.box[0] + sub.box[2] - 1;
    g2 = se.resize(g2, term.id, onSide ? [tb[0], tb[1] + 10, tb[2], tb[3]] : [tb[0] + 10, tb[1], tb[2], tb[3]], opt);
  }
  if (ent) g2 = se.connect(g2, 'eqA', ent.id, 'tagA', 'equivalence arc', opt);
  // a submap made here with a terminal on it, filled (written with the submap, its look in the file's styles)
  g2 = se.add(g2, { id: 'subN', cls: 'submap', label: 'New', box: [right + 200, 300, 240, 160], font: D.font }, opt);
  g2 = se.add(g2, { id: 'termN', cls: 'tag', label: 'T', box: [right + 200, 360, 60, 30], way: 'left', font: D.font, fill: '#FFCC00' }, opt);
  g2 = se.terminal(g2, 'termN', true, opt);
  var s2;
  try { s2 = se.write(s, g2, opt); } catch (e) { console.log('FAILED ' + name + ': ' + e.message); bad++; return; }
  var f2 = path.join(tmp, 'w' + i + '.sbgn');
  fs.writeFileSync(f2, s2);
  var c2 = conv([f2])[0];
  if (!c2) { console.log('FAILED ' + name + ': the converter cannot read the file written'); bad++; return; }
  var want = d3(draw(c2));
  if (d3(draw(g2)) !== want) why.push('the editor\'s drawing differs from the converter\'s of the file written' + firstDiff(d3(draw(g2)), want));
  var re2 = d3(draw(se.graphml(s2, g, opt)));
  if (re2 !== want) why.push('graphml(s2, base) is drawn differently' + firstDiff(re2, want));
  if (se.write(s2, c2, opt) !== s2) why.push('write(s2, conv(s2)) changes the file');
  var G2 = glyphs(s2), by = {};
  G2.forEach(function (q) { by[q.id] = q; });
  if (!by.tagA || by.tagA.cls !== 'tag' || by.tagA.way !== 'up' || by.tagA.label !== 'Out') why.push('the free tag is not written as a tag pointing up, named Out');
  if (sub && (!by.termA || by.termA.cls !== 'terminal' || by.termA.up !== sub.id || by.termA.way !== 'down')) why.push('the terminal is not written inside its submap, pointing down');
  if (tag && (by[tag.id].way !== 'left' || by[tag.id].label !== 'Renamed tag')) why.push('the turned tag is not left and renamed');
  if (term && JSON.stringify(by[term.id].box) === JSON.stringify(term.box)) why.push('the slid terminal kept its box');
  if (/undefined/.test(s2)) why.push('the file holds undefined');
  if (!by.termN || by.termN.cls !== 'terminal' || by.termN.up !== 'subN' || by.termN.way !== 'left') why.push('the terminal on the new submap is not written inside it');
  if (ent && !arcs(s2).some(function (a) { return a.id === 'eqA' && a.cls === 'equivalence arc' && a.s === ent.id && a.t === 'tagA'; })) why.push('no equivalence arc from the entity to the tag');
  ran++;
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ': ' + why.join('; ')); }
});
console.log(ran + ' maps, tags and terminals made, turned, slid, renamed and joined: ' + (bad ? bad + ' different' : 'all the same'));
process.exit(bad ? 1 : 0);
