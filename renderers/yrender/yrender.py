# Draw a yEd GraphML map (SBGN palette) as yEd exports it: SVG at 1:1 with a 15 px margin,
# PNG at 2:1 with an 8 px margin.
#   python3 tools/yrender.py map.graphml map.svg [map.png] [--roles]
# Twin of yrender.js beside it, the master since 2026-11-13 (user: JavaScript the master for the viewer's own build and
# the editor); this file stays for the Python tools that use the renderer, its copies elsewhere taken from here.
# Before: the master here since 2026-11-11. Copies elsewhere start with a line
# naming the commit they were taken from and are never edited; a change is made here and checked on the demo, and the
# same change in yrender.js beside it (the editor's redraw, 2026-11-13): tests/yrender-compare.js checks both draw alike.
# The vocabulary is closed: a node type, style, shape, arrow or option not listed below stops
# the script with a list of what it cannot draw, and nothing is written.
# Rules read from yEd's own exports of the website maps (2026-10-17):
#  - shapes: Macromolecule corner radius 12 (style 'radius'), Complex corner cut 15 ('radiusX',
#    'radiusY'), NucleicAcidFeature bottom radius 12, Phenotype indent h/4, round rectangle 4,
#    multimer (mcount 2): a second outline 6 px down and right, behind the node
#  - labels: the GraphML keeps each label's box; the text block (ascent and line height as yEd
#    measured them, Dialog being Lucida Grande on a Mac) is centred in it inside the insets
#  - state variables and units of information are label icons (a node kept in Resources),
#    centred in the label box
#  - edges: from port to port through the bends, cut at the node's shape outline (its shape with its state
#    variables and units of information: visual_end, user 2026-11-14); soft bends are
#    quadratic curves cutting 10 px (at most half a segment) on each side of the bend
#  - arrows: tip on the outline; the line stops where the arrow head covers it. A catalysis circle or an
#    inhibition bar cut at the outline, or with its port on it, is moved back along its line until 2 px
#    of white part it from the outline, also when it comes in at a slant (user, 2026-11-14: "doesn't
#    look nice when it touches", the bar "almost becomes invisible"; 1 px tried for the circle and not enough);
#    a port 1 px or more outside the shape, as hand-made gaps, as given. The file is never changed, only the drawing
#  - an arc goes behind its own nodes (2026-11-14, user: a bend or an antenna's tip inside a node drew the line across
#    it, to its middle): it starts where it first leaves its source and stops where it last enters its target;
#    a stick whose tip lies inside a node joined by an arc at that port stops on that node's outline, and that arc runs along
#    the stick between the two outlines (a product keeps its arrowhead); nodes inside one another as before
#  - PerturbingAgent: the Phenotype's hexagon turned inside out, its points indented h/4 (2026-11-11, the SBGN
#    learner's card); white_diamond (modulation) 16 long and 12 wide like white_delta; a QuadCurveEdge drawn as a
#    polyline with soft bends (yEd's spline is close to that at the card's straightness 0.1)
#  - association and dissociation (2026-11-14, user): a Process whose node property "SBGN class" says so (yEd has
#    neither) drawn as SBGN's filled circle or circle in a circle (the inner one 0.6 of the outer), the generic square
#    kept beside it in <g class="sbgn-generic" display="none">, the circles in <g class="sbgn-association"> or
#    "sbgn-dissociation", so a page can show either; the arcs end at the square's outline as before
#  - ports (2026-11-14, user: proper SBGN ports, not bend points): a Process (any SBGN class) or an Operator (logic
#    gate) gets a stick on each side, ANTENNA (0.5; 0.75 first, too long on the demo) of its side long, never shorter
#    than ANTENNA_MIN (0.5 of our standard 18 px process: small squares need room), drawn beside the glyph. Port one:
#    where a consumption or a gate's input ends (an arc without arrows between a hub and an entity, whichever way it
#    was drawn). Port two: where every other arc leaving the hub starts (a product, a gate's output; with nothing
#    coming in, each takes the nearer port: reversible). The axis runs from the mean of the arcs' near points coming
#    in to that of those going out (with nothing coming in, along the leaving arcs' spread), horizontal unless
#    steeper (a gate: from its centre to what it controls, user 2026-11-14: its output turned back otherwise), as the
#    converter puts SBGN-ML's ports; ports the map gives (an arc's end outside the glyph, as the
#    converter keeps SBGN-ML's own: each tool's antenna length, user 2026-11-14) are drawn where they are. Bends lying on a stick (the bend points that drew antennas
#    before) are left out; modifiers end on the glyph's outline as before; arc labels keep yEd's anchor point
#  - UnspecifiedEntity drawn as an ellipse, dashed lines as dashes 6 and gaps 2 times the line width
#    (2026-10-27; checked against a yEd export: same shapes)
#  - edge labels: placed from the edge's first point (anchor and up vector when rotated,
#    turned half round when upside down)
#  - the image spans the nodes and their labels; edges are painted after the top-level
#    block (a group with its members, or a node) that holds their later end
# --roles (the website's /colours/ page): every fill gets the class c-<role> of the node it draws
# (ROLE below; label boxes, units of information, state variables and white arrow heads c-white),
# every text t-<role> of the fill it sits on (t-page outside any node), in place of their colours;
# lines, borders and filled arrow heads get no colour, so they take the root's (the page's Lines).
# Node fills are opaque then (a node without fill gets one), label backgrounds keep their transparency.
import sys, re, math, html
from lxml import etree

G = '{http://graphml.graphdrawing.org/xmlns}'
Y = '{http://www.yworks.com/xml/graphml}'
MARGIN = 15
SBGN = 'com.yworks.sbgn.'
NODE_STYLES = {'Macromolecule', 'SimpleChemical', 'Complex', 'Process', 'EmptySet', 'Operator',
               'Phenotype', 'Submap', 'NucleicAcidFeature', 'StateVariable', 'UnitOfInformation',
               'UnspecifiedEntity', 'PerturbingAgent'}
