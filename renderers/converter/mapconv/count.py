# The count check: what a file states, counted from its raw XML by kind, none of the converter's readers used, so a
# conversion's output can be held against its input (a lost arc or two nodes merged show as a difference).
#   count(path, which) -> (format, {kind: Counter of names}): entities (drawn instances) by class with their names, compartments,
#                  processes, logic gates, arcs by role; yEd GraphML (the SBGN palette), CellDesigner (aliases,
#                  reactions, their participants in the CellDesigner annotation), SBGN-ML (glyphs, arcs), SBML with
#                  layout (glyphs: entities and compartments only); which: the map of an SBGN-ML file of several
#   check(input, text, said, which) -> the count check of one file made, as messages (below)
#   layers(root) -> lines where a CellDesigner file's SBML core and its CellDesigner annotation disagree on a reaction's
#                   reactants, products or modifiers (MINERVA and SBML tools read the core, CellDesigner the annotation)
#   compare(a, b) -> [(kind, count in a, count in b, names in a only, names in b only)] for every kind that differs
#   python3 -m mapconv.count <input> <output>
import collections, re, sys
from lxml import etree

ENTITIES = ('macromolecule', 'simple chemical', 'nucleic acid feature', 'unspecified entity', 'complex', 'phenotype',
            'source and sink')
NAMED = ('macromolecule', 'simple chemical', 'nucleic acid feature', 'unspecified entity', 'phenotype', 'compartment')
FLUX = 'consumption and production'  # one kind: a reversible process draws its reactants as products in SBGN
MODIFIERS = ('catalysis', 'inhibition', 'stimulation', 'modulation', 'trigger')


def words(s):
    return ' '.join((s or '').split())


def _graphml(root):
    G, Y = '{http://graphml.graphdrawing.org/xmlns}', '{http://www.yworks.com/xml/graphml}'
    SBGN = {'Macromolecule': 'macromolecule', 'SimpleChemical': 'simple chemical', 'NucleicAcidFeature': 'nucleic acid feature',
            'UnspecifiedEntity': 'unspecified entity', 'Complex': 'complex', 'Phenotype': 'phenotype', 'Submap': 'phenotype',
            'PerturbingAgent': 'phenotype', 'SourceAndSink': 'source and sink', 'EmptySet': 'source and sink',
            'Process': 'process', 'OmittedProcess': 'process', 'UncertainProcess': 'process', 'Association': 'process',
            'Dissociation': 'process', 'Operator': 'logic gate', 'Tag': 'tag'}
    HEAD = {'white_circle': 'catalysis', 't_shape': 'inhibition', 'crows_foot_one': 'inhibition', 'white_diamond': 'modulation',
            'white_delta': 'stimulation', 'white_delta_bar': 'trigger', 'delta': 'production'}
    OUTLINE = {'ShapeNode roundrectangle': 'macromolecule', 'GenericNode com.yworks.flowchart.terminator': 'simple chemical',
               'ShapeNode ellipse': 'unspecified entity', 'ShapeNode rectangle': 'phenotype', 'ShapeNode hexagon': 'phenotype'}
    out, kind, boxes, names, outline = collections.defaultdict(collections.Counter), {}, {}, {}, set()
    for n in root.iter(G + 'node'):
        r = n.find(G + 'data/*[' + Y + 'Geometry]')
        if r is None:
            r = n.find(G + 'data/' + Y + 'ProxyAutoBoundsNode/' + Y + 'Realizers/*')
        if r is None:
            continue
        conf = r.get('configuration') or ''
        shape = r.find(Y + 'Shape')
        labs = [l for l in r.findall(Y + 'NodeLabel') if not l.get('iconData') and (l.text or '').strip()]
        name = words(labs[0].text) if labs else ''
        if conf.startswith('com.yworks.sbgn.'):
            k = SBGN.get(conf[len('com.yworks.sbgn.'):], 'other')
        elif n.find(G + 'graph') is not None and etree.QName(r).localname in ('GroupNode', 'ShapeNode'):
            k = 'compartment'  # a plain group, or a shape holding nodes (an oval cell)
        else:  # another palette's shapes, read by their outline (AsthMap)
            k = OUTLINE.get(' '.join(x for x in (etree.QName(r).localname, conf, shape.get('type') if shape is not None else '') if x), 'other')
            outline.add(n.get('id'))
            if k == 'unspecified entity' and name in ('AND', 'OR', 'NOT'):
                k = 'logic gate'
        if k == 'process' and name in ('AND', 'OR', 'NOT'):
            k = 'logic gate'
        kind[n.get('id')] = k
        geo = r.find(Y + 'Geometry')
        boxes[n.get('id')] = tuple(float(geo.get(a, 0)) for a in ('x', 'y', 'width', 'height')) if geo is not None else None
        names[n.get('id')] = name
    # an oval of another palette that holds other nodes on the drawing is a compartment (a cell), as the reader takes it
    for i, k in list(kind.items()):
        b = boxes[i]
        if k == 'unspecified entity' and i in outline and b and any(j != i and c and b[0] < c[0] + c[2] / 2 < b[0] + b[2] and
                                                  b[1] < c[1] + c[3] / 2 < b[1] + b[3] and c[2] * c[3] < b[2] * b[3]
                                                  for j, c in boxes.items()):
            kind[i] = 'compartment'
    for i, k in kind.items():
        out[k][names[i]] += 1
    for e in root.iter(G + 'edge'):
        a = e.find(G + 'data/*/' + Y + 'Arrows')
        head = HEAD.get(a.get('target') if a is not None else None)
        s, t = kind.get(e.get('source')), kind.get(e.get('target'))
        if head:
            out[head][''] += 1
        elif 'logic gate' in (s, t) and 'process' not in (s, t):
            out['logic arc'][''] += 1
        elif 'process' in (s, t):
            out['consumption'][''] += 1
        # else a plain line between entities, tags or submaps: an equivalence arc, not counted (nor in SBGN-ML)
    return out


