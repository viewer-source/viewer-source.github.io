















import sys
from lxml import etree

NS = {'g': 'http://graphml.graphdrawing.org/xmlns', 'y': 'http://www.yworks.com/xml/graphml'}
G, Y = '{%s}' % NS['g'], '{%s}' % NS['y']
GAP, LEFT, TOP, RIGHT, BOTTOM = 8.0, 12.0, 16.0, 12.0, 16.0
GAP_COMPLEX = 10.0
INSETS = (('left', 10), ('top', 12), ('right', 10), ('bottom', 16))
TOL = 5.0


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


def shift(n, dx, dy):
    for g in n.iter(Y + 'Geometry'):
        g.set('x', repr(float(g.get('x')) + dx)); g.set('y', repr(float(g.get('y')) + dy))


def members(g):
    sub = g.find('g:graph', NS)
    return [] if sub is None else sub.findall('g:node', NS)


def is_complex(n):
    return n.get('yfiles.foldertype') == 'group' and 'omplex' in (realizer(n).get('configuration') or '')


def label_xy(l, w, h):



    mp = l.find('.//y:SmartNodeLabelModelParameter', NS)
    if mp is None:
        return None if l.get('x') is None else (float(l.get('x')), float(l.get('y')))
    f = lambda a: float(mp.get(a)); lw, lh = float(l.get('width')), float(l.get('height'))
    return (w / 2 + f('nodeRatioX') * w - f('labelRatioX') * lw + f('offsetX') - lw / 2,
            h / 2 + f('nodeRatioY') * h - f('labelRatioY') * lh + f('offsetY') - lh / 2)


SHORT = 2.0


def name_box(n):


    x, y, w, h = box(n)
    for l in realizer(n).findall('y:NodeLabel', NS):
        if not l.get('iconData') and (l.text or '').strip() and label_xy(l, w, h):
            p = label_xy(l, w, h)
            return (x + p[0] + SHORT, y + p[1] + 3,
                    x + p[0] + float(l.get('width')) - SHORT, y + p[1] + float(l.get('height')) - 3)


def up(v, step):
    return -(-v // step) * step


def extent(n):


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





    lines = []
    for i in sorted(range(len(items)), key=lambda i: items[i][0]):
        if lines and items[i][0] - items[lines[-1][0]][0] < TOL:
            lines[-1].append(i)
        else:
            lines.append([i])
    new = [None] * len(items)
    for k, line in enumerate(lines):
        c = start - min(items[i][3] for i in line)
        for prev in lines[:k]:
            for i in prev:
                for j in line:
                    if faces(items, [i], [j]):
                        g = GAP_COMPLEX if i in wide or j in wide else GAP
                        c = max(c, new[i] + items[i][1][1] + g - items[j][1][0])
        c = max(c, floor[k]) if floor else c
        for i in line:
            new[i] = c
    return new, max(new[i] + items[i][1][1] for i in range(len(items))), lines


def faces(items, a, b):
    return any(items[i][2][0] < items[j][2][1] and items[j][2][0] < items[i][2][1] for i in a for j in b)


def placed(items, start, wide=()):



    new, end, lines = compact(items, start, wide=wide)
    floor = [-float('inf')] * len(lines)
    for k, line in enumerate(lines):
        if len(lines) > 1 and not any(faces(items, line, other) for other in lines if other is not line):


            lo = min(new[i] - items[i][4] for i in range(len(items)) if i not in line)
            hi = max(new[i] + items[i][4] for i in range(len(items)) if i not in line)
            floor[k] = min((lo + hi) / 2, end - max(items[i][1][1] for i in line))
    if max(floor) > -float('inf'):
        new, end, lines = compact(items, start, floor, wide)
    return new, end


def scaffold(k):
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


    if any(scaffold(k) for k in kids):
        x0, y0 = min(cx + o[0] for cx, _, o, *_ in cs), min(cy + min(o[1], t) for cx, cy, o, t, *_ in cs)
        xs = [cx - x0 + LEFT for cx, *_ in cs]; wn = max(cx + o[2] for cx, _, o, *_ in cs) - x0 + LEFT
        ys = [cy - y0 + TOP for _, cy, *_ in cs]; hn = max(cy + o[3] for _, cy, o, *_ in cs) - y0 + TOP
    else:
        xs, wn = placed([(cx, (o[0], o[2]), (cy + o[1], cy + o[3]), o[0], kw / 2) for cx, cy, o, _, kw, _ in cs], LEFT)
        ys, hn = placed([(cy, (o[1], o[3]), (cx + o[0], cx + o[2]), top, kh / 2) for cx, cy, o, top, _, kh in cs], TOP,
                    {i for i, k in enumerate(kids) if is_complex(k)})


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


    state = {r.get('id') for r in root.iter(Y + 'Resource')
             if r.find('.//y:GenericNode[@configuration="com.yworks.sbgn.StateVariable"]', NS) is not None}
    nodes = {n.get('id'): n for n in root.iter(G + 'node')}
    old = {i: box(n)[2:] for i, n in nodes.items() if is_complex(n)}
    for n in nodes.values():
        if is_complex(n) and not is_complex(n.getparent().getparent()):
            pack_one(n, state)
    for e in root.iter(G + 'edge'):
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
