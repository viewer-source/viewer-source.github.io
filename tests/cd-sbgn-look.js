// CellDesigner types SBGN does not have, drawn as the SBGN glyph they stand for from the file alone, the file's type kept
// (notes/cd-types-as-sbgn.md in the working repository):
//   1. a drug with an identifier of a compound database (ChEBI, PubChem compound, KEGG compound, DrugBank) drawn as a
//      simple molecule; a drug with none, or another database's, as unknown (the ellipse with no outline); its fill's
//      role stays a metabolite's;
//   2. positive influence (POSITIVE_INFLUENCE, dashed too) drawn exactly as reduced physical stimulation.
//   node tests/cd-sbgn-look.js   (the demo's acly-celldesigner.xml)
var fs = require('fs'), path = require('path'), here = path.join(__dirname, '..');
var cdr = require(path.join(here, 'renderers/converter/cdrender.js')), DP = require('@xmldom/xmldom').DOMParser;
var t = fs.readFileSync(path.join(here, 'maps/acly-celldesigner.xml'), 'utf8'), bad = 0, n = 0;
function is(what, ok) { n++; if (!ok) { bad++; console.log('WRONG ' + what); } }
function draw(x) { return cdr.render(x, { DOMParser: DP, classes: true }); }
var sp = /<species [^>]*name="citrate"[\s\S]*?<\/species>/.exec(t)[0];
function asDrug(id) {   // citrate made a drug, its identifier replaced by id ('' for none)
  var s = sp.replace(/<celldesigner:class>SIMPLE_MOLECULE</, '<celldesigner:class>DRUG<');
  s = id ? s.replace(/urn:miriam:obo\.chebi:CHEBI%3A16947/, id) : s.replace(/<rdf:li rdf:resource="urn:miriam:obo\.chebi:[^"]*"\/>/, '');
  return t.replace(sp, s);
}
var own = draw(t);
[['urn:miriam:obo.chebi:CHEBI%3A16947', true], ['urn:miriam:pubchem.compound:311', true], ['http://identifiers.org/drugbank/DB00945', true],
  ['urn:miriam:kegg.compound:C00158', true], ['urn:miriam:pubmed:123456', false], ['urn:miriam:pubchem.substance:311', false], ['', false]].forEach(function (c) {
  var x = asDrug(c[0]), svg = draw(x);
  is('the file keeps DRUG (' + (c[0] || 'no identifier') + ')', /<celldesigner:class>DRUG</.test(x));
  if (c[1]) is('drawn as the simple molecule with ' + c[0], svg === own);
  else {
    is('drawn as unknown with ' + (c[0] || 'no identifier') + ': an ellipse with no outline', svg !== own && /<ellipse[^>]*stroke="none"[^>]*class="c-metabolite"/.test(svg));
    is('no drug stadium with ' + (c[0] || 'no identifier'), !/rx="[^"]+"[^>]*\/>\s*<rect[^>]*fill="none" stroke="#000"/.test(svg));
  }
});
// 2. every reduced physical stimulation written as positive influence: the same drawing
var y = t.replace(/(["'>])REDUCED_PHYSICAL_STIMULATION(?=["'<])/g, '$1POSITIVE_INFLUENCE'), z = t.replace(/(["'>])REDUCED_PHYSICAL_STIMULATION(?=["'<])/g, '$1UNKNOWN_POSITIVE_INFLUENCE');
var u = t.replace(/(["'>])REDUCED_PHYSICAL_STIMULATION(?=["'<])/g, '$1UNKNOWN_REDUCED_PHYSICAL_STIMULATION');
if (y !== t) { is('positive influence drawn as physical stimulation', draw(y) === own); is('dashed positive influence drawn as the dashed stimulation', draw(z) === draw(u)); }
else console.log('note: acly has no reduced stimulation; part 2 skipped');
console.log(n + ' checks: ' + (bad ? bad + ' WRONG' : 'all right'));
process.exit(bad ? 1 : 0);
