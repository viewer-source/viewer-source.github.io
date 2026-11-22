# complex_pack: its rules and their reasons

The comments of `complex_pack.py`, the layout skill's script the viewer kept a copy of until the viewer's
layout and the skill were unlinked: `layout.js` holds the same packing and snapping in JavaScript and is
its own master since, the skill keeping its own. Where `layout.js` names a rule by a function (snake_case here,
camelCase there), its reason is under that name below. A rule changed in `layout.js` is changed here in the same
commit. Code quoted beside a reason is the Python of that day.

## Header

```text
Complex packing and the group fit (SKILL.md section 5, Group bounds; section 3, Complex packing).
Packing: members 12 px from the left and right edges, 8 px from each other,
16 px from the top (yEd's Insets 12 + its 4 px group label; N:2 and units of information of a
first-row member sit in it) and 16 px from the bottom (mirroring the top, and room for the name
CellDesigner and MINERVA write there; a name shown inside at the bottom: its label 6 px under the
members, NAMED, in place of the 16, its text then about 9 px clear as members are 8; a name shown at the top: NAMED
above the members, the name above that, in place of the top's 16), counting state variables, units of information, names wider
than the node and a multimer's second outline; 10 px between a member and an inner complex one
above the other (the complex's thin outline reads as glued at 8). Exact on every complex: no grid inside complexes
(it made the bottom and right margins grow by up to 8 px). Members keep their arrangement: those
sharing a centre line (rows, columns) keep it, each row and column moves up and left as far as the
distances allow, and a member with nothing beside it along an axis (one protein over two, one next
to a tall inner complex) is centred on what the complex holds along that axis. Every complex keeps
its centre, so the arcs at it stay; ports on its border follow the border.
```

## shift

- `def shift(n, dx, dy):`: a node and everything inside it

## label_xy

a label's top left relative to its node (w x h) as yEd draws it: from its smart label model when it has one (yEd ignores the stored x and y then; SREBP "processed form" was stored centred and drawn 12 px off); an internal label at its model position inside the node, as yEd puts it on loading (a complex packed smaller keeps its name inside, its stored place left behind); else the stored x and y; None for a label with neither

- `SHORT = 2.0`: a name past its node by up to 2 px a side is fine (Ca2+, cAMP, NADH)

## name_box

the name's text, absolute (x0, y0, x1, y1): its label box less SHORT a side and 3 px of padding above and below; None for a node without a name

## up

- `def up(v, step):`: v rounded up to a multiple of step

## extent

node box with its labels (icons, N:2, a name wider than the node) and a multimer's second outline (6 px down and right), as yEd counts them in a group's bounds, absolute

## room

space between a group's stored box (realizer r) and what yEd draws without BorderInsets: its members (extent above) + Insets + the height of its visible internal labels on that side (top: t, tl, tr; bottom: b, bl, br); yEd draws the group as that + BorderInsets

## box_faults

groups yEd would draw at another size on opening than the file stores: [(id, side, px)], px > 0 where yEd grows the group (into its neighbours), < 0 where it shrinks it

## fit_insets

BorderInsets take the room between the stored box and what yEd draws (room above), so yEd keeps the box. Labels in the top margin (N:2 of a first-row member) lower the top Insets instead.

## compact

items: [(centre, (lo, hi) along axis, (lo, hi) across, edge, half the node)]; lines of equal centre move as one, each member starts GAP after every earlier member it faces, and at least at start, measured from edge (the outline, or the node where labels may sit in the margin), and at floor[k] (a line's least centre); GAP_COMPLEX where a member of wide (inner complexes) faces the other line; returns the new centres, the far end and the lines

- `for prev in lines[:k]:`: each member clears only the members it faces (glycogen
- `for i in prev:`: PHK complexes: a tall inner complex in PHKA1's row pushed it 40 px down)

## faces

- `def faces(items, a, b):`: two lines with members side by side across the axis

## placed

compact, then a line that faces no other line (nothing beside it: a protein over two, mevalonate LKB1; a protein next to a tall inner complex, carnitine PKA-C) has its centre in the middle of what the complex holds along the axis; one on a line (within TOL) joins it its node's centre in the middle of the others' nodes (not counting a multimer's second outline or icons: eNOS), the complex not widened

## scaffold

- `def scaffold(k):`: a protein drawn tall, as a scaffold its partners dock on (SKILL.md 3, Sizes)

## pack_one

- `if not kids:`: an empty complex keeps its box: nothing to pack
N:2 and units of information above a member of the first row sit in the top margin; a state variable there (not allowed, SKILL.md section 3) still counts a name yEd shows inside at the bottom (every complex of the osteoarthritis blocks) sits NAMED under the members in place of the bottom margin, as yEd draws it (room); one at the top (a CellDesigner complex's, the viewer's drawing) NAMED above them in place of the top margin, the name's height above that

- `if any(scaffold(k) for k in kids):`: partners keep the rows where they dock on the scaffold: fitted, not packed
- `v = NAMED if (side == 'bottom' and name) or (side == 'top' and name_t) else v`: yEd draws the name beyond the Insets

## ligand_on_top

a complex of one protein and one metabolite (a bound ligand, cAMP, GTP): the metabolite above the protein (osteoarthritis cAMP-PKA block: Gsα:GTP, PKA reg:cAMP turned so; SKILL.md section 3); pack() then spaces them. Returns whether it turned them

## pack

packs every complex (inner ones first), moves the ports on their borders with them and fits all groups; returns {complex id: (old size, new size)}

- `state = {r.get('id') for r in root.iter(Y + 'Resource')`: icons drawn as state variables
- `for e in root.iter(G + 'edge'):`: ports on a border stay on it; inside stay unless now outside

## At the module level

- `NAMED = 6.0`: under the members, above a name shown inside at the bottom (its label box keeps 3 px above the text)
- `GAP_COMPLEX = 10.0`: one above the other, a member and an inner complex (mevalonate PP2ARB)
- `INSETS = (('left', 10), ('top', 12), ('right', 10), ('bottom', 16))`: top + the 4 px group label = TOP
- `TOL = 5.0`: centres closer than this share a line
