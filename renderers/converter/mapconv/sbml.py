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
POINT = (60.0, 30.0)  # px, a species given as a point drawn at this size round it
SINK = 20  # px, the least side of a source or sink, drawn as a circle round its glyph's centre (COPASI gives a point, 1 by 1)


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
    if p is None:
        return None
    f = lambda e, k: float(attr(e, k) or 0)  # no dimensions: a point (MonaLisa's Petri net places)
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


def signs(t):
    # a transition's inputs read from its function terms where the inputs give no sign: id -> 'positive', 'negative' or
    # 'dual', by what each is compared with where the result is reached (= 0 or < 1: negative; = 1 or more: positive)
    out = {}
    for ft in all_(t, 'functionTerm'):
        for a in all_(ft, 'apply'):
            c = [x for x in a if isinstance(x.tag, str)]
            if len(c) != 3 or etree.QName(c[0]).localname not in ('eq', 'geq', 'gt', 'lt', 'leq'):
                continue
            ci = next((x.text.strip() for x in c[1:] if etree.QName(x).localname == 'ci' and x.text), None)
            cn = next((num(x.text) for x in c[1:] if etree.QName(x).localname == 'cn'), None)
            if ci is None or cn is None:
                continue
            op = etree.QName(c[0]).localname
            neg = (op == 'eq' and cn == 0) or (op in ('lt', 'leq') and cn <= 1)
            v = 'negative' if neg else 'positive'
            out[ci] = v if out.get(ci, v) == v else 'dual'
    return out


INFLUENCE = {'positive': 'stimulation', 'negative': 'inhibition'}  # Activity Flow's influences (sbgnml.HEAD); else modulation


