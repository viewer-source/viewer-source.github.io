# Layout passes on a map's drawing, shared by the writers.
# Each works on the boxes it is given (id -> (x, y, w, h)), so a writer can run it on the boxes
# its target needs.
import math, re
from dataclasses import replace
from .model import HEADS
from .style import SIZE

PROCESSES = ('Process', 'OmittedProcess', 'UncertainProcess')
MODIFIERS = HEADS[1:]


def centre(d):
    x, y, w, h = d.box
    return x + w / 2, y + h / 2


def border(d, p):
    # where the line from the node's centre to p leaves its box
    (cx, cy), (w, h) = centre(d), d.box[2:]
    dx, dy = p[0] - cx, p[1] - cy
    if not dx and not dy:
        return cx, cy
    t = min(w / 2 / abs(dx) if dx else float('inf'), h / 2 / abs(dy) if dy else float('inf'))
    return cx + t * dx, cy + t * dy



COUNT_H = 11.0  # a cardinality's box: 11 high, 5 px a character and 3 each side, 1 px off the line


def count_line(N, a):
    # a cardinality's line: from where it leaves its entity to where it meets its process
    first = N[a.source].kind not in PROCESSES  # the entity at the source (a consumption drawn either way)
    ent, hub = (a.source, a.target) if first else (a.target, a.source)
    at, pts = (a.source_at, list(a.points)) if first else (a.target_at, list(a.points)[::-1])
    hub_at = a.target_at if first else a.source_at
    E, Hb, Hc = N[ent], N[hub], centre(N[hub])
    nxt = pts[0] if pts else (Hc[0] + hub_at[0], Hc[1] + hub_at[1])
    p0 = (centre(E)[0] + at[0], centre(E)[1] + at[1]) if any(at) else border(E, nxt)
    p1 = (Hc[0] + hub_at[0], Hc[1] + hub_at[1]) if any(hub_at) else border(Hb, pts[-1] if pts else p0)
    return [p0] + pts + [p1]


def _sum(v):
    # a plain sum in order, as the viewer's JavaScript adds (Python's sum() compensates, from 3.12, and differs in the
    # last digit)
    t = 0.0
    for x in v:
        t += x
    return t


def _lens(line):
    return [math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1])) for p, q in zip(line, line[1:])]


def count_on(line, text, pos=None):
    # where a cardinality is drawn (SBGN PD 2.7.1: a box with a long side along the line), 1 px off the line: at pos
    # (r: how far along from the entity, 0, to the process, 1; s: 1 on the left of that way, -1 on the right), or by
    # default (None) beside the middle, above it (right of a line near upright)
    lens = _lens(line)
    half, k = _sum(lens) * (pos[0] if pos else 0.5), 0  # sqrt, not hypot: the viewer's JavaScript gives the same last digit
    while k < len(lens) - 1 and half > lens[k]:
        half -= lens[k]
        k += 1
    L = lens[k] or 1.0
    ux, uy = (line[k + 1][0] - line[k][0]) / L, (line[k + 1][1] - line[k][1]) / L
    if not lens[k]:
        ux, uy = 1.0, 0.0
    mx, my = line[k][0] + ux * half, line[k][1] + uy * half
    nx, ny = -uy, ux
    if (pos[1] < 0) if pos else ((nx < 0) if abs(ny) < 0.2 else (ny > 0)):
        nx, ny = -nx, -ny
    w, h = 5.0 * len(text) + 6, COUNT_H
    side = 1 + abs(nx) * w / 2 + abs(ny) * h / 2
    cx, cy = mx + nx * side, my + ny * side
    return (cx - w / 2, cy - h / 2, w, h)


def count_box(N, a, text):
    # where an arc's cardinality is drawn: at its place (a.count_at), else beside the middle of its line
    return count_on(count_line(N, a), text, a.count_at)


