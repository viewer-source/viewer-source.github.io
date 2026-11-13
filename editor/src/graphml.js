    // ---------- the GraphML part (editor/src/graphml.js) ----------
    // A yEd GraphML drawn again by the viewer's yEd renderer (renderers/yrender/yrender.py, run by Pyodide), each node and
    // arc in a group of its own; the shift out of negative places; the compartments' outlines following a drag.

    var DRIVER = [
      'import sys, json',
      "sys.path.insert(0, '/home/pyodide')",
      'import yrender',
      'yrender.CLASSES = True',
      'import html as _h',
      '_node, _edge = yrender.Map.read_node, yrender.Map.edge_svg',
      'def read_node(self, node, parent):',
      '    _node(self, node, parent)',
      "    n = self.nodes.get(node.get('id'))",
      "    if n and not n.get('wrapped'): n['svg'] = '<g data-n=\"' + _h.escape(node.get('id')) + '\">' + n['svg'] + '</g>'; n['wrapped'] = True",
      'def edge_svg(self, e, parent):',
      '    s = _edge(self, e, parent)',
      "    return '<g data-e=\"' + _h.escape(e.get('id') or '') + '\">' + s + '</g>' if s else s",
      'yrender.Map.read_node, yrender.Map.edge_svg = read_node, edge_svg',
      'def draw(text):',
      "    open('/tmp/edit.graphml', 'w', encoding='utf-8').write(text)",
      '    yrender.errors.clear()',
      "    svg = yrender.Map('/tmp/edit.graphml').svg()",
      '    return json.dumps([svg, list(yrender.errors)])'].join('\n');
    function python() {
      if (py) return py;
      say('Loading the renderer (a few seconds the first time)...');
      py = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = PYODIDE + 'pyodide.js'; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      }).then(function () { return loadPyodide({ indexURL: PYODIDE }); }).then(function (p) {
        return Promise.all([p.loadPackage('lxml'), fetch('/renderers/yrender/yrender.py').then(function (r) { if (!r.ok) throw 'renderer not found'; return r.text(); })])
          .then(function (r) { p.FS.mkdirTree('/home/pyodide'); p.FS.writeFile('/home/pyodide/yrender.py', r[1]); p.runPython(DRIVER); return p; });
      });
      py.catch(function (e) { py = null; say('The renderer did not load: ' + e); });
      return py;
    }
    function liveDraw() {   // the compartments' outlines and labels on the picture follow their live boxes (GraphML)
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
    // no negative places (user, 2026-11-12: "negative coordinates in cd are bad", "lets have it universally corrected"):
    // a map moved past the left or the top edge is shifted right or down, each on its own, by whole blocks of the grid
    // (16, so a map on the grid stays on it) to start at 40 or a little more; the drawing stays where it is on screen
    // (the renderer's frame follows). A GraphML here; a CellDesigner file in cd_edit.place
    function noNegative() {
      // what is drawn counts (a closed group's other size, kept by yEd, does not), all of it moves
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
