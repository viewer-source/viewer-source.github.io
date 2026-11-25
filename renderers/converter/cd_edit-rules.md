# cd_edit: its rules and their reasons

The comments of `cd_edit.py`, the Python twin of `cd_edit.js`, kept here when the twin was retired: the JavaScript is the one master, and where its comments name a rule by a function (`cd_edit.py's clip`
in older comments, `clip` here), its reason is under that name below. A rule changed in the code is changed here in the
same commit. Code quoted beside a reason is the Python of that day; the JavaScript does the same under the same name
(snake_case there, camelCase in the JavaScript).

## Header

```text
The viewer's editor on a CellDesigner file, editing it as yEd edits a GraphML map. The editor edits
yEd GraphML; so a CellDesigner file is given to it as GraphML (graphml()), and what it changed there is written back
into the CellDesigner file's text (apply()): only the numbers that change, everything else byte for byte, so
CellDesigner opens it as it was, with the moves.
  compartments, complexes and aliases are the GraphML's groups and nodes (a complex holds its members, a compartment
  what names it as compartmentAlias, and the compartments inside it); each reaction's process glyph is a node of
  10 by 10 (id <reaction>|proc), and its lines are arcs: |a reactant to glyph, |b glyph to product (|a alone, reactant
  to product, for a reaction drawn without a glyph), |m<i> modifier i to the glyph, |r<i> and |p<i> added reactants
  and products. Ports are where the lines are attached to the nodes (linkAnchor), bend points the edit points, absolute.
  Bend points stay where they are when a node moves (yEd's way, not CellDesigner's, where they
  live in the frame of the line's ends and stretch): they are written again in the frame of the new ends.
  CellDesigner's own model of a reaction: one link, its main
  line the two ends and the bend points put or removed in the editor; the square midway on segment rectangleIndex (|a holds
  the bend points before that segment, |b the rest); added reactants and products joined at 3/8 and 5/8 of that
  segment (the antennas' ends), modifiers at the square's spots; all of it worked out again from those numbers.
  The glyph sits midway on the segment of the main line it is on (rectangleIndex), wherever that goes. It is never
  moved by itself (as in CellDesigner, where a process cannot be moved on its own; the editor does not
  let it), and no bend point is ever added to make up for a move: the line changes only by the anchor (bend) points
  put and moved in the editor.
  Left as they are, drawn but not editable: logic gates, associations and dissociations (their geometry stays in
  CellDesigner's frames, so it stretches with the nodes).
  For the layout skill's Pack and Snap map to grid, the GraphML also carries each complex's name as an
  inside bottom label and the marks round an alias (residues, structural states, an open unit of information) as state
  labels, so the tools leave them room; nothing reads them back.
    graphml(cd_text) -> GraphML text;  apply(cd_text, graphml_text) -> CellDesigner text
```

## rxid

- `def rxid(rx):`: a reaction with a metaid and no id (SBML requires one) is read by its metaid, as the converter reads it

## rx_open

- `def rx_open(rid):`: its start tag in the text, by either

## tree

parent of every compartment and alias: a member's complex, an alias's compartment, a compartment's smallest compartment round it

## gate_lines

logic gates (the CellDesigner editor): cd_edit.js's gateLines says how

- `r['ra'] = r['ins'][0]['alias'] if r['ins'] else pa`: where the gate sits in the GraphML's nesting

## lines

the editable geometry of one reaction, absolute, or None when it is left as it is

