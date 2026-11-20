# Read SBML with its Layout (Level 3 package, or the Level 2 annotation of the same elements) into the map model,
# drawn as the file places it: compartment and species glyphs as boxes, a reaction glyph as a process, its species
# reference glyphs as arcs. Glyph kinds come from SBO terms (SBO below); a species without one is an unspecified
# entity. Colours, outlines and font sizes from Render styles where the file has them. Read only; the rules in
# docs/SBML.md.
import os, re
from collections import defaultdict
from lxml import etree
from . import report, sbgnml
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


GATE = {'AND', 'OR', 'NOT', 'τ'}  # a gate glyph's text, the map's Operator label (graphml.DELAY: τ)
ENDHEAD = {'head_stimulation': 'stimulation', 'head_inhibition': 'inhibition', 'head_necessary_stimulation': 'trigger',
           'head_modulation': 'modulation'}  # sbml.render's line endings
QUAL_HEAD = {'activator': 'stimulation', 'inhibitor': 'inhibition'}


def qual_lines(model, lay, nodes, arcs, glyphs_of):
    # a transition drawn as lines (a general glyph naming it, its reference glyphs: sbml.write_qual): each line from its
    # glyph to the glyph its curve ends at, among the transition's outputs and the gates (its own source too: a node
    # regulating itself), its bends kept, its head from its style's line ending, else from its role; a line into a gate
    # a logic arc. The transitions read so
    heads = {i: attr(kid(st, 'g'), 'endHead') for st in all_(lay, 'style') for i in (attr(st, 'idList') or '').split()}
    outs = {attr(t, 'id'): [g for o in all_(t, 'output') for g in glyphs_of.get(attr(o, 'qualitativeSpecies'), [])]
            for t in all_(model, 'transition')}
    gates = [n for n in nodes.values() if n.kind == 'Operator']
    drawn = set()
    for g in all_(lay, 'generalGlyph'):
        tr = attr(g, 'reference')
        if tr not in outs:
            continue
        for rf in all_(g, 'referenceGlyph'):
            src, line = attr(rf, 'glyph'), points(rf)
            if src not in nodes or len(line) < 2:
                continue
            x, y = line[-1]
            near = lambda n: max(n.box[0] - x, x - n.box[0] - n.box[2], 0) ** 2 + max(n.box[1] - y, y - n.box[1] - n.box[3], 0) ** 2
            t = min([nodes[i] for i in outs[tr] if i in nodes] + [n for n in gates if n.id != src], key=near, default=None)
            if t is None:
                continue
            head = ENDHEAD.get(heads.get(attr(rf, 'id'))) or \
                (None if t.kind == 'Operator' else QUAL_HEAD.get((attr(rf, 'role') or '').lower(), 'modulation'))
            arcs.append(Arc(id=attr(rf, 'id'), source=src, target=t.id, head=head, points=line[1:-1]))
            drawn.add(tr)
    return drawn


def transitions(model, acts, arcs, skipped, drawn=()):
    # SBML-qual transitions not drawn as lines as Activity Flow influences, drawn straight from each input's box to each
    # output's: the sign from the input, else from the function terms (signs)
    for t in all_(model, 'transition'):
        tid = attr(t, 'id')
        if tid in drawn:
            continue
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

    acts, glyphs_of = {}, defaultdict(list)  # a qualitative species' id -> its (first) glyph's id, all its glyphs' ids

    def activity(g, q, b):  # an SBML-qual species drawn as an Activity Flow activity (as sbgnml.read draws one)
        i = attr(g, 'id')
        acts.setdefault(attr(q, 'id'), i)
        glyphs_of[attr(q, 'id')].append(i)
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
    gates = set()
    for g in all_(lay, 'generalGlyph'):  # SBML-qual's boxes (CaSQ, bioLQM): one general glyph per qualitative species
        i, q = attr(g, 'id'), qsp.get(attr(g, 'reference'))
        if text.get(i) in GATE and box(g) is not None:  # a logic gate drawn as such (sbml.write_qual)
            nodes[i] = Node(id=i, kind='Operator', box=box(g), parent=inside(box(g)), labels=[text[i]])
            gates.add(attr(g, 'reference'))
        elif q is not None and box(g) is not None:
            activity(g, q, box(g))
    if qsp:
        gone = [i for i in qsp if i not in acts and i not in gates]
        if gone:
            skipped.setdefault('qualitative species without a box', []).extend(gone)
        drawn = qual_lines(model, lay, nodes, arcs, glyphs_of)
        transitions(model, acts, arcs, skipped, drawn)
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


# Writing: SBML Level 3 Version 1 core with Layout and Render, the map's drawing as its SBGN-ML has it (sbgnml.write:
# glyph boxes, process ports, arc ends and bends) and its meaning from the map's biology (biology.build): one species
# per entity (each source or sink its own), one reaction per process, modifiers by their SBO term. The rules in
# docs/SBML.md, Writing; the specifications in specifications/.
CORE = 'http://www.sbml.org/sbml/level3/version1/core'
LAYOUT = 'http://www.sbml.org/sbml/level3/version1/layout/version1'
XSI = 'http://www.w3.org/2001/XMLSchema-instance'
# the map's glyph -> species SBO term, each one SPECIES reads back as the same glyph
SBO_OF = {'Macromolecule': '0000245', 'Complex': '0000253', 'SimpleChemical': '0000247', 'NucleicAcidFeature': '0000354',
          'UnspecifiedEntity': '0000285', 'Phenotype': '0000358', 'EmptySet': '0000291', 'SourceAndSink': '0000291',
          'Submap': '0000358'}
