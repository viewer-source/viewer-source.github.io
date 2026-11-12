# Copy of the layout skill's complex_pack.py at 7fc1773 2026-11-12; its master is in the skill, never edited here.
# Complex packing and the group fit (SKILL.md section 5 "Group bounds", section 3 "Complex packing").
#   python3 complex_pack.py <in.graphml> <out.graphml>   packs every complex, then fits all groups
#   from complex_pack import fit_insets                  fit_insets(root) ends every build that
#                                                        moves nodes in a group
# Packing (user, 2026-10-22): members 12 px from the left and right edges, 8 px from each other,
# 16 px from the top (yEd's Insets 12 + its 4 px group label; N:2 and units of information of a
# first-row member sit in it) and 16 px from the bottom (mirroring the top, and room for the name
# CellDesigner and MINERVA write there), counting state variables, units of information, names wider
# than the node and a multimer's second outline; 10 px between a member and an inner complex one
# above the other (the complex's thin outline reads as glued at 8). Exact on every complex: no grid inside complexes
# (it made the bottom and right margins grow by up to 8 px). Members keep their arrangement: those
# sharing a centre line (rows, columns) keep it, each row and column moves up and left as far as the
# distances allow, and a member with nothing beside it along an axis (one protein over two, one next
# to a tall inner complex) is centred on what the complex holds along that axis. Every complex keeps
# its centre, so the arcs at it stay; ports on its border follow the border.
import sys
from lxml import etree

NS = {'g': 'http://graphml.graphdrawing.org/xmlns', 'y': 'http://www.yworks.com/xml/graphml'}
G, Y = '{%s}' % NS['g'], '{%s}' % NS['y']
GAP, LEFT, TOP, RIGHT, BOTTOM = 8.0, 12.0, 16.0, 12.0, 16.0
GAP_COMPLEX = 10.0  # one above the other, a member and an inner complex (user, 2026-10-22, mevalonate PP2ARB)
INSETS = (('left', 10), ('top', 12), ('right', 10), ('bottom', 16))  # top + the 4 px group label = TOP
TOL = 5.0  # centres closer than this share a line


def realizer(n):
    gn = n.find('g:data/y:GenericNode', NS)
    if gn is not None:
        return gn
    rs = n.find('g:data/y:ProxyAutoBoundsNode/y:Realizers', NS)
    if rs is not None:
        return rs[int(rs.get('active', '0'))]
    return n.find('g:data/*[y:Geometry]', NS)


def box(n):
    g = realizer(n).find('y:Geometry', NS)
    return [float(g.get(a)) for a in ('x', 'y', 'width', 'height')]


def set_box(n, b):
    g = realizer(n).find('y:Geometry', NS)
    for a, v in zip(('x', 'y', 'width', 'height'), b):
        g.set(a, repr(float(v)))


def shift(n, dx, dy):  # a node and everything inside it
    for g in n.iter(Y + 'Geometry'):
        g.set('x', repr(float(g.get('x')) + dx)); g.set('y', repr(float(g.get('y')) + dy))


def members(g):
    sub = g.find('g:graph', NS)
    return [] if sub is None else sub.findall('g:node', NS)


def is_complex(n):
    return n.get('yfiles.foldertype') == 'group' and 'omplex' in (realizer(n).get('configuration') or '')


def label_xy(l, w, h):
    # a label's top left relative to its node (w x h) as yEd draws it: from its smart label model
    # when it has one (yEd ignores the stored x and y then; SREBP "processed form" was stored centred
    # and drawn 12 px off), else the stored x and y; None for a label with neither
    mp = l.find('.//y:SmartNodeLabelModelParameter', NS)
    if mp is None:
        return None if l.get('x') is None else (float(l.get('x')), float(l.get('y')))
    f = lambda a: float(mp.get(a)); lw, lh = float(l.get('width')), float(l.get('height'))
    return (w / 2 + f('nodeRatioX') * w - f('labelRatioX') * lw + f('offsetX') - lw / 2,
            h / 2 + f('nodeRatioY') * h - f('labelRatioY') * lh + f('offsetY') - lh / 2)


SHORT = 2.0  # a name past its node by up to 2 px a side is fine (user, 2026-10-24: Ca2+, cAMP, NADH)


