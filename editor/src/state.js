// What the editor's modules share: V, the viewer's names (getters and setters the viewer hands the editor), and shared, the
// editor's state that more than one module changes (a module may read what it imports, never assign it).
export var V;
export var shared = {};
export function setV(v) { V = v; }