UNIT_SBO = {'ct:gene': '0000243', 'ct:mRNA': '0000278'}
PROCESS_SBO = {'process': '0000375', 'omitted process': '0000397', 'uncertain process': '0000396',
               'association': '0000177', 'dissociation': '0000180'}
# SBGN-ML arc class -> modifier SBO term and Layout role (MODIFIER reads them back), and what a NOT gate makes of it
MODIFIER_SBO = {'catalysis': '0000013', 'inhibition': '0000020', 'stimulation': '0000459',
                'necessary stimulation': '0000461', 'modulation': '0000594'}
ROLE = {'catalysis': 'modifier', 'inhibition': 'inhibitor', 'stimulation': 'activator', 'necessary stimulation': 'activator',
        'modulation': 'modifier'}
NEGATED = {'catalysis': 'inhibition', 'stimulation': 'inhibition', 'necessary stimulation': 'inhibition',
           'inhibition': 'stimulation', 'modulation': 'modulation'}
GATES = ('and', 'or', 'not')
SHAPE = {'macromolecule': 'rectangle', 'nucleic acid feature': 'rectangle', 'simple chemical': 'ellipse',
         'source and sink': 'ellipse', 'compartment': 'rectangle', 'and': 'ellipse', 'or': 'ellipse', 'not': 'ellipse'}
RADIUS = {'macromolecule': '10', 'nucleic acid feature': '0', 'compartment': '10'}
LAYOUT_ORDER = ('dimensions', 'listOfCompartmentGlyphs', 'listOfSpeciesGlyphs', 'listOfReactionGlyphs', 'listOfTextGlyphs',
                'listOfAdditionalGraphicalObjects', 'listOfRenderInformation')  # the order libSBML writes


def sid(s, used):
    # an SBML SId (letters, digits, underscores, not starting with a digit), unique among those used
    s = re.sub(r'\W', '_', s, flags=re.ASCII)
    s = s if re.match(r'[A-Za-z_]', s) else '_' + s
    k, out = 1, s
    while out in used:
        k += 1; out = '%s_%d' % (s, k)
    used.add(out)
    return out


def num_text(v):
    # a coordinate as written: a file's own text kept, a number as Python writes it
    return v if isinstance(v, str) else str(v) if isinstance(v, int) else repr(float(v))


def compartments(model, nodes, bio, used, needed=False):
    # one compartment per compartment name (biology keys entities by it), 'default' for entities outside any (or when
    # needed): name -> id
    from .biology import label
    ids = {}
    for i, d in nodes.items():
        if d.kind == 'Compartment' and label(d) not in ids:
            ids[label(d)] = sid('c_' + (label(d) or i), used)
    if needed or any(e.key[0] not in ids for e in bio.entities.values()):
        ids.setdefault('default', sid('default', used))
    if ids:
        lc = etree.SubElement(model, 'listOfCompartments')
        for name, c in ids.items():
            el = etree.SubElement(lc, 'compartment', id=c, spatialDimensions='3', size='1', constant='true')
            if name:
                el.set('name', name)
    return ids


def annotate(el, data, links, used):
    # a glyph's own MIRIAM identifiers as RDF (bqbiol:is, or hasVersion for a family's members), with a metaid
    from .annotation import of_node
    ann = of_node(data, links)
    uris = sbgnml.identifiers(ann[1]) if ann else []
    if not uris:
        return
    el.set('metaid', sid('meta_' + el.get('id', el.get('{%s}id' % QUAL, 'x')), used))
    rdf = etree.SubElement(etree.SubElement(el, 'annotation'), '{%s}RDF' % RDF, nsmap={'rdf': RDF, 'bqbiol': sbgnml.BQBIOL})
    desc = etree.SubElement(rdf, '{%s}Description' % RDF, {'{%s}about' % RDF: '#' + el.get('metaid')})
    bag = etree.SubElement(etree.SubElement(desc, '{%s}%s' % (sbgnml.BQBIOL, 'hasVersion' if ann[0] else 'is')), '{%s}Bag' % RDF)
    for u in uris:
        etree.SubElement(bag, '{%s}li' % RDF, {'{%s}resource' % RDF: u})


def lay_el(parent, tag, **a):
    L = '{%s}' % LAYOUT
    return etree.SubElement(parent, L + tag, {L + k: str(v) for k, v in a.items()})


def lay_box(parent, b):
    # a Layout bounding box from (x, y, w, h)
    bb = lay_el(parent, 'boundingBox')
    lay_el(bb, 'position', x=num_text(b[0]), y=num_text(b[1]))
    lay_el(bb, 'dimensions', width=num_text(b[2]), height=num_text(b[3]))


def lay_curve(parent, line):
    # a Layout curve through the points, one line segment each
    segs = lay_el(lay_el(parent, 'curve'), 'listOfCurveSegments')
    for p0, p1 in zip(line, line[1:]):
        sg = lay_el(segs, 'curveSegment'); sg.set('{%s}type' % XSI, 'LineSegment')
        lay_el(sg, 'start', x=repr(float(p0[0])), y=repr(float(p0[1]))); lay_el(sg, 'end', x=repr(float(p1[0])), y=repr(float(p1[1])))


def lay_texts(lay, texts, used):
    # a text glyph per (layout glyph id, text, box, font size, a compartment's): a compartment's name in a strip along its
    # top. The text glyphs' (id, font size), for their styles
    out = []
    texts = [x for x in texts if x[1]]
    if texts:
        lt = lay_el(lay, 'listOfTextGlyphs')
        for g, text, b, font, top in texts:
            t = lay_el(lt, 'textGlyph', id=sid('tg_' + g, used), graphicalObject=g, text=text)
            lay_box(t, (b[0], b[1], b[2], '24' if top else b[3]))
            out.append((t.get('{%s}id' % LAYOUT), font))
    return out