SHAPES = {'rectangle', 'roundrectangle'}
HUBS = {'Process', 'Operator'}
EQUIV = '\u2261'  # the equivalence operator's label in yEd's SBGN palette
ANTENNA, ANTENNA_MIN = 0.5, 9
STYLE_PROPS = {'radius', 'radiusX', 'radiusY', 'mcount'}
ARROWS = {'none', 'delta', 'white_delta', 'white_circle', 'white_delta_bar', 't_shape', 'white_diamond'}
AIR, AIR_MAX = {'white_circle': 2, 't_shape': 2}, 16  # px of white each head keeps off the outline (the header, arrows)
FONTS = {  # ascent and line height / font size as yEd measured them; fallbacks for systems without the font
    'Dialog': (0.9668, 1.1777, "'Dialog', Arial, Helvetica, sans-serif"),
    'Arial': (0.905, 1.1172, "Arial, Helvetica, sans-serif"),
    'Monospaced': (0.9282, 1.1641, 'monospace'),
}
FONT_STYLES = {'plain': '', 'bold': ' font-weight="bold"', 'italic': ' font-style="italic"',
               'bolditalic': ' font-weight="bold" font-style="italic"'}

errors = []
ROLES = False  # set by render(roles=True)
CLASSES = False  # set by the caller (the viewer's build and editor): the classes of --roles beside the colours, so a
# colour scheme (the viewer's Settings, Map colours) can recolour the fills by role; off, the output is unchanged


def role(tag, kind, fill):
    # the /colours/ role of a node: its realizer's tag, yEd style (or shape) and fill
    fill = (fill or '').upper()
    if tag == 'GroupNode':
        return 'compartment'
    if tag == 'ShapeNode':
        return 'white'  # a label on its own box
    if tag == 'GenericGroupNode':
        return 'compartment' if kind == 'Compartment' or fill.startswith('#EDEBE4') else 'complex'
    if kind == 'Complex':
        return 'complex'  # one without members
    if kind == 'Macromolecule':
        return 'hlProtein' if fill == '#E2ACA3' else 'protein'
    return {'SimpleChemical': 'metabolite', 'NucleicAcidFeature': 'gene'}.get(kind, 'white')


def refuse(where, what):
    errors.append(f'{where}: {what}')


