# The viewer's editor on a CellDesigner file (user, 2026-11-12: "basically yEd experience with CD"). The editor edits
# yEd GraphML; so a CellDesigner file is given to it as GraphML (graphml()), and what it changed there is written back
# into the CellDesigner file's text (apply()): only the numbers that change, everything else byte for byte, so
# CellDesigner opens it as it was, with the moves.
#   compartments, complexes and aliases are the GraphML's groups and nodes (a complex holds its members, a compartment
#   what names it as compartmentAlias, and the compartments inside it); each reaction's process glyph is a node of
#   10 by 10 (id <reaction>|proc), and its lines are arcs: |a reactant to glyph, |b glyph to product (|a alone, reactant
#   to product, for a reaction drawn without a glyph), |m<i> modifier i to the glyph, |r<i> and |p<i> added reactants
#   and products. Ports are where the lines meet the nodes (connection points), bends the edit points, absolute.
#   Bend points stay where they are when a node moves (user, 2026-11-12: yEd's way, not CellDesigner's, where they
#   live in the frame of the line's ends and stretch): they are written again in the frame of the new ends.
#   CellDesigner's own model of a reaction (user, 2026-11-13: "build in Cell Designer's own model"): one link, its main
#   line the two ends and the anchor points the user puts or removes; the square midway on segment rectangleIndex (|a holds
#   the anchor points before that segment, |b the rest); added reactants and products joined at 3/8 and 5/8 of that
#   segment (the antennas' ends), modifiers at the square's spots; all of it worked out again from those numbers.
#   The glyph sits midway on the segment of the main line it is on (rectangleIndex), wherever that goes. It is never
#   moved by itself (user, 2026-11-12: "in CellDesigner, it's not possible to move process itself"; the editor does not
#   let it), and no bend point is ever added to make up for a move: the line changes only by the anchor (bend) points the
#   user puts and moves. (Before, a glyph moved took its segment and an end at a node became a new bend point.)
#   Left as they are, drawn but not editable: logic gates, associations and dissociations (their geometry stays in
#   CellDesigner's frames, so it stretches with the nodes).
#   For the layout skill's Pack and Snap map to grid (user, 2026-11-13), the GraphML also carries each complex's name as an
#   inside bottom label and the marks round an alias (residues, structural states, an open unit of information) as state
#   labels, so the tools leave them room; nothing reads them back.
#     graphml(cd_text) -> GraphML text;  apply(cd_text, graphml_text) -> CellDesigner text
import io, math, re
from xml.sax.saxutils import escape
from lxml import etree
import cdrender
from cdrender import NS, edit_points, unit
from mapconv.cd_layout import SQUARE, from_frame, to_frame

Y = '{http://www.yworks.com/xml/graphml}'
G = '{http://graphml.graphdrawing.org/xmlns}'
PROC = 10.0
FULL = ('STATE_TRANSITION', 'KNOWN_TRANSITION_OMITTED', 'UNKNOWN_TRANSITION', 'TRANSPORT', 'TRANSCRIPTION',
        'TRANSLATION')   # drawn with a process glyph (cdrender's not reduced, branched ones aside)
SHAPE = {'PROTEIN': 'Macromolecule', 'RECEPTOR': 'Macromolecule', 'ION_CHANNEL': 'Macromolecule',
         'TRUNCATED': 'Macromolecule', 'PHENOTYPE': 'Phenotype', 'SIMPLE_MOLECULE': 'ellipse', 'ION': 'ellipse',
         'DRUG': 'ellipse', 'UNKNOWN': 'ellipse', 'DEGRADED': 'ellipse'}


def drawing(text):
    return cdrender.Drawing(io.BytesIO(text.encode('utf-8')))


def num(v):
    return repr(round(float(v), 6))


def compartments(d):
    out = {}
    for a in d.ext.iterfind('cd:listOfCompartmentAliases/cd:compartmentAlias', NS):
        b = a.find('cd:bounds', NS)
        if b is not None:
            dl = a.find('cd:doubleLine', NS)
            out[a.get('id')] = (tuple(float(b.get(k)) for k in 'xywh'), a, float(dl.get('thickness', 12)) if dl is not None else 12.0)
    return out


def inside(b, c):
    return c[0] <= b[0] and c[1] <= b[1] and b[0] + b[2] <= c[0] + c[2] and b[1] + b[3] <= c[1] + c[3]


def tree(d, comps):
    # parent of every compartment and alias: a member's complex, an alias's compartment, a compartment's smallest
    # compartment round it
    up = {}
    for c, (b, a, t) in comps.items():
        round_ = [k for k, v in comps.items() if k != c and inside(b, v[0]) and v[0][2] * v[0][3] > b[2] * b[3]]
        up[c] = min(round_, key=lambda k: comps[k][0][2] * comps[k][0][3]) if round_ else None
    for i, (cls, b, a, name, si) in d.alias.items():
        p = a.get('complexSpeciesAlias')
        up[i] = p if p in d.alias else (a.get('compartmentAlias') if a.get('compartmentAlias') in comps else None)
    return up


