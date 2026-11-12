# Viewer source

Public repository: the one source of the atlas viewer every map site uses, and its demo at
https://viewer-source.github.io. Names no private repository in files, pages, code comments or commit messages: it
says "the workbench", "the converter's repository", "a private repository".

- The viewer: `_includes/atlas-app.html` (list on the left, the map, its panel, search, downloads row). It never
  knows a map's source format.
- Two modes (user, 2026-11-08). Presentation, the default: a fixed list for reading and reviewing maps, as a published
  site shows them (the next Metabolism Regulation version, for one). Development, `mode="development"` on the include,
  for a copy where maps are being developed: the whole page for the map with no site header (as the osteoarthritis
  working site), and groups and the maps in a group put in another order by dragging, kept in the reader's browser.
  With `groups=site.data.groups` (a list of `name` and `closed: true`) development mode also shows a listed group
  with no map yet as an empty group, and starts a group marked closed as closed (as the expo atlas). The presentation
  mode has none of this, unless `drag=true` is on the include (the styles page): then it has the dragging alone.
  The demo runs in development mode.
- The sites take a new version of the viewer only when the user asks (user, 2026-11-08: when it is time to make it
  available), and then in presentation mode; each is checked live after its copy is updated.
- Behaviours (user, 2026-11-09, from the styles experiment), in the viewer itself: a separator between the list and the
  map (dragged sideways for the list's width, down to out of sight; a click brings it back, a double click gives 240 px)
  and one under the map window (its height; off for now, `--m2-separator-below: 1` turns it on: user 2026-11-09, to
  think about; dragged down it simply makes the map window taller, nothing under it hidden (the download row, the
  title and the text follow it), following only the reader's own moves (user, 2026-11-11: "only when you move, it moves"; the growing on by itself
  past the window's bottom edge and the drag started by a press held at the edge, both of the same day, removed), with a
  snap: a map ending above the window's bottom edge stops on it (from 20 px before, user 2026-11-11; was 16) for that drag; to go further the
  reader scrolls the page a little and drags again, a map already on the edge following the pointer freely, up to
  twice the window's height; a map window taller than the browser window lets the wheel
  scroll the page, Ctrl or Cmd with the wheel and a pinch zoom it; Shift with the wheel scrolls the page from anywhere over
  the map in every style (user, 2026-11-11: the text under the map was reached only from the edges): user, 2026-11-11, replacing the row put out of sight
  at the bottom edge of 2026-11-09, which hid the title and text too, so the page ended at the map and froze) in place of the corner grip, both kept in the reader's browser, in the gaps
  `--m2-split` and `--m2-split-h`; a second click on a molecule closes its panel; dragging in the list only with Shift
  held (also in a page with `drag=true` in presentation mode); no highlight under the pointer in the list. Each is a
  setting (`--m2-separators`, `--m2-click-closes`, `--m2-drag-shift`: 1 on, 0 off; `--m2-hover`). The viewer's look
  does not change with them (user: "visuals should not change but useful functionalities stay"): the separators show
  no dots here, `--m2-grip` (beside the list and beside the panel) and `--m2-grip-h` (under the map) give a
  style its dots. A third separator, between the map and the panel while it is open beside the map, sets the panel's
  width (`--m2-info-w`, 160 to 600 px; under 60 out of sight, a click brings it back), kept the same way; a panel dragged out of sight comes back when an item of the map with an annotation is clicked or
  chosen in the search (user, 2026-11-10: closing it by hand should not hide the annotation asked for). A fourth,
  above the map window (`--m2-split-t`, dots `--m2-grip-t`), hides the site's header when dragged up so the map takes
  the page from its top; a click brings the header back (not in development mode, which has no header).
- The look (user, 2026-11-09): Default Next of the styles experiment is the viewer's default look, in its own block
  after the main rules of `atlas-app.html` (frame and 8 px gaps, no dots on the separators, the separator under the map
  on, the page, the list and the panel scrolling as one (as Compact Dark; the pinned behaviour is on the styles page in Reactome Scroll, Default List and Default Lines), the list and the panel scrolling inside; items fading over 10 px under the search and at the list's bottom edge: removed and
  brought back on 2026-11-09, user, once the item above the chosen map stayed in sight). The chosen map stays in sight in the list with about one and a half items above and below it. `look="version1"` on the include leaves the block out: the look before (the styles page uses it, so its
  styles keep the base they were made on).
  `look="panel"` (user, 2026-11-10: "apply newest default to mreg-atlas"): Default Panel of the styles experiment (Default
  in its picker; MINERVA's thin lines, no frame, the panel's column always there), in a block of its own in place of
  Default Next's, copied from the styles' `default-lines-base.css` and `default-panel-base.css` (picker rules left out). A
  change to Default Panel in the styles is copied here by hand. The demo keeps Default Next; first site: mreg-atlas. With a site's footer, the lines down the page meet the footer's line as they meet the header's (user, 2026-11-11: the site's margin over the footer left a gap; the styles page has no footer).
  `look="icon-row"` (user, 2026-11-12: "apply this to MREG website"): Default Icon Row of the styles experiment, the same
  Default Lines rules as `look="panel"` (shared block) with the styles' `default-icon-row-base.css` in a block of its own
  (icon row, Icons Top or Left in Settings, Open in within Downloads, no Info or Legend tab). A change to Default Icon Row
  in the styles is copied here by hand. First site: mreg-atlas (in place of `look="panel"`).
