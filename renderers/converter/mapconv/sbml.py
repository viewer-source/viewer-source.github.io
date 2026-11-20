# Read SBML with its Layout (Level 3 package, or the Level 2 annotation of the same elements) into the map model,
# drawn as the file places it: compartment and species glyphs as boxes, a reaction glyph as a process, its species
# reference glyphs as arcs. Glyph kinds come from SBO terms (SBO below); a species without one is an unspecified
# entity. Read only; the rules in docs/SBML.md.
import os, re
from lxml import etree
from . import report
from .annotation import to_properties
from .model import Map, Node, Arc
from .sbgnml import urn

RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
# species SBO term -> the map's glyph (SBGN PD), with a unit of information where SBGN draws one
SPECIES = {'0000245': 'Macromolecule', '0000252': 'Macromolecule', '0000289': 'Macromolecule',   # protein; Reactome's sets
           '0000297': 'Complex', '0000253': 'Complex',
           '0000247': 'SimpleChemical', '0000327': 'SimpleChemical', '0000299': 'SimpleChemical', '0000298': 'SimpleChemical',
           '0000354': 'NucleicAcidFeature', '0000250': 'NucleicAcidFeature', '0000251': 'NucleicAcidFeature',
           '0000278': ('NucleicAcidFeature', 'ct:mRNA'), '0000243': ('NucleicAcidFeature', 'ct:gene'),
           '0000291': 'EmptySet', '0000358': 'Phenotype', '0000285': 'UnspecifiedEntity'}
# reaction SBO term -> process glyph, and the SBGN class it is drawn as
REACTION = {'0000397': ('OmittedProcess', None), '0000396': ('UncertainProcess', None),
            '0000177': ('Process', 'association'), '0000180': ('Process', 'dissociation')}
# modifier SBO term or role -> the arc's head
MODIFIER = {'0000013': 'catalysis', '0000020': 'inhibition', '0000459': 'stimulation', '0000461': 'trigger',
            '0000594': 'modulation', '0000019': 'modulation', '0000021': 'stimulation', '0000170': 'stimulation',
            '0000171': 'trigger', '0000169': 'inhibition',
            'modifier': 'modulation', 'activator': 'stimulation', 'inhibitor': 'inhibition'}
PROCESS = 24  # px, a process glyph's side where the reaction glyph gives only a point or a large box


def kids(el, name):
    return [c for c in el if isinstance(c.tag, str) and etree.QName(c).localname == name]


def kid(el, name):
    return next(iter(kids(el, name)), None)


def all_(el, name):
    return [c for c in el.iter(etree.Element) if etree.QName(c).localname == name]


def attr(el, k):  # an attribute, with or without the package's prefix (layout:x, x)
    if el is None:
        return None
    for a, v in el.attrib.items():
        if etree.QName(a).localname == k:
            return v
    return None


def sbo(el):
    v = attr(el, 'sboTerm') or ''
    return v[4:] if v.startswith('SBO:') else v


def box(g):
    b = kid(g, 'boundingBox')
    if b is None:
        return None
    p, d = kid(b, 'position'), kid(b, 'dimensions')
    if p is None or d is None:
        return None
    f = lambda e, k: float(attr(e, k) or 0)
    return f(p, 'x'), f(p, 'y'), f(d, 'width'), f(d, 'height')


def points(g):
    # a curve's points in order: each segment's start, the last segment's end (Bezier control points not kept)
    c = kid(g, 'curve')
    segs = kids(kid(c, 'listOfCurveSegments'), 'curveSegment') if c is not None and kid(c, 'listOfCurveSegments') is not None else []
    pts = []
    for s in segs:
        for e in (kid(s, 'start'), kid(s, 'end')):
            if e is not None:
                p = (float(attr(e, 'x')), float(attr(e, 'y')))
                if not pts or abs(pts[-1][0] - p[0]) > .01 or abs(pts[-1][1] - p[1]) > .01:
                    pts.append(p)
    return pts


