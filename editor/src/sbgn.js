    // ---------- the SBGN-ML part (editor/src/sbgn.js) ----------
    // An SBGN-ML map edited as the GraphML the converter makes of it (user, 2026-11-14: "the same idea", layout only):
    // the build keeps that GraphML (atlas-data/<id>.graphml, the entry's editBase), renderers/converter/sbgn_edit.js
    // makes the GraphML of the text being edited from it and writes the moves back into the SBGN-ML text, only the numbers
    // that change; the map is drawn by the yEd renderer as any GraphML map, so a GraphML map and an SBGN-ML map are edited
    // alike. text is that GraphML, sb.base the SBGN-ML text editing started from, src() the SBGN-ML text with the moves.
    // A map of the site saves its edited copy to its editPath (maps/sbgn-ml/...), the file it came from left unchanged.
    var sbp = null, sbJs = null, sb = null, sbNext = null;   // the SBGN-ML side loading, loaded, the file edited, the GraphML of the next opening
    function isSb(t) { return /<sbgn[\s>]/.test(t.slice(0, 3000)); }
    function sbMap(m) { m = m && (m.site || m); return !!(m && m.editBase && !m.shownAs); }
    function sbpy() {   // sbgn_edit.js, then the yEd renderer
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
    // the converter's GraphML of a map, as the build kept it (fetched once per version)
    function sbBase(m, low) {
      var e = m.site || m;
      return fetch(e.editBase + V.ver(e), { priority: low ? 'low' : 'auto' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
    }
    var sbMemo = [];   // [SBGN-ML text, its GraphML], the last few
    function sbGraphml(t, base) {
      for (var i = 0; i < sbMemo.length; i++) if (sbMemo[i][0] === t) return sbMemo[i][1];
      var g = sbJs.graphml(t, base);
      sbMemo.unshift([t, g]); sbMemo.length = Math.min(sbMemo.length, 3);
      return g;
    }
    var sbLast = null;   // [GraphML, its SBGN-ML text]: the moves written once per text
    function sbNow() {
      if (!sbLast || sbLast[0] !== text || sbLast[2] !== sb) sbLast = [text, sbJs.write(sb.base, text), sb];
      return sbLast[1];
    }
