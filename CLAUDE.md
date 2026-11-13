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
  scroll the page, Ctrl or Cmd with the wheel and a pinch zoom it (a pinch at about seven times the wheel's rate, each step capped, and Safari's own pinch events taken: user, 2026-11-12, "too incremental"); Shift with the wheel scrolls the page from anywhere over
  the map in every style (user, 2026-11-11: the text under the map was reached only from the edges), and over the list's column and the icons too, not the list inside (user, 2026-11-12: "as soon as I hold Shift, I can move the whole page"): user, 2026-11-11, replacing the row put out of sight
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
  (icon row, Icons Top or Left in Settings, Open in within Downloads, no Info or Legend tab; the right-click menu,
  `--m2-context: 1`, since 2026-11-12, user: "update mreg with current default"). A change to Default Icon Row
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
  before Settings removed; at the column's foot the two fell below the window on a tall page): Map size, what 100% is for every map (a slider in 5% steps from 75 to 150%, ticks at 75, 100, 125, 150 (user, 2026-11-12: more steps in between; five steps, 75, 90, 100, 125, 150, before), the value beside its name, no explaining text (user, 2026-11-12: intuitive); six buttons until 2026-11-12, user: visually noisy; the reading size and the cap of the
  whole-map view follow it, the % shown is against it), kept in the reader's browser (`atlas-map-size`); Maps open (whole map or at map size) was there too
  until 2026-11-12 (user: the Fit/Read button over the map is the same choice, still kept as `atlas-view`). Groups in the list (user, 2026-11-12), Open all or Close all, first in Settings (user: used most), shown only when the list has groups; the button matching the list's state is marked, none when mixed; kept as the groups closed by hand are (`atlas-closed:`). Annotations,
  Left or Right (user, 2026-11-11; Right the default; only with `--m2-nav-float`, `atlas-info-side`): on the left, as in
  MINERVA, the panel takes the floating window's place at its width, the window under it out of sight until the panel
  closes, an icon closes the panel and shows its window, the right side stays free; the drawing shifts right only if the
  chosen item would be under it. The one case that needs both, stepping through search results, goes back by the Search
  icon (the results are kept). With the icon column the list is never narrower than 160 px: under it, it closes (user: "two narrow things, not nice"); the buttons 8 px apart.
