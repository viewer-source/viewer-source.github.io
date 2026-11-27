# The CellDesigner adapter: where every line, square and point
# goes as CellDesigner draws it, before the file is written. The boxes in CellDesigner's frame and
# sizes, each reaction's main line and each modifier arc's end, anchor and edit points. It moves no
# node but for the room of a complex's name (cd_tidy.py moves some for the advanced file); held (as
# drawn): process glyphs and ports held by edit points.
import math
from dataclasses import dataclass
from . import layout, report
from .layout import main_lines

MARGIN = 40
NAME_ROOM = 14.0  # below the members' outline in a complex, for its name (as the yEd packing rule)
SHIFT = 3.0  # the process glyph placed by edit points only when yEd has it further from midway (px)
LINK = 5.0  # an added link keeps a bend of the input only when leaving it out moves the line more (px; short Ls)
HOLD = 10.0  # straight & bends, advanced: the process glyph held where the input has it, when something meets it and midway is further (px)
EDGE = 3.0  # an added edit point stays this far outside a node, as CellDesigner draws lines over nodes (px)
ROUND = ('SimpleChemical', 'UnspecifiedEntity')  # drawn by CellDesigner as an ellipse: lines end on it
CHEMICAL = 40.0  # metabolites are drawn as circles of this diameter, centred on the yEd node
# the points of the process square a modifier can end at (targetLineIndex -1,i): (along the flow,
# to its right) in half square sizes (MINERVA's getAnchorPointOnReactionRect; a hand edit of PDH
# has 6 and 7)
SQUARE = {2: (0, -1), 3: (0, 1), 4: (-1, -1), 5: (1, -1), 6: (-1, 1), 7: (1, 1)}

# CellDesigner's 16 ports on a node, worked out from its box and lying on its outline (CellDesigner's
# anchor points; Startup Guide, Appendix 2.3; cd2sbgnml): the
# quarter points (written for two processes on the same two species), the sides' middles and
# the corners
QUARTER = {'NNE': (.75, 0), 'ENE': (1, .25), 'ESE': (1, .75), 'SSE': (.75, 1),
           'SSW': (.25, 1), 'WSW': (0, .75), 'WNW': (0, .25), 'NNW': (.25, 0)}
ANCHOR = dict(QUARTER, N=(.5, 0), NE=(1, 0), E=(1, .5), SE=(1, 1), S=(.5, 1), SW=(0, 1), W=(0, .5), NW=(0, 0))
# on an ellipse the points sit at 22.5 degree steps (checked through MINERVA; cd2sbgnml)
ANGLE = {k: 22.5 * i for i, k in enumerate(['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW',
                                            'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'])}


def anchor_point(box, side, circle=False, hexagon=False):
    x, y, w, h = box
    if not side:  # no anchor: the centre
        return (x + w / 2, y + h / 2)
    if circle:
        a = math.radians(ANGLE[side])
        return (x + w / 2 * (1 + math.cos(a)), y + h / 2 * (1 - math.sin(a)))
    if hexagon:  # a phenotype: on its hexagon, corners h/2 in from the tips, the quarter points halfway along an
        # edge (CellDesigner's PDF of ExposomeMap-PM, CellDesigner 4.4, 190 x 40 boxes)
        i = min(h / 2, w / 2)
        fx, fy = ANCHOR[side]
        if fy in (0, 1):  # top or bottom: the flat edge between the corners, N in the middle
            u = {0: i, .25: (w / 2 + i) / 2, .5: w / 2, .75: (w * 1.5 - i) / 2, 1: w - i}[fx]
            return (x + u, y + fy * h)
        d = i * (1 - 2 * min(fy, 1 - fy))  # the slanted edges: i in from the side at a corner, 0 at the tip
        return (x + fx * w + (d if fx == 0 else -d), y + fy * h)
    fx, fy = ANCHOR[side]
    return (x + fx * w, y + fy * h)


# Helvetica's widths per 1000 of the font size, characters 32 to 126 (a copy of WIDTHS in the viewer's cdrender.js,
# which is the master); any other character 556
WIDTHS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
          556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778,
          722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
          278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
          556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]


def text_width(s, size=12):
    return sum(WIDTHS[ord(c) - 32] if 32 <= ord(c) < 127 else 556 for c in s) * size / 1000