def lines(d, rx):
    # the editable geometry of one reaction, absolute, or None when it is left as it is
    x = rx.find('s:annotation/cd:extension', NS)
    typ = x.findtext('cd:reactionType', namespaces=NS)
    br, bp = x.findall('cd:baseReactants/cd:baseReactant', NS), x.findall('cd:baseProducts/cd:baseProduct', NS)
    mods = x.findall('cd:listOfModification/cd:modification', NS)
    if len(br) != 1 or len(bp) != 1 or typ == 'BOOLEAN_LOGIC_GATE' or any(m.get('type', '').startswith('BOOLEAN') for m in mods):
        return None
    ra, pa = br[0].get('alias'), bp[0].get('alias')
    if ra not in d.alias or pa not in d.alias:
        return None
    A, ancA = d.end(br[0], ra)
    B, ancB = d.end(bp[0], pa)
    ep = x.find('cd:editPoints', NS)
    bends = [from_frame(A, B, p) for p in edit_points(ep.text if ep is not None else '')]
    r = {'id': rx.get('id'), 'x': x, 'ra': ra, 'pa': pa, 'A': A, 'B': B, 'ancA': ancA, 'ancB': ancB, 'bends': bends,
         'glyph': typ in FULL, 'mods': [], 'links': []}
    if not r['glyph']:
        return r
    line = cut(d, r, bends)
    cs = x.find('cd:connectScheme', NS)
    k = min(int(cs.get('rectangleIndex', 0)) if cs is not None else 0, len(line) - 2)
    P, Q = line[k], line[k + 1]
    sq, fl = ((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2), unit(Q[0] - P[0], Q[1] - P[1])
    r.update(k=k, sq=sq, fl=fl, P=P, Q=Q)
    for n, m in enumerate(mods):
        a_ = m.get('aliases')
        if a_ not in d.alias:
            continue
        M, anc = d.end(m.find('cd:linkTarget', NS), a_)
        T = target(m, sq, fl)
        r['mods'].append({'n': n, 'el': m, 'alias': a_, 'M': M, 'anc': anc, 'T': T,
                          'bends': [from_frame(M, T, p) for p in edit_points(m.get('editPoints'))]})
    joins = [(P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])) for t in (0.375, 0.625)]
    for tag, into in (('cd:listOfReactantLinks/cd:reactantLink', True), ('cd:listOfProductLinks/cd:productLink', False)):
        for n, l in enumerate(x.iterfind(tag, NS)):
            if l.get('alias') not in d.alias:
                continue
            O, anc = d.end(l, l.get('alias'))
            J = joins[0 if into else 1]
            stored = edit_points(l.get('editPoints') or l.findtext('cd:editPoints', '', NS))
            r['links'].append({'n': n, 'el': l, 'into': into, 'alias': l.get('alias'), 'O': O, 'anc': anc, 'J': J,
                               'bends': [from_frame(O, J, p) if into else from_frame(J, O, p) for p in stored]})
    return r


def cut(d, r, bends):
    # the main line as cdrender places the glyph on it: an end at a node's centre cut where the line leaves its shape
    line = [r['A']] + list(bends) + [r['B']]
    line[0] = d.clip(r['ra'], r['A'], r['ancA'], line[1])
    line[-1] = d.clip(r['pa'], r['B'], r['ancB'], line[-2])
    return line


def target(m, sq, fl):
    spot = SQUARE.get(int(m.get('targetLineIndex', '-1,2').split(',')[1]), SQUARE[3])
    return (sq[0] + 5 * (spot[0] * fl[0] - spot[1] * fl[1]), sq[1] + 5 * (spot[0] * fl[1] + spot[1] * fl[0]))


# the GraphML -----------------------------------------------------------------------------------------------------

def marks(d, i):
    # what CellDesigner draws round an alias beyond its box, as cdrender draws it (absolute x, y, w, h): residue
    # circles and structural states on the border of each copy of a multimer, the open unit of information on the
    # front copy. Given to the layout skill's tools as state labels, so Pack keeps them apart as on a yEd map
    cls, (x, y, w, h), a, name, si = d.alias[i]
    hd = si.find('cd:state/cd:homodimer', NS) if si is not None else None
    n = int(hd.text) if hd is not None else 1
    fw, fh = w - 6 * (n - 1), h - 6 * (n - 1)
    pref = si.find('cd:proteinReference', NS) if si is not None else None
    pid = pref.text if pref is not None else None
    out = []
    for k in range(n):
        b = (x + 6 * k, y + 6 * k, fw, fh)
        for (p_, r_), (ang, site) in d.residues.items():
            if p_ == pid:
                px, py = cdrender.on_border(b, ang)
                out.append((px - 8, py - 8, 16.0, 16.0))
        for st in si.iterfind('cd:state/cd:listOfStructuralStates/cd:structuralState', NS) if si is not None else ():
            sa = a.find('cd:structuralState', NS)
            px, py = cdrender.on_border(b, float(sa.get('angle')) if sa is not None else -math.pi / 2)
            rx = int(cdrender.width(st.get('structuralState') or '', 10) / 2 + 12)
            out.append((px - rx, py - 8, 2.0 * rx, 16.0))
    info = a.find('cd:info', NS)
    if info is not None and info.get('state') == 'open':
        out.append((x + fw / 2 - 35, y - 8, 70.0, 16.0))
    return out