- Legend signs C4 and C5 on trial (user, 2026-11-13): C2 with its two right squares replaced by a line each, an entity
  and its explanation twice, as a legend reads; C4 keeps C2's line under them, C5 has none (the two rows centred). In
  the icon column after the other Legend signs (the styles' Default Icon Column Legacy); the icon row keeps C2. C4 the
  favourite for now (user, 2026-11-13: "conveys it very nicely"); Legend is still out of the icon row.
- Overlays signs on trial (user, 2026-11-13: "use this legacy space for trying new icons ... we are missing icon for
  overlays"): seven candidates in the rail before Settings (`data-win="ovl"`, `data-opt` o1 to o7: two layers, three
  layers, a sheet over a sheet, three values, a network with values, a molecule over a scale, bars), hidden in every
  look; a style shows them (the styles' Default Icon Column Legacy). A click does nothing until Overlays is built; the
  chosen sign then gets the window and the others go.
  O6 (a molecule over a scale) looks right for Overlays, data shown on the map, and O3 (a sheet over a sheet) is kept
  too, maybe better (user, 2026-11-13); O8 (user's idea the same day): O6 without the molecule, four bars in four
  greys, as MINERVA shows several datasets on one molecule (split into equal parts, one per dataset, each in its
  dataset's colour); O9 the same four parts joined in one rounded box, as the split molecule itself; O4 (three values) and O5 (a network with values) removed (user, 2026-11-13); O6 preferred for now, O8 nice (user, the same day); O1 and O2 (stacked
  layers) are MINERVA's sign for Layers, kept in case the viewer gets layers later (user: "for later anyway if needed").
- Icon row (user, 2026-11-11: "the place for icons is on the top of left panel"; `--m2-icon-row: 1`, with `--m2-icons: 1`,
  off in the viewer's own look): the icon column's icons as a row of tabs at the top of the list's panel (36 px, 21 px
  signs, from the left 6 px apart; a narrower panel drops whole tabs from the right, one by one, user 2026-11-12; so the panel closes only under 90 px, where one tab is left, not at the icon column's 160), the panel fixed beside the map as in the viewer's own look (user: "lets try as in default"), the top bar left
  to the site's name and navigation; the same windows as the icon column. Maps shows the list alone; Search shows
  the field with the whole list under it, filtered as one types (user, 2026-11-11: "search bar appear with the list (not
  just empty long panel)"; a second click on Search takes the field away, emptied, back to Maps, user 2026-11-12, and a second click on any other
  tab but Maps goes back to Maps too, user the same day; until then the field stayed over the list with no Search tab), one Legend sign (C2), no window title (the tab shows it); a click on the open tab keeps it, the separator
  closes the panel. Annotations on the left (Settings) open as one more tab of the panel (the panel opened if closed),
  no tab highlighted; its cross or any tab goes back. First in the styles' Default Icon Row.
- Map colours (user, 2026-11-12, in Settings after Map size): File (the colours in the map's file, the default), then
  Default, Paper and Haze (user, 2026-11-12: the /colours/ page's Default, Paper and frost and Haze and silver; tried and
  removed the same day: Steel, Grey, Moss, Slate (on the /colours/ page as Mono slate), Lilac (no purple on maps), Shore,
  Pebble); a
  few to be chosen with more care later; no red highlight in any scheme, highlighted proteins in the protein colour, only
  File keeps the file's red); shown in one row where the panel is wide enough, each its name with small squares of its protein and metabolite colours on its right (under it first, user 2026-11-12) (File also its red), the chosen one filled
  as the other buttons, the others with no frame (user, 2026-11-12: the grey frames looked strange) (user, 2026-11-12: compact; tiles with a tiny map took too much room; names shortened: Paper for
  Paper and frost, Moss for Mono moss), kept in the reader's browser (`atlas-map-colours`), for every map; shown only for a map whose entry has
  `colours` (its picture drawn with the role classes). The renderers write each fill's role beside its colour (yrender
  and cdrender `CLASSES`, set by build.py and the editor; off by default, so their copies elsewhere draw byte-identical);
  a scheme is a `<style>` put into the picture's text in the browser, no second picture per map. Downloads keep the
  file's colours. Roles as the official site's /colours/ page (compartment, complex, protein, hlProtein, metabolite,
  gene, white); a scheme's code is that page's (Default, Paper and Haze are its presets Default, Paper and frost, Haze and silver). CellDesigner compartments keep their
  colours (their lines are drawn in it).
- Icons on top or on the left (user, 2026-11-12: "vertical bar vs horizontal is simply a choice in settings";
  `--m2-bar-choice: 1`, with the icon row, off in the viewer's own look): Settings gets Icons, Left or Top, last in Settings (user, 2026-11-12: easy to find there, rarely changed once chosen) (in this order, user 2026-11-12; kept in the
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
  line, Grid and Snap to grid (a magnet), the plain grey signs of the tabs, a switch that is on on a light grey square (the sign #70757a, between the first #5f6368, too dark, and the usual #80868b, too pale; user 2026-11-12) as
  yEd's, wrapping onto more lines in a narrow panel (user, 2026-11-12: they were cut off on the right); below, Save and Stop editing (Open file, a yEd GraphML from the computer, removed: user, 2026-11-12, not needed outside the Atlas; in the history); the tab starts editing the map shown at once and follows the map chosen, and shows only on a map drawn from its own GraphML or CellDesigner file (or while a file is edited or has moves not saved; user, 2026-11-12). Moves only: a node or a bend point
  dragged (a group with what it holds, and the bends of arcs inside it; a bend alone stays put when its nodes move, as
  in yEd), the first click selects and a drag moves only what is selected already (user, 2026-11-12, as yEd: "first click selects an item, and second click drags it"; the plan: mimic yEd's behaviour in general); a connector is different (user, 2026-11-12, checked in yEd): once an arc is selected, its parts (its two ends, its bend points) are dragged with the next press, no click of their own, the arc staying selected. Gestures as in view mode, editing only adds (user, 2026-11-12: two-finger scrolling zoomed in view mode but moved the map in edit mode, "I don't like it"; replacing yEd's way of the same day, where a drag on empty space selected an area, two fingers moved the map and Shift with a drag moved it from anywhere): two-finger scrolling, the wheel and a pinch zoom; a drag on empty space or on an item not selected moves the map; a click selects (on empty space clears the selection); Shift with a drag on empty space selects an area, Shift with a click adds to the selection or takes out; a right click opens the viewer's menu as everywhere; arrow keys move by 1 (Shift 10), as a drag would (user, 2026-11-13: "with hand or with keys should be the same
  way"; the keys moved every anchor point of a CellDesigner reaction at once): with a line selected they move only its
  part last pressed, a bend point, or an end stepped among the node's five places (from the centre to the side the
  arrow points to, from a side the opposite arrow back to the centre), marked by four small squares round it, the line's own square there left out (user, 2026-11-13: as a bend point selected alone); a line
  with no part pressed is not moved by the keys; a bend point moved by the keys stops where a segment turns level or
  upright when a step would carry it past, so the grey guides show (whole steps never met a neighbour at x.5), Ctrl or Cmd
  with Z undoes, with S saves, with A selects all (user, 2026-11-13: every node and line, as yEd; a CellDesigner process glyph is no item of its own). The letters of the shortcuts (E, Z, Y, S, A) are read by their place on the keyboard as well as by the letter, so they work in any layout (user, 2026-11-13: E alone did not switch, Cmd with E did). Only the x and y of what moved change in the
  file's text, the rest byte for byte; the yEd renderer draws the map again in the browser, so the editor draws nothing
  of its own: since 2026-11-13 `renderers/yrender/yrender.js`, the same SVG as yrender.py byte for byte (checked on 607
  maps in the build's, the editor's and the colours page's ways; `tests/yrender-compare.js`, run by the workflow Compare
  renderers on every change), reusing the document the editor read when it is still the text drawn (the reading took
  most of the time). No Python in the editor since 2026-11-13: the CellDesigner side is `renderers/converter/cdrender.js` and `cd_edit.js` (below).
  Measured 2026-11-13 (headless, glycogen muscle and eNOS GraphML, page frozen): switching to edit 270-296 ms with
  Python, 67-129 ms now.
  A map of the site saves by itself (user, 2026-11-12: "as in Google Docs"): no Save button; 3 s after the last move,
  undo or redo, the map's source `maps/<file>.graphml` is committed to the site's own repository (`<owner>/<owner>.github.io`,
  from the address) through GitHub's contents API, with a fine-grained token the user pastes once in the Edit window
  (kept in that browser's localStorage, `atlas-edit-token`; Disconnect from GitHub removes it: a quiet grey line at the
  window's end, no button look or hover, user 2026-11-12); the build redraws it and the page swaps
  the new version in by itself (index.json checked every 30 s). The grey how-to starts with what the editor is for (user, 2026-11-12;
  blue and a sentence on what it does not do tried and taken out): "This tool is designed for improving the layout of a map." The how-to is a popover since 2026-11-13 (user: the long text in the Edit window took the room palettes and new tools need): a "?" after the tools (and the ? key while editing) opens it over the map's left edge, in sections (Move and zoom, Select, Move what is selected, Layout tools, Keys), closed by "?", its cross, Esc or a click outside; never open by itself (user, 2026-11-13: it opened the first time someone edited and was taken out; the switch to edit stays clean, who needs the how-to clicks the "?"). Its one source is `editor/src/help.js`: a tool added or changed gets its line there in the same change. The message after a save gives no clock time (user, 2026-11-12:
  "why would I need that"): "Saved. In about 2 minutes it is on the site, and this page updates by itself." Editing starts from the repository's version and its sha,
  so a file changed on GitHub meanwhile is never overwritten: saving stops and says so. A map not in the site's repository
  is saved to a place chosen once (Chrome, Edge), else as a download. Read ahead (user, 2026-11-13: the switch "immediate and immediately functional"): while a map is only shown where the Edit tab is, its file, the frame of its drawing, with a token the repository's version and sha, the renderer and a CellDesigner file's GraphML are loaded, so the switch to edit waits for nothing; dropped after a save, when editing stops, when the site's version or the token changes; with a token the repository's version is checked again just after the switch. Editing starts on the picture as it
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
  blue band under the line; the line itself drawn blue since 2026-11-13); a first click on a bend point of a line not selected selects the whole line, as a click anywhere on it (user, 2026-11-12: "let's make it consistent"), so a line is always selected first and its bend points moved with the next press; a bend point is selected alone only by an area or Shift with a click, and then shows four small black squares round it, the lines seen in the gap between them (user, 2026-11-12, as yEd: squares 4 units, gap 2 units); among bend points close together a press takes the one selected, then one of the arc selected (user, 2026-11-12: select the arc, see its bends, then click the bend wanted), else the nearest (user: a nearby bend was dragged);
  arcs following a drag keep their rounded bends, drawn as the renderer rounds a smoothed arc (user, 2026-11-12: no sharp corners while dragging); an arc grabbed anywhere and dragged makes a new bend point there and drags it (user, 2026-11-12, as yEd; was: moved its
  bends), written into the file as yEd writes a y:Point (a y:Path closed in itself opened), one undo step, nothing made
  when dragged back to where it started; a click on an arc still only selects it. With nothing selected the map looks as the original diagram. A drag moves the item
  itself (user, 2026-11-12: "in an editor, it's already there when you move it"): the editor's drawing is put in the page
  as SVG with each node and arc in a group of its own (the renderer's methods wrapped in the editor's Python, the
  renderer itself unchanged), shifted while the drag runs; an arc with one end or some bends moving is drawn in full as
  it goes (user, 2026-11-13: "the line should be drawn in full during drag ... it should feel quite natural"; plain grey
  lines before): a copy of the renderer's own group of that arc, so its colour, width and dashes stay, its line through
  the new places and what is drawn at each end (arrowhead, circle, bar) carried to that end and turned as its end segment
  turned; the original hidden, the copy kept after the release until the renderer has drawn the map again (under a
  second), so nothing jumps. Every point of the copy goes with the segment it lies nearest to (within 15 units of a
  segment's end it keeps its distance from that end, else its share of the segment), so a line drawn in two pieces or a
  mark midway stays on the line (user, 2026-11-13: a short second line showed beside a CellDesigner reaction). A
  CellDesigner glyph following its segment also turns with it, and the lines meeting it turn with it: an added reactant
  or product at its share of the segment, a modifier at its spot round the glyph, as cd_edit places them. The same for the arrow keys. Plain lines only before the editor's drawing is in the page. Until that drawing is in the
  page (just after editing starts) a dashed outline shows where a drag goes. Guides for a bend point (user, 2026-11-12,
  as yEd's for an L-shaped bend): the bend pressed snaps (6 px on screen) when one of its two segments is nearly level or
  upright, and each segment so lined up is drawn as a thick grey line while the drag runs. On a CellDesigner map (user, 2026-11-13) a
  reaction is one line through its glyph ("in cell designer concept, it's a single line"): a segment ending at the glyph
  is lined up with the next anchor point or port past it, the guide running through the glyph to it; and a line meeting
  the glyph (an added reactant or product, a modifier) gets its guide too, the bend snapping (by hand) or stopping (by
  the keys) where that line turns level or upright as the glyph follows its segment. A press whose release never comes (a right
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
  `sh renderers/layout/get_layout.sh <clone of the skill>`, never edited here) with `renderers/layout/tidy.py`, which
  writes back only the attributes they change, the rest byte for byte; one undo step. In the browser they run as
  `renderers/layout/layout.js` (2026-11-13): the three in JavaScript, the same text as the Python byte for byte (checked
  on 1,006 maps of the demo, the workbench and the official site, 5,158 runs: Snap, Pack all and chosen, the fit after a
  move and after a resize, CellDesigner maps with their ports kept; `tests/layout-compare.js`, run by the workflow Compare
  renderers). A new copy of the skill's scripts or a change to tidy.py is made in layout.js too and the comparison run;
  tidy's master is layout.js since 2026-11-13 (user), complex_pack and snap_grid keep theirs in the skill (Python, used by
  its other scripts). No Python in the editor since 2026-11-13. Measured 2026-11-13 (headless, page frozen, glycogen muscle and eNOS GraphML):
  page open 2.3-2.7 s from Python's start before, none now; a move 357-362 ms, now 113-130 ms; Snap map to grid 463-604
  ms in Python, 135-217 ms now.
  Snap the whole map to the grid (the dotted square after the magnet): `snap_grid.snap`, complexes packed first, rows
  and columns kept, compartments fitted. Pack (after it; its sign a complex with cut corners holding two proteins stacked, the proteins 2:1 as the default 80 by 40 the complex 17 by 18 with room round them (option 4 of six, user 2026-11-12; 5 also liked: 18 by 18), the same size and line as the other signs (the tools now at the tabs' 21 px and line 1.6: before, 20 px with 1.8, about 10% heavier), a little larger inside its square: user, 2026-11-12): the complex selected, or the one round
  a member selected, packed by `complex_pack` (its arcs' ends and the groups round it fitted), every complex when nothing
  is selected. The code is
  in `editor/` (user, 2026-11-13: out of the viewer's file, loaded only where the Edit tab is): `editor/src/core.js`
  (selection, drags, guides, grid, undo, saving: one code for both formats, a CellDesigner map being edited as cd_edit's
  GraphML), `editor/src/graphml.js` (the yEd redraw, the shift out of negative places, compartment outlines while
  dragging) and `editor/src/celldesigner.js` (Pyodide with cd_edit and cdrender, the process glyph, guides through it,
  the canvas left out), joined by Jekyll into `editor/editor.js` in one scope (`include_relative`; no Liquid in the
  sources). The viewer loads it once its style turns `--m2-edit` on (`editorLoad`) and hands it `V`, getters and setters
  of the viewer names it uses (z, tx, ty, current, img, ...); a site or style without the Edit tab loads nothing. The
  edited drawing kept until the build catches up (`keep`, `boxes`, `atlas-edit-kept`) stays in the viewer, needed before
  any editor loads. `editor="..."` on the include gives the folder (the styles: `/styles/editor/`); `edit="layout"` is to
  keep a site to the layout tools once drawing exists ("full" the default; user, 2026-11-13). The sites get `editor/`
  with `copy-to-site.sh`, off there. Split checked 2026-11-13: the same actions (keys, a drag, Pack, Snap map to grid,
  undo) on the frozen editor of the styles (Default Edit V1 Python) and the split one gave the same drawing on
  Glycolysis and phosphoinositides GraphML, glycogen muscle and SREBP CellDesigner. Checked
  2026-11-12 on eNOS: first drawing about 4 s, a redraw after a move under a second, the saved file differing from the
  original only in x and y values. Not yet: a group growing round a member moved out of it.
  CellDesigner maps (user, 2026-11-12: "basically yEd experience with CD", for fixing by hand what a conversion from
  GraphML leaves): the same editor, the same tools and look; `renderers/converter/cd_edit.py` (its header says how) gives
  the editor the file as GraphML (compartments, complexes and aliases as groups and nodes, each process glyph a 10 by 10
  node, each line an arc, edit points absolute) and writes what changed back into the CellDesigner text, only the
  numbers that change (bounds, the place inside the parent, a compartment's name, edit points, rectangleIndex and the
  line directions, the canvas grown past its right or bottom edge), so it opens in CellDesigner as before; cdrender
  draws it in the browser with `GROUPS` on. Bend points stay where they are when a node moves (user, 2026-11-12: yEd's
  way, not CellDesigner's stretching); the process glyph is not an item of its own, as in CellDesigner (user, 2026-11-12: "it's not selectable ... it's part of the link"): a click on it selects its reaction as a click on its main line does, no node handles, an area never takes it; it is never moved by itself (user,
  2026-11-12: "in Cell Designer, it's not possible to move process itself"; a drag on it moves the map, the arrow keys
  leave it, it goes only with a group holding its whole reaction), and no bend point is ever added to make up for a move
  (user: "no bend points automatically appearing"; before, a glyph moved took its segment and its ends at nodes became
  new bend points); anchor (bend) points come only from the user, by dragging a line as in yEd or by Add anchor point in the right-click menu over a line (user, 2026-11-13; put where the click was, the line selected, never on the process glyph; GraphML maps too), and go by Delete or Backspace on a selected one or Remove anchor point in the right-click menu over one (user, 2026-11-13; GraphML maps too, as yEd's Delete); the reaction is CellDesigner's own model (user, 2026-11-13): its main line's ends and anchor points, the square midway on segment rectangleIndex (an anchor point put before it moves the square to the segment after), added reactants and products at 3/8 and 5/8 of that segment, modifiers at the square's spots, worked out live and when saving from the same numbers; the glyph stays midway on its segment, and follows
  it during a drag or a held arrow key, its lines drawn live (user, 2026-11-12: it jumped there only on release; the
  editor reckons the middle as cd_edit does, so the glyph does not jump when the map is drawn again). Saved to
  `maps/<file>.xml`. Pack and Snap map to grid on CellDesigner maps too (user, 2026-11-13: "complex repack and snap to
  grid in Cell Designer"): the layout skill's scripts run on cd_edit's GraphML, which carries each complex's name as an
  inside bottom label (its height as cdrender writes it) and the residue circles, structural states and open unit of
  information round an alias as state labels, so Pack leaves them room as on a yEd map; every line keeps its connection
  point (tidy.py `keep_ports`: CellDesigner moves it with the node, and snap_grid's straightened ports had turned ENE into
  E); cd_edit writes back the bounds, inner positions and anchor points that changed. Checked on the 21 demo maps (both
  tools, the files read back, no connection point changed). Not on CellDesigner maps: the live
  outline of a compartment resized (it is redrawn after the drag); logic gates, associations and dissociations are left
  as they are (none on the demo). Checked 2026-11-12: all 21 demo maps written back byte for byte with no move, every
  process glyph where cdrender draws it, 259 moves leaving every bend point in place, live on SREBP (a molecule, a glyph,
  the save simulated: only the moved numbers changed).
  No negative places, both formats (user, 2026-11-12: "negative coordinates in cd are bad", "lets have it universally
  corrected"): a map with something drawn left of or above 0 is shifted right or down, each axis on its own, by whole
  blocks of the grid (16, so a map on the grid stays on it) to start at 40 or a little more; the picture stays still on
  screen. GraphML: in the editor before each drawing (what is drawn counts, a closed group's kept size does not; all
  moves); 15 of the 21 demo GraphML maps start with negative places, so their first save shifts every place once.
  CellDesigner: `cd_edit.place`, the canvas growing with it, free texts and logic gates shifted too. Checked live on
  SREBP in both formats (save simulated). The shift moves the editor's own frame with it, so nothing moves on screen
  when Edit is pressed (2026-11-12: it was taken for a new frame of the drawing, and maps with negative places jumped
  right and down, carnitine out of sight; no file had been shifted by it). The edited drawing kept after editing, and the start of
  the next editing, take the picture's frame against the file saved: 0, 0 for a CellDesigner map, whose file already
  holds the shift (2026-11-12, user: back in edit mode after a node moved past the edge, the map jumped by the shift).
  The white canvas of a CellDesigner drawing is left out while editing, so the grid runs on as on a GraphML map (user,
  2026-11-12: "like an endless space"); the file keeps its canvas size, the view mode is unchanged. Its white halos
  under the lines (CellDesigner's, so crossings read) are hidden while editing too (user, 2026-11-12: without the canvas
  they cut round-ended white strips through the grid and the compartments). On a CellDesigner map the square marks
  (bend points, ports, node handles) are magenta, as CellDesigner's, black on a GraphML map (user, 2026-11-12: "this way
  I will know while editing that it's CD"); a selected line is CellDesigner's selection blue #1437ff (user: the
  first blue looked pale on a thin line). A selected compartment keeps its grey fill over all of it (user, 2026-11-12).
  Arrow keys: a held key shows the move on the drawing as it goes, as a drag (user, 2026-11-12: it showed only on
  release), and a bend point selected alone gets the grey guides while one of its segments is exactly level or upright,
  no snapping (user: as in a drag); they go at the next click or Esc. The renderer (Pyodide, lxml and the converter,
  about 6.8 MB) starts quietly 2.5 s after the page shows its map where the Edit tab is, so a CellDesigner map opens
  for editing in about 0.5 s (4.5 s before; user, 2026-11-12); a site without the Edit tab loads nothing.
  A selected line is drawn blue itself, under its squares, in CellDesigner's selection blue #1437ff, on GraphML and
  CellDesigner maps alike: its stroke and filled black heads (a CellDesigner line's own group, not its white halo's; a
  reaction's glyph too), and while it moves the copy following the move. One way only (user, 2026-11-13: "remove
  highlight way completely"; the light blue band under the line, 2026-11-12, and the Settings choice Highlight or Blue
  line are gone: while a line moved, the band was drawn over it). Every mark is in the map's units, so zooming keeps their relative size and
  thickness (user, 2026-11-12): the guides, snap lines, gap marks and crosses 1 but never under 2 screen pixels, all in yEd's #c0c0c0 with a small x at each point a centre or side line refers to, the grid 1 screen pixel on a canvas (user, 2026-11-13, measured from yEd; a selected node darkened x0.70), the squares'
  white edge 0.5, the line drawn while an arc follows a drag 1 (only the area being selected stays in screen pixels). On a
  CellDesigner map a reaction is one item, as in CellDesigner: a click on its main line (reactant to glyph to product),
  its glyph or an added reactant or product lights them all, no squares in the glyph; a modifier is its own item (user:
  not with the reaction, though CellDesigner lights it). A node selected on a CellDesigner map as on a GraphML one, the
  light grey fill and eight black handles (purple tried and taken back the same day, user; CellDesigner's own outline of
  handles not wanted). The fill follows the drawing's frame after a shift out of negative places (2026-11-12: it showed
  one shift away from the node).
  Ports (user, 2026-11-12: "snap to center, bottom center, top center, left center, right center ... These 5 positions are
  quite certain"; other places later): an end square of a lit line, dragged (4 px at least; a click selects the node
  there), snaps to the nearest of the node's centre and the middles of its four sides, shown by a square while the drag
  runs, the line itself drawn in full to it (the original hidden, user 2026-11-13: a second line beside the old one was
  "weird"), with its highlight, and on a CellDesigner map the glyph following its segment's new end; one undo step. GraphML: the port's offset from the centre (yEd's sx, sy or
  tx, ty). CellDesigner: `cd_edit` writes the connection point (the centre: no linkAnchor; N, S, W, E), on the base
  reactant or product, an added one, or a modifier's linkTarget (made after its connectScheme when missing, as
  CellDesigner orders it); bend points stay. A process glyph's ends are not moved. Checked live on SREBP in both
  formats (save simulated).
- Full screen with tools (user, 2026-11-12: "use more space available on the screen, but with tools"): beside the map's
  own full screen (the map alone), the whole page goes full screen with its list, tools and panel: Shift with the
  full-screen button, or Full screen with tools in the right-click menu (Exit full screen there while on). The
  browser's bars go and the map window grows with the screen, as on a resize; Esc returns.
- Right-click menu over the map (user, 2026-11-12; `--m2-context: 1`, off in the viewer's own look): shortcuts to what
  the tabs and buttons already do, never the only way to it (phones have no right click). One layer, no submenus (user,
  2026-11-12: the shortcut is for what is aimed for on the page, as downloads and edit; the view, colours, link and the
  other files stay in the viewer's own buttons, the address bar and Downloads): Switch to edit (where the Edit tab shows;
  in edit mode Switch to viewer in its place, both with their shortcut on the right, ⌘E on Apple and Ctrl+E elsewhere,
  user 2026-11-13, were Edit mode and View mode; and no molecule rows: right click works everywhere the same way, the right drag
  that moved the map in edit mode taken out, a drag on empty space moves it as in view mode; user, 2026-11-12),
  Download GraphML or Download CellDesigner XML (the map's source only; user, 2026-11-12: was "CellDesigner file"),
  Open in Newt, Open in MINERVA (in this order, user 2026-11-12; where the map has them, to respect the tools already
  there), Copy image as PNG (its PNG, at twice the map's size as yEd's export at 2.0, else its picture at twice its size,
  to the clipboard: for pasting into a paper or slides), Copy image as SVG last (user, 2026-11-12: the map's SVG as
  image/svg+xml where the browser can, with its text, so an app taking no SVG image pastes the markup); words only, no download or outside-link signs (user, 2026-11-12). Whole map, Reading size, Copy link, Map colours, the other downloads and
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
  (CellDesigner, drawn as CellDesigner draws it, with the converter's `mapconv/`; `GROUPS` for the editor, off by default, and `cd_edit.py` beside it; the folder is published for the editor, 2026-11-12, user). cdrender also draws the free texts of a visible layer, the receptor, truncated protein, drug and ion channel (open when active) shapes, the unknown logic gate and a truncation into two (2026-11-11, for the CellDesigner legend). yrender's master is
  here since 2026-11-11 (user): every change to it is made here and checked on the live demo, and its two copies are
  then refreshed, each starting with a line naming the commit: the workbench's (its own script fetches it) and the
  Metabolism Regulation website's `yrender/` (the Colours page, and the images of the eicosanoid, osteoarthritis, ERK and
  expo atlases), the latter after drawing those atlases' maps with both versions (2026-11-11: 938 maps, byte-identical); cdrender's master is here too
  since 2026-11-11 (it had only gained shapes since its copy): the Metabolism Regulation website's `converter/cdrender.py`
  is a copy (its first line and `converter/VERSION`), run by its CD viewer; refreshed after the official CellDesigner
  maps draw the same with both versions (2026-11-11: 21 maps, byte-identical).
  JavaScript the master (user, 2026-11-13: "Make JavaScript the master for the viewer's own build and the editor"):
  yrender.js, cdrender.js and cd_edit.js beside the Python are the masters; the build draws with them through Node
  (`renderers/render.js`, started once by build.py; `npm ci` gives its XML parser, `package.json`) and the editor with them
  in the browser. The Python files stay as their twins for the Python tools that use the renderers (the workbench's and
  the official site's copies are taken from yrender.py and cdrender.py, the neuroinflammation scripts import cdrender's
  geometry); a change is made in both in the same commit, and the workflow Compare renderers checks every demo map
  alike. Switch checked 2026-11-13: the build through Node and the Python build gave the same 389 files (downloads,
  atlas-data, _maps, cache, images), byte for byte.
  cdrender.js and cd_edit.js beside the Python (2026-11-13) are their JavaScript twins for the editor, with the converter's
  four helpers they use (the frame maths, anchor points, name decoding) and Python's number writing (repr, round, '%.2f',
  and CPython's exact hypot, which Math.hypot misses in the last bit on a third of pairs; yrender.js uses it too):
  the same text byte for byte on 409 CellDesigner maps of the demo, the workbench, the official site and the
  neuroinflammation map, 2,863 comparisons (the build's drawing and click data, the editor's drawing, cd_edit's GraphML,
  the write-back after moves of nodes, bend points and ports, a whole map shifted); `tests/cd-compare.js`, in the
  workflow Compare renderers. Measured 2026-11-13 (headless, page frozen): a CellDesigner page open 2.3-2.4 s before,
  none now; switching to edit 361 ms on glycogen muscle, 258 now (SREBP 131, now 85); a move about the same (212 ms on
  glycogen muscle: one move still reads and writes the whole file three times).
- The build: `python3 build.py` (Python, its drawings by the JavaScript renderers through Node) turns every file in `maps/` (`.graphml` or `.xml`) into the same output
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
  One more group (user, 2026-11-13: "for testing ... this large map"), AsthmaMap: its mast cell (submap PD01, the user's
  upload, the MINERVA project's source file) and macrophage (AF11, the MINERVA project's current copy with its
  annotation) maps, each from its CellDesigner file and from a GraphML the converter made of it (`maps/asthmamap-*`, each
  with the other format in `maps/extra/`); public maps, kept as large maps for testing the viewer and the editor.
  A new map is pushed with its build (`python3 build.py` locally, then downloads, atlas-data, _maps and cache committed),
  not as its source alone (2026-11-13): the workflow fetches every new identifier first (585 new nodes, about four minutes
  on GitHub's slow runners that day), and while the user's editor saves came in every few seconds each build was
  overtaken and started again, its fetches never kept, so for 40 minutes no build landed.
- Every change goes to `main` and is checked on the live demo before a site takes the new version. A site gets the
  viewer as a copy with a VERSION file naming this repository and its commit: `sh copy-to-site.sh <clone of the site>`
  copies only `atlas-app.html` and `atlas-tags.css` and writes the site's `_includes/VERSION`; the site's header, styles
  and pages stay its own. First site: the next Metabolism Regulation version (2026-11-09).
- Hidden from search engines for now (`noindex` in `_config.yml`).
- Source colours in the list (user, 2026-11-12, made in the source 2026-11-13 after the first version, made only in the
  Atlas site's copy, was lost when that copy was replaced): a map's `source` in the site's index gives its list item the
  class `m2-src-<source>`; curation blue (the accent), omnipath green (`--m2-src-omnipath`), reactome-recon purple
  (`--m2-src-reactome-recon`), the name and a draft tag, white on the chosen map (`atlas-tags.css`).
