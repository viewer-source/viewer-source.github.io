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
  change to Default Panel in the styles is copied here by hand. The demo keeps Default Next; first site: mreg-atlas.
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
  GraphML is on the same SBGN page (pdlearnerscard.graphml). First tried on https://mreg-atlas.github.io/atlas/ (user, 2026-11-11): the card split by its sections into six maps, the list's group Legend; the Legend window here still shows the card's picture. Two legends, one switch (user, 2026-11-11): the window has SBGN and CellDesigner tabs and opens on the one that suits the map (each map's entry has `legend`, sbgn for a GraphML map and celldesigner for a CellDesigner one; a site whose index.json lacks it opens on SBGN), the reader switching inside. The CellDesigner legend is MINERVA's legend (the AsthmaMap's) drawn again in CellDesigner in our colours, in the demo's group Legend CD (`maps/legend-cd-*.xml`, built in the workbench's `legend-cd/`): one map per block and the full legend first, whose drawing build.py copies to `images/legend/celldesigner-legend.svg` for the window. Every icon stays whatever the map (user: the Open in
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
  before Settings removed; at the column's foot the two fell below the window on a tall page): Map size, what 100% is for every map (75, 90, 100, 110, 125, 150%; the reading size and the cap of the
  whole-map view follow it, the % shown is against it), and Maps open (whole map or at map size, the same choice as the
  Fit/Read button over the map); both kept in the reader's browser (`atlas-map-size`, `atlas-view`). Annotations,
  Left or Right (user, 2026-11-11; Right the default; only with `--m2-nav-float`, `atlas-info-side`): on the left, as in
  MINERVA, the panel takes the floating window's place at its width, the window under it out of sight until the panel
  closes, an icon closes the panel and shows its window, the right side stays free; the drawing shifts right only if the
  chosen item would be under it. The one case that needs both, stepping through search results, goes back by the Search
  icon (the results are kept). With the icon column the list is never narrower than 160 px: under it, it closes (user: "two narrow things, not nice"); the buttons 8 px apart.
- Floating list (user, 2026-11-11: "when list appears it should not modify the usable window, a temporary panel that
  eventually will go away"; `--m2-nav-float: 1`, with the icon column only, off in the viewer's own look): the icon
  column's windows (Maps, Search, ...) slide in over the map's left side, as tall as the map window, with their
  separator on their right edge; the map window keeps the whole width from the icon column to the page's edge, so nothing
  moves when a window opens or closes, and a map not yet zoomed or panned is fitted again when that width changes (a
  small map stays centred in the whole width). First in the styles' Default Icon Column, with the floating panel below.
- Floating panel (user, 2026-11-11: the map should not move when the panel appears; `--m2-info-float: 1`, off in the
  viewer's own look): the molecule's panel as a card over the map's right side on wide windows too, sliding in; the
  drawing shifts left only when the card would cover the chosen item. First in the styles' Default Icon Column.
- Downloads in the panel's column while no molecule is open (`--m2-dl-panel`, 2026-11-11): tried and removed the same day
  (user: it does not work); its code is in the history.
- Narrow windows (user, 2026-11-09, 940 px and under): the map first, then its download buttons, its name, the search
  and the list (about three maps tall, scrolling inside), then the text and references.
- The renderers: `renderers/yrender/` (yEd GraphML, drawn as yEd draws it) and `renderers/converter/cdrender.py`
  (CellDesigner, drawn as CellDesigner draws it, with the converter's `mapconv/`). cdrender also draws the free texts of a visible layer, the receptor, truncated protein, drug and ion channel (open when active) shapes, the unknown logic gate and a truncation into two (2026-11-11, for the CellDesigner legend). yrender's master is
  here since 2026-11-11 (user): every change to it is made here and checked on the live demo, and the workbench's copy is
  then refreshed (it carries a line naming the commit; its own script fetches it); cdrender was copied from the
  Metabolism Regulation website (`VERSION`) and is not yet the master.
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
