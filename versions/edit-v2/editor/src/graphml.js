
    var yrp = null;
    function yr() {
      if (yrp) return yrp;
      yrp = new Promise(function (res, rej) {
        if (window.yrender) return res(window.yrender);
        var s = document.createElement('script');
        s.src = V.renderers + 'yrender/yrender.js' + V.build; s.onload = function () { res(window.yrender); }; s.onerror = function () { rej('renderer not found'); };
        document.head.appendChild(s);
      });
      yrp.catch(function (e) { yrp = null; warn('The renderer did not load: ' + e); });
      return yrp;
    }
    function drawGraphml(t) {    
      var r = window.yrender.render(t === docText && doc ? doc : t, { classes: true, groups: true });
      return [r.svg, r.errors];
    }
    function liveDraw() {    
      if (!gN || cd) return;
      if (liveOrig) Object.keys(liveOrig).forEach(function (i) { if (!liveC || !liveC[i]) undraw(+i); });
      if (!liveC) return;
      liveOrig = liveOrig || {};
      Object.keys(liveC).forEach(function (k) {
        var i = +k, n = nodes2[i], g = gN[n.id], b = liveC[i], o = boxOf(i);
        if (!g) return;
        var first = g.firstElementChild && g.firstElementChild.localName === 'a' ? g.firstElementChild : g;
        var paths = Array.prototype.filter.call(first.querySelectorAll(':scope > path'), function (x) { return !x.classList.contains('m2-ed-dark'); });
        if (!liveOrig[i]) liveOrig[i] = paths.map(function (x) { return [x, x.getAttribute('d')]; });
        var d = outlineD(n.shape, b[0], b[1], b[2], b[3]);
        paths.forEach(function (x) { x.setAttribute('d', d); });
        var pos = n.labPos || 'c', h = pos.charAt(pos.length - 1), v = pos.charAt(0);
        var ddx = /l$/.test(pos) ? b[0] - o[0] : /r$/.test(pos) ? b[0] + b[2] - o[0] - o[2] : b[0] + b[2] / 2 - o[0] - o[2] / 2;
        var ddy = v === 't' ? b[1] - o[1] : v === 'b' ? b[1] + b[3] - o[1] - o[3] : b[1] + b[3] / 2 - o[1] - o[3] / 2;
        first.querySelectorAll(':scope > text').forEach(function (t) { t.setAttribute('transform', 'translate(' + f1(ddx) + ' ' + f1(ddy) + ')'); });
      });
    }
    function shiftedAhead(t, d) {
      var mx = Infinity, my = Infinity, re = /<y:(?:Geometry|Point)\s[^>]*>/g;
      var owner = function (e) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === 'node' && p.namespaceURI === G) return p; return null; };
      var own = new Map();
      Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, 'Geometry'), function (g) { var n = owner(g); if (n && !own.has(n)) own.set(n, g); });
      own.forEach(function (g0, n) {
        var r = realizerOf(n), g = r && r.getElementsByTagNameNS(Y, 'Geometry')[0];
        if (!g) g = g0;    
        mx = Math.min(mx, num(g, 'x')); my = Math.min(my, num(g, 'y'));
      });
      Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, 'Point'), function (p) { mx = Math.min(mx, num(p, 'x')); my = Math.min(my, num(p, 'y')); });
      var block = function (m) { return m < 0 ? Math.ceil((40 - m) / 16) * 16 : 0; }, sx = block(mx), sy = block(my);
      if (!sx && !sy) return t;
      return t.replace(re, function (tag) {
        return tag.replace(/(\sx=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sx) + '"'; })
                  .replace(/(\sy=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sy) + '"'; });
      });
    }
    function noNegative() {
      var mx = Infinity, my = Infinity, re = /<y:(?:Geometry|Point)\s[^>]*>/g;
      nodes2.forEach(function (n, i) { var b = boxOf(i); mx = Math.min(mx, b[0]); my = Math.min(my, b[1]); });
      points.forEach(function (p) { mx = Math.min(mx, num(p, 'x')); my = Math.min(my, num(p, 'y')); });
      var block = function (m) { return m < 0 ? Math.ceil((40 - m) / 16) * 16 : 0; }, sx = block(mx), sy = block(my);
      if (!sx && !sy) return null;
      text = text.replace(re, function (tag) {
        return tag.replace(/(\sx=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sx) + '"'; })
                  .replace(/(\sy=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sy) + '"'; });
      });
      return [sx, sy];
    }
