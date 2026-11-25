// What the editor's modules share: V, the viewer's names (getters and setters the viewer hands the editor), and shared, the
// editor's state that more than one module changes (a module may read what it imports, never assign it).
export var V;
export var shared = {};
// The file formats, one object per format (graphml.js, celldesigner.js, sbgn.js), put here by main.js before the parts
// start; the open map's object is shared.F. Shared code asks F and never which format a map is. Its jobs and tables:
//   now()      the map's own file as it is now (core.js src)
//   beside()   the file kept beside the GraphML edited, as it is now (CellDesigner), else null: what a drawing is of
//   ownFrame   the picture is drawn in the file's own places (CellDesigner), else shifted out of negative places
//   live()     the live drawing of a move, the format's own way (live.js liveFmt): { glyphs, lines, holders, size }
//   afView     the map can be drawn in AF's SBGN view (graphml.js afSbgn; not CellDesigner, drawn by cdrender)
//   stacks     a compartment's name places and its order (Bring forward, Send backward) are written by the engine (not CellDesigner)
//   mainLines  a reaction has one main reactant and product, the others added (CellDesigner): Make main
//   cardDown(e)  a press on a cardinality, where the format has its own way (CellDesigner); none: create.js's
//   line       drawing a line the format's own way (CellDesigner, cdcreate.js: { role(i), lineAt(P, not), onLine(), startOk(i),
//              how(a, b, P), moveSays(k, end, i), make(a, b, how), liveEnds(S, P, C), marks(out) }); none: create.js's, by the notation's table
//   square(id) the reaction a node is the square of (CellDesigner's process glyph, id <reaction>|proc: no item of its own,
//              never selected or moved alone), else null
//   insets     the GraphML edited keeps yEd's group insets (refit); not CellDesigner, whose GraphML is made again from its file
//   stackComp(t, id)  compartment id put behind or in front of those it partly overlaps (stackComps), the engine's sbgn_edit.stack
//              (the text as it was while it is loading); none on CellDesigner maps
//   fileType   the file's type as Save as offers it (showSaveFilePicker's types)
//   magenta    the square marks magenta, as CellDesigner draws them (else black, as yEd)
//   opened()   what the format does once its map is open (CellDesigner: plainCanvas); none for the others
//   lit(hlE, glyphs)  what the format lights with the selection, added to the sets of lines and nodes (CellDesigner: a
//              reaction's lines and square, its main line or square selected); none for the others
//   ownLine(id)  a line that is one of a reaction's own (CellDesigner: its main lines, added reactants and products), drawn
//              with no squares in its square; none for the others
//   endTo(k, end, i)  whether an end of line k may be moved to node i, the format's own rule (CellDesigner); none: core.js's
//              by the notation's roles
//   drawn()    what the format readies once a drawing is put in (CellDesigner: the live session of cd_edit, cdSessionSoon); none
//              for the others
//   sitesOut() the file writes sites as Show sites shows them, its writer loaded (SBGN-ML: sbgn_edit.sitesOut); none for the others
//   nestWhy(moves)  why the file cannot hold these moves of what holds what ([[id, new holder id or null], ...]), or null
//              (CellDesigner: cd_edit.nestCheck on the file's kept document, read only); none for the others
//   nestReady()  nestWhy's check loaded (the arrow keys work out the new holders only then)
//   leave(moves)  members that left their complex written the format's own way (CellDesigner: cd_make.leave, the GraphML made
//              again), whether the file changed; none for the others (a member's leaving is a plain move there)
//   undoKeep()  an undo step as the format keeps it (CellDesigner: { g: the GraphML, b: the file it was made from }); none: the GraphML
//   undoPut(t)  such a step put back, its GraphML returned (CellDesigner: the file set again); none: t.g
//   load()     the renderer that draws the map, loaded (a promise: CellDesigner cdpy, cdrender and cd_edit; the others yr, yrender)
//   redraw(memo)  the map drawn now, the format's own way (CellDesigner: the moves written into its file, drawn by
//              cdrender, the GraphML made again of it), [svg, warnings]; memo: the drawing made ahead for this opening; none:
//              core.js render's, yrender's drawing of the GraphML, shifted out of negative places
//   engineCd   the engines' CellDesigner rules apply (holding.js M.cd: a compartment's double border, process glyphs and gates;
//              layout.js tidy; graphml_edit.read's cd)
//   modLine(id)  a modifier's line of a reaction (CellDesigner: <reaction>|m<n>), its end landing at the square's six places; none
//              for the others
//   kind(n)    a node's kind, for Select all of this kind: SBGN-ML its class (a multimer as its plain kind), CellDesigner
//              its species class or compartment, GraphML its shape; null when it has none
//   nameable(id)  the file can take a name for this node (setName; Name by members greyed when not)
//   ownName(id, shown)  a name the format keeps its own way (CellDesigner: in its file; shown: as drawn); none: the GraphML label
//   rename(id, v)  a name written the format's own way (CellDesigner); none: create.js's, the label through the engine
//   join       how a glyph is put into a complex (create.js joinPlan, joinDo), or null (GraphML): { ok() joining is on,
//              own(i) a node that never joins (optional), joinable(id, cid) why not or nothing, write(joins) the
//              complexes that took a member }
//   reads(t)   a file of this format (formatOfText)
//   entry(m)   a map's entry edited from a file of this format (formatOfMap)
//   open(t, g0, still)  a file opened for editing: { g: the GraphML edited, t: the text edited, t0: the file as read, said:
//              what the opening changed in it, own: the format's fields of the map (putMap) }, or a promise of it; null
//              when the opening was left (still() false). GraphML: at once, the file itself
//   base       the file the GraphML edited was read from, kept with a point to go back to (core.js good, the history)
//              and put back with it: { keep(), put(b) } (SBGN-ML: shared.sb.base); none: nothing kept
//   asRead     the history and the picture on screen are of the file as read (SBGN-ML, its sites put back after)
//   drawOwn(t, g0, keep)  a reader's own map drawn for the list (core.js drawText): a promise of the SVG, or null when
//              the format cannot draw this text
//   asGraphml(t)  the site's text as the editor's GraphML (siteRef); none: the text itself
//   ahead      the read-ahead (core.js ahead, readyOf, drawAhead, keepAhead): { load() its scripts; path(m) where its
//              edited copy is kept, also: the first save makes it (SBGN-ML); base(m, low) what its GraphML is made from;
//              graphml(t, b, keep) the GraphML editing starts from (none: the text); draw(t, g) its own drawing made
//              ahead (CellDesigner), else yrender's, as SBGN when sbgn; took(t, g) the GraphML made ahead handed to the
//              opening; keeper() taken on leaving, a function (t, g, svg) that keeps the format's part and gives the
//              drawing's memo, or null for the plain one }
// Moved one question at a time (stage 1 of notes/format-object-design.md in the working repository).
export var formats = {};
export function addFormats(o) { Object.keys(o).forEach(function (k) { formats[k] = o[k]; }); }
// The format of a file, or of the file a map's entry is edited from, for the read-ahead, the opening and the list's own
// maps, which ask by file and not by the open map (shared.F): each format asked in this order, the first that takes it;
// null when none does
function inOrder() { return [formats.sb, formats.cd, formats.graphml].filter(Boolean); }
export function formatOfText(t) { return inOrder().find(function (f) { return f.reads(t); }) || null; }
export function formatOfMap(m) { return inOrder().find(function (f) { return f.entry(m); }) || null; }
export function setV(v) { V = v; Object.keys(LIFETIMES).forEach(reset); }   // every field present from the start