- Menu (user, 2026-11-10, as in Claude's app; `--m2-menu: 1`, off in the viewer's own look): two rows at the top of
  the list, Search with a magnifying glass and Downloads with the download sign, in place of the search field and the
  download buttons, so the room under the map goes to the map. Search turns into the search field in its own place, the
  magnifying glass kept (user, 2026-11-10: in place, not below); Esc, or leaving it empty, turns it back into the row; Downloads opens a menu built from the download row. The map window's height dragged by the reader is kept apart for the menu, so the room it frees is the map's. With the menu the separator under the map has no row to put out of sight: the map is dragged taller than the window, up to twice its height, the page scrolling while the pointer is held at the window's bottom edge (user, 2026-11-10: it was stuck there). First in the styles' Default
  Code Downloads and Default Downloads.
- Icon column (user, 2026-11-11, from MINERVA's, narrower; `--m2-icons: 1`, off in the viewer's own look): a 44 px
  column of small icons at the page's left edge, each opening its window in the list's place, one at a time, in this
  order (user, 2026-11-11; Info moved last, under Settings, as About at the bottom of a website, user the same day), Maps open at the start: Info (the whole project briefly, as MINERVA's: its name, `about=` on
  the include or the site's description, how many maps; not the map, whose name and text stay under it: user, 2026-11-11),
  Search (the field with the cursor in it, the results under it and nothing else, no Maps list repeated), Maps (the
  list; going back to it empties the search), Downloads (the map's files as links, the download row under the map
  gone), Open in (Newt, MINERVA: the outside viewers, not repeated in Downloads); in both full-width buttons, 28 px tall (36 too long, user) with a light
  grey edge, easy to click (user, 2026-11-11; plain links before), no sign on each (user). Legend (user, 2026-11-11), after Open in, for now three signs side by side (2026-11-11, from five: 6 filled
  squares, MINERVA's with 6 in place of 8, and 6 dots, each over a line; 8 dots, 4 and 6 empty squares dropped; then 4 empty squares back, user: "C is nice", further apart than first, tried at gaps 4.6 to 2.4 of 24; kept: C2, squares of 6 at gap 2.8, its line 1.5 wider than the squares on each side, as the first C (user: "looks nice"); C3 and C3.5 dropped; more versions in the icon board's collection Legend, from which lg74, a triangle and a circle over two squares, was tried after C2 and taken out, user), each opening SBGN's PD learner's reference card
  (https://sbgn.github.io/learnerscards, CC0; `images/legend/`: since 2026-11-11, user, the Full legend map of https://mreg-atlas.github.io/atlas/, the card's GraphML drawn by the yEd renderer with its typos corrected, 134 KB; before, the SVG from its PDF of 2020 by pdftocairo, 1.4 MB, with the typos) in a window over
  the page as Claude's pop-ups (too wide for the left window), loaded quietly with the maps after the nearest five (only
  where the icon column shows), so it opens at once (user, 2026-11-11), or at the first opening if that comes sooner; closed by its icon, the cross,
  Esc or a click outside; `copy-to-site.sh` copies the card. The user will arrange its groups for the screen (user, 2026-11-11). Later (user, 2026-11-11: "let's have it as a map
  where we could actually modify the view"): the legend as a map of its own, a GraphML or CellDesigner file drawn by the
  renderers and shown with the map window's zoom and pan, so it is edited in yEd or CellDesigner like any map; the card's
  GraphML is on the same SBGN page (pdlearnerscard.graphml). First tried on https://mreg-atlas.github.io/atlas/ (user, 2026-11-11): the card split by its sections into six maps, the list's group Legend; the Legend window here still shows the card's picture. Two legends, one switch (user, 2026-11-11): the window has SBGN and CellDesigner tabs and opens on the one that suits the map (each map's entry has `legend`, sbgn for a GraphML map and celldesigner for a CellDesigner one; a site whose index.json lacks it opens on SBGN), the reader switching inside. The CellDesigner legend is MINERVA's legend (the AsthmaMap's) drawn again in CellDesigner in our colours (built in the workbench's `legend-cd/`): its maps are a group of the Metabolism Regulation Atlas only, never of the demo, which shows only the official site's maps (user, 2026-11-11: the demo's group Legend CD removed); the full legend's drawing is the fixed file `images/legend/celldesigner-legend.svg` for the window, refreshed by hand from the workbench's `legend-cd/site/atlas-downloads/legend-cd-full.svg`. Every icon stays whatever the map (user: the Open in
  icon looked missing on maps with no outside viewer); its window says when it has nothing. Symbols (the SBGN glyphs and arcs) was tried the same day and taken out until a legend is ready
  (user: "when ready, not now"); its code is in commit 6b3ba4b. A click on the open window's icon or its cross closes
  it and the map takes the room; the window's width is the list's (its separator). Wide windows only. First in the
  styles' Default Icon Column. The icons 40 px with 23 px signs in a soft grey at rest (user, 2026-11-11: "a bit larger,
  more comfortable, also grey-ish"), the accent fill with a white sign under the pointer and while open (user: the grey
  not meant for the selection); the column 52 px. Window titles regular, no bold (user, 2026-11-11: none anywhere). The buttons in Downloads and Open
  in are the page's download buttons (4 px 10 px, `--m2-radius-button`, `--m2-button` edge and text) at full width, the
  accent fill under the pointer, never a light tint (user). The column itself collapses: dragging the list's separator
  out of sight takes the icon column with it (also dragging it 20 px further left once the list is closed), a click on
  the separator brings both back; the icons and the cross close only the window (user, 2026-11-11: "do not frozen left
  column, it should be removable, collapsible too"); kept in the reader's browser. Settings (user, 2026-11-11), a gear after Open in with Info under it, evenly spaced with the others (user, 2026-11-11: a 12 px gap
  before Settings removed; at the column's foot the two fell below the window on a tall page): Map size, what 100% is for every map (a slider of five steps, 75, 90, 100, 125, 150%, the value beside its name, no explaining text (user, 2026-11-12: intuitive); six buttons until 2026-11-12, user: visually noisy; the reading size and the cap of the
  whole-map view follow it, the % shown is against it), kept in the reader's browser (`atlas-map-size`); Maps open (whole map or at map size) was there too
  until 2026-11-12 (user: the Fit/Read button over the map is the same choice, still kept as `atlas-view`). Groups in the list (user, 2026-11-12), Open all or Close all, first in Settings (user: used most), shown only when the list has groups; the button matching the list's state is marked, none when mixed; kept as the groups closed by hand are (`atlas-closed:`). Annotations,
  Left or Right (user, 2026-11-11; Right the default; only with `--m2-nav-float`, `atlas-info-side`): on the left, as in
  MINERVA, the panel takes the floating window's place at its width, the window under it out of sight until the panel
  closes, an icon closes the panel and shows its window, the right side stays free; the drawing shifts right only if the
  chosen item would be under it. The one case that needs both, stepping through search results, goes back by the Search
  icon (the results are kept). With the icon column the list is never narrower than 160 px: under it, it closes (user: "two narrow things, not nice"); the buttons 8 px apart.
