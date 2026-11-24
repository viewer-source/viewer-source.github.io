# yrender: its rules and their reasons

The comments of `yrender.py`, the Python twin of `yrender.js`, kept here when the twin was retired: the JavaScript is the one master, and where its comments name a rule by a function (`yrender.py's clip`
in older comments, `clip` here), its reason is under that name below. A rule changed in the code is changed here in the
same commit. Code quoted beside a reason is the Python of that day; the JavaScript does the same under the same name
(snake_case there, camelCase in the JavaScript).

## Header

```text
Draw a yEd GraphML map (SBGN palette) as yEd exports it: SVG at 1:1 with a 15 px margin,
PNG at 2:1 with an 8 px margin.
The vocabulary is closed: a node type, style, shape, arrow or option not listed below stops
the script with a list of what it cannot draw, and nothing is written.
Rules read from yEd's own exports of the website maps:
 - shapes: Macromolecule corner radius 12 (style 'radius'), Complex corner cut 15 ('radiusX',
   'radiusY'), NucleicAcidFeature bottom radius 12, Phenotype indent h/4, round rectangle 4,
   multimer (mcount 2): a second outline 6 px down and right, behind the node
 - labels: the GraphML keeps each label's box; the text block (ascent and line height as yEd
   measured them, Dialog being Lucida Grande on a Mac) is centred in it inside the insets
 - state variables and units of information are label icons (a node kept in Resources),
   centred in the label box
 - edges: from port to port through the bends, cut at the node's shape outline (its shape with its state
   variables and units of information: visual_end); soft bends are
   quadratic curves cutting 10 px (at most half a segment) on each side of the bend
 - arrows: tip on the outline; the line stops where the arrow head covers it. A catalysis circle or an
   inhibition bar cut at the outline, or with its port on it, is moved back along its line until 2 px
   of white part it from the outline, also when it comes in at a slant (a head touching the outline
   reads badly, and a bar on it almost disappears; 1 px is not enough for the circle);
   a port 1 px or more outside the shape, as hand-made gaps, as given. The file is never changed, only the drawing
 - an arc goes behind its own nodes (a bend or an antenna's tip inside a node would draw the line across
   it, to its middle): it starts where it first leaves its source and stops where it last enters its target;
   a stick whose tip lies inside a node joined by an arc at that port stops on that node's outline, and that arc runs along
   the stick between the two outlines (a product keeps its arrowhead); nodes inside one another as before
 - PerturbingAgent: the Phenotype's hexagon turned inside out, its points indented h/4 (the SBGN
   learner's card); white_diamond (modulation) 16 long and 12 wide like white_delta; a QuadCurveEdge drawn as a
   polyline with soft bends (yEd's spline is close to that at the card's straightness 0.1)
 - association and dissociation: a Process whose node property SBGN class says so (yEd has
   neither) drawn as SBGN's filled circle or circle in a circle (the inner one 0.6 of the outer), the generic square
   kept beside it in a g of class sbgn-generic (display none), the circles in a g of class sbgn-association or
   sbgn-dissociation, so a page can show either; the arcs end at the square's outline as before
 - ports (SBGN ports, not bend points): a Process (any SBGN class) or an Operator (logic
   gate) gets a stick on each side that has an arc at it (the second grows only with a link), ANTENNA (0.5; 0.75 is too long) of its side long, never shorter
   than ANTENNA_MIN (0.5 of the atlas maps' standard 18 px process: small squares need room), drawn beside the glyph. Port one:
   where a consumption or a gate's input ends (an arc without arrows between a hub and an entity, whichever way it
   was drawn). Port two: where every other arc leaving the hub starts (a product, a gate's output; with nothing
   coming in, each takes the nearer port: reversible). The axis runs from the mean of the arcs' near points coming
   in to that of those going out (with nothing coming in, along the leaving arcs' spread), horizontal unless
   steeper (a gate: from its centre to what it controls: its output turned back otherwise), as the
   converter puts SBGN-ML's ports; ports the map gives (an arc's end outside the glyph, as the
   converter keeps SBGN-ML's own: each tool's antenna length) are drawn where they are. Bends lying on a stick (the bend points that drew antennas
   in older files) are left out; modifiers end on the glyph's outline as before; arc labels keep yEd's anchor point
 - UnspecifiedEntity drawn as an ellipse, dashed lines as dashes 6 and gaps 2 times the line width
   (checked against a yEd export: same shapes)
 - edge labels: placed from the edge's first point (anchor and up vector when rotated,
   turned half round when upside down)
 - the image spans the nodes and their labels; edges are painted after every node, so an edge crossing a node
   is drawn over it (SBGN PD 4.2.2; yEd's export paints each after the top-level block holding its later end)
--roles (the website's /colours/ page): every fill gets the class c-<role> of the node it draws
(ROLE below; label boxes, units of information, state variables and white arrow heads c-white),
every text t-<role> of the fill it sits on (t-page outside any node), in place of their colours;
lines, borders and filled arrow heads get no colour, so they take the root's (the page's Lines).
Node fills are opaque then (a node without fill gets one), label backgrounds keep their transparency.
```

