---
# The editor in one file, built by Jekyll from editor/src/ (apart from the viewer's file, loaded
# only where the Edit tab is): the shared core, the live drawing of a move, then the GraphML part, the CellDesigner part, the SBGN-ML part, the palette (create.js), the CellDesigner palette (cdcreate.js), the how-to (help.js) and the reader's own storage (own.js), all in one scope.
# The viewer loads it when its style turns --m2-edit on and calls window.m2Editor with V, its own names.
---
window.m2Editor = function (V) {
{% include_relative src/core.js %}
{% include_relative src/live.js %}
{% include_relative src/graphml.js %}
{% include_relative src/celldesigner.js %}
{% include_relative src/sbgn.js %}
{% include_relative src/create.js %}
{% include_relative src/cdcreate.js %}
{% include_relative src/help.js %}
{% include_relative src/own.js %}
    buttons();
    aheadSoon();
    syncFolder();   // the reader's folder read for My maps, when the browser still allows it
    if (V.current) setTimeout(shown, 0);   // the Edit window already open (a reload in edit mode, or opened while this loaded): editing starts
    return { paint: paint, away: away, unkeep: unkeep, chooseFolder: chooseFolder, own: own, hasToken: function () { return !!(repo() && token()); }, leaving: function (m) { if (on && m !== map) { switching = true; try { stop(); } finally { switching = false; } } }, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); warmUp(); aheadSoon(); }, pictured: function (failed) { if (picWait) shown(!!failed); } };
};
