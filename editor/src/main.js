// The editor's entry: the viewer loads the built editor.js (editor/build.js bundles this file and what it imports) once
// its style turns --m2-edit on, and calls window.m2Editor with V. The parts start in this order.
import { setV } from './state.js';
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
import { warmUp } from './celldesigner.js';
import { own } from './own.js';
import { shared } from './state.js';

window.m2Editor = function (v) {
    setV(v);
    start_core();
    start_live();
    start_graphml();
    start_celldesigner();
    start_sbgn();
    start_create();
    start_cdcreate();
    start_help();
    start_own();
    buttons();
    aheadSoon();
    syncFolder();   // the reader's folder read for My maps, when the browser still allows it
    if (v.current) setTimeout(shown, 0);   // the Edit window already open (a reload in edit mode, or opened while this loaded): editing starts
    return { fresh: function () { shared.redo = []; shared.listAhead = []; }, paint: paint, away: away, unkeep: unkeep, chooseFolder: chooseFolder, own: own, hasToken: function () { return !!(repo() && token()); }, leaving: function (m) { if (on && m !== map) { shared.switching = true; try { stop(); } finally { shared.switching = false; } } }, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); warmUp(); aheadSoon(); }, pictured: function (failed) { if (picWait) shown(!!failed); } };
};