## role

the /colours/ role of a node: its realizer's tag, yEd style (or shape) and fill

- `return 'white'`: a label on its own box
- `return 'complex'`: one without members

## color

'#RRGGBB' or '#RRGGBBAA' -> (rgb, opacity)

## ink

a line's colour; with roles none, so the root's

## area

a fill's colour; with roles its class (and its transparency unless opaque)

## white

a white arrow head's fill

- `K = 0.5523`: cubic approximation of a quarter circle

## round_rect

quad: yEd's quadratic corners; otherwise circular corners (cubic curves)

## oval

an ellipse of any proportions, four cubic curves

## hexagon

- `if inward:`: perturbing agent: the points go into the box

## inside

even-odd test

## clip

where the segment from outer to port first meets the node's outlines (a multimer has two); the port itself when it lies outside them. crossed: any outline the segment crosses counts, the port inside it or not (a state variable on the way)

## behind

an arc goes behind the node it starts at (a bend or an antenna's tip inside the node would draw the line across it, to its middle): the leading points inside the node's outline are dropped and the line starts where it first leaves it. None when every point lies inside (nested nodes, or a port inside the node: edge_svg)

- `if k == 0:`: the end itself outside the shape: as visual_end gives it (a state variable on the way still stops it)

## tag_way

- `def tag_way(props):`: yrender.js's tagWay: yEd's plain (right) and inverse (left), and orientation up, down, left, right

## tag_shape

- `def tag_shape(x, y, w, h, way):`: a box with a point 3/8 as deep as the box across it (Newt's), the angle kept on resize

## outline

- `return rect(x, y, w, h)`: Process, Submap, UnitOfInformation, rectangle

## paint_layer

- `def paint_layer(node):`: 0 a compartment (a group not a complex), 1 a complex, 2 any other node (read_graph)

## text_lines

the label's text in its box (x, y, w, h absolute); text: drawn in place of the label's own

- `y0 = y + top + (h - top - bottom - len(lines) * lh) / 2`: text block centred in the box

## label_place

the label's box (absolute). A smart label model places it as yEd does on loading (label point on node point, plus offset), so a GraphML edited by a script draws as in yEd; a label without size is centred on that point, its height from the font. An internal label (t, tr, bl, c ...) sits at its model position inside the node, as yEd puts it on loading, so a node resized by a script keeps its name inside. Other labels: the box yEd saved.

## on_outline

p within eps of the outline poly (a port written on the outline, which the flattened outline may leave a hair outside or inside)

## visual_end

the visual end: where the line from outer to port first meets the node's shape outline, its shape with its state variables and units of information (the line stops at a state variable on its way, never crossing it to the shape behind); a port on the outline counts as inside, so a port on the far side of the shape is reached where the line first meets it, never across the node

## icon_svg

a state variable or unit of information kept as a label icon, centred in the label box; its outline added to aux, part of the node's shape outline

## drawn

the text centred in the icon, as yEd sizes the label to it: a stored box left wider than the text (P@T456 cut to P) cannot push it out

- `while len(lines) > 1 and not lines[-1].strip():`: as text_lines drops them

## __init__

- `self.nodes = {}`: id -> dict(geo, polys, svg)
- `self.order = []`: paint order: ('n', id), ('e', element)
- `self.boxes = []`: nodes, node labels and edge bends: the image spans them
- `self.ports = {}`: hub id -> (port one, port two, has arcs coming in)

## link

- `k = re.sub(r'[\t\n\r]', '', u)`: a browser reads java\tscript: as javascript:
- `return u`: a web address or a relative one, never a script

## read_graph

nodes depth first, groups before their members; parent: the role of the group they are in. Among the nodes of one graph, compartments (any group but a complex) first, complexes next, the rest last, each kind in the file's order, so a compartment lies under everything in its graph and a complex under the glyphs beside it (a complex always behind its proteins, a compartment always behind everything else); the edges keep their places among the nodes bends outside every node (links routed in lanes below a cell) count for the image, else they would be cut off

## read_node

a node drawn without fill (SBGN-ML has none) takes its role's colour too; a glyph of an SBGN-ML file with no fill is white, not transparent (an edge behind a transparent glyph shows through it), compartments stay transparent; a yEd GraphML node with no fill stays as yEd draws it the generic square white as every process (Newt fills an association dark grey)

- `aux = []`: the outlines of its state variables and units of information (visual_end)
the text's role: of the fill under its start, the label's box, the node or the group

## ends

how an arc meets a hub at its source and at its target: 'in' (port one), 'out' (port two) or None (a modifier, or no hub). An arc without arrows between a hub and an entity is a consumption whichever way it was drawn (yEd's maps draw some from the process); between two gates, the source's output, the target's input (an equivalence gate's output is a plain line too: always its output)

## hub_ports

the two ports of every process and gate (the header's ports), their sticks put beside the glyph

- `ins, outs, given, near, lead = {}, {}, {}, {}, {}`: near: (hub, 'in' or 'out') -> the nodes whose arcs use that port
- `wide = {}`: (hub, 'in' or 'out') -> the widest arc at that port, its stick drawn as wide
- `def mean(q):`: added in order (not sum(), which compensates since Python 3.12): as yrender.js adds

## widen

- `lead.setdefault(s, []).append((bends + [self.mid(t)], ew))`: its points, for the stick it leaves from

## mean

- `if n['kind'] == 'Operator' and O:`: a gate faces what it controls, its inputs behind it
- `elif I:`: from what comes in to what goes out
- `elif len(O) > 1:`: nothing comes in (reversible): along the spread of the leaving arcs
- `if gin and gout and math.dist(gin, gout) < 2:`: both in one place (a file's slip): computed instead
- `if gin or gout:`: the file's own ports (SBGN-ML's, through the converter), a missing one mirrored
- `if not I and not O:`: no arcs: a bare glyph, its antennas grown by its first arc
a stick as wide as its widest arc, never thinner than the glyph's border a stick only where an arc is attached (the second grows only when another link is attached to it): port one with an arc coming in, port two with one leaving; nothing coming in (reversible), each leaving arc on the nearer port, as edge_svg puts it

- `q = next(p for p in q if p is q[-1] or not self.on_stick(nid, p))`: bends on a stick left out first, as edge_svg
- `d1 = self.stick_end(nid, e1, one, n_in + ([] if I else n_out))`: reversible: a leaving arc may take either

## stick_end

a stick whose tip lies inside a node joined by an arc at that port goes behind that node: it stops on the node's outline, the nearest such stop to the glyph (not when the glyph itself is inside the node: nested)

## given

an arc's end the map puts outside the hub's glyph is that port, the first one found (more than half a pixel outside its box: yEd's maps end some arcs on the outline)

## on_stick

a bend within 1.5 px of the line from the hub's centre to one of its ports: the stick draws it now

## centre

- `label_at = clip(pts[1], pts[0], S['polys'])`: the arc's labels keep the point yEd placed them from
- `if at_t == 'in':`: a consumption or a gate's input: ends on port one
- `if at_s:`: a consumption drawn from the process: port one; leaving: port two (nothing coming in: the nearer)
- `if kind in AIR and not (at_t == 'in' if end == 'target' else at_s):`: cut at the outline, or a port on it: moved off
- `both = len(pts) == 2 and ar.get('source' if end == 'target' else 'target') != 'none'`: the other head keeps its half
- `if L > 0:`: never past the segment's other end (a head longer than its segment: the line not run backwards)

## edge_label

upside down: turned half round its centre

- `tlx, tly = ax + h * ux, ay + h * uy`: top left corner: up from the anchor (lower left)

## svg

- `xs = self.boxes or [(0, 0, 0, 0)]`: an empty map (a new one): an empty picture of its margins
- `for item in self.order:`: every node, then every edge over them (SBGN PD 4.2.2: an edge crossing a node is drawn on top)

## seg_dist

- `def seg_dist(p, a, b):`: from a point to a segment

## crosses

- `def crosses(a, b, c, d):`: two segments meet

## arrow

the arrow head at tip, pointing away from prev; returns (svg, how far the line stops short)

## bar

- `return poly([tip, at(16, 6), at(16, -6)], 'white') + bar(21, 8), 15`: the line runs through the bar to the head's base, as SBGN draws it
- `return bar(0, 5), 0`: t_shape

## At the module level

- `EQUIV = '\u2261'`: the equivalence operator's label in yEd's SBGN palette
- `AIR, AIR_MAX = {'white_circle': 2, 't_shape': 2}, 16`: px of white each head keeps off the outline (the header, arrows)
- `FONTS = {`: ascent and line height / font size as yEd measured them; fallbacks for systems without the font
- `ROLES = False`: set by render(roles=True)
- `CLASSES = False`: set by the caller (the viewer's build and editor): the classes of --roles beside the colours, so a
- colour scheme (the viewer's Settings, Map colours) can recolour the fills by role; off, the output is unchanged
- `FROM_SBGN = False`: set by the caller (render(sbgn=True), the viewer's build and editor): the GraphML made from an SBGN-ML file
- Outlines: lists of ('M'|'L', x, y), ('Q', cx, cy, x, y), ('C', c1x, c1y, c2x, c2y, x, y), ('Z',)
- ---- reading the GraphML ----
- a state variable with its site (value@site): drawn twice, the site hidden (sv-site, shown by the viewer's Show sites)
- and the value alone in a circle sized for it (the editor's svSize), centred where the whole one is
- two sticks, not one line under the glyph: a glyph without fill (SBGN-ML's) would show it through;
- one path when both are alike
- inside the node's own group when a caller puts each node in one (the editor's way), so it moves with it
- behind its own nodes (behind): the line starts where it first leaves its source and stops where it last
- enters its target. An arc from a port lying inside the node at its other end runs along the stick
- instead, from the glyph to that node's outline, so a product keeps its arrowhead (the stick stops there too,
- stick_end); nested nodes as before