def num(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def color(c):
    # '#RRGGBB' or '#RRGGBBAA' -> (rgb, opacity)
    c = c.lstrip('#')
    return '#' + c[:6], (int(c[6:8], 16) / 255 if len(c) == 8 else 1)


def paint(attr, c):
    rgb, a = color(c)
    return f' {attr}="{rgb}"' + (f' {attr}-opacity="{num(a)}"' if a < 1 else '')


def ink(attr, c):
    # a line's colour; with roles none, so the root's
    return '' if ROLES else paint(attr, c)


def area(c, rl, opaque=True):
    # a fill's colour; with roles its class (and its transparency unless opaque)
    if not ROLES:
        return paint('fill', c) + (f' class="c-{rl}"' if CLASSES else '')
    a = color(c)[1]
    return f' class="c-{rl}"' + (f' fill-opacity="{num(a)}"' if a < 1 and not opaque else '')


def white():
    # a white arrow head's fill
    return area('#FFFFFF', 'white') if ROLES else ' fill="white"' + (' class="c-white"' if CLASSES else '')


# Outlines: lists of ('M'|'L', x, y), ('Q', cx, cy, x, y), ('C', c1x, c1y, c2x, c2y, x, y), ('Z',)
K = 0.5523  # cubic approximation of a quarter circle

def rect(x, y, w, h):
    return [('M', x, y), ('L', x + w, y), ('L', x + w, y + h), ('L', x, y + h), ('Z',)]


def round_rect(x, y, w, h, r, quad=True):
    # quad: yEd's quadratic corners; otherwise circular corners (cubic curves)
    r = min(r, w / 2, h / 2)
    out = [('M', x, y + r)]
    for cx, cy, ex, ey, lx, ly in ((x, y, x + r, y, x + w - r, y),
                                   (x + w, y, x + w, y + r, x + w, y + h - r),
                                   (x + w, y + h, x + w - r, y + h, x + r, y + h),
                                   (x, y + h, x, y + h - r, x, y + r)):
        sx, sy = out[-1][-2:]
        out.append(('Q', cx, cy, ex, ey) if quad else
                   ('C', sx + (cx - sx) * K, sy + (cy - sy) * K, ex + (cx - ex) * K, ey + (cy - ey) * K, ex, ey))
        out.append(('L', lx, ly))
    return out[:-1] + [('Z',)]


def ellipse(x, y, w, h):
    return round_rect(x, y, w, h, max(w, h), quad=False)


def oval(x, y, w, h):
    # an ellipse of any proportions, four cubic curves
    a, b, cx, cy = w / 2, h / 2, x + w / 2, y + h / 2
    return [('M', cx, y), ('C', cx + a * K, y, x + w, cy - b * K, x + w, cy),
            ('C', x + w, cy + b * K, cx + a * K, y + h, cx, y + h),
            ('C', cx - a * K, y + h, x, cy + b * K, x, cy),
            ('C', x, cy - b * K, cx - a * K, y, cx, y), ('Z',)]


def octagon(x, y, w, h, rx, ry):
    rx, ry = min(rx, w / 2), min(ry, h / 2)
    pts = [(x + rx, y), (x + w - rx, y), (x + w, y + ry), (x + w, y + h - ry),
           (x + w - rx, y + h), (x + rx, y + h), (x, y + h - ry), (x, y + ry)]
    return [('M',) + pts[0]] + [('L',) + p for p in pts[1:]] + [('Z',)]


def nucleic(x, y, w, h, r):
    r = min(r, w / 2, h)
    return [('M', x, y), ('L', x + w, y), ('L', x + w, y + h - r), ('Q', x + w, y + h, x + w - r, y + h),
            ('L', x + r, y + h), ('Q', x, y + h, x, y + h - r), ('Z',)]


def hexagon(x, y, w, h, inward=False):
    i = h / 4
    if inward:  # perturbing agent: the points go into the box
        pts = [(x, y), (x + w, y), (x + w - i, y + h / 2), (x + w, y + h), (x, y + h), (x + i, y + h / 2)]
    else:
        pts = [(x + i, y), (x + w - i, y), (x + w, y + h / 2), (x + w - i, y + h), (x + i, y + h), (x, y + h / 2)]
    return [('M',) + pts[0]] + [('L',) + p for p in pts[1:]] + [('Z',)]


def d(cmds):
    return ' '.join(c[0] + ' '.join(num(v) for v in c[1:]) for c in cmds)


def polygon(cmds, steps=8):
    pts, cur = [], None
    for c in cmds:
        if c[0] in 'ML':
            cur = c[1:]; pts.append(cur)
        elif c[0] == 'Q':
            (x0, y0), (cx, cy, x, y) = cur, c[1:]
            pts += [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x,
                     (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y)
                    for t in (i / steps for i in range(1, steps + 1))]
            cur = (x, y)
        elif c[0] == 'C':
            (x0, y0), (ax, ay, bx, by, x, y) = cur, c[1:]
            pts += [((1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * ax + 3 * (1 - t) * t * t * bx + t ** 3 * x,
                     (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * ay + 3 * (1 - t) * t * t * by + t ** 3 * y)
                    for t in (i / steps for i in range(1, steps + 1))]
            cur = (x, y)
    return pts


def inside(p, poly):
    # even-odd test
    x, y = p; n = len(poly); c = False
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def clip(outer, port, polys, crossed=False):
    # where the segment from outer to port first meets the node's outlines (a multimer has
    # two); the port itself when it lies outside them. crossed: any outline the segment crosses
    # counts, the port inside it or not (a state variable on the way)
    (px, py), (qx, qy) = outer, port
    best = None
    for poly in polys:
        if not crossed and not inside(port, poly):
            continue
        for i in range(len(poly)):
            (ax, ay), (bx, by) = poly[i - 1], poly[i]
            den = (qx - px) * (by - ay) - (qy - py) * (bx - ax)
            if abs(den) < 1e-12:
                continue
            t = ((ax - px) * (by - ay) - (ay - py) * (bx - ax)) / den
            u = ((ax - px) * (qy - py) - (ay - py) * (qx - px)) / den
            if 0 <= t <= 1 and 0 <= u <= 1 and (best is None or t < best):
                best = t
    return port if best is None else (px + (qx - px) * best, py + (qy - py) * best)


def within(p, polys):
    return any(inside(p, poly) for poly in polys)


def behind(pts, n):
    # an arc goes behind the node it starts at (user, 2026-11-14: a bend or an antenna's tip inside the node drew the
    # line across it, to its middle): the leading points inside the node's outline are dropped and the line starts where
    # it first leaves it. None when every point lies inside (nested nodes, or a port inside the node: edge_svg)
    k = 0
    while k < len(pts) and within(pts[k], n['polys']):
        k += 1
    if k == len(pts):
        return None
    if k == 0:  # the end itself outside the shape: as visual_end gives it (a state variable on the way still stops it)
        return [visual_end(pts[1], pts[0], n)] + pts[1:]
    return [visual_end(pts[k], pts[k - 1], n)] + pts[k:]


# ---- reading the GraphML ----

def style_props(r):
    p = {}
    for e in r.iter(Y + 'Property'):
        name = e.get('name').replace(SBGN + 'style.', '')
        p[name] = e.get('value')
    return p


def outline(kind, x, y, w, h, props):
    if kind == 'Macromolecule': return round_rect(x, y, w, h, float(props.get('radius', 12)))
    if kind in ('SimpleChemical', 'StateVariable'): return round_rect(x, y, w, h, min(w, h) / 2, quad=False)
    if kind == 'Complex': return octagon(x, y, w, h, float(props.get('radiusX', 15)), float(props.get('radiusY', 15)))
    if kind == 'NucleicAcidFeature': return nucleic(x, y, w, h, float(props.get('radius', 12)))
    if kind in ('EmptySet', 'Operator'): return ellipse(x, y, w, h)
    if kind == 'UnspecifiedEntity': return oval(x, y, w, h)
    if kind == 'Phenotype': return hexagon(x, y, w, h)
    if kind == 'PerturbingAgent': return hexagon(x, y, w, h, inward=True)
    if kind == 'roundrectangle': return round_rect(x, y, w, h, 4, quad=False)
    return rect(x, y, w, h)  # Process, Submap, UnitOfInformation, rectangle


def realizer(node):
    data = [c for dd in node.findall(G + 'data') for c in dd if isinstance(c.tag, str) and c.tag.startswith(Y)]
    for r in data:
        tag = r.tag[len(Y):]
        if tag == 'ProxyAutoBoundsNode':
            rs = r.find(Y + 'Realizers')
            return list(rs)[int(rs.get('active'))]
        if tag in ('GenericNode', 'ShapeNode', 'GroupNode', 'GenericGroupNode'):
            return r
        refuse('node ' + node.get('id'), f'unknown node type {tag}')
    return None


def kind_of(r, where):
    tag = r.tag[len(Y):]
    if tag in ('GenericNode', 'GenericGroupNode'):
        k = (r.get('configuration') or '').replace(SBGN, '')
        if k not in NODE_STYLES:
            refuse(where, f'unknown node style {r.get("configuration")}')
        return k
    k = r.find(Y + 'Shape').get('type')
    if k not in SHAPES:
        refuse(where, f'unknown shape {k}')
    return k


def check_fill_border(r, where):
    f = r.find(Y + 'Fill'); b = r.find(Y + 'BorderStyle')
    if f is not None and f.get('color2'):
        refuse(where, 'gradient fill')
    if b is not None and b.get('type') != 'line':
        refuse(where, f'border type {b.get("type")}')
    fill = None if f is None or f.get('transparent') == 'true' or not f.get('color') else f.get('color')
    stroke = None if b is None or b.get('hasColor') == 'false' else (b.get('color'), float(b.get('width')))
    return fill, stroke


def shape_svg(cmds, fill, stroke, rl='white'):
    s = ''
    if fill:
        s += f'<path d="{d(cmds)}"{area(fill, rl)} stroke="none"/>'
    if stroke:
        s += f'<path d="{d(cmds)}" fill="none"{ink("stroke", stroke[0])}' + \
             (f' stroke-width="{num(stroke[1])}"' if stroke[1] != 1 else '') + '/>'
    return s


def text_lines(lab, x, y, w, h, where, rl='page', align=None):
    # the label's text in its box (x, y, w, h absolute)
    fam = lab.get('fontFamily'); size = float(lab.get('fontSize'))
    if fam not in FONTS:
        refuse(where, f'unknown font {fam}'); return ''
    if lab.get('fontStyle') not in FONT_STYLES:
        refuse(where, f'font style {lab.get("fontStyle")}'); return ''
    if lab.get('underlinedText') == 'true' or float(lab.get('rotationAngle') or 0):
        refuse(where, 'underlined or rotated label'); return ''
    align = align or lab.get('alignment') or 'center'
    if align not in ('center', 'left', 'right'):
        refuse(where, f'label alignment {align}'); return ''
    lines = ''.join(lab.itertext()).split('\n') if lab.text else []
    while lines and not lines[-1].strip() and len(lines) > 1:
        lines.pop()
    if not lines or not ''.join(lines):
        return ''
    asc, lh, family = FONTS[fam]
    asc, lh = asc * size, lh * size
    top, bottom, left, right = (float(lab.get(a + 'Inset') or 2) for a in ('top', 'bottom', 'left', 'right'))
    y0 = y + top + (h - top - bottom - len(lines) * lh) / 2  # text block centred in the box
    tx, anchor = {'center': (x + w / 2, 'middle'), 'left': (x + left, 'start'), 'right': (x + w - right, 'end')}[align]
    rgb, a = color(lab.get('textColor') or '#000000')
    paint_text = f' class="t-{rl}"' if ROLES else f' fill="{rgb}"' + (f' fill-opacity="{num(a)}"' if a < 1 else '') + \
        (f' class="t-{rl}"' if CLASSES else '')
    out = []
    for i, line in enumerate(lines):
        out.append(f'<text x="{num(tx)}" y="{num(y0 + asc + i * lh)}" text-anchor="{anchor}"'
                   f' font-family="{family}" font-size="{num(size)}"{FONT_STYLES[lab.get("fontStyle")]}'
                   f'{paint_text} stroke="none" xml:space="preserve">{html.escape(line)}</text>')
    return ''.join(out)


def label_place(lab, x, y, w, h):
    # the label's box (absolute). A smart label model places it as yEd does on loading (label
    # point on node point, plus offset), so a GraphML edited by a script draws as in yEd; a
    # label without size is centred on that point, its height from the font. An internal label
    # (t, tr, bl, c ...) sits at its model position inside the node, as yEd puts it on loading, so
    # a node resized by a script keeps its name inside. Other labels: the box yEd saved.
    p = lab.find(Y + 'ModelParameter/' + Y + 'SmartNodeLabelModelParameter')
    if p is None:
        if lab.get('x') is None:
            return None
        lw, lh = float(lab.get('width')), float(lab.get('height'))
        if lab.get('modelName') != 'internal':
            return x + float(lab.get('x')), y + float(lab.get('y')), lw, lh
        pos, bd = lab.get('modelPosition') or 'c', float(lab.get('borderDistance') or 0)
        hz, vt = pos[-1] if pos[-1] in 'lr' else 'c', pos[0] if pos[0] in 'tb' else 'c'
        return (x + {'l': bd, 'r': w - lw - bd, 'c': (w - lw) / 2}[hz],
                y + {'t': bd, 'b': h - lh - bd, 'c': (h - lh) / 2}[vt], lw, lh)
    if lab.get('fontFamily') not in FONTS:
        return None
    f = lambda a: float(p.get(a))
    n = len(''.join(lab.itertext()).rstrip('\n').split('\n'))
    top, bottom = (float(lab.get(a + 'Inset') or 2) for a in ('top', 'bottom'))
    lw = float(lab.get('width') or 0)
    lh = float(lab.get('height') or n * FONTS[lab.get('fontFamily')][1] * float(lab.get('fontSize')) + top + bottom)
    if not lw and f('labelRatioX'):
        return None
    cx = x + w / 2 + f('nodeRatioX') * w - f('labelRatioX') * lw + f('offsetX')
    cy = y + h / 2 + f('nodeRatioY') * h - f('labelRatioY') * lh + f('offsetY')
    return cx - lw / 2, cy - lh / 2, lw, lh


def label_box(lab, x, y, w, h):
    s = ''
    if lab.get('hasBackgroundColor') != 'false' and lab.get('backgroundColor'):
        s += f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}"{area(lab.get("backgroundColor"), "white", False)} stroke="none"/>'
    if lab.get('hasLineColor') != 'false' and lab.get('lineColor'):
        s += f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}" fill="none"{ink("stroke", lab.get("lineColor"))}/>'
    return s


def visual_end(outer, port, n):
    # the visual end: where the line from outer to port first meets the node's shape outline, its
    # shape with its state variables and units of information (user, 2026-11-14: the line stops at a
    # state variable on its way, never crossing it to the shape behind)
    q = clip(outer, port, n['polys'])
    return clip(outer, q, n['aux'], True) if n['aux'] else q


def icon_svg(res, lab, x, y, w, h, where, aux=None):
    # a state variable or unit of information kept as a label icon, centred in the label box; its
    # outline added to aux, part of the node's shape outline
    gn = next((n for n in res.iter(Y + 'GenericNode', Y + 'ShapeNode')), None) if res is not None else None
    if gn is None:
        refuse(where, 'label icon is not a node'); return ''
    k = kind_of(gn, where)
    if k not in ('StateVariable', 'UnitOfInformation') and k not in SHAPES:
        refuse(where, f'label icon {k}'); return ''
    g = gn.find(Y + 'Geometry'); iw, ih = float(g.get('width')), float(g.get('height'))
    ix, iy = x + (w - iw) / 2, y + (h - ih) / 2
    fill, stroke = check_fill_border(gn, where)
    c = outline(k, ix, iy, iw, ih, {})
    if aux is not None and k in ('StateVariable', 'UnitOfInformation'):
        aux.append(polygon(c))
    s = shape_svg(c, fill, stroke)
    for il in gn.findall(Y + 'NodeLabel'):
        if il.get('visible') == 'false' or il.get('hasText') == 'false':
            continue
        # the text centred in the icon, as yEd sizes the label to it: a stored box left wider
        # than the text (P@T456 cut to P) cannot push it out
        s += text_lines(il, ix, iy, iw, ih, where, 'white', 'center')
    return s


class Map:
    def __init__(self, path):
        t = etree.parse(path)
        self.root = t.getroot()
        self.res = {r.get('id'): r for r in self.root.iter(Y + 'Resource')}
        keys = {k.get('id'): (k.get('for'), k.get('attr.name')) for k in self.root.findall(G + 'key')}
        self.url = {k for k, v in keys.items() if v[1] == 'url'}
        self.cls = {k for k, v in keys.items() if v[1] == 'SBGN class'}
        self.nodes = {}   # id -> dict(geo, polys, svg)
        self.order = []   # paint order: ('n', id), ('e', element), ('block',)
        self.boxes = []   # nodes, node labels and edge bends: the image spans them
        self.read_graph(self.root.find(G + 'graph'), top=True)
        self.ports = {}   # hub id -> (port one, port two, has arcs coming in)
        self.hub_ports()

    def link(self, el):
        for dd in el.findall(G + 'data'):
            if dd.get('key') in self.url and (dd.text or '').strip():
                return dd.text.strip()
        return None

    def sbgn_class(self, el):
        return next(((dd.text or '').strip() for dd in el.findall(G + 'data') if dd.get('key') in self.cls), '')

    def read_graph(self, graph, top=False, parent='page'):
        # nodes depth first, groups before their members; parent: the role of the group they are in
        for el in graph:
            if el.tag == G + 'node':
                self.read_node(el, parent)
                if top:
                    self.order.append(('block',))
            elif el.tag == G + 'edge':
                self.order.append(('e', (el, parent)))
                # bends outside every node (links routed in lanes below a cell) were cut off (2026-10-27)
                self.boxes += [(float(q.get('x')), float(q.get('y')), 0, 0) for q in el.iter(Y + 'Point')]

    def read_node(self, node, parent):
        nid = node.get('id'); where = 'node ' + nid
        r = realizer(node)
        if r is None:
            return
        k = kind_of(r, where)
        g = r.find(Y + 'Geometry')
        x, y, w, h = (float(g.get(a)) for a in ('x', 'y', 'width', 'height'))
        props = style_props(r)
        for p in props:
            if p not in STYLE_PROPS:
                refuse(where, f'style option {p}')
        if props.get('mcount', '1') not in ('1', '2'):
            refuse(where, f'multimer count {props["mcount"]}')
        fill, stroke = check_fill_border(r, where)
        rl = role(r.tag[len(Y):], k, fill)
        if ROLES and not fill:
            fill = '#FFFFFF'  # a node drawn without fill (SBGN-ML has none) takes its role's colour too
        outlines = [outline(k, x, y, w, h, props)]
        if props.get('mcount') == '2':
            outlines.insert(0, outline(k, x + 6, y + 6, w, h, props))
            self.boxes.append((x + 6, y + 6, w, h))
        s = ''.join(shape_svg(c, fill, stroke, rl) for c in outlines)
        if k == 'EmptySet' and stroke:
            s += f'<path d="M{num(x)} {num(y + h)} L{num(x + w)} {num(y)}" fill="none"{ink("stroke", stroke[0])}/>'
        sc = self.sbgn_class(node) if k == 'Process' else ''
        if sc in ('association', 'dissociation'):
            c = shape_svg(ellipse(x, y, w, h), fill if sc == 'dissociation' else None, stroke, rl)
            if sc == 'association':
                c = f'<path d="{d(ellipse(x, y, w, h))}"{ink("fill", stroke[0] if stroke else "#000000")} stroke="none"/>' + c
            else:
                c += shape_svg(ellipse(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6), None, stroke, rl)
            # the generic square white as every process (user, 2026-11-14: Newt fills an association dark grey)
            s = f'<g class="sbgn-{sc}">{c}</g><g class="sbgn-generic" display="none">' + ''.join(shape_svg(o, '#FFFFFF', stroke, rl) for o in outlines) + '</g>'
        aux = []   # the outlines of its state variables and units of information (visual_end)
        for lab in r.findall(Y + 'NodeLabel'):
            if lab.get('visible') == 'false':
                continue
            box = label_place(lab, x, y, w, h)
            if box is None:
                if lab.get('iconData') or ''.join(lab.itertext()).strip():
                    refuse(where, 'label without a position')
                continue
            ax, ay, lw, lh = box
            self.boxes.append((ax, ay, lw, lh))
            s += label_box(lab, ax, ay, lw, lh)
            if lab.get('iconData'):
                s += icon_svg(self.res.get(lab.get('iconData')), lab, ax, ay, lw, lh, where, aux)
            if lab.get('hasText') != 'false':
                # the text's role: of the fill under its start, the label's box, the node or the group
                on = 'white' if lab.get('hasBackgroundColor') != 'false' and lab.get('backgroundColor') else \
                     rl if fill and x <= ax + 2 <= x + w and y <= ay + lh / 2 <= y + h else parent
                s += text_lines(lab, ax, ay, lw, lh, where, on)
        url = self.link(node)
        if url:
            s = f'<a xlink:href="{html.escape(url)}" target="_blank">{s}</a>'
        eq = k == 'Operator' and any(''.join(lb.itertext()).strip() == EQUIV for lb in r.findall(Y + 'NodeLabel'))
        self.nodes[nid] = dict(geo=(x, y, w, h), polys=[polygon(c) for c in outlines], aux=aux, svg=s, kind=k, stroke=stroke, eq=eq)
        self.boxes.append((x, y, w, h))
        self.order.append(('n', nid))
        sub = node.find(G + 'graph')
        if sub is not None:
            st = r.find(Y + 'State')
            if st is not None and st.get('closed') == 'true':
                refuse(where, 'closed group')
            else:
                self.read_graph(sub, parent=rl if fill else parent)

    @staticmethod
    def polyline(e):
        pl = None
        for dd in e.findall(G + 'data'):
            for c in dd:
                if c.tag in (Y + 'PolyLineEdge', Y + 'QuadCurveEdge'):
                    pl = c
        return pl

    def mid(self, nid):
        x, y, w, h = self.nodes[nid]['geo']; return (x + w / 2, y + h / 2)

    def ends(self, e, ar):
        # how an arc meets a hub at its source and at its target: 'in' (port one), 'out' (port two) or None (a
        # modifier, or no hub). An arc without arrows between a hub and an entity is a consumption whichever way it
        # was drawn (yEd's maps draw some from the process); between two gates, the source's output, the target's input
        s, t = e.get('source'), e.get('target')
        hs, ht = self.nodes[s]['kind'] in HUBS, self.nodes[t]['kind'] in HUBS
        bare = ar.get('target') == 'none'
        # (an equivalence gate's output is a plain line too: always its output)
        at_s = ('in' if not ht and bare and ar.get('source') == 'none' and not self.nodes[s]['eq'] else 'out') if hs else None
        return at_s, 'in' if ht and bare else None

    def hub_ports(self):
        # the two ports of every process and gate (the header's ports), their sticks put beside the glyph
        ins, outs, given, near = {}, {}, {}, {}  # near: (hub, 'in' or 'out') -> the nodes whose arcs use that port
        for item in self.order:
            if item[0] != 'e':
                continue
            e = item[1][0]; pl = self.polyline(e); s, t = e.get('source'), e.get('target')
            if pl is None or s not in self.nodes or t not in self.nodes:
                continue
            path = pl.find(Y + 'Path')
            bends = [(float(q.get('x')), float(q.get('y'))) for q in path.findall(Y + 'Point')]
            at_s, at_t = self.ends(e, pl.find(Y + 'Arrows'))
            if at_t == 'in':
                ins.setdefault(t, []).append(bends[-1] if bends else self.mid(s))
                self.given(given, t, 'in', path, 'tx', 'ty')
                near.setdefault((t, 'in'), []).append(s)
            if at_s:
                (ins if at_s == 'in' else outs).setdefault(s, []).append(bends[0] if bends else self.mid(t))
                self.given(given, s, at_s, path, 'sx', 'sy')
                near.setdefault((s, at_s), []).append(t)
        def mean(q):  # added in order (not sum(), which compensates since Python 3.12): as yrender.js adds
            sx = sy = 0.0
            for p in q:
                sx += p[0]; sy += p[1]
            return (sx / len(q), sy / len(q))
        for nid, n in self.nodes.items():
            if n['kind'] not in HUBS:
                continue
            x, y, w, h = n['geo']; cx, cy = x + w / 2, y + h / 2
            I, O = ins.get(nid, []), outs.get(nid, [])
            if n['kind'] == 'Operator' and O:  # a gate faces what it controls (user, 2026-11-14), its inputs behind it
                a, b = (cx, cy), mean(O)
                vx, vy = b[0] - a[0], b[1] - a[1]
            elif I:  # from what comes in to what goes out
                a = mean(I); b = mean(O) if O else (cx, cy)
                vx, vy = b[0] - a[0], b[1] - a[1]
            elif len(O) > 1:  # nothing comes in (reversible): along the spread of the leaving arcs
                vx = max(p[0] for p in O) - min(p[0] for p in O); vy = max(p[1] for p in O) - min(p[1] for p in O)
            elif O:
                vx, vy = O[0][0] - cx, O[0][1] - cy
            else:
                vx, vy = 1.0, 0.0
            gin, gout = given.get((nid, 'in')), given.get((nid, 'out'))
            if gin and gout and math.dist(gin, gout) < 2:  # both in one place (a file's slip): computed instead
                gin = gout = None
            if gin or gout:  # the file's own ports (SBGN-ML's, through the converter), a missing one mirrored
                one = gin or (2 * cx - gout[0], 2 * cy - gout[1])
                two = gout or (2 * cx - gin[0], 2 * cy - gin[1])
            else:
                hz = abs(vx) >= abs(vy)
                k = 1 if (vx if hz else vy) >= 0 else -1
                side = w if hz else h
                r = side / 2 + max(ANTENNA * side, ANTENNA_MIN)
                one, two = ((cx - k * r, cy), (cx + k * r, cy)) if hz else ((cx, cy - k * r), (cx, cy + k * r))
            self.ports[nid] = (one, two, nid in ins)
            st = n['stroke']
            col, wa = (st[0], f' stroke-width="{num(st[1])}"' if st[1] != 1 else '') if st else ('#000000', '')
            e1, e2 = clip(one, (cx, cy), n['polys']), clip(two, (cx, cy), n['polys'])
            n_in, n_out = near.get((nid, 'in'), []), near.get((nid, 'out'), [])
            d1 = self.stick_end(nid, e1, one, n_in + ([] if I else n_out))  # reversible: a leaving arc may take either
            d2 = self.stick_end(nid, e2, two, n_out)
            # two sticks, not one line under the glyph: a glyph without fill (SBGN-ML's) would show it through
            ant = (f'<path d="M{num(d1[0])} {num(d1[1])} L{num(e1[0])} {num(e1[1])} M{num(e2[0])} {num(e2[1])}'
                   f' L{num(d2[0])} {num(d2[1])}" fill="none"{ink("stroke", col)}{wa}/>')
            # inside the node's own group when a caller puts each node in one (the editor's way), so it moves with it
            n['svg'] = re.sub(r'^(<g data-n="[^"]*">)', lambda m: m.group(1) + ant, n['svg']) if n['svg'].startswith('<g data-n="') else ant + n['svg']
            self.boxes += [(one[0], one[1], 0, 0), (two[0], two[1], 0, 0)]

    def stick_end(self, nid, base, tip, near):
        # a stick whose tip lies inside a node joined by an arc at that port goes behind that node: it stops on the
        # node's outline, the nearest such stop to the glyph (not when the glyph itself is inside the node: nested)
        c, end = self.mid(nid), tip
        for m in near:
            N = self.nodes[m]; P = N['polys']
            if m != nid and within(tip, P) and not within(c, P):
                q = visual_end(base, tip, N)
                if math.dist(base, q) < math.dist(base, end):
                    end = q
        return end

    def given(self, given, nid, side, path, ax, ay):
        # an arc's end the map puts outside the hub's glyph is that port, the first one found
        # (more than half a pixel outside its box: yEd's maps end some arcs on the outline)
        x, y, w, h = self.nodes[nid]['geo']
        ox, oy = float(path.get(ax)), float(path.get(ay))
        if (nid, side) not in given and (abs(ox) > w / 2 + 0.5 or abs(oy) > h / 2 + 0.5):
            given[(nid, side)] = (x + w / 2 + ox, y + h / 2 + oy)

    def on_stick(self, nid, p):
        # a bend within 1.5 px of the line from the hub's centre to one of its ports: the stick draws it now
        c = self.mid(nid)
        for q in self.ports[nid][:2]:
            dx, dy = q[0] - c[0], q[1] - c[1]
            if dx == 0 and dy == 0:
                continue
            t = ((p[0] - c[0]) * dx + (p[1] - c[1]) * dy) / (dx * dx + dy * dy)
            t = min(1.0, max(0.0, t))
            if math.dist(p, (c[0] + t * dx, c[1] + t * dy)) <= 1.5:
                return True
        return False

    def edge_svg(self, e, parent):
        where = 'edge ' + e.get('id')
        pl = None
        for dd in e.findall(G + 'data'):
            for c in dd:
                if isinstance(c.tag, str) and c.tag.startswith(Y):
                    if c.tag in (Y + 'PolyLineEdge', Y + 'QuadCurveEdge'):
                        pl = c
                    else:
                        refuse(where, f'unknown edge type {c.tag[len(Y):]}')
        if pl is None:
            return ''
        S, T = self.nodes[e.get('source')], self.nodes[e.get('target')]
        p = pl.find(Y + 'Path')
        def centre(n, dx, dy):
            x, y, w, h = n['geo']; return (x + w / 2 + float(p.get(dx)), y + h / 2 + float(p.get(dy)))
        pts = [centre(S, 'sx', 'sy')] + [(float(q.get('x')), float(q.get('y'))) for q in p.findall(Y + 'Point')] + [centre(T, 'tx', 'ty')]
        s_id, t_id = e.get('source'), e.get('target')
        ar = pl.find(Y + 'Arrows')
        at_s, at_t = self.ends(e, ar)
        label_at = clip(pts[1], pts[0], S['polys'])  # the arc's labels keep the point yEd placed them from
        if at_t == 'in':  # a consumption or a gate's input: ends on port one
            while len(pts) > 2 and self.on_stick(t_id, pts[-2]):
                del pts[-2]
            pts[-1] = self.ports[t_id][0]
        if at_s:  # a consumption drawn from the process: port one; leaving: port two (nothing coming in: the nearer)
            while len(pts) > 2 and self.on_stick(s_id, pts[1]):
                del pts[1]
            one, two, has_in = self.ports[s_id]
            pts[0] = one if at_s == 'in' else two if has_in or math.dist(two, pts[1]) <= math.dist(one, pts[1]) else one
        # behind its own nodes (behind): the line starts where it first leaves its source and stops where it last
        # enters its target. An arc from a port lying inside the node at its other end runs along the stick
        # instead, from the glyph to that node's outline, so a product keeps its arrowhead (the stick stops there too,
        # stick_end); nested nodes as before
        if not at_s:
            b = behind(pts, S)
            if b is not None:
                pts = b
            elif at_t == 'in' and not within(self.mid(t_id), S['polys']):
                g = visual_end(pts[-1], self.mid(t_id), T)
                pts = [visual_end(g, pts[-1], S), g]
            else:
                pts[0] = visual_end(pts[1], pts[0], S)
        if at_t != 'in':
            b = behind(pts[::-1], T)
            if b is not None:
                pts = b[::-1]
            elif at_s and not within(self.mid(s_id), T['polys']):
                g = visual_end(pts[0], self.mid(s_id), S)
                pts = [g, visual_end(g, pts[0], T)]
            else:
                pts[-1] = visual_end(pts[-2], pts[-1], T)
        ls = pl.find(Y + 'LineStyle')
        if ls.get('type') not in ('line', 'dashed'):
            refuse(where, f'line type {ls.get("type")}')
        col, width = ls.get('color'), float(ls.get('width'))
        dash = f' stroke-dasharray="{num(6 * width)} {num(2 * width)}"' if ls.get('type') == 'dashed' else ''
        heads, line, orig = '', list(pts), list(pts)
        for end, kind in (('target', ar.get('target')), ('source', ar.get('source'))):
            if kind not in ARROWS:
                refuse(where, f'unknown arrow {kind}'); continue
            if kind == 'none':
                continue
            i, j = (-1, -2) if end == 'target' else (0, 1)
            if kind in AIR and not (at_t == 'in' if end == 'target' else at_s):  # cut at the outline, or a port on it: moved off
                N, raw = (T, centre(T, 'tx', 'ty')) if end == 'target' else (S, centre(S, 'sx', 'sy'))
                both = len(pts) == 2 and ar.get('source' if end == 'target' else 'target') != 'none'  # the other head keeps its half
                if math.dist(pts[i], raw) > 0 or clearance(None, raw, None, N['polys'] + N['aux'], 0) < 1:
                    pts[i] = air(kind, pts[i], orig[j], N, width, both)
            svg, cut = arrow(kind, pts[i], pts[j], col, width)
            heads += svg
            (tx, ty), (px, py) = pts[i], pts[j]
            L = math.dist(pts[i], pts[j])
            if L > 0:  # never past the segment's other end (a head longer than its segment: the line not run backwards)
                line[i] = (tx + (px - tx) * min(cut, L) / L, ty + (py - ty) * min(cut, L) / L)
        smooth = pl.tag == Y + 'QuadCurveEdge' or pl.find(Y + 'BendStyle') is not None and pl.find(Y + 'BendStyle').get('smoothed') == 'true'
        dd = f'M{num(line[0][0])} {num(line[0][1])}'
        for i in range(1, len(pts) - 1):
            b = pts[i]
            if smooth:
                a, c = pts[i - 1], pts[i + 1]
                la, lc = math.dist(a, b), math.dist(b, c)
                if la > 0 and lc > 0:
                    da, dc = min(10, la / 2), min(10, lc / 2)
                    p1 = (b[0] + (a[0] - b[0]) * da / la, b[1] + (a[1] - b[1]) * da / la)
                    p2 = (b[0] + (c[0] - b[0]) * dc / lc, b[1] + (c[1] - b[1]) * dc / lc)
                    dd += f' L{num(p1[0])} {num(p1[1])} Q{num(b[0])} {num(b[1])} {num(p2[0])} {num(p2[1])}'
                    continue
            dd += f' L{num(b[0])} {num(b[1])}'
        dd += f' L{num(line[-1][0])} {num(line[-1][1])}'
        wa = f' stroke-width="{num(width)}"' if width != 1 else ''
        s = f'<path d="{dd}" fill="none"{ink("stroke", col)}{wa}{dash}/>' + heads
        for lab in pl.findall(Y + 'EdgeLabel'):
            if lab.get('visible') == 'false' or not (lab.text or '').strip():
                continue
            s += self.edge_label(lab, label_at, where, parent)
        url = self.link(e)
        return f'<a xlink:href="{html.escape(url)}" target="_blank">{s}</a>' if url else s

    def edge_label(self, lab, start, where, parent):
        w, h = float(lab.get('width')), float(lab.get('height'))
        on = 'white' if lab.get('hasBackgroundColor') != 'false' and lab.get('backgroundColor') else parent
        inner = label_box(lab, 0, 0, w, h) + text_lines(lab, 0, 0, w, h, where, on)
        if lab.get('anchorX') is not None:
            ux, uy = float(lab.get('upX')), float(lab.get('upY'))
            ax, ay = start[0] + float(lab.get('anchorX')), start[1] + float(lab.get('anchorY'))
            if lab.get('configuration') == 'AutoFlippingLabel' and uy > 0:
                # upside down: turned half round its centre
                ax, ay = ax - w * uy + h * ux, ay + w * ux + h * uy
                ux, uy = -ux, -uy
            tlx, tly = ax + h * ux, ay + h * uy  # top left corner: up from the anchor (lower left)
            m = f'matrix({num(-uy)},{num(ux)},{num(-ux)},{num(-uy)},{num(tlx)},{num(tly)})'
        else:
            m = f'translate({num(start[0] + float(lab.get("x")))},{num(start[1] + float(lab.get("y")))})'
        return f'<g transform="{m}">{inner}</g>'

    def svg(self):
        xs = self.boxes
        x0 = math.floor(min(g[0] for g in xs)) - MARGIN
        y0 = math.floor(min(g[1] for g in xs)) - MARGIN
        x1 = math.ceil(max(g[0] + g[2] for g in xs)) + MARGIN
        y1 = math.ceil(max(g[1] + g[3] for g in xs)) + MARGIN
        W, H = x1 - x0, y1 - y0
        body, pending, painted = [], [], set()
        for item in self.order:
            if item[0] == 'n':
                body.append(self.nodes[item[1]]['svg']); painted.add(item[1])
            elif item[0] == 'e':
                pending.append(item[1])
            elif item[0] == 'block':
                for e in list(pending):
                    if e[0].get('source') in painted and e[0].get('target') in painted:
                        body.append(self.edge_svg(*e)); pending.remove(e)
        for e in pending:
            body.append(self.edge_svg(*e))
        return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"'
                f' xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}"'
                f' stroke-linecap="butt" stroke-miterlimit="10">\n'
                f'<g transform="translate({-x0},{-y0})">\n' + '\n'.join(b for b in body if b) + '\n</g>\n</svg>\n')


