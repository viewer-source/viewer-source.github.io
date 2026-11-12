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
#   The glyph sits midway on the segment of the main line it is on (rectangleIndex). Moved, it moves its segment, as in
#   CellDesigner (user, 2026-11-12): the segment's bend points go with it (tied to it in the GraphML: with="<glyph>"),
#   an end of the segment at a node becomes a new bend point. Not moved, it stays midway on its segment wherever that
#   goes. Whether it was moved: its place against the one written in the GraphML (base="x,y").
#   Left as they are, drawn but not editable: logic gates, associations and dissociations (their geometry stays in
#   CellDesigner's frames, so it stretches with the nodes).
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

def graphml(text):
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
           '  <graph edgedefault="directed" id="G">']
    geo = lambda b: '<y:Geometry x="%r" y="%r" width="%r" height="%r"/>' % tuple(float(v) for v in b)

    def node(i, ind):
        s = ' ' * ind
        if i in procs:
            r = procs[i]; c = r['sq']
            out.append('%s<node id="%s" base="%r,%r"><data key="d6"><y:GenericNode configuration="com.yworks.sbgn.Process">%s</y:GenericNode></data></node>'
                       % (s, escape(i), c[0], c[1], geo((c[0] - PROC / 2, c[1] - PROC / 2, PROC, PROC))))
            return
        b, ch = box(i), kids.get(i, [])
        if i in comps:
            t = comps[i][2]
            shape = 'ellipse' if comps[i][1].findtext('cd:class', namespaces=NS) == 'OVAL' else 'roundrectangle'
            ins = ''.join(' %s="%d" %sF="%r"' % (k, round(t), k, t) for k in ('left', 'top', 'right', 'bottom'))
            real = ('<y:GroupNode>%s<y:Shape type="%s"/><y:Insets%s/><y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/></y:GroupNode>'
                    % (geo(b), shape, ins))
        elif d.alias[i][0] == 'COMPLEX':
            real = ('<y:GenericGroupNode configuration="com.yworks.sbgn.Complex">%s<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radiusX" value="5"/><y:Property name="com.yworks.sbgn.style.radiusY" value="5"/></y:StyleProperties>'
                    '<y:Insets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/><y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/></y:GenericGroupNode>' % geo(b))
        else:
            k = SHAPE.get(d.alias[i][0], 'rectangle')
            props = '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radius" value="5"/></y:StyleProperties>' if k == 'Macromolecule' else ''
            if k in ('ellipse', 'rectangle'):
                out.append('%s<node id="%s"><data key="d6"><y:ShapeNode>%s<y:Shape type="%s"/></y:ShapeNode></data></node>' % (s, escape(i), geo(b), k))
            else:
                out.append('%s<node id="%s"><data key="d6"><y:GenericNode configuration="com.yworks.sbgn.%s">%s%s</y:GenericNode></data></node>' % (s, escape(i), k, geo(b), props))
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

    def edge(eid, s, t, sp, tp, pts, tie=()):
        ps = ''.join('<y:Point x="%r" y="%r"%s/>' % (p[0], p[1], ' with="%s"' % escape(t_) if t_ else '')
                     for p, t_ in zip(pts, list(tie) + [None] * len(pts)))
        out.append('    <edge id="%s" source="%s" target="%s"><data key="d10"><y:PolyLineEdge><y:Path sx="%r" sy="%r" tx="%r" ty="%r">%s</y:Path><y:BendStyle smoothed="false"/></y:PolyLineEdge></data></edge>'
                   % (escape(eid), escape(s), escape(t), sp[0], sp[1], tp[0], tp[1], ps))

    for r in rxs:
        rid, A, B = r['id'], r['A'], r['B']
        pa = port(A, r['ra']) if r['ancA'] else (0.0, 0.0)
        pb = port(B, r['pa']) if r['ancB'] else (0.0, 0.0)
        if not r['glyph']:
            edge(rid + '|a', r['ra'], r['pa'], pa, pb, r['bends'])
            continue
        g, k, sq, n = rid + '|proc', r['k'], r['sq'], len(r['bends'])
        first, second = r['bends'][:k], r['bends'][k:]
        # the segment's ends that are bend points go with the glyph
        edge(rid + '|a', r['ra'], g, pa, (0.0, 0.0), first, [None] * (k - 1) + [g] if k else [])
        edge(rid + '|b', g, r['pa'], (0.0, 0.0), pb, second, [g] if n - k else [])
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
    out += ['  </graph>', '</graphml>', '']
    return '\n'.join(out)