def transitions(model, acts, arcs, skipped):
    # SBML-qual transitions as Activity Flow influences, drawn straight from each input's box to each output's: the sign
    # from the input, else from the function terms (signs)
    for t in all_(model, 'transition'):
        tid = attr(t, 'id')
        outs = [attr(o, 'qualitativeSpecies') for o in all_(t, 'output')]
        ins = [(attr(x, 'qualitativeSpecies'), attr(x, 'sign')) for x in all_(t, 'input')]
        read = signs(t)
        if not ins:
            ins = [(i, None) for i in read]
        k = 0
        for q, sign in ins:
            for o in outs:
                if q not in acts or o not in acts:
                    skipped.setdefault('influence to or from a species without a box', []).append(tid); continue
                arcs.append(Arc(id='%s.%d' % (tid, k), source=acts[q], target=acts[o],
                                head=INFLUENCE.get(sign if sign in INFLUENCE else read.get(q), 'modulation')))
                k += 1


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
    qsp = {attr(e, 'id'): e for e in all_(model, 'qualitativeSpecies')}  # SBML-qual: activities, drawn as Activity Flow
    refs = {}  # reaction id -> [(role, species, SBO term, the reference's id)]
    for i, r in rx.items():
        for lst, role in (('listOfReactants', 'substrate'), ('listOfProducts', 'product'), ('listOfModifiers', 'modifier')):
            for s in (kids(kid(r, lst), 'speciesReference') + kids(kid(r, lst), 'modifierSpeciesReference')) if kid(r, lst) is not None else []:
                refs.setdefault(i, []).append((role, s.get('species'), sbo(s), s.get('id')))
    text = {}  # glyph id -> its text glyph's text
    for t in all_(lay, 'textGlyph'):
        g, o = attr(t, 'graphicalObject'), attr(t, 'originOfText')
        e = next((d[o] for d in (sp, comp, rx, qsp) if o in d), None)
        v = attr(t, 'text') or (e.get('name') or e.get('id') if e is not None else None)
        if g and v and g not in text:
            text[g] = v  # 'unset': COPASI's text for a glyph it has no name for
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

    acts = {}  # a qualitative species' id -> its glyph's id

    def activity(g, q, b):  # an SBML-qual species drawn as an Activity Flow activity (as sbgnml.read draws one)
        i = attr(g, 'id')
        acts.setdefault(attr(q, 'id'), i)
        nodes[i] = Node(id=i, kind='Macromolecule', box=b, parent=inside(b),
                        labels=[(text.get(i) if text.get(i) != 'unset' else None) or attr(q, 'name') or attr(q, 'id')],
                        data=dict(annotations(q), **{'SBGN class': 'biological activity'}))

    for g in all_(lay, 'speciesGlyph'):
        i, ref = attr(g, 'id'), attr(g, 'species')
        if ref in qsp:  # a qualitative species given a species glyph (Path2Models)
            if box(g) is None:
                skipped.setdefault('species glyph without a box', []).append(i)
            else:
                activity(g, qsp[ref], box(g))
            continue
        s = sp.get(ref) if ref else meta.get(attr(g, 'metaidRef'))
        b = box(g)
        if b is None:
            skipped.setdefault('species glyph without a box', []).append(i); continue
        named = ref or attr(g, 'metaidRef')
        sink = s is None and not named and text.get(i, 'unset') == 'unset'  # no species, no text: a source or sink (COPASI)
        if s is None and not sink:
            skipped.setdefault('species glyph naming no species of the model (drawn as an unspecified entity)', []).append(i)
        k = SPECIES.get(sbo(s) if s is not None else '', 'UnspecifiedEntity')
        kind, units = (k, []) if isinstance(k, str) else (k[0], [k[1]])
        if not sink and (b[2] < 1 or b[3] < 1):  # a point: a glyph of the usual size round it
            b = (b[0] - POINT[0] / 2, b[1] - POINT[1] / 2) + POINT
        if sink:
            kind, units = 'EmptySet', []
            if b[2] != b[3] or b[2] < SINK:  # a circle of its own size round the glyph's centre, never a stretched one
                d = max(SINK, min(b[2], b[3]))
                b = (b[0] + b[2] / 2 - d / 2, b[1] + b[3] / 2 - d / 2, d, d)
        nodes[i] = Node(id=i, kind=kind, box=b, units=units, parent=inside(b), species=s.get('id') if s is not None else None,
                        labels=['' if kind == 'EmptySet' else ((text.get(i) if text.get(i) != 'unset' else None) or (s.get('name') or s.get('id') if s is not None else ''))],
                        data=annotations(s) if s is not None else {})
    for g in all_(lay, 'generalGlyph'):  # SBML-qual's boxes (CaSQ, bioLQM): one general glyph per qualitative species
        q = qsp.get(attr(g, 'reference'))
        if q is not None and box(g) is not None:
            activity(g, q, box(g))
    if qsp:
        gone = [i for i in qsp if i not in acts]
        if gone:
            skipped.setdefault('qualitative species without a box', []).extend(gone)
        transitions(model, acts, arcs, skipped)
    if not any(n.kind != 'Compartment' for n in nodes.values()):
        raise ValueError('no species glyph in its layout: nothing to draw')
    cx = [n for n in nodes.values() if n.kind == 'Complex']
    for n in nodes.values():  # a glyph lying within a complex's box is its member (MINERVA draws members as species glyphs)
        x, y, w, h = n.box
        hold = [c for c in cx if c is not n and c.box[0] <= x and c.box[1] <= y and x + w <= c.box[0] + c.box[2]
                and y + h <= c.box[1] + c.box[3] and c.box[2] * c.box[3] > w * h]
        if n.kind != 'Compartment' and hold:
            n.parent = min(hold, key=lambda c: c.box[2] * c.box[3]).id
    drawn_as = {}  # a species' id -> its first glyph
    for n in nodes.values():
        if n.species:
            drawn_as.setdefault(n.species, n.id)
    for g in all_(lay, 'reactionGlyph'):
        i, r = attr(g, 'id'), rx.get(attr(g, 'reaction'))
        pts, b = points(g), box(g)
        ends = [nodes[t] for t in (attr(e, 'speciesGlyph') for e in all_(g, 'speciesReferenceGlyph')) if t in nodes]
        if pts:  # the reaction's own curve: the process at its middle
            x, y = (pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2
        elif b is not None and (b[2] or b[3]):
            x, y = b[0] + b[2] / 2, b[1] + b[3] / 2
        elif b is not None and (b[0] or b[1]):
            x, y = b[0], b[1]
        elif ends:  # no place in the file (a box of 0 by 0 at 0, 0): the middle of the glyphs it joins
            x = sum(n.box[0] + n.box[2] / 2 for n in ends) / len(ends)
            y = sum(n.box[1] + n.box[3] / 2 for n in ends) / len(ends)
            skipped.setdefault('reaction glyph without a place (drawn amid its species)', []).append(i)
        else:
            skipped.setdefault('reaction glyph without a place (its lines with it)', []).append(i); continue
        side = min(b[2], b[3]) if b is not None and 8 <= min(b[2], b[3]) <= 40 else PROCESS
        kind, cls = REACTION.get(sbo(r) if r is not None else '', ('Process', None))
        nodes[i] = Node(id=i, kind=kind, box=(x - side / 2, y - side / 2, side, side), labels=[''],
                        data=dict(annotations(r) if r is not None else {}, **({'SBGN class': cls} if cls else {})))
        used = []
        if not all_(g, 'speciesReferenceGlyph'):  # a reaction glyph with no lines (MonaLisa): its reaction's, drawn straight
            for k, (role, spc, term, _) in enumerate(refs.get(attr(g, 'reaction'), [])):
                t = drawn_as.get(spc)
                if t is None:
                    skipped.setdefault('line to a species with no glyph', []).append('%s.%d' % (i, k)); continue
                head = 'production' if role == 'product' else None if role == 'substrate' else \
                    MODIFIER.get(term) if term in MODIFIER and term != '0000019' else 'modulation'
                s_, t_ = (i, t) if role == 'product' else (t, i)
                arcs.append(Arc(id='%s.%d' % (i, k), source=s_, target=t_, head=head))
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
        if attr(g, 'id') not in nodes:
            skipped.setdefault('general glyph', []).append(attr(g, 'id'))
    drawn = {g for g in (attr(e, 'reaction') for e in all_(lay, 'reactionGlyph'))}
    gone = [r for r in rx if r not in drawn]
    if gone:
        skipped.setdefault('reaction without a glyph', []).extend(gone)
    for what, ids in skipped.items():
        report.say('left out', '%s: %d left out (%s)' % (what, len(ids), ', '.join(map(str, ids[:5])) + (' ...' if len(ids) > 5 else '')))
    return Map(name=re.sub(r'\.(sbml|xml)$', '', os.path.basename(path)), nodes=nodes, arcs=arcs)
