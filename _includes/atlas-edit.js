  // ---------- editing (--m2-edit: 1; user, 2026-11-12) ----------
  // Moves only: nodes and bend points of a yEd GraphML, nudged in the map window. Nothing is drawn twice: a move changes
  // only the numbers of that position in the file's text (everything else stays byte for byte, so yEd opens it as
  // before), and the viewer's own yEd renderer, run in the browser by Pyodide, draws the map again. Saved back into the
  // file opened (Chrome, Edge), else as a download. Included inside the viewer's script, so it shares its view.
  var ed = (function () {
    var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';   // as the converter's page
    var Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
    var DRIVER = [
      'import sys, json',
      "sys.path.insert(0, '/home/pyodide')",
      'import yrender',
      'def draw(text):',
      "    open('/tmp/edit.graphml', 'w', encoding='utf-8').write(text)",
      '    yrender.errors.clear()',
      "    svg = yrender.Map('/tmp/edit.graphml').svg()",
      '    return json.dumps([svg, list(yrender.errors)])'].join('\n');
    var box = document.getElementById('m2-editwin'), status = document.getElementById('m2-ed-status');
    var overlay = document.getElementById('m2-edit-layer');
    var py = null;                 // a promise of Python with the renderer, from the first edit
    var on = false, map = null;    // editing, and the map object shown while editing
    var text = '', name = '', handle = null, dirty = false;
    var doc = null, geos = [], points = [], nodes2 = [], edges2 = [];
    var x0 = 0, y0 = 0;            // where the drawing's top left is in yEd units
    var selN = [], selP = [];      // selected nodes (indices in nodes2) and bend points (indices in points)
    var undo = [], redo = [], drag = null, band = null, ticket = 0, nudgeAt = 0, timer = null;

    function say(t) { status.textContent = t; }
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

    // the file read: every y:Geometry and y:Point in document order, which is also their order in the text
    function parse() {
      doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw 'not a readable XML file';
      geos = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Geometry'));
      points = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Point'));
      if ((text.match(/<y:Geometry\s/g) || []).length !== geos.length || (text.match(/<y:Point\s/g) || []).length !== points.length)
        throw 'the file is not written as yEd writes it';
      var owner = function (e, tag) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === tag && p.namespaceURI === G) return p; return null; };
      var gi = new Map(), byEl = new Map();
      geos.forEach(function (g, i) { gi.set(g, i); });
      nodes2 = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'node')).map(function (n, i) {
        byEl.set(n, i);
        return { el: n, id: n.getAttribute('id'), geo: [] };
      });
      geos.forEach(function (g, i) { var n = owner(g, 'node'); if (n && byEl.has(n)) nodes2[byEl.get(n)].geo.push(i); });
      nodes2 = nodes2.filter(function (n) { return n.geo.length; });
      byEl = new Map(); nodes2.forEach(function (n, i) { byEl.set(n.el, i); });
      nodes2.forEach(function (n) {   // a group moves with what it holds, as in yEd
        n.inside = Array.prototype.slice.call(n.el.getElementsByTagNameNS(G, 'node')).map(function (c) { return byEl.get(c); }).filter(function (c) { return c != null; });
      });
      var byId = {}; nodes2.forEach(function (n, i) { byId[n.id] = i; });
      var pi = new Map(); points.forEach(function (p, i) { pi.set(p, i); });
      edges2 = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'edge')).map(function (e) {
        return { s: byId[e.getAttribute('source')], t: byId[e.getAttribute('target')],
                 pts: Array.prototype.slice.call(e.getElementsByTagNameNS(Y, 'Point')).map(function (p) { return pi.get(p); }) };
      });
    }
    function num(el, a) { return parseFloat(el.getAttribute(a)); }
    function boxOf(i) { var g = geos[nodes2[i].geo[0]]; return [num(g, 'x'), num(g, 'y'), num(g, 'width'), num(g, 'height')]; }
    function fmt(v) { return String(Math.round(v * 1000) / 1000); }

    // the move: new x and y for some y:Geometry and y:Point, written into the text in one pass, the rest untouched
    function write(g, p) {
      var k = { 'Geometry': -1, 'Point': -1 };
      text = text.replace(/<y:(Geometry|Point)\s[^>]*>/g, function (tag, kind) {
        var i = ++k[kind], v = (kind === 'Geometry' ? g : p)[i];
        if (!v) return tag;
        return tag.replace(/(\sx=")[^"]*"/, '$1' + v[0] + '"').replace(/(\sy=")[^"]*"/, '$1' + v[1] + '"');
      });
    }
    function move(dx, dy) {
      if (!dx && !dy) return;
      var all = new Set();
      selN.forEach(function (i) { all.add(i); nodes2[i].inside.forEach(function (c) { all.add(c); }); });
      var ps = new Set(selP);
      edges2.forEach(function (e) { if (all.has(e.s) && all.has(e.t)) e.pts.forEach(function (p) { ps.add(p); }); });
      var g = {}, p = {};
      all.forEach(function (i) {
        nodes2[i].geo.forEach(function (gi) {
          var el = geos[gi], v = [fmt(num(el, 'x') + dx), fmt(num(el, 'y') + dy)];
          g[gi] = v; el.setAttribute('x', v[0]); el.setAttribute('y', v[1]);
        });
      });
      ps.forEach(function (pi) {
        var el = points[pi], v = [fmt(num(el, 'x') + dx), fmt(num(el, 'y') + dy)];
        p[pi] = v; el.setAttribute('x', v[0]); el.setAttribute('y', v[1]);
      });
      write(g, p);
      dirty = true;
    }
    function remember(merge) {   // the text before a change, for undo; nudges in a row are one step
      var now = Date.now();
      if (!(merge && now - nudgeAt < 800)) { undo.push(text); if (undo.length > 200) undo.shift(); redo = []; }
      nudgeAt = merge ? now : 0;
    }
    function back(from, to) {
      if (!from.length) return;
      to.push(text); text = from.pop(); parse(); selN = []; selP = []; dirty = true; render(); paint();
    }

    // the drawing: the renderer in the browser; the map keeps its place on screen when the drawing's edges change
    function render() {
      var t = ++ticket;
      return python().then(function (p) {
        var r = JSON.parse(p.globals.get('draw')(text));
        if (t !== ticket) return;
        if (r[1].length) say('Drawn with warnings: ' + r[1].join('; '));
        var svg = r[0], m = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/);
        var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        var nx = -parseFloat(m[1]), ny = -parseFloat(m[2]), first = !map.width;
        if (!first) { tx += (nx - x0) * z; ty += (ny - y0) * z; }
        x0 = nx; y0 = ny; map.width = parseFloat(w[1]); map.height = parseFloat(w[2]);
        var pic = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        pic.onload = function () {
          if (t !== ticket || current !== map) return URL.revokeObjectURL(url);
          var old = img.src;
          img.removeAttribute('id'); pic.id = 'm2-img'; pic.alt = map.title; img.replaceWith(pic); img = pic;
          if (old.indexOf('blob:') === 0) URL.revokeObjectURL(old);
          if (first) fit(); else draw();
          if (!r[1].length) say(name + (dirty ? ' (not saved)' : ''));
        };
        pic.src = url;
      }).catch(function (e) { if (t === ticket) say('Not drawn: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); });
    }
    function start(t, n, h) {
      try { text = t; parse(); } catch (e) { say('Cannot edit ' + n + ': ' + e); return; }
      name = n; handle = h; dirty = false; undo = []; redo = []; selN = []; selP = [];
      map = { id: 'edit', title: n, width: 0, height: 0, scale: 1, downloads: [] };
      current = map; on = true;
      nodes = null; sel = null; renderInfo(); drawPin();
      document.getElementById('m2-title').textContent = n;
      grid.classList.add('m2-editing');
      buttons();
      say('Drawing ' + n + '...');
      render();
    }
    function stop() {
      if (!on) return;
      on = false; drag = null; band = null; grid.classList.remove('m2-editing'); paint(); buttons();
      say(dirty ? name + ' has moves not saved: Back to it, or Save.' : 'Open a yEd GraphML file, or edit the map shown.');
    }
    function buttons() {
      ['#m2-ed-save', '#m2-ed-undo', '#m2-ed-redo'].forEach(function (k) { box.querySelector(k).disabled = !on; });
      box.querySelector('#m2-ed-back').hidden = on || !text;
      box.querySelector('#m2-ed-back').textContent = 'Back to ' + name;
      box.querySelector('#m2-ed-stop').hidden = !on;
      var g = graphmlOf(current);
      box.querySelector('#m2-ed-this').hidden = on || !g;
    }
    function graphmlOf(m) {   // a map drawn from its GraphML: that file is first in its downloads
      var d = m && m.downloads && m.downloads[0];
      return d && d.label === 'GraphML' ? d.url : null;
    }

    function save() {
      if (!text) return;
      var blob = new Blob([text], { type: 'application/xml' });
      var done = function () { dirty = false; say('Saved ' + name + ' ' + new Date().toTimeString().slice(0, 5)); };
      var into = function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(done); };
      if (handle) return into(handle).catch(function (e) { say('Not saved: ' + e.message); });
      if (window.showSaveFilePicker) {
        return window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }] })
          .then(function (h) { handle = h; name = h.name; return into(h); })
          .catch(function (e) { if (e.name !== 'AbortError') say('Not saved: ' + e.message); });
      }
      var a = document.createElement('a');   // other browsers: a download
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      done();
    }
    function open() {
      if (window.showOpenFilePicker) {
        window.showOpenFilePicker({ types: [{ description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }] })
          .then(function (hs) { return hs[0].getFile().then(function (f) { return f.text().then(function (t) { start(t, f.name, hs[0]); }); }); })
          .catch(function (e) { if (e.name !== 'AbortError') say('Not opened: ' + e.message); });
        return;
      }
      var input = document.createElement('input');
      input.type = 'file'; input.accept = '.graphml';
      input.onchange = function () { var f = input.files[0]; if (f) f.text().then(function (t) { start(t, f.name, null); }); };
      input.click();
    }
    box.querySelector('#m2-ed-open').addEventListener('click', function () {
      if (dirty && !confirm(name + ' has moves not saved. Open another file?')) return;
      open();
    });
    function editShown() {   // the map on screen, if it is drawn from a GraphML
      var url = graphmlOf(current), m = current;
      if (!url) return;
      if (dirty && !confirm(name + ' has moves not saved. Edit this map instead?')) return;
      say('Opening ' + m.title + '...');
      fetch(url, { cache: 'no-cache' }).then(function (r) { return r.text(); })
        .then(function (t) { start(t, url.split('/').pop(), null); map.title = m.title; document.getElementById('m2-title').textContent = m.title; });
    }
    box.querySelector('#m2-ed-this').addEventListener('click', editShown);
    // the Edit tab starts editing the map shown at once (user, 2026-11-12: "does not look i can edit yet"); a map drawn
    // from a CellDesigner file says why it cannot be edited yet
    function shown() {   // the Edit window open on a map: edit it, or say why not (also when another map is chosen)
      if (!grid.classList.contains('m2-win-edit') || on) return;
      if (graphmlOf(current) && !dirty) return editShown();
      buttons();
      if (!dirty) say(current && current.legend === 'celldesigner'
        ? current.title + ' is drawn from its CellDesigner file, which cannot be edited here yet. Choose a map of the GraphML group, or open a GraphML file.'
        : 'Open a yEd GraphML file, or choose a map drawn from one.');
    }
    document.querySelectorAll('#m2-rail .m2-ri[data-win="edit"]').forEach(function (b) { b.addEventListener('click', shown); });
    box.querySelector('#m2-ed-save').addEventListener('click', save);
    box.querySelector('#m2-ed-undo').addEventListener('click', function () { if (on) back(undo, redo); });
    box.querySelector('#m2-ed-redo').addEventListener('click', function () { if (on) back(redo, undo); });
    box.querySelector('#m2-ed-stop').addEventListener('click', function () { if (chosen) put(chosen); else stop(); });
    box.querySelector('#m2-ed-back').addEventListener('click', function () {
      current = map; on = true; grid.classList.add('m2-editing'); buttons();
      document.getElementById('m2-title').textContent = map.title;
      x0 = y0 = 0; map.width = 0; render();
    });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    // on screen: the selection's outlines and every bend point, over the drawing
    function sx(X) { return tx + (X - x0) * z; }
    function sy(Y2) { return ty + (Y2 - y0) * z; }
    function paint() {
      if (!on || current !== map) { overlay.innerHTML = ''; return; }
      var dx = drag ? drag.dx : 0, dy = drag ? drag.dy : 0, out = [];
      var moving = new Set();
      if (drag) selN.forEach(function (i) { moving.add(i); nodes2[i].inside.forEach(function (c) { moving.add(c); }); });
      var movingP = new Set(selP);
      if (drag) edges2.forEach(function (e) { if (moving.has(e.s) && moving.has(e.t)) e.pts.forEach(function (p) { movingP.add(p); }); });
      selN.forEach(function (i) {
        var b = boxOf(i);
        out.push('<rect class="m2-ed-sel" x="' + (sx(b[0] + dx) - 2) + '" y="' + (sy(b[1] + dy) - 2) + '" width="' + (b[2] * z + 4) + '" height="' + (b[3] * z + 4) + '"/>');
      });
      if (drag) moving.forEach(function (i) {
        if (selN.indexOf(i) >= 0) return;
        var b = boxOf(i);
        out.push('<rect class="m2-ed-ghost" x="' + sx(b[0] + dx) + '" y="' + sy(b[1] + dy) + '" width="' + b[2] * z + '" height="' + b[3] * z + '"/>');
      });
      points.forEach(function (p, i) {
        var m = movingP.has(i), X = num(p, 'x') + (m ? dx : 0), Y2 = num(p, 'y') + (m ? dy : 0);
        out.push('<rect class="m2-ed-pt' + (selP.indexOf(i) >= 0 ? ' m2-on' : '') + '" x="' + (sx(X) - 3.5) + '" y="' + (sy(Y2) - 3.5) + '" width="7" height="7"/>');
      });
      if (band) {
        var a = [Math.min(band.x, band.x2), Math.min(band.y, band.y2)], c = [Math.max(band.x, band.x2), Math.max(band.y, band.y2)];
        out.push('<rect class="m2-ed-band" x="' + sx(a[0]) + '" y="' + sy(a[1]) + '" width="' + (c[0] - a[0]) * z + '" height="' + (c[1] - a[1]) * z + '"/>');
      }
      overlay.innerHTML = out.join('');
    }

    // the pointer: a press on a node or a bend point moves it, Shift adds to the selection, Shift on empty space selects
    // an area; a press on empty space pans the map, as in the viewer
    function at(e) {
      var r = view.getBoundingClientRect(), vx = (e.clientX - r.left) / pz(), vy = (e.clientY - r.top) / pz();
      return [(vx - tx) / z + x0, (vy - ty) / z + y0];
    }
    function hit(P) {
      var R = 6 / z, best = null;
      points.forEach(function (p, i) { if (Math.abs(num(p, 'x') - P[0]) <= R && Math.abs(num(p, 'y') - P[1]) <= R) best = { p: i }; });
      if (best) return best;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i);
        if (P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3] && (!best || b[2] * b[3] < best.area)) best = { n: i, area: b[2] * b[3] };
      });
      return best;
    }
    function editing(e) { return on && current === map && !e.target.closest('.m2-ctrl, .m2-info'); }
    var empty = null;
    view.addEventListener('pointerdown', function (e) {
      empty = null;
      if (!editing(e) || e.button !== 0) return;
      var P = at(e), h = hit(P);
      if (!h && !e.shiftKey) { empty = [e.clientX, e.clientY]; return; }   // the viewer pans; a click clears the selection
      e.stopImmediatePropagation(); e.preventDefault();
      view.setPointerCapture(e.pointerId); view.focus({ preventScroll: true });
      if (!h) { band = { x: P[0], y: P[1], x2: P[0], y2: P[1], add: true }; return; }
      var list = h.p != null ? selP : selN, k = h.p != null ? h.p : h.n, there = list.indexOf(k) >= 0;
      if (e.shiftKey) { if (there) list.splice(list.indexOf(k), 1); else list.push(k); }
      else if (!there) { selN = h.n != null ? [k] : []; selP = h.p != null ? [k] : []; }
      drag = { x: P[0], y: P[1], dx: 0, dy: 0 };
      paint();
    }, true);
    view.addEventListener('pointermove', function (e) {
      if (drag || band) {
        e.stopImmediatePropagation();
        var P = at(e);
        if (band) { band.x2 = P[0]; band.y2 = P[1]; }
        else { drag.dx = Math.round(P[0] - drag.x); drag.dy = Math.round(P[1] - drag.y); }
        paint();
        return;
      }
      if (on && current === map && !e.buttons) view.style.cursor = hit(at(e)) ? 'move' : '';
    }, true);
    function release(e) {
      if (empty && e.type === 'pointerup' && Math.hypot(e.clientX - empty[0], e.clientY - empty[1]) < 5) { selN = []; selP = []; paint(); }
      empty = null;
      if (!drag && !band) return;
      e.stopImmediatePropagation();
      if (band) {
        var a = [Math.min(band.x, band.x2), Math.min(band.y, band.y2)], c = [Math.max(band.x, band.x2), Math.max(band.y, band.y2)];
        nodes2.forEach(function (n, i) { var b = boxOf(i); if (b[0] >= a[0] && b[1] >= a[1] && b[0] + b[2] <= c[0] && b[1] + b[3] <= c[1] && selN.indexOf(i) < 0) selN.push(i); });
        points.forEach(function (p, i) { var X = num(p, 'x'), Y2 = num(p, 'y'); if (X >= a[0] && Y2 >= a[1] && X <= c[0] && Y2 <= c[1] && selP.indexOf(i) < 0) selP.push(i); });
        band = null; paint(); return;
      }
      var d = drag; drag = null;
      if (d.dx || d.dy) { remember(false); move(d.dx, d.dy); render(); }
      paint();
    }
    view.addEventListener('pointerup', release, true);
    view.addEventListener('pointercancel', release, true);

    // the keys: arrows move the selection by 1 (Shift: 10), Ctrl or Cmd with Z undoes, with S saves; Esc clears
    document.addEventListener('keydown', function (e) {
      if (!text) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); save(); return; }
      if (!on || current !== map || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) back(redo, undo); else back(undo, redo); return; }
      if (mod && k === 'y') { e.preventDefault(); back(redo, undo); return; }
      if (e.key === 'Escape') { selN = []; selP = []; paint(); return; }
      var step = e.shiftKey ? 10 : 1, d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();   // while editing the arrows never step to another map
      if (!selN.length && !selP.length) return;
      remember(true); move(d[0], d[1]); paint();
      clearTimeout(timer); timer = setTimeout(render, 150);
    }, true);

    buttons();
    return { paint: paint, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); } };
  })();