def labels(d, i, b):
    # the labels the layout skill's tools read: a complex's name inside at the bottom, where cdrender writes it (its
    # height, lines 7/6 of the font apart), and the marks round the alias as state icons
    cls, a, name = d.alias[i][0], d.alias[i][2], d.alias[i][3]
    s = ''
    if cls == 'COMPLEX':
        fe = a.find('cd:font', NS)
        z = float(fe.get('size')) if fe is not None and fe.get('size') else 12.0
        s += '<y:NodeLabel modelName="internal" modelPosition="b" height="%r">%s</y:NodeLabel>' % (
            z * 7 / 6 * len(d.name_lines(name)), escape(' '.join(d.name_lines(name)) or ' '))
    for m in marks(d, i):
        s += '<y:NodeLabel iconData="cdmark" x="%r" y="%r" width="%r" height="%r"/>' % (m[0] - b[0], m[1] - b[1], m[2], m[3])
    return s


def graphml(text, off=(0.0, 0.0)):
    # off: subtracted from every place, so the editor keeps its own frame when the file's map was shifted (place())
    d = drawing(text)
    comps = compartments(d)
    up = tree(d, comps)
    kids = {}
    for i, p in up.items():
        kids.setdefault(p, []).append(i)
    rxs = [r for r in (lines(d, rx) for rx in d.model.iterfind('s:listOfReactions/s:reaction', NS)) if r]
    # a process glyph sits in the innermost group holding both its reactant and its product
    def chain(i):
        c = []
        while i is not None:
            c.append(i); i = up.get(i)
        return c
    for r in rxs:
        if r['glyph']:
            a = chain(r['ra']); b = set(chain(r['pa']))
            p = next((g for g in a[1:] if g in b), None)
            kids.setdefault(p, []).append(r['id'] + '|proc')
    procs = {r['id'] + '|proc': r for r in rxs if r['glyph']}
    box = lambda i: comps[i][0] if i in comps else d.alias[i][1]
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">',
           '  <key for="node" id="d6" yfiles.type="nodegraphics"/>', '  <key for="edge" id="d10" yfiles.type="edgegraphics"/>',
           '  <key for="graphml" id="d7" yfiles.type="resources"/>',
           '  <graph edgedefault="directed" id="G">']
    geo = lambda b: '<y:Geometry x="%r" y="%r" width="%r" height="%r"/>' % (b[0] - off[0], b[1] - off[1], float(b[2]), float(b[3]))

    def node(i, ind):
        s = ' ' * ind
        if i in procs:
            r = procs[i]; c = r['sq']
            out.append('%s<node id="%s"><data key="d6"><y:GenericNode configuration="com.yworks.sbgn.Process">%s</y:GenericNode></data></node>'
                       % (s, escape(i), geo((c[0] - PROC / 2, c[1] - PROC / 2, PROC, PROC))))
            return
        b, ch = box(i), kids.get(i, [])
        if i in comps:
            t = comps[i][2]
            shape = 'ellipse' if comps[i][1].findtext('cd:class', namespaces=NS) == 'OVAL' else 'roundrectangle'
            ins = ''.join(' %s="%d" %sF="%r"' % (k, round(t), k, t) for k in ('left', 'top', 'right', 'bottom'))
            real = ('<y:GroupNode>%s<y:Shape type="%s"/><y:Insets%s/><y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/></y:GroupNode>'
                    % (geo(b), shape, ins))
        elif d.alias[i][0] == 'COMPLEX':
            real = ('<y:GenericGroupNode configuration="com.yworks.sbgn.Complex">%s%s<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radiusX" value="5"/><y:Property name="com.yworks.sbgn.style.radiusY" value="5"/></y:StyleProperties>'
                    '<y:Insets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/><y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/></y:GenericGroupNode>' % (geo(b), labels(d, i, b)))
        else:
            k = SHAPE.get(d.alias[i][0], 'rectangle')
            props = '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radius" value="5"/></y:StyleProperties>' if k == 'Macromolecule' else ''
            if k in ('ellipse', 'rectangle'):
                out.append('%s<node id="%s"><data key="d6"><y:ShapeNode>%s%s<y:Shape type="%s"/></y:ShapeNode></data></node>' % (s, escape(i), geo(b), labels(d, i, b), k))
            else:
                out.append('%s<node id="%s"><data key="d6"><y:GenericNode configuration="com.yworks.sbgn.%s">%s%s%s</y:GenericNode></data></node>' % (s, escape(i), k, geo(b), labels(d, i, b), props))
            return
        out.append('%s<node id="%s" yfiles.foldertype="group"><data key="d6"><y:ProxyAutoBoundsNode><y:Realizers active="0">%s</y:Realizers></y:ProxyAutoBoundsNode></data>'
                   % (s, escape(i), real))
        out.append('%s  <graph edgedefault="directed" id="%s:">' % (s, escape(i)))
        for c in ch:
            node(c, ind + 4)
        out.append('%s  </graph>' % s)
        out.append('%s</node>' % s)

    for i in kids.get(None, []):
        node(i, 4)

    def port(p, i):   # a point as yEd's port: its offset from the node's centre
        b = box(i) if i in d.alias or i in comps else None
        return (p[0] - b[0] - b[2] / 2, p[1] - b[1] - b[3] / 2)

    def edge(eid, s, t, sp, tp, pts):
        ps = ''.join('<y:Point x="%r" y="%r"/>' % (p[0] - off[0], p[1] - off[1]) for p in pts)
        out.append('    <edge id="%s" source="%s" target="%s"><data key="d10"><y:PolyLineEdge><y:Path sx="%r" sy="%r" tx="%r" ty="%r">%s</y:Path><y:BendStyle smoothed="false"/></y:PolyLineEdge></data></edge>'
                   % (escape(eid), escape(s), escape(t), sp[0], sp[1], tp[0], tp[1], ps))

    for r in rxs:
        rid, A, B = r['id'], r['A'], r['B']
        pa = port(A, r['ra']) if r['ancA'] else (0.0, 0.0)
        pb = port(B, r['pa']) if r['ancB'] else (0.0, 0.0)
        if not r['glyph']:
            edge(rid + '|a', r['ra'], r['pa'], pa, pb, r['bends'])
            continue
        g, k, sq = rid + '|proc', r['k'], r['sq']
        # the main line split at the glyph: the anchor points before its segment in |a, the rest in |b, so the number of
        # |a's points is rectangleIndex (a point put on |a puts the glyph on the segment after it, as its middle lies there)
        edge(rid + '|a', r['ra'], g, pa, (0.0, 0.0), r['bends'][:k])
        edge(rid + '|b', g, r['pa'], (0.0, 0.0), pb, r['bends'][k:])
        for m in r['mods']:
            edge('%s|m%d' % (rid, m['n']), m['alias'], g, port(m['M'], m['alias']) if m['anc'] else (0.0, 0.0),
                 (m['T'][0] - sq[0], m['T'][1] - sq[1]), m['bends'])
        for l in r['links']:
            o = port(l['O'], l['alias']) if l['anc'] else (0.0, 0.0)
            j = (l['J'][0] - sq[0], l['J'][1] - sq[1])
            if l['into']:
                edge('%s|r%d' % (rid, l['n']), l['alias'], g, o, j, l['bends'])
            else:
                edge('%s|p%d' % (rid, l['n']), g, l['alias'], j, o, l['bends'])
    # the marks round an alias count as state icons for the layout skill's Pack (a first row's in the top margin)
    out += ['  </graph>', '  <data key="d7"><y:Resources><y:Resource id="cdmark"><y:GenericNode configuration="com.yworks.sbgn.StateVariable"/></y:Resource></y:Resources></data>', '</graphml>', '']
    return '\n'.join(out)


