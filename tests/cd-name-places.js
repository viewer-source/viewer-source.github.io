// A CellDesigner compartment's name at one of nine places (cdrender.namePoint, cd_make.nameAt): each place on
// membranes of 4, 12 and 24, the name kept at its place through a rename (one line and two), a new membrane and a resize
// and move written back by cd_edit.place (as the previous release writes it, tests/compare.js); a name elsewhere stays
// where it is; a new compartment's name at the top middle, 12.5 below its top as before.
//   node tests/cd-name-places.js   (needs @xmldom/xmldom)
var path = require('path');
var here = path.join(__dirname, '..'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var M = require(path.join(here, 'renderers/converter/cd_make.js')), E = require(path.join(here, 'renderers/converter/cd_edit.js'));
var C = require(path.join(here, 'renderers/converter/cdrender.js')), Cmp = require('./compare.js').open('cd-name-places'), EB = Cmp.base('renderers/converter/cd_edit.js');
var bad = [], n = 0;
function check(ok, what) { n++; if (!ok) bad.push(what); }
function np(t, a) { var m = new RegExp('compartmentAlias id="' + a + '"[\\s\\S]*?namePoint x="([^"]*)" y="([^"]*)"').exec(t); return [parseFloat(m[1]), parseFloat(m[2])]; }

// a new compartment: the top middle, 12.5 below the top (the converter's and CellDesigner's place at the default membrane)
var t0 = M.empty({}), r0 = M.compartment(t0, { name: 'Cytosol', box: [40, 40, 300, 200] });
check(M.namePlace(r0.text, r0.alias) === 't' && np(r0.text, r0.alias)[1] === 52.5, 'new compartment at the top middle');

[4, 12, 24].forEach(function (th) {
  C.NAME_PLACES.forEach(function (p) {
    var r = M.compartment(M.empty({}), { name: 'Cytosol', box: [40, 40, 300, 200] }), t = r.text, a = r.alias;
    t = M.restyle(t, a, { mem: th });
    t = M.nameAt(t, a, p);
    var q = np(t, a), lt = th + 5, tp = th + 0.5;
    check(M.namePlace(t, a) === p, th + ' ' + p + ': read back');
    if (p.slice(-1) === 'l') check(Math.abs(q[0] - 40 - lt) < 1e-6, th + ' ' + p + ': left distance');
    if (p.charAt(0) === 't') check(Math.abs(q[1] - 40 - tp) < 1e-6, th + ' ' + p + ': top distance');
    if (p.charAt(0) === 'b') check(Math.abs(240 - (q[1] + 23) - tp) < 1e-6, th + ' ' + p + ': bottom distance');
    t = M.rename(t, a, 'Endoplasmic reticulum');
    check(M.namePlace(t, a) === p, th + ' ' + p + ': kept through a rename');
    t = M.rename(t, a, 'Golgi\napparatus');
    check(M.namePlace(t, a) === p, th + ' ' + p + ': kept through a two-line name');
    t = M.restyle(t, a, { mem: th + 6 });
    check(M.namePlace(t, a) === p, th + ' ' + p + ': kept through a new membrane');
    // resized and moved in the editor's GraphML, written back by cd_edit
    var g = E.graphml(t, null, { DOMParser: DP }).replace(/(<node id="ca1"[\s\S]*?<y:Geometry )x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*"/, '$1x="52.0" y="30.0" width="380.0" height="150.0"');
    var js = E.place(t, g, { DOMParser: DP })[0];
    check(M.namePlace(js, a) === p, th + ' ' + p + ': kept through a resize');
    check(Cmp.check(th + ' ' + p + ' resize', js, EB && EB.place(t, g, { DOMParser: DP })[0]) !== 'different', th + ' ' + p + ': as the previous release writes it');
  });
});

// an oval: every place inside its inner ellipse (the name's box corners too)
C.NAME_PLACES.forEach(function (p) {
  var r = M.compartment(M.empty({}), { name: 'Cytosol', box: [40, 40, 300, 200], oval: true }), t = M.nameAt(r.text, r.alias, p), q = np(t, r.alias), w = C.width('Cytosol', 12);
  var inE = function (x, y) { return Math.pow((x - 190) / (150 - 12), 2) + Math.pow((y - 140) / (100 - 12), 2) <= 1.0001; };
  check(M.namePlace(t, r.alias) === p, 'oval ' + p + ': read back');
  check(p.length < 2 || [[q[0], q[1]], [q[0] + w, q[1]], [q[0], q[1] + 23], [q[0] + w, q[1] + 23]].every(function (c) { return inE(c[0], c[1]); }), 'oval ' + p + ': inside the inner ellipse');
});

// a box too short to tell top, centre and bottom apart: a resize leaves the name as it is (moved with the corner)
var r2 = M.compartment(M.empty({}), { name: 'Cytosol', box: [40, 40, 300, 48] }), t2 = M.nameAt(r2.text, r2.alias, 'b'), q2 = np(t2, r2.alias);
var g2 = E.graphml(t2, null, { DOMParser: DP }).replace(/(<node id="ca1"[\s\S]*?<y:Geometry )x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*"/, '$1x="40.0" y="40.0" width="300.0" height="200.0"');
var t2b = E.place(t2, g2, { DOMParser: DP })[0];
check(np(t2b, r2.alias)[1] === q2[1], 'a short box: the name left where it was on a resize');

// a name elsewhere stays where it is, moved with the box's corner
var r1 = M.compartment(M.empty({}), { name: 'Cytosol', box: [40, 40, 300, 200] }), t1 = r1.text.replace(/namePoint x="[^"]*" y="[^"]*"/, 'namePoint x="150.0" y="150.0"');
check(M.namePlace(t1, r1.alias) === '', 'elsewhere read as none');
t1 = M.rename(t1, r1.alias, 'Nucleus');
check(np(t1, r1.alias)[0] === 150 && np(t1, r1.alias)[1] === 150, 'elsewhere kept through a rename');

Cmp.end('resizes written');
console.log(n + ' checks, ' + (n - bad.length) + ' right' + (bad.length ? '\n' + bad.join('\n') : ''));
process.exit(bad.length ? 1 : 0);