- Icon row (user, 2026-11-11: "the place for icons is on the top of left panel"; `--m2-icon-row: 1`, with `--m2-icons: 1`,
  off in the viewer's own look): the icon column's icons as a row of tabs at the top of the list's panel (36 px, 21 px
  signs, from the left 6 px apart; a narrower panel drops whole tabs from the right, one by one, user 2026-11-12; so the panel closes only under 90 px, where one tab is left, not at the icon column's 160), the panel fixed beside the map as in the viewer's own look (user: "lets try as in default"), the top bar left
  to the site's name and navigation; the same windows as the icon column. Maps shows the list alone; Search shows
  the field with the whole list under it, filtered as one types (user, 2026-11-11: "search bar appear with the list (not
  just empty long panel)"; a second click on Search takes the field away, emptied, back to Maps, user 2026-11-12, and a second click on any other
  tab but Maps goes back to Maps too, user the same day; until then the field stayed over the list with no Search tab), one Legend sign (C2), no window title (the tab shows it); a click on the open tab keeps it, the separator
  closes the panel. Annotations on the left (Settings) open as one more tab of the panel (the panel opened if closed),
  no tab highlighted; its cross or any tab goes back. First in the styles' Default Icon Row.
- Map colours (user, 2026-11-12, in Settings after Map size): File (the colours in the map's file, the default), Grey or
  Steel, kept in the reader's browser (`atlas-map-colours`), for every map; shown only for a map whose entry has
  `colours` (its picture drawn with the role classes). The renderers write each fill's role beside its colour (yrender
  and cdrender `CLASSES`, set by build.py and the editor; off by default, so their copies elsewhere draw byte-identical);
  a scheme is a `<style>` put into the picture's text in the browser, no second picture per map. Downloads keep the
  file's colours. Roles as the official site's /colours/ page (compartment, complex, protein, hlProtein, metabolite,
  gene, white); a scheme's code is that page's (Steel is its preset Mono steel). CellDesigner compartments keep their
  colours (their lines are drawn in it). Grey is meant as the quiet base for the Overlays tab to come.