def seg_dist(p, a, b):  # from a point to a segment
    dx, dy = b[0] - a[0], b[1] - a[1]
    q = dx * dx + dy * dy
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q if q > 0 else 0
    t = max(0, min(1, t))
    return math.dist(p, (a[0] + t * dx, a[1] + t * dy))


def crosses(a, b, c, d):  # two segments meet
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return o(a, b, c) * o(a, b, d) <= 0 and o(c, d, a) * o(c, d, b) <= 0


def clearance(kind, tip, prev, polys, ink):
    """The least distance from a head at tip (kind None: the point tip itself) to the outline's line; a bar across it 0."""
    best = math.inf
    if kind:
        L = math.dist(tip, prev)
        ux, uy = (tip[0] - prev[0]) / L, (tip[1] - prev[1]) / L
        c, b1, b2 = (tip[0] - ux * 4, tip[1] - uy * 4), (tip[0] - uy * 5, tip[1] + ux * 5), (tip[0] + uy * 5, tip[1] - ux * 5)
    for poly in polys:
        for i in range(len(poly)):
            A, B = poly[(i - 1 + len(poly)) % len(poly)], poly[i]
            if not kind:
                d = seg_dist(tip, A, B)
            elif kind == 'white_circle':
                d = seg_dist(c, A, B) - 4
            else:
                d = 0 if crosses(b1, b2, A, B) else min(seg_dist(b1, A, B), seg_dist(b2, A, B), seg_dist(A, b1, b2), seg_dist(B, b1, b2))
            best = min(best, d - ink)
    return best


