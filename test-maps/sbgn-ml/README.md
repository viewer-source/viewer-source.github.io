# SBGN-ML test maps

SBGN-ML maps made by other people and tools, to test the viewer's SBGN-ML drawing against files we did not produce
(user, 2026-11-14). Our own maps are left out: they are on our atlas sites. Every file is unchanged, as its source
holds it; a test that needs a change makes it in a temporary copy. Published with the site, so a test page loads a
file by its address, e.g. `/test-maps/sbgn-ml/pd/newt-unstable/glycolysis.sbgn`.

- `pd/`: Process Description, the language worked on now: 18 maps and libsbgn's 50 validation error tests.
- `af/`: Activity Flow, kept for later: 11 maps and libsbgn's 15 validation error tests.
- Left out: Entity Relationship, hybrid maps, SBML and SIF (user: not needed now); maps under 20 glyphs (user: the
  hundreds of small spec and rule cases are not useful), except the validation tests; our own Metabolism
  Regulation maps found in pd2af.
- `sources.tsv`: one line per file: language, SBGN-ML version (0.2 or 0.3, from the namespace), glyph and arc
  counts, size, source, repository and commit, its path there, licence, `hidden` when its folder is linked from no
  page of the source's website, a note, and the other places the same file (byte for byte) was found. One copy of
  each example (user, 2026-11-14, replacing "the same map by different tools kept each time"): Newt's from
  `newt-unstable`, the other copies (Newt's other branches and saves, libsbgn's, the SBGN website's) removed.

Notes on the files:

- `invalid on purpose`: libsbgn's validation error tests (`libsbgn/validation/error-test-files/`), each breaking one
  rule; the viewer should draw what it can and not fail.
- `.nwt` is Newt's own file: SBGN-ML with Newt's settings in an extension, read as SBGN-ML.
- Largest: central plant metabolism (1,324 glyphs), Newt's ATM, CaM-CaMK, Drosophila cell cycle
  and cholesterol maps (74 to 91).

| Folder | Source | Licence |
|---|---|---|
| `sbgn-website` | github.com/sbgn/sbgn.github.io; hidden: `downloads/examples`, `spec_examples` | CC0 1.0 |
| `libsbgn` | github.com/sbgn/libsbgn: `validation` (PD and AF), `test-files` (AF only) | libsbgn's LICENSE.txt (LGPL 2.1 or EPL) |
| `newt-unstable` | github.com/iVis-at-Bilkent/newt `app/samples`, branch unstable (the one web.newteditor.org runs) | LGPL 3.0 |
| `pd2af-website` | github.com/pd2af/pd2af.github.io (two specification cases of 20 glyphs or more) | none stated for the maps |
| `pd2af-engine` | github.com/pd2af/converter `static/generated/`: Activity Flow written by the 2018 engine | none stated |

Our own iNOS map drawn in SBGN-ED (`images/learning/` of the SBGN website) is left out.

Looked at and not taken (2026-11-14): SBGN-ED's three maps for the SBGN competition 2010, in SBGN-ML's first draft
(namespace `libsbgn/pd/0.1`, no language attribute; taken first, then removed, user: "We don't need that"); the SBGN bricks of sbgnbricks.sourceforge.net (35 single bricks in its zip; its
iNOS ER and AF maps are images only); SBGN-ED's 16 competition maps in its own GML (`SBGN_software_(1)-SBGN-ED.zip`,
incl. PCR, CaMKII and the sodium channel, not SBGN-ML); VISIBIOweb's (BioPAX and images); the EGFR tutorial maps
(CellDesigner); Arcadia's (SBML).
libsbgn's `PD_Reference_Card.sbgn` and `SBGN-PD_all.sbgn` (`test-files/PD/`), taken first, then removed (user, 2026-11-14); so was Newt's `pd_learners_card.nwt` (`newt-master`); then the folders `newt-master` (master branch) and `newt-saved`
(the samples as web.newteditor.org saved them, 2026-10-17), twins of `newt-unstable`'s examples (user, 2026-11-14);
then Reactome's three diagrams exported as SBGN-ML (R-HSA-111885 eicosanoids, R-HSA-70635 urea cycle, R-HSA-70895
BCAA; user, 2026-11-14); then the SBGN website's PD learner's cards (`images/learnerscards/`: the .nwt, 02plain,
03, 03plain) and `downloads/spec_images/layout-branching.sbgn` (user, 2026-11-14); then libsbgn's six PD test files
(`test-files/PD/`: STAT1alpha, glycolysis, insulin-like growth factor, MAPK cascade, neuronal muscle signalling and its
colour version), copies of Newt's examples (user, 2026-11-14); then the SBGN website's copies of the same examples
(`downloads/examples`: STAT1alpha, glycolysis, insulin-like growth factor, MAPK cascade, neuronal muscle signalling,
each also as `_SBGNv02`; `spec_examples`: glycolysis, insulin, mapk, muscle; `figure_to_sbgn`: CaMKII and polyQ, as
Newt's CaM-CaMK and polyQ) and Repressilator's twins (`_v6_color`, `_v7_SBGNv02`; `_v7` kept) (user, 2026-11-14).

sbgn/pathway-archive's maps are the same files as the website's and are listed there under `same_file_also_at`.
