
















import sys
from lxml import etree
from complex_pack import NS, G, Y, realizer, box, shift, members, is_complex, fit_insets, pack, room


def is_group(n):
    return n.get('yfiles.foldertype') == 'group'


def units(root):


    us, unit_of = {}, {}
    def walk(graph):
        for n in graph.findall('g:node', NS):
            if is_complex(n) or not is_group(n):
                us[n.get('id')] = n
                for d in n.iter(G + 'node'):
                    unit_of[d.get('id')] = n.get('id')
            elif n.find('g:graph', NS) is not None:
                walk(n.find('g:graph', NS))
    walk(root.find('g:graph', NS))
    return us, unit_of


def collect(root, centre, unit_of, link):


    pts = ([(c[0], 'node', u) for u, c in centre.items()], [(c[1], 'node', u) for u, c in centre.items()])
    at = {u: i for i, u in enumerate(centre)}
    links = ([], [])
    for e in root.iter(G + 'edge'):
        p = e.find('.//y:Path', NS)
        if p is None:
            continue
        path = []
        for end, a in ((e.get('source'), 's'), (e.get('target'), 't')):
            u = unit_of.get(end)
            if u != end:
                path.append(None)
                continue
            c, idx = centre[u], []
            for k, ax in enumerate('xy'):
                o = float(p.get(a + ax))
                if not o:
                    idx.append(at[u])
                else:
                    free = abs(o) < c[2 + k] / 2 - 0.5
                    idx.append(len(pts[k])); pts[k].append((c[k] + o, 'port', (p, a + ax, u, free)))
            path.append((c[0] + float(p.get(a + 'x')), c[1] + float(p.get(a + 'y')), *idx))
        for pt in p.findall('y:Point', NS):
            v = (float(pt.get('x')), float(pt.get('y')))
            path.insert(-1, (*v, len(pts[0]), len(pts[1])))
            pts[0].append((v[0], 'bend', pt)); pts[1].append((v[1], 'bend', pt))
        for a, b in zip(path, path[1:]):
            if a is None or b is None:
                continue
            for k in (0, 1):
                d, l = abs(a[k] - b[k]), abs(a[1 - k] - b[1 - k])
                if d < link and l > 2 * d and a[2 + k] is not None and b[2 + k] is not None:
                    links[k].append((a[2 + k], b[2 + k]))
    return pts, links


def lines(values, tol, links, link):



    order = sorted(range(len(values)), key=lambda i: values[i][0])
    chains, out = [], []
    for i in order:
        if chains and values[i][0] - values[chains[-1][-1]][0] <= tol:
            chains[-1].append(i)
        else:
            chains.append([i])
    while chains:
        c = chains.pop()
        if values[c[-1]][0] - values[c[0]][0] <= 2 * tol:
            out.append(c)
            continue
        k = max(range(1, len(c)), key=lambda j: values[c[j]][0] - values[c[j - 1]][0])
        chains += [c[:k], c[k:]]
    line = {i: k for k, c in enumerate(out) for i in c}
    for i, j in links:
        a, b = line[i], line[j]
        vs = [values[x][0] for x in out[a] + out[b]]
        if a != b and max(vs) - min(vs) <= 2 * link:
            for x in out[b]:
                line[x] = a
            out[a] += out[b]; out[b] = []
    return sorted([c for c in out if c], key=lambda c: min(values[i][0] for i in c))


def targets(values, groups, node, route):





    res, prev, moved = {}, None, {}
    def foreign(gi):
        own = {values[i][2] for i in gi if values[i][1] == 'node'}
        return [i for i in gi if values[i][1] == 'port' and not values[i][2][3] and values[i][2][2] not in own]
    for gi in groups:
        cs = [values[i][0] for i in gi if values[i][1] == 'node']
        if not cs or foreign(gi):
            continue
        t = round(sum(cs) / len(cs) / node) * node
        if prev is not None and t <= prev:
            t = (prev // node + 1) * node
        for i in gi:
            res[i] = t
            if values[i][1] == 'node':
                moved[values[i][2]] = t - values[i][0]
        prev = t
    for gi in groups:
        if gi[0] in res:
            continue
        ps = [values[i][0] + moved[values[i][2][2]] for i in (foreign(gi) or gi)
              if values[i][1] == 'port' and values[i][2][2] in moved]
        cs = [values[i][0] for i in gi if values[i][1] == 'node']
        step = node if cs else route
        t = sum(ps) / len(ps) if ps else round(sum(cs or [values[i][0] for i in gi]) / len(cs or gi) / step) * step
        for i in gi:
            res[i] = t
            if values[i][1] == 'node':
                moved[values[i][2]] = t - values[i][0]
    return res, moved


def compartments(root):
    gs = [g for g in root.iter(G + 'node') if is_group(g) and not is_complex(g) and members(g)]
    return sorted(gs, key=lambda g: -len(list(g.iterancestors())))


def snap(root, node=8.0, route=4.0, tol=4.0, link=12.0):



    most = 0.0
    for _ in range(4):
        before = numbers(root)
        most = max(most, one_pass(root, node, route, tol, link))
        if numbers(root) == before:
            break
    return most


def numbers(root):
    return [round(float(v), 2) for e in root.iter(Y + 'Geometry', Y + 'Point', Y + 'Path', Y + 'Insets', Y + 'BorderInsets')
            for k, v in sorted(e.attrib.items()) if k not in ('id',)]


def one_pass(root, node, route, tol, link):
    pack(root)
    us, unit_of = units(root)
    centre = {u: (x + w / 2, y + h / 2, w, h) for u, (x, y, w, h) in ((u, box(n)) for u, n in us.items())}
    pts, links = collect(root, centre, unit_of, link)
    (tx, mx), (ty, my) = [targets(pts[k], lines(pts[k], tol, links[k], link), node, route) for k in (0, 1)]
    for u, n in us.items():
        shift(n, mx[u], my[u])
    for k, t in ((0, tx), (1, ty)):
        for i, (v, kind, ref) in enumerate(pts[k]):
            if kind == 'bend':
                ref.set('xy'[k], repr(float(t[i])))
            elif kind == 'port' and ref[3]:
                p, a, u, _ = ref
                half = centre[u][2 + k] / 2 - 0.5
                p.set(a, repr(max(-half, min(half, float(t[i] - centre[u][k] - (mx, my)[k][u])))))
    for g in compartments(root):
        r = realizer(g)
        x, y, w, h = box(g)
        now = {k: min(v, 0.0) for k, v in room(g, r)[1].items()}
        x0, y0 = x + now['left'], y + now['top']
        x1, y1 = x + w - now['right'], y + h - now['bottom']
        geo = r.find('y:Geometry', NS)
        for a, v in zip(('x', 'y', 'width', 'height'), (x0, y0, x1 - x0, y1 - y0)):
            geo.set(a, repr(float(v)))
    fit_insets(root)
    return max([max(abs(mx[u]), abs(my[u])) for u in centre] or [0.0])


if __name__ == '__main__':
    args, opt = [], {}
    it = iter(sys.argv[1:])
    for a in it:
        if a.startswith('--'):
            opt[a[2:]] = float(next(it))
        else:
            args.append(a)
    t = etree.parse(args[0])
    print('largest move %.1f px' % snap(t.getroot(), **opt))
    t.write(args[1], encoding='UTF-8', xml_declaration=True)
