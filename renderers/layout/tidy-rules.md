# tidy: its rules and their reasons

The comments of `tidy.py`, the Python twin of `layout.js`, kept here when the twin was retired: the JavaScript is the one master, and where its comments name a rule by a function (`tidy.py's clip`
in older comments, `clip` here), its reason is under that name below. A rule changed in the code is changed here in the
same commit. Code quoted beside a reason is the Python of that day; the JavaScript does the same under the same name
(snake_case there, camelCase in the JavaScript).

## Header

```text
The layout skill's tools for the editor: run on the map's text, and only the attributes they change
written back into that text, the rest byte for byte (the editor's rule: yEd opens the file as before).
  tidy(text, 'grid')            the whole map onto the grid (snap_grid.snap: complexes packed first, compartments fitted)
  tidy(text, 'pack', ids)       the complexes with these node ids, or round them, packed (all when ids is empty), the groups fitted;
                                -1 changes when none of them is or sits in a complex
  tidy(text, 'fit', {'resize': [id, x, y, w, h], 'moved': [ids]})
                                compartments are containers: the one resized gets its new box, never
                                smaller than what it holds; the compartments round it and round the nodes moved grow to
                                hold them, never shrink; their BorderInsets fitted (and those of the complexes round the
                                nodes moved), so yEd keeps the boxes. Nodes keep their sizes.
  keep_ports                    a CellDesigner map (the GraphML the converter's cd_edit makes of it): every line keeps
                                its ports, as CellDesigner keeps a line's connection point on the node (one of its 16)
                                and moves it with the node, so a tool moving or resizing nodes never changes where a
                                line meets them (snap_grid's straightened ports had turned ENE into E)
Returns [new text, how many attributes changed]. The tools change attributes only, never add or remove elements, so the
n-th start tag of the text is the n-th element lxml reads.
```

## num

- `def num(v):`: as the editor writes a number: at most three decimals, no trailing zeros

## fit

- `gone = {d for n in gone for d in n.iter(G + 'node')}`: a group moves with what it holds
- `grow = sorted(set(grow), key=lambda g: -len(list(g.iterancestors())))`: innermost first
- `for g in set(grow) | set(insets):`: as complex_pack.fit_insets, for these groups only

## tidy

- `if what == 'pack' and ids:`: only the complexes chosen: what they hold, the ends of their arcs, the groups round them
- `chosen = []`: a complex chosen, or the complex round a member chosen