CD_CLASS = {'PROTEIN': 'macromolecule', 'RECEPTOR': 'macromolecule', 'ION_CHANNEL': 'macromolecule', 'TRUNCATED': 'macromolecule',
            'SIMPLE_MOLECULE': 'simple chemical', 'ION': 'simple chemical', 'DRUG': 'simple chemical',
            'GENE': 'nucleic acid feature', 'RNA': 'nucleic acid feature', 'ANTISENSE_RNA': 'nucleic acid feature',
            'UNKNOWN': 'unspecified entity', 'COMPLEX': 'complex', 'PHENOTYPE': 'phenotype', 'DEGRADED': 'source and sink'}
CD_MOD = {'CATALYSIS': 'catalysis', 'UNKNOWN_CATALYSIS': 'catalysis', 'INHIBITION': 'inhibition',
          'UNKNOWN_INHIBITION': 'inhibition', 'NEGATIVE_INFLUENCE': 'inhibition', 'UNKNOWN_NEGATIVE_INFLUENCE': 'inhibition',
          'PHYSICAL_STIMULATION': 'stimulation', 'REDUCED_PHYSICAL_STIMULATION': 'stimulation',
          'UNKNOWN_REDUCED_PHYSICAL_STIMULATION': 'stimulation', 'POSITIVE_INFLUENCE': 'stimulation',
          'UNKNOWN_POSITIVE_INFLUENCE': 'stimulation', 'MODULATION': 'modulation', 'REDUCED_MODULATION': 'modulation',
          'UNKNOWN_REDUCED_MODULATION': 'modulation', 'TRIGGER': 'trigger', 'REDUCED_TRIGGER': 'trigger',
          'UNKNOWN_REDUCED_TRIGGER': 'trigger'}
CD_NAME = [('_space_', ' '), ('_br_', ' '), ('_minus_', '-'), ('_slash_', '/'), ('_plus_', '+')] + [
    ('_%s_' % g, c) for g, c in zip('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma '
                                    'tau phi chi psi omega'.split(), 'αβγδεζηθικλμνξπρστφχψω')]


def cd_words(s):
    for a, b in CD_NAME:
        s = (s or '').replace(a, b)
    return words(s)