def in_order(lay):
    # a layout's lists in the order libSBML writes them
    for name in LAYOUT_ORDER:
        for c in [c for c in lay if etree.QName(c).localname == name]:
            lay.append(c)


def write(diagram):
    from .biology import label
    from .annotation import uses_links
    N, bio = diagram.nodes, diagram.biology
    G, L, R = '{%s}' % sbgnml.NS, '{%s}' % LAYOUT, '{%s}' % sbgnml.RENDER
    sb = etree.fromstring(sbgnml.write(diagram).encode('utf-8'))
    node_of = {sbgnml.xml_id(i): i for i in N}
    colour_of = {sbgnml.xml_id(a.id): a.line for a in diagram.arcs}
    glyphs = {g.get('id'): g for g in sb.iter(G + 'glyph')}
    port_of = {p.get('id'): g.get('id') for g in glyphs.values() for p in g.findall(G + 'port')}
    cls = lambda g: glyphs[g].get('class')
    arcs = list(sb.iter(G + 'arc'))
    ends = {a: (port_of.get(a.get('source'), a.get('source')), port_of.get(a.get('target'), a.get('target'))) for a in arcs}
    into, out_of = defaultdict(list), defaultdict(list)
    for a in arcs:
        out_of[ends[a][0]].append(a); into[ends[a][1]].append(a)
    pts = {a: [(float(e.get('x')), float(e.get('y'))) for e in a if etree.QName(e).localname in ('start', 'next', 'end')]
           for a in arcs}
    gates = [g for g in glyphs if cls(g) in GATES]  # in the file's order: the output is the same every run
    used, links = set(), uses_links(diagram)
    E = lambda parent, tag, **a: etree.SubElement(parent, tag, {k: str(v) for k, v in a.items()})

    root = etree.Element('{%s}sbml' % CORE, nsmap={None: CORE, 'layout': LAYOUT, 'render': sbgnml.RENDER, 'xsi': XSI},
                         level='3', version='1')
    root.set(L + 'required', 'false'); root.set(R + 'required', 'false')
    model = etree.SubElement(root, 'model', id=sid(diagram.name or 'map', used), name=diagram.name or 'map')

    comp_ids = compartments(model, N, bio, used)

    # species: one per entity; a source or sink drawn several times is several species (SBGN never clones the empty set)
    species_of, lost = {}, []  # glyph node id -> species id
    ls = E(model, 'listOfSpecies') if bio.entities else None
    for e in bio.entities.values():
        d = N[e.glyphs[0]]
        sink = d.kind in ('EmptySet', 'SourceAndSink')
        for gs in ([[g] for g in e.glyphs] if sink else [e.glyphs]):
            s = sid('s_' + (label(d) or d.kind), used)
            term = next((UNIT_SBO[u] for u in d.units if u in UNIT_SBO), SBO_OF.get(d.kind, '0000285'))
            el = E(ls, 'species', id=s, compartment=comp_ids.get(e.key[0], comp_ids.get('default')),
                   hasOnlySubstanceUnits='false', boundaryCondition='true' if sink else 'false', constant='false',
                   sboTerm='SBO:' + term)
            if label(d):
                el.set('name', label(d))
            notes = ['state variable: %s' % (sv.value + ('@' + sv.variable if sv.variable else '')) for sv in e.state_variables if sv.value] + \
                    ['unit of information: %s' % (('%s:' % u.prefix if u.prefix else '') + u.value) for u in sorted(e.units, key=str)
                     if '%s:%s' % (u.prefix, u.value) not in UNIT_SBO] + \
                    (['multimer: %d units' % d.count] if d.count > 1 else []) + (['hypothetical'] if d.dashed else [])
            if notes:
                lost.append(label(d))
                body = etree.SubElement(etree.SubElement(el, 'notes'), '{%s}body' % sbgnml.XH, nsmap={None: sbgnml.XH})
                for line in notes:
                    etree.SubElement(body, '{%s}p' % sbgnml.XH).text = line
            annotate(el, d.data, links, used)  # this entity's own glyph: two entities of one name keep their own identifiers
            for g in gs:
                species_of[g] = s
    if lost:
        report.say('changed', '%d species keep their state variables, units of information or multimer count only in their notes '
                   '(SBML core has no place for them): %s' % (len(lost), ', '.join(sorted(set(lost)))))
    ent = lambda g: species_of.get(node_of.get(g))

    def inputs(g, neg):
        # a gate's inputs down to entities, through gates on gates: [(entity glyph, negated, the arcs from it up to g)]
        out = []
        for b in into[g]:
            s = ends[b][0]
            if b.get('class') != 'logic arc':
                continue
            if s in glyphs and cls(s) in GATES:
                out += [(x, n, chain + [b]) for x, n, chain in inputs(s, neg != (cls(s) == 'not'))]
            elif ent(s):
                out.append((s, neg, [b]))
        return out

    def through(a, c):
        # the modifiers a modifier arc gives: from an entity one, from a gate one per input (a NOT turns its sign)
        s = ends[a][0]
        if ent(s):
            return [(s, c, [a])]
        if s in glyphs and cls(s) in GATES:
            return [(x, NEGATED[c] if n else c, chain + [a]) for x, n, chain in inputs(s, cls(s) == 'not')]
        return []

    # reactions: one per process glyph with a reactant or product
    procs, skipped, gated = [], [], []
    for p in (g for g in glyphs if cls(g) in PROCESS_SBO):
        rev = not any(a.get('class') == 'consumption' for a in into[p])
        items = []  # (list, species glyph, role, SBO term or None, the arcs drawn as its line, line class)
        for a in into[p]:
            s, c = ends[a][0], a.get('class')
            if c == 'consumption' and ent(s):
                items.append(('listOfReactants', s, 'substrate', None, [a], c))
            elif c in MODIFIER_SBO:
                gated += [cls(ends[a][0]).upper()] if ends[a][0] in glyphs and cls(ends[a][0]) in GATES else []
                items += [('listOfModifiers', x, ROLE[k], MODIFIER_SBO[k], chain, k) for x, k, chain in through(a, c)]
        for a in out_of[p]:
            t = ends[a][1]
            if a.get('class') == 'production' and ent(t):
                first = rev and a.get('source', '').endswith('.1')  # a reversible process: its first side the reactants
                items.append(('listOfReactants' if first else 'listOfProducts', t, 'substrate' if first else 'product', None, [a],
                              a.get('class')))
        if not any(k != 'listOfModifiers' for k, *_ in items):
            skipped.append(p); continue
        r = sid('r_' + node_of.get(p, p), used)
        lr = model.find('listOfReactions')
        el = E(lr if lr is not None else E(model, 'listOfReactions'), 'reaction', id=r, reversible='true' if rev else 'false',
               fast='false', sboTerm='SBO:' + PROCESS_SBO[cls(p)])
        refs = []
        for lst in ('listOfReactants', 'listOfProducts', 'listOfModifiers'):
            mine = [x for x in items if x[0] == lst]
            le = E(el, lst) if mine else None
            for _, g, role, term, chain, c in mine:
                ref = sid('sr_%s_%s' % (r, species_of[node_of[g]]), used)
                if term:
                    E(le, 'modifierSpeciesReference', id=ref, species=ent(g), sboTerm='SBO:' + term)
                else:
                    E(le, 'speciesReference', id=ref, species=ent(g), stoichiometry='1', constant='true')
                refs.append((ref, g, role, chain, c))
        procs.append((p, r, refs))
    if skipped:
        report.say('left out', '%d process%s without a reactant or product left out' % (len(skipped), 'es' if len(skipped) > 1 else ''))
    if gated:
        report.say('changed', 'logic gates on processes drawn, their inputs written as modifiers of the process, a NOT input with '
                   'the opposite sign (SBML core has no logic gate): %s' % ', '.join(gated))
    # arcs into an entity (no process): drawings only, as general glyphs
    loose = [(x, k, chain, ends[a][1]) for a in arcs if a.get('class') in MODIFIER_SBO and ent(ends[a][1])
             for x, k, chain in through(a, a.get('class'))]
    if loose:
        report.say('changed', '%d arcs into an entity (no process) kept as drawings only, as SBML core has no influence'
                   % len(loose))
    dropped = sum(1 for a in arcs if a.get('class') == 'equivalence arc') + sum(1 for g in glyphs if cls(g) == 'equivalence')
    if dropped:
        report.say('left out', '%d equivalence arcs and operators left out (no place in SBML core)' % dropped)

    # the layout: the SBGN-ML drawing glyph by glyph
    lay = etree.SubElement(etree.SubElement(model, L + 'listOfLayouts'), L + 'layout')
    lay.set(L + 'id', sid('layout', used))
    LE = lay_el
    boxes = [b for b in sb.iter(G + 'bbox')]
    LE(lay, 'dimensions', width=repr(max([float(b.get('x')) + float(b.get('w')) for b in boxes] or [0]) + 20),
       height=repr(max([float(b.get('y')) + float(b.get('h')) for b in boxes] or [0]) + 20))

    def bbox(parent, g):
        b = glyphs[g].find(G + 'bbox')
        lay_box(parent, (b.get('x'), b.get('y'), b.get('w'), b.get('h')))

    def curve(parent, chain, back=False):
        line = [q for a in chain for q in pts[a]]
        lay_curve(parent, [q for k, q in enumerate(line) if not k or q != line[k - 1]][::-1 if back else 1])

    gid, texts = {}, []  # SBGN-ML glyph -> layout glyph id; (layout glyph id, text, SBGN-ML glyph, a compartment's)
    lines = defaultdict(list)  # (SBGN-ML arc class, colour) -> the layout ids of its curves; ('process', None): reaction glyphs
    comps = [g for g in glyphs if cls(g) == 'compartment' and node_of.get(g)]
    if comps:
        lcg = LE(lay, 'listOfCompartmentGlyphs')
        for g in comps:
            gid[g] = sid('cg_' + g, used)
            bbox(LE(lcg, 'compartmentGlyph', id=gid[g], compartment=comp_ids[label(N[node_of[g]])]), g)
            texts.append((gid[g], label(N[node_of[g]]), g, True))
    sp = [g for g in glyphs if g in species_of or ent(g)]
    if sp:
        lsg = LE(lay, 'listOfSpeciesGlyphs')
        for g in sp:
            gid[g] = sid('sg_' + g, used)
            bbox(LE(lsg, 'speciesGlyph', id=gid[g], species=ent(g)), g)
            texts.append((gid[g], label(N[node_of[g]]), g, False))
    if procs:
        lrg = LE(lay, 'listOfReactionGlyphs')
        for p, r, refs in procs:
            gid[p] = sid('rg_' + p, used)
            rg = LE(lrg, 'reactionGlyph', id=gid[p], reaction=r)
            ports = [(float(q.get('x')), float(q.get('y'))) for q in glyphs[p].findall(G + 'port')]
            if len(ports) == 2:
                segs = LE(LE(rg, 'curve'), 'listOfCurveSegments')
                sg = LE(segs, 'curveSegment'); sg.set('{%s}type' % XSI, 'LineSegment')
                LE(sg, 'start', x=repr(ports[0][0]), y=repr(ports[0][1])); LE(sg, 'end', x=repr(ports[1][0]), y=repr(ports[1][1]))
                lines['process', None].append(gid[p])
            else:
                bbox(rg, p)
            lsr = LE(rg, 'listOfSpeciesReferenceGlyphs')
            for ref, g, role, chain, c in refs:
                srg = LE(lsr, 'speciesReferenceGlyph', id=sid('srg_' + ref, used), speciesReference=ref, speciesGlyph=gid[g],
                         role=role)
                curve(srg, chain, back=c == 'consumption')  # from the process to a reactant or product (Layout 3.10.1)
                lines[c, colour_of.get(chain[0].get('id'))].append(srg.get(L + 'id'))
    # logic gates (their box and name; their lines are drawn with the modifiers above) and the arcs into entities
    if gates or loose:
        lag = LE(lay, 'listOfAdditionalGraphicalObjects')
        for g in gates:
            gid[g] = sid('gg_' + g, used)
            bbox(LE(lag, 'generalGlyph', id=gid[g]), g)
            texts.append((gid[g], cls(g).upper(), g, False))
        for x, c, chain, t in loose:
            gg = LE(lag, 'generalGlyph', id=sid('gi_' + chain[-1].get('id'), used), reference=ent(x))
            lay_box(gg, (0, 0, 0, 0))
            rf = LE(LE(gg, 'listOfReferenceGlyphs'), 'referenceGlyph', id=sid('rf_' + chain[-1].get('id'), used), glyph=gid[t],
                    reference=ent(t), role=ROLE[c])
            curve(rf, chain)
            lines[c, colour_of.get(chain[0].get('id'))].append(rf.get(L + 'id'))
    texts = lay_texts(lay, [(g, text, (lambda b: (b.get('x'), b.get('y'), b.get('w'), b.get('h')))(glyphs[sg].find(G + 'bbox')),
                             N[node_of[sg]].font if node_of.get(sg) else None, top) for g, text, sg, top in texts], used)
    render(lay, [(gid[g], N[node_of[g]], cls(g)) for g in gid if g in node_of and cls(g) not in PROCESS_SBO], lines, texts, used)
    in_order(lay)
    return etree.tostring(root, pretty_print=True, xml_declaration=True, encoding='UTF-8').decode('utf-8')


