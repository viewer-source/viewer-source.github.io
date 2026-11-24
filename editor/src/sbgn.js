import { shared, V } from './state.js';
import { drag, paint, parse, render, setText, src, warn } from './core.js';
import { yr } from './graphml.js';

    // ---------- the SBGN-ML part (editor/src/sbgn.js) ----------
    // An SBGN-ML map edited as the GraphML the converter makes of it (as a GraphML map, layout only):
    // the build keeps that GraphML (atlas-data/<id>.graphml, the entry's editBase), renderers/converter/sbgn_edit.js
    // makes the GraphML of the text being edited from it and writes the moves back into the SBGN-ML text, only the numbers
    // that change; the map is drawn by the yEd renderer as any GraphML map, so a GraphML map and an SBGN-ML map are edited
    // alike. text is that GraphML, sb.base the SBGN-ML text editing started from, src() the SBGN-ML text with the moves.
    // A map of the site saves its edited copy to its editPath (maps/sbgn-ml/...), the file it came from left unchanged.
    var sbp, sbJs, EMPTY_BASE, baseURL;
    function __run1() {   // run at start, in order (__start)
    sbp = null, sbJs = null;   // the SBGN-ML side loading, loaded, the file edited ({ base: its text, g0: the build's GraphML })
    // a map made here (New map, own.js): drawn and edited from the converter's GraphML of an empty map, sbgn_edit.graphml
    // making every glyph drawn since (the same drawing as the converter's, checked on every kind the palette makes); its
    // map id says so. Another editor's file (Add map from file, a folder, a tool) is edited from the converter's GraphML
    // of it, made in the browser by renderers/converter/sbgnml_read.js (sbOwn)
    EMPTY_BASE = '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">\n' +
      '  <key for="node" id="ng" yfiles.type="nodegraphics"/>\n  <key for="graphml" id="res" yfiles.type="resources"/>\n  <key for="edge" id="eg" yfiles.type="edgegraphics"/>\n' +
      '  <graph edgedefault="directed" id="G"/>\n  <data key="res">\n    <y:Resources/>\n  </data>\n</graphml>\n';
    baseURL = null;
    }
    function emptyBase() { return baseURL || (baseURL = URL.createObjectURL(new Blob([EMPTY_BASE], { type: 'application/xml' }))); }
    var NEW_ID;
    function __run2() {   // run at start, in order (__start)
    NEW_ID = 'viewer-new-map';
    }
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
      sbp = sbScript('sbgn_edit').then(function () { return sbScript('sbml_edit').catch(function () {}); }).then(yr).then(function () { sbJs = window.sbgn_edit; return sbJs; });   // a copy without sbml_edit keeps SBGN-ML
      sbp.catch(function (e) { sbp = null; warn('The SBGN-ML side did not load: ' + e); });
      return sbp;
    }
    // the converter's GraphML of a map, as the build kept it (fetched once per version); a reader's own map's made here
    function sbBase(m, low) {
      var e = m.site || m;
      if (e.ownText) return sbpy().then(function () { return sbReader(e.ownText()); }).then(function () { return sbOwn(e.ownText()); });
      return fetch(e.editBase + V.ver(e), { priority: low ? 'low' : 'auto' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
    }
    // the GraphML a reader's own SBGN-ML text is edited as: the empty base for a map made here, else the converter's
    // GraphML of the text (sbgnml_read, its JavaScript copy; sbgn_edit.graphml(t, it) is it), the last one kept
    // (sbReader loads the reader first, only for such a text, again after a failed load). A file of which nothing can be
    // drawn (an Entity Relationship map) is refused with what was left out; an empty map is taken
    var ownMemo, readerP;
    function sbReader(t) {
      if (madeHere(t) || window.sbgnml_read) return Promise.resolve();
      readerP = readerP || sbScript('sbgnml_read');
      readerP.catch(function () { readerP = null; });
      return readerP;
    }
    function sbOwn(t) {
      if (madeHere(t)) return EMPTY_BASE;
      if (!window.sbgnml_read) throw new Error('the SBGN-ML reader did not load');
      if (!ownMemo || ownMemo[0] !== t) {
        var r = window.sbgnml_read.graphml(t);
        if (r.text.indexOf('<node ') < 0 && r.messages.some(function (x) { return x[0] === 'left out'; })) {   // glyphs, none drawable (an empty map is taken)
          if (/<([\w.-]+:)?map\s[^>]*language\s*=\s*["']entity relationship/.test(t.slice(0, 5000))) throw new Error('an Entity Relationship map, which this editor does not read yet');
          var gone = r.messages.filter(function (x) { return x[0] === 'left out'; }).map(function (x) { return x[1].replace(/: (\d+) left out \(.*$/, ' ($1)'); });
          throw new Error('nothing in it can be drawn' + (gone.length ? ' (left out: ' + gone.join(', ') + ')' : ''));
        }
        ownMemo = [t, r.text];
      }
      return ownMemo[1];
    }
    var sbMemo;
    function __run3() {   // run at start, in order (__start)
    sbMemo = []; ownMemo = null; outMemo = null;
    }   // [SBGN-ML text, the GraphML it was made from, its GraphML], the last few: one text gives another GraphML from another base (else the empty base's would be served for the build's)
    function sbGraphml(t, base) {
      for (var i = 0; i < sbMemo.length; i++) if (sbMemo[i][0] === t && sbMemo[i][1] === base) return sbMemo[i][2];
      var ed = edOf(t), g = ed.graphml(ed.unique ? ed.unique(t, base) : t, base);   // two glyphs of one id read as the build reads them (read-ahead, the site's reference)
      sbRemember(t, g, base);
      return g;
    }
    function sbRemember(t, g, base) { sbMemo.unshift([t, base, g]); sbMemo.length = Math.min(sbMemo.length, 3); }
    function sbNow() {   // a write that fails is said, and the last text written stands (never the file without its moves silently)
      if (!shared.sbLast || shared.sbLast[0] !== shared.text || shared.sbLast[2] !== shared.sb) {
        try { shared.sbLast = [shared.text, edOf(shared.sb.base).write(shared.sb.base, shared.text), shared.sb]; }
        catch (e) { warn('The moves could not be written into the SBGN-ML file: ' + (e && e.message || e) + '. The last version written is kept.'); return sbOut(shared.sbLast && shared.sbLast[2] === shared.sb ? shared.sbLast[1] : shared.sb.base); }
      }
      return sbOut(shared.sbLast[1]);
    }
    // the file as it is seen (Settings, Display, Show sites): unticked, every site written into its glyph's PTM note and
    // the circle shows the value alone (sbgn_edit.sitesOut); ticked, as written, every site on its state variable (the
    // file was opened with sitesIn, start in core.js). SBGN-ML only, the last one kept
    var outMemo;
    function sbOut(w) {
      if (V.sites || !sbJs || !sbJs.sitesOut || !isSb(w)) return w;
      if (!outMemo || outMemo[0] !== w) { var o = w; try { o = sbJs.sitesOut(w); } catch (e) {} outMemo = [w, o]; }   // a text it cannot edit written as it is
      return outMemo[1];
    }
    // a file opened: every site kept in its notes back on its circle, so it can be shown and is written as seen (sbOut)
    function sbIn(t) { try { return sbJs && sbJs.sitesIn && isSb(t) ? sbJs.sitesIn(t) : t; } catch (e) { return t; } }
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
    // every cardinality drawn again at its place on its line as the line runs now (sbgn_edit countsPlace), after a change
    // (sbKind from parse) and after a move (sbFollow); once per text
    var sbPlaced;
    function __run5() {   // run at start, in order (__start)
    sbPlaced = null;
    }
    function sbPlace() {
      if (!sbJs.countsPlace || shared.text === sbPlaced || shared.text.indexOf('<y:EdgeLabel') < 0) return false;
      var t2 = sbJs.countsPlace(shared.text), was = shared.text !== t2;
      setText(sbPlaced = t2);
      return was;
    }
    var sbK, GEO;
    function __run6() {   // run at start, in order (__start)
    sbK = { sb: null };
    GEO = /\s(?:x|y|width|height|sx|sy|tx|ty|ratio|modelPosition|nodeRatioX|nodeRatioY|labelRatioX|labelRatioY|offsetX|offsetY|borderDistance)="[^"]*"/g;
    }
    function sbRead() {   // the file written from the GraphML now: its kind and language, none when the write failed
      var s = src();
      sbK.text = shared.text; sbK.key = shared.text.replace(GEO, '');
      sbK.bad = !(shared.sbLast && shared.sbLast[0] === shared.text && shared.sbLast[2] === shared.sb);
      if (!sbK.bad) { sbK.kind = edOf(s).mapKind(s); sbK.af = edOf(s).isAf(s); }
    }
    function sbKind(how) {   // how: 'follow' (a change made here), 'back' (undo, redo), none (a paint: reads only)
      if (!shared.sb || !sbJs) return 'empty';
      if (how) sbPlace();   // a change (parse)
      if (sbK.sb !== shared.sb) sbK = { sb: shared.sb, text: null, key: null, kind: 'empty', af: false, g: null, bad: false };
      if (sbK.text !== shared.text) {
        if (sbK.bad || sbK.key !== shared.text.replace(GEO, '')) sbRead();   // read again when more than places changed (a move writes nothing)
        else sbK.text = shared.text;
      }
      if (sbK.bad) return sbK.kind;
      if (sbK.g == null || how === 'back') sbK.g = sbK.af;
      else if (how === 'follow' && sbK.g !== sbK.af) {
        var g, key = shared.text.replace(GEO, '');
        if (sbK.failed === key) return sbK.kind;   // a rebuild that failed: neither tried nor said again until the file's content changes (moves alone do not)
        try { g = edOf(src()).graphml(src(), shared.text); }
        catch (e) { sbK.failed = key; warn('The map could not be read again after it turned ' + (sbK.af ? 'Activity Flow' : 'Process Description') + ': ' + (e && e.message || e) + '.'); return sbK.kind; }
        setText(g); sbRead();
        if (!sbK.bad) sbK.g = sbK.af;
      }
      return sbK.kind;
    }
    function sbFollow() {   // after a move (changed()): a file the move turned, seen at a paint, followed now
      if (!shared.sb || !sbJs || drag || sbK.sb !== shared.sb) return;
      if (sbPlace()) { parse(); shared.dirty = true; render(); paint(); }   // a line moved: its cardinality with it
      sbKind();
      if (sbK.bad || sbK.g == null || sbK.g === sbK.af || sbK.failed === shared.text.replace(GEO, '')) return;   // a failed rebuild: not again after every move
      parse(); shared.selP = []; shared.selE = []; shared.dirty = true; render(); paint();   // the GraphML made again: its lines in another order
    }

    export function __start() { __run1(); __run2(); __run3(); __run5(); __run6(); }   // the part's statements, in their order
    export { EMPTY_BASE, GEO, NEW_ID, edOf, emptyBase, isSb, madeHere, sbBase, sbFollow, sbGraphml, sbJs, sbKind, sbIn, sbMap, sbNow, sbOwn, sbReader, sbRemember, sbpy, viaGraphml };
