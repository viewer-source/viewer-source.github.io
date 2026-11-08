# Viewer source

Public repository: the one source of the atlas viewer every map site uses, and its demo at
https://viewer-source.github.io. Names no private repository in files, pages, code comments or commit messages: it
says "the workbench", "the converter's repository", "a private repository".

- The viewer: `_includes/atlas-app.html` (list on the left, the map, its panel, search, downloads row). It never
  knows a map's source format.
- Two modes (user, 2026-11-08): by default the viewer is a fixed list for reading and reviewing maps, as a published
  site shows them (the next Metabolism Regulation version, for one). `arrange=true` on the include is the mode for a copy
  where maps are being developed: groups and the maps in a group are put in another order by dragging, kept in the
  reader's browser. The demo runs with it on. A site never gets it unless the user says.
- The renderers: `renderers/yrender/` (yEd GraphML, drawn as yEd draws it) and `renderers/converter/cdrender.py`
  (CellDesigner, drawn as CellDesigner draws it, with the converter's `mapconv/`). Where each was copied from:
  `VERSION`.
- The build: `python3 build.py` turns every file in `maps/` (`.graphml` or `.xml`) into the same output
  (`downloads/`, `atlas-data/`, `_maps/`); its header says what it writes. `maps/<id>.md` gives a map's title, group,
  order and text. The workflow `build.yml` runs it on every push that touches `maps/`, `renderers/` or `build.py`.
- The panel's names, function, location and cross-references come from UniProt, HGNC and ChEBI, citations from
  PubMed, fetched once per identifier into `cache/` (`databases.py`, its header); a map file keeps identifiers only.
- Demo maps are maps already public (the Metabolism Regulation website's official files: since 2026-11-08 all 22 official
  maps, each from its CellDesigner file and its GraphML, in the groups CellDesigner and GraphML), never a collaborator's
  unpublished map.
- Every change goes to `main` and is checked on the live demo before a site takes the new version. A site gets the
  viewer as a copy with a VERSION file naming this repository and its commit.
- Hidden from search engines for now (`noindex` in `_config.yml`).
