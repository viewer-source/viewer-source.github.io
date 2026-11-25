# cdrender: its rules and their reasons

The comments of `cdrender.py`, the Python twin of `cdrender.js`, kept here when the twin was retired: the JavaScript is the one master, and where its comments name a rule by a function (`cdrender.py's clip`
in older comments, `clip` here), its reason is under that name below. A rule changed in the code is changed here in the
same commit. Code quoted beside a reason is the Python of that day; the JavaScript does the same under the same name
(snake_case there, camelCase in the JavaScript).

## Header

```text
A CellDesigner file drawn as CellDesigner draws it: the CD viewer's
CellDesigner view. The rules are read off SVG exports from CellDesigner
(cdviewer/celldesigner/: iNOS, eNOS, ACLY, mevalonate, SREBP, estrogen), the geometry of lines
as the converter reads it (anchors, edit points in the frame of their two ends, added links
joining the main line at 3/8 and 5/8).
```

## attr

- `def attr(s):`: a value between double quotes

## colour

- `def colour(c, default='#000000'):`: aarrggbb -> (#rrggbb, alpha); anything but eight hex digits as none

## counts

a reactant's or product's stoichiometry other than 1 (SBGN's cardinality), by ('r' or 'p', its alias)

- `out[(k, a)] = str(int(n)) if n == int(n) else repr(n)`: as the converter's count_text writes it (2.50: 2.5)

## outline

the shape a line stops at, as a polygon

- `if cls == 'RECEPTOR':`: CellDesigner's receptor: notched at the top, pointed at the bottom

## enter

where the segment Q (outside) -> P first enters one of the shapes (('e', cx, cy, rx, ry) an ellipse, ('r', x, y, w, h) a rectangle), else P: a state variable or unit of information on the way (the shape outline)

## leave

where the segment P (inside) -> Q leaves the polygon, else P

## name_left

the left of a compartment's name (its namePoint x) at the top middle of box: its widest line centred

## name_point

a compartment's name at one of nine places in box (cdrender.js namePoint): its box the membrane's thickness + 5 from a side and + 0.5 from the top and bottom, centred otherwise; on an oval a corner's box has its outer corner on the inner ellipse at 45 degrees; the namePoint is its top left, to 0.1

## name_place_of

which of the nine places a namePoint is at (within 1 on each axis), else None; one: None also where two or more places meet there, so a move or resize keeps the name as it is

## Drawing (class)

- `def box(self, i):`: lines meet the alias's whole box, a multimer's copies included
- `def front(self, i):`: a multimer's front copy, 6 smaller per copy behind it
- `def open(self, e):`: a group of the editor's (GROUPS) for one line, in the lines and in their halo

## The XML, as lxml read it (find, findall)

CellDesigner 4.0's layout read as the later one: SBML Level 2 in any of its versions (4.0 wrote Version 1,
`http://www.sbml.org/sbml/level2`; later versions Version 4), and an annotation holding CellDesigner's elements
straight, with no `<celldesigner:extension>` round them, taken as that extension (ACSN 2.0's archive, 35 maps, was refused
with an AttributeError when the model was not found). The writer keeps such a file in its own layout
(cd_make's older and bare).

## __init__

- `self.extra = {}`: extras(): per alias, what does not depend on its box
a compartment drawn as a picture (MINERVA's glyphs: 'Glyph: glyphs/x.png' in its notes): glyph(path) gives the picture's address, or None; with no glyph every compartment is drawn as lines aliases: id -> (class, box, alias element, species name, identity) where things are drawn, for a viewer's clicks: alias id -> box; reaction id -> lines and square

## compartments

-- nodes ----------------------------------------------------------------------------

## compartment

one compartment, at its bounds or at box (the editor's live drawing of one growing during a drag: its name moved with its corner, as cd_edit's place() moves the namePoint) the lines in the compartment's colour, black for a near-white one (CellDesigner's PDF exports compared with the SVG exports of other maps) the band between the two lines in the compartment's colour, at a quarter (CellDesigner's opacity 0.498 on a fill-opacity 0.498); the inner corners concentric with the outer ones (radius 20 less the thickness), so the band keeps its width round the corners

## species

complexes first, outer ones before those inside them, then the other species

## node

- `fill, alpha = colour(paint.get('color') if paint is not None else 'ffffffff', '#ffffff')`: a paint that is no colour: white, as none
- `sl = f(a, 'cd:usualView/cd:singleLine')`: the border's width (2 on some maps' complexes)
- `self.open_ = cls == 'ION_CHANNEL' and act is not None and act.text == 'active'`: an active ion channel is drawn open
- `if act is not None and act.text == 'active' and not self.open_:`: active: a dashed outline 4 outside the shape (CellDesigner's PDF)
- `for k in range(n - 1, -1, -1):`: the copies of a multimer behind, offset 6 each, each with its states
- `fe = f(a, 'cd:font')`: the alias's font size, 12 by default; lines 7/6 of it apart
- `mid = x + (fw - 20) / 2 if cls == 'ION_CHANNEL' else x + fw / 2`: an ion channel's name on its body, not its gate

## shape

an unknown entity has no outline in CellDesigner (group labels drawn as unknown entities)

- `if cls == 'ION_CHANNEL' and fill != 'none':`: a channel and its 20 wide gate: touching when closed, apart when open
- `elif cls == 'TRUNCATED':`: a protein whose right end is cut: square corners there, a notch in from the bottom
- `elif cls == 'DRUG':`: a stadium with a second line 4 inside
- `elif cls == 'DEGRADED':`: a circle of 3/8 the box, a slash across the whole box

## states

CellDesigner draws every residue of the protein, an empty circle where the species gives no state a residue's name inside the shape, as CellDesigner 4.4 draws it (its PDF of residues all round four proteins): at the same angle on the outline 9 in, 2 more in from a side the circle sits on, its middle level with that point; left-aligned left of the middle, right-aligned right of it, centred in the middle

## site_name

hidden unless the viewer's Show sites asks for it (sv-site), as yrender hides a state variable's site

- `label = st.get('structuralState')`: an ellipse 12 wider than its 10 px text on each side
- `self.text(label, px, py + 3, size=9)`: drawn at 9 (CellDesigner 4.4 PDF); the ellipse is sized from the text width at 10
- `self.text(label.strip(), x + w / 2, uy + 12)`: centred in its box, as CellDesigner (AsthmaMap mast cell PDF)

## centre

-- lines ----------------------------------------------------------------------------

## end

where a line meets alias i: its anchor (linkAnchor in e), else its centre; and whether anchored

- `if side not in ANCHOR:`: no anchor: the centre of the whole box, a multimer's copies included (iNOS's SVG)

