    // ---------- the SBGN-ML part (editor/src/sbgn.js) ----------
    // An SBGN-ML map edited as the GraphML the converter makes of it (as a GraphML map, layout only):
    // the build keeps that GraphML (atlas-data/<id>.graphml, the entry's editBase), renderers/converter/sbgn_edit.js
    // makes the GraphML of the text being edited from it and writes the moves back into the SBGN-ML text, only the numbers
    // that change; the map is drawn by the yEd renderer as any GraphML map, so a GraphML map and an SBGN-ML map are edited
    // alike. text is that GraphML, sb.base the SBGN-ML text editing started from, src() the SBGN-ML text with the moves.
    // A map of the site saves its edited copy to its editPath (maps/sbgn-ml/...), the file it came from left unchanged.
    var sbp = null, sbJs = null, sb = null;   // the SBGN-ML side loading, loaded, the file edited ({ base: its text, g0: the build's GraphML })
    // a map made here (New map, own.js): drawn and edited from the converter's GraphML of an empty map, sbgn_edit.graphml
    // making every glyph drawn since (the same drawing as the converter's, checked on every kind the palette makes); its
    // map id says so, so only such a file is taken back from the folder or Add map from file (another editor's may hold
    // what this way cannot draw: association)
    var EMPTY_BASE = '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">\n' +
      '  <key for="node" id="ng" yfiles.type="nodegraphics"/>\n  <key for="graphml" id="res" yfiles.type="resources"/>\n  <key for="edge" id="eg" yfiles.type="edgegraphics"/>\n' +
      '  <graph edgedefault="directed" id="G"/>\n  <data key="res">\n    <y:Resources/>\n  </data>\n</graphml>\n';
    var baseURL = null;
    function emptyBase() { return baseURL || (baseURL = URL.createObjectURL(new Blob([EMPTY_BASE], { type: 'application/xml' }))); }
    var NEW_ID = 'viewer-new-map';
    function madeHere(t) { return new RegExp('<map\\s[^>]*id="' + NEW_ID + '"').test(t.slice(0, 3000)); }
    function isSb(t) { return /<([\w.-]+:)?sbgn[\s>]/.test(t.slice(0, 3000)); }
    // an SBML file with a layout, edited the same way, layout only, through renderers/converter/sbml_edit.js (the map's
    // entry has layoutOnly); edOf: the converter part for a text, sbml_edit for SBML, sbgn_edit for the rest
    function isSbml(t) { t = t || ''; return /<sbml[\s>]/.test(t.slice(0, 3000)) && t.indexOf('listOfLayouts') >= 0 && t.slice(0, 200000).indexOf('celldesigner') < 0; }
    function viaGraphml(t) { return isSb(t) || isSbml(t); }
    function edOf(t) { return isSbml(t) && window.sbml_edit ? window.sbml_edit : sbJs; }
    function sbMap(m) { return !!(m && !m.shownAs && (m.site || m).editBase); }   // shown from another file (Settings' Source): not this one
    function sbScript(name) {
      return new Promise(function (res, rej) {
        if (window[name]) return res();
        var s = document.createElement('script');
        s.src = V.renderers + 'converter/' + name + '.js' + V.build; s.onload = res; s.onerror = function () { rej(name + ' not found'); };
        document.head.appendChild(s);
      });
    }
    function sbpy() {   // sbgn_edit.js, sbml_edit.js (which uses it), then the yEd renderer
      if (sbp) return sbp;
      sbp = sbScript('sbgn_edit').then(function () { return sbScript('sbml_edit'); }).then(yr).then(function () { sbJs = window.sbgn_edit; return sbJs; });
      sbp.catch(function (e) { sbp = null; warn('The SBGN-ML side did not load: ' + e); });
      return sbp;
    }
    // the converter's GraphML of a map, as the build kept it (fetched once per version)
    function sbBase(m, low) {
      var e = m.site || m;
      return fetch(e.editBase + V.ver(e), { priority: low ? 'low' : 'auto' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
    }
    var sbMemo = [];   // [SBGN-ML text, the GraphML it was made from, its GraphML], the last few: one text gives another GraphML from another base (else the empty base's would be served for the build's)
    function sbGraphml(t, base) {
      for (var i = 0; i < sbMemo.length; i++) if (sbMemo[i][0] === t && sbMemo[i][1] === base) return sbMemo[i][2];
      var g = edOf(t).graphml(t, base);
      sbRemember(t, g, base);
      return g;
    }
    function sbRemember(t, g, base) { sbMemo.unshift([t, base, g]); sbMemo.length = Math.min(sbMemo.length, 3); }
    var sbLast = null;   // [GraphML, its SBGN-ML text]: the moves written once per text
    function sbNow() {   // a write that fails is said, and the last text written stands (never the file without its moves silently)
      if (!sbLast || sbLast[0] !== text || sbLast[2] !== sb) {
        try { sbLast = [text, edOf(sb.base).write(sb.base, text), sb]; }
        catch (e) { warn('The moves could not be written into the SBGN-ML file: ' + (e && e.message || e) + '. The last version written is kept.'); return sbLast && sbLast[2] === sb ? sbLast[1] : sb.base; }
      }
      return sbLast[1];
    }
    // what the map is (sbgn_edit.mapKind), read once per change of the editor's GraphML: a change of
    // places only (a move, a resize) keeps the kind read before, so a drag or a paint writes nothing (a key
    // made on every paint cost 10 ms a call on a 2 MB map, three calls a paint). Two languages are kept apart:
    // the file's as written now (af), read at any call, a paint's too, and the GraphML's (g), the file's it was made from,
    // set only when the GraphML is opened, brought back (undo, redo) or made again. Where they differ, a change made here
    // turned the file (toAf, toPd), and the GraphML is made again from the file written (sbKind('follow'): parse() after a
    // change, sbFollow() after a move, never during a drag), so the drawing, the menus and later changes are the file's as
    // written (else a unit changed after a process turned the file PD is drawn but never written); a failed write
    // reads nothing from the last file written, and a failed rebuild is tried again at the next change of the file's content
    // (not at a move, else it re-runs and warns after every move)
    var sbK = { sb: null }, sbBack = false;
    var GEO = /\s(?:x|y|width|height|sx|sy|tx|ty|nodeRatioX|nodeRatioY|labelRatioX|labelRatioY|offsetX|offsetY|borderDistance)="[^"]*"/g;
    function sbRead() {   // the file written from the GraphML now: its kind and language, none when the write failed
      var s = src();
      sbK.text = text; sbK.key = text.replace(GEO, '');
      sbK.bad = !(sbLast && sbLast[0] === text && sbLast[2] === sb);
      if (!sbK.bad) { sbK.kind = edOf(s).mapKind(s); sbK.af = edOf(s).isAf(s); }
    }
    function sbKind(how) {   // how: 'follow' (a change made here), 'back' (undo, redo), none (a paint: reads only)
      if (!sb || !sbJs) return 'empty';
      if (sbK.sb !== sb) sbK = { sb: sb, text: null, key: null, kind: 'empty', af: false, g: null, bad: false };
      if (sbK.text !== text) {
        if (sbK.bad || sbK.key !== text.replace(GEO, '') || (sbK.kind === 'af' && !sbK.af)) sbRead();   // a PD file that reads AF is turned at its first change, a move too
        else sbK.text = text;
      }
      if (sbK.bad) return sbK.kind;
      if (sbK.g == null || how === 'back') sbK.g = sbK.af;
      else if (how === 'follow' && sbK.g !== sbK.af) {
        var g, key = text.replace(GEO, '');
        if (sbK.failed === key) return sbK.kind;   // a rebuild that failed: neither tried nor said again until the file's content changes (moves alone do not)
        try { g = edOf(src()).graphml(src(), text); }
        catch (e) { sbK.failed = key; warn('The map could not be read again after it turned ' + (sbK.af ? 'Activity Flow' : 'Process Description') + ': ' + (e && e.message || e) + '.'); return sbK.kind; }
        text = g; sbRead();
        if (!sbK.bad) sbK.g = sbK.af;
      }
      return sbK.kind;
    }
    function sbFollow() {   // after a move (changed()): a file the move turned (a PD file of direct links), seen at a paint, followed now
      if (!sb || !sbJs || drag || sbK.sb !== sb) return;
      sbKind();
      if (sbK.bad || sbK.g == null || sbK.g === sbK.af || sbK.failed === text.replace(GEO, '')) return;   // a failed rebuild: not again after every move
      parse(); selP = []; selE = []; dirty = true; render(); paint();   // the GraphML made again: its lines in another order
    }
