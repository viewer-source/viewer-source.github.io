# Copy of the layout skill's snap_grid.py at 7fc1773 2026-11-12; its master is in the skill, never edited here.
# Snap to grid (user's idea, 2026-10-18; SKILL.md section 3, notes/handover.md "Snap to grid").
#   python3 snap_grid.py <in.graphml> <out.graphml> [--node 8] [--route 4] [--tol 4] [--link 12]
#   from snap_grid import snap                         snap(root) -> largest move
# Node centres go onto a node grid (8 px), arc bends and free ports onto a finer route grid (4 px).
# Plain rounding breaks alignment (102.4 and 102.6 go to 100 and 105 on a 5 px grid), so the points
# of each axis are first grouped into lines (columns, rows), and each line moves onto the grid as
# one. Points within tol of each other chain into a line, and a chain wider than 2 tol splits at
# its largest gap. Lines joined by an almost straight arc segment (off by less than link, at least
# twice as long: user, eNOS, a process 5 px off the column of the complexes it joins) merge while no
# wider than 2 link. Lines keep their order. A port fixed on a node's border (a process corner at
# 9, 9) moves with its node, and a line holding one follows it (PDH, BCAA: a node or bend lined up
# with a corner, 1 px off the 8 px grid, stays lined up); a free port (along a side) takes its
# line's place. Complexes are packed first (complex_pack, exact margins, no grid inside them; user,
# 2026-10-22), then move as one piece by their centre: the centre lands on the grid, the members
# where their sizes put them. A compartment keeps its box unless what it holds now reaches past
# its margin (complex_pack.room), and fit_insets ends it, so yEd keeps the boxes.
import sys
from lxml import etree
from complex_pack import NS, G, Y, realizer, box, shift, members, is_complex, fit_insets, pack, room


def is_group(n):
    return n.get('yfiles.foldertype') == 'group'


def units(root):
    # what moves as one piece (leaves outside complexes, outermost complexes): {id: node}, and
    # the unit each node belongs to
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
    # per axis: points [(value, kind, ref)] (unit centres first, in centre's order, then free ports
    # and bends) and links [(i, j)]: ends of almost straight segments
    pts = ([(c[0], 'node', u) for u, c in centre.items()], [(c[1], 'node', u) for u, c in centre.items()])
    at = {u: i for i, u in enumerate(centre)}
    links = ([], [])
    for e in root.iter(G + 'edge'):
        p = e.find('.//y:Path', NS)
        if p is None:
            continue
        path = []  # (x, y, index on x, index on y); None for an end on a complex member
        for end, a in ((e.get('source'), 's'), (e.get('target'), 't')):
            u = unit_of.get(end)
            if u != end:  # ports on a complex member move with the complex
                path.append(None)
                continue
            c, idx = centre[u], []
            for k, ax in enumerate('xy'):
                o = float(p.get(a + ax))
                if not o:
                    idx.append(at[u])
                else:  # along a side the port is free; on the border (a corner too) it follows the node
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
    # groups of indices, one per line: neighbours within tol chain, and a chain wider than 2 tol
    # splits at its largest gap (keeps ports 6 px apart on one side apart); then lines joined by a
    # link merge while no wider than 2 link
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
    # a line holding a node centre goes onto the node grid (at its centres' mean), lines keeping
    # their order, unless it holds a fixed port (on the border, e.g. a process corner at 9, 9) of
    # another node: that port moves with its node, so the line follows it and stays lined up with
    # it. A line holding only ports follows them, and a line of bends alone goes onto the route
    # grid; free ports take their line's place
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


def compartments(root):  # innermost first, with something inside
    gs = [g for g in root.iter(G + 'node') if is_group(g) and not is_complex(g) and members(g)]
    return sorted(gs, key=lambda g: -len(list(g.iterancestors())))


def snap(root, node=8.0, route=4.0, tol=4.0, link=12.0):
    # passes until nothing moves (2026-11-12: one pass was not stable, a second run still moved points by up to 4 px:
    # bend lines on the route grid 4 px from a node line chained into it, and lines following a border port landed off
    # the grid; on the 21 official maps and the examples two passes always settle)
    most = 0.0
    for _ in range(4):
        before = numbers(root)
        most = max(most, one_pass(root, node, route, tol, link))
        if numbers(root) == before:
            break
    return most


def numbers(root):  # every position and size, to a hundredth of a pixel
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
    for g in compartments(root):  # a box stays unless what it holds now reaches past its margin
        r = realizer(g)
        x, y, w, h = box(g)
        now = {k: min(v, 0.0) for k, v in room(g, r)[1].items()}
        x0, y0 = x + now['left'], y + now['top']
        x1, y1 = x + w - now['right'], y + h - now['bottom']
        geo = r.find('y:Geometry', NS)
        for a, v in zip(('x', 'y', 'width', 'height'), (x0, y0, x1 - x0, y1 - y0)):
            geo.set(a, repr(float(v)))
    fit_insets(root)
    return max([max(abs(mx[u]), abs(my[u])) for u in centre] or [0.0])  # largest move


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