## at

anchor side's point on alias i an anchor sits on a multimer's front copy (a large map's PDF from CellDesigner: FTH1 as 12 copies)

- `if self.alias[i][0] == 'RNA':`: on the parallelogram, slant h: along its top and bottom edges, down its
slanted sides (a large map's PDF from CellDesigner: SSE three quarters along the bottom edge)

- `if self.alias[i][0] == 'DEGRADED':`: on its drawn circle, 3/4 of the box (AsthmaMap mast cell PDF: no gap)
- `if self.alias[i][0] == 'COMPLEX' and side in ('NE', 'SE', 'SW', 'NW'):`: a corner on the middle of its cut
on an ellipse at 22.5 degree steps, on a phenotype's hexagon, else on the box (the converter's rule)

## clip

the line's visual end at alias i: an anchor as it is, else where the line from the centre leaves the shape; then the first state variable or unit of information it meets on its way in (the shape outline)

## ends

a reaction's visual ends, cut at the state variables once its square is placed from the shape-only ends

## extras

the shapes states() draws round alias i, on every copy of a multimer: residue circles, structural state ellipses, the unit of information's box on the front copy. What does not depend on the box is read once per alias (the editor moves boxes in place, never the states)

## path

dash: False, True (6,4) or a pattern: transcription dash-dot-dot, translation dash-dot (CellDesigner's PDF) a line: a white halo under it (CellDesigner's, so crossings read), shortened at nodes

## head

an arrowhead with its tip at T, the line arriving along u; returns where the line stops

- `if kind == 'stimulation-reduced':`: SBGN's open triangle, as yrender's white_delta
- `c = at(6, 0)`: 2 px of white before the outline (CellDesigner's 4.5 left 0.5 px, 1 px not enough), as yrender

## reactions

- `except Exception as e:`: a reaction this drawing cannot place is left out, said on stderr

## count

a cardinality (the converter's layout.count_box): a box beside the middle of the participant's line (from the species' visual end to the process), a long side along it, above it or right of a line near upright, light grey

## reaction

- `line[0] = self.clip(ra, A, ancA, line[1], True)`: the shape alone: the square's place (ends below)
- `dash = reduced and typ.startswith('UNKNOWN')`: an unknown transition keeps a solid line, a ? in its square
- `if reduced:`: an arc between the entities, its head by type
the main line: reactant to product, the head at the product (and the reactant if reversible)

- `if GROUPS:`: split at the process glyph, each half with its own head

## branched

two entities binding into one (heterodimer association) or one coming apart into two (dissociation): three arms meeting at a point. The point is the last edit point, in the frame of the three species' centres (the first as origin, to the second and the third, not orthogonal); the arms' own edit points come before it, num0, num1 and num2 of them, each in the frame of the point to its species (checked against CellDesigner's PDFs of two large maps). The square sits halfway along the single arm, a dissociation draws two circles at the point.

- `ends = br + bp`: association: reactant, reactant, product; dissociation: reactant, product, product
- `inward = (k < 2) if assoc else (k == 0)`: the line runs from the species to the point
every arm's points in the frame of the point to the species, listed from the point outward (a large map's PDF from CellDesigner)

- `if inward:`: the shape alone: the square's place, the visual end below
- `for seq, inward, al in arms:`: the visual ends, once the square is placed
- `head_here = (not inward) or reversible`: products get a head, reactants too when reversible

## gate_reaction

a logic gate between entities: each input to the gate (its GateMember: anchor and edit points in the frame of input to gate), the gate at its absolute point, a line from the gate to the product, its head by the gate's modificationType (checked against CellDesigner's PDF of Mitophagy)

- `G, gbend = gp[-1], gp[:-1]`: the gate last, bends of its line to the product before it

## gate

a gate: a circle with its sign; in the editor's drawing (GROUPS) a group of its own, its node's id ('<reaction>|g' between entities, '<reaction>|g<n>' for the reaction's modification n), as cd_edit's GraphML

## links_and_modifiers

added reactants and products join the square's segment at 3/8 and 5/8 of its ends' anchors

- `lcol = colour(lc.get('color'))[0] if lc is not None else col`: its own colour and width, as CellDesigner keeps one for each
modifiers end at the point of the square targetLineIndex names the gate at the last point (absolute); points before it bend its line to the square, in the frame of gate to square (CellDesigner's PDF of Mitophagy) the input's own entry (same alias, the gate's modificationType): its anchor and bends, in the frame of input to gate (Mitophagy PDF); without one, a straight line from the centre

- `if own is not None:`: as cd_edit's edge from the input to the gate
the process glyph: a 10 px square along the line, over the lines

- `if mark:`: Times bold 10, upright

## texts

the free texts of visible layers, left aligned in their box and centred in its height (the CellDesigner legend); a line such as BackgroundColor=#D7EDFF is a setting, not text

## on_border

the point of the box's border at residue angle a (radians, y up), as CellDesigner places state circles

## render_hits

the drawing and where its parts are: aliases (id, species, class, box) and reactions (id, lines, square), for a viewer that opens what is clicked

## At the module level

- CLASSES (set by the viewer's build): each species' fill and name get the class c-<role> and t-<role> of yrender's
- --roles beside their colours, so a colour scheme (the viewer's Settings, Map colours) can recolour them; off, the
- output is unchanged. Compartments keep their colours (their lines are drawn in it too).
- GROUPS (set by the viewer's editor): each compartment and alias in a group of its own (data-n, its id), each line of a
- reaction with its heads in one (data-e: <reaction>|a reactant to process glyph, |b process glyph to product, |m<i> a
- modifier, |r<i> and |p<i> an added reactant or product; its white halo in a group of the same name), the process glyph
- in one (data-n <reaction>|proc), the main line split at the glyph, the whole in <g transform="translate(0,0)">: so the
- editor moves each part while a drag runs. Off, the output is unchanged.
- Helvetica's widths (Arial's metrics), per 1000 of the font size, for characters 32 to 126
- a reduced notation's head by its type; a gate reaction's by its modificationType, else as a reduced type's