// Every field of shared, by how long it lives, with its value at the start (a function: a fresh list or object each
// time). The release refuses a shared field not listed here (release/check.js), so a new field gets its lifetime here.
//   page     the page's life: never reset
//   map      one editing session on one map: resetMap(), when editing starts on a map (core.js begin)
//   gesture  an input in progress (a click waiting, a name typed): resetMap(); it lives through a redraw
//   drawing  the live state of the drawing on screen (a drag's copies and boxes): resetDrawing(), when a drawing is put
//            in; resetMap()
//   cache    memos keyed by their own input: resetMap(), so only memory is freed
function none() { return null; }
function no() { return false; }
function list() { return []; }
export var LIFETIMES = {
  page: {
    palShown: none,      // the palette's set as last shown (create.js palShow)
    listAhead: list,     // the list's maps read ahead (own.js)
    ghDir: none,         // when the data repository's folder was last listed (core.js, own.js)
    switching: no,       // editing ends because another map was chosen
    afSbgn: no           // AF's SBGN view: follows the palette's look (create.js palLook); stop() draws the map plainly
  },
  map: {
    text: function () { return ''; },   // the GraphML edited (a CellDesigner or SBGN-ML map's working copy)
    F: function () { return formats.graphml || null; },   // the map's format object (formats), set by core.js begin
    cd: none,            // a CellDesigner map: { base, now }
    sb: none,            // an SBGN-ML map: { base, g0 }
    sbLast: none,        // an SBGN-ML map's [GraphML, its SBGN-ML text, sb]: the moves written once per text (sbgn.js)
    sbBack: no,          // the next parse follows an undo (sbgn.js sbKind)
    dirty: no,           // moves not saved
    redo: list,          // the redo steps (undo is core.js's own)
    selN: list, selE: list, selP: list,   // selected nodes, arcs, bend points (indices in nodes2, edges2, points)
    svSel: none,         // a selected state variable or unit of information { id, j }
    part: none,          // a selected part of a line (a port or a bend point)
    procs: list,         // the process glyphs with their two main arcs (parse)
    cdBase: none,        // the drawing the CellDesigner live session starts from { now, text }
    cdGate: none,        // a CellDesigner logic gate being made: { kind, inputs: [node ids] } (cdcreate.js)
    lastChange: none     // what the last whole action changed: { name, ids } (core.js commit); the shift out of negative places { name: 'shift', shift: [dx, dy], after: the action's name }
  },
  gesture: {
    tap: none,           // a press waiting to become a click
    typing: none,        // a name being typed on the map (create.js typeIn)
    cdPend: none         // a CellDesigner structural state or unit of information shown before it is in the file, written once it has a value: { id, kind, angle } (cdcreate.js)
  },
  drawing: {
    live: none, liveC: none, liveOrig: none, liveG: none,   // a move drawn live: arcs hidden, boxes, holders' groups, glyphs' shifts
    sizeRec: none,       // the node drawn live while it is resized: its parts and how they were
    keyed: none,         // what the arrow keys moved since the map was last drawn
    poseNow: none, poseText: none,   // a dragged tag's or terminal's pose
    sizePosed: no,       // the terminals of a submap being resized posed on its new border (live.js poseSize)
    copies: list,        // the live copies of lines drawn over the picture
    frozen: no           // the copies kept until the map is drawn again
  },
  cache: {
    hpMemo: none,        // the ports of the GraphML drawing, by its text
    cdStrictMemo: function () { return [null, false]; }   // the CellDesigner set's tick box, read from this browser once per map, not on every paint
  }
};
function reset(kind) { var L = LIFETIMES[kind]; Object.keys(L).forEach(function (k) { shared[k] = L[k](); }); }
export function resetMap() { cleared().forEach(reset); }
export function resetDrawing() { reset('drawing'); }
function cleared() { return ['map', 'gesture', 'drawing', 'cache']; }
// the fields resetMap() clears, as they are (taken before it), and put back (a map that could not be opened leaves the
// map before it as it was)
export function takeMap() { var o = {}; cleared().forEach(function (kind) { Object.keys(LIFETIMES[kind]).forEach(function (k) { o[k] = shared[k]; }); }); return o; }
export function putMap(o) { Object.keys(o).forEach(function (k) { shared[k] = o[k]; }); }
// the tests' plant: values put into fields of the reset lifetimes, so a test can see a switch clear them (page fields
// refused; never called by the editor itself)
export function plant(o) { var ok = {}; cleared().forEach(function (kind) { Object.keys(LIFETIMES[kind]).forEach(function (k) { ok[k] = 1; }); }); Object.keys(o).forEach(function (k) { if (ok[k]) shared[k] = o[k]; }); }
// the fields by lifetime as they are now (the tests' view; nothing writes through it)
export function stateNow() {
  var out = {};
  Object.keys(LIFETIMES).forEach(function (kind) { out[kind] = {}; Object.keys(LIFETIMES[kind]).forEach(function (k) { out[kind][k] = shared[k]; }); });
  return out;
}
