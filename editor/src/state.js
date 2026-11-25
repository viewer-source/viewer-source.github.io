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
//   mainLines  a reaction has one main reactant and product, the others added (CellDesigner): Make main
//   cardDown(e)  a press on a cardinality, where the format has its own way (CellDesigner); none: create.js's
//   kind(n)    a node's kind, for Select all of this kind: SBGN-ML its class (a multimer as its plain kind), CellDesigner
//              its species class or compartment, GraphML its shape; null when it has none
//   nameable(id)  the file can take a name for this node (setName; Name by members greyed when not)
//   ownName(id, shown)  a name the format keeps its own way (CellDesigner: in its file; shown: as drawn); none: the GraphML label
//   rename(id, v)  a name written the format's own way (CellDesigner); none: create.js's, the label through the engine
// Moved one question at a time (stage 1 of notes/format-object-design.md in the working repository).
export var formats = {};
export function addFormats(o) { Object.keys(o).forEach(function (k) { formats[k] = o[k]; }); }
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
