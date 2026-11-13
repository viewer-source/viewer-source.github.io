# SBGN-ML test collection

SBGN-ML maps made by other people and tools, collected to test the viewer's SBGN-ML drawing against files we did
not produce (user, 2026-11-14). Every file is unchanged, as its source holds it; a test that needs a change makes it
in a temporary copy. Published with the site, so a test page can load a file by its address
(`/tests/sbgn-ml/pd/...`).

- `pd/`: Process Description, the language worked on now (376 files, 50 of them invalid on purpose).
- `af/`: Activity Flow, collected for later (249 files).
- Entity Relationship, hybrid maps, SBML and SIF are left out (user: not needed for now).
- `sources.tsv`: one line per file: language, SBGN-ML version (0.2 or 0.3, from the namespace), glyph and arc
  counts, size, source, repository and commit, its path there, licence, `hidden` when its folder is linked from no
  page of the source's website, a note, and the other places the same file (byte for byte) was found. Identical
  files are kept once.

Notes on the files:

- `invalid on purpose`: libsbgn's validation error tests (`libsbgn/validation/error-test-files/`), each breaking one
  rule; the viewer should draw what it can and not fail.
- One file is malformed as published (`pd/pd2af-website/rules/met-sti/pd.sbgn`, merge-conflict markers).
- `ours: a Metabolism Regulation map`: the pd2af specification's MR maps and the pd2af engine's iNOS example; kept,
  but they are our own maps in an older form, not external.
- `.nwt` is Newt's own file: SBGN-ML with Newt's settings in an extension, read as SBGN-ML.
- Sizes: most files are small cases (median 6 glyphs); the largest are central plant metabolism (1,324 glyphs),
  Reactome's eicosanoids, BCAA and urea cycle diagrams (95 to 232) and the learner's cards (210).

| Folder | Source | Licence |
|---|---|---|
| `sbgn-website` | github.com/sbgn/sbgn.github.io; hidden: `downloads/examples`, `spec_examples`, `spec_images`, `symbols` | CC0 1.0 |
| `libsbgn` | github.com/sbgn/libsbgn: `example-files`, `test-files`, `validation` | libsbgn's LICENSE.txt (LGPL 2.1 or EPL) |
| `newt-unstable`, `newt-master` | github.com/iVis-at-Bilkent/newt `app/samples`, branch unstable (the one web.newteditor.org runs) and master | LGPL 3.0 |
| `newt-saved` | Newt's samples as web.newteditor.org saves them (SBGN-ML and .nwt, 2026-10-17) | LGPL 3.0 |
| `reactome` | Reactome pathway diagrams exported as SBGN-ML: R-HSA-111885 (eicosanoids), R-HSA-70635 (urea cycle), R-HSA-70895 (BCAA) | CC BY 4.0 |
| `pd2af-website` | github.com/pd2af/pd2af.github.io; hidden: `bricks`, `testing` | none stated for the maps |
| `pd2af-engine` | github.com/pd2af/converter `static/` | none stated |

sbgn/pathway-archive's three maps are the same files as the website's and are listed there under
`same_file_also_at`.