# SBGN's arc heads as Render line endings, placed on a curve's end point and turned along it (Render C.1): an
# ending's box from that point, its shapes in it (absolute units or percent of the box)
HEADS_R = {
    'production': ((-10, -5, 10, 10), [('polygon', '#000000', [(0, 0), (10, 5), (0, 10)])]),
    'stimulation': ((-12, -6, 12, 12), [('polygon', '#FFFFFF', [(0, 0), (12, 6), (0, 12)])]),
    'catalysis': ((-10, -5, 10, 10), [('ellipse', '#FFFFFF', None)]),
    'inhibition': ((-2, -8, 2, 16), [('rectangle', '#000000', None)]),
    'necessary stimulation': ((-16, -6, 16, 12), [('polygon', '#000000', [(0, 0), (2, 0), (2, 12), (0, 12)]),
                                                  ('polygon', '#FFFFFF', [(4, 0), (16, 6), (4, 12)])]),
    'modulation': ((-12, -6, 12, 12), [('polygon', '#FFFFFF', [(0, 6), (6, 0), (12, 6), (6, 12)])]),
}


def render(lay, shapes, lines, texts, used):
    # Render: every box a style (its fill, outline colour and width, a shape by its SBGN class), every line a style with
    # its head, every label a style with its font size; every attribute written, as Render fixes no defaults
    # (specifications/bergmann-2018.md) and a strict reader draws an unstyled line as nothing
    R, L, X = '{%s}' % sbgnml.RENDER, '{%s}' % LAYOUT, '{%s}' % XSI
    boxes = defaultdict(list)  # shapes: (layout id, the map's node, its SBGN class)
    for lid, d, c in shapes:
        boxes[d.fill or '#FFFFFF', d.line or '#000000', d.weight or 1, SHAPE.get(c, 'rectangle'), RADIUS.get(c, '0')].append(lid)
    fonts = defaultdict(list)
    for t, size in texts:
        fonts[size or 10].append(t)
    if not (boxes or lines or fonts):
        return
    lri = etree.SubElement(lay, R + 'listOfRenderInformation', {R + 'versionMajor': '1', R + 'versionMinor': '0'})
    ri = etree.SubElement(lri, R + 'renderInformation', {R + 'id': sid('render', used), R + 'programName': 'map-converter'})
    heads = [c for c in HEADS_R if any(k == c for k, _ in lines)]
    if heads:
        le = etree.SubElement(ri, R + 'listOfLineEndings')
        for c in heads:
            (x, y, w, h), shapes = HEADS_R[c]
            e = etree.SubElement(le, R + 'lineEnding', {R + 'id': 'head_' + c.replace(' ', '_'), R + 'enableRotationalMapping': 'true'})
            bb = etree.SubElement(e, L + 'boundingBox')
            etree.SubElement(bb, L + 'position', {L + 'x': str(x), L + 'y': str(y)})
            etree.SubElement(bb, L + 'dimensions', {L + 'width': str(w), L + 'height': str(h)})
            g = etree.SubElement(e, R + 'g')
            for shape, fill, ps in shapes:
                el = etree.SubElement(g, R + shape, {R + 'stroke': '#000000', R + 'stroke-width': '1', R + 'fill': fill})
                if shape == 'polygon':
                    lo = etree.SubElement(el, R + 'listOfElements')
                    for px, py in ps:
                        etree.SubElement(lo, R + 'element', {X + 'type': 'RenderPoint', R + 'x': str(px), R + 'y': str(py)})
                elif shape == 'ellipse':
                    el.attrib.update({R + 'cx': '50%', R + 'cy': '50%', R + 'rx': '50%', R + 'ry': '50%'})
                else:
                    el.attrib.update({R + 'x': '0', R + 'y': '0', R + 'width': '100%', R + 'height': '100%'})
    ls = etree.SubElement(ri, R + 'listOfStyles')
    style = lambda name, ids, **a: etree.SubElement(
        etree.SubElement(ls, R + 'style', {R + 'id': sid(name, used), R + 'idList': ' '.join(ids)}), R + 'g',
        {R + k.replace('_', '-'): str(v) for k, v in a.items()})
    for (c, colour), ids in lines.items():
        g = style('line_' + c.replace(' ', '_'), ids, stroke=colour or '#000000', stroke_width=1, fill='none')
        if c in heads:
            g.set(R + 'endHead', 'head_' + c.replace(' ', '_'))
    for (fill, stroke, width, shape, radius), ids in boxes.items():
        g = style('box', ids, stroke=stroke, stroke_width='%g' % width, fill=fill)
        el = etree.SubElement(g, R + shape)
        if shape == 'ellipse':
            el.attrib.update({R + 'cx': '50%', R + 'cy': '50%', R + 'rx': '50%', R + 'ry': '50%'})
        else:
            el.attrib.update({R + 'x': '0', R + 'y': '0', R + 'width': '100%', R + 'height': '100%', R + 'rx': radius, R + 'ry': radius})
    for size, ids in fonts.items():
        style('text', ids, stroke='#000000', font_family='sans-serif', font_size='%g' % size, text_anchor='middle',
              vtext_anchor='middle')


