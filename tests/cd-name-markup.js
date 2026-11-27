// CellDesigner's name markup: _sub_..._endsub_ and _super_..._endsuper_ shown as Unicode sub- and superscripts; in a
// name field (plainName's raw) a run with no such form keeps its markup
// (cdrender.plainName), written back as the markup (cd_make.cdName), so a name shown and saved again is the file's;
// a run with a character that has no sub- or superscript shown as plain text.
//   node tests/cd-name-markup.js
var path = require('path'), here = path.join(__dirname, '..');
var cd = require(path.join(here, 'renderers/converter/cdrender.js')), mk = require(path.join(here, 'renderers/converter/cd_make.js'));
var bad = 0, n = 0;
function is(what, got, want) { n++; if (got !== want) { bad++; console.log('WRONG ' + what + ': ' + JSON.stringify(got) + ', not ' + JSON.stringify(want)); } }
[['O_sub_2_endsub_', 'O₂'], ['H_sub_2_endsub_O_sub_2_endsub_', 'H₂O₂'], ['Ca_super_2_plus__endsuper_', 'Ca²⁺'],
  ['NAD_super__plus__endsuper_', 'NAD⁺'], ['PI(4,5)P_sub_3_endsub_', 'PI(4,5)P₃'], ['IL_minus_1_beta_', 'IL-1β'],
  ['CO_sub_2_endsub__space_and_space_H_sub_2_endsub_O', 'CO₂ and H₂O']].forEach(function (c) {
  is('shown ' + c[0], cd.plainName(c[0]), c[1]);
  is('written back ' + c[0], mk.cdName(cd.plainName(c[0])), c[0]);
});
is('no subscript form', cd.plainName('X_sub_beta_endsub_'), 'Xβ');
// a name field (raw): a run with no sub- or superscript form keeps its markup, so every name comes back as the file's
['X_sub_R_endsub_', 'A_sub_b_endsub_', 'X_sub_beta_endsub_', 'IL_sub_1_beta__endsub_', 'Ca_super_2_plus__endsuper_', 'O_sub_2_endsub_', 'IL_minus_1_beta_', 'Aₔ'].forEach(function (s) {
  is('field and back ' + s, mk.cdName(cd.plainName(s, true)), s);
});
is('field shows a converted run', cd.plainName('O_sub_2_endsub_', true), 'O₂');
is('field keeps a run with no form', cd.plainName('X_sub_R_endsub_', true), 'X_sub_R_endsub_');
is('Ca_super_2+_endsuper_ as written by hand', cd.plainName('Ca_super_2+_endsuper_'), 'Ca²⁺');
is('with a line break', cd.plainName('O_sub_2_endsub__br_bound'), 'O₂_br_bound');
console.log(n + ' checks: ' + (bad ? bad + ' WRONG' : 'all right'));
process.exit(bad ? 1 : 0);
