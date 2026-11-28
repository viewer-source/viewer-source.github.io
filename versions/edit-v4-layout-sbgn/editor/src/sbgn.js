    var sbp = null, sbJs = null, sb = null;    
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
      for (var i = 0; i < sbMemo.length; i++) if (sbMemo[i][0] === t) return sbMemo[i][1];
      var g = sbJs.graphml(t, base);
      sbRemember(t, g);
      return g;
    }
    function sbRemember(t, g) { sbMemo.unshift([t, g]); sbMemo.length = Math.min(sbMemo.length, 3); }
    var sbLast = null;    
    function sbNow() {    
      if (!sbLast || sbLast[0] !== text || sbLast[2] !== sb) {
        try { sbLast = [text, sbJs.write(sb.base, text), sb]; }
        catch (e) { warn('The moves could not be written into the SBGN-ML file: ' + (e && e.message || e) + '. The last version written is kept.'); return sbLast && sbLast[2] === sb ? sbLast[1] : sb.base; }
      }
      return sbLast[1];
    }
