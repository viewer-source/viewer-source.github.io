    var sbp = null, sbJs = null, sb = null;    
    var EMPTY_BASE = '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">\n' +
      '  <key for="node" id="ng" yfiles.type="nodegraphics"/>\n  <key for="graphml" id="res" yfiles.type="resources"/>\n  <key for="edge" id="eg" yfiles.type="edgegraphics"/>\n' +
      '  <graph edgedefault="directed" id="G"/>\n  <data key="res">\n    <y:Resources/>\n  </data>\n</graphml>\n';
    var baseURL = null;
    function emptyBase() { return baseURL || (baseURL = URL.createObjectURL(new Blob([EMPTY_BASE], { type: 'application/xml' }))); }
    var NEW_ID = 'viewer-new-map';
    function madeHere(t) { return new RegExp('<map\\s[^>]*id="' + NEW_ID + '"').test(t.slice(0, 3000)); }
    function isSb(t) { return /<([\w.-]+:)?sbgn[\s>]/.test(t.slice(0, 3000)); }
    function sbMap(m) { return !!(m && !m.shownAs && (m.site || m).editBase); }    
    function sbpy() {    
      if (sbp) return sbp;
      sbp = new Promise(function (res, rej) {
        if (window.sbgn_edit) return res();
        var s = document.createElement('script');
        s.src = V.renderers + 'converter/sbgn_edit.js' + V.build; s.onload = res; s.onerror = function () { rej('sbgn_edit not found'); };
        document.head.appendChild(s);
      }).then(yr).then(function () { sbJs = window.sbgn_edit; return sbJs; });
      sbp.catch(function (e) { sbp = null; warn('The SBGN-ML side did not load: ' + e); });
      return sbp;
    }
    function sbBase(m, low) {
      var e = m.site || m;
      return fetch(e.editBase + V.ver(e), { priority: low ? 'low' : 'auto' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
    }
    var sbMemo = [];    
    function sbGraphml(t, base) {
      for (var i = 0; i < sbMemo.length; i++) if (sbMemo[i][0] === t && sbMemo[i][1] === base) return sbMemo[i][2];
      var g = sbJs.graphml(t, base);
      sbRemember(t, g, base);
      return g;
    }
    function sbRemember(t, g, base) { sbMemo.unshift([t, base, g]); sbMemo.length = Math.min(sbMemo.length, 3); }
    var sbLast = null;    
    function sbNow() {    
      if (!sbLast || sbLast[0] !== text || sbLast[2] !== sb) {
        try { sbLast = [text, sbJs.write(sb.base, text), sb]; }
        catch (e) { warn('The moves could not be written into the SBGN-ML file: ' + (e && e.message || e) + '. The last version written is kept.'); return sbLast && sbLast[2] === sb ? sbLast[1] : sb.base; }
      }
      return sbLast[1];
    }
    var sbK = { sb: null }, sbBack = false;
    var GEO = /\s(?:x|y|width|height|sx|sy|tx|ty|nodeRatioX|nodeRatioY|labelRatioX|labelRatioY|offsetX|offsetY|borderDistance)="[^"]*"/g;
    function sbRead() {    
      var s = src();
      sbK.text = text; sbK.key = text.replace(GEO, '');
      sbK.bad = !(sbLast && sbLast[0] === text && sbLast[2] === sb);
      if (!sbK.bad) { sbK.kind = sbJs.mapKind(s); sbK.af = sbJs.isAf(s); }
    }
    function sbKind(how) {    
      if (!sb || !sbJs) return 'empty';
      if (sbK.sb !== sb) sbK = { sb: sb, text: null, key: null, kind: 'empty', af: false, g: null, bad: false };
      if (sbK.text !== text) {
        if (sbK.bad || sbK.key !== text.replace(GEO, '') || (sbK.kind === 'af' && !sbK.af)) sbRead();    
        else sbK.text = text;
      }
      if (sbK.bad) return sbK.kind;
      if (sbK.g == null || how === 'back') sbK.g = sbK.af;
      else if (how === 'follow' && sbK.g !== sbK.af) {
        var g, key = text.replace(GEO, '');
        if (sbK.failed === key) return sbK.kind;    
        try { g = sbJs.graphml(src(), text); }
        catch (e) { sbK.failed = key; warn('The map could not be read again after it turned ' + (sbK.af ? 'Activity Flow' : 'Process Description') + ': ' + (e && e.message || e) + '.'); return sbK.kind; }
        text = g; sbRead();
        if (!sbK.bad) sbK.g = sbK.af;
      }
      return sbK.kind;
    }
    function sbFollow() {    
      if (!sb || !sbJs || drag || sbK.sb !== sb) return;
      sbKind();
      if (sbK.bad || sbK.g == null || sbK.g === sbK.af || sbK.failed === text.replace(GEO, '')) return;    
      parse(); selP = []; selE = []; dirty = true; render(); paint();    
    }
