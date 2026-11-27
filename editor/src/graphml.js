import { shared } from './state.js';
import { liveY, yr } from './drawing.js';
import { sbJs, sbpy } from './engines.js';

    // ---------- the GraphML part (editor/src/graphml.js) ----------
    // A yEd GraphML file, edited as it is and drawn by the shared drawing (drawing.js).

    // a GraphML file with no yEd layout (no yEd namespace: Cytoscape, Gephi and NetworkX write nodes and edges only):
    // refused with this reason, whatever the way in, since nothing in it says where to draw; else null
    function noLayout(t) {
      return /<graphml[\s>]/.test(t.slice(0, 3000)) && !/yworks\.com/.test(t.slice(0, 5000)) ? 'a GraphML file with no yEd layout (as Cytoscape, Gephi or NetworkX write it): nothing in it says where to draw. Open it in yEd, lay it out and save it there, then add it again' : null;
    }
    // GraphML's format object (state.js formats): the GraphML edited is the file itself
    function graphmlFormat() {
      return { name: 'graphml', load: yr, engineCd: false, now: function () { return shared.text; }, ownFrame: false, live: function () { return liveY; }, mainLines: false, afView: true, stacks: true, insets: true, fileType: { description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }, stackComp: function (t, id) { return sbJs && sbJs.stack ? sbJs.stack(t, id) : t; }, square: function () { return null; }, beside: function () { return null; },
        // edited as it is, but for lines at complex members put right (sbgn_edit.membersOut), said once the map is drawn and
        // written at the next save; at once when the engine is loaded, else once it is
        open: function (t, g0, still) {
          var fix = function () { var mo = sbJs.membersOut(t); return { g: mo.text, t: mo.text, t0: t, said: sbJs.membersSaid(mo.said) }; };
          return sbJs ? fix() : sbpy().then(function () { return still && !still() ? null : fix(); });
        },
        drawOwn: function (t) { var no = noLayout(t); if (no) return Promise.reject(new Error(no)); return yr().then(function () { return window.yrender.render(t, { classes: true, groups: true, sbgn: false }).svg; }); },   // a reader's own map drawn for the list (core.js drawText), as the build draws
        ahead: { load: yr },   // the read-ahead: the renderer; the file is edited as it is
        reads: function (t) { return /<graphml[\s>]/.test(t.slice(0, 3000)); },
        entry: function (m) { var d = m && m.downloads && m.downloads[0]; return !!(d && d.label === 'GraphML'); },
        kind: function (n) { return n.shape && n.shape.kind || null; },   // a node's shape
        nameable: function () { return !!sbJs; } };   // any node's label, written by the engine
    }
    export { graphmlFormat, noLayout };