# writing back ----------------------------------------------------------------------------------------------------

def read(gtext):
    root = etree.fromstring(gtext.encode('utf-8'))
    boxes, base, bends, paths = {}, {}, {}, {}
    for n in root.iter(G + 'node'):
        g = n.find('.//' + Y + 'Geometry')
        boxes[n.get('id')] = tuple(float(g.get(k)) for k in ('x', 'y', 'width', 'height'))
    for e in root.iter(G + 'edge'):
        bends[e.get('id')] = [(float(p.get('x')), float(p.get('y'))) for p in e.iter(Y + 'Point')]
        pa = e.find('.//' + Y + 'Path')
        if pa is not None:
            paths[e.get('id')] = tuple(float(pa.get(k, 0)) for k in ('sx', 'sy', 'tx', 'ty'))
    return boxes, base, bends, paths


# where a line meets a node, as the editor sets it (user, 2026-11-12: "snap to center, bottom center, top center, left
# center, right center"): the centre (no connection point: the line starts from the centre, cut at the shape) or the
# middle of a side (CellDesigner's N, S, W, E); a port the editor did not touch keeps its connection point
SIDES = {'': (0.0, 0.0), 'N': (0.0, -0.5), 'S': (0.0, 0.5), 'W': (-0.5, 0.0), 'E': (0.5, 0.0)}


def side(port, b):
    return min(SIDES, key=lambda k: math.hypot(port[0] - SIDES[k][0] * b[2], port[1] - SIDES[k][1] * b[3]))