# Writing SBML-qual: an Activity Flow map as a logical model (the qual package, specifications/chaouiya-2015.md) with its
# drawing in Layout and Render. One qualitative species per activity (maxLevel 1), one transition per activity that has
# influences in, its rule by the Activity Flow to Boolean rules (pd2af-converter rules B1, B5, B6): on when any positive
# influence is on, every necessary stimulation is on and no negative influence is on; a node with negative influences
# only is on unless one of them is; logic gates as drawn (AND, OR, NOT, gates on gates); a delay a variable of its own
# that copies its input; a node with no influence in an input (constant). An unknown influence is drawn and listed as
# an input of sign unknown, not in the rule. The rules in docs/SBML.md, SBML-qual.
QUAL = 'http://www.sbml.org/sbml/level3/version1/qual/version1'
MATHML = 'http://www.w3.org/1998/Math/MathML'
SIGN = {'stimulation': 'positive', 'catalysis': 'positive', 'trigger': 'positive', 'inhibition': 'negative',
        'modulation': 'unknown'}
AF_CLASS = {'stimulation': 'stimulation', 'catalysis': 'stimulation', 'trigger': 'necessary stimulation',
            'inhibition': 'inhibition', 'modulation': 'modulation', None: 'logic arc'}
QUAL_ROLE = {'stimulation': 'activator', 'necessary stimulation': 'activator', 'inhibition': 'inhibitor',
             'modulation': 'modifier', 'logic arc': 'modifier'}