def _celldesigner(root):
    C = '{http://www.sbml.org/2001/ns/celldesigner}'
    m = next((x for x in root if etree.QName(x).localname == 'model'), root)
    out = collections.defaultdict(collections.Counter)
    species = {}
    for s in m.iter():
        if not isinstance(s.tag, str) or etree.QName(s).localname != 'species' or s.get('id') is None:
            continue
        cls = s.find('.//' + C + 'class')
        species[s.get('id')] = (CD_CLASS.get(cls.text.strip() if cls is not None and cls.text else '', 'other'),
                                cd_words(s.get('name') or (s.findtext(C + 'name') or '')))
    for a in list(m.iter(C + 'speciesAlias')) + list(m.iter(C + 'complexSpeciesAlias')):
        k, name = species.get(a.get('species'), ('other', ''))
        out[k][name] += 1
    names = {c.get('id'): cd_words(c.get('name') or '') for c in m.iter() if isinstance(c.tag, str) and etree.QName(c).localname == 'compartment'}
    for a in m.iter(C + 'compartmentAlias'):
        out['compartment'][names.get(a.get('compartment'), '')] += 1
    for r in (x for x in m.iter() if isinstance(x.tag, str) and etree.QName(x).localname == 'reaction'):
        t = (r.findtext('.//' + C + 'reactionType') or '').strip()
        ins = len(r.findall('.//' + C + 'baseReactant')) + len(r.findall('.//' + C + 'reactantLink'))
        outs = len(r.findall('.//' + C + 'baseProduct')) + len(r.findall('.//' + C + 'productLink'))
        if t == 'BOOLEAN_LOGIC_GATE':  # a gate on arcs between entities: its inputs, one arc out
            gate = next((g for g in r.iter(C + 'GateMember') if g.get('type', '').startswith('BOOLEAN_LOGIC_GATE')), None)
            out['logic gate'][''] += 1
            out['logic arc'][''] += ins
            out[CD_MOD.get(gate.get('modificationType') if gate is not None else '', 'other arc')][''] += outs
            continue
        if t in CD_MOD:  # reduced notation: one arc between entities
            out[CD_MOD[t]][''] += 1
            continue
        out['process'][''] += 1
        out['consumption'][''] += ins
        out['production'][''] += outs
        mods = list(r.iter(C + 'modification'))
        inputs = set()
        for g in (g for g in mods if g.get('type', '').startswith('BOOLEAN_LOGIC_GATE')):
            out['logic gate'][''] += 1
            out[CD_MOD.get(g.get('modificationType'), 'other arc')][''] += 1
            ids = (g.get('aliases') or '').split(',')
            out['logic arc'][''] += len(ids)
            inputs |= {(a, g.get('modificationType')) for a in ids}
        for x in mods:
            if x.get('type', '').startswith('BOOLEAN_LOGIC_GATE'):
                continue
            if (x.get('aliases'), x.get('type')) in inputs:  # a gate's input, listed again with the gate's arc type
                inputs.discard((x.get('aliases'), x.get('type'))); continue
            out[CD_MOD.get(x.get('type'), 'other arc')][''] += 1
    return out


def _sbgnml(root, which=0):
    S = '{http://sbgn.org/libsbgn/0.3}'
    for e in root.iter(etree.Element):
        if e.tag.startswith('{http://sbgn.org/libsbgn/'):
            e.tag = S + etree.QName(e).localname
    m = root.findall(S + 'map')[which]
    out = collections.defaultdict(collections.Counter)
    ARC = {'consumption': 'consumption', 'production': 'production', 'catalysis': 'catalysis', 'inhibition': 'inhibition',
           'stimulation': 'stimulation', 'modulation': 'modulation', 'necessary stimulation': 'trigger',
           'positive influence': 'stimulation', 'negative influence': 'inhibition', 'unknown influence': 'modulation',
           'logic arc': 'logic arc'}
    for g in m.iter(S + 'glyph'):
        c = (g.get('class') or '').replace(' multimer', '')
        lab = g.find(S + 'label')
        name = words(lab.get('text')) if lab is not None else ''
        if c == 'biological activity':  # Activity Flow: the entity its unit names
            u = next((x.find(S + 'entity') for x in g.findall(S + 'glyph') if x.find(S + 'entity') is not None), None)
            c = (u.get('name') or '').replace(' multimer', '') if u is not None else 'macromolecule'
            c = {'perturbation': 'phenotype', '': 'macromolecule'}.get(c, c)
        if c in ('submap', 'perturbing agent', 'perturbation'):
            c = 'phenotype'
        if c in ENTITIES + ('compartment',):
            out[c][name] += 1
        elif c in ('process', 'omitted process', 'uncertain process', 'association', 'dissociation'):
            out['process'][''] += 1
        elif c in ('and', 'or', 'not', 'delay', 'equivalence'):
            out['logic gate'][''] += 1
        elif c == 'tag' or c == 'terminal':
            out['tag'][''] += 1
    for a in m.iter(S + 'arc'):
        c = a.get('class')
        if c in ARC:
            out[ARC[c]][''] += 1
        elif c != 'equivalence arc':
            out['other arc'][''] += 1
    return out