def annotations(el):
    # an element's MIRIAM identifiers (bqbiol is, hasVersion) as node properties
    a = kid(el, 'annotation')
    d = next(iter(a.iter('{%s}Description' % RDF)), None) if a is not None else None
    data = {}
    for q in (d if d is not None else []):
        urns = [u for u in (urn(li.get('{%s}resource' % RDF) or '') for li in q.iter('{%s}li' % RDF)) if u]
        if urns and etree.QName(q).localname in ('is', 'hasVersion'):
            data.update(to_properties(etree.QName(q).localname == 'hasVersion', urns))
    return data


def is_sbml(text):
    # an SBML file this reader draws: SBML with a layout, not CellDesigner's own (celldesigner.read)
    head = text[:200000]
    return '<sbml' in head and 'listOfLayouts' in text and 'celldesigner' not in head


def read(path):
    root = etree.parse(path).getroot()
    model = kid(root, 'model')
    layouts = all_(model, 'layout')
    if not layouts:
        raise ValueError('no layout in this SBML file: nothing to draw as the file places it')
    lay = layouts[0]
    if len(layouts) > 1:
        report.say('left out', 'layouts after the first: %d' % (len(layouts) - 1))
    sp = {e.get('id'): e for e in all_(model, 'species')}
    comp = {e.get('id'): e for e in all_(model, 'compartment')}
    refs = {}  # a speciesReference's id -> (role, species, SBO term)
    for r in all_(model, 'reaction'):
        for lst, role in (('listOfReactants', 'substrate'), ('listOfProducts', 'product'), ('listOfModifiers', 'modifier')):
            for s in (kids(kid(r, lst), 'speciesReference') + kids(kid(r, lst), 'modifierSpeciesReference')) if kid(r, lst) is not None else []:
                if s.get('id'):
                    refs[s.get('id')] = (role, s.get('species'), sbo(s))
    rx = {e.get('id'): e for e in all_(model, 'reaction')}
    text = {}  # glyph id -> its text glyph's text
    for t in all_(lay, 'textGlyph'):
        g, o = attr(t, 'graphicalObject'), attr(t, 'originOfText')
        e = next((d[o] for d in (sp, comp, rx) if o in d), None)
        v = attr(t, 'text') or (e.get('name') or e.get('id') if e is not None else None)
        if g and v and g not in text:
            text[g] = v
    nodes, arcs, skipped = {}, [], {}
    for g in all_(lay, 'compartmentGlyph'):
        b, c = box(g), comp.get(attr(g, 'compartment'))
        if b is None or not b[2] or not b[3]:
            skipped.setdefault('compartment glyph without a box', []).append(attr(g, 'id')); continue
        nodes[attr(g, 'id')] = Node(id=attr(g, 'id'), kind='Compartment', box=b,
                                    labels=[text.get(attr(g, 'id')) or (c.get('name') or c.get('id') if c is not None else '')],
                                    data=annotations(c) if c is not None else {})
    comps = list(nodes.values())

    def inside(b):  # the smallest compartment glyph holding the box's centre
        cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
        hold = [n for n in comps if n.box[0] <= cx <= n.box[0] + n.box[2] and n.box[1] <= cy <= n.box[1] + n.box[3]]
        return min(hold, key=lambda n: n.box[2] * n.box[3]).id if hold else None

    for g in all_(lay, 'speciesGlyph'):
        i, s = attr(g, 'id'), sp.get(attr(g, 'species'))
        b = box(g)
        if b is None:
            skipped.setdefault('species glyph without a box', []).append(i); continue
        k = SPECIES.get(sbo(s) if s is not None else '', 'UnspecifiedEntity')
        kind, units = (k, []) if isinstance(k, str) else (k[0], [k[1]])
        nodes[i] = Node(id=i, kind=kind, box=b, units=units, parent=inside(b), species=attr(g, 'species'),
                        labels=['' if kind == 'EmptySet' else (text.get(i) or (s.get('name') or s.get('id') if s is not None else ''))],
                        data=annotations(s) if s is not None else {})
    if not any(n.kind != 'Compartment' for n in nodes.values()):
        raise ValueError('no species glyph in its layout (SBML-qual boxes are general glyphs, not read yet)')
    cx = [n for n in nodes.values() if n.kind == 'Complex']
    for n in nodes.values():  # a glyph lying within a complex's box is its member (MINERVA draws members as species glyphs)
        x, y, w, h = n.box
        hold = [c for c in cx if c is not n and c.box[0] <= x and c.box[1] <= y and x + w <= c.box[0] + c.box[2]
                and y + h <= c.box[1] + c.box[3] and c.box[2] * c.box[3] > w * h]
        if n.kind != 'Compartment' and hold:
            n.parent = min(hold, key=lambda c: c.box[2] * c.box[3]).id
    for g in all_(lay, 'reactionGlyph'):
        i, r = attr(g, 'id'), rx.get(attr(g, 'reaction'))
        pts, b = points(g), box(g)
        if pts:  # the reaction's own curve: the process at its middle
            x, y = (pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2
        elif b is not None and (b[2] or b[3]):
            x, y = b[0] + b[2] / 2, b[1] + b[3] / 2
        elif b is not None:
            x, y = b[0], b[1]
        else:
            skipped.setdefault('reaction glyph without a place', []).append(i); continue
        side = min(b[2], b[3]) if b is not None and 8 <= min(b[2], b[3]) <= 40 else PROCESS
        kind, cls = REACTION.get(sbo(r) if r is not None else '', ('Process', None))
        nodes[i] = Node(id=i, kind=kind, box=(x - side / 2, y - side / 2, side, side), labels=[''],
                        data=dict(annotations(r) if r is not None else {}, **({'SBGN class': cls} if cls else {})))
        for k, rg in enumerate(all_(g, 'speciesReferenceGlyph')):
            t = attr(rg, 'speciesGlyph')
            ref = refs.get(attr(rg, 'speciesReference'))
            role = (attr(rg, 'role') or (ref[0] if ref else '')).lower()
            if t not in nodes:
                skipped.setdefault('arc to a glyph left out', []).append(attr(rg, 'id') or i); continue
            line = points(rg)  # from the reaction to the species, as the Layout specification draws it
            if role in ('substrate', 'sidesubstrate'):
                arcs.append(Arc(id=attr(rg, 'id') or '%s.%d' % (i, k), source=t, target=i, points=line[::-1][1:-1]))
            elif role in ('product', 'sideproduct'):
                arcs.append(Arc(id=attr(rg, 'id') or '%s.%d' % (i, k), source=i, target=t, head='production', points=line[1:-1]))
            else:
                head = MODIFIER.get(ref[2] if ref and ref[2] in MODIFIER else role, 'modulation')
                arcs.append(Arc(id=attr(rg, 'id') or '%s.%d' % (i, k), source=t, target=i, head=head, points=line[::-1][1:-1]))
    for g in all_(lay, 'generalGlyph'):
        skipped.setdefault('general glyph', []).append(attr(g, 'id'))
    drawn = {g for g in (attr(e, 'reaction') for e in all_(lay, 'reactionGlyph'))}
    gone = [r for r in rx if r not in drawn]
    if gone:
        skipped.setdefault('reaction without a glyph', []).extend(gone)
    for what, ids in skipped.items():
        report.say('left out', '%s: %d left out (%s)' % (what, len(ids), ', '.join(map(str, ids[:5])) + (' ...' if len(ids) > 5 else '')))
    return Map(name=re.sub(r'\.(sbml|xml)$', '', os.path.basename(path)), nodes=nodes, arcs=arcs)