- `own, ins = {}, set()`: a gate's input: its own entry, the first of its alias and the gate's modificationType (cdrender's)
- `return None`: an input's line shared by two gates (its bends in two frames): left as it is

## cut

the main line as cdrender places the glyph on it: an end at a node's centre cut where the line leaves its shape

- `line[0] = d.clip(r['ra'], r['A'], r['ancA'], line[1], True)`: the shape alone, as cdrender places the square

## marks

what CellDesigner draws round an alias beyond its box, as cdrender draws it (absolute x, y, w, h): residue circles and structural states on the border of each copy of a multimer, the open unit of information on the front copy. Given to the layout skill's tools as state labels, so Pack keeps them apart as on a yEd map

## labels

the labels the layout skill's tools read: a complex's name inside at the bottom, where cdrender writes it (its height, lines 7/6 of the font apart), and the marks round the alias as state icons

## spot_of

the place of a modifier's end round the glyph, as cdrender's target() takes it: targetLineIndex's second number, 3 when it names none of the six (SQUARE)

## graphml

off: subtracted from every place, so the editor keeps its own frame when the file's map was shifted (place()) a process glyph sits in the innermost group holding both its reactant and its product

- `def port(p, i):`: a point as yEd's port: its offset from the node's centre

## chain

- `procs, gnodes = {}, {}`: the process glyphs, the gates (their centres)

## node

- `if i in gnodes:`: a gate: cdrender's circle of radius 6
a phenotype's points indented half its height, as cdrender's hexagon (the editor's outline reads indent) a degraded species' circle inset an eighth of its box on each side, as cdrender draws it (the editor's outline reads inset)

## edge

the main line split at the glyph: the bend points before its segment in |a, the rest in |b, so the number of |a's points is rectangleIndex (a point put on |a puts the glyph on the segment after it, as its middle lies there)

## read

- `ups[n.get('id')] = p.get('id') if p is not None else None`: the node that holds it

## anchor

the port pos ('' the centre) of el (its linkAnchor child; a modifier's in its linkTarget, made when missing from target: (species, alias)), in the tree and in the text

- `cs = T.span(r'<celldesigner:connectScheme', span[0], span[1])`: CellDesigner's order: after it, before line
- `if T.t[span[1] - 2:span[1]] == '/>':`: an empty element: given its child

## ports

the ends the editor moved (their port in the GraphML no longer the file's): set to the centre or a side's middle

## moved

the same port on the node's new box (Snap or Pack resized it, and the GraphML was made again from the file): not a move, so a point between the five (ENE) is kept, not taken to the nearest side one of CellDesigner's 16 anchors on the node (Make main trades two lines' ports, ENE included): kept as that anchor

- `for m in ([m for m in o['mods'] if m['gate'] is None] + o['gates'] if o['glyph'] else []):`: a gate's line ends round the glyph too
- `m['el'].set('targetLineIndex', '%s,%d' % ((m['el'].get('targetLineIndex') or '-1,2').split(',')[0], q[4]))`: written with the edit points (place())

## Text (class)

edits of the CellDesigner text: (start, end, new), applied at the end, last first

## span

the element whose start tag matches open_re, from its start to the end of its end tag (or of the empty tag)

## at

where the first reaction, species or alias with this id starts: one pass over the text, made on the first lookup (the text does not change while edits are collected), so finding all of a large map's reactions costs one reading of the file, not one per reaction. A reaction is found by its id or its metaid, as rx_open; its id first, its metaid only where no reaction has that id (ACSN 2.0's masters, merged from several maps, give one reaction metaid="re266" id="re210" and another id="re266"; the metaid taken first wrote the second's moves into the first, refused as IndexError)

- the aliases, as aliasOpen() finds them: the id anywhere among the start tag's attributes (Newt's CellDesigner export writes compartment= or compartmentAlias= before id=; found only as the first attribute, a move refused as "'NoneType' object is not subscriptable")

## editPoints (EP, epText, epPut)

an editPoints element found with or without attributes (CellDesigner may write omittedShapeIndex on it, as ACSN 2.0's files do), its points written in place with its opening tag kept; found only bare, a second editPoints was added beside it on a move

## catalysed lists in CellDesigner 4.0's layout

a species' listOfCatalyzedReactions made where none was: before its extension's end, else (CellDesigner 4.0's layout, no extension) before its annotation's end

## attrs

the start tag at position at: the given attributes set (added at its end when missing, removed when None)

## done

edits apart from one another (the usual case): the text joined once from its pieces, in place of one copy of the whole text per edit; edits that touch or share a start applied one by one as before, last first

## points

the edit points as text: an old token kept when its point and its frame did not change

- `if i < len(toks) and len(old_abs) == len(new_abs):`: the same in the new frame (a whole reaction moved)

## directions

the listOfLineDirection inside span: n of them, one per segment, the values kept

- `MARGIN = 40.0`: the converter's margin round a CellDesigner map

## gate_at

- `def gate_at(new, id_, G):`: a gate's place now: the centre of its node, if the editor moved it, else where it was

## gate_points

- `def gate_points(old, o, G, nb, same, fr):`: a gate's editPoints: the bends of its line to the target, then its place

## scheme

- `def scheme(T, sp, n, n0):`: a gate's line's directions, counted again only when its bends changed in number

## gate_back

- `def gate_back(d, T, s, o, bends, new):`: a gate between entities written back
- `re_ = T.span(r'<celldesigner:editPoints>', s[0], ls[0])`: the reaction's own copy of the gate's points

## rewire

- `if r is None or r.get('gate'):`: a gate's ends are not moved to other nodes (its inputs listed in several places)
the reaction's ends: (edge, end, alias in the file, kind, n, el); an end may move onto an alias none of the reaction's other ends of its kind has as the GraphML now stands (one freed by an earlier move is free)

## now_of

SBML's reference: the one naming that alias, else the first of that species naming none

## place

the CellDesigner text with the moves, and the shift (x, y) of the whole map: CellDesigner has no negative places, so a map moved past the left or the top edge is shifted right or down, each on its own, by whole blocks of the grid (16) to start at the margin (40) or a little more; the canvas grows with it

- `if t2 != text:`: a line's end moved to another node: the participant first, then read again
- `block = lambda m: math.ceil((MARGIN - m) / 16) * 16.0 if m < 0 else 0.0`: whole blocks of the grid: a map on it stays on it
- `def regrouped(i):`: its compartment set in the editor (written below)

## regrouped

- `new.update({i: b for i, b in boxes.items() if i not in old and GATE_ID.search(i)})`: the gates' nodes
a species resized: its usual view's boxSize the same as its bounds (CellDesigner keeps both) its name moved with its corner; a name at one of the nine places, or at the top middle (cdrender.name_left), kept there, the box resized too a name at one of the nine places (cdrender.name_point) kept at its place in the new box

- `ip2 = T.span(r'<celldesigner:innerPosition ', s[0], s[1])`: its offset from the new compartment's corner, as CellDesigner writes it when it reassigns
- `def members(cx):`: a complex's members that carry a compartmentAlias (CellDesigner writes their complex's): the new one (carriers() in cd_edit.js)

## members

- `now = 'inside' if p1 is None else state(new[i], new[p1])`: out of every compartment: inside the default one
- `r = lines(d, rx)`: the ends as the nodes and ports are now (the bends still in the old frames: not used)
- `if len(main) != len(o['bends']):`: counted again only when the bends changed in number (a file written elsewhere may hold more)
- `T.attrs(ms[0], {'targetLineIndex': m['el'].get('targetLineIndex'), 'editPoints': txt or None})`: its place, if ports() moved it
- `continue`: a link without bend points follows its ends by itself
- `elif child:`: its last bend point gone: the element goes, as the main line's
- `if sh != (0.0, 0.0):`: what the editor does not hold but is placed absolutely: free texts and logic gates
a free text's corner, a free line's two ends

- `own = [T.span(rx_open(rid), T.at('reaction', rid)) for rid, o in olds.items() if o and (o.get('gate') or o['ga`: written by gate_back and the reactions' own

## draw

the editor's call: the CellDesigner text with the moves, its drawing (in groups) and the GraphML made from it again

- `if sh != (0.0, 0.0):`: the editor's frame: the drawing is in the file's places, the editor's are sh less

## At the module level

- `'TRANSLATION')`: drawn with a process glyph (cdrender's not reduced, branched ones aside)
- the GraphML -----------------------------------------------------------------------------------------------------
- the marks round an alias count as state icons for the layout skill's Pack (a first row's in the top margin)
- writing back ----------------------------------------------------------------------------------------------------
- where a line meets a node, as the editor sets it (snapped to the centre or the middle of a side): the centre (no linkAnchor: the line starts from the centre, cut at the shape) or the
- middle of a side (CellDesigner's N, S, W, E); a port the editor did not touch keeps its port
- a modifier's end the editor set round the process glyph: the place it chose (spot, one of CellDesigner's six:
- the corners and the middles of the two sides off the main line), by its number, so the frame it was drawn in
- does not matter
- a line's end moved to another node in the editor: the
- reaction's participant at that end rewritten in every place CellDesigner keeps it, the rest byte for byte: the base
- reactant or product (species, alias), an added reactant's or product's link (reactant or product, alias), a modifier
- (modifiers, aliases, its linkTarget's species and alias), SBML's speciesReference or modifierSpeciesReference
- (species, its celldesigner:alias), and for a catalysis the species' listOfCatalyzedReactions where the file keeps
- it; the old port taken off with it (ports() then writes the one the editor chose). Only an end at a species moves,
- never the process glyph's end of a line, and never onto an alias the reaction already has (the editor refuses it).
- A kineticLaw is left as it is (none on the demo maps). ends: edge id -> (source, target) in the GraphML; olds:
- lines() of each reaction; the text as it was when no end moved
- a modifier and a reactant or product may share a species alias (as files have it, and Make main swaps into);
- two reactants or products may not (a line of length 0)
- all or nothing: one end refused leaves the reaction as it was (a swap half done would change the network)
- a catalysis moved: the old species no longer catalyses the reaction unless another of its catalyses stays
- the species' lists of the reactions they catalyse, only where the old species listed it (the file keeps them)
- the boxes: bounds, the place inside the parent, a compartment's name
- what holds what as the editor set it, freely: an alias or a complex the GraphML
- puts into another compartment, or none, gets that compartment as its compartmentAlias (none: the attribute taken off)
- and its species that compartment's own (default for none), as CellDesigner 4.4 writes them; a compartment put into
- another gets that one's compartment as its outside. A complex's member stays as the file has it (one taken out is
- written by cd_make.js's leave after this)
- where a species lies in its compartment, as CellDesigner 4.4 writes it:
- inside, or transmembrane when its alias crosses the border (inside when it leaves every compartment); written only
- where a move or a change of compartment changes it, and only where the file has the element
- the canvas grows to hold what was moved past its right or bottom edge, as in CellDesigner (40 to spare, the
- converter's margin); the site draws the canvas only
- the reactions, with the nodes where they are now