def _sbml(root):
    L = '{http://www.sbml.org/sbml/level3/version1/layout/version1}'
    m = next(x for x in root if etree.QName(x).localname == 'model')
    out = collections.defaultdict(collections.Counter)
    SBO = {'SBO:0000245': 'macromolecule', 'SBO:0000247': 'simple chemical', 'SBO:0000253': 'complex',
           'SBO:0000354': 'nucleic acid feature', 'SBO:0000243': 'nucleic acid feature', 'SBO:0000278': 'nucleic acid feature',
           'SBO:0000285': 'unspecified entity', 'SBO:0000358': 'phenotype',
           'SBO:0000291': 'source and sink'}
    sp = {s.get('id'): (SBO.get(s.get('sboTerm'), 'other'), words(s.get('name'))) for s in m.iter() if
          isinstance(s.tag, str) and etree.QName(s).localname == 'species'}
    cp = {c.get('id'): words(c.get('name')) for c in m.iter() if isinstance(c.tag, str) and etree.QName(c).localname == 'compartment'}
    for g in m.iter(L + 'speciesGlyph'):
        k, name = sp.get(g.get(L + 'species') or g.get('species'), ('other', ''))
        out[k][name] += 1
    for g in m.iter(L + 'compartmentGlyph'):
        c = g.get(L + 'compartment') or g.get('compartment')
        if c in cp and c != 'default':
            out['compartment'][cp[c]] += 1
    return out


def format_of(root):
    ns = etree.QName(root).namespace or ''
    if 'graphml' in ns:
        return 'graphml'
    if 'sbgn' in ns:
        return 'sbgnml'
    if 'sbml' in ns:
        return 'celldesigner' if root.find('.//{http://www.sbml.org/2001/ns/celldesigner}extension') is not None else 'sbml'
    return None


def parse(source):
    # a path, or a file's text
    parser = etree.XMLParser(remove_comments=True, huge_tree=True)
    if isinstance(source, str) and source.lstrip().startswith('<'):
        return etree.fromstring(source.encode('utf-8'), parser)
    return etree.parse(source, parser).getroot()


def count(source, which=0):
    # which: the map of an SBGN-ML file of several (0: the first)
    return counted(parse(source), which)


def counted(root, which=0):
    f = format_of(root)
    raw = {'graphml': _graphml, 'celldesigner': _celldesigner, 'sbgnml': lambda r: _sbgnml(r, which), 'sbml': _sbml}[f](root) if f else {}
    out = collections.defaultdict(collections.Counter)
    for k, names in raw.items():
        for n, c in names.items():
            out[FLUX if k in ('consumption', 'production') else k][n if k in NAMED else ''] += c
    return f, dict(out)


def layers(root):
    # where the SBML core of a CellDesigner file (its parsed root) and its CellDesigner annotation name other participants
    C = '{http://www.sbml.org/2001/ns/celldesigner}'
    out = []
    for r in (x for x in root.iter() if isinstance(x.tag, str) and etree.QName(x).localname == 'reaction'):
        if (r.findtext('.//' + C + 'reactionType') or '').strip() == 'BOOLEAN_LOGIC_GATE':
            continue
        core = lambda lst, ref: sorted(x.get('species') for l in r if isinstance(l.tag, str) and etree.QName(l).localname == lst
                                       for x in l if isinstance(x.tag, str) and etree.QName(x).localname == ref)
        ann = lambda *tags: sorted(x.get('species') or x.get('reactant') or x.get('product') for t in tags for x in r.iter(C + t))
        mods = sorted(s for x in r.iter(C + 'modification') if not x.get('type', '').startswith('BOOLEAN_LOGIC_GATE')
                      for s in (x.get('modifiers') or '').split(',') if s)
        for what, a, b in (('reactants', core('listOfReactants', 'speciesReference'), ann('baseReactant', 'reactantLink')),
                           ('products', core('listOfProducts', 'speciesReference'), ann('baseProduct', 'productLink')),
                           ('modifiers', sorted(set(core('listOfModifiers', 'modifierSpeciesReference'))), sorted(set(mods)))):
            if a != b:
                out.append('%s: %s %s in the SBML, %s in CellDesigner' % (r.get('id'), what, ' '.join(a) or 'none', ' '.join(b) or 'none'))
    return out