def anchor(T, el, span, pos, tag, target=None):
    # the connection point pos ('' the centre) of el (its linkAnchor child; a modifier's in its linkTarget, made when
    # missing from target: (species, alias)), in the tree and in the text
    cd = '{%s}' % NS['cd']
    if target:
        lt = el.find('cd:linkTarget', NS)
        if lt is None:
            if not pos:
                return
            lt = etree.Element(cd + 'linkTarget', species=target[0], alias=target[1]); el.insert(0, lt)
            cs = T.span(r'<celldesigner:connectScheme', span[0], span[1])   # CellDesigner's order: after it, before line
            at = cs[1] if cs else T.t.index('>', span[0]) + 1
            T.put(at, at, '\n<celldesigner:linkTarget species="%s" alias="%s">\n<celldesigner:linkAnchor position="%s"/>\n</celldesigner:linkTarget>' % (target[0], target[1], pos))
            etree.SubElement(lt, cd + 'linkAnchor', position=pos)
            return
        el, span, tag = lt, T.span(r'<celldesigner:linkTarget[\s>/]', span[0], span[1]), 'linkTarget'
    la = el.find('cd:linkAnchor', NS)
    if la is not None:
        if pos:
            la.set('position', pos)
        else:
            el.remove(la)
    elif pos:
        etree.SubElement(el, cd + 'linkAnchor', position=pos)
    if T.t[span[1] - 2:span[1]] == '/>':   # an empty element: given its child
        if pos:
            T.put(span[0], span[1], T.t[span[0]:span[1] - 2].rstrip() + '>\n<celldesigner:linkAnchor position="%s"/>\n</celldesigner:%s>' % (pos, tag))
        return
    ls = T.span(r'<celldesigner:linkAnchor ', span[0], span[1])
    if ls and pos:
        T.attrs(ls[0], {'position': pos})
    elif ls:
        T.put(ls[0], ls[1] + (1 if T.t[ls[1]:ls[1] + 1] == '\n' else 0), '')
    elif pos:
        at = T.t.index('>', span[0]) + 1
        T.put(at, at, '\n<celldesigner:linkAnchor position="%s"/>' % pos)


def ports(d, T, s, o, paths, new):
    # the ends the editor moved (their port in the GraphML no longer the file's): set to the centre or a side's middle
    rid, cen = o['id'], lambda b: (b[0] + b[2] / 2, b[1] + b[3] / 2)
    def moved(eid, which, alias, P, anc, old):
        q = paths.get(eid)
        if not q:
            return None
        port = q[:2] if which == 's' else q[2:]
        c = cen(old[alias])
        was = (P[0] - c[0], P[1] - c[1]) if anc else (0.0, 0.0)
        if math.hypot(port[0] - was[0], port[1] - was[1]) < 0.5:
            return None
        return side(port, new[alias])
    x = o['x']
    for k, (tag, eid, which, alias, P, anc) in enumerate((('baseReactant', rid + '|a', 's', o['ra'], o['A'], o['ancA']),
                                                         ('baseProduct', rid + ('|b' if o['glyph'] else '|a'), 't', o['pa'], o['B'], o['ancB']))):
        pos = moved(eid, which, alias, P, anc, o['old'])
        if pos is not None:
            el = x.find('cd:%ss/cd:%s' % (tag, tag), NS)
            anchor(T, el, T.span(r'<celldesigner:%s [^>]*alias="%s"' % (tag, re.escape(alias)), s[0], s[1]), pos, tag)
    lists = {}
    for name, tag in (('listOfModification', 'modification'), ('listOfReactantLinks', 'reactantLink'), ('listOfProductLinks', 'productLink')):
        ls, found = T.span(r'<celldesigner:%s>' % name, s[0], s[1]), []
        i0 = ls[0] if ls else None
        while ls:
            m_ = T.span(r'<celldesigner:%s ' % tag, i0, ls[1])
            if not m_:
                break
            found.append(m_); i0 = m_[1]
        lists[tag] = found
    for m in o['mods']:
        pos = moved('%s|m%d' % (rid, m['n']), 's', m['alias'], m['M'], m['anc'], o['old'])
        if pos is not None:
            anchor(T, m['el'], lists['modification'][m['n']], pos, 'modification', (m['el'].get('modifiers'), m['alias']))
    for l in o['links']:
        pos = moved('%s|%s%d' % (rid, 'r' if l['into'] else 'p', l['n']), 's' if l['into'] else 't', l['alias'], l['O'], l['anc'], o['old'])
        if pos is not None:
            tag = 'reactantLink' if l['into'] else 'productLink'
            anchor(T, l['el'], lists[tag][l['n']], pos, tag)


def near(p, q, tol=1e-3):
    return abs(p[0] - q[0]) < tol and abs(p[1] - q[1]) < tol