def bnet(f):
    # a rule as text, in the .bnet notation (& | ! 1), for the transition's notes and the messages
    if f[0] == 'var':
        return f[1]
    if f[0] == 'true':
        return '1'
    if f[0] == 'not':
        x = bnet(f[1])
        return '!' + (x if f[1][0] in ('var', 'true') else '(%s)' % x)
    return (' & ' if f[0] == 'and' else ' | ').join(bnet(x) if x[0] in ('var', 'true', 'not') or x[0] == f[0] else '(%s)' % bnet(x)
                                                     for x in f[1])


def mathml(parent, f):
    M = '{%s}' % MATHML
    if f[0] == 'var':  # the level compared with 1: qual asks for a boolean, never a bare level (3.6.5)
        a = etree.SubElement(parent, M + 'apply')
        etree.SubElement(a, M + 'eq'); etree.SubElement(a, M + 'ci').text = f[1]
        etree.SubElement(a, M + 'cn', type='integer').text = '1'
    elif f[0] == 'true':
        etree.SubElement(parent, M + 'true')
    else:
        a = etree.SubElement(parent, M + 'apply')
        etree.SubElement(a, M + f[0])
        for x in ([f[1]] if f[0] == 'not' else f[1]):
            mathml(a, x)


def write_qual(diagram):
    from .biology import label, PROCESSES
    from .graphml import DELAY
    from .layout import centre
    from .annotation import uses_links
    # an Activity Flow map: no process glyph, and influences between activities (a map of entities and plain lines
    # alone, a Process Description fragment, gives none). A Process Description map's Boolean model comes from its
    # Activity Flow (PD to AF first)
    if any(d.kind in PROCESSES for d in diagram.nodes.values()) or not any(a.head in SIGN for a in diagram.arcs):
        return None
    m = sbgnml.shifted(diagram)
    N, bio = m.nodes, m.biology
    L, R, Q = '{%s}' % LAYOUT, '{%s}' % sbgnml.RENDER, '{%s}' % QUAL
    used, links, said = set(), uses_links(m), []
    root = etree.Element('{%s}sbml' % CORE, nsmap={None: CORE, 'qual': QUAL, 'layout': LAYOUT, 'render': sbgnml.RENDER,
                                                     'xsi': XSI}, level='3', version='1')
    root.set(Q + 'required', 'true'); root.set(L + 'required', 'false'); root.set(R + 'required', 'false')
    model = etree.SubElement(root, 'model', id=sid(m.name or 'map', used), name=m.name or 'map')
    QE = lambda parent, tag, **a: etree.SubElement(parent, Q + tag, {Q + k: str(v) for k, v in a.items()})
    comp_ids = compartments(model, N, bio, used, needed=True)

    into, out_of = defaultdict(list), defaultdict(list)
    for a in m.arcs:
        into[a.target].append(a); out_of[a.source].append(a)
    ops = {i for i, d in N.items() if d.kind == 'Operator'}
    gate = lambda i: 'delay' if (N[i].labels or [''])[0] == DELAY else (N[i].labels or [''])[0].upper()
    qs = {e.id: sid(label(N[e.glyphs[0]]) or N[e.glyphs[0]].kind, used) for e in bio.entities.values()}
    var = lambda i: qs[bio.glyph[i]]
    delays = {}  # a delay gate -> the node that copies its input
    for i in (i for i in ops if gate(i) == 'delay'):
        src = [b.source for b in into[i] if b.source in bio.glyph]
        delays[i] = sid('delay_' + (var(src[0]) if src else i), used)

    def term(i, seen=()):
        # what a glyph stands for in a rule: an activity's level, or a gate's function of its inputs (every line into
        # a gate is an input, whatever its head)
        if i in bio.glyph:
            return ('var', var(i))
        if i not in ops or i in seen:
            return None
        if i in delays:
            return ('var', delays[i])
        ins = [t for b in into[i] for t in [term(b.source, seen + (i,))] if t]
        k = gate(i)
        if not ins:
            said.append('%s gate without an input, left out' % k)
            return None
        if k == 'NOT':
            if len(ins) > 1:
                said.append('NOT gate with %d inputs read as NOT of their OR' % len(ins))
            return ('not', ins[0] if len(ins) == 1 else ('or', ins))
        if k in ('AND', 'OR'):
            return (k.lower(), ins) if len(ins) > 1 else ins[0]
        said.append('%s gate: no Boolean meaning, left out' % k)
        return None

    def polarity(f, neg=False, out=None):
        # each variable of a rule with its sign: positive, negative, or dual where it appears both ways
        out = {} if out is None else out
        if f[0] == 'var':
            v = 'negative' if neg else 'positive'
            out[f[1]] = v if out.get(f[1], v) == v else 'dual'
        elif f[0] in ('and', 'or', 'not'):
            for x in ([f[1]] if f[0] == 'not' else f[1]):
                polarity(x, neg != (f[0] == 'not'), out)
        return out

    rules, unknown_of, unknown = {}, {}, []
    for e in bio.entities.values():
        arcs = [a for g in e.glyphs for a in into[g]]
        kind = lambda a: a.head if a.head in SIGN else 'stimulation' if a.head is None and a.source in ops else None
        terms = lambda h: [t for a in arcs if kind(a) in h for t in [term(a.source)] if t]
        pos, nec, neg, unk = terms(('stimulation', 'catalysis')), terms(('trigger',)), terms(('inhibition',)), terms(('modulation',))
        v = qs[e.id]
        if unk:
            unknown.append(label(N[e.glyphs[0]]))
            unknown_of[v] = unk
        if pos or nec or neg:
            parts = ([('or', pos) if len(pos) > 1 else pos[0]] if pos else []) + nec + [('not', x) for x in neg]
            rules[v] = ('and', parts) if len(parts) > 1 else parts[0]
        elif unk:
            rules[v] = ('var', v)  # unknown influences only: the node keeps its level, as an input does
    for i, v in delays.items():
        ins = [t for b in into[i] for t in [term(b.source)] if t]
        if ins:
            rules[v] = ins[0] if len(ins) == 1 else ('or', ins)
        else:
            said.append('delay without an input, left out')

    lq = QE(model, 'listOfQualitativeSpecies')
    for e in bio.entities.values():
        d = N[e.glyphs[0]]
        el = QE(lq, 'qualitativeSpecies', id=qs[e.id], compartment=comp_ids.get(e.key[0], comp_ids['default']),
                constant='false' if qs[e.id] in rules else 'true', maxLevel=1)
        if label(d):
            el.set(Q + 'name', label(d))
        annotate(el, d.data, links, used)
    for i, v in delays.items():
        src = [b.source for b in into[i] if b.source in bio.glyph]
        QE(lq, 'qualitativeSpecies', id=v, name='delay of %s' % label(N[src[0]]) if src else 'delay', compartment=comp_ids['default'],
           constant='false' if v in rules else 'true', maxLevel=1)

    transition_of = {}
    if rules:
        lt = QE(model, 'listOfTransitions')
        for v, f in rules.items():
            t = transition_of[v] = sid('tr_' + v, used)
            el = QE(lt, 'transition', id=t)
            body = etree.SubElement(etree.SubElement(el, 'notes'), '{%s}body' % sbgnml.XH, nsmap={None: sbgnml.XH})
            etree.SubElement(body, '{%s}p' % sbgnml.XH).text = '%s = %s' % (v, bnet(f))
            ins = polarity(f)
            for x in unknown_of.get(v, []):
                for k in polarity(x):
                    ins.setdefault(k, 'unknown')
            li = QE(el, 'listOfInputs')
            for x, sg in ins.items():
                QE(li, 'input', id=sid('in_%s_%s' % (v, x), used), qualitativeSpecies=x, transitionEffect='none', sign=sg,
                   thresholdLevel=1)
            QE(QE(el, 'listOfOutputs'), 'output', id=sid('out_%s' % v, used), qualitativeSpecies=v, transitionEffect='assignmentLevel')
            lf = QE(el, 'listOfFunctionTerms')
            mathml(etree.SubElement(QE(lf, 'functionTerm', resultLevel=1), '{%s}math' % MATHML, nsmap={None: MATHML}), f)
            QE(lf, 'defaultTerm', resultLevel=0)
    if unknown:
        report.say('changed', 'unknown influences drawn and listed as inputs of sign unknown, not in the rule of: %s'
                   % ', '.join(sorted(set(unknown))))
    for line in sorted(set(said)):
        report.say('left out' if 'left out' in line else 'changed', line)
    n = len(qs) + len(delays)
    report.say('summary', '%d nodes, %d rules, %d inputs' % (n, len(rules), n - len(rules)))

    # the drawing: activities and gates as general glyphs (an activity's glyph names its qualitative species, as CaSQ
    # and bioLQM write them), each transition a general glyph whose reference glyphs are its lines, as drawn
    lay = etree.SubElement(etree.SubElement(model, L + 'listOfLayouts'), L + 'layout')
    lay.set(L + 'id', sid('layout', used))
    lay_el(lay, 'dimensions', width=repr(max(d.box[0] + d.box[2] for d in N.values()) + 20),
           height=repr(max(d.box[1] + d.box[3] for d in N.values()) + 20))
    gid, texts, shapes, lines = {}, [], [], defaultdict(list)
    comps = [i for i, d in N.items() if d.kind == 'Compartment']
    if comps:
        lcg = lay_el(lay, 'listOfCompartmentGlyphs')
        for i in comps:
            gid[i] = sid('cg_' + i, used)
            lay_box(lay_el(lcg, 'compartmentGlyph', id=gid[i], compartment=comp_ids[label(N[i])]), N[i].box)
            texts.append((gid[i], label(N[i]), N[i].box, N[i].font, True))
            shapes.append((gid[i], N[i], 'compartment'))
    lag = lay_el(lay, 'listOfAdditionalGraphicalObjects')
    for i, d in N.items():
        if i in bio.glyph or i in ops:
            gid[i] = sid(('qg_' if i in bio.glyph else 'og_') + i, used)
            ref = var(i) if i in bio.glyph else delays.get(i)
            lay_box(lay_el(lag, 'generalGlyph', id=gid[i], **({'reference': ref} if ref else {})), d.box)
            texts.append((gid[i], label(d) if i in bio.glyph else ('τ' if i in delays else gate(i)), d.box, d.font, False))
            shapes.append((gid[i], d, 'and' if i in ops else 'macromolecule' if d.kind == 'Macromolecule' else d.kind.lower()))

    def owner(a):
        # the transition a line belongs to: its target's, else the first transition found through the gates it feeds
        todo, seen = [a.target], set()
        while todo:
            t = todo.pop(0)
            tr = transition_of.get(var(t)) if t in bio.glyph else transition_of.get(delays.get(t))
            if tr:
                return tr
            if t in ops and t not in seen and t not in delays:
                seen.add(t)
                todo += [b.target for b in out_of[t]]
        return None
    hub, left = {}, 0
    for a in m.arcs:
        t = owner(a)
        if t is None or a.source not in gid or a.target not in gid or a.source in comps or a.target in comps:
            left += 1
            continue
        if t not in hub:
            hub[t] = lay_el(lag, 'generalGlyph', id=sid('trg_' + t, used), reference=t)
            lay_box(hub[t], (0, 0, 0, 0))
            lay_el(hub[t], 'listOfReferenceGlyphs')
        c = AF_CLASS.get(a.head, 'logic arc') if a.target in ops or a.head is not None else 'stimulation'
        rf = lay_el(hub[t].find(L + 'listOfReferenceGlyphs'), 'referenceGlyph', id=sid('rf_' + a.id, used), glyph=gid[a.source],
                    role=QUAL_ROLE[c], **({'reference': var(a.source)} if a.source in bio.glyph else {}))
        s_, t_ = N[a.source], N[a.target]
        nxt = a.points[0] if a.points else centre(t_)
        prv = a.points[-1] if a.points else centre(s_)
        p0 = (centre(s_)[0] + a.source_at[0], centre(s_)[1] + a.source_at[1]) if any(a.source_at) else sbgnml.border(s_, nxt)
        p1 = (centre(t_)[0] + a.target_at[0], centre(t_)[1] + a.target_at[1]) if any(a.target_at) else sbgnml.border(t_, prv)
        lay_curve(rf, [p0] + list(a.points) + [p1])
        lines[c, a.line].append(rf.get(L + 'id'))
    if left:
        report.say('left out', '%d lines not drawn: they carry no rule (to or from a compartment, or into a gate that leads '
                   'to none)' % left)
    if not len(lag):
        lay.remove(lag)
    texts = lay_texts(lay, texts, used)
    render(lay, shapes, lines, texts, used)
    in_order(lay)
    return etree.tostring(root, pretty_print=True, xml_declaration=True, encoding='UTF-8').decode('utf-8')