def compare(a, b):
    out = []
    for k in sorted(set(a) | set(b)):
        x, y = a.get(k, collections.Counter()), b.get(k, collections.Counter())
        if x != y:
            out.append((k, sum(x.values()), sum(y.values()), sorted((x - y).elements()), sorted((y - x).elements())))
    return out


# the words by which a message of the conversion names a kind; the words of an arc lost with its node (LOST_ARCS)
# count for every kind of arc
WORDS = {'macromolecule': ('protein', 'macromolecule'), 'simple chemical': ('simple chemical', 'simple molecule', 'metabolite', 'ion', 'drug'),
         'nucleic acid feature': ('gene', 'rna', 'nucleic acid'), 'unspecified entity': ('unspecified', 'unknown'),
         'complex': ('complex',), 'phenotype': ('phenotype', 'submap', 'perturb'), 'source and sink': ('source', 'sink', 'degraded'),
         'compartment': ('compartment',), 'process': ('process', 'reaction'), 'logic gate': ('gate', 'operator', 'delay'),
         'logic arc': ('gate', 'logic', 'operator', 'delay'), 'tag': ('tag', 'terminal'),
         FLUX: ('consumption', 'production', 'reactant', 'product', 'process')}
LOST_ARCS = ('arc to a glyph', 'arcs at', 'its arcs', 'with its arc', 'arcs left out')
JOINED = ('join', 'merg', 'split', 'written as', 'drawn as', 'read as', ' cut', 'drop', 'replac', 'as one', 'into one')


def explained(kind, gain, only, said):
    # whether a message of the conversion names this kind's difference by the kind's words, or a name on one side
    # only: a loss by a left out line (or a rule problem) or a changed line that joins, splits or rewrites; a gain by
    # such a changed line only
    words_ = WORDS.get(kind, ()) + ((kind, 'gate', 'operator') + LOST_ARCS if kind in MODIFIERS else ()) + (
        LOST_ARCS if kind in (FLUX, 'logic arc') else ())
    has = lambda w, t: re.search(r'(?<!\w)%s' % re.escape(w), t) is not None  # a word's start, not inside another word
    for k, m in said:
        t = (m or '').lower()
        rewrite = k == 'changed' and any(w in t for w in JOINED)
        if not (rewrite or not gain and k in ('left out', 'problem')):
            continue
        if kind in ('other', 'other arc'):  # what the count cannot name (another palette's shapes): any loss said
            return True
        if any(has(w, t) for w in words_) or any(len(n) > 2 and has(n.lower(), t) for n in only):
            return True
        if k in ('problem', 'left out') and '(arc ' in t and kind in MODIFIERS + (FLUX, 'logic arc'):  # an arc left out
            return True
    return False


def check(source, text, said=(), which=0):
    # the count check of one conversion, as messages: (summary, a difference its messages explain) and (check, one
    # they do not); nothing when every kind counts the same. A CellDesigner output's two layers are checked too.
    # source: the input's path, or its count already made ((format, counts), counted once for all its outputs)
    a = (source if isinstance(source, tuple) else count(source, which))[1]
    root = parse(text)
    fb, b = counted(root)
    if fb == 'sbml':  # only its glyphs: entities and compartments
        a = {k: v for k, v in a.items() if k in ENTITIES + ('compartment',)}
    if fb == 'celldesigner':  # CellDesigner has no tag (a submap's terminal)
        a = {k: v for k, v in a.items() if k != 'tag'}
    out = []
    for k, n, m, x, y in compare(a, b):
        only = [v for v in x + y if v]
        line = 'count check, %s: %d in the input, %d in the output' % (k, n, m)
        if only:
            line += ' (%s)' % '; '.join(['input only: ' + ', '.join(dict.fromkeys(v for v in x if v))] * any(x) +
                                        ['output only: ' + ', '.join(dict.fromkeys(v for v in y if v))] * any(y))
        ok = explained(k, m > n or bool(y) and not x, only, said)
        out.append(('summary', line + ', as said above') if ok else ('check', line + ', not explained by a message'))
    if fb == 'celldesigner':
        out += [('check', 'count check, the two layers of the CellDesigner file: ' + l) for l in layers(root)]
    return out


if __name__ == '__main__':
    (fa, a), (fb, b) = count(sys.argv[1]), count(sys.argv[2])
    for k, n, m, only_a, only_b in compare(a, b):
        print('%s %d / %d' % (k, n, m), *(['in only: ' + '; '.join(only_a)] if any(only_a) else []),
              *(['out only: ' + '; '.join(only_b)] if any(only_b) else []))
