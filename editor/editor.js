---
# The editor in one file, built by Jekyll from editor/src/ (user, 2026-11-13: the editor out of the viewer's file, loaded
# only where the Edit tab is): the shared core, then the GraphML part, then the CellDesigner part, all in one scope.
# The viewer loads it when its style turns --m2-edit on and calls window.m2Editor with V, its own names.
---
window.m2Editor = function (V) {
{% include_relative src/core.js %}
{% include_relative src/graphml.js %}
{% include_relative src/celldesigner.js %}
    buttons();
    return { paint: paint, away: away, leaving: function (m) { if (on && m !== map) stop(); }, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); warmUp(); } };
};