def name_inside(box, name, at, th=12.0):
    # a compartment's name point (the top left of the name's box: its widest line, 23 high and 14 more a line, drawn at
    # 12) moved back inside a rectangular compartment where the box reaches past its right or bottom inner edge, as
    # CellDesigner moves it on saving: the membrane's thickness th + 5 from the right, + 0.5 from the bottom (the
    # viewer's cdrender.js, namePoint); a name moved goes 2 px further from the right, as CellDesigner's own widths
    # run up to 1.8 px wider than these. CellDesigner leaves a name near the left or top edge where it is
    lines = name.split('\n')
    w, h = max(text_width(l) for l in lines), 23 + 14 * (len(lines) - 1)
    x, y, bw, bh = box
    right, bottom = x + bw - th - 5 - w, y + bh - th - 0.5 - h
    return (min(at[0], right - 2) if at[0] > right else at[0], max(min(at[1], bottom), min(at[1], y)))  # never above it


def square_point(sq, f, a, c, r=5):
    # a point of the process square at sq (half size r), flow f: a along the flow, c to its right
    return (sq[0] + r * (a * f[0] - c * f[1]), sq[1] + r * (a * f[1] + c * f[0]))


def meet(M, T, way=None):
    # the anchor where a line from a metabolite circle at M towards T leaves it, its name across
    # the middle: the top or bottom, or the lower quarter of a side (way 'h' or 'v': its first leg)
    dx, dy = (T[0] - M[0]) * (way != 'v'), (T[1] - M[1]) * (way != 'h')
    if abs(dy) >= abs(dx):
        return 'N' if dy < 0 else 'S'
    return 'ESE' if dx > 0 else 'WSW'

def rim(box, circle, P, Q):
    # where CellDesigner draws a line's end at the centre P of a node (towards Q): on its border, an ellipse for a
    # metabolite (the join of an added link is measured from there; tests/celldesigner/added-link-bends.xml)
    if not circle:
        return layout.exit_point(box, P, Q)
    dx, dy = Q[0] - P[0], Q[1] - P[1]
    t = min(1.0, 1 / (math.hypot(dx / (box[2] / 2), dy / (box[3] / 2)) or 1))
    return (P[0] + t * dx, P[1] + t * dy)


def joins(P, Q):
    # where an added reactant's and an added product's link join the process glyph's segment P -> Q: 3/8 and 5/8
    return [(P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])) for t in (0.375, 0.625)]


def to_frame(a, b, p):
    # p in CellDesigner's edit point frame: origin a, x axis b - a, y axis the
    # x axis turned 90 degrees (screen coordinates)
    ex = (b[0] - a[0], b[1] - a[1]); ey = (-ex[1], ex[0])
    det = ex[0] * ey[1] - ex[1] * ey[0]
    q = (p[0] - a[0], p[1] - a[1])
    return ((q[0] * ey[1] - q[1] * ey[0]) / det, (ex[0] * q[1] - ex[1] * q[0]) / det)


def from_frame(a, b, p):
    # inverse of to_frame: a point given in the edit point frame a -> b
    ex = (b[0] - a[0], b[1] - a[1]); ey = (-ex[1], ex[0])
    return (a[0] + p[0] * ex[0] + p[1] * ey[0], a[1] + p[0] * ex[1] + p[1] * ey[1])

def boxes(N, ents, members):
    # (box, origin, size): every node's box with the map starting at MARGIN, origin what was taken
    # off the map's coordinates, size the canvas; ents the entity ids, members complex -> members
    x0 = min(d.box[0] for d in N.values()) - MARGIN
    y0 = min(d.box[1] for d in N.values()) - MARGIN
    box = {i: (d.box[0] - x0, d.box[1] - y0, d.box[2], d.box[3]) for i, d in N.items()}
    W = max(b[0] + b[2] for b in box.values()) + MARGIN
    H = max(b[1] + b[3] for b in box.values()) + MARGIN
    # metabolites: circles, centre kept (the map size above keeps room for their labels)
    for i, d in N.items():
        if d.kind == 'SimpleChemical':
            x, y, w, h = box[i]
            box[i] = (x + w / 2 - CHEMICAL / 2, y + h / 2 - CHEMICAL / 2, CHEMICAL, CHEMICAL)
    # multimers: drawn as dimers at yEd's size, the count beyond 2 in a unit (celldesigner.write)
    # CellDesigner writes a complex's name at the bottom inside it: its members move up to leave
    # NAME_ROOM below their outline (a state variable on the bottom edge 8.5 px below the node,
    # yEd's second shape of a multimer 6 px), as far as the space above allows, and the complex
    # grows down for the rest; a GraphML packed by the skill's complex_pack.py has the room and
    # keeps its geometry (first 25 px from the node, pyrimidine edits);
    # inner complexes first
    def low(j):
        x, y, w, h = box[j]
        n = N[j].count if j in ents else 1
        return y + h + max([0.0] + [8.5 for s in N[j].states if s[2] > 0.45] + [6.0] * (n > 1))
    for c in sorted(members, key=lambda c: len(descendants(c, members))):
        inner = descendants(c, members)
        x, y, w, h = box[c]
        need = max(low(j) for j in inner) + NAME_ROOM - (y + h)
        if need > 0:
            up = min(need, max(0.0, min(box[j][1] for j in inner) - y - 8))
            for j in inner:
                box[j] = (box[j][0], box[j][1] - up) + box[j][2:]
            box[c] = (x, y, w, h + need - up)
    return box, (x0, y0), (W, H)


