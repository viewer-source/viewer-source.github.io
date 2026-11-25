import { shared } from './state.js';
import { liveY, yr } from './drawing.js';
import { sbJs } from './engines.js';

    // ---------- the GraphML part (editor/src/graphml.js) ----------
    // A yEd GraphML file, edited as it is and drawn by the shared drawing (drawing.js).

    // GraphML's format object (state.js formats): the GraphML edited is the file itself
    function graphmlFormat() {
      return { name: 'graphml', load: yr, engineCd: false, now: function () { return shared.text; }, ownFrame: false, live: function () { return liveY; }, mainLines: false, afView: true, stacks: true, insets: true, fileType: { description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }, stackComp: function (t, id) { return sbJs && sbJs.stack ? sbJs.stack(t, id) : t; }, square: function () { return null; }, beside: function () { return null; },
        open: function (t) { return { g: t, t: t }; },   // edited as it is
        drawOwn: function (t) { return yr().then(function () { return window.yrender.render(t, { classes: true, groups: true, sbgn: false }).svg; }); },   // a reader's own map drawn for the list (core.js drawText), as the build draws
        ahead: { load: yr },   // the read-ahead: the renderer; the file is edited as it is
        reads: function (t) { return /<graphml[\s>]/.test(t.slice(0, 3000)); },
        entry: function (m) { var d = m && m.downloads && m.downloads[0]; return !!(d && d.label === 'GraphML'); },
        kind: function (n) { return n.shape && n.shape.kind || null; },   // a node's shape
        nameable: function () { return !!sbJs; } };   // any node's label, written by the engine
    }
    export { graphmlFormat };