- Icons on top or on the left (user, 2026-11-12: "vertical bar vs horizontal is simply a choice in settings";
  `--m2-bar-choice: 1`, with the icon row, off in the viewer's own look): Settings gets Icons, Left or Top (in this order, user 2026-11-12; kept in the
  browser, `atlas-icon-bar`); Left puts the same tabs in the icon column at the page's left edge, with the row's
  behaviour (Search with the list, a second click on Search back to Maps, the open tab kept, annotations on the left as
  a tab, no window title: class `m2-bar-tabs`) and the column's 160 px minimum. First in the styles' Default Icon Row.
- Open in within Downloads (user, 2026-11-11: "remove external (add them to downloads)"; `--m2-dl-ext: 1`, with the
  icons, off in the viewer's own look): the Newt and MINERVA links under a line at the end of the Downloads window, and no
  Open in icon; each with the outside sign on its right (user, 2026-11-11: "newt minerva buttons with external link symbol"). The window always holds them (class `m2-x`), shown only with the setting, so a style loaded after the map
  turns it on. First in the styles' Default Icon Row.
- Floating list (user, 2026-11-11: "when list appears it should not modify the usable window, a temporary panel that
  eventually will go away"; `--m2-nav-float: 1`, with the icon column only, off in the viewer's own look): the icon
  column's windows (Maps, Search, ...) slide in over the map's left side, as tall as the map window, with their
  separator on their right edge; the map window keeps the whole width from the icon column to the page's edge, so nothing
  moves when a window opens or closes, and a map not yet zoomed or panned is fitted again when that width changes (a
  small map stays centred in the whole width). First in the styles' Default Icon Column, with the floating panel below.
- Floating panel (user, 2026-11-11: the map should not move when the panel appears; `--m2-info-float: 1`, off in the
  viewer's own look): the molecule's panel as a card over the map's right side on wide windows too, sliding in; the
  drawing shifts left only when the card would cover the chosen item. First in the styles' Default Icon Column.
- Edit (user, 2026-11-12: moving things a little here and there, as in yEd; its purpose is layout only, moving by hand
  where needed: no resizing of nodes (their sizes are standard), no new items or links, user 2026-11-12; compartments are
  containers and the exception, resizable (user, 2026-11-12); GraphML first, then the same rules for CellDesigner
  maps within CellDesigner's constraints; `--m2-edit: 1`, with the icons, off in the
  viewer's own look): a pencil tab right after Maps (user, 2026-11-12: "after list and only then everything else"; was before Settings) opens the Edit window: at its top the tools as a row of signs (user,
  2026-11-12, after yEd's toolbar: "not as words but as normal symbols", a few now and more as needed): Undo, Redo, a thin
  line, Grid and Snap to grid (a magnet), the plain grey signs of the tabs, a switch that is on on a light grey square (the sign kept its usual grey, user 2026-11-12: the darker one too dark) as
  yEd's, wrapping onto more lines in a narrow panel (user, 2026-11-12: they were cut off on the right); below, Save and Stop editing (Open file, a yEd GraphML from the computer, removed: user, 2026-11-12, not needed outside the Atlas; in the history); the tab starts editing the map shown at once and follows the map chosen, and shows only on a map drawn from its GraphML (or while a file is edited or has moves not saved; user, 2026-11-12). Moves only: a node or a bend point
  dragged (a group with what it holds, and the bends of arcs inside it; a bend alone stays put when its nodes move, as
  in yEd), the first click selects and a drag moves only what is selected already (user, 2026-11-12, as yEd: "first click selects an item, and second click drags it"; the plan: mimic yEd's behaviour in general), Shift with a drag moves the whole map from anywhere, over a node or a compartment too (user, 2026-11-12: not in yEd, wanted), Shift with a click adds to the selection, a plain drag on empty space selects an area and the map moves with two-finger scrolling (the right drag taken out, user 2026-11-12: a right click opens the viewer's menu as everywhere), a pinch or Ctrl/Cmd with the wheel zooming, as in yEd's Edit mode (user, 2026-11-12: "yed way"; until then a drag on empty space moved the map and Shift selected an area), arrow keys move by 1 (Shift 10), Ctrl or Cmd
  with Z undoes, with S saves; a drag on empty space pans as before. Only the x and y of what moved change in the
  file's text, the rest byte for byte; the yEd renderer runs in the browser by Pyodide (the converter page's version,
  `renderers/yrender/yrender.py` published for it) and draws the map again, so the editor draws nothing of its own.
  A map of the site saves by itself (user, 2026-11-12: "as in Google Docs"): no Save button; 3 s after the last move,
  undo or redo, the map's source `maps/<file>.graphml` is committed to the site's own repository (`<owner>/<owner>.github.io`,
  from the address) through GitHub's contents API, with a fine-grained token the user pastes once in the Edit window
  (kept in that browser's localStorage, `atlas-edit-token`; Disconnect from GitHub removes it: a quiet grey line at the
  window's end, no button look or hover, user 2026-11-12); the build redraws it and the page swaps
  the new version in by itself (index.json checked every 30 s). The grey how-to starts with what the editor is for (user, 2026-11-12;
  blue and a sentence on what it does not do tried and taken out): "This tool is designed for improving the layout of a map." The message after a save gives no clock time (user, 2026-11-12:
  "why would I need that"): "Saved. In about 2 minutes it is on the site, and this page updates by itself." Editing starts from the repository's version and its sha,
  so a file changed on GitHub meanwhile is never overwritten: saving stops and says so. A map not in the site's repository
  is saved to a place chosen once (Chrome, Edge), else as a download. Editing starts on the picture as it
  is, with no redraw and the map not moved (user, 2026-11-12: "exactly as I see it and immediately start editing"): the
  frame of yEd's coordinates is read from the site's SVG; the renderer loads quietly meanwhile and draws only after a
  move. Silent (user, 2026-11-12): the Edit tab is the switch, no Edit this map or Stop editing; any other tab, or the
  panel closed, ends editing. After it the edited drawing stays on screen until the site's build of the map catches up,
  across a reload too (user, 2026-11-12): the last saved drawing per map in that browser (`atlas-edit-kept`), dropped once The kept drawing waits for the build of the file saved last: index.json carries each map's `src`, its source's git blob sha, compared with the sha GitHub gave the save (a build of an earlier save no longer replaces it). While editing the picture draws past its frame (`overflow: visible`), so a node moved beyond the old edge is not cut off before the redraw. The build workflow starts again from the newest main when a save came in meanwhile, never rebasing built files.
  the site's version of the map changes, or after an hour. The click data follows (user, 2026-11-12): the site's boxes
  are matched to the nodes of its own version and moved to where the edited drawing has them, so a click and the
  search find a moved molecule where it is drawn. The selection as yEd shows it (user, 2026-11-12: "i was wrong about silent
  selection - see how it is in yEd", replacing nothing drawn at rest): a node selected in a light grey (#d2d2d2 multiplied,
  user: lighter, as yEd's) put into the drawing right over the node's own shape, so its contents, arcs and labels stay on
  top (a compartment as yEd shows it), with eight small black handles round its box (in the map's units, so they grow and shrink with the zoom as yEd's:
  5 units, centres 3.3 units outside the box; the squares on an arc the same 5 units; user, 2026-11-12); an arc clickable and selected as in yEd,
  shown by black squares on its bend points and on its two ports, where it starts and ends (user, 2026-11-12, replacing a
  blue highlight under the line); a bend point selected alone shows four small black squares round it, the lines seen in the gap between them (user, 2026-11-12, as yEd: squares 4 units, gap 2 units); among bend points close together a press takes the one selected, then one of the arc selected (user, 2026-11-12: select the arc, see its bends, then click the bend wanted), else the nearest (user: a nearby bend was dragged);
  arcs following a drag keep their rounded bends, drawn as the renderer rounds a smoothed arc (user, 2026-11-12: no sharp corners while dragging); an arc grabbed anywhere and dragged makes a new bend point there and drags it (user, 2026-11-12, as yEd; was: moved its
  bends), written into the file as yEd writes a y:Point (a y:Path closed in itself opened), one undo step, nothing made
  when dragged back to where it started; a click on an arc still only selects it. With nothing selected the map looks as the original diagram. A drag moves the item
  itself (user, 2026-11-12: "in an editor, it's already there when you move it"): the editor's drawing is put in the page
  as SVG with each node and arc in a group of its own (the renderer's methods wrapped in the editor's Python, the
  renderer itself unchanged), shifted while the drag runs; an arc with one end or some bends moving is drawn as plain
  lines following the pointer until the renderer has drawn the map again (under a second). Until that drawing is in the
  page (just after editing starts) a dashed outline shows where a drag goes. Guides for a bend point (user, 2026-11-12,
  as yEd's for an L-shaped bend): the bend pressed snaps (6 px on screen) when one of its two segments is nearly level or
  upright, and each segment so lined up is drawn as a thick grey line while the drag runs. A press whose release never comes (a right
  press: a two-finger click or Ctrl with a click on a Mac opens the context menu) no longer leaves the map following the
  pointer (user, 2026-11-12: "sticky hand"): the viewer pans with the left button only and ends a drag once no button is
  held; a press that moves nothing leaves the arcs as the renderer drew them (a smooth bend had turned sharp). A save GitHub refuses because
  the branch moved (the site's build commits after each save) goes again when the file there is still the one last saved.
  Guides for nodes (user, 2026-11-12: "use as in yEd, then I correct"), yEd's snap lines: the node pressed snaps when one
  of its own arcs' end segments turns level or upright (thick grey, as a bend's), its centre lines up with another node's,
  a side with the same side of another (opposite sides only within 40 units), midway between the nearest nodes on each
  side (marks on the two gaps), or the drag is nearly straight across or down; each axis on its own, 6 px on screen, the
  smallest correction wins (near ties: that order), thin grey lines for centres and sides reaching 20 units past the
  nodes; only nodes in sight, not its own compartments; Ctrl or Alt held, no snapping. Not yet: the set node to node and
  node to arc distances (yEd's manual gives no default), bends snapping to node centres.
  Compartments (user, 2026-11-12: "compartments I consider like container nodes, so they should be flexible and
  resizable"; complexes not, Pack keeps them): a drag on a compartment's edge (5 px on screen; a corner takes two sides)
  or on a handle of one selected resizes it, the cursor a resize arrow over it; a bend point or a node there comes first.
  It never gets smaller than what it holds (its members, Insets and own top or bottom label, the layout skill's room()),
  20 units at least, its edge on 8 units with Snap to grid. A compartment also grows by itself when something it holds
  is moved past its margin (a drag or the arrow keys), never shrinks by itself; the compartments round it grow in turn,
  innermost first. Both are drawn at once while the drag runs (the outline and the label follow), and after it
  `tidy.py` 'fit' writes the exact boxes and the BorderInsets of the compartments touched (and of complexes round a
  node moved), so yEd keeps the boxes; one undo step with the move.
  The layout skill's tools in the editor (user, 2026-11-12: reuse its code, no AI): a copy of its `complex_pack.py` and
  `snap_grid.py` in `renderers/layout/` (each starting with a line naming the skill's commit; refreshed with
  `sh renderers/layout/get_layout.sh <clone of the skill>`, never edited here), run in the browser by Pyodide through
  `renderers/layout/tidy.py`, which writes back only the attributes they change, the rest byte for byte; one undo step.
  Snap the whole map to the grid (the dotted square after the magnet): `snap_grid.snap`, complexes packed first, rows
  and columns kept, compartments fitted. Pack (after it; its sign a complex with cut corners holding two proteins stacked, the proteins 2:1 as the default 80 by 40 and the complex in the packing rules' proportions (gap a little wider to stay clear at this size), the same size and line as the other signs (the tools now at the tabs' 21 px and line 1.6: before, 20 px with 1.8, about 10% heavier), a little larger inside its square: user, 2026-11-12): the complex selected, or the one round
  a member selected, packed by `complex_pack` (its arcs' ends and the groups round it fitted), every complex when nothing
  is selected. The code is
  `_includes/atlas-edit.js`, included by the viewer's script (copied to the sites with it, off there). Checked
  2026-11-12 on eNOS: first drawing about 4 s, a redraw after a move under a second, the saved file differing from the
  original only in x and y values. Not yet: CellDesigner files, a group growing round a member moved out of it.
- Right-click menu over the map (user, 2026-11-12; `--m2-context: 1`, off in the viewer's own look): shortcuts to what
  the tabs and buttons already do, never the only way to it (phones have no right click). One layer, no submenus (user,
  2026-11-12: the shortcut is for what is aimed for on the page, as downloads and edit; the view, colours, link and the
  other files stay in the viewer's own buttons, the address bar and Downloads): Edit mode (where the Edit tab shows;
  in edit mode View mode in its place, and no molecule rows: right click works everywhere the same way, the right drag
  that moved the map in edit mode taken out, two fingers or Shift with a drag move it; user, 2026-11-12),
  Download GraphML or Download CellDesigner file (the map's source only), Open in MINERVA, Open in Newt (where the map
  has them, to respect the tools already there), Copy image as PNG last (its PNG, else its picture at twice its size, to
  the clipboard: for pasting into a paper or slides); words only, no download or outside-link signs (user, 2026-11-12). Whole map, Reading size, Copy link, Map colours, the other downloads and
  Open in database taken out the same day. Over a molecule, a complex or a reaction, first its kind and name, Show
  annotation, Copy name, Find in all maps (the name in the search), a line, then the same rows. The look of the
  Downloads menu, the accent fill under the pointer; Esc, a click elsewhere,
  the wheel or a resize close it; arrow keys move through it. Shift with the right click gives the browser's own menu;
  the same in edit mode. The page's text, the panel and the list keep the browser's
  menu. First in the styles' Default Icons. Later, when the editor goes on: Align and Distribute on a selection.
- Downloads in the panel's column while no molecule is open (`--m2-dl-panel`, 2026-11-11): tried and removed the same day
  (user: it does not work); its code is in the history.
- Narrow windows (user, 2026-11-09, 940 px and under): the map first, then its download buttons, its name, the search
  and the list (about three maps tall, scrolling inside), then the text and references.
- The renderers: `renderers/yrender/` (yEd GraphML, drawn as yEd draws it) and `renderers/converter/cdrender.py`
  (CellDesigner, drawn as CellDesigner draws it, with the converter's `mapconv/`). cdrender also draws the free texts of a visible layer, the receptor, truncated protein, drug and ion channel (open when active) shapes, the unknown logic gate and a truncation into two (2026-11-11, for the CellDesigner legend). yrender's master is
  here since 2026-11-11 (user): every change to it is made here and checked on the live demo, and its two copies are
  then refreshed, each starting with a line naming the commit: the workbench's (its own script fetches it) and the
  Metabolism Regulation website's `yrender/` (the Colours page, and the images of the eicosanoid, osteoarthritis, ERK and
  expo atlases), the latter after drawing those atlases' maps with both versions (2026-11-11: 938 maps, byte-identical); cdrender's master is here too
  since 2026-11-11 (it had only gained shapes since its copy): the Metabolism Regulation website's `converter/cdrender.py`
  is a copy (its first line and `converter/VERSION`), run by its CD viewer; refreshed after the official CellDesigner
  maps draw the same with both versions (2026-11-11: 21 maps, byte-identical).
- The build: `python3 build.py` turns every file in `maps/` (`.graphml` or `.xml`) into the same output
  (`downloads/`, `atlas-data/`, `_maps/`); its header says what it writes. `maps/<id>.md` gives a map's title, group,
  order and text. The workflow `build.yml` runs it on every push that touches `maps/`, `renderers/` or `build.py`.
- The panel's names, function, location and cross-references come from UniProt, HGNC and ChEBI, citations from
  PubMed, fetched once per identifier into `cache/` (`databases.py`, its header); a map file keeps identifiers only.
- Demo maps are maps already public (the Metabolism Regulation website's official files: since 2026-11-08 the 21 maps of
  its Maps list, each from its CellDesigner file and its GraphML, in the groups CellDesigner and GraphML; glycolysis in
  cardiac muscle, an unlisted page, taken out 2026-11-11, user), never a collaborator's
  unpublished map. Every map has the official site's full download set (user, 2026-11-11: glycolysis first, for comparison,
  then all: "why only two downloads"): `maps/extra/<id>/` (the other source file, GraphML for a CellDesigner map and
  CellDesigner for a GraphML map, SBGN-ML, SBML and the annotation table copied from the official site's `downloads/`,
  the PNG made from the demo's own SVG at twice its size, white background, with headless Chromium) and `newt: true`,
  `minerva:` (the official map's MINERVA project) in its `maps/<id>.md`.
- Every change goes to `main` and is checked on the live demo before a site takes the new version. A site gets the
  viewer as a copy with a VERSION file naming this repository and its commit: `sh copy-to-site.sh <clone of the site>`
  copies only `atlas-app.html` and `atlas-tags.css` and writes the site's `_includes/VERSION`; the site's header, styles
  and pages stay its own. First site: the next Metabolism Regulation version (2026-11-09).
- Hidden from search engines for now (`noindex` in `_config.yml`).
