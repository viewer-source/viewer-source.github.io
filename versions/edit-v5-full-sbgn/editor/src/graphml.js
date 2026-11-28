
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
      var A = afSbgn ? afGraphml(t === docText && doc ? doc.cloneNode(true) : new DOMParser().parseFromString(t, 'application/xml')) : null;
      var r = window.yrender.render(A ? A.doc : t === docText && doc ? doc : t, { classes: true, groups: true, sbgn: !!sb });    
      if (!A) hpMemo = [t, r.ports];    
      return [A ? afUnits(r.svg, A.units) : r.svg, r.errors];
    }
    var afSbgn = false;
    var AF_KINDS = /^(Macromolecule|SimpleChemical|NucleicAcidFeature|UnspecifiedEntity|Complex)$/;
    function afGraphml(d) {    
      var units = [], up = {}, keys = {};
      Array.prototype.forEach.call(d.getElementsByTagNameNS(G, 'key'), function (k) { if (k.getAttribute('for') === 'node') keys[k.getAttribute('id')] = k.getAttribute('attr.name'); });
      var prop = function (n, name) { var x = Array.prototype.filter.call(n.childNodes, function (c) { return c.localName === 'data' && keys[c.getAttribute('key')] === name; })[0]; return x ? x.textContent.trim() : null; };
      var uText = {};    
      Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, 'Resource'), function (q) {
        var gn = q.getElementsByTagNameNS(Y, 'GenericNode')[0], l = gn && /UnitOfInformation$/.test(gn.getAttribute('configuration') || '') && gn.getElementsByTagNameNS(Y, 'NodeLabel')[0];
        if (l) uText[q.getAttribute('id')] = l.textContent;
      });
      var ownNode = function (e) { for (var q = e.parentNode; q; q = q.parentNode) if (q.localName === 'node' && q.namespaceURI === G) return q; return null; };
      Array.prototype.slice.call(d.getElementsByTagNameNS(G, 'node')).forEach(function (n) {
        if (up[n.getAttribute('id')]) return;    
        var rs = ['GenericNode', 'GenericGroupNode'].reduce(function (a, k) { return a.concat(Array.prototype.slice.call(n.getElementsByTagNameNS(Y, k))); }, []).filter(function (r) { return ownNode(r) === n; });
        var kind = null, txt = '';
        rs.forEach(function (r) {
          var k = (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
          if (!AF_KINDS.test(k)) return;
          kind = kind || k;
          r.setAttribute('configuration', 'com.yworks.sbgn.Macromolecule');
          Array.prototype.slice.call(r.getElementsByTagNameNS(Y, 'StyleProperties')).forEach(function (x) { x.parentNode.removeChild(x); });
          var sp = d.createElementNS(Y, 'y:StyleProperties'), pr = d.createElementNS(Y, 'y:Property');
          pr.setAttribute('class', 'java.lang.Integer'); pr.setAttribute('name', 'com.yworks.sbgn.style.radius'); pr.setAttribute('value', '0');
          sp.appendChild(pr); r.appendChild(sp);
          Array.prototype.slice.call(r.getElementsByTagNameNS(Y, 'NodeLabel')).forEach(function (l) { var q = l.getAttribute('iconData'); if (!q) return; if (!txt && uText[q]) txt = uText[q]; l.parentNode.removeChild(l); });
        });
        if (!kind) return;
        var r0 = realizerOf(n) || rs[0], g = r0.getElementsByTagNameNS(Y, 'Geometry')[0];    
        var act = prop(n, 'SBGN class') === 'biological activity';
        units.push([n.getAttribute('id'), act ? prop(n, 'SBGN unit') || '' : sbJs.unitFor(kind) || '', +g.getAttribute('x'), +g.getAttribute('y'), +g.getAttribute('width'), +g.getAttribute('height'), act ? txt.trim() : '']);
        Array.prototype.slice.call(n.childNodes).forEach(function (c) {    
          if (c.localName !== 'graph') return;
          var names = [];
          Array.prototype.forEach.call(c.getElementsByTagNameNS(G, 'node'), function (m) {
            up[m.getAttribute('id')] = n.getAttribute('id');
            var ml = Array.prototype.filter.call(m.getElementsByTagNameNS(Y, 'NodeLabel'), function (l) { return !l.getAttribute('iconData') && l.textContent.trim(); })[0];
            if (ml && !m.getElementsByTagNameNS(G, 'graph').length) names.push(ml.textContent.trim());
          });
          n.removeChild(c);
          rs.forEach(function (r) {
            var l = Array.prototype.filter.call(r.getElementsByTagNameNS(Y, 'NodeLabel'), function (x) { return !x.getAttribute('iconData'); })[0];
            if (!l) return;
            if (!l.textContent.trim() && names.length) { while (l.firstChild) l.removeChild(l.firstChild); l.appendChild(d.createTextNode(names.join(':'))); l.setAttribute('hasText', 'true'); }
            l.setAttribute('modelName', 'internal'); l.setAttribute('modelPosition', 'c');
          });
        });
      });
      Array.prototype.slice.call(d.getElementsByTagNameNS(G, 'edge')).forEach(function (e) {
        var p = e.getElementsByTagNameNS(Y, 'Path')[0];
        if (up[e.getAttribute('source')] && up[e.getAttribute('source')] === up[e.getAttribute('target')]) { e.parentNode.removeChild(e); return; }    
        [['source', 'sx', 'sy'], ['target', 'tx', 'ty']].forEach(function (q) {
          var to = up[e.getAttribute(q[0])];
          if (!to) return;
          e.setAttribute(q[0], to);
          if (p) { p.setAttribute(q[1], '0.0'); p.setAttribute(q[2], '0.0'); }
        });
      });
      return { doc: d, units: units };
    }
    function afUnits(svg, units) {    
      var esc = function (x) { return x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;'); };    
      var byId = {};
      units.forEach(function (u) {
        var B = sbJs.afUnitBox(u.slice(2, 6), u[1], u[6]);
        if (!B) return;    
        var x = B[0], y = B[1], w = B[2], h = B[3], c = h * 0.3, m = y + h / 2, f = function (v) { return Math.round(v * 100) / 100; }, k = sbJs.unitClass(u[1]), D;
        if (k === 'macromolecule') D = 'M' + f(x + c) + ' ' + f(y) + 'H' + f(x + w - c) + 'Q' + f(x + w) + ' ' + f(y) + ' ' + f(x + w) + ' ' + f(y + c) + 'V' + f(y + h - c) + 'Q' + f(x + w) + ' ' + f(y + h) + ' ' + f(x + w - c) + ' ' + f(y + h) +
          'H' + f(x + c) + 'Q' + f(x) + ' ' + f(y + h) + ' ' + f(x) + ' ' + f(y + h - c) + 'V' + f(y + c) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x + c) + ' ' + f(y) + 'Z';    
        else if (k === 'nucleic acid feature') D = 'M' + f(x) + ' ' + f(y) + 'H' + f(x + w) + 'V' + f(y + h - c) + 'Q' + f(x + w) + ' ' + f(y + h) + ' ' + f(x + w - c) + ' ' + f(y + h) + 'H' + f(x + c) + 'Q' + f(x) + ' ' + f(y + h) + ' ' + f(x) + ' ' + f(y + h - c) + 'Z';
        else if (k === 'complex') D = 'M' + f(x + c) + ' ' + f(y) + 'H' + f(x + w - c) + 'L' + f(x + w) + ' ' + f(y + c) + 'V' + f(y + h - c) + 'L' + f(x + w - c) + ' ' + f(y + h) + 'H' + f(x + c) + 'L' + f(x) + ' ' + f(y + h - c) + 'V' + f(y + c) + 'Z';
        else if (k === 'phenotype') D = 'M' + f(x) + ' ' + f(y) + 'H' + f(x + w) + 'L' + f(x + w - c) + ' ' + f(m) + 'L' + f(x + w) + ' ' + f(y + h) + 'H' + f(x) + 'L' + f(x + c) + ' ' + f(m) + 'Z';    
        else D = 'M' + f(x) + ' ' + f(m) + 'A' + f(w / 2) + ' ' + f(h / 2) + ' 0 1 0 ' + f(x + w) + ' ' + f(m) + 'A' + f(w / 2) + ' ' + f(h / 2) + ' 0 1 0 ' + f(x) + ' ' + f(m) + 'Z';    
        var fs = sbJs.afUnitFont(h), T = u[6] ? '<text class="m2-af-ut" x="' + f(x + w / 2) + '" y="' + f(m) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + f(fs) + '" text-anchor="middle" dominant-baseline="central" fill="#000000">' + esc(u[6].replace(/\s*\n\s*/g, ' ')) + '</text>' : '';
        byId[esc(u[0])] = '<path d="' + D + '" fill="white" class="c-white" stroke="#000000"/>' + T;
      });
      var out = [], at = 0, stack = [], re = /<g data-n="([^"]*)">|<g[\s>]|<\/g>/g, mt;
      while ((mt = re.exec(svg))) {
        if (mt[0] === '</g>') { var id = stack.pop(); if (id && byId[id]) { out.push(svg.slice(at, mt.index), byId[id]); at = mt.index; } }
        else stack.push(mt[1] || null);
      }
      out.push(svg.slice(at));
      return out.join('');
    }
    function liveDraw() {    
      if (!gN || cd) return;
      if (liveOrig) Object.keys(liveOrig).forEach(function (i) { if (!liveC || !liveC[i]) undraw(+i); });
      if (!liveC) return;
      liveOrig = liveOrig || {};
      Object.keys(liveC).forEach(function (k) {
        var i = +k, n = nodes2[i], g = gN[n.id], b = liveC[i], o = boxOf(i);
        if (!g || !n.comp) return;    
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
      return t.replace(re, function (tag) { return shiftTag(tag, sx, sy); });
    }
    function shiftTag(tag, sx, sy) {    
      if (sx) tag = tag.replace(/(\sx=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sx) + '"'; });
      if (sy) tag = tag.replace(/(\sy=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sy) + '"'; });
      return tag;
    }
    function noNegative() {
      var mx = Infinity, my = Infinity, re = /<y:(?:Geometry|Point)\s[^>]*>/g;
      nodes2.forEach(function (n, i) { var b = boxOf(i); mx = Math.min(mx, b[0]); my = Math.min(my, b[1]); });
      points.forEach(function (p) { mx = Math.min(mx, num(p, 'x')); my = Math.min(my, num(p, 'y')); });
      var block = function (m) { return m < 0 ? Math.ceil((40 - m) / 16) * 16 : 0; }, sx = block(mx), sy = block(my);
      if (!sx && !sy) return null;
      text = text.replace(re, function (tag) { return shiftTag(tag, sx, sy); });
      return [sx, sy];
    }
