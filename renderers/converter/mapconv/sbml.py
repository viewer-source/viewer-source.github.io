# Read SBML with its Layout (Level 3 package, or the Level 2 annotation of the same elements) into the map model,
# drawn as the file places it: compartment and species glyphs as boxes, a reaction glyph as a process, its species
# reference glyphs as arcs. Glyph kinds come from SBO terms (SBO below); a species without one is an unspecified
# entity. Colours, outlines and font sizes from Render styles where the file has them. Read only; the rules in
# docs/SBML.md.
import os, re
from lxml import etree
from . import report
from .annotation import to_properties
from .model import Map, Node, Arc
from .sbgnml import colour, urn

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
            if e is not None and num(attr(e, 'x')) is not None and num(attr(e, 'y')) is not None:
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


def styles(model, lay):
    # Render: glyph id or glyph type -> its style's fill, stroke, stroke-width and font-size, from its first shape
    # where the shape sets them (what is drawn), else from the style's group; the layout's own styles over the global ones
    defs, by_id, by_type = {}, {}, {}
    glob = [e for e in all_(model, 'listOfGlobalRenderInformation')]
    local = [e for e in all_(lay, 'listOfRenderInformation')]
    for ri in glob + local:
        defs.update({attr(c, 'id'): attr(c, 'value') for c in all_(ri, 'colorDefinition')})
        for st in all_(ri, 'style'):
            g = kid(st, 'g')
            if g is None:
                continue
            shape = next((c for c in g if isinstance(c.tag, str)), None)
            v = {k: attr(shape, k) or attr(g, k) for k in ('fill', 'stroke', 'stroke-width', 'font-size')}  # a shape's own over its group's
            v = {k: x for k, x in v.items() if x}
            for i in (attr(st, 'idList') or '').split():
                by_id[i] = v
            for t in (attr(st, 'typeList') or '').split():
                by_type[t.upper()] = v
    return defs, by_id, by_type


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


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
    meta = {e.get('metaid'): e for e in model.iter(etree.Element) if e.get('metaid')}
    rx = {e.get('id'): e for e in all_(model, 'reaction')}
    refs = {}  # reaction id -> [(role, species, SBO term, the reference's id)]
    for i, r in rx.items():
        for lst, role in (('listOfReactants', 'substrate'), ('listOfProducts', 'product'), ('listOfModifiers', 'modifier')):
            for s in (kids(kid(r, lst), 'speciesReference') + kids(kid(r, lst), 'modifierSpeciesReference')) if kid(r, lst) is not None else []:
                refs.setdefault(i, []).append((role, s.get('species'), sbo(s), s.get('id')))
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
        i, ref = attr(g, 'id'), attr(g, 'species')
        s = sp.get(ref) if ref else meta.get(attr(g, 'metaidRef'))
        b = box(g)
        if b is None:
            skipped.setdefault('species glyph without a box', []).append(i); continue
        if s is None:
            skipped.setdefault('species glyph naming no species of the model (drawn as an unspecified entity)', []).append(i)
        k = SPECIES.get(sbo(s) if s is not None else '', 'UnspecifiedEntity')
        kind, units = (k, []) if isinstance(k, str) else (k[0], [k[1]])
        nodes[i] = Node(id=i, kind=kind, box=b, units=units, parent=inside(b), species=s.get('id') if s is not None else None,
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
            skipped.setdefault('reaction glyph without a place (its lines with it)', []).append(i); continue
        side = min(b[2], b[3]) if b is not None and 8 <= min(b[2], b[3]) <= 40 else PROCESS
        kind, cls = REACTION.get(sbo(r) if r is not None else '', ('Process', None))
        nodes[i] = Node(id=i, kind=kind, box=(x - side / 2, y - side / 2, side, side), labels=[''],
                        data=dict(annotations(r) if r is not None else {}, **({'SBGN class': cls} if cls else {})))
        used = []
        for k, rg in enumerate(all_(g, 'speciesReferenceGlyph')):
            t, aid = attr(rg, 'speciesGlyph'), attr(rg, 'id') or '%s.%d' % (i, k)
            if not t:
                skipped.setdefault('line naming no species glyph', []).append(aid); continue
            if t not in nodes:
                skipped.setdefault('line to a glyph left out', []).append(aid); continue
            # its species reference: by id, else by the species its glyph draws
            # (a species in two roles of one reaction: its glyphs take the references in their order, each once)
            mine = refs.get(attr(g, 'reaction'), [])
            hit = [e for e in mine if e[3] and e[3] == attr(rg, 'speciesReference')] or \
                  [e for e in mine if e[1] == nodes[t].species and e not in used] or \
                  [e for e in mine if e[1] == nodes[t].species]
            ref = hit[0] if hit else None
            used.append(ref)
            role = (attr(rg, 'role') or (ref[0] if ref else '')).lower()
            line = points(rg)
            if len(line) > 1:  # the curve set to run from the species: the specification leaves its direction open
                (cx, cy), d = (nodes[t].box[0] + nodes[t].box[2] / 2, nodes[t].box[1] + nodes[t].box[3] / 2), lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2
                if d(line[-1]) < d(line[0]):
                    line = line[::-1]
            inner = line[1:-1]
            if role in ('substrate', 'sidesubstrate'):
                arcs.append(Arc(id=aid, source=t, target=i, points=inner))
            elif role in ('product', 'sideproduct'):
                arcs.append(Arc(id=aid, source=i, target=t, head='production', points=inner[::-1]))
            else:
                term = ref[2] if ref else ''
                head = MODIFIER.get(term) if term in MODIFIER and term != '0000019' else MODIFIER.get(role, 'modulation')
                arcs.append(Arc(id=aid, source=t, target=i, head=head, points=inner))
    defs, by_id, by_type = styles(model, lay)
    kinds = {'Compartment': 'COMPARTMENTGLYPH'}
    for n in nodes.values():
        st = by_id.get(n.id) or by_type.get(kinds.get(n.kind, 'REACTIONGLYPH' if n.kind.endswith('Process') else 'SPECIESGLYPH')) or by_type.get('ANY') or {}
        if n.kind not in ('Process', 'OmittedProcess', 'UncertainProcess', 'EmptySet'):
            n.fill = colour(st.get('fill'), defs)
        if n.kind == 'Compartment':
            c = colour(st.get('stroke'), defs)
            n.line = c if c not in (None, '#000000') else None
            n.weight = num(st.get('stroke-width'))
    for t in all_(lay, 'textGlyph'):  # a label's font size from its text glyph's style
        g, st = attr(t, 'graphicalObject'), by_id.get(attr(t, 'id')) or by_type.get('TEXTGLYPH') or {}
        if g in nodes and num(st.get('font-size')):
            nodes[g].font = num(st.get('font-size'))
    for a in arcs:
        st = by_id.get(a.id) or by_type.get('SPECIESREFERENCEGLYPH') or {}
        c = colour(st.get('stroke'), defs)
        a.line = c if c not in (None, '#000000') else None
    for g in all_(lay, 'generalGlyph'):
        skipped.setdefault('general glyph', []).append(attr(g, 'id'))
    drawn = {g for g in (attr(e, 'reaction') for e in all_(lay, 'reactionGlyph'))}
    gone = [r for r in rx if r not in drawn]
    if gone:
        skipped.setdefault('reaction without a glyph', []).extend(gone)
    for what, ids in skipped.items():
        report.say('left out', '%s: %d left out (%s)' % (what, len(ids), ', '.join(map(str, ids[:5])) + (' ...' if len(ids) > 5 else '')))
    return Map(name=re.sub(r'\.(sbml|xml)$', '', os.path.basename(path)), nodes=nodes, arcs=arcs)