def count_place(line, box):
    # the place (r, s) of a cardinality's box drawn by its line: its centre's nearest point on the line (the viewer's
    # countAlong); None for the default place (the middle, on its usual side)
    lens, P = _lens(line), (box[0] + box[2] / 2, box[1] + box[3] / 2)
    tot, acc, best = _sum(lens), 0.0, None
    if not tot:
        return None
    for k, L in enumerate(lens):
        if not L:
            continue
        a = line[k]
        ux, uy = (line[k + 1][0] - a[0]) / L, (line[k + 1][1] - a[1]) / L
        t = max(0.0, min(L, (P[0] - a[0]) * ux + (P[1] - a[1]) * uy))
        qx, qy = a[0] + ux * t, a[1] + uy * t
        d = math.sqrt((P[0] - qx) * (P[0] - qx) + (P[1] - qy) * (P[1] - qy))
        if best is None or d < best[0]:
            best = (d, (acc + t) / tot, 1 if (P[0] - qx) * -uy + (P[1] - qy) * ux >= 0 else -1)
        acc += L
    r, s = math.floor(best[1] * 10000 + 0.5) / 10000, best[2]  # as the JavaScript's Math.round
    if abs(r - 0.5) < 0.005:
        d, u = count_on(line, 'x'), count_on(line, 'x', (0.5, s))
        if abs(d[0] - u[0]) < 0.01 and abs(d[1] - u[1]) < 0.01:
            return None
        r = 0.5
    return (r, s)


CARD = re.compile(r'^\s*(\d+(\.\d+)?|\?)\s*$')  # a cardinality: a number or ? (anything else is none)


def count_text(v):
    # a cardinality as written: ?, or a number (1, not 1.0; 2.5); anything else None
    m = CARD.match(v or '')
    if not m:
        return None
    if m.group(1) == '?':
        return '?'
    f = float(m.group(1))
    return str(int(f)) if f == int(f) else repr(f)


def flux(N, a):
    # a consumption (a plain line at a process, either way, as biology reads it) or production (out of one) arc: the
    # arcs a cardinality belongs to
    s, t = N[a.source].kind in PROCESSES, N[a.target].kind in PROCESSES
    return (a.head is None and s != t) or (a.head == 'production' and s and not t)


def compartment_of(N, i):
    # a node's enclosing compartment
    q = N[i].parent
    while q is not None and N[q].kind != 'Compartment':
        q = N[q].parent
    return q


def decorations(d):
    # a node's state variables (their boxes) and units of information (label, box), as written
    x, y, w, h = d.box
    cx, cy = x + w / 2, y + h / 2
    states = []
    for txt, rx, ry in d.states:
        # as yEd's icons on the atlas maps; a longer text (a drawn site, Ac@K1234) as wide as it needs at this height
        sw = 15.0 if len(txt) <= 2 else max(45.0, round((len(txt) * 5.4 + 12) * 15 / 18, 2))
        states.append((cx + rx * w - sw / 2, cy + ry * h - 7.5, sw, 15.0))
    units = []
    for u, rx, ry in unit_places(d):
        uw = max(3, len(u)) * 7.0  # at least N:2's width, as graphml.write
        units.append((u, (cx + rx * w - uw / 2, cy + ry * h - 7.5, uw, 15.0)))
    return states, units


def unit_places(d, own=None):
    # a node's units of information (N:x added for a multimer beyond 2) with their places (rx, ry): where the file put
    # them (own, else d.unit_at, by index), the others spread evenly along the top, each in its slot among all
    own = d.unit_at if own is None else own
    units = d.units + (['N:%d' % d.count] if d.count > 2 and not any(re.fullmatch(r'N:\d+', u) for u in d.units) else [])
    return [(u,) + tuple((own[k] if k < len(own) else None) or ((k + 1) / (len(units) + 1) - 0.5, -0.5)) for k, u in enumerate(units)]


def own_places(d):
    # the places a reader found (d.unit_at) less those that are the default slot, so a file read and written again
    # keeps its default units unplaced
    slot = [(rx, ry) for _, rx, ry in unit_places(d, [])]
    out = [p if p and k < len(slot) and (abs(p[0] - slot[k][0]) > 1e-6 or abs(p[1] - slot[k][1]) > 1e-6) else None for k, p in enumerate(d.unit_at)]
    while out and out[-1] is None:
        out.pop()
    return out