def air(kind, tip, prev, n, width, both):
    """The head moved back along its line until AIR[kind] px of white part its ink from the outline's (the node's line width,
    the circle's 1 px, the bar's the arc's), at most AIR_MAX and never into the line's other point (or the other head's
    half)."""
    L = math.dist(tip, prev)
    room = L / 2 - 8 if both else L - 8
    if not L > 0 or room <= 0:
        return tip
    ink = (n['stroke'][1] if n['stroke'] else 1) / 2 + (0.5 if kind == 'white_circle' else width / 2)
    def at(d):
        return (tip[0] + (prev[0] - tip[0]) * d / L, tip[1] + (prev[1] - tip[1]) * d / L)
    d = 1
    while d < room and d <= AIR_MAX:
        if clearance(kind, at(d), prev, n['polys'] + n['aux'], ink) >= AIR[kind]:
            return at(d)
        d += 0.5
    return at(min(room, AIR_MAX))


def arrow(kind, tip, prev, col, width):
    # the arrow head at tip, pointing away from prev; returns (svg, how far the line stops short)
    L = math.dist(tip, prev) or 1
    ux, uy = (tip[0] - prev[0]) / L, (tip[1] - prev[1]) / L
    nx, ny = -uy, ux
    def at(back, side):
        return (tip[0] - ux * back + nx * side, tip[1] - uy * back + ny * side)
    def poly(pts, fill):
        dd = 'M' + ' L'.join(f'{num(x)} {num(y)}' for x, y in pts) + ' Z'
        if fill == 'line':
            return f'<path d="{dd}"{ink("fill", col)} stroke="none"/>'
        return f'<path d="{dd}"{white()}{ink("stroke", col)}/>'
    def bar(back, half):
        (ax, ay), (bx, by) = at(back, -half), at(back, half)
        return f'<path d="M{num(ax)} {num(ay)} L{num(bx)} {num(by)}" fill="none"{ink("stroke", col)}' + \
               (f' stroke-width="{num(width)}"' if width != 1 else '') + ' stroke-linecap="square"/>'
    if kind == 'delta':
        return poly([tip, at(12, 6), at(12, -6)], 'line'), 11
    if kind == 'white_delta':
        return poly([tip, at(16, 6), at(16, -6)], 'white'), 15
    if kind == 'white_circle':
        cx, cy = at(4, 0)
        return f'<circle cx="{num(cx)}" cy="{num(cy)}" r="4"{white()}{ink("stroke", col)}/>', 8
    if kind == 'white_diamond':
        return poly([tip, at(8, 6), at(16, 0), at(8, -6)], 'white'), 15
    if kind == 'white_delta_bar':
        return poly([tip, at(16, 6), at(16, -6)], 'white') + bar(21, 8), 21
    return bar(0, 5), 0  # t_shape


def render(src, out_svg, out_png=None, roles=False):
    global ROLES
    errors.clear()
    ROLES = roles
    m = Map(src)
    svg = m.svg()
    if errors:
        raise SystemExit(f'{src}: cannot draw, nothing written\n  ' + '\n  '.join(errors))
    open(out_svg, 'w', encoding='utf-8').write(svg)
    if out_png:
        import cairosvg
        W, H = (int(re.search(f' {a}="(\\d+)"', svg).group(1)) - 14 for a in ('width', 'height'))
        cairosvg.svg2png(bytestring=svg.replace(f'viewBox="0 0 {W + 14} {H + 14}"', f'viewBox="7 7 {W} {H}"').encode(),
                         output_width=2 * W, output_height=2 * H, background_color='white', write_to=out_png)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--roles']
    render(*args[:3], roles='--roles' in sys.argv)
