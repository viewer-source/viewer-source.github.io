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
  scroll the page, Ctrl or Cmd with the wheel and a pinch zoom it: user, 2026-11-11, replacing the row put out of sight
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
  column of small icons at the page's left edge, each opening its window in the list's place, one at a time: Maps (the
  search and the list), Downloads (the map's files as links, the download row under the map gone), Symbols (the SBGN
  glyphs and arcs). A click on the open window's icon or its cross closes it and the map takes the room; the window's
  width is the list's (its separator). Wide windows only. First in the styles' Default Icon Column.
- Downloads in the panel's column while no molecule is open (`--m2-dl-panel`, 2026-11-11): tried and removed the same day
  (user: it does not work); its code is in the history.
- Narrow windows (user, 2026-11-09, 940 px and under): the map first, then its download buttons, its name, the search
  and the list (about three maps tall, scrolling inside), then the text and references.
- The renderers: `renderers/yrender/` (yEd GraphML, drawn as yEd draws it) and `renderers/converter/cdrender.py`
  (CellDesigner, drawn as CellDesigner draws it, with the converter's `mapconv/`). Where each was copied from:
  `VERSION`.
- The build: `python3 build.py` turns every file in `maps/` (`.graphml` or `.xml`) into the same output
  (`downloads/`, `atlas-data/`, `_maps/`); its header says what it writes. `maps/<id>.md` gives a map's title, group,
  order and text. The workflow `build.yml` runs it on every push that touches `maps/`, `renderers/` or `build.py`.
- The panel's names, function, location and cross-references come from UniProt, HGNC and ChEBI, citations from
  PubMed, fetched once per identifier into `cache/` (`databases.py`, its header); a map file keeps identifiers only.
- Demo maps are maps already public (the Metabolism Regulation website's official files: since 2026-11-08 the 21 maps of
  its Maps list, each from its CellDesigner file and its GraphML, in the groups CellDesigner and GraphML; glycolysis in
  cardiac muscle, an unlisted page, taken out 2026-11-11, user), never a collaborator's
  unpublished map. One map, glycolysis drawn from CellDesigner, has the official site's full download set for comparison
  (user, 2026-11-11): `maps/extra/<id>/` (GraphML, SBGN-ML, SBML and the annotation table copied from the official
  site, the PNG made from the demo's own SVG at twice its size) and `newt: true`, `minerva:` in its `maps/<id>.md`.
- Every change goes to `main` and is checked on the live demo before a site takes the new version. A site gets the
  viewer as a copy with a VERSION file naming this repository and its commit: `sh copy-to-site.sh <clone of the site>`
  copies only `atlas-app.html` and `atlas-tags.css` and writes the site's `_includes/VERSION`; the site's header, styles
  and pages stay its own. First site: the next Metabolism Regulation version (2026-11-09).
- Hidden from search engines for now (`noindex` in `_config.yml`).