def main_lines(diagram, box, ents, origin=(0, 0)):
    # each process's arcs, the main reactant and product first: {process: (ins, outs, mods, gates,
    # reversible, centre)}, None for a process with no reactant or product; ents the entity ids,
    # origin what was taken off the map's coordinates to give box (the arcs' bends are the map's)
    N, E = diagram.nodes, diagram.arcs
    procs = [i for i, d in N.items() if d.kind in PROCESSES]
    ops = {i for i, d in N.items() if d.kind == 'Operator'}
    cen = lambda i: (box[i][0] + box[i][2] / 2, box[i][1] + box[i][3] / 2)
    # what each process turns into what: consumed -> produced entities (a process with production
    # arcs only, reversible: among those, both ways)
    steps = {}
    for q in procs:
        cons = {e.source for e in E if e.target == q and e.source in ents and e.head is None} | \
            {e.target for e in E if e.source == q and e.target in ents and e.head is None and not e.tail}
        prod = {e.target for e in E if e.source == q and e.target in ents and e.head == 'production'}
        steps[q] = (cons or prod, prod)

    def flows(p):
        # consumption arcs: no arrowhead, drawn either way in yEd (entity -> process or
        # process -> entity); turned to entity -> process
        ins = [e for e in E if e.target == p and e.source in ents and e.head is None]
        ins += [replace(e, source=e.target, target=p, points=e.points[::-1], source_at=e.target_at, target_at=e.source_at) for e in E
                if e.source == p and e.target in ents and e.head is None and not e.tail]
        outs = [e for e in E if e.source == p and e.target in ents and e.head is not None]
        mods = [e for e in E if e.target == p and e.source in ents and e.head in MODIFIERS]
        gates = [e for e in E if e.target == p and e.source in ops and e.head in MODIFIERS]
        # reversible (SBGN: production arcs on both sides): the arcs on the upper (or left) side
        # are the reactants; an arc's side is that of its first bend, else of its entity
        reversible = not ins and len(outs) >= 2
        c = cen(p)
        if reversible:
            at = lambda e: (e.points[0][0] - origin[0], e.points[0][1] - origin[1]) if e.points else cen(e.target)
            # the axis the arcs spread along most, all together (a straight side arc must not decide it)
            ax = 1 if sum(abs(at(e)[1] - c[1]) for e in outs) >= sum(abs(at(e)[0] - c[0]) for e in outs) else 0
            ins = [replace(e, source=e.target, target=p, points=e.points[::-1], source_at=e.target_at, target_at=e.source_at) for e in outs if at(e)[ax] < c[ax]]
            outs = [e for e in outs if at(e)[ax] >= c[ax]]
        if not ins or not outs:
            return None
        # the main direction: the reactant and product that face each other through the
        # process, centre to centre; the others are extra links (CellDesigner: first one
        # source and one target, then more substrates and products; eNOS)
        def through(a, b):
            (ax, ay), (bx, by) = cen(a), cen(b)
            L2 = (bx - ax) ** 2 + (by - ay) ** 2 or 1
            t_ = ((c[0] - ax) * (bx - ax) + (c[1] - ay) * (by - ay)) / L2
            d = abs((bx - ax) * (c[1] - ay) - (by - ay) * (c[0] - ax)) / math.sqrt(L2)
            return d + (0 if 0 < t_ < 1 else 1e6)  # the process between them
        # small molecules are side substrates: a main line between larger species first
        # (complex to complex; eNOS BH4/BH2 exchange)
        small = lambda i: 1 if N[i].kind in ('SimpleChemical', 'EmptySet') else 0
        # then a pair drawn straight through the process (3 px), then a pair on a cycle: the product
        # leads back to the reactant through other processes (iNOS: arginine,
        # citrulline, argininosuccinate, not O2, NO, fumarate, aspartate)
        def cycle(a, b):
            seen, todo = {b}, [b]
            for i in todo:
                for q, (cons, prod) in steps.items():
                    if q != p and i in cons:
                        todo += [j for j in prod if j not in seen]
                        seen |= prod
            return a not in seen
        # never a pair whose square (midway) would sit on another node
        def covered(a, b):
            mx, my = ((cen(a)[0] + cen(b)[0]) / 2, (cen(a)[1] + cen(b)[1]) / 2)
            return any(box[j][0] < mx < box[j][0] + box[j][2] and box[j][1] < my < box[j][1] + box[j][3]
                       for j in ents if j not in (a, b))
        bi, bo = min(((a, b) for a in range(len(ins)) for b in range(len(outs))),
                     key=lambda ab: (small(ins[ab[0]].source) + small(outs[ab[1]].target),
                                     covered(ins[ab[0]].source, outs[ab[1]].target),
                                     through(ins[ab[0]].source, outs[ab[1]].target) > 3,
                                     cycle(ins[ab[0]].source, outs[ab[1]].target),
                                     through(ins[ab[0]].source, outs[ab[1]].target), ab))
        ins = [ins[bi]] + ins[:bi] + ins[bi + 1:]; outs = [outs[bo]] + outs[:bo] + outs[bo + 1:]
        return ins, outs, mods, gates, reversible, c

    return {p: flows(p) for p in procs}