def name_box(n):
    # the name's text, absolute (x0, y0, x1, y1): its label box less SHORT a side and 3 px of padding
    # above and below; None for a node without a name
    x, y, w, h = box(n)
    for l in realizer(n).findall('y:NodeLabel', NS):
        if not l.get('iconData') and (l.text or '').strip() and label_xy(l, w, h):
            p = label_xy(l, w, h)
            return (x + p[0] + SHORT, y + p[1] + 3,
                    x + p[0] + float(l.get('width')) - SHORT, y + p[1] + float(l.get('height')) - 3)


def up(v, step):  # v rounded up to a multiple of step
    return -(-v // step) * step


def extent(n):
    # node box with its labels (icons, N:2, a name wider than the node) and a multimer's second
    # outline (6 px down and right), as yEd counts them in a group's bounds, absolute
    x, y, w, h = box(n)
    mc = realizer(n).find('y:StyleProperties/y:Property[@name="com.yworks.sbgn.style.mcount"]', NS)
    d = 6.0 if mc is not None and mc.get('value') != '1' else 0.0
    x0, y0, x1, y1 = x, y, x + w + d, y + h + d
    for l in realizer(n).findall('y:NodeLabel', NS):
        xy = label_xy(l, w, h)
        if (l.get('iconData') or (l.text or '').strip()) and xy:
            lx, ly = x + xy[0], y + xy[1]
            x0, y0 = min(x0, lx), min(y0, ly)
            x1, y1 = max(x1, lx + float(l.get('width'))), max(y1, ly + float(l.get('height')))
    return x0, y0, x1, y1


def room(g, r):
    # space between a group's stored box (realizer r) and what yEd draws without BorderInsets: its
    # members (extent above) + Insets + the height of its visible internal labels on that side (top:
    # t, tl, tr; bottom: b, bl, br); yEd draws the group as that + BorderInsets
    es = [extent(k) for k in members(g)]
    x, y, w, h = box(g)
    i = {s: float(r.find('y:Insets', NS).get(s + 'F')) for s in ('left', 'top', 'right', 'bottom')}
    lab = {side: max([float(l.get('height')) for l in r.findall('y:NodeLabel', NS)
                      if l.get('modelName') == 'internal' and l.get('visible') != 'false'
                      and (l.get('modelPosition') or '')[:1] == side] or [0.0]) for side in 'tb'}
    return i, {'left': min(e[0] for e in es) - x - i['left'],
               'top': min(e[1] for e in es) - y - i['top'] - lab['t'],
               'right': x + w - max(e[2] for e in es) - i['right'],
               'bottom': y + h - max(e[3] for e in es) - i['bottom'] - lab['b']}


def box_faults(root, tol=1.0):
    # groups yEd would draw at another size on opening than the file stores: [(id, side, px)],
    # px > 0 where yEd grows the group (into its neighbours), < 0 where it shrinks it
    out = []
    for g in root.iter(G + 'node'):
        if g.get('yfiles.foldertype') != 'group' or not members(g):
            continue
        r = realizer(g); bi = r.find('y:BorderInsets', NS)
        for s, v in room(g, r)[1].items():
            d = float(bi.get(s + 'F', bi.get(s, '0'))) - v
            if abs(d) > tol:
                out.append((g.get('id'), s, round(d, 1)))
    return out


def fit_insets(root):
    # BorderInsets take the room between the stored box and what yEd draws (room above), so yEd
    # keeps the box. Labels in the top margin (N:2 of a first-row member) lower the top Insets
    # instead.
    for g in root.iter(G + 'node'):
        if g.get('yfiles.foldertype') != 'group' or not members(g):
            continue
        for r in g.find('g:data/y:ProxyAutoBoundsNode/y:Realizers', NS):
            i, need = room(g, r)
            if need['top'] < 0 and r is realizer(g):
                ins = r.find('y:Insets', NS); t = max(i['top'] + need['top'], 0.0)
                ins.set('top', str(int(round(t)))); ins.set('topF', repr(t))
            bi = r.find('y:BorderInsets', NS)
            for s, v in need.items():
                v = max(v, 0.0)
                bi.set(s, str(int(round(v)))); bi.set(s + 'F', repr(v))


def compact(items, start, floor=None, wide=()):
    # items: [(centre, (lo, hi) along axis, (lo, hi) across, edge, half the node)]; lines of equal centre move as
    # one, each member starts GAP after every earlier member it faces, and at least at start, measured from
    # edge (the outline, or the node where labels may sit in the margin), and at floor[k] (a line's
    # least centre); GAP_COMPLEX where a member of wide (inner complexes) faces the other line;
    # returns the new centres, the far end and the lines
    lines = []
    for i in sorted(range(len(items)), key=lambda i: items[i][0]):
        if lines and items[i][0] - items[lines[-1][0]][0] < TOL:
            lines[-1].append(i)
        else:
            lines.append([i])
    new = [None] * len(items)
    for k, line in enumerate(lines):
        c = start - min(items[i][3] for i in line)
        for prev in lines[:k]:  # each member clears only the members it faces (user, 2026-10-22, glycogen
            for i in prev:      # PHK complexes: a tall inner complex in PHKA1's row pushed it 40 px down)
                for j in line:
                    if faces(items, [i], [j]):
                        g = GAP_COMPLEX if i in wide or j in wide else GAP
                        c = max(c, new[i] + items[i][1][1] + g - items[j][1][0])
        c = max(c, floor[k]) if floor else c
        for i in line:
            new[i] = c
    return new, max(new[i] + items[i][1][1] for i in range(len(items))), lines


def faces(items, a, b):  # two lines with members side by side across the axis
    return any(items[i][2][0] < items[j][2][1] and items[j][2][0] < items[i][2][1] for i in a for j in b)


def placed(items, start, wide=()):
    # compact, then a line that faces no other line (nothing beside it: a protein over two, user
    # 2026-10-22, mevalonate LKB1; a protein next to a tall inner complex, carnitine PKA-C) has its
    # centre in the middle of what the complex holds along the axis; one on a line (within TOL) joins it
    new, end, lines = compact(items, start, wide=wide)
    floor = [-float('inf')] * len(lines)
    for k, line in enumerate(lines):
        if len(lines) > 1 and not any(faces(items, line, other) for other in lines if other is not line):
            # its node's centre in the middle of the others' nodes (not counting a multimer's second
            # outline or icons: eNOS), the complex not widened
            lo = min(new[i] - items[i][4] for i in range(len(items)) if i not in line)
            hi = max(new[i] + items[i][4] for i in range(len(items)) if i not in line)
            floor[k] = min((lo + hi) / 2, end - max(items[i][1][1] for i in line))
    if max(floor) > -float('inf'):
        new, end, lines = compact(items, start, floor, wide)
    return new, end


def scaffold(k):  # a protein drawn tall, as a scaffold its partners dock on (SKILL.md 3, Sizes)
    gn = k.find('g:data/y:GenericNode', NS)
    return gn is not None and gn.get('configuration', '').endswith('Macromolecule') and box(k)[3] > 40.5


def pack_one(n, state):
    kids = members(n)
    for k in kids:
        if is_complex(k):
            pack_one(k, state)
    x, y, w, h = box(n)
    cs = []
    for k in kids:
        kx, ky, kw, kh = box(k); e = extent(k)
        cx, cy = kx + kw / 2, ky + kh / 2
        top = min([0.0] + [label_xy(l, kw, kh)[1] for l in realizer(k).findall('y:NodeLabel', NS)
                           if l.get('iconData') in state and label_xy(l, kw, kh)]) - kh / 2
        cs.append((cx, cy, (e[0] - cx, e[1] - cy, e[2] - cx, e[3] - cy), top, kw, kh))
    # N:2 and units of information above a member of the first row sit in the top margin (user,
    # 2026-10-18); a state variable there (not allowed, SKILL.md section 3) still counts
    if any(scaffold(k) for k in kids):  # partners keep the rows where they dock on the scaffold: fitted, not packed
        x0, y0 = min(cx + o[0] for cx, _, o, *_ in cs), min(cy + min(o[1], t) for cx, cy, o, t, *_ in cs)
        xs = [cx - x0 + LEFT for cx, *_ in cs]; wn = max(cx + o[2] for cx, _, o, *_ in cs) - x0 + LEFT
        ys = [cy - y0 + TOP for _, cy, *_ in cs]; hn = max(cy + o[3] for _, cy, o, *_ in cs) - y0 + TOP
    else:
        xs, wn = placed([(cx, (o[0], o[2]), (cy + o[1], cy + o[3]), o[0], kw / 2) for cx, cy, o, _, kw, _ in cs], LEFT)
        ys, hn = placed([(cy, (o[1], o[3]), (cx + o[0], cx + o[2]), top, kh / 2) for cx, cy, o, top, _, kh in cs], TOP,
                    {i for i, k in enumerate(kids) if is_complex(k)})
    # a name yEd shows inside at the bottom (every complex of the osteoarthritis blocks, user 2026-10-25) sits
    # under the bottom margin, as yEd draws it (room)
    name = max([float(l.get('height')) for l in realizer(n).findall('y:NodeLabel', NS) if l.get('modelName') == 'internal'
                and l.get('visible') != 'false' and (l.get('modelPosition') or '')[:1] == 'b' and (l.text or '').strip()] or [0.0])
    wn, hn = wn + RIGHT, hn + BOTTOM + name
    nx, ny = x + w / 2 - wn / 2, y + h / 2 - hn / 2
    for k, (cx, cy, *_), ax, ay in zip(kids, cs, xs, ys):
        shift(k, nx + ax - cx, ny + ay - cy)
    set_box(n, (nx, ny, wn, hn))
    for r in n.find('g:data/y:ProxyAutoBoundsNode/y:Realizers', NS):
        i = r.find('y:Insets', NS)
        for side, v in INSETS:
            i.set(side, str(v)); i.set(side + 'F', repr(float(v)))


def ligand_on_top(n):
    # a complex of one protein and one metabolite (a bound ligand, cAMP, GTP): the metabolite above the protein
    # (user, 2026-10-25, osteoarthritis cAMP-PKA block: Gsα:GTP, PKA reg:cAMP turned so; SKILL.md section 3);
    # pack() then spaces them. Returns whether it turned them
    ms = members(n)
    chem = [m for m in ms if m.find('g:data/y:GenericNode[@configuration="com.yworks.sbgn.SimpleChemical"]', NS) is not None]
    if len(ms) != 2 or len(chem) != 1:
        return False
    lig, prot = chem[0], next(m for m in ms if m is not chem[0])
    (lx, ly, lw, lh), (px, py, pw, ph) = box(lig), box(prot)
    if ly <= py:
        return False
    shift(lig, 0, py - ly); shift(prot, 0, ly + lh - ph - py)
    return True


def pack(root):
    # packs every complex (inner ones first), moves the ports on their borders with them and fits
    # all groups; returns {complex id: (old size, new size)}
    state = {r.get('id') for r in root.iter(Y + 'Resource')  # icons drawn as state variables
             if r.find('.//y:GenericNode[@configuration="com.yworks.sbgn.StateVariable"]', NS) is not None}
    nodes = {n.get('id'): n for n in root.iter(G + 'node')}
    old = {i: box(n)[2:] for i, n in nodes.items() if is_complex(n)}
    for n in nodes.values():
        if is_complex(n) and not is_complex(n.getparent().getparent()):
            pack_one(n, state)
    for e in root.iter(G + 'edge'):  # ports on a border stay on it; inside stay unless now outside
        p = e.find('.//y:Path', NS)
        for end, ax, ay in ((e.get('source'), 'sx', 'sy'), (e.get('target'), 'tx', 'ty')):
            if end not in old:
                continue
            (w0, h0), (w1, h1) = old[end], box(nodes[end])[2:]
            for a, half0, half1 in ((ax, w0 / 2, w1 / 2), (ay, h0 / 2, h1 / 2)):
                v = float(p.get(a))
                if abs(abs(v) - half0) < 1 or abs(v) > half1:
                    p.set(a, repr(half1 if v > 0 else -half1))
    fit_insets(root)
    return {i: (old[i], box(nodes[i])[2:]) for i in old}


if __name__ == '__main__':
    t = etree.parse(sys.argv[1])
    for i, ((w0, h0), (w1, h1)) in pack(t.getroot()).items():
        print('%-14s %6.1f x %6.1f -> %6.1f x %6.1f' % (i, w0, h0, w1, h1))
    t.write(sys.argv[2], encoding='UTF-8', xml_declaration=True)
