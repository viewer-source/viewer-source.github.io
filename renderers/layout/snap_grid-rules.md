# snap_grid: its rules and their reasons

The comments of `snap_grid.py`, the layout skill's script the viewer kept a copy of until the viewer's
layout and the skill were unlinked: `layout.js` holds the same packing and snapping in JavaScript and is
its own master since, the skill keeping its own. Where `layout.js` names a rule by a function (snake_case here,
camelCase there), its reason is under that name below. A rule changed in `layout.js` is changed here in the same
commit. Code quoted beside a reason is the Python of that day.

## Header

```text
Snap to grid (the layout skill's SKILL.md section 3).
Node centres go onto a node grid (8 px), arc bends and free ports onto a finer route grid (4 px).
Plain rounding breaks alignment (102.4 and 102.6 go to 100 and 105 on a 5 px grid), so the points
of each axis are first grouped into lines (columns, rows), and each line moves onto the grid as
one. Points within tol of each other chain into a line, and a chain wider than 2 tol splits at
its largest gap. Lines joined by an almost straight arc segment (off by less than link, at least
twice as long: eNOS, a process 5 px off the column of the complexes it joins) merge while no
wider than 2 link. Lines keep their order. A port fixed on a node's border (a process corner at
9, 9) moves with its node, and a line holding one follows it (PDH, BCAA: a node or bend lined up
with a corner, 1 px off the 8 px grid, stays lined up); a free port (along a side) takes its
line's place. Complexes are packed first (complex_pack, exact margins, no grid inside them),
then move as one piece by their centre: the centre lands on the grid, the members
where their sizes put them. A compartment keeps its box unless what it holds now reaches past
its margin (complex_pack.room), and fit_insets ends it, so yEd keeps the boxes.
```

## units

what moves as one piece (leaves outside complexes, outermost complexes): {id: node}, and the unit each node belongs to

## collect

per axis: points [(value, kind, ref)] (unit centres first, in centre's order, then free ports and bends) and links [(i, j)]: ends of almost straight segments

- `path = []`: (x, y, index on x, index on y); None for an end on a complex member
- `if u != end:`: ports on a complex member move with the complex
- `else:`: along a side the port is free; on the border (a corner too) it follows the node

## lines

groups of indices, one per line: neighbours within tol chain, and a chain wider than 2 tol splits at its largest gap (keeps ports 6 px apart on one side apart); then lines joined by a link merge while no wider than 2 link

## targets

a line holding a node centre goes onto the node grid (at its centres' mean), lines keeping their order, unless it holds a fixed port (on the border, e.g. a process corner at 9, 9) of another node: that port moves with its node, so the line follows it and stays lined up with it. A line holding only ports follows them, and a line of bends alone goes onto the route grid; free ports take their line's place

## compartments

- `def compartments(root):`: innermost first, with something inside

## snap

passes until nothing moves (one pass is not stable, a second run can still move points by up to 4 px: bend lines on the route grid 4 px from a node line chain into it, and lines following a border port land off the grid; on the 21 official maps and the examples two passes always settle)

## numbers

- `def numbers(root):`: every position and size, to a hundredth of a pixel

## one_pass

- `for g in compartments(root):`: a box stays unless what it holds now reaches past its margin
- `return max([max(abs(mx[u]), abs(my[u])) for u in centre] or [0.0])`: largest move
