// The editor's entry: the viewer loads the built editor.js (editor/build.js bundles this file and what it imports) once
// its style turns --m2-edit on, and calls window.m2Editor with V. The parts start in this order.
import { addFormats, plant, setV, stateNow } from './state.js';
import { __start as start_core } from './core.js';
import { __start as start_live } from './live.js';
import { __start as start_graphml } from './graphml.js';
import { __start as start_celldesigner } from './celldesigner.js';
import { __start as start_sbgn } from './sbgn.js';
import { __start as start_create } from './create.js';
import { __start as start_cdcreate } from './cdcreate.js';
import { __start as start_help } from './help.js';
import { __start as start_own } from './own.js';
import { aheadSoon, away, buttons, chooseFolder, map, on, paint, picWait, repo, shown, stop, syncFolder, token, unkeep } from './core.js';
import { cdFormat, cdKept, cdShown, warmUp } from './celldesigner.js';
import { graphmlFormat } from './graphml.js';
import { sbFormat } from './sbgn.js';
import { own } from './own.js';
import { shared } from './state.js';
import { registry } from './tools.js';

window.m2Editor = function (v) {
    addFormats({ graphml: graphmlFormat(), cd: cdFormat(), sb: sbFormat() });   // before setV: the map's F starts as GraphML's
    setV(v);
    window.m2EditState = function () { var s = stateNow(); s.cdKept = cdKept(); return s; };   // the editor's shared fields by lifetime and the map whose CellDesigner document is kept, read by the tests (tests/map-switch.js)
    window.m2EditPlant = plant;   // the tests' values put into the map's fields before a switch (tests/map-switch.js)
    start_core();
    start_live();
    start_graphml();
    start_celldesigner();
    start_sbgn();
    start_create();
    start_cdcreate();
    start_help();
    start_own();
    var tools = registry();   // tools' commands for the map shown (tools.js); a run is handed the map, its text and add, a new map under it (own.js fromTool)
    var shownMap = function () { var m = v.current; return m ? { id: m.id, name: own.tool.name(m.id), kind: own.tool.kind(m.id) } : null; };
    window.m2Tools = {
      register: tools.register,
      forMap: function () { var m = shownMap(); return m ? tools.forMap(m) : []; },
      run: function (id) {
        var m = shownMap();
        if (!m) return Promise.reject(new Error('no map is shown'));
        return tools.run(id, m, { map: m, text: function () { return own.tool.text(m.id); }, add: function (t, name) { return own.tool.add(m.id, t, name || m.name + ' (' + tools.label(id) + ')'); } });
      }
    };
    buttons();
    aheadSoon();
    syncFolder();   // the reader's folder read for My maps, when the browser still allows it
    if (v.current) setTimeout(shown, 0);   // the Edit window already open (a reload in edit mode, or opened while this loaded): editing starts
    return { fresh: function () { shared.redo = []; shared.listAhead = []; }, paint: paint, away: away, unkeep: unkeep, chooseFolder: chooseFolder, own: own, hasToken: function () { return !!(repo() && token()); }, leaving: function (m) { if (on && m !== map) { shared.switching = true; try { stop(); } finally { shared.switching = false; } } }, left: function (m) { cdShown(m && m.id); if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); warmUp(); aheadSoon(); }, pictured: function (failed) { if (picWait) shown(!!failed); } };
};