@dataclass
class Drawing:
    box: dict       # id -> (x, y, w, h), CellDesigner's frame
    front: dict     # entity -> the box its lines meet (a multimer's front shape)
    size: tuple     # the canvas
    cen: object     # id -> the centre of its box
    lines: object   # () -> each process's arcs, the main reactant and product first (layout.py)
    geometry: object  # (process, its lines) -> its main line: ends, anchors, edit points, square
    modifier: object  # (process, main line, arc, several regulators, square point i or None) -> (i, M, T, anchor, bends)
    side: object    # (main line, point) -> the side of the square facing the point
    end: object     # (main line, i) -> the square's point i (targetLineIndex -1,i)
    yed: object     # yEd points -> the same points in this frame
    placed: dict    # (process, end) -> (entity, place, how far the line's end moved from the input's port, px)
    anchored: object  # (entity, its input port, the line's next point) -> the place a main line's end takes, or None
    link: object    # (process, main line, arc, into) -> an added reactant's or product's place and edit points (CellDesigner's frame)
    spots: object   # (process, main line, its lines) -> by modifier arc id, the point i of the square it ends at


def draw(diagram, ents, members, label, advanced, held=False):
    # ents the entity ids, members complex -> members, label entity -> name (for the messages);
    # advanced: the input's bends, anchors and modifier routes (else straight lines); held: also the
    # process glyphs and ports where the input has them, by edit points (as drawn)
    N = diagram.nodes
    box, (x0, y0), size = boxes(N, ents, members)
    cen = lambda i: (box[i][0] + box[i][2] / 2, box[i][1] + box[i][3] / 2)
    # each process's arcs, the main reactant and product first (layout.py), on the boxes as they are
    lines = lambda: main_lines(diagram, box, ents, (x0, y0))

    # ports sit on the front shape of a multimer: CellDesigner draws it 6 smaller in
    # width and height (the glycolysis file: PFKFB2 dimer; every multimer is a dimer here)
    front = {}
    for i, d in ents.items():
        k = 6 if d.count > 1 and d.kind != 'SimpleChemical' else 0
        front[i] = (box[i][0], box[i][1], box[i][2] - k, box[i][3] - k)

    twins = layout.twins(diagram, ents)
    yed = lambda pts: [(q[0] - x0, q[1] - y0) for q in pts]  # yEd points in the map's frame here

    route = lambda p, pts: layout.route(yed(pts), cen(p), box[p])

    def off_line(i, a, T):  # anchor a of entity i moves its line to T by more than 2 px
        A, C = anchor_point(box[i], a, N[i].kind == 'SimpleChemical', N[i].kind == 'Phenotype'), cen(i)
        return abs((T[0] - C[0]) * (A[1] - C[1]) - (T[1] - C[1]) * (A[0] - C[0])) / (math.dist(C, T) or 1) > 2

    def port(i, at):  # where an arc meets entity i in the input, scaled to its box here
        return (cen(i)[0] + at[0] * box[i][2] / N[i].box[2], cen(i)[1] + at[1] * box[i][3] / N[i].box[3])

    placed = {}

    def placed_at(key, i, a, P, at, toward):
        # a line's end on entity i, for the report: at place a (point P), or at its centre (a None), the line on
        # towards the point toward; how far that end moved from the input's port (a place: the distance; the
        # centre: how far the port lies off the line). An input aiming at the centre moved nothing, nor a metabolite
        # circle's place where its name is not (CellDesigner's convention there, not the input's port)
        Y, C = port(i, at), cen(i)
        if math.hypot(*at) <= 0.5 or N[i].kind == 'SimpleChemical': d = 0.0
        elif a: d = math.dist(P, Y)
        else: d = abs((toward[0] - C[0]) * (Y[1] - C[1]) - (toward[1] - C[1]) * (Y[0] - C[0])) / (math.dist(C, toward) or 1)
        placed[key] = (i, a, d)

    def nearest(i, at, toward):
        # the anchor nearest to where an arc meets entity i (scaled to its box here), if nearer than
        # its centre; on a metabolite circle not E or W, where the name is: ESE, WSW. An anchor whose line on to the
        # point toward runs back through the node (a port the input put inside it, on the far side: SREBP, sterol
        # binding through SCAP and SREBP2) gives way to the one where that line leaves the node, else to none
        circle = N[i].kind == 'SimpleChemical'
        pt = lambda a: anchor_point(box[i], a, circle, N[i].kind == 'Phenotype')
        x, y, w, h = box[i]
        m = (1 - math.sqrt(.5)) / 2 if circle else 0  # inside a circle: the square within it
        inner = (x + w * m + 3, y + h * m + 3, w * (1 - 2 * m) - 6, h * (1 - 2 * m) - 6)
        Y = (cen(i)[0] + at[0] * w / N[i].box[2], cen(i)[1] + at[1] * h / N[i].box[3])
        for k in (0, 1):
            if k:
                Y = layout.exit_point(box[i], Y, toward)
            u, v = Y[0] - cen(i)[0], Y[1] - cen(i)[1]
            a = min(ANCHOR, key=lambda a: math.dist(pt(a), Y))
            if math.dist(pt(a), Y) >= math.hypot(u, v):
                return None
            a = {'E': 'ESE', 'W': 'WSW'}.get(a, a) if circle else a
            if not crosses(pt(a), toward, inner):
                return a
        return None

    def anchored(i, at, T):  # as geometry gives a main line's end a place (advanced, not twins)
        a = nearest(i, at, T) or (meet(cen(i), T, None) if N[i].kind == 'SimpleChemical' else None)
        return a if a and off_line(i, a, T) else None

    def level(e, c):
        # a modifier arc that reaches the process at c straight across in yEd (5 px), in line with
        # its port or its centre (PD02 eicosanoids: an arc from above the process to a corner)
        q = yed(e.points)[-1] if e.points else \
            (cen(e.source)[0] + e.source_at[0], cen(e.source)[1] + e.source_at[1])
        return any(min(abs(q[0] - c[0] - t[0]), abs(q[1] - c[1] - t[1])) <= 5 for t in (e.target_at, (0, 0)))

    def reach(s, v, b):
        # how far from s along the unit vector v the box b, grown by EDGE, begins (inf: never)
        t0, t1 = 0.0, math.inf
        for a in (0, 1):
            lo, hi = b[a] - EDGE, b[a] + b[a + 2] + EDGE
            if abs(v[a]) < 1e-12:
                if not lo <= s[a] <= hi: return math.inf
            else:
                ta, tb = sorted(((lo - s[a]) / v[a], (hi - s[a]) / v[a]))
                t0, t1 = max(t0, ta), min(t1, tb)
        return t0 if t0 <= t1 else math.inf

    def geometry(p, fl, place=True):
        # the main line of process p: its ends, anchors, bend, the square and the flow direction;
        # place (not held): the square where yEd has it, where a modifier needs it (else midway)
        ins, outs, mods, gates, reversible, c = fl
        r_, q_ = ins[0].source, outs[0].target
        ra = qa = None  # line ends at the centres
        # advanced: the significant bends of the yEd route (a Z, a detour round other nodes; PD02
        # eicosanoids)
        rb = layout.bends([cen(r_)] + route(p, ins[0].points) + [c]) if advanced else []
        qb = layout.bends([c] + route(p, outs[0].points) + [cen(q_)]) if advanced else []
        if not rb + qb and p in twins:
            # two processes on the same two species, drawn straight (a hand edit of mevalonate,
            # HMGCR): each a straight line between quarter points on the facing sides, on the side
            # of the line between the centres where yEd has the process (upper/lower, left/right)
            (rx_, ry_), (qx_, qy_) = cen(r_), cen(q_)
            side = (qx_ - rx_) * (c[1] - ry_) - (qy_ - ry_) * (c[0] - rx_)  # >0: process right of r->q
            if abs(qx_ - rx_) >= abs(qy_ - ry_):  # side by side: E/W faces, upper or lower quarter
                v = 'N' if (side < 0) == (qx_ > rx_) else 'S'
                fr, fq = ('E', 'W') if qx_ > rx_ else ('W', 'E')
                ra, qa = fr + v + fr, fq + v + fq
            else:  # stacked: N/S faces, left or right quarter
                v = 'W' if (side > 0) == (qy_ > ry_) else 'E'
                fr, fq = ('S', 'N') if qy_ > ry_ else ('N', 'S')
                ra, qa = fr + fr + v, fq + fq + v
        twin = bool(ra)
        # a significant bend on the main line: one long L on the reactant arc or on the product arc
        # (with the bend at the process's port: it says from which side the line comes in;
        # a hand edit of iNOS, ASL and ASS1 as L shapes)
        wr = layout.turn([cen(r_)] + yed(ins[0].points) + [c])
        wq = layout.turn([cen(q_)] + yed(outs[0].points)[::-1] + [c])
        if advanced and not twin:
            # a line meets an entity where the yEd arc meets its border (a CellDesigner anchor read
            # back); else a metabolite circle where its name is not: N, S, ESE or WSW, by the way
            # it leaves (the L's first leg, else towards the process; PD02 eicosanoids)
            other = {'h': 'v', 'v': 'h'}
            ra = nearest(r_, ins[0].source_at, (yed(ins[0].points) + [c])[0]) or (meet(cen(r_), c, wr or (other[wq] if wq else None)) if N[r_].kind == 'SimpleChemical' else None)
            qa = nearest(q_, outs[0].target_at, ([c] + yed(outs[0].points))[-1]) or (meet(cen(q_), c, wq or (other[wr] if wr else None)) if N[q_].kind == 'SimpleChemical' else None)
            # only where they change the line (a hand edit of pyrimidine: side middles on the
            # line's own axis removed)
            ra = ra if ra and off_line(r_, ra, (rb + [c])[0]) else None
            qa = qa if qa and off_line(q_, qa, (qb[::-1] + [c])[0]) else None
        A = anchor_point(front[r_] if ra else box[r_], ra, N[r_].kind == 'SimpleChemical', N[r_].kind == 'Phenotype')
        B = anchor_point(front[q_] if qa else box[q_], qa, N[q_].kind == 'SimpleChemical', N[q_].kind == 'Phenotype')
        # edit points: one long L (both layouts); in the advanced layout else the route's bends
        pts, k, corner = rb + qb, len(rb), False
        # a line's end at a CellDesigner place: its first bend moves on the leg's axis into line with that place, so a
        # leg straight in the input stays straight (no point added for it); on a metabolite circle also a leg the input
        # drew from the centre's height (meet: where the name is not; a hand edit of phosphoinositides: PI(3,4)P2 ->
        # PI4P, a 7 px jog where yEd's bend stayed at the centre's height)
        for j, (i, a, P, at) in ((0, (r_, ra, A, ins[0].source_at)), (-1, (q_, qa, B, outs[0].target_at))):
            if pts and a:
                q, C, Y = pts[j], cen(i), port(i, at)
                ax = 1 if abs(q[0] - Y[0]) >= abs(q[1] - Y[1]) else 0  # the axis the leg keeps, from the port
                if not (abs(q[ax] - Y[ax]) < 1 or N[i].kind == 'SimpleChemical' and abs(q[ax] - C[ax]) < 1):
                    continue
                if N[i].kind == 'SimpleChemical' and abs(q[ax] - C[ax]) < 1:
                    ax = 1 if abs(q[0] - C[0]) >= abs(q[1] - C[1]) else 0
                # the segment after that bend (to the next bend, else the process) gets no more slant, and a leg there
                # keeps its way and stays a leg (EPS): else the bend stays, the end leg tilts
                Q = (q[0], P[1]) if ax else (P[0], q[1])
                n_ = pts[j + 1] if j == 0 and len(pts) > 1 else pts[j - 1] if j == -1 and len(pts) > 1 else c
                slant = lambda a: min(abs(n_[0] - a[0]), abs(n_[1] - a[1]))
                if slant(Q) > slant(q) + 1:
                    continue
                if n_ is not c and abs(n_[1 - ax] - q[1 - ax]) < 1 and \
                        ((n_[ax] - Q[ax]) * (n_[ax] - q[ax]) <= 0 or abs(n_[ax] - Q[ax]) < layout.EPS):
                    continue
                pts[j] = Q
        bend = (layout.corner(A, B, wr) if wr else layout.corner(B, A, wq)) if bool(wr) != bool(wq) and not twin else None
        if bend and (not pts or len(pts) == 1 and math.dist(bend, pts[0]) < layout.EPS):  # else a slanting leg (PD02)
            corner = min(math.hypot(bend[0] - P[0], bend[1] - P[1]) for P in (A, B)) >= layout.EPS
            pts, k = ([bend], 1 if wr else 0) if corner else ([], 0)  # else the ends are already in line
        # the square (CellDesigner: midway on segment k; after the corner when yEd has the
        # process on the arc that bends from the reactant) and the flow direction through it
        run = [A] + pts + [B]
        P, Q = run[k], run[k + 1]
        sq = ((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2)
        L = math.hypot(Q[0] - P[0], Q[1] - P[1])
        f = ((Q[0] - P[0]) / L, (Q[1] - P[1]) / L)
        ep = [to_frame(A, B, q) for q in pts]
        u = ((c[0] - P[0]) * f[0] + (c[1] - P[1]) * f[1]) / L
        across = abs((c[0] - P[0]) * f[1] - (c[1] - P[1]) * f[0])
        at = (P[0] + u * L * f[0], P[1] + u * L * f[1])  # yEd's process, onto the segment
        # the process glyph held at at by two edit points d px either side on the line, so CellDesigner draws nothing
        # more and the way back drops them (layout.visible); both outside the end nodes (EDGE: a hand edit of
        # phosphoinositides, a point inside GRB2:GAB1 drew the line through the complex), else it stays midway
        room = min(reach(at, (w * f[0], w * f[1]), box[i]) for w in (-1, 1) for i in (r_, q_))
        def hold(d, along=False):  # along: on a straight line, the points as their fraction of it
            split = [(u - d / L, 0.0), (u + d / L, 0.0)] if along and not pts else \
                [to_frame(A, B, (at[0] + t * f[0], at[1] + t * f[1])) for t in (-d, d)]
            return at, ep[:k] + split + ep[k:], k + 1
        if held and across < 12 and abs(u - 0.5) * L > SHIFT and 0.1 < u < 0.9:
            # as drawn: where yEd has the process when that is on its segment and more than SHIFT px from midway (a
            # hand edit of pyrimidine, CAD), the points half way to the nearer end so the arcs keep their antennas
            d = min(min(u, 1 - u) / 2 * L, room)
            if d >= 1:
                sq, ep, k = hold(d)
        met = mods or gates or len(ins) > 1 or len(outs) > 1
        if advanced and not held and met and across < 30 and abs(u - 0.5) * L > HOLD and 0.1 < u < 0.9:
            # straight & bends, advanced: something meets the glyph (a modifier, a gate, an added reactant or product)
            # and midway is more than HOLD px from yEd's process: held there, the points HOLD px either side; else the
            # lines meeting it run across the map to midway (cAMP map: PDE3B, 186 px)
            d = min(HOLD, min(u, 1 - u) * L - 1, room)
            if d >= 1:
                (sq, ep, k), place = hold(d), False
        off = lambda m: min(abs(cen(m)[0] - sq[0]), abs(cen(m)[1] - sq[1]))  # a modifier off its square
        if advanced and not held and place and not corner and any(level(e, c) and off(e.source) > 0.5 for e in mods + gates):
            # a modifier (or logic gate) straight across in yEd that cd_tidy could not move onto the midway square:
            # held for it, from 3 px off midway
            if across < 3 and abs(u - 0.5) * L > 3 and 0.1 < u < 0.9:
                d = min(min(u, 1 - u) / 2 * L, room)
                if d >= 1:
                    sq, ep, k = hold(d, True)
        if not twin:  # twins: quarter points chosen for the pair, not from the input's ports
            placed_at((p, 'r'), r_, ra, A, ins[0].source_at, run[1]); placed_at((p, 'q'), q_, qa, B, outs[0].target_at, run[-2])
        return dict(r=r_, q=q_, ra=ra, qa=qa, A=A, B=B, ep=ep, k=k, sq=sq, f=f)

    def side(g, pt):  # the side of the square facing a point: 2 left of the flow, 3 right
        f, sq = g['f'], g['sq']
        return 2 if f[0] * (pt[1] - sq[1]) - f[1] * (pt[0] - sq[0]) < 0 else 3

    def lane(M, T, pts):
        # advanced layout: the edit points of an arc from M to T through yEd's bends pts (in this frame), or
        # None for a straight arc
        if not pts:
            return None  # straight: from the centre, or from its CellDesigner place (modifier)
        # the yEd bends, each segment made horizontal or vertical, the last one ending on the square
        chain = [M] + pts
        for i in range(1, len(chain)):
            a, b = chain[i - 1], chain[i]
            chain[i] = (b[0], a[1]) if abs(b[1] - a[1]) < abs(b[0] - a[0]) else (a[0], b[1])
        # the last bend in line with T across the leg before it, so that leg keeps its way and the last one turns
        a, b = chain[-2], chain[-1]
        chain[-1] = (T[0], b[1]) if abs(a[1] - b[1]) < 0.5 else (b[0], T[1])
        return layout.unbent(chain + [T])[1:-1]

    def crosses(a, b, r):  # the segment a-b runs through the box r (Liang-Barsky)
        t0, t1 = 0.0, 1.0
        for p_, q_ in ((a[0] - b[0], a[0] - r[0]), (b[0] - a[0], r[0] + r[2] - a[0]),
                       (a[1] - b[1], a[1] - r[1]), (b[1] - a[1], r[1] + r[3] - a[1])):
            if p_ == 0:
                if q_ < 0: return False
            elif p_ < 0: t0 = max(t0, q_ / p_)
            else: t1 = min(t1, q_ / p_)
        return t0 < t1

    def target(g, e, pt, many):
        # the point of the square an arc from pt ends at: the side facing pt; in the advanced layout,
        # where several arcs regulate the process and yEd ends this one off its centre, the point
        # nearest that yEd port, so the arcs stay apart (PDH)
        o, h, f = e.target_at, N[e.target].box[2] / 2, g['f']
        if advanced and many and math.hypot(*o) > 2:
            a, c = (o[0] * f[0] + o[1] * f[1]) / h, (o[1] * f[0] - o[0] * f[1]) / h
            if abs(c) > 0.5:
                return min(SQUARE, key=lambda i: math.dist(SQUARE[i], (a, c)))
        return side(g, pt)

    def attach(g, i):  # the square's point i (targetLineIndex -1,i)
        return square_point(g['sq'], g['f'], *SQUARE[i])

    def lane_place(i, Y, q):
        # a lane the input starts level or upright from a port Y of entity i off its centre line (more than 3 px) to
        # its first bend q: the CellDesigner place on the side facing q nearest that lane, within 12 px (mevalonate:
        # PP2A's lane to HMGCR runs below PP2C and HMGCR; from the centre it ran through both), else None
        C = cen(i)
        upright = abs(Y[0] - q[0]) < 3
        if not upright and abs(Y[1] - q[1]) >= 3:
            return None
        ax = 0 if upright else 1  # the lane's place across its way
        if abs(Y[ax] - C[ax]) <= 3:
            return None
        pt = lambda a: anchor_point(front[i], a, hexagon=N[i].kind == 'Phenotype')
        fits = [a for a in ANCHOR if abs(pt(a)[ax] - Y[ax]) <= 12 and (q[1 - ax] - pt(a)[1 - ax]) * (pt(a)[1 - ax] - C[1 - ax]) > 0]
        return min(fits, key=lambda a: abs(pt(a)[ax] - Y[ax])) if fits else None

    def modifier(p, g, e, many, i=None):
        # a modifier arc of process p (main line g): the point of the square it ends at (i: given), its start M,
        # its end T, the anchor on the modifier and its edit points; many: several arcs regulate p
        m = e.source; M = cen(m)
        # the side facing the arc's last bend where yEd bends it, else its start (a hand edit of
        # phosphoinositides: EGF:EGFR catalysing its own step sits on the main line, and the arc ended on
        # the far side, its arrowhead hidden)
        i = target(g, e, (yed(e.points)[-1] if advanced and e.points else M), many) if i is None else i
        T = attach(g, i)  # the arc's end on the square (the bends of a hand edit of glycolysis)
        # a straight arc from off the centre of another entity: the nearest CellDesigner place (as read
        # back), never a point added outside the node to keep its line level
        at = advanced and not e.points and N[m].kind != 'SimpleChemical' and nearest(m, e.source_at, cen(p))
        if advanced and e.points and N[m].kind != 'SimpleChemical':
            at = lane_place(m, port(m, e.source_at), yed(e.points)[0])
        if at and (e.points or off_line(m, at, T)):
            M = anchor_point(front[m], at, hexagon=N[m].kind == 'Phenotype')
        else:
            at = None
        pts = advanced and lane(M, T, yed(e.points))
        if advanced and N[m].kind == 'SimpleChemical':
            # it leaves the circle where the name is not (meet), its first bend in line with that point
            at = meet(M, pts[0] if pts else T)
            M = anchor_point(box[m], at, True)
            if pts:
                q = pts[0]
                pts[0] = (q[0], M[1]) if at in ('ESE', 'WSW') else (M[0], q[1])
        if pts:
            run = [M] + pts + [T]
            for j in ents:
                if j != m and N[j].parent not in ents and m not in descendants(j, members) and \
                        any(crosses(a, b, box[j]) for a, b in zip(run, run[1:])):
                    report.say('warning', '%s: the arc from %s runs through %s' % (p, label[m] or m, label[j] or j))
        else:
            # a significant bend: one long L from the modifier to that end
            w = layout.turn([cen(m)] + route(p, e.points) + [cen(p)])
            bend = layout.corner(M, T, w) if w else None
            if bend and min(math.hypot(bend[0] - P[0], bend[1] - P[1]) for P in (M, T)) < layout.EPS:
                bend = None
            pts = [bend] if bend else []
        placed_at((p, id(e)), m, at, M, e.source_at, (pts or [T])[0])
        return i, M, T, at, pts

    def link(p, g, e, into):
        # an added reactant (into) or product of process p (main line g): its place on the species (a metabolite's
        # where its name is not, else None: the centre) and its edit points, from the species to the join for a
        # reactant, from the join to the species for a product (CellDesigner's frame), yEd's bends kept level or
        # upright (lane); none in the straight layout or for a link straight in the input
        if not advanced:
            return None, []
        i = e.source if into else e.target
        run = [g['A']] + [from_frame(g['A'], g['B'], q) for q in g['ep']] + [g['B']]
        k = g['k']
        P, Q = run[k], run[k + 1]
        P = rim(box[g['r']], N[g['r']].kind in ROUND, P, Q) if k == 0 and not g['ra'] else P
        Q = rim(box[g['q']], N[g['q']].kind in ROUND, Q, P) if k == len(run) - 2 and not g['qa'] else Q
        J = joins(P, Q)[0 if into else 1]
        O = cen(i)
        pts = route(p, e.points if into else e.points[::-1])  # from the species on
        pts = lane(O, J, layout.bends([O] + pts + [J], LINK)) or []
        at = None
        if N[i].kind == 'SimpleChemical' and pts:
            # it leaves the circle where the name is not, its first bend in line (a straight link keeps the centre: a
            # place there would tilt it)
            at = meet(O, pts[0])
            O = anchor_point(box[i], at, True)
            q = pts[0]
            pts[0] = (q[0], O[1]) if at in ('ESE', 'WSW') else (O[0], q[1])
        return at, [to_frame(O, J, q) for q in pts] if into else [to_frame(J, O, q) for q in pts[::-1]]

    def spots(p, g, fl):
        # by arc id, the point of the square each modifier arc of process p (main line g) ends at: as target gives it,
        # but two on the middle of one side go to that side's corners when both are free, the one further back along
        # the flow upstream, so their ends are not drawn on top of each other (nNOS: PP1C and PP2AC)
        mods, many = fl[2], len(fl[2]) + len(fl[3]) > 1
        at = {e.id: target(g, e, yed(e.points)[-1] if advanced and e.points else cen(e.source), many) for e in mods}
        along = lambda e: ((cen(e.source)[0] - g['sq'][0]) * g['f'][0] + (cen(e.source)[1] - g['sq'][1]) * g['f'][1], e.id)
        for middle, corners in ((2, (4, 5)), (3, (6, 7))):
            two = sorted((e for e in mods if at[e.id] == middle), key=along)
            if len(two) == 2 and not set(corners) & set(at.values()):
                at[two[0].id], at[two[1].id] = corners
        return at

    return Drawing(box, front, size, cen, lines, geometry, modifier, side, attach, yed, placed, anchored, link, spots)


def say_places(drawing, label):
    # per entity, where the CellDesigner file differs from the input at its line ends: places two lines
    # share (CellDesigner's own way when a side has more lines than places) and ends moved more than 5 px
    by = {}
    for i, a, d in drawing.placed.values():
        by.setdefault(i, []).append((a, d))
    for i, ps in sorted(by.items()):
        shared = sorted(a for a in set(a for a, _ in ps if a) if sum(b == a for b, _ in ps) > 1)
        far = max(d for _, d in ps)
        if shared or far > 5:
            report.say('changed', '%s: line ends at CellDesigner\'s places or centre%s%s' % (label.get(i) or i,
                       ', shared: ' + ', '.join('%s by %d' % (a, sum(b == a for b, _ in ps)) for a in shared) if shared else '',
                       ', moved up to %.0f px from the input' % far if far > 5 else ''))


def descendants(i, members):
    out = []
    for m in members.get(i, []):
        out += [m] + descendants(m, members)
    return out