class Text:
    # edits of the CellDesigner text: (start, end, new), applied at the end, last first
    def __init__(self, text):
        self.t, self.e = text, []

    def span(self, open_re, start=0, end=None):
        # the element whose start tag matches open_re, from its start to the end of its end tag (or of the empty tag)
        m = re.compile(open_re).search(self.t, start, len(self.t) if end is None else end)
        if not m:
            return None
        name = re.match(r'<([\w:]+)', m.group(0)).group(1)
        tag_end = self.t.index('>', m.start())
        if self.t[tag_end - 1] == '/':
            return m.start(), tag_end + 1
        depth, i = 1, tag_end + 1
        pat = re.compile(r'<(/?)%s[\s>/]' % re.escape(name))
        while depth:
            q = pat.search(self.t, i)
            if self.t[q.start():self.t.index('>', q.start()) + 1].endswith('/>'):
                i = q.end(); continue
            depth += -1 if q.group(1) else 1
            i = self.t.index('>', q.start()) + 1
        return m.start(), i

    def attrs(self, at, values):
        # the start tag at position at: the given attributes set (added at its end when missing, removed when None)
        end = self.t.index('>', at)
        tag = self.t[at:end]
        close = '/' if tag.endswith('/') else ''
        if close:
            tag = tag[:-1]
        new = tag
        for k, v in values.items():
            m = re.search(r'\s%s="[^"]*"' % re.escape(k), new)
            if v is None:
                new = new[:m.start()] + new[m.end():] if m else new
            elif m:
                new = new[:m.start()] + ' %s="%s"' % (k, v) + new[m.end():]
            else:
                new = new.rstrip() + ' %s="%s"' % (k, v)
        if new != tag:
            self.e.append((at, at + len(tag), new))

    def put(self, a, b, new):
        if self.t[a:b] != new:
            self.e.append((a, b, new))

    def done(self):
        t = self.t
        for a, b, new in sorted(self.e, key=lambda q: -q[0]):
            t = t[:a] + new + t[b:]
        return t


def points(old_tokens, old_abs, new_abs, frame_same, frame):
    # the edit points as text: an old token kept when its point and its frame did not change
    toks = old_tokens.split() if old_tokens else []
    out = []
    for i, p in enumerate(new_abs):
        if frame_same and i < len(toks) and i < len(old_abs) and near(p, old_abs[i]) and len(old_abs) == len(new_abs):
            out.append(toks[i]); continue
        q = frame(p)
        if i < len(toks) and len(old_abs) == len(new_abs):   # the same in the new frame (a whole reaction moved)
            o = [float(v) for v in toks[i].split(',')]
            if abs(o[0] - q[0]) < 1e-7 and abs(o[1] - q[1]) < 1e-7:
                out.append(toks[i]); continue
        out.append('%s,%s' % (repr(round(q[0], 12)), repr(round(q[1], 12))))
    return ' '.join(out)


def directions(T, span, n):
    # the listOfLineDirection inside span: n of them, one per segment, the values kept
    s = T.span(r'<celldesigner:listOfLineDirection>', span[0], span[1])
    if not s:
        return
    body = T.t[s[0]:s[1]]
    items = re.findall(r'<celldesigner:lineDirection [^>]*/>', body)
    if len(items) == n:
        return
    sep = '\n' if '\n' in body else ''
    vals = [re.search(r'value="([^"]*)"', i).group(1) for i in items]
    new = ''.join('%s<celldesigner:lineDirection index="%d" value="%s"/>' % (sep, j, vals[j] if j < len(vals) else 'unknown') for j in range(n))
    T.put(s[0], s[1], '<celldesigner:listOfLineDirection>%s%s</celldesigner:listOfLineDirection>' % (new, sep))


MARGIN = 40.0   # the converter's margin round a CellDesigner map


def apply(text, gtext):
    return place(text, gtext)[0]