def twins(diagram, ents):
    # the processes that join the same species as another process, by consumption and production
    # arcs (phosphorylation and dephosphorylation of HMGCR; a hand edit of mevalonate): their
    # lines must not fall on one another
    N, E = diagram.nodes, diagram.arcs
    joins = {p: frozenset(e.target if e.source == p else e.source for e in E if p in (e.source, e.target) and e.head not in MODIFIERS
                          and (e.source in ents or e.target in ents)) for p, d in N.items() if d.kind in PROCESSES}
    return {p for p in joins if any(q != p and joins[q] == joins[p] for q in joins)}


def route(pts, c, box):
    # the route points of an arc at a process (centre c, box), without the process's ports (one
    # process size from its centre)
    return [q for q in pts if math.dist(q, c) > max(box[2], box[3]) + 3]


# Bends: lines stay straight except for a long connector that
# yEd draws as one L (one corner), and in the advanced layout the bends that shape a route. From yEd
# only the way the L turns is taken (horizontal or vertical first); the corner is built from the ends:
# x of one, y of the other (hand edits of glycolysis and aspirin match it to the pixel).
EPS = 20.0       # a yEd bend counts if leaving it out moves the line by more than this
MIN_LEN = 150.0  # only connectors at least this long


def off(p, a, b):  # distance of p from the line through a and b
    L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    return abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / L


def _simplify(pts, eps):
    # Ramer-Douglas-Peucker: keep only the points that shape the line
    if len(pts) < 3:
        return pts
    d = [off(p, pts[0], pts[-1]) for p in pts[1:-1]]
    i = max(range(len(d)), key=d.__getitem__)
    if d[i] < eps:
        return [pts[0], pts[-1]]
    return _simplify(pts[:i + 2], eps)[:-1] + _simplify(pts[i + 1:], eps)


def turn(route):
    # 'h' (horizontal first) or 'v' (vertical first) when the route from its
    # first point is one long L, else None
    if sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(route, route[1:])) < MIN_LEN:
        return None
    keep = _simplify(route, EPS)
    if len(keep) != 3:
        return None
    (sx, sy), (cx, cy) = keep[0], keep[1]
    return 'h' if abs(cy - sy) < abs(cx - sx) else 'v'


def unbent(run, tol=1):
    # a polyline without the points that lie on the straight line between their neighbours
    # (between them, within tol px): no bend in either program
    run = list(run)
    k = 1
    while k < len(run) - 1:
        (ax, ay), (bx, by), (qx, qy) = run[k - 1], run[k], run[k + 1]
        if off(run[k], run[k - 1], run[k + 1]) < tol and \
                min(ax, qx) - tol <= bx <= max(ax, qx) + tol and min(ay, qy) - tol <= by <= max(ay, qy) + tol:
            del run[k]
        else:
            k += 1
    return run


def exit_point(b, p, q):
    # where the segment from p (inside box b) to q leaves the box
    x, y, w, h = b
    t = 1.0
    for v, d, lo, hi in ((p[0], q[0] - p[0], x, x + w), (p[1], q[1] - p[1], y, y + h)):
        if d:
            t = min(t, ((hi if d > 0 else lo) - v) / d)
    return p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])


NEAR = 3.5  # a bend this close outside an entity's border reads as its port (visible)
fixed = PROCESSES + ('Operator',)