# writing back ----------------------------------------------------------------------------------------------------

def read(gtext):
    root = etree.fromstring(gtext.encode('utf-8'))
    boxes, base, bends = {}, {}, {}
    for n in root.iter(G + 'node'):
        g = n.find('.//' + Y + 'Geometry')
        boxes[n.get('id')] = tuple(float(g.get(k)) for k in ('x', 'y', 'width', 'height'))
        if n.get('base'):
            base[n.get('id')] = tuple(float(v) for v in n.get('base').split(','))
    for e in root.iter(G + 'edge'):
        bends[e.get('id')] = [(float(p.get('x')), float(p.get('y'))) for p in e.iter(Y + 'Point')]
    return boxes, base, bends


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


def apply(text, gtext):
    d = drawing(text)
    comps = compartments(d)
    up = tree(d, comps)
    boxes, base, bends = read(gtext)
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
    # the reactions, with the nodes where they are now
    olds = {rx.get('id'): lines(d, rx) for rx in d.model.iterfind('s:listOfReactions/s:reaction', NS)}
    for i, a in d.alias.items():
        d.alias[i] = (a[0], new[i], a[2], a[3], a[4])
    for rx in d.model.iterfind('s:listOfReactions/s:reaction', NS):
        o = olds[rx.get('id')]
        if not o:
            continue
        rid = o['id']
        r = lines(d, rx)   # the ends as the nodes are now (the bends still in the old frames: not used)
        A, B = r['A'], r['B']
        s = T.span(r'<reaction [^>]*\bid="%s"' % re.escape(rid))
        main = list(bends.get(rid + '|a', [])) + list(bends.get(rid + '|b', []))
        k = len(bends.get(rid + '|a', []))
        if o['glyph']:
            g = rid + '|proc'
            C = (boxes[g][0] + boxes[g][2] / 2, boxes[g][1] + boxes[g][3] / 2) if g in boxes else o['sq']
            line = cut(d, r, main)
            P, Q = line[k], line[k + 1]
            if g in base and not near(C, base[g], 1e-2):   # the glyph moved: its segment comes with it
                mid = ((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2)
                sh = (C[0] - mid[0], C[1] - mid[1])
                if not near(sh, (0, 0), 1e-2):
                    ends = [e for e, at_node in (('P', k == 0), ('Q', k + 1 == len(line) - 1)) if at_node]
                    f = 2.0 if len(ends) == 1 else 1.0
                    if not ends:   # both ends bend points, not moved with it: moved now
                        main[k - 1] = (P[0] + sh[0], P[1] + sh[1]); main[k] = (Q[0] + sh[0], Q[1] + sh[1])
                    if 'Q' in ends:
                        main.insert(k, (Q[0] + f * sh[0], Q[1] + f * sh[1]))
                    if 'P' in ends:
                        main.insert(k, (P[0] + f * sh[0], P[1] + f * sh[1])); k += 1
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
    return T.done()


def draw(text, gtext):
    # the editor's call: the CellDesigner text with the moves, its drawing (in groups) and the GraphML made from it again
    cd = apply(text, gtext)
    cdrender.GROUPS = cdrender.CLASSES = True
    svg = cdrender.render(io.BytesIO(cd.encode('utf-8')))
    return svg, cd, graphml(cd)