def place(text, gtext):
    # the CellDesigner text with the moves, and the shift (x, y) of the whole map: CellDesigner has no negative places
    # (user, 2026-11-12), so a map moved past the left or the top edge is shifted right or down, each on its own, by whole
    # blocks of the grid (16) to start at the margin (40) or a little more; the canvas grows with it
    d = drawing(text)
    comps = compartments(d)
    up = tree(d, comps)
    boxes, base, bends, paths = read(gtext)
    xs = [b[0] for b in boxes.values()] + [p[0] for ps in bends.values() for p in ps]
    ys = [b[1] for b in boxes.values()] + [p[1] for ps in bends.values() for p in ps]
    block = lambda m: math.ceil((MARGIN - m) / 16) * 16.0 if m < 0 else 0.0   # whole blocks of the grid: a map on it stays on it
    sh = (block(min(xs)) if xs else 0.0, block(min(ys)) if ys else 0.0)
    if sh != (0.0, 0.0):
        boxes = {i: (b[0] + sh[0], b[1] + sh[1], b[2], b[3]) for i, b in boxes.items()}
        base = {i: (b[0] + sh[0], b[1] + sh[1]) for i, b in base.items()}
        bends = {i: [(p[0] + sh[0], p[1] + sh[1]) for p in ps] for i, ps in bends.items()}
    old = {i: a[1] for i, a in d.alias.items()}
    old.update({c: v[0] for c, v in comps.items()})
    T = Text(text)
    new = {i: boxes.get(i, b) for i, b in old.items()}
    # the boxes: bounds, the place inside the parent, a compartment's name
    for i, b in old.items():
        n = new[i]
        if all(abs(n[j] - b[j]) < 1e-3 for j in range(4)):
            continue
        kind = 'compartmentAlias' if i in comps else 'complexSpeciesAlias' if d.alias[i][0] == 'COMPLEX' else 'speciesAlias'
        s = T.span(r'<celldesigner:%s id="%s"' % (kind, re.escape(i)))
        bt = T.span(r'<celldesigner:bounds ', s[0], s[1])
        T.attrs(bt[0], {k: num(n[j]) for j, k in enumerate('xywh') if abs(n[j] - b[j]) >= 1e-3})
        p = up.get(i)
        ip = T.span(r'<celldesigner:innerPosition ', s[0], s[1])
        if ip and p:
            m = re.findall(r'\s([xy])="([^"]*)"', T.t[ip[0]:ip[1]])
            v = {k: float(x) for k, x in m}
            pb, pn = old[p], new[p]
            if abs(v['x'] - (b[0] - pb[0])) < 1e-3 and abs(v['y'] - (b[1] - pb[1])) < 1e-3:
                T.attrs(ip[0], {k: num(n[j] - pn[j]) for j, k in enumerate('xy') if abs((n[j] - pn[j]) - (b[j] - pb[j])) >= 1e-3})
        if i in comps:
            npt = T.span(r'<celldesigner:namePoint ', s[0], s[1])
            if npt and (abs(n[0] - b[0]) >= 1e-3 or abs(n[1] - b[1]) >= 1e-3):
                m = dict(re.findall(r'\s([xy])="([^"]*)"', T.t[npt[0]:npt[1]]))
                T.attrs(npt[0], {'x': num(float(m['x']) + n[0] - b[0]), 'y': num(float(m['y']) + n[1] - b[1])})
    # the canvas grows to hold what was moved past its right or bottom edge, as in CellDesigner (40 to spare, the
    # converter's margin); the site draws the canvas only
    far = [max(n[0] + n[2] for n in new.values()), max(n[1] + n[3] for n in new.values())]
    md = T.span(r'<celldesigner:modelDisplay ')
    if md and (far[0] > d.W or far[1] > d.H):
        T.attrs(md[0], {k: str(int(math.ceil(v + 40))) for k, v, have in (('sizeX', far[0], d.W), ('sizeY', far[1], d.H)) if v > have})
    # the reactions, with the nodes where they are now
    olds = {rx.get('id'): lines(d, rx) for rx in d.model.iterfind('s:listOfReactions/s:reaction', NS)}
    for i, a in d.alias.items():
        d.alias[i] = (a[0], new[i], a[2], a[3], a[4])
    for rx in d.model.iterfind('s:listOfReactions/s:reaction', NS):
        o = olds[rx.get('id')]
        if not o:
            continue
        rid = o['id']
        s = T.span(r'<reaction [^>]*\bid="%s"' % re.escape(rid))
        o['old'] = old
        ports(d, T, s, o, paths, new)
        r = lines(d, rx)   # the ends as the nodes and connection points are now (the bends still in the old frames: not used)
        A, B = r['A'], r['B']
        main = list(bends.get(rid + '|a', [])) + list(bends.get(rid + '|b', []))
        k = len(bends.get(rid + '|a', []))
        frame_same = near(A, o['A'], 1e-6) and near(B, o['B'], 1e-6)
        x0 = [m_ for m_ in re.finditer(r'<celldesigner:(listOfReactantLinks|listOfProductLinks|listOfModification)>', T.t[s[0]:s[1]])]
        subs = [T.span(r'<celldesigner:%s>' % m_.group(1), s[0] + m_.start(), s[1]) for m_ in x0]
        cs = None
        for m_ in re.finditer(r'<celldesigner:connectScheme', T.t[s[0]:s[1]]):
            at = s[0] + m_.start()
            if not any(a <= at < b for a, b in subs):
                cs = T.span(r'<celldesigner:connectScheme', at, s[1]); break
        ep = T.span(r'<celldesigner:editPoints>', cs[1] if cs else s[0], s[1]) if True else None
        if ep and any(a <= ep[0] < b for a, b in subs):
            ep = None
        old_tok = re.sub(r'</?celldesigner:editPoints>', '', T.t[ep[0]:ep[1]]) if ep else ''
        txt = points(old_tok, o['bends'], main, frame_same, lambda p: to_frame(A, B, p))
        if ep:
            if main:
                T.put(ep[0], ep[1], '<celldesigner:editPoints>%s</celldesigner:editPoints>' % txt)
            else:
                T.put(ep[0], ep[1] + (1 if T.t[ep[1]:ep[1] + 1] == '\n' else 0), '')
        elif main and cs:
            nl = '\n' if T.t[cs[1]:cs[1] + 1] == '\n' else ''
            T.put(cs[1] + len(nl), cs[1] + len(nl), '<celldesigner:editPoints>%s</celldesigner:editPoints>%s' % (txt, nl))
        if cs:
            directions(T, cs, len(main) + 1)
            if o['glyph']:
                ri = re.search(r'rectangleIndex="(\d+)"', T.t[cs[0]:T.t.index('>', cs[0])])
                if (int(ri.group(1)) if ri else 0) != k:
                    T.attrs(cs[0], {'rectangleIndex': str(k)})
        if not o['glyph']:
            continue
        line = cut(d, r, main)
        P, Q = line[k], line[k + 1]
        sq, fl = ((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2), unit(Q[0] - P[0], Q[1] - P[1])
        mod_spans = []
        for a, b in subs:
            if T.t.startswith('<celldesigner:listOfModification>', a):
                i0 = a
                while True:
                    m_ = T.span(r'<celldesigner:modification ', i0, b)
                    if not m_:
                        break
                    mod_spans.append(m_); i0 = m_[1]
        for m in o['mods']:
            ms = mod_spans[m['n']]
            M, _ = d.end(m['el'].find('cd:linkTarget', NS), m['alias'])
            Tt = target(m['el'], sq, fl)
            nb = bends.get('%s|m%d' % (rid, m['n']), m['bends'])
            same = near(M, m['M'], 1e-6) and near(Tt, m['T'], 1e-6)
            txt = points(m['el'].get('editPoints'), m['bends'], nb, same, lambda p, M=M, Tt=Tt: to_frame(M, Tt, p))
            T.attrs(ms[0], {'editPoints': txt or None})
            c2 = T.span(r'<celldesigner:connectScheme', ms[0], ms[1])
            if c2:
                directions(T, c2, len(nb) + 1)
        joins = [(P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])) for t in (0.375, 0.625)]
        for l in o['links']:
            if not l['bends'] and not bends.get('%s|%s%d' % (rid, 'r' if l['into'] else 'p', l['n'])):
                continue   # a link without bend points follows its ends by itself
            O, _ = d.end(l['el'], l['alias'])
            J = joins[0 if l['into'] else 1]
            nb = bends.get('%s|%s%d' % (rid, 'r' if l['into'] else 'p', l['n']), l['bends'])
            same = near(O, l['O'], 1e-6) and near(J, l['J'], 1e-6)
            fr = (lambda p, O=O, J=J: to_frame(O, J, p)) if l['into'] else (lambda p, O=O, J=J: to_frame(J, O, p))
            old_tok = l['el'].get('editPoints') or l['el'].findtext('cd:editPoints', '', NS)
            txt = points(old_tok, l['bends'], nb, same, fr)
            tag = 'reactantLink' if l['into'] else 'productLink'
            ls = None
            for a, b in subs:
                found = [T.span(r'<celldesigner:%s ' % tag, a, b)]
                if found[0]:
                    i0, c = a, -1
                    while True:
                        m_ = T.span(r'<celldesigner:%s ' % tag, i0, b)
                        if not m_:
                            break
                        c += 1
                        if c == l['n']:
                            ls = m_; break
                        i0 = m_[1]
                if ls:
                    break
            if ls is None:
                continue
            child = T.span(r'<celldesigner:editPoints>', ls[0], ls[1])
            if child:
                T.put(child[0], child[1], '<celldesigner:editPoints>%s</celldesigner:editPoints>' % txt)
            else:
                T.attrs(ls[0], {'editPoints': txt or None})
            c2 = T.span(r'<celldesigner:connectScheme', ls[0], ls[1])
            if c2:
                directions(T, c2, len(nb) + 1)
    if sh != (0.0, 0.0):   # what the editor does not hold but is placed absolutely: free texts and logic gates
        ly = T.span(r'<celldesigner:listOfLayers>')
        for m in re.finditer(r'<celldesigner:bounds ', T.t[ly[0]:ly[1]] if ly else ''):
            tag = T.t[ly[0] + m.start():T.t.index('>', ly[0] + m.start())]
            v = dict(re.findall(r'\s([xy])="([^"]*)"', tag))
            T.attrs(ly[0] + m.start(), {'x': num(float(v['x']) + sh[0]), 'y': num(float(v['y']) + sh[1])})
        for m in re.finditer(r'<celldesigner:(?:GateMember|modification) [^>]*type="BOOLEAN_LOGIC_GATE[^>]*>', T.t):
            e = re.search(r'\seditPoints="([^"]*)"', m.group(0))
            if e:
                pts = e.group(1).split()
                gx, gy = (float(v) for v in pts[-1].split(','))
                pts[-1] = '%s,%s' % (num(gx + sh[0]), num(gy + sh[1]))
                T.attrs(m.start(), {'editPoints': ' '.join(pts)})
    return T.done(), sh


def draw(text, gtext):
    # the editor's call: the CellDesigner text with the moves, its drawing (in groups) and the GraphML made from it again
    cd, sh = place(text, gtext)
    cdrender.GROUPS = cdrender.CLASSES = True
    svg = cdrender.render(io.BytesIO(cd.encode('utf-8')))
    if sh != (0.0, 0.0):   # the editor's frame: the drawing is in the file's places, the editor's are sh less
        svg = svg.replace('<g transform="translate(0,0)">', '<g transform="translate(%r,%r)"><g transform="translate(%r,%r)">' % (sh[0], sh[1], -sh[0], -sh[1]), 1)
        svg = svg[:svg.rindex('</svg>')] + '</g>\n</svg>\n'
    return svg, cd, graphml(cd, sh)