def visible(m):
    # the bends a map read from CellDesigner shows (CellDesigner files hold many
    # hidden bends). CellDesigner draws its nodes over the arcs, so the bends at the start of an arc
    # inside its source, and at its end inside its target, are not seen: left out, the arc's port
    # where the line leaves or enters the node when the line from the port would differ (a process
    # or operator keeps its port). A bend at most NEAR px outside an entity counts as under it: where
    # the line meets the border, as the converter's no-move file wrote a port before its places (cd_layout.EDGE).
    # Then the bends on the straight line between their neighbours, from the ports
    def inside(q, d):
        b, e = d.box, 0.0 if d.kind in fixed else NEAR
        return b[0] - e < q[0] < b[0] + b[2] + e and b[1] - e < q[1] < b[1] + b[3] + e
    at = lambda d, p: (p[0] - centre(d)[0], p[1] - centre(d)[1])
    for a in m.arcs:
        S, T = m.nodes[a.source], m.nodes[a.target]
        s = (centre(S)[0] + a.source_at[0], centre(S)[1] + a.source_at[1])
        t = (centre(T)[0] + a.target_at[0], centre(T)[1] + a.target_at[1])
        pts = list(a.points)
        k = 0
        while k < len(pts) and inside(pts[k], S):
            k += 1
        if k:
            nxt = pts[k] if k < len(pts) else t
            if S.kind not in fixed and not inside(nxt, S) and off(exit_point(S.box, pts[k - 1], nxt), s, nxt) >= 1:
                s = exit_point(S.box, pts[k - 1], nxt)
                a.source_at = at(S, s)
            pts = pts[k:]
        k = len(pts)
        while k and inside(pts[k - 1], T):
            k -= 1
        if k < len(pts):
            prev = pts[k - 1] if k else s
            if T.kind not in fixed and not inside(prev, T) and off(exit_point(T.box, pts[k], prev), t, prev) >= 1:
                t = exit_point(T.box, pts[k], prev)
                a.target_at = at(T, t)
            pts = pts[:k]
        a.points = unbent([s] + pts + [t])[1:-1]
    return m


def bends(route, eps=EPS):
    # the bends that shape a route (advanced layout), its ends left out
    return _simplify(route, eps)[1:-1]


def corner(a, b, way):
    return (b[0], a[1]) if way == 'h' else (a[0], b[1])


TOL = 3  # px: bends this close to one line were meant to be on it


def aligned(m, tol=TOL):
    # a map read from CellDesigner, whose bends are placed by hand (ExposomeMap-PM: lanes
    # of arcs 1 to 3 px apart): each bend coordinate within tol of an arc's end goes onto it, its own arc's
    # end first, then bends within tol of each other onto one line (their median); bends left in the middle
    # of a level or upright run are dropped. No node and no arc end moves.
    end = lambda i, at: (centre(m.nodes[i])[0] + at[0], centre(m.nodes[i])[1] + at[1])
    lines = [[end(a.source, a.source_at)] + [list(p) for p in a.points] + [end(a.target, a.target_at)] for a in m.arcs]
    for ax in (0, 1):
        ends = sorted({P[k][ax] for P in lines for k in (0, -1)})
        free = []
        for P in lines:
            for k in range(1, len(P) - 1):
                near = [P[j][ax] for j in (k - 1, k + 1) if j in (0, len(P) - 1) and abs(P[j][ax] - P[k][ax]) <= tol]
                if near:
                    P[k][ax] = min(near, key=lambda v: abs(v - P[k][ax]))
                else:
                    free.append(P[k])
        free.sort(key=lambda p: p[ax])
        i = 0
        while i < len(free):  # runs of bends no more than tol apart from the first
            j = i
            while j + 1 < len(free) and free[j + 1][ax] - free[i][ax] <= tol:
                j += 1
            run = free[i:j + 1]
            mid = run[len(run) // 2][ax]
            e = min(ends, key=lambda v: abs(v - mid), default=None)
            v = e if e is not None and all(abs(e - p[ax]) <= tol for p in run) else mid
            for p in run:
                p[ax] = v
            i = j + 1
    for a, P in zip(m.arcs, lines):
        keep = [P[k] for k in range(1, len(P) - 1)
                if not any(P[k - 1][x] == P[k][x] == P[k + 1][x] for x in (0, 1))]
        a.points = [tuple(p) for p in keep]
    return m


def at_centres(m):
    # the straight layout of a map read from a file with its own geometry (CellDesigner): every arc
    # at its nodes' centres, metabolites at the atlas yEd size (a 40 x 40 circle), centre kept
    for d in m.nodes.values():
        if d.kind == 'SimpleChemical':
            W, H = SIZE['SimpleChemical']
            d.box = (d.box[0] + d.box[2] / 2 - W / 2, d.box[1] + d.box[3] / 2 - H / 2, W, H)
    for a in m.arcs:
        a.source_at = a.target_at = (0.0, 0.0)
    return m
