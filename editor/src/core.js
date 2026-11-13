    // ---------- the editor's shared core (editor/src/core.js) ----------
    // Moves only: nodes and bend points of a map, nudged in the map window. A CellDesigner map is edited as the GraphML
    // its part makes of it, so selection, dragging, guides, the grid, undo and saving are one code for both formats.
    // Nothing is drawn twice: a move changes only the numbers of that position in the file's text (everything else stays
    // byte for byte, so yEd or CellDesigner opens it as before), and the map's renderer draws it again. A map of the site
    // is saved by itself, as in Google Docs (user, 2026-11-12): a few seconds after the last move its source file is
    // committed to the site's repository with a GitHub token kept in this browser only, and the site's build redraws it; a
    // file opened from the computer is saved back into it (Chrome, Edge), else as a download.
    // The viewer's own names (the zoom z, the pan tx and ty, the map shown current, its picture img, ...) are read and
    // written through V, the object the viewer hands the editor (user, 2026-11-13: the editor in its own files).

    var lastSvg = null, lastFor = null;   // the last drawing and the texts it was drawn from (keepAhead), kept with the save (the kept drawing itself is the viewer's)
    var Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
    var drawing = false;           // the renderer busy with the last move
    function src() { return cd ? cd.now : text; }   // the map's own file as it is now
    var box = document.getElementById('m2-editwin'), status = document.getElementById('m2-ed-status');
    var overlay = document.getElementById('m2-edit-layer');
    var on = false, map = null;    // editing, and the map object shown while editing
    var text = '', name = '', handle = null, dirty = false;
    var doc = null, geos = [], points = [], nodes2 = [], edges2 = [];
    var docText = null;            // the text doc was read from (kept by a move, which changes both alike): the renderer reuses doc then
    var x0 = 0, y0 = 0;            // where the drawing's top left is in yEd units
    var selN = [], selP = [], selE = [];   // selected nodes (indices in nodes2), bend points (in points), arcs (in edges2)
    var undo = [], redo = [], drag = null, band = null, ticket = 0, nudgeAt = 0, timer = null;
    // moving the item itself while it is dragged (user, 2026-11-12: "in an editor, it's already there when you move it"):
    // the editor's drawing is put in the page as SVG with each node and arc in a group of its own (gN, gE: by id), so a
    // drag shifts the groups at once; an arc with only one end or some bends moving is hidden and drawn as plain lines
    // following the pointer (live) until the renderer has drawn the map again
    var gN = null, gE = null, mv = null, live = null;
    // a move by the arrow keys shown on the drawing at once, as a drag (user, 2026-11-12: a key held showed the result
    // only when let go, the drawing waiting for the keys to stop): what the keys moved since the map was last drawn
    var keyed = null, keyGuides = null;
    // the part of a selected line last pressed (a bend point or an end), which the arrow keys move as a drag would (user,
    // 2026-11-13: "with hand or with keys should be the same way"; the keys moved every bend point of the line at once):
    // { k: the arc, p: a bend point } or { k, port: { k, end, n } }; a line selected with no part pressed is not moved by
    // the keys, as a drag on the line itself does not move it
    var part = null;
    // compartments are containers (user, 2026-11-12): resized by dragging an edge or a handle, and grown by themselves
    // when what they hold is moved past their margin; liveC: their boxes while a drag runs (index in nodes2 -> box),
    // drawn on the picture at once, until the renderer has drawn the map again
    var liveC = null, liveOrig = null;
    // saving to the site: the repository is the site's own (<owner>.github.io), the map's source maps/<file>.graphml
    var TOKEN_KEY = 'atlas-edit-token', AUTOSAVE = 3000;
    var site = null;               // { path, sha } of the map being edited, when it is a map of this site
    var saveTimer = null, saving = null, saveAgain = false, stuck = false;
    // the click data (user, 2026-11-12): the site's boxes of the nodes are those of its own version; the boxes of the
    // nodes moved since follow them, so a click and the search find a molecule where it is drawn now
    var siteRef = null;   // { boxes (per node, yEd units, as in the site's version), x0, y0 (its drawing's frame) }
    // the grid (user, 2026-11-12): two settings, kept in this browser: the grid shown or hidden (shown by default, it
    // also says the map is being edited), snapping to it on or off (off by default; guides come first). The steps are the
    // layout rules' (the layout skill, Grid): node centres on 8 px, bend points on 4 px, blocks on 16 (every second
    // line drawn stronger). The demo's maps are mostly not on any grid: a snapped drag moves a node onto it.
    var GRID_KEY = 'atlas-edit-grid', NODE_STEP = 8, BEND_STEP = 4;
    var gridSet = (function () { try { var g = JSON.parse(localStorage.getItem(GRID_KEY) || '{}'); return { shown: g.shown !== false, snap: g.snap === true }; } catch (e) { return { shown: true, snap: false }; } })();
    function gridKeep() { try { localStorage.setItem(GRID_KEY, JSON.stringify(gridSet)); } catch (e) {} }
    function gridButtons() {
      box.querySelector('#m2-ed-grid').setAttribute('aria-pressed', String(gridSet.shown));   // the switches in the tools row
      box.querySelector('#m2-ed-snap').setAttribute('aria-pressed', String(gridSet.snap));
    }
    // the grid one screen pixel wide (user, 2026-11-13: "2 pixel is too heavy for grid"; it was 1 CSS px, so 2 on a
    // Retina screen, smeared over 3 where a line fell between pixels): drawn on a canvas behind the map at the screen's own
    // pixels, each line on a whole pixel; the tones kept (7 % and 13 % black, user: "already nice")
    var gridCv = null;
    function gridPaint() {   // behind the drawing: lines at multiples of the step in yEd units
      var show = on && V.current === map && gridSet.shown;
      if (!show) { if (gridCv) gridCv.style.display = 'none'; return; }
      if (!gridCv || gridCv.parentNode !== V.view) {
        gridCv = document.createElement('canvas'); gridCv.id = 'm2-ed-gridcv'; gridCv.setAttribute('aria-hidden', 'true');
        gridCv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
        V.view.insertBefore(gridCv, V.view.firstChild);
      }
      gridCv.style.display = '';
      // the canvas exactly as many pixels as the screen gives it (a pixel more or less and the browser rescales it, every
      // line smeared over two pixels again); k: screen pixels per CSS pixel of the map window
      var R = gridCv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = V.view.clientWidth, H = V.view.clientHeight;
      var cw = Math.round(R.width * dpr), ch = Math.round(R.height * dpr), k = cw / W;
      if (gridCv.width !== cw || gridCv.height !== ch) { gridCv.width = cw; gridCv.height = ch; }
      var c = gridCv.getContext('2d'); c.clearRect(0, 0, cw, ch); c.lineWidth = 1;
      var s = NODE_STEP; while (s * V.z < 6) s *= 2;   // never denser than 6 px on screen
      var a = s * V.z, ox = V.tx - x0 * V.z, oy = V.ty - y0 * V.z;
      [['rgba(0,0,0,.07)', 1], ['rgba(0,0,0,.13)', 0]].forEach(function (t) {   // finer lines, then every second stronger
        c.strokeStyle = t[0]; c.beginPath();
        [[ox, W, cw, true], [oy, H, ch, false]].forEach(function (A) {
          var i = Math.ceil(-A[0] / a), v;
          for (; (v = A[0] + i * a) <= A[1]; i++) {
            if (((i % 2) + 2) % 2 !== t[1]) continue;
            var d = Math.round(v * k) + 0.5;
            if (A[3]) { c.moveTo(d, 0); c.lineTo(d, ch); } else { c.moveTo(0, d); c.lineTo(cw, d); }
          }
        });
        c.stroke();
      });
    }
    function toGrid(v, st) { return Math.round(v / st) * st - v; }   // the correction that puts v on the grid
    function baseOf(pub, fr) {
      var all = (pub.match(/<y:Geometry\s[^>]*>/g) || []).map(function (tag) {
        var a = function (n) { var m = tag.match(new RegExp('\\s' + n + '="([^"]*)"')); return m ? parseFloat(m[1]) : NaN; };
        return [a('x'), a('y'), a('width'), a('height')];
      });
      if (all.length !== geos.length) return null;   // not the same file with moves only
      return { boxes: nodes2.map(function (n) { return all[n.ag]; }), x0: fr.x0, y0: fr.y0 };
    }
    // the frame of the picture against the file saved (kept with the edited drawing, the start of the next editing): a
    // CellDesigner drawing is in the file's places, which already hold a shift out of negative places, so 0, 0; the
    // editor's own frame (x0, y0) is that shift less (2026-11-12, user: back in edit mode the map jumped by the shift)
    function picX0() { return cd ? 0 : x0; }
    function picY0() { return cd ? 0 : y0; }
    function nowRef() { return { boxes: nodes2.map(function (n, i) { return boxOf(i); }), x0: x0, y0: y0 }; }
    function repo() { var h = location.hostname; return /\.github\.io$/.test(h) ? h.split('.')[0] + '/' + h : null; }
    function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
    function api(path, opt) {
      opt = opt || {};
      opt.headers = Object.assign({ Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {});
      opt.cache = 'no-store';
      return fetch('https://api.github.com/repos/' + repo() + path, opt);
    }
    function b64(t) {   // UTF-8 text to base64, in pieces (a map is a few hundred KB)
      var u = new TextEncoder().encode(t), s = '';
      for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function changed() {   // after every move, undo or redo: the site's map is saved a few seconds after the last one
      if (site && !token() && !stuck) { warn('Not saved: connect to GitHub below so the moves are saved to the site.'); return; }   // was silent
      if (!site || !token() || stuck) return;
      note('Saving in a moment...');   // the save messages kept during development (user, 2026-11-13), warnings in red beside them
      clearTimeout(saveTimer); saveTimer = setTimeout(push, AUTOSAVE);
    }
    function push(again) {
      clearTimeout(saveTimer); saveTimer = null;
      if (!site || !dirty || stuck) return Promise.resolve();
      if (saving) { saveAgain = true; return saving; }
      if (drawing) { saveTimer = setTimeout(push, 300); return Promise.resolve(); }   // the last move not yet in the file
      var target = site, body = src();
      note('Saving...');
      saving = api('/contents/' + target.path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Moved in the viewer: ' + target.path.split('/').pop(), content: b64(body), sha: target.sha, branch: 'main' }) })
        .then(function (r) {
          return r.json().then(function (d) {
            if (r.ok) {
              target.sha = d.content.sha; target.saved = body;
              if (bank[target.id] && bank[target.id].kept !== target) forget(target.id);   // what was read ahead is older than this save (the copy kept on leaving waits for it: keepAhead)
              learnt(target.path, target.sha);   // the folder's listing read before is older for this map
              if (V.kept && V.kept.id === target.id) V.kept.sha = target.sha;
              var sm = V.byId[target.id];
              if (sm) target.v = V.ver(sm);   // the site's version still without this move
              if (lastSvg && site === target && src() === body) {
                var all = V.stored();
                all[target.id] = { v: target.v, sha: target.sha, svg: lastSvg, width: map.width, height: map.height, x0: picX0(), y0: picY0(), at: Date.now(), ref: siteRef, cur: nowRef() };
                V.store(all);
              }
              if (site === target && src() === body) dirty = false;
              note('Saved. In about 2 minutes it is on the site, and this page updates by itself.');   // no clock time (user, 2026-11-12)
            } else if (r.status === 409 || r.status === 422) {
              // GitHub also refuses a save when its branch moved meanwhile (the site's build commits after each save,
              // user, 2026-11-12: "Not saved" at the second move): the file as it is there now is read, and if it is
              // still what this page last saved, the save goes again on its new sha; only a file changed by someone
              // else stops saving
              return again ? conflict() : Promise.all([api('/contents/' + target.path + '?ref=main').then(function (q) { return q.json(); }),
                api('/contents/' + target.path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (q) { return q.text(); })])
                .then(function (f) {
                  if (f[1] !== (target.saved || target.base)) return conflict();
                  target.sha = f[0].sha; saving = null; saveAgain = false;
                  return push(true);
                }).catch(conflict);
            } else if (r.status === 401 || r.status === 403 || r.status === 404) {
              warn('Not saved: the token was refused (' + r.status + '). Connect again with a token that can write to ' + repo() + '.');
              ghForm(true);
            } else warn('Not saved (' + r.status + '): ' + (d.message || '') + '. The next move tries again.');
          });
        })
        .catch(function (e) { warn('Not saved: no connection (' + e.message + '). The next move tries again.'); })
        .then(function () { if (saving !== mine) return; saving = null; if (saveAgain) { saveAgain = false; if (dirty) return push(); } });
      var mine = saving;
      return saving;
    }
    function conflict() {
      stuck = true; forget(site && site.id); if (site) learnt(site.path, 'changed');   // opened again, the map is read afresh from GitHub
      warn('Not saved: the map was changed on GitHub since it was opened, and it is not overwritten. Stop editing and open the map again to go on from that version.');
    }
    function ghForm(show) {   // the token field: shown while editing a map of this site with no token
      var f = box.querySelector('#m2-ed-gh');
      f.hidden = !show;
      box.querySelector('#m2-ed-gh-off').hidden = show || !token() || !repo();
    }

    // the status line says nothing while things work and only what went wrong, in red (user, 2026-11-13: "when everything
    // works fine, no need to update. I know what I'm doing. But if something goes wrong, this is exactly the note I would
    // like to see"; no save time or mark by the title either: when and how a map is saved is the system's concern). A
    // warning stays until the next thing that works.
    function warn(t) { status.textContent = t; status.classList.add('m2-ed-warn'); }
    function note(t) { status.textContent = t; status.classList.remove('m2-ed-warn'); }   // a save message, in the usual grey
    function quiet() { status.textContent = ''; status.classList.remove('m2-ed-warn'); }

    // the layout skill's tools (user, 2026-11-12): its own code, copied into renderers/layout/ and run here as it is, on the
    // map's text; only the numbers it changes are written back (tidy.py), so the rest stays byte for byte. One undo step.
    // in JavaScript since 2026-11-13 (renderers/layout/layout.js: the same text as tidy.py with the skill's complex_pack.py and
    // snap_grid.py, byte for byte, tests/layout-compare.js), so neither needs Python: layout.tidy(text, what, ids, keepPorts)
    var lay = null;
    function layout() {
      if (lay) return lay;
      lay = new Promise(function (res, rej) {
        if (window.layout) return res(window.layout);
        var s = document.createElement('script');
        s.src = '/renderers/layout/layout.js' + V.build; s.onload = function () { res(window.layout); }; s.onerror = function () { rej('layout tools not found'); };
        document.head.appendChild(s);
      });
      lay.catch(function (e) { lay = null; warn('The layout tools did not load: ' + e); });
      return lay;
    }
    function tool(what, ids, done) {
      if (!on || V.current !== map || !text) return;
      quiet();
      layout().then(function (L) {
        var r = L.tidy(text, what, ids || [], !!cd);
        if (r[1] < 0) { warn(done[2]); return; }
        if (!r[1]) return;   // nothing to change: nothing said
        remember(false); text = r[0]; parse(); selN = []; selP = []; selE = []; dirty = true;
        render(); paint(); changed();
      }).catch(function (e) { warn('Not done: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); });
    }
    box.querySelector('#m2-ed-tidy-grid').addEventListener('click', function () {
      tool('grid', [], ['The map is on the grid already.', 'The map is on the grid. Ctrl or Cmd with Z takes it back.']);
    });

    box.querySelector('#m2-ed-tidy-pack').addEventListener('click', function () {
      var ids = selN.map(function (i) { return nodes2[i].id; });
      tool('pack', ids, [ids.length ? 'Packed already.' : 'Every complex is packed already.',
        (ids.length ? 'Packed.' : 'Every complex packed.') + ' Ctrl or Cmd with Z takes it back.', 'Select a complex, or nothing for every complex.']);
    });

    // the file read: every y:Geometry and y:Point in document order, which is also their order in the text
    function parse() {
      var pd = preDoc.filter(function (x) { return x.text === text; })[0];   // read ahead, each used once
      preDoc = preDoc.filter(function (x) { return x !== pd; });
      doc = pd ? pd.doc : new DOMParser().parseFromString(text, 'application/xml');
      docText = text;
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
        n.kids = n.inside.filter(function (c) { return owner(nodes2[c].el, 'node') === n.el; });
        var r = realizerOf(n.el), g = r && r.getElementsByTagNameNS(Y, 'Geometry')[0];
        n.ag = g && gi.has(g) ? gi.get(g) : n.geo[0];   // the geometry of the realizer shown (a group open or closed)
        n.shape = r ? shapeOf(r) : { kind: 'rectangle', props: {} };
        n.up = null;
        n.comp = n.el.getAttribute('yfiles.foldertype') === 'group' && !/omplex/.test(r ? r.getAttribute('configuration') || '' : '');
        var ins = r && r.getElementsByTagNameNS(Y, 'Insets')[0], iv = function (k) { return ins ? parseFloat(ins.getAttribute(k + 'F') || ins.getAttribute(k)) || 0 : 0; };
        n.ins = [iv('left'), iv('top'), iv('right'), iv('bottom')];
        n.lab = { t: 0, b: 0 };   // its own labels inside, at the top or the bottom (as the layout skill's room())
        if (r) Array.prototype.forEach.call(r.children, function (l) {
          if (l.localName !== 'NodeLabel' || l.getAttribute('modelName') !== 'internal' || l.getAttribute('visible') === 'false') return;
          var side = (l.getAttribute('modelPosition') || '').charAt(0);
          if (side === 't' || side === 'b') n.lab[side] = Math.max(n.lab[side], parseFloat(l.getAttribute('height')) || 0);
          if (!n.labPos) n.labPos = l.getAttribute('modelPosition') || 'c';
        });
      });
      nodes2.forEach(function (n, i) { n.kids.forEach(function (c) { nodes2[c].up = i; }); });
      var byId = {}; nodes2.forEach(function (n, i) { byId[n.id] = i; });
      var pi = new Map(); points.forEach(function (p, i) { pi.set(p, i); });
      edges2 = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'edge')).map(function (e) {
        return { id: e.getAttribute('id'), s: byId[e.getAttribute('source')], t: byId[e.getAttribute('target')], path: e.getElementsByTagNameNS(Y, 'Path')[0] || null,
                 pts: Array.prototype.slice.call(e.getElementsByTagNameNS(Y, 'Point')).map(function (p) { return pi.get(p); }),
                 smooth: e.getElementsByTagNameNS(Y, 'QuadCurveEdge').length > 0 || Array.prototype.some.call(e.getElementsByTagNameNS(Y, 'BendStyle'), function (b) { return b.getAttribute('smoothed') === 'true'; }) };
      });
      var byE = {}; edges2.forEach(function (e, k) { byE[e.id] = k; });
      procs = [];
      nodes2.forEach(function (n, i) {
        var m = n.id.match(/^(.*)\|proc$/);
        if (m && byE[m[1] + '|a'] != null && byE[m[1] + '|b'] != null) procs.push({ g: i, a: byE[m[1] + '|a'], b: byE[m[1] + '|b'] });
      });
    }
    function realizerOf(el) {   // the node's own yEd realizer (of a group: the one shown)
      for (var i = 0; i < el.children.length; i++) {
        var dd = el.children[i];
        if (dd.localName !== 'data') continue;
        for (var j = 0; j < dd.children.length; j++) {
          var r = dd.children[j];
          if (r.namespaceURI !== Y) continue;
          if (r.localName === 'ProxyAutoBoundsNode') {
            var rs = r.getElementsByTagNameNS(Y, 'Realizers')[0];
            return rs ? rs.children[parseInt(rs.getAttribute('active') || '0', 10)] || null : null;
          }
          return r;
        }
      }
      return null;
    }
    function shapeOf(r) {   // as the yEd renderer reads it: the SBGN style or the plain shape, and the style's numbers
      var props = {}, kind;
      Array.prototype.forEach.call(r.getElementsByTagNameNS(Y, 'Property'), function (p) {
        props[(p.getAttribute('name') || '').replace('com.yworks.sbgn.style.', '')] = p.getAttribute('value');
      });
      if (/^Generic/.test(r.localName)) kind = (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
      else { var sh = r.getElementsByTagNameNS(Y, 'Shape')[0]; kind = sh ? sh.getAttribute('type') : 'rectangle'; }
      return { kind: kind, props: props };
    }
    function num(el, a) { return parseFloat(el.getAttribute(a)); }
    function boxOf(i) { var g = geos[nodes2[i].ag]; return [num(g, 'x'), num(g, 'y'), num(g, 'width'), num(g, 'height')]; }
    function fmt(v) { return String(Math.round(v * 1000) / 1000); }

    // the move: new x and y for some y:Geometry and y:Point, written into the text in one pass, the rest untouched
    function write(g, p) {
      var k = { 'Geometry': -1, 'Point': -1 }, same = docText === text;   // the elements of doc got these numbers already (move)
      text = text.replace(/<y:(Geometry|Point)\s[^>]*>/g, function (tag, kind) {
        var i = ++k[kind], v = (kind === 'Geometry' ? g : p)[i];
        if (!v) return tag;
        return tag.replace(/(\sx=")[^"]*"/, '$1' + v[0] + '"').replace(/(\sy=")[^"]*"/, '$1' + v[1] + '"');
      });
      if (same) docText = text;
    }
    function moving() {   // what a move of the selection moves: nodes (a group with what it holds) and bend points
      var all = new Set();
      // a process glyph never moves by itself (user, 2026-11-12: "in CellDesigner, it's not possible to move process
      // itself"): it stays midway on its segment, which moves by its anchor (bend) points and its ends; it goes only with
      // a group that holds its whole reaction
      selN.forEach(function (i) { if (!(cd && /\|proc$/.test(nodes2[i].id))) all.add(i); nodes2[i].inside.forEach(function (c) { all.add(c); }); });
      var ps = new Set(selP);
      selE.forEach(function (k) { edges2[k].pts.forEach(function (p) { ps.add(p); }); });
      edges2.forEach(function (e) { if (all.has(e.s) && all.has(e.t)) e.pts.forEach(function (p) { ps.add(p); }); });
      return { n: all, p: ps, dx: 0, dy: 0 };
    }
    function bx(i) { if (liveC && liveC[i]) return liveC[i]; var b = boxOf(i);
      if (liveG && liveG[i]) return [b[0] + liveG[i][0], b[1] + liveG[i][1], b[2], b[3]]; return mv && mv.n.has(i) ? [b[0] + mv.dx, b[1] + mv.dy, b[2], b[3]] : b; }
    // the compartments round what moves (and round the one resized), grown to hold it as the fit after the drag will:
    // what they hold, plus their Insets and their own labels at the top or bottom; innermost first, never smaller
    function liveFit(seed) {
      var out = seed || {}, set = new Set(), depth = function (i) { var k = 0; for (var u = nodes2[i].up; u != null; u = nodes2[u].up) k++; return k; };
      var up = function (i) { for (var u = nodes2[i].up; u != null; u = nodes2[u].up) if (nodes2[u].comp && !(mv && mv.n.has(u))) set.add(u); };
      if (mv) mv.n.forEach(up);
      Object.keys(out).forEach(function (i) { up(+i); });
      liveC = out;
      Array.from(set).sort(function (a, b) { return depth(b) - depth(a); }).forEach(function (u) {
        var n = nodes2[u], b = bx(u), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        n.kids.forEach(function (k) { var q = bx(k); x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0] + q[2]); y1 = Math.max(y1, q[1] + q[3]); });
        if (x0 === Infinity) return;
        x0 -= n.ins[0]; y0 -= n.ins[1] + n.lab.t; x1 += n.ins[2]; y1 += n.ins[3] + n.lab.b;
        var nb = [Math.min(b[0], x0), Math.min(b[1], y0)];
        nb.push(Math.max(b[0] + b[2], x1) - nb[0], Math.max(b[1] + b[3], y1) - nb[1]);
        if (nb.some(function (v, j) { return Math.abs(v - b[j]) > 0.01; }) || out[u]) out[u] = nb;
      });
      if (!Object.keys(out).length) liveC = null;
      liveDraw();
    }
    function undraw(i) {   // a compartment drawn as the renderer drew it again
      var g = gN && gN[nodes2[i] && nodes2[i].id];
      if (liveOrig && liveOrig[i]) liveOrig[i].forEach(function (q) { q[0].setAttribute('d', q[1]); });
      if (g) g.querySelectorAll('text').forEach(function (t) { t.removeAttribute('transform'); });
      if (liveOrig) delete liveOrig[i];
    }
    function liveOff() { liveC = null; if (liveOrig) Object.keys(liveOrig).forEach(function (i) { undraw(+i); }); liveOrig = null; }
    // the fit after a move or a resize: the layout skill's room() in the browser (tidy.py, 'fit'), the compartments
    // grown or set, their BorderInsets fitted, only those numbers written; the same undo step as the move
    function fitThen(arg, then) {
      if (!arg.resize && !(arg.moved && arg.moved.length)) return then(0);
      layout().then(function (L) {
        var r = L.tidy(text, 'fit', arg, false);
        if (r[1] > 0) { text = r[0]; parse(); dirty = true; }
        then(r[1]);
      }).catch(function (e) { warn('Compartments not fitted: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); then(0); });
    }
    function movedIds(sets) { var a = []; sets.n.forEach(function (i) { a.push(nodes2[i].id); }); return a; }
    // an edge of a compartment under the pointer (5 px on screen), or a handle of one selected: which sides it moves
    function edgeAt(P) {
      var T = 5 / V.z, hs = Math.max(HANDLE / 2, 4 / V.z), best = null;
      selN.forEach(function (i) {
        if (!nodes2[i].comp || best) return;
        var b = bx(i), off = 3.3, L = b[0] - off, Tp = b[1] - off, R = b[0] + b[2] + off, B = b[1] + b[3] + off;
        [[L, Tp, 'lt'], [(L + R) / 2, Tp, 't'], [R, Tp, 'rt'], [L, (Tp + B) / 2, 'l'], [R, (Tp + B) / 2, 'r'], [L, B, 'lb'], [(L + R) / 2, B, 'b'], [R, B, 'rb']].forEach(function (q) {
          if (!best && Math.abs(P[0] - q[0]) <= hs && Math.abs(P[1] - q[1]) <= hs) best = { c: i, s: q[2] };
        });
      });
      if (best) return best;
      nodes2.forEach(function (n, i) {
        if (!n.comp) return;
        var b = bx(i);
        if (P[0] < b[0] - T || P[0] > b[0] + b[2] + T || P[1] < b[1] - T || P[1] > b[1] + b[3] + T) return;
        var s = (Math.abs(P[0] - b[0]) <= T ? 'l' : Math.abs(P[0] - b[0] - b[2]) <= T ? 'r' : '') + (Math.abs(P[1] - b[1]) <= T ? 't' : Math.abs(P[1] - b[1] - b[3]) <= T ? 'b' : '');
        if (s && (!best || b[2] * b[3] < best.area)) best = { c: i, s: s, area: b[2] * b[3] };
      });
      return best;
    }
    function resizeCursor(s) { return s === 'l' || s === 'r' ? 'ew-resize' : s === 't' || s === 'b' ? 'ns-resize' : s === 'lt' || s === 'rb' ? 'nwse-resize' : 'nesw-resize'; }
    function resized(d, P, snapOn) {   // the box of the compartment resized, its sides moved by the drag
      var b = d.rs.b0, s = d.rs.s, x0 = b[0], y0 = b[1], x1 = b[0] + b[2], y1 = b[1] + b[3], dx = P[0] - d.x, dy = P[1] - d.y;
      var g = function (v) { return snapOn ? Math.round(v / NODE_STEP) * NODE_STEP : Math.round(v); };
      if (/l/.test(s)) x0 = g(x0 + dx); if (/r/.test(s)) x1 = g(x1 + dx);
      if (/t/.test(s)) y0 = g(y0 + dy); if (/b/.test(s)) y1 = g(y1 + dy);
      // never smaller than what it holds (the fit after it is exact, this is close)
      var n = nodes2[d.rs.c], cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
      n.kids.forEach(function (k) { var q = boxOf(k); cx0 = Math.min(cx0, q[0]); cy0 = Math.min(cy0, q[1]); cx1 = Math.max(cx1, q[0] + q[2]); cy1 = Math.max(cy1, q[1] + q[3]); });
      if (cx0 !== Infinity) {
        x0 = Math.min(x0, cx0 - n.ins[0]); y0 = Math.min(y0, cy0 - n.ins[1] - n.lab.t);
        x1 = Math.max(x1, cx1 + n.ins[2]); y1 = Math.max(y1, cy1 + n.ins[3] + n.lab.b);
      }
      if (x1 - x0 < 20) { if (/l/.test(s)) x0 = x1 - 20; else x1 = x0 + 20; }
      if (y1 - y0 < 20) { if (/t/.test(s)) y0 = y1 - 20; else y1 = y0 + 20; }
      return [x0, y0, x1 - x0, y1 - y0];
    }
    function pt(pi) { var p = points[pi], o = mv && mv.p.has(pi); return [num(p, 'x') + (o ? mv.dx : 0), num(p, 'y') + (o ? mv.dy : 0)]; }
    function shift() {   // the drag shown on the drawing itself: groups moved, arcs touched hidden (drawn live)
      if (!gN || !mv) return false;
      if (!mv.dx && !mv.dy) { unshift(); return true; }   // back where it started: the arcs drawn as the renderer drew them
      var tr = 'translate(' + mv.dx + ' ' + mv.dy + ')';
      mv.n.forEach(function (i) { var g = gN[nodes2[i].id]; if (g) g.setAttribute('transform', tr); });
      live = live || new Set();
      edges2.forEach(function (e, k) {
        var a = mv.n.has(e.s), b = mv.n.has(e.t), some = e.pts.some(function (p) { return mv.p.has(p); });
        var gs = gE[e.id];   // a CellDesigner line has two groups, its halo's and its own
        if (!gs || !(a || b || some)) return;
        if (a && b) gs.forEach(function (g) { g.setAttribute('transform', tr); });
        else { gs.forEach(function (g) { g.style.display = 'none'; }); live.add(k); }
      });
      glyphFollow(mv.n, mv.p, null);
      return true;
    }
    function unshift() {   // the drawing as it was: a press that moved nothing leaves nothing hidden or shifted
      if (gN) Object.keys(gN).forEach(function (k) { gN[k].removeAttribute('transform'); });
      if (gE) Object.keys(gE).forEach(function (k) { gE[k].forEach(function (g) { g.removeAttribute('transform'); g.style.display = ''; }); });
      live = null; liveG = null; liveOff(); dropCopies(); frozen = false;
    }
    function keyShift(ks, dx, dy) {   // the keys' move on the drawing: groups moved by the sum since the last drawing, arcs touched drawn live
      if (!gN) return;
      keyed = keyed || { n: new Set(), p: new Set(), dx: 0, dy: 0 };
      frozen = false; keyed.dx += dx; keyed.dy += dy; ks.n.forEach(function (i) { keyed.n.add(i); }); ks.p.forEach(function (i) { keyed.p.add(i); });
      var tr = 'translate(' + keyed.dx + ' ' + keyed.dy + ')';
      keyed.n.forEach(function (i) { var g = gN[nodes2[i].id]; if (g) g.setAttribute('transform', tr); });
      live = live || new Set();
      edges2.forEach(function (e, k) {
        var a = ks.n.has(e.s), b = ks.n.has(e.t), some = e.pts.some(function (p) { return ks.p.has(p); });
        var gs = gE[e.id];
        if (!gs || !(a || b || some)) return;
        gs.forEach(function (g) { g.style.display = 'none'; }); live.add(k);   // the file has the new places: drawn from them
      });
      glyphFollow(keyed.n, keyed.p, [keyed.dx, keyed.dy]);
    }
    // the grey guides of a bend point moved by the keys (user, 2026-11-12: as in a drag, to see when a segment is level or
    // upright): one bend point selected alone, a segment drawn while it is exactly level or upright; no snapping, the
    // keys move by whole steps
    function bendGuides(bp) {
      if (bp == null) { if (selP.length !== 1 || selN.length || selE.length) return null; bp = selP[0]; }
      var k = -1, j = -1, out = [];
      edges2.forEach(function (e, i) { var at2 = e.pts.indexOf(bp); if (at2 >= 0) { k = i; j = at2 + 1; } });
      if (k < 0 || edges2[k].s == null || edges2[k].t == null) return null;
      var all = ports(k), B = all[j];
      [beyond(k, j - 1, all)[0], beyond(k, j + 1, all)[0]].forEach(function (q) { if (Math.abs(q[0] - B[0]) < 0.01 || Math.abs(q[1] - B[1]) < 0.01) out.push([B, q]); });
      out = out.concat(joinGuides(bp, B));
      return out.length ? out : null;
    }
    // a bend point moved by the keys stops where one of its segments turns level or upright, when the step would carry it
    // past (a neighbour at x.5 was never met by whole steps, so the guides never showed)
    function keyAlign(bp, d, ms) {
      var k = -1, j = -1;
      edges2.forEach(function (e, i) { var at2 = e.pts.indexOf(bp); if (at2 >= 0) { k = i; j = at2 + 1; } });
      if (k < 0 || edges2[k].s == null || edges2[k].t == null) return d;
      var all = ports(k), B = all[j], out = d.slice();
      [j - 1, j + 1].forEach(function (i) {
        var nb = beyond(k, i, all), pi = nb[1];
        if (pi != null && ms.has(pi)) return;   // a neighbouring bend moving with it is no guide
        [0, 1].forEach(function (a) {
          if (!d[a]) return;
          var q = nb[0][a], from = B[a], to = B[a] + d[a];
          if (Math.abs(q - from) > 0.01 && (q - from) * (q - to) <= 0 && Math.abs(q - from) < Math.abs(out[a])) out[a] = q - from;
        });
      });
      glyphArcs(bp).forEach(function (o) {   // a line meeting the glyph turning level or upright on the way
        [0, 1].forEach(function (a) {
          if (!d[a]) return;
          [0, 1].forEach(function (cm) {
            var J = joinAt(o, bp, B), B2 = B.slice(); B2[a] += d[a];
            var J2 = joinAt(o, bp, B2), r0 = J[0][cm] - J[1][cm], r1 = J2[0][cm] - J2[1][cm];
            if (Math.abs(r0) < 0.05 || r0 * r1 > 0) return;
            var c = joinSolve(o, bp, B, a, cm);
            if (c != null && c * d[a] > 0 && Math.abs(c) <= Math.abs(d[a]) + 1e-6 && Math.abs(c) < Math.abs(out[a])) out[a] = c;
          });
        });
      });
      return out;
    }
    function move(dx, dy, sets) {
      if (!dx && !dy) return;
      sets = sets || moving();
      var all = sets.n, ps = sets.p;
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
      to.push(text); text = from.pop(); parse(); selN = []; selP = []; selE = []; part = null; dirty = true; render(); paint(); changed();
    }

    // the drawing: the renderer in the browser; the map keeps its place on screen when the drawing's edges change
    function render() {
      var t = ++ticket;
      drawing = true;
      return (cd ? cdpy() : yr()).then(function (p) {
        var r;
        if (cd) {   // the moves written into the CellDesigner file, drawn, and the GraphML made of it again
          var dm = drawMemo && drawMemo.cd && drawMemo.base === cd.base && drawMemo.text === text ? drawMemo : null;
          var q = dm ? dm.q : p.draw(cd.base, text);
          if (t !== ticket) return;
          cd.now = q[1]; r = [q[0], []]; cdBase = { now: q[1], text: q[2] };   // what the live drawing of a move starts from
          if (q[2] !== text && !drag) {   // the same map, its new bend points (a glyph moved) now its own
            var ids = selN.map(function (i) { return nodes2[i].id; }), np = points.length;
            text = q[2]; parse();
            selN = ids.map(function (id) { return nodes2.findIndex(function (n) { return n.id === id; }); }).filter(function (i) { return i >= 0; });
            if (points.length !== np) { selP = []; selE = []; }
          }
        } else {
          // shifted: the editor's places moved, so its frame moves with them and nothing moves on screen (2026-11-12: the
          // shift was taken for a new frame of the drawing and the map jumped right and down, out of sight on some maps)
          var sh = !drag && noNegative();
          if (sh) { parse(); x0 += sh[0]; y0 += sh[1]; }
          r = drawMemo && !drawMemo.cd && drawMemo.text === text ? drawMemo.r : drawGraphml(text);
        }
        if (t !== ticket) return;
        drawing = false;
        if (r[1].length) warn('Drawn with warnings: ' + r[1].join('; '));
        var svg = r[0]; lastSvg = svg; lastFor = [text, cd ? cd.now : null]; var m = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/);
        var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        var nx = -parseFloat(m[1]), ny = -parseFloat(m[2]), first = !map.width;
        if (!first) { V.tx += (nx - x0) * V.z; V.ty += (ny - y0) * V.z; }
        x0 = nx; y0 = ny; map.width = parseFloat(w[1]); map.height = parseFloat(w[2]);
        (function () {
          if (V.current !== map) return;
          var rec = V.recolour(svg), dm = drawMemo && drawMemo.pic && drawMemo.rec === rec ? drawMemo : null;   // the page's elements made ahead, used once
          var pic = dm ? dm.pic : document.importNode(new DOMParser().parseFromString(rec, 'image/svg+xml').documentElement, true);
          if (dm) dm.pic = null;
          pic.style.visibility = '';   // a drawing kept on leaving edit was hidden by the viewer while the site's picture loaded (2026-11-13: empty map on going back to edit)
          var old = V.img.src || '';
          V.img.removeAttribute('id'); pic.id = 'm2-img'; pic.setAttribute('aria-label', map.title); V.img.replaceWith(pic); V.img = pic;
          if (old.indexOf('blob:') === 0) URL.revokeObjectURL(old);
          gN = {}; gE = {}; live = null; liveC = null; liveOrig = null; keyed = null; liveG = null; copies = []; frozen = false;
          pic.querySelectorAll('[data-n]').forEach(function (g) { gN[g.getAttribute('data-n')] = g; });
          pic.querySelectorAll('[data-e]').forEach(function (g) { var k = g.getAttribute('data-e'); (gE[k] = gE[k] || []).push(g); });
          if (cd) cdSessionSoon();
          if (first) V.fit(); else V.draw();
          if (!r[1].length && !saveTimer && !saving && !dirty) quiet();
        })();
      }).catch(function (e) { if (t === ticket) { drawing = false; warn('Not drawn: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); } });
    }
    function start(t, n, h, s, same) {   // a CellDesigner file is first made into the GraphML the editor edits
      if (!isCd(t)) { cd = null; return begin(t, t, n, h, s, same); }
      quiet();
      return cdpy().then(function () { cd = { base: t, now: t }; begin(cdGraphml(t), t, n, h, s, same); })
        .catch(function (e) { warn('Cannot edit ' + n + ': ' + e); });
    }
    function begin(g, t, n, h, s, same) {   // same: { width, height, x0, y0, scale } of the picture on screen, drawn from this very file
      try { text = g; parse(); } catch (e) { warn('Cannot edit ' + n + ': ' + e); return; }
      siteRef = null; name = n; handle = h; site = s || null; if (site) site.base = t; stuck = false; dirty = false; undo = []; redo = []; selN = []; selP = []; selE = [];
      map = { id: 'edit', title: openTitle || n, width: 0, height: 0, scale: 1, downloads: [] };
      if (same) {   // editing starts on the picture as it is: no redraw, the map stays where it is (user, 2026-11-12)
        map.width = same.width; map.height = same.height; map.scale = same.scale; x0 = same.x0; y0 = same.y0;
      }
      V.current = map; on = true;
      if (cd) plainCanvas();
      V.nodes = null; V.sel = null; V.renderInfo(); V.drawPin();
      document.getElementById('m2-title').textContent = n;
      V.grid.classList.add('m2-editing');
      buttons();
      gN = gE = null; mv = live = null; liveG = null; copies = []; frozen = false; cdBase = null;
      if (same && same.text === t) { (cd ? cdpy() : yr()).then(function () { if (on && V.current === map && !undo.length && !gN) render(); }); paint(); quiet(); return; }
      quiet();
      render();
    }
    function stop() {
      if (!on) return;
      if (saveTimer) push();   // a move still waiting is saved now
      if (site && site.id && undo.length) V.kept = { id: site.id, v: site.v, sha: site.sha, pic: V.img, width: map.width, height: map.height, x0: picX0(), y0: picY0(), text: src(), ref: siteRef, cur: nowRef() };
      if (helpBox) help(false);
      on = false; drag = null; band = null; V.grid.classList.remove('m2-editing'); paint(); buttons();
      if (dirty && !site) warn(name + ' has moves not saved: Back to it, or Save.'); else quiet();
      drawMemo = null; preDoc = [];   // what was read ahead for this opening, let go
      if (!keepAhead()) forget(editPre && editPre.id);   // else read afresh (a conflict, a move not saved: the repository may differ)
      aheadSoon();
    }
    // going back to edit at once (user, 2026-11-13: switching back and forth waited 0.5-1.5 s, the read-ahead thrown away
    // on leaving and read again over the network, the drawing made again): what the editor holds of the site's map it
    // edited is kept as that map's read-ahead: the site's files as read before, the repository's version as this page
    // last saved it (its sha from GitHub's answer, once a save under way is done), and the editor's own drawing of it.
    // Not when a move is not saved or saving stopped. The check of GitHub just after the switch (recheck) stays
    function keepAhead() {
      var s = site, m = s && s.id ? V.byId[s.id] : null, old = editPre;
      if (!m || !old || stuck || s.pending || old.key !== preKey(m)) return false;
      var p = { key: old.key, id: old.id, path: old.path, file: old.file, img: old.img, sitePub: old.sitePub, siteFrame: old.siteFrame, kept: s };
      // the version as saved once a save under way is done; a save that did not go through: GitHub read afresh
      p.gh = (saving || Promise.resolve()).then(function () {
        if (stuck || !s.sha || (dirty && site === s)) throw 'not saved';
        return { sha: s.sha, text: s.saved || s.base };
      }).catch(function () { return ghRead(p.path); });
      p.gh.catch(function () { if (bank[p.id] === p) forget(p.id); });
      p.sitePub.catch(function () {});
      bank[p.id] = p;
      // the drawing on screen kept with it, only when it is the drawing of the text the next editing starts from: every
      // move in the text drawn, none moving; made ahead now, or once the save under way has written that very text
      var S = src(), g = text, d0 = doc, el = V.img, svg = lastSvg;
      if (!(svg && !drawing && !mv && !keyed && !liveC && docText === g && lastFor && lastFor[0] === g && lastFor[1] === (cd ? S : null))) return true;
      var isCd = !!cd, make = function () {
        var dm = isCd ? { cd: true, base: S, text: g, q: [svg, S, g] } : { cd: false, text: g, r: [svg, []] };
        if (isCd) cdRemember(S, g);
        p.memo = dm; p.docs = [{ text: g, doc: d0 }]; p.drawn = Promise.resolve();
        if (el === V.img && el.tagName.toLowerCase() === 'svg' && el.querySelector('[data-e]')) {   // the page's drawing itself
          el.querySelectorAll('.m2-ed-copy').forEach(function (x) { x.remove(); });
          el.querySelectorAll('[data-n],[data-e]').forEach(function (x) { x.removeAttribute('transform'); x.style.display = ''; x.classList.remove('m2-ed-blue'); });
          dm.rec = V.recolour(svg); dm.pic = el;
          return;
        }
        idle().then(function () {
          if (p.memo !== dm || on) return;
          dm.rec = V.recolour(svg);
          dm.pic = document.importNode(new DOMParser().parseFromString(dm.rec, 'image/svg+xml').documentElement, true);
        });
      };
      if (!dirty && !saving && S === (s.saved || s.base)) make();
      else p.gh.then(function (r) { if (r && r.text === S && bank[p.id] === p && !on) make(); }, function () {});
      return true;
    }
    function buttons() {
      ['#m2-ed-save', '#m2-ed-undo', '#m2-ed-redo', '#m2-ed-grid', '#m2-ed-snap', '#m2-ed-tidy-grid', '#m2-ed-tidy-pack', '#m2-ed-help'].forEach(function (k) { box.querySelector(k).disabled = !on; });   // Grid and Snap too (user, 2026-11-13: on while the rest waited, two stories in one row)   // the layout skill's tools on both formats (a CellDesigner map through cd_edit's GraphML, its ports kept)
      box.querySelector('#m2-ed-save').hidden = !!site;   // a map of the site saves by itself
      ghForm(!!(on && site && !token()));
      box.querySelector('#m2-ed-back').hidden = on || !text;
      box.querySelector('#m2-ed-back').textContent = 'Back to ' + name;
      box.querySelector('#m2-ed-stop').hidden = !on;
      var g = graphmlOf(V.current);
      box.querySelector('#m2-ed-this').hidden = on || !g;
      // the Edit tab only on a map that can be edited, or while a file is being edited (user, 2026-11-12: "do not show
      // edit icon for maps that can not be edited"); its window gives way to the Maps list when the tab goes
      var off = !on && !(dirty && !site) && !g;
      V.grid.classList.toggle('m2-edit-off', off);
      if (off && V.win === 'edit') { V.win = 'list'; V.railMark(); }
    }
    function graphmlOf(m) {   // a map drawn from its own file, GraphML or CellDesigner (2026-11-12): that file is first in its downloads
      var d = m && m.downloads && m.downloads[0];
      return d && (d.label === 'GraphML' || d.label === 'CellDesigner') ? d.url : null;
    }

    function save() {
      if (!text) return;
      if (site) { if (token()) push(); return; }
      var blob = new Blob([src()], { type: 'application/xml' });
      var done = function () { dirty = false; quiet(); };
      var into = function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(done); };
      if (handle) return into(handle).catch(function (e) { warn('Not saved: ' + e.message); });
      if (window.showSaveFilePicker) {
        return window.showSaveFilePicker({ suggestedName: name, types: [cd ? { description: 'CellDesigner', accept: { 'application/xml': ['.xml'] } } : { description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }] })
          .then(function (h) { handle = h; name = h.name; return into(h); })
          .catch(function (e) { if (e.name !== 'AbortError') warn('Not saved: ' + e.message); });
      }
      var a = document.createElement('a');   // other browsers: a download
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      done();
    }
    // what editing a map needs, loaded ahead while the map is only shown (user, 2026-11-13: the switch to edit should
    // be "immediate and immediately functional", not only look so): the map's own file, the frame of its drawing, with a
    // token the repository's version and its sha, the renderer and, on a CellDesigner map, the GraphML the editor edits.
    // The switch then waits for nothing. Dropped after a save (unless kept on leaving: keepAhead), after a refused save
    // and when the site's version changes.
    // Every map, not only the one shown (user, 2026-11-13: "silently get to the after-background-reading state for all
    // maps", nearest the map shown first, lowest priority): the files and a CellDesigner map's GraphML for every map that
    // can be edited, one map at a time once the viewer's pictures are in; the editor's drawing (the heavy part, in
    // memory) only for the map shown and its two nearest, dropped for maps further away. One entry per map in bank.
    var bank = {}, preTimer = null, sweepT = 0, openTitle = null, drawMemo = null, preDoc = [], editPre = null;   // drawMemo, preDoc: the drawing and documents of the map being opened
    function preKey(m) { return m.id + '|' + V.ver(m) + '|' + (repo() && token() ? 'gh' : ''); }
    function forget(id) { if (id && bank[id]) delete bank[id]; }
    // the repository's version of a map and its sha (two calls side by side); null: not a map of this repository
    function ghRead(path) {
      if (!(repo() && token())) return Promise.resolve(undefined);
      return Promise.all([
        api('/contents/' + path + '?ref=main'),
        api('/contents/' + path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } })
      ]).then(function (r) {
        if (r[0].status === 404) return null;
        if (!r[0].ok) throw r[0].status;
        if (!r[1].ok) throw r[1].status;
        return Promise.all([r[0].json(), r[1].text()]).then(function (d) { return { sha: d[0].sha, text: d[1] }; });
      });
    }
    // the versions of all maps in one call (the folder's listing: each file's git sha), in place of two calls per map:
    // a map whose site copy has the repository's sha is the repository's version, read from the site; only a map changed
    // since the site's build is read from GitHub. Kept 5 minutes; null: no listing (each map read on its own)
    // known: a newer sha this page learnt for a path after asking for the listing (its own save, the check after a
    // switch, a refused save), with when; it outranks a listing asked for before it, so a stale listing never hides a
    // version GitHub already said is newer (the review, 2026-11-13: else the check after the switch reopened in a loop)
    var ghDir = null, known = {};
    function ghList() {
      if (ghDir && Date.now() - ghDir.at < 300000) return ghDir;
      ghDir = { at: Date.now() };
      ghDir.p = api('/contents/maps?ref=main').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!Array.isArray(d) || d.length >= 1000) return null;   // GitHub lists at most 1000 files here: then map by map
        var o = {};
        d.forEach(function (f) { o[f.path] = f.sha; });
        return o;
      }).catch(function () { return null; });
      return ghDir;
    }
    function learnt(path, sha) { known[path] = { sha: sha, at: Date.now() }; }
    function blobSha(t) {   // git's sha of a text, as GitHub gives it
      var u = new TextEncoder().encode(t), h = new TextEncoder().encode('blob ' + u.length + '\0'), all = new Uint8Array(h.length + u.length);
      all.set(h); all.set(u, h.length);
      return crypto.subtle.digest('SHA-1', all).then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); });
    }
    function ghFor(path, sitePub) {
      if (!(repo() && token())) return Promise.resolve(undefined);
      var L = ghList();
      return L.p.then(function (d) {
        if (!d || !window.crypto || !crypto.subtle) return ghRead(path);
        var k = known[path], sha = k && k.at >= L.at ? k.sha : d[path];
        if (!sha) return ghRead(path);   // not in the listing (a map added since): GitHub asked, its 404 says not a map of this repository
        return sitePub.then(blobSha).then(function (h) {
          return h === sha ? sitePub.then(function (t) { return { sha: sha, text: t }; }) : ghRead(path);
        }, function () { return ghRead(path); });
      });
    }
    function frameOf(p) {   // the frame of the site's drawing (its size and the offset of yEd's coordinates), read when wanted
      if (!p.siteFrame) p.siteFrame = fetch(p.img).then(function (r) { return r.text(); }).then(function (svg) {
        var t = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/), w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        return w ? { width: parseFloat(w[1]), height: parseFloat(w[2]), x0: t ? -parseFloat(t[1]) : 0, y0: t ? -parseFloat(t[2]) : 0, scale: 1 } : null;   // a CellDesigner drawing: no offset
      }).catch(function () { return null; });
      return p.siteFrame;
    }
    var idle = function () { return new Promise(function (res) { (window.requestIdleCallback || function (f) { setTimeout(f, 0); })(res); }); };
    // lowest priority (user, 2026-11-13: "truly does not compete with anything else"): a step for a map other than the
    // one shown waits until the reader has not clicked, scrolled, dragged or typed for 1.5 s, then for an idle moment.
    // A step cannot be stopped once begun (the largest, a big CellDesigner map's conversion, 80-160 ms measured
    // headless), so it starts only while the reader is reading, not moving
    var lastInput = 0, mark = function () { lastInput = Date.now(); };
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (k) { document.addEventListener(k, mark, { capture: true, passive: true }); });
    document.addEventListener('pointermove', function (e) { if (e.buttons) mark(); }, { capture: true, passive: true });
    function calm() {
      return new Promise(function (res) {
        (function w() { var q = Date.now() - lastInput; if (q >= 1500) idle().then(res); else setTimeout(w, 1500 - q); })();
      });
    }
    function waitFor(m) { return V.current && V.current.id === m.id ? idle() : calm(); }   // the map shown: an idle moment is enough
    // a map's entry: its files asked for now (the map shown at the browser's usual priority, the others low), then, in
    // idle moments, the renderer and a CellDesigner file's GraphML (p.ready, the text editing starts from)
    function ahead(m, low) {
      var url = graphmlOf(m);
      if (!url) return null;
      var key = preKey(m), old = bank[m.id];
      if (old && old.key === key && (!old.bad || (low && Date.now() - old.bad < 300000))) return old;
      var file = url.split('?')[0].split('/').pop(), path = 'maps/' + file;
      var p = { key: key, id: m.id, path: path, file: file, img: m.image + V.ver(m) };
      p.sitePub = fetch(url, { cache: 'no-cache', priority: low ? 'low' : 'auto' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
      // the repository's version (newer than the site while a build runs) and its sha, which makes GitHub refuse a save
      // over a version changed meanwhile; null: not a map of this repository (saved as a file)
      p.gh = ghFor(path, p.sitePub);
      // a file or GitHub that failed: the sweep leaves the map for 5 minutes (a refused token, a rate limit, no
      // connection: else every map switch asked again for every map); opening the map asks afresh
      var drop = function () { p.bad = p.bad || Date.now(); };
      p.sitePub.catch(drop); p.gh.catch(drop);
      bank[m.id] = p;
      return p;
    }
    function readyOf(p, m) {   // made again when an earlier try stopped (editing began, a newer entry)
      if (p.ready) return p.ready;
      var cdm = cdMap(m), still = function () { return bank[m.id] === p && !on; };
      var r = p.ready = (cdm ? cdpy() : yr()).then(function () {
        // the edited text this page holds for the map, read without V.keep (it would load a stored drawing and replace
        // the viewer's kept one: the review, 2026-11-13)
        var k = V.kept && V.kept.id === m.id && V.behind(m, V.kept) ? V.kept : null;
        return Promise.all([k && k.text ? k.text : p.sitePub, p.gh]);
      }).then(function (x) {
        p.t = x[1] ? x[1].text : x[0];
        if (!cdm) return p;   // a GraphML map is ready as it is
        return waitFor(m).then(function () {
          if (!still()) throw 0;
          p.g = cdKnown(p.t) || cdJs.graphml(p.t);   // a CellDesigner file made into the editor's GraphML: a step of its own
          return p;
        });
      });
      r.catch(function () { if (p.ready === r) p.ready = null; });
      return r;
    }
    // the editor's own drawing of a map (each node and line in a group of its own, for live drags), made from the text
    // editing will start from, so the switch only puts it in (the other session's measure, 2026-11-13: 100-320 ms of
    // frozen page on entering edit on large maps). In steps, each in its own idle moment, so no step freezes the page
    // long enough to be felt while the map is only looked at (one step was 84-134 ms on large maps)
    function drawAhead(p, m) {
      if (p.drawn) return p.drawn;
      var cdm = cdMap(m), mine = {};
      var still = function () { return bank[m.id] === p && !on && p.drawn === mine.p; };
      var rd = function (x) { return new DOMParser().parseFromString(x, 'application/xml'); };
      var g, d, g2, d2, dm;
      frameOf(p);
      mine.p = p.drawn = readyOf(p, m).then(function () {
        if (!still()) throw 0;
        g = cdm ? p.g : p.t;
        d = rd(g);
        g2 = cdm ? g : shiftedAhead(g, d);   // a map with negative places is shifted on entering edit (noNegative)
        d2 = g2 === g ? d : rd(g2);
        p.docs = g2 === g ? [{ text: g, doc: d }] : [{ text: g, doc: d }, { text: g2, doc: d2 }];   // the documents the editor reads its file into
        return waitFor(m);
      }).then(function () {
        if (!still()) throw 0;
        if (cdm) dm = { cd: true, base: p.t, text: g, q: cdJs.draw(p.t, g) };
        else { var y = window.yrender.render(d2, { classes: true, groups: true }); dm = { cd: false, text: g2, r: [y.svg, y.errors] }; }   // the renderer only reads the document
        p.memo = dm;
        return waitFor(m);
      }).then(function () {
        if (!still() || p.memo !== dm) throw 0;
        dm.rec = V.recolour(cdm ? dm.q[0] : dm.r[0]);   // the drawing as the page's elements, ready to put in
        dm.pic = document.importNode(new DOMParser().parseFromString(dm.rec, 'image/svg+xml').documentElement, true);
      });
      mine.p.catch(function () { if (p.drawn === mine.p) p.drawn = null; });
      return mine.p;
    }
    function dropDrawing(p) { p.drawn = null; p.memo = null; p.docs = null; }
    // the sweep: the map shown first, then the others nearest it in the list, one at a time; maps beyond the two nearest
    // only once the viewer's own pictures are in (V.netIdle), so nothing here competes with what the reader looks at
    function sweep() {
      var cur = V.current, t = ++sweepT, here = cur ? V.maps.indexOf(V.byId[cur.id]) : -1;   // by id: a map just edited is shown as a copy of its entry
      if (here < 0) return;
      var list = V.maps.filter(function (m) { return graphmlOf(m); }).map(function (m, i) { return [m, Math.abs(V.maps.indexOf(m) - here), i]; })
        .sort(function (a, b) { return a[1] - b[1] || a[2] - b[2]; }).map(function (x) { return x[0]; });
      var near = list.slice(0, 3);
      Object.keys(bank).forEach(function (id) { if (!V.byId[id]) delete bank[id]; else if (!near.some(function (m) { return m.id === id; })) dropDrawing(bank[id]); });   // the drawings of maps further away let go
      var i = 0;
      var next = function () {
        if (t !== sweepT || on || i >= list.length) return;
        var m = list[i], bg = m.id !== cur.id;
        if (bg && V.netIdle && !V.netIdle()) { setTimeout(next, 500); return; }   // the viewer's pictures first
        var go = function () { if (t !== sweepT || on) return; var p = ahead(m, bg); i++; (near.indexOf(m) >= 0 ? drawAhead(p, m) : readyOf(p, m)).then(idle, idle).then(next); };
        if (bg) calm().then(go); else go();   // a map's file asked for only while the reader is not moving either
      };
      next();
    }
    function aheadSoon() {   // after the map has shown, when the browser is idle, only where the Edit tab is
      clearTimeout(preTimer);
      sweepT++;   // a sweep under way stops
      preTimer = setTimeout(function () {
        idle().then(function () {
          var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
          if (on || !eb || !eb.offsetParent) return;
          sweep();
        });
      }, 300);
    }
    function editShown() { return editMap(V.current); }   // the map on screen, if it is drawn from its own GraphML or CellDesigner file
    function editMap(m) {
      var url = graphmlOf(m);
      if (!url) return;
      if (dirty && !site && !confirm(name + ' has moves not saved. Edit this map instead?')) return;
      if (saveTimer) push();
      var p = ahead(m), file = p.file, path = p.path;
      editPre = p;   // kept on leaving (keepAhead)
      // the picture on screen is the site's drawing of its published file: its frame (size and the offset of yEd's
      // coordinates) is read from that SVG, so editing starts on it without a redraw; the moved map is drawn again
      var k = V.keep(m), shownPic = V.img;
      var published = k && k.text ? Promise.resolve(k.text) : p.sitePub;
      var frame = k ? Promise.resolve({ width: k.width, height: k.height, x0: k.x0, y0: k.y0, scale: 1 }) : frameOf(p);
      var go = function (t, s) {
        return Promise.all([published, frame, p.sitePub, frameOf(p)]).then(function (r) {
          // what was read ahead for this map handed to the editor, used once (made again by the sweep if wanted)
          drawMemo = p.memo || null; preDoc = p.docs || [];
          if (p.g && p.t === t) cdRemember(t, p.g);
          dropDrawing(p);
          var same = r[1] && V.img === shownPic && V.current === m ? Object.assign({}, r[1], { text: r[0] }) : null;
          if (s) { s.id = m.id; s.v = V.ver(m); }
          openTitle = m.title;   // the map's own title in the first line said, not its file's name
          return Promise.resolve(start(t, file, null, s, same)).then(function () {
            openTitle = null;
            siteRef = r[3] ? baseOf(isCd(r[2]) && cdJs ? cdGraphml(r[2]) : r[2], r[3]) : null;
            map.title = m.title; document.getElementById('m2-title').textContent = m.title;
          });
        });
      };
      // the map's own file not loaded (the site's copy missing, no connection): said, not left at Opening
      var notLoaded = function (e) { warn('Cannot edit ' + m.title + ': its file did not load (' + e + ').'); };
      var fromSite = function (s) { return published.then(function (t) { return go(t, s); }).catch(notLoaded); };
      quiet();
      if (!repo()) return fromSite(null);
      if (!token()) return fromSite({ path: path, sha: null, pending: true });
      p.gh.then(function (g) {
        if (!g) return fromSite(null);   // not a map of this repository: saved as a file
        return go(g.text, { path: path, sha: g.sha }).then(function () { recheck(p, g, m); }, notLoaded);
      }, function (e) { warn('Could not read the map from GitHub (' + e + '); the token may be refused.'); ghForm(true); });
    }
    // the repository's version read ahead may have changed since (another tab, another person): checked once more right
    // after the switch, in the background; with no move made yet editing simply goes on from the newer version, with a
    // move made the save finds it and says so, as before
    function recheck(p, g, m) {
      var s0 = site;
      api('/contents/' + p.path + '?ref=main').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || d.sha === g.sha || !on || site !== s0) return;
        learnt(p.path, d.sha);
        if (bank[p.id] === p) forget(p.id);
        if (!undo.length && !dirty) { on = false; editMap(m); }   // the site's map, not the editor's own (V.current is that now)
      }).catch(function () {});
    }
    // the token: pasted once, checked against the repository, kept in this browser only (localStorage)
    box.querySelector('#m2-ed-gh-go').addEventListener('click', function () {
      var v = box.querySelector('#m2-ed-gh-token').value.trim();
      if (!v) return;
      try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { warn('This browser does not keep the token.'); return; }
      quiet();
      api('').then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (d) {
        if (!d.permissions || !d.permissions.push) throw 'it cannot write to ' + repo();
        box.querySelector('#m2-ed-gh-token').value = '';
        var moved = dirty;
        if (on && site) {   // connected while editing: go on from the repository's version, keeping the moves made
          var keep = text;
          var s0 = site;   // (s0.base: the text editing started from)
          Promise.all([api('/contents/' + s0.path + '?ref=main').then(function (r) { return r.json(); }),
            api('/contents/' + s0.path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (r) { return r.text(); })])
            .then(function (f) {
              s0.sha = f[0].sha; s0.pending = false; buttons();
              if (f[1] !== s0.base) { stuck = true; warn('Connected, but the map in the repository is newer than the copy opened: moves not saved, nothing overwritten. Stop editing and open the map again.'); return; }
              if (moved) { text = keep; dirty = true; push(); } else quiet();
            });
        } else { buttons(); quiet(); }
      }).catch(function (e) {
        try { localStorage.removeItem(TOKEN_KEY); } catch (x) {}
        warn('The token was not accepted (' + e + ').'); ghForm(true);
      });
    });
    box.querySelector('#m2-ed-gh-off').addEventListener('click', function () {
      if (saveTimer) push();
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      buttons(); quiet();
    });
    box.querySelector('#m2-ed-this').addEventListener('click', editShown);
    box.querySelector('#m2-ed-grid').addEventListener('click', function () { gridSet.shown = !gridSet.shown; gridKeep(); gridButtons(); paint(); });
    box.querySelector('#m2-ed-snap').addEventListener('click', function () { gridSet.snap = !gridSet.snap; gridKeep(); gridButtons(); });
    gridButtons();
    // the Edit tab starts editing the map shown at once (user, 2026-11-12: "does not look i can edit yet"); a map drawn
    // from a CellDesigner file says why it cannot be edited yet
    function shown() {   // the Edit window open on a map: edit it, or say why not (also when another map is chosen)
      if (!V.grid.classList.contains('m2-win-edit') || on) return;
      if (text && dirty && !site) return resume();
      if (graphmlOf(V.current)) return editShown();
      buttons();

    }
    document.querySelectorAll('#m2-rail .m2-ri[data-win="edit"]').forEach(function (b) { b.addEventListener('click', shown); });
    box.querySelector('#m2-ed-save').addEventListener('click', save);
    box.querySelector('#m2-ed-undo').addEventListener('click', function () { if (on) back(undo, redo); });
    box.querySelector('#m2-ed-redo').addEventListener('click', function () { if (on) back(redo, undo); });
    box.querySelector('#m2-ed-stop').addEventListener('click', function () { V.win = 'list'; V.railMark(); if (V.chosen) V.put(V.chosen); else stop(); });
    function resume() {   // back to a file from the computer with moves not saved
      V.current = map; on = true; V.grid.classList.add('m2-editing'); buttons();
      document.getElementById('m2-title').textContent = map.title;
      x0 = y0 = 0; map.width = 0; render();
    }
    box.querySelector('#m2-ed-back').addEventListener('click', resume);
    // silent editing (user, 2026-11-12: "as soon as I click edit icon ... I am in editing mode. And when I switch to list
    // or something else, I am out"): no Edit this map or Stop editing; leaving the Edit window, or closing the panel,
    // ends editing and shows the map of the site again (the edited drawing until the site catches up)
    function away() {
      if (!on) return;
      if (V.chosen) V.put(V.chosen, true); else stop();   // at the same place and zoom: nothing jumps
    }
    window.addEventListener('beforeunload', function (e) { if (dirty) { if (saveTimer) push(); e.preventDefault(); e.returnValue = ''; } });

    // on screen: the selection as yEd shows it (user, 2026-11-12: "see how it is in yEd"), over the drawing: a node
    // selected in a light grey with eight small black handles; an arc selected with black squares on its bend points and
    // its two ports; nothing else is drawn, so the map at rest with nothing selected looks as the original diagram
    var HANDLE = 5, BEND = 5;   // sizes of the handles and of the squares on an arc, in the map's units (the same, user, 2026-11-12)
    function sq() { return Math.max(2, BEND * V.z); }
    // line widths in the map's units too (user, 2026-11-12: zooming in or out keeps the relative size and thickness of
    // every mark, as the handles): as inline style, which wins over the stylesheet's width
    function sw(units) { return ' style="stroke-width:' + f1(units * V.z) + 'px"'; }
    // guides as yEd's (user, 2026-11-13): 1 map unit wide, as yEd's grow with the zoom, but never under 2 screen pixels,
    // so a guide zoomed out stays apart from the 1 px grid lines
    function gw() { var k = (window.devicePixelRatio || 1) * V.pz(); return ' style="stroke-width:' + Math.max(V.z, 2 / k).toFixed(2) + 'px"'; }
    function sx(X) { return V.tx + (X - x0) * V.z; }
    function sy(Y2) { return V.ty + (Y2 - y0) * V.z; }
    function f1(v) { return Math.round(v * 100) / 100; }
    function rr(x, y, w, h, r, quad) {   // a round rectangle as the renderer draws it (yEd's quadratic corners, or arcs)
      r = Math.min(r, w / 2, h / 2);
      if (r <= 0) return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'Z';
      if (quad) return 'M' + x + ' ' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'L' + (x + w - r) + ' ' + y +
        'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'L' + (x + w) + ' ' + (y + h - r) +
        'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'L' + (x + r) + ' ' + (y + h) +
        'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) + 'Z';
      var A = 'A' + r + ' ' + r + ' 0 0 1 ';
      return 'M' + x + ' ' + (y + r) + A + (x + r) + ' ' + y + 'L' + (x + w - r) + ' ' + y + A + (x + w) + ' ' + (y + r) +
        'L' + (x + w) + ' ' + (y + h - r) + A + (x + w - r) + ' ' + (y + h) + 'L' + (x + r) + ' ' + (y + h) + A + x + ' ' + (y + h - r) + 'Z';
    }
    function poly(pts) { return 'M' + pts.map(function (q) { return q[0] + ' ' + q[1]; }).join('L') + 'Z'; }
    function outlineD(sh, x, y, w, h) {   // the node's outline, as the yEd renderer's outline()
      var k = sh.kind, pr = sh.props, i = h / 4;
      if (k === 'Macromolecule') return rr(x, y, w, h, parseFloat(pr.radius || 12), true);
      if (k === 'SimpleChemical' || k === 'StateVariable') return rr(x, y, w, h, Math.min(w, h) / 2, false);
      if (k === 'Complex') {
        var rx = Math.min(parseFloat(pr.radiusX || 15), w / 2), ry = Math.min(parseFloat(pr.radiusY || 15), h / 2);
        return poly([[x + rx, y], [x + w - rx, y], [x + w, y + ry], [x + w, y + h - ry], [x + w - rx, y + h], [x + rx, y + h], [x, y + h - ry], [x, y + ry]]);
      }
      if (k === 'NucleicAcidFeature') {
        var r = Math.min(parseFloat(pr.radius || 12), w / 2, h);
        return 'M' + x + ' ' + y + 'L' + (x + w) + ' ' + y + 'L' + (x + w) + ' ' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) +
          'L' + (x + r) + ' ' + (y + h) + 'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) + 'Z';
      }
      if (k === 'EmptySet' || k === 'Operator' || k === 'UnspecifiedEntity' || k === 'ellipse')
        return 'M' + x + ' ' + (y + h / 2) + 'A' + w / 2 + ' ' + h / 2 + ' 0 1 1 ' + (x + w) + ' ' + (y + h / 2) + 'A' + w / 2 + ' ' + h / 2 + ' 0 1 1 ' + x + ' ' + (y + h / 2) + 'Z';
      if (k === 'Phenotype') return poly([[x + i, y], [x + w - i, y], [x + w, y + h / 2], [x + w - i, y + h], [x + i, y + h], [x, y + h / 2]]);
      if (k === 'PerturbingAgent') return poly([[x, y], [x + w, y], [x + w - i, y + h / 2], [x + w, y + h], [x, y + h], [x + i, y + h / 2]]);
      if (k === 'roundrectangle') return rr(x, y, w, h, 4, false);
      return rr(x, y, w, h, 0);
    }
    function shapeD(i, still) {   // the outline of node i, a multimer's second outline with it (still: without the drag)
      var b = liveC && liveC[i] ? liveC[i] : still ? boxOf(i) : bx(i), n = nodes2[i], d = outlineD(n.shape, b[0], b[1], b[2], b[3]);
      if (n.shape.props.mcount === '2') d = outlineD(n.shape, b[0] + 6, b[1] + 6, b[2], b[3]) + d;
      return d;
    }
    function cut(port, outer, b) {   // where the arc from outer to its port inside the box b meets the box's edge
      if (!(port[0] > b[0] && port[0] < b[0] + b[2] && port[1] > b[1] && port[1] < b[1] + b[3])) return port;
      var dx = port[0] - outer[0], dy = port[1] - outer[1], best = 1;
      [[b[0], 0], [b[0] + b[2], 0], [b[1], 1], [b[1] + b[3], 1]].forEach(function (e) {
        var den = e[1] ? dy : dx;
        if (!den) return;
        var t = (e[0] - (e[1] ? outer[1] : outer[0])) / den;
        if (t >= 0 && t < best) {
          var o = e[1] ? outer[0] + dx * t : outer[1] + dy * t, lo = e[1] ? b[0] : b[1], hi = e[1] ? b[0] + b[2] : b[1] + b[3];
          if (o >= lo - 0.01 && o <= hi + 0.01) best = t;
        }
      });
      return [outer[0] + dx * best, outer[1] + dy * best];
    }
    function line(k, B, P, pp) {   // the arc's points in yEd units: its ends at the borders of its nodes, its bends between
      // (B, P: the boxes and bend points to take, the live ones by default; pp: a port being dragged to another place)
      var e = edges2[k];
      if (e.s == null || e.t == null) return null;
      B = B || bx; P = P || pt;
      var S = B(e.s), T = B(e.t), pa = e.path, o = function (a) {
        if (pp && pp.to && pp.k === k && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
        return pa ? parseFloat(pa.getAttribute(a)) || 0 : 0;
      };
      var so = [o('sx'), o('sy')], to = [o('tx'), o('ty')];
      if (B === bx) { so = glyphPort(e.s, so, e.id); to = glyphPort(e.t, to, e.id); }
      var pts = [[S[0] + S[2] / 2 + so[0], S[1] + S[3] / 2 + so[1]]];
      e.pts.forEach(function (pi) { pts.push(P(pi)); });
      pts.push([T[0] + T[2] / 2 + to[0], T[1] + T[3] / 2 + to[1]]);
      pts[0] = cut(pts[0], pts[1], S);
      pts[pts.length - 1] = cut(pts[pts.length - 1], pts[pts.length - 2], T);
      return pts;
    }
    function livePath(pts, smooth) {   // the arc while dragged, its bends rounded as the renderer rounds them (10 units each side), so the line does not turn sharp during a drag (user, 2026-11-12)
      return roundPath(pts, smooth, function (q) { return f1(sx(q[0])) + ' ' + f1(sy(q[1])); });
    }
    function roundPath(pts, smooth, P) {
      var d = 'M' + P(pts[0]);
      for (var i = 1; i < pts.length - 1; i++) {
        var a = pts[i - 1], b = pts[i], c = pts[i + 1], la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
        if (smooth && la > 0 && lc > 0) {
          var da = Math.min(10, la / 2), dc = Math.min(10, lc / 2);
          d += 'L' + P([b[0] + (a[0] - b[0]) * da / la, b[1] + (a[1] - b[1]) * da / la]) + 'Q' + P(b) + ' ' + P([b[0] + (c[0] - b[0]) * dc / lc, b[1] + (c[1] - b[1]) * dc / lc]);
        } else d += 'L' + P(b);
      }
      return d + 'L' + P(pts[pts.length - 1]);
    }
    // the arcs following a move drawn in full (user, 2026-11-13: "the line should be drawn in full during drag ... it
    // should feel quite natural"): each a copy of the renderer's own group of that arc, so it keeps its colour, width and
    // dashes; its line goes through the new places, and what is drawn at an end (arrowhead, circle, bar) is carried to
    // that end, turned as the end's segment turned. The originals are hidden; the copies go when the map is drawn again
    var copies = [], frozen = false;
    function restBox(i) { var b = boxOf(i), k = keyed && keyed.n.has(i); return k ? [b[0] - keyed.dx, b[1] - keyed.dy, b[2], b[3]] : b; }
    function restPt(pi) { var p = points[pi], k = keyed && keyed.p && keyed.p.has(pi); return [num(p, 'x') - (k ? keyed.dx : 0), num(p, 'y') - (k ? keyed.dy : 0)]; }
    function dropCopies() {   // the copies taken away, an original shown again unless its arc still follows a move
      copies.forEach(function (c) { c[0].remove(); if (c[1] && !(live && live.has(c[2]))) c[1].style.display = ''; });
      copies = [];
    }
    // a point of the old drawing of an arc taken to the new one: it goes with the segment it lies nearest to, at the
    // same side distance; along it, within 15 units of a segment's end it keeps its distance from that end (arrowheads,
    // rounded bends, a line's cut end), else its share of the segment (a mark midway, a line drawn in two pieces)
    function follow(o, n) {
      var seg = [];
      for (var i = 1; i < o.length; i++) {
        var a = o[i - 1], b = o[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), a1 = n[i - 1], b1 = n[i], L1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
        seg.push({ a: a, L: L, u: L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0], a1: a1, L1: L1, u1: L1 ? [(b1[0] - a1[0]) / L1, (b1[1] - a1[1]) / L1] : (L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0]) });
      }
      return function (p) {
        var best = null, bd = Infinity;
        seg.forEach(function (S, k) {
          var x = p[0] - S.a[0], y = p[1] - S.a[1], t = x * S.u[0] + y * S.u[1], c = Math.max(0, Math.min(S.L, t));
          var d = Math.hypot(x - c * S.u[0], y - c * S.u[1]) + (t < 0 && k > 0 ? 1e-6 : 0);
          if (d < bd) { bd = d; best = [S, t, -x * S.u[1] + y * S.u[0]]; }
        });
        var S = best[0], t = best[1], w = best[2];
        var t1 = t <= 15 || S.L <= 0 ? t : S.L - t <= 15 ? S.L1 - (S.L - t) : t * S.L1 / S.L;
        return [S.a1[0] + t1 * S.u1[0] - w * S.u1[1], S.a1[1] + t1 * S.u1[1] + w * S.u1[0]];
      };
    }
    function fullLines(ks, pp) {   // ks: the arcs to draw (indices in edges2), pp: a port being dragged
      dropCopies();
      ks.forEach(function (k) {
        var e = edges2[k], gs = gE && gE[e.id];
        if (!gs) return;
        var o = line(k, restBox, restPt), n = line(k, null, null, pp);
        if (!o || !n) return;
        var F = follow(o, n), pair = function (str) {   // every x y of an attribute taken along
          var v = str.match(/-?[\d.]+(?:e-?\d+)?/g) || [], k2 = 0;
          return str.replace(/-?[\d.]+(?:e-?\d+)?/g, function (m) {
            var j = k2++; if (j % 2) return f1(F([+v[j - 1], +v[j]])[1]); return f1(F([+v[j], +v[j + 1]])[0]);
          });
        };
        gs.forEach(function (g) {
          g.style.display = 'none';
          var c = g.cloneNode(true);
          c.removeAttribute('data-e'); c.style.display = ''; c.classList.add('m2-ed-copy');
          g.parentNode.insertBefore(c, g.nextSibling); copies.push([c, g, k]);
          c.querySelectorAll('*').forEach(function (el) {
            var nm = el.localName;
            if ((nm === 'polyline' || nm === 'polygon') && !el.getAttribute('transform')) el.setAttribute('points', pair(el.getAttribute('points') || ''));
            else if (nm === 'path' && !el.getAttribute('transform') && /^[MLQCZ\s\d.,e-]*$/.test(el.getAttribute('d') || '')) el.setAttribute('d', pair(el.getAttribute('d')));
            else if (nm === 'line') { var q1 = F([+el.getAttribute('x1'), +el.getAttribute('y1')]), q2 = F([+el.getAttribute('x2'), +el.getAttribute('y2')]);
              el.setAttribute('x1', f1(q1[0])); el.setAttribute('y1', f1(q1[1])); el.setAttribute('x2', f1(q2[0])); el.setAttribute('y2', f1(q2[1])); }
            else if (nm !== 'g' && nm !== 'title' && nm !== 'tspan') {   // anything else (a circle, a rect, a text) moved by its centre
              var b; try { b = el.getBBox(); } catch (x) { return; }
              var m = [b.x + b.width / 2, b.y + b.height / 2], q = F(m);
              el.setAttribute('transform', 'translate(' + f1(q[0] - m[0]) + ' ' + f1(q[1] - m[1]) + ')' + (el.getAttribute('transform') ? ' ' + el.getAttribute('transform') : ''));
            }
          });
        });
      });
    }
    // the lines lit by the selection (the arcs selected; on a CellDesigner map the whole reaction of a main line or glyph
    // selected) and the glyphs lit with them
    var MAIN = /^(.*)\|(a|b|r\d+|p\d+)$/;
    function lit() {
      var hlE = new Set(selE), glyphs = new Set();
      if (cd) {
        var rx = new Set();
        selE.forEach(function (k) { var m = edges2[k].id.match(MAIN); if (m) rx.add(m[1]); });
        selN.forEach(function (i) { var m = nodes2[i].id.match(/^(.*)\|proc$/); if (m) rx.add(m[1]); });
        if (rx.size) {
          edges2.forEach(function (e, k) { var m = e.id.match(MAIN); if (m && rx.has(m[1])) hlE.add(k); });
          nodes2.forEach(function (n, i) { var m = n.id.match(/^(.*)\|proc$/); if (m && rx.has(m[1])) glyphs.add(i); });
        }
      }
      return { e: hlE, g: glyphs };
    }
    // a line's end moved on its node (user, 2026-11-12: "snap to center, bottom center, top center, left center, right
    // center"): an end square of a lit line dragged; it snaps to the nearest of the five, written as the port's offset
    // from the node's centre (yEd's sx, sy or tx, ty); on a CellDesigner map cd_edit makes it the connection point
    // (none for the centre, N, S, W, E). A process glyph's ends are not moved this way
    function portAt(P) {
      var R = 6 / V.z, L = lit(), best = null, dB = R;
      L.e.forEach(function (k) {
        var e = edges2[k];
        if (e.s == null || e.t == null || !e.path) return;
        var all = ports(k);
        [[0, e.s], [all.length - 1, e.t]].forEach(function (q, end) {
          if (cd && /\|proc$/.test(nodes2[q[1]].id)) return;
          var d = Math.hypot(all[q[0]][0] - P[0], all[q[0]][1] - P[1]);
          if (d <= dB) { dB = d; best = { k: k, end: end, n: q[1], to: null }; }
        });
      });
      return best;
    }
    function spot(pp, P) {   // the nearest of the five places of the node, as an offset from its centre
      var b = bx(pp.n), c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
      return [[0, 0], [0, -b[3] / 2], [0, b[3] / 2], [-b[2] / 2, 0], [b[2] / 2, 0]].reduce(function (m, o) {
        return Math.hypot(c[0] + o[0] - P[0], c[1] + o[1] - P[1]) < Math.hypot(c[0] + m[0] - P[0], c[1] + m[1] - P[1]) ? o : m;
      });
    }
    function setPort(pp) {
      var e = edges2[pp.k], a = pp.end ? ['tx', 'ty'] : ['sx', 'sy'];
      if (Math.abs(num(e.path, a[0]) - pp.to[0]) < 0.01 && Math.abs(num(e.path, a[1]) - pp.to[1]) < 0.01) { unshift(); paint(); return; }
      remember(false);
      var nth = Array.prototype.indexOf.call(doc.getElementsByTagNameNS(Y, 'Path'), e.path), c = -1;
      text = text.replace(/<y:Path\b[^>]*>/g, function (tag) {
        if (++c !== nth) return tag;
        a.forEach(function (k, j) {
          var v = fmt(pp.to[j]), re = new RegExp('(\\s' + k + '=")[^"]*"');
          tag = re.test(tag) ? tag.replace(re, '$1' + v + '"') : tag.replace(/(\/?>)$/, ' ' + k + '="' + v + '"$1');
        });
        return tag;
      });
      parse(); dirty = true; render(); paint(); changed();
    }
    function paint() {
      if (V.img && V.img.querySelectorAll) {
        V.img.querySelectorAll('.m2-ed-dark').forEach(function (x) { x.remove(); });
        V.img.querySelectorAll('.m2-ed-blue').forEach(function (x) { x.classList.remove('m2-ed-blue'); });
      }
      gridPaint();
      if (!on || V.current !== map) { overlay.innerHTML = ''; return; }
      var out = [], over = [], frame = '<g transform="translate(' + f1(V.tx - x0 * V.z) + ',' + f1(V.ty - y0 * V.z) + ') scale(' + V.z + ')">';
      // arcs following a move: drawn in full in the picture (after a release they stay as they are until the map is
      // drawn again); before the editor's own drawing is in the page, as plain lines
      var pk0 = drag && drag.port && drag.port.to ? drag.port : null, lk = new Set(live || []);
      if (pk0) { glyphFollow(new Set(), new Set(), null, pk0); (live || []).forEach(function (k) { lk.add(k); }); lk.add(pk0.k); }
      if (gE) { if (!frozen) { if (lk.size) { if (!cdLines(lk, pk0)) fullLines(lk, pk0); } else dropCopies(); } }
      else lk.forEach(function (k) {
        var pts = line(k, null, null, pk0);
        if (pts) out.push('<path class="m2-ed-live" stroke-width="' + f1(V.z) + '" d="' + livePath(pts, edges2[k].smooth) + '"/>');
      });
      // arcs selected, or holding a bend point selected: drawn blue, then their bends as squares on top
      // a bend point selected alone, the arc not highlighted (user, 2026-11-12: as yEd): four small black squares round
      // the point, the lines through it seen in the gap between them (measured on yEd: squares 4 units, gap 2 units)
      selP.forEach(function (pi) {
        if (selE.some(function (k) { return edges2[k].pts.indexOf(pi) >= 0; })) return;
        var q = pt(pi), a = Math.max(1.5, 4 * V.z), g = Math.max(1, 2 * V.z) / 2, X = sx(q[0]), Y3 = sy(q[1]);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(c[0] < 0 ? X - g - a : X + g) + '" y="' + f1(c[1] < 0 ? Y3 - g - a : Y3 + g) + '" width="' + f1(a) + '" height="' + f1(a) + '"/>');
        });
      });
      // an arc selected (user, 2026-11-12, as yEd): black squares on its bend points and on its two ports, where it starts
      // and ends (often in the middle of a node); and drawn blue (below). On a CellDesigner map a
      // reaction is one item, as in CellDesigner (user, 2026-11-12): a click on its main line (reactant to glyph to
      // product), its glyph or an added reactant or product lights them all up; a modifier stays on its own
      var L = lit(), hlE = L.e, glyphs = L.g, main = MAIN;
      // a line selected is drawn blue itself, in CellDesigner's selection blue, on GraphML and CellDesigner maps alike
      // (user, 2026-11-13: the other way, a blue band under the line, removed, "remove highlight way completely"): its
      // own group (a CellDesigner line's, not its white halo's), or the copy following a move; a glyph lit the same.
      // Before the editor's drawing is in the page, a thin blue line over the map
      var blueG = function (g) {
        var cs = copies.filter(function (c) { return c[1] === g; });
        if (cs.length) cs.forEach(function (c) { c[0].classList.add('m2-ed-blue'); }); else g.classList.add('m2-ed-blue');
      };
      hlE.forEach(function (k) {
        var gs = gE && gE[edges2[k].id];
        if (gs) return blueG(gs[gs.length - 1]);
        var pts = line(k, null, null, pk0);
        if (pts) out.push('<path class="m2-ed-sel" stroke-width="' + f1(V.z) + '" d="' + livePath(pts, edges2[k].smooth) + '"/>');
      });
      glyphs.forEach(function (i) {
        var g = gN && gN[nodes2[i].id];
        if (g) return blueG(g);
        var b = bx(i);
        out.push('<rect class="m2-ed-sel" stroke-width="' + f1(V.z) + '" x="' + f1(sx(b[0])) + '" y="' + f1(sy(b[1])) + '" width="' + f1(b[2] * V.z) + '" height="' + f1(b[3] * V.z) + '"/>');
      });
      hlE.forEach(function (k) {
        var e = edges2[k];
        if (e.s == null || e.t == null) return;
        var all = ports(k, pk0), grouped = cd && main.test(e.id);   // a reaction's own lines: no squares in its glyph
        var pj = !drag && part && part.k === k && !selN.length && !selP.length ? (part.port ? (part.port.end ? all.length - 1 : 0) : e.pts.indexOf(part.p) + 1) : -1;
        all.forEach(function (q, j) {
          if (grouped && ((j === 0 && glyphs.has(e.s)) || (j === all.length - 1 && glyphs.has(e.t)))) return;
          if (j === pj) return;   // the part the keys move: its four squares alone (below)
          over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(sx(q[0]) - sq() / 2) + '" y="' + f1(sy(q[1]) - sq() / 2) + '" width="' + f1(sq()) + '" height="' + f1(sq()) + '"/>');
        });
      });
      // the part of the line the keys move: four small squares round it, as a bend point selected alone
      var pt1 = !drag && part && !selN.length && !selP.length && selE.indexOf(part.k) >= 0 ? part : null;
      if (pt1) {
        var qa = ports(pt1.k), Q = pt1.port ? qa[pt1.port.end ? qa.length - 1 : 0] : pt(pt1.p);
        var a1 = Math.max(1.5, 4 * V.z), g1 = Math.max(1, 2 * V.z) / 2, X1 = sx(Q[0]), Y1 = sy(Q[1]);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(c[0] < 0 ? X1 - g1 - a1 : X1 + g1) + '" y="' + f1(c[1] < 0 ? Y1 - g1 - a1 : Y1 + g1) + '" width="' + f1(a1) + '" height="' + f1(a1) + '"/>');
        });
      }
      if (drag && drag.port && drag.port.to) {
        var pk = drag.port, b0 = bx(pk.n), C = [b0[0] + b0[2] / 2 + pk.to[0], b0[1] + b0[3] / 2 + pk.to[1]];
        var ph = Math.max(2, HANDLE * V.z);
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(C[0]) - ph / 2) + '" y="' + f1(sy(C[1]) - ph / 2) + '" width="' + f1(ph) + '" height="' + f1(ph) + '"/>');
      }
      if (!drag && keyGuides) keyGuides.forEach(function (g) {
        out.push('<path class="m2-ed-guide"' + gw() + ' d="M' + f1(sx(g[0][0])) + ' ' + f1(sy(g[0][1])) + 'L' + f1(sx(g[1][0])) + ' ' + f1(sy(g[1][1])) + '"/>');
      });
      if (drag && drag.guides) drag.guides.forEach(function (g) {
        out.push('<path class="m2-ed-guide"' + gw() + ' d="M' + f1(sx(g[0][0])) + ' ' + f1(sy(g[0][1])) + 'L' + f1(sx(g[1][0])) + ' ' + f1(sy(g[1][1])) + '"/>');
      });
      var seg = function (g) { return 'M' + f1(sx(g[0][0])) + ' ' + f1(sy(g[0][1])) + 'L' + f1(sx(g[1][0])) + ' ' + f1(sy(g[1][1])); };
      if (drag && drag.lines) drag.lines.forEach(function (g) { out.push('<path class="m2-ed-snapline"' + gw() + ' d="' + seg(g) + '"/>'); });
      // yEd's crosses (user, 2026-11-13): a small x at each point a centre or side line refers to, the middle of each
      // node's side or centre on that line; about 7 units across, at least 8 px on screen
      if (drag && drag.crosses) drag.crosses.forEach(function (q) {
        var X = sx(q[0]), Y = sy(q[1]), r = Math.max(3.5 * V.z, 4);
        out.push('<path class="m2-ed-snapline"' + gw() + ' d="M' + f1(X - r) + ' ' + f1(Y - r) + 'L' + f1(X + r) + ' ' + f1(Y + r) + 'M' + f1(X - r) + ' ' + f1(Y + r) + 'L' + f1(X + r) + ' ' + f1(Y - r) + '"/>');
      });
      if (drag && drag.marks) drag.marks.forEach(function (g) {   // an equal gap: a line with a short bar at each end
        var X0 = sx(g[0][0]), Y0 = sy(g[0][1]), X1 = sx(g[1][0]), Y1 = sy(g[1][1]), up = Y0 === Y1, t = 4 * V.z;
        var bar = function (X, Y) { return up ? 'M' + f1(X) + ' ' + f1(Y - t) + 'L' + f1(X) + ' ' + f1(Y + t) : 'M' + f1(X - t) + ' ' + f1(Y) + 'L' + f1(X + t) + ' ' + f1(Y); };
        out.push('<path class="m2-ed-mark"' + gw() + ' d="' + seg(g) + bar(X0, Y0) + bar(X1, Y1) + '"/>');
      });
      // nodes selected: darkened (a group without what it holds, as yEd), and the eight handles round the box
      selN.forEach(function (i, j) {
        var n = nodes2[i], b = bx(i), g = gN && gN[n.id];
        if (g) {   // in the drawing itself, right over the node's own shape: what is drawn after it (its contents, the
          // arcs, the labels) stays on top, as yEd shows a group selected (user, 2026-11-12)
          var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          el.setAttribute('class', 'm2-ed-dark'); el.setAttribute('d', shapeD(i, true));
          // a CellDesigner drawing is in the file's places, which a shift out of negative places (cd_edit.place) puts
          // -x0, -y0 from the editor's (the frame's two translates cancel inside the picture): the fill follows them
          // (user, 2026-11-12: after a node moved past the canvas edge the fill showed at another place)
          // and a node moved by the keys has its new place in the file and its group still shifted by the keys' sum
          // (and so has a node dragged, from its release until the map is drawn again): the group's shift taken off
          var tm = !mv && (g.getAttribute('transform') || '').match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
          var kx = tm ? +tm[1] : 0, ky = tm ? +tm[2] : 0;
          var ox = (cd ? x0 : 0) + kx, oy = (cd ? y0 : 0) + ky;
          if (ox || oy) el.setAttribute('transform', 'translate(' + f1(-ox) + ',' + f1(-oy) + ')');
          var first = g.firstElementChild && g.firstElementChild.localName === 'a' ? g.firstElementChild : g;
          var shapes = first.querySelectorAll(cd ? ':scope > path, :scope > rect, :scope > ellipse, :scope > polygon' : ':scope > path'), last = shapes.length ? shapes[shapes.length - 1] : null;
          if (last) last.after(el); else first.prepend(el);
        } else if (n.kids.length) {   // no drawing of the editor's yet: handles only for a group
        } else out.push(frame + '<path class="m2-ed-dark" d="' + shapeD(i) + '"/></g>');
        // the handles in the map's units, so they grow and shrink with the zoom as yEd's (user, 2026-11-12): 5 units
        // wide, their centres 3.3 units outside the box (as measured on yEd)
        var hs = Math.max(2, HANDLE * V.z), off = 3.3 * V.z;
        var L = sx(b[0]) - off, T = sy(b[1]) - off, R = sx(b[0] + b[2]) + off, B = sy(b[1] + b[3]) + off;
        [[L, T], [(L + R) / 2, T], [R, T], [L, (T + B) / 2], [R, (T + B) / 2], [L, B], [(L + R) / 2, B], [R, B]].forEach(function (q) {
          over.push('<rect class="m2-ed-handle" x="' + f1(q[0] - hs / 2) + '" y="' + f1(q[1] - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
        });
      });
      // while a drag runs: a thin grey outline of where it goes (or the area being selected), gone on release
      if (drag && (drag.dx || drag.dy) && !gN) {   // no drawing to move yet: where it goes, as an outline
        var dx = drag.dx, dy = drag.dy, moving = new Set(), ps = new Set(selP);
        selN.forEach(function (i) { moving.add(i); nodes2[i].inside.forEach(function (c) { moving.add(c); }); });
        selE.forEach(function (k) { edges2[k].pts.forEach(function (p) { ps.add(p); }); });
        moving.forEach(function (i) {
          var b = boxOf(i);
          over.push('<rect class="m2-ed-ghost" x="' + sx(b[0] + dx) + '" y="' + sy(b[1] + dy) + '" width="' + b[2] * V.z + '" height="' + b[3] * V.z + '"/>');
        });
        ps.forEach(function (i) {
          var p = points[i];
          over.push('<rect class="m2-ed-ghost" x="' + f1(sx(num(p, 'x') + dx) - 3.5) + '" y="' + f1(sy(num(p, 'y') + dy) - 3.5) + '" width="7" height="7"/>');
        });
      }
      if (band) {
        var a = [Math.min(band.x, band.x2), Math.min(band.y, band.y2)], c = [Math.max(band.x, band.x2), Math.max(band.y, band.y2)];
        over.push('<rect class="m2-ed-band" x="' + sx(a[0]) + '" y="' + sy(a[1]) + '" width="' + (c[0] - a[0]) * V.z + '" height="' + (c[1] - a[1]) * V.z + '"/>');
      }
      // the square marks magenta on a CellDesigner map, as in CellDesigner (user, 2026-11-12: "this way I will know while
      // editing that it's CD"); black on a GraphML map, as in yEd
      overlay.classList.toggle('m2-ed-cd', !!cd);
      overlay.innerHTML = out.concat(over).join('');
    }

    // the pointer: a press on a node, an arc or a bend point selects it and moves it (an arc: its bends), Shift adds to
    // the selection, Shift with a drag on empty space selects an area; a drag on empty space pans the map, as in the viewer
    function at(e) {
      var r = V.view.getBoundingClientRect(), vx = (e.clientX - r.left) / V.pz(), vy = (e.clientY - r.top) / V.pz();
      return [(vx - V.tx) / V.z + x0, (vy - V.ty) / V.z + y0];
    }
    function near(P, a, b) {   // the distance from P to the segment a-b
      var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L)) : 0;
      return Math.hypot(P[0] - a[0] - dx * t, P[1] - a[1] - dy * t);
    }
    function hit(P) {   // a bend point first, then a node, then an arc, then a group (its contents and arcs come first)
      var R = 6 / V.z, best = null, group = null;
      // among bend points close together the one selected wins, then one of the arc selected (user, 2026-11-12: select
      // the arc, see its bends, then click the bend wanted: the arc is the hint), else the nearest (a nearby bend was
      // taken and the wrong arc dragged)
      var dB = Infinity, ofArc = new Set();
      selE.forEach(function (k) { edges2[k].pts.forEach(function (q) { ofArc.add(q); }); });
      points.forEach(function (p, i) {
        var dx = Math.abs(num(p, 'x') - P[0]), dy = Math.abs(num(p, 'y') - P[1]);
        if (dx > R || dy > R) return;
        var d = Math.hypot(dx, dy) - (selP.indexOf(i) >= 0 ? 4 * R : ofArc.has(i) ? 2 * R : 0);
        if (d < dB) { dB = d; best = { p: i }; }
      });
      if (best) return best;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i);
        if (!(P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3])) return;
        var h = { n: i, area: b[2] * b[3] };
        // a process glyph is not an item of its own (user, 2026-11-12: in CellDesigner "it's not selectable ... it's part of
        // the link"): a click on it is a click on its reaction's main line, no node handles; a drag on it moves the map
        var gm = cd && n.id.match(/^(.*)\|proc$/);
        if (gm) { var ga = edges2.findIndex(function (q) { return q.id === gm[1] + '|a'; }); if (ga >= 0 && !best) best = { e: ga, glyph: true, area: 0 }; return; }
        if (n.kids.length) { if (!group || h.area < group.area) group = h; }
        else if (!best || h.area < best.area) best = h;
      });
      if (best) return best;
      var E = 5 / V.z, d0 = E;
      edges2.forEach(function (e, k) {
        var pts = line(k);
        if (!pts) return;
        for (var j = 1; j < pts.length; j++) { var d = near(P, pts[j - 1], pts[j]); if (d <= d0) { d0 = d; best = { e: k }; } }
      });
      return best || group;
    }
    function editing(e) { return on && V.current === map && !e.target.closest('.m2-ctrl, .m2-info'); }
    var rpan = null, tap = null;
    // edit mode is view mode plus the selection (user, 2026-11-12: two fingers zoomed in view mode but moved the map in
    // edit mode, "I don't like it"; was yEd's way): two-finger scrolling, the wheel and a pinch zoom; a drag on empty
    // space or on an item not selected moves the map, as in the viewer; a click selects (on empty space: clears the
    // selection; Shift with a click adds or takes out); a drag on what is selected moves it; Shift with a drag on empty
    // space selects an area; a right click opens the viewer's menu, as outside edit mode
    V.view.addEventListener('pointerdown', function (e) {
      keyGuides = null;
      tap = null;
      if (!editing(e)) return;
      var P0 = at(e);
      if (e.button === 2 || (e.button === 0 && e.ctrlKey && /Mac/.test(navigator.platform))) {   // a right click: the viewer's menu
        rclick = P0;
        e.stopImmediatePropagation();   // (user, 2026-11-12: no right drag for the map, two fingers move it)
        return;
      }
      if (e.button !== 0) return;
      var P = at(e), h = hit(P);
      var pp = !e.shiftKey && portAt(P);
      if (pp) {   // a lit line's end square: its port moved among the node's five places
        e.stopImmediatePropagation(); e.preventDefault();
        V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
        drag = { port: pp, x: P[0], y: P[1], dx: 0, dy: 0, cx: e.clientX, cy: e.clientY }; mv = null;
        part = { k: pp.k, port: pp }; paint(); return;
      }
      // an edge of a compartment, or a handle of one selected: a drag resizes it (user, 2026-11-12: compartments are
      // containers, "resizable manually ... when I simply drag the edge of it"); a bend point or a node there comes first
      var rz = !e.shiftKey && edgeAt(P);
      if (rz && h && (h.p != null || (h.n != null && !nodes2[h.n].comp && selN.indexOf(rz.c) < 0))) rz = null;
      if (rz) {
        e.stopImmediatePropagation(); e.preventDefault();
        V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
        selN = [rz.c]; selP = []; selE = [];
        drag = { x: P[0], y: P[1], dx: 0, dy: 0, rs: { c: rz.c, s: rz.s, b0: boxOf(rz.c) } };
        mv = null; paint(); return;
      }
      if (!h && e.shiftKey) {   // Shift with a drag on empty space: an area added to the selection
        e.stopImmediatePropagation(); e.preventDefault();
        V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
        band = { x: P[0], y: P[1], x2: P[0], y2: P[1], add: true }; paint(); return;
      }
      // empty space, Shift on an item, or an item not selected: the viewer moves the map on a drag; a click is taken on
      // release (selects, clears, or with Shift adds or takes out)
      var tapped = function () { tap = { h: h, shift: e.shiftKey, x: e.clientX, y: e.clientY }; V.view.focus({ preventScroll: true }); };
      if (!h || e.shiftKey) return tapped();
      if (h.glyph) return tapped();   // a glyph is not dragged: a drag on it moves the map, a click selects its reaction
      var list = h.p != null ? selP : h.e != null ? selE : selN, k = h.p != null ? h.p : h.e != null ? h.e : h.n, there = list.indexOf(k) >= 0;
      // a bend point of an arc selected is a part of that connector: dragged at once, as its ends, the arc staying
      // selected after (user, 2026-11-12, from yEd: "for connectors, it's different": the whole connector selected, its
      // parts move with the next press); a molecule still needs its first click
      var keepE = null;
      if (!there && h.p != null && selE.some(function (q) { return edges2[q].pts.indexOf(h.p) >= 0; })) {
        part = { k: selE.find(function (q) { return edges2[q].pts.indexOf(h.p) >= 0; }), p: h.p };
        keepE = selE.slice(); selN = []; selE = []; selP = [h.p]; list = selP; there = true;
      }
      // a first click on a bend point of a line not selected selects the whole line, as a click anywhere on it (user,
      // 2026-11-12: "let's make it consistent": a line selected first, its bend points then moved with the next press);
      // a bend point alone is selected only by an area or Shift with a click
      if (!there && h.p != null && !keepE) {
        var ak = edges2.findIndex(function (q) { return q.pts.indexOf(h.p) >= 0; });
        if (ak >= 0) { selN = []; selP = []; selE = [ak]; paint(); return; }
      }
      // the first click selects, a drag moves only what is selected already (user, 2026-11-12: as yEd, "first click
      // selects an item, and second click drags it")
      if (!there) return tapped();
      e.stopImmediatePropagation(); e.preventDefault();
      V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
      drag = { x: P[0], y: P[1], dx: 0, dy: 0, p: h.p != null && selP.indexOf(h.p) >= 0 ? h.p : null, guides: [],
               n: h.n != null && selN.indexOf(h.n) >= 0 ? h.n : null, e: h.e != null && selE.indexOf(h.e) >= 0 ? h.e : null, keepE: keepE,
               sx0: e.clientX, sy0: e.clientY };
      // an arc grabbed anywhere and dragged makes a new bend point there (user, 2026-11-12, as yEd); a click selects it
      if (h.e != null && !e.shiftKey) drag.grab = { k: h.e, P: P, sx: e.clientX, sy: e.clientY };
      mv = moving();
      paint();
    }, true);
    // guides for a bend point (user, 2026-11-12, as yEd: "see how guides look when you move for L shape bend"): the
    // bend pressed snaps when one of its two segments is nearly level or upright, and a segment so lined up is drawn
    // as a thick grey line while the drag runs (both for an L)
    function ports(k, pp) {   // the arc's points with its ends at the ports (node centre and offset), as yEd lines them up
      var e = edges2[k], S = bx(e.s), T = bx(e.t), pa = e.path, o = function (a) {
        if (pp && pp.to && pp.k === k && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
        return pa ? parseFloat(pa.getAttribute(a)) || 0 : 0;
      };
      return [[S[0] + S[2] / 2 + o('sx'), S[1] + S[3] / 2 + o('sy')]].concat(e.pts.map(pt), [[T[0] + T[2] / 2 + o('tx'), T[1] + T[3] / 2 + o('ty')]]);
    }
    function snap(d) {
      d.guides = [];
      var k = -1, j = -1;
      edges2.forEach(function (e, i) { var at2 = e.pts.indexOf(d.p); if (at2 >= 0) { k = i; j = at2 + 1; } });
      if (k < 0 || edges2[k].s == null || edges2[k].t == null) return;
      mv.dx = d.dx; mv.dy = d.dy;
      var all = ports(k), B = all[j], nb = [beyond(k, j - 1, all), beyond(k, j + 1, all)].filter(function (q) {
        return !(q[1] != null && mv.p.has(q[1]));   // a neighbouring bend moving with it is no guide
      }).map(function (q) { return q[0]; });
      var T = 6 / V.z, cx = null, cy = null;
      nb.forEach(function (q) {
        if (Math.abs(q[0] - B[0]) <= T && (cx == null || Math.abs(q[0] - B[0]) < Math.abs(cx))) cx = q[0] - B[0];
        if (Math.abs(q[1] - B[1]) <= T && (cy == null || Math.abs(q[1] - B[1]) < Math.abs(cy))) cy = q[1] - B[1];
      });
      // a line meeting a CellDesigner glyph on the segment that moves: the bend snaps where that line turns level or
      // upright too (user, 2026-11-13)
      glyphArcs(d.p).forEach(function (o) {
        [0, 1].forEach(function (cm) { [0, 1].forEach(function (a) {
          var c = joinSolve(o, d.p, B, a, cm);
          if (c == null || Math.abs(c) > T) return;
          if (a === 0 && (cx == null || Math.abs(c) < Math.abs(cx))) cx = c;
          if (a === 1 && (cy == null || Math.abs(c) < Math.abs(cy))) cy = c;
        }); });
      });
      if (cx != null) d.dx += cx;
      if (cy != null) d.dy += cy;
      d.gx = cx != null; d.gy = cy != null;
      var C = [B[0] + (cx || 0), B[1] + (cy || 0)];
      nb.forEach(function (q) { if (Math.abs(q[0] - C[0]) < 0.01 || Math.abs(q[1] - C[1]) < 0.01) d.guides.push([C, q]); });
      d.guides = d.guides.concat(joinGuides(d.p, C));
    }
    // a new bend point (user, 2026-11-12, as yEd: "grab a line at any point and drag where you want"): put on the arc's
    // segment nearest the press, written into the text as yEd writes a y:Point (a y:Path closed in itself opened), the
    // rest byte for byte; undo takes it away. Returns { p (its index in points), at (where it is), k (the arc, + 1) }
    function bend(k, P) {
      var e = edges2[k], pts = line(k);
      if (!pts || !e.path) return null;
      var j = 1, dmin = Infinity;
      for (var i = 1; i < pts.length; i++) { var d0 = near(P, pts[i - 1], pts[i]); if (d0 < dmin) { dmin = d0; j = i; } }
      var a = pts[j - 1], b = pts[j], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      var t = L ? Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L)) : 0;
      var Q = [Math.round((a[0] + dx * t) * 1000) / 1000, Math.round((a[1] + dy * t) * 1000) / 1000];
      var tag = '<y:Point x="' + fmt(Q[0]) + '" y="' + fmt(Q[1]) + '"/>', at = j - 1;
      var nth = function (re, n) { var m, c = -1; re.lastIndex = 0; while ((m = re.exec(text))) if (++c === n) return m; return null; };
      var indent = function (pos) { var s0 = text.lastIndexOf('\n', pos - 1) + 1, w = text.slice(s0, pos).match(/^[ \t]*/)[0]; return w; };
      var m, before = text;
      if (at < e.pts.length) {   // before a bend the arc has: on a line of its own, as that one
        m = nth(/<y:Point\s[^>]*>/g, e.pts[at]);
        text = text.slice(0, m.index) + tag + '\n' + indent(m.index) + text.slice(m.index);
      } else if (e.pts.length) {   // after its last bend
        m = nth(/<y:Point\s[^>]*>/g, e.pts[e.pts.length - 1]);
        var end = m.index + m[0].length;
        text = text.slice(0, end) + '\n' + indent(m.index) + tag + text.slice(end);
      } else {   // its first bend: inside the y:Path, opened if it closes in itself
        var paths = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Path'));
        m = nth(/<y:Path[\s>\/][^>]*>/g, paths.indexOf(e.path));
        if (!m) return null;
        var w = indent(m.index), end2 = m.index + m[0].length;
        text = /\/>$/.test(m[0])
          ? text.slice(0, m.index) + m[0].replace(/\s*\/>$/, '>') + '\n' + w + '  ' + tag + '\n' + w + '</y:Path>' + text.slice(end2)
          : text.slice(0, end2) + '\n' + w + '  ' + tag + text.slice(end2);
      }
      var keep = text; text = before; remember(false); text = keep;
      parse();
      return { p: edges2[k].pts[at], at: Q, k: k + 1 };
    }
    // an anchor (bend) point taken away (user, 2026-11-13, CellDesigner's own model: anchor points are put and removed by
    // the user, CellDesigner's right click Remove Anchor Point; yEd: Delete): its y:Point out of the text, one undo step.
    // On a CellDesigner map the glyph then sits midway on the segment it is on, as CellDesigner puts it
    function unbend(list) {
      list = list.slice().sort(function (a, b) { return b - a; });   // last first, so the earlier ones keep their place in the text
      var before = text;
      list.forEach(function (pi) {
        var re = /<y:Point\s[^>]*>/g, m, c = -1;
        while ((m = re.exec(text))) if (++c === pi) break;
        if (!m) return;
        var a = m.index, b = m.index + m[0].length;
        var s0 = text.lastIndexOf('\n', a - 1) + 1;
        if (/^[ \t]*$/.test(text.slice(s0, a)) && text[b] === '\n') { a = s0; b += 1; }   // on a line of its own: the line goes
        text = text.slice(0, a) + text.slice(b);
      });
      if (text === before) return false;
      var keep = text; text = before; remember(false); text = keep;
      parse(); selN = []; selP = []; selE = []; keyGuides = null; dirty = true;
      render(); paint(); changed();
      return true;
    }
    var rclick = null;   // where the last right click was, for the menu's Remove anchor point
    window.m2EditAnchor = function () {
      if (!on || V.current !== map || !rclick) return null;
      var h = hit(rclick);
      if (!h || h.p == null) return null;
      var pi = h.p;
      return function () { unbend([pi]); };
    };
    // an anchor point put where the right click was on a line (user, 2026-11-13: "not only remove anchor point, but also
    // add anchor point"; CellDesigner's right click Add Anchor Point): the same new point a drag on the line makes, left
    // in place, the line selected so its points show and the new one is dragged with the next press; one undo step.
    // Not on the process glyph (no anchor point there: it sits midway on its segment)
    window.m2EditAddAnchor = function () {
      if (!on || V.current !== map || !rclick) return null;
      var h = hit(rclick), P = rclick;
      if (!h || h.e == null || h.glyph) return null;
      var k = h.e;
      return function () {
        var nb = bend(k, P);
        if (!nb) return;
        selN = []; selP = []; selE = [k]; keyGuides = null; dirty = true;
        render(); paint(); changed();
      };
    };
    // guides for nodes (user, 2026-11-12: "use as in yEd, then I correct"), yEd's snap lines: the node pressed (the
    // selection moving with it) snaps when (1) one of its own arcs' segments becomes level or upright, (2) its centre lines
    // up with another node's, (3) a side with the same side of another node (opposite sides only when the two are close),
    // (4) it sits midway between two nodes, (5) it is dragged nearly straight across or down (only x or only y changes).
    // Each axis on its own; 6 px on screen; the smallest correction wins, near ties (1 px) by that order; every reason
    // that holds is shown: thick grey for an arc, a thin line for centres and sides, marks for equal gaps. Ctrl or Alt held,
    // no snapping (yEd: Ctrl). Not yet: the set node to node and node to arc distances (no default in yEd's manual).
    var CLOSE = 40;   // opposite sides snap only within this gap (map units), and lines reach this far past the nodes
    function snapNode(d) {
      d.guides = []; d.lines = []; d.marks = []; d.crosses = [];
      var T = 6 / V.z, b0 = boxOf(d.n), cand = { x: [], y: [] }, moved = mv.n, up = new Set();
      nodes2.forEach(function (n, i) { if (n.inside.indexOf(d.n) >= 0) up.add(i); });   // its own compartments: no guide
      var r = V.view.getBoundingClientRect(), v0 = [-V.tx / V.z + x0, -V.ty / V.z + y0], v1 = [(r.width / V.pz() - V.tx) / V.z + x0, (r.height / V.pz() - V.ty) / V.z + y0];
      var B = [b0[0] + d.dx, b0[1] + d.dy, b0[2], b0[3]];
      function add(ax, cur, to, rank, why) { var c = to - cur; if (Math.abs(c) <= T) cand[ax].push({ c: c, rank: rank, why: why }); }
      mv.dx = d.dx; mv.dy = d.dy;
      edges2.forEach(function (e, k) {   // (1) the node's own arcs: the segment at the moved end level or upright
        if (e.s == null || e.t == null || moved.has(e.s) === moved.has(e.t)) return;
        var P = ports(k), a = moved.has(e.s), i = a ? 0 : P.length - 1, j = a ? 1 : P.length - 2;
        var pi = a ? e.pts[0] : e.pts[e.pts.length - 1];
        if (pi != null && mv.p.has(pi)) return;
        add('x', P[i][0], P[j][0], 1, { arc: k, end: i, to: j }); add('y', P[i][1], P[j][1], 1, { arc: k, end: i, to: j });
      });
      var cx = B[0] + B[2] / 2, cy = B[1] + B[3] / 2;
      var others = [];
      nodes2.forEach(function (n, i) {
        if (moved.has(i) || up.has(i)) return;
        var o = boxOf(i);
        if (o[0] > v1[0] || o[1] > v1[1] || o[0] + o[2] < v0[0] || o[1] + o[3] < v0[1]) return;   // only what is in sight
        others.push(o);
        add('x', cx, o[0] + o[2] / 2, 2, { c: o, ax: 'x' }); add('y', cy, o[1] + o[3] / 2, 2, { c: o, ax: 'y' });
        add('x', B[0], o[0], 3, { s: o, at: 0 }); add('x', B[0] + B[2], o[0] + o[2], 3, { s: o, at: 1 });
        add('y', B[1], o[1], 3, { s: o, at: 0 }); add('y', B[1] + B[3], o[1] + o[3], 3, { s: o, at: 1 });
        var gx = Math.max(o[0] - B[0] - B[2], B[0] - o[0] - o[2]), gy = Math.max(o[1] - B[1] - B[3], B[1] - o[1] - o[3]);
        if (gx <= CLOSE) { add('y', B[1], o[1] + o[3], 3, { s: o, at: 1 }); add('y', B[1] + B[3], o[1], 3, { s: o, at: 0 }); }
        if (gy <= CLOSE) { add('x', B[0], o[0] + o[2], 3, { s: o, at: 1 }); add('x', B[0] + B[2], o[0], 3, { s: o, at: 0 }); }
      });
      ['x', 'y'].forEach(function (ax) {   // (4) midway between the nearest node on each side, among those level with it
        var h = ax === 'x' ? 0 : 1, w = 1 - h, lo = null, hi = null;
        others.forEach(function (o) {
          if (o[w] > B[w] + B[w + 2] || o[w] + o[w + 2] < B[w]) return;
          if (o[h] + o[h + 2] <= B[h] && (!lo || o[h] + o[h + 2] > lo[h] + lo[h + 2])) lo = o;
          if (o[h] >= B[h] + B[h + 2] && (!hi || o[h] < hi[h])) hi = o;
        });
        if (lo && hi) add(ax, B[h], (lo[h] + lo[h + 2] + hi[h] - B[h + 2]) / 2, 4, { mid: [lo, hi] });
      });
      add('x', d.dx, 0, 5, null); add('y', d.dy, 0, 5, null);   // (5) dragged straight: the start's x or y kept
      ['x', 'y'].forEach(function (ax) {
        var l = cand[ax];
        if (!l.length) return;
        var m = Math.min.apply(null, l.map(function (q) { return Math.abs(q.c); })), z1 = 1 / V.z;
        var pick = l.filter(function (q) { return Math.abs(q.c) <= m + z1; }).sort(function (a, b) { return a.rank - b.rank; })[0];
        if (ax === 'x') { d.dx += pick.c; d.gx = true; } else { d.dy += pick.c; d.gy = true; }
        d['w' + ax] = l.filter(function (q) { return Math.abs(q.c - pick.c) < 0.01 && q.why; }).map(function (q) { return q.why; });
      });
      // what is shown, at the place reached
      mv.dx = d.dx; mv.dy = d.dy;
      var F = [b0[0] + d.dx, b0[1] + d.dy, b0[2], b0[3]], E = CLOSE / 2;
      ['x', 'y'].forEach(function (ax) {
        var h = ax === 'x' ? 0 : 1, w = 1 - h;
        (d['w' + ax] || []).forEach(function (q) {
          if (q.arc != null) { var P = ports(q.arc); d.guides.push([P[q.end], P[q.to]]); return; }
          var o = q.c || q.s;
          if (o) {
            var at = q.c ? o[h] + o[h + 2] / 2 : o[h] + o[h + 2] * q.at, a = Math.min(o[w], F[w]) - E, c = Math.max(o[w] + o[w + 2], F[w] + F[w + 2]) + E;
            d.lines.push(h === 0 ? [[at, a], [at, c]] : [[a, at], [c, at]]);
            var m1 = o[w] + o[w + 2] / 2, m2 = F[w] + F[w + 2] / 2;   // the crosses: each node's middle on the line
            d.crosses.push(h === 0 ? [at, m1] : [m1, at], h === 0 ? [at, m2] : [m2, at]);
            return;
          }
          if (q.mid) {   // the two equal gaps, each with its marks, at the middle of the moved node
            var mm = F[w] + F[w + 2] / 2, lo = q.mid[0], hi = q.mid[1];
            [[lo[h] + lo[h + 2], F[h]], [F[h] + F[h + 2], hi[h]]].forEach(function (g) {
              d.marks.push(h === 0 ? [[g[0], mm], [g[1], mm]] : [[mm, g[0]], [mm, g[1]]]);
            });
          }
        });
      });
    }
    function onGrid(d) {   // snap to the grid, an axis a guide has not taken: the node pressed by its centre on 8 px, a
      // bend point (alone, or the first of an arc dragged) on 4 px; Alt or Ctrl held, no snapping
      var X, Y2, st;
      if (d.n != null) { var b = boxOf(d.n); X = b[0] + b[2] / 2; Y2 = b[1] + b[3] / 2; st = NODE_STEP; }
      else {
        var pi = d.p != null ? d.p : d.e != null && edges2[d.e].pts.length ? edges2[d.e].pts[0] : null;
        if (pi == null) return;
        X = num(points[pi], 'x'); Y2 = num(points[pi], 'y'); st = BEND_STEP;
      }
      if (!d.gx) d.dx += toGrid(X + d.dx, st);
      if (!d.gy) d.dy += toGrid(Y2 + d.dy, st);
    }
    V.view.addEventListener('pointermove', function (e) {
      if (rpan) {
        e.stopImmediatePropagation();
        if (e.pointerType === 'mouse' && !e.buttons) { rpan = null; V.view.classList.remove('m2-drag'); return; }
        V.tx += (e.clientX - rpan[0]) / V.pz(); V.ty += (e.clientY - rpan[1]) / V.pz(); rpan = [e.clientX, e.clientY]; V.moved = true; V.draw();
        return;
      }
      if ((drag || band) && e.pointerType === 'mouse' && !e.buttons) return release(e);   // its release never came
      if (drag || band) {
        e.stopImmediatePropagation();
        var P = at(e);
        if (band) { band.x2 = P[0]; band.y2 = P[1]; }
        else if (drag.port) { if (drag.port.to || Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) >= 4) drag.port.to = spot(drag.port, P); }
        else if (drag.rs) {
          var seed = {}; seed[drag.rs.c] = resized(drag, P, gridSet.snap && !e.altKey && !e.ctrlKey);
          liveFit(seed);
        }
        else if (drag.grab && Math.hypot(e.clientX - drag.grab.sx, e.clientY - drag.grab.sy) < 4) return;   // not a drag yet
        else {
          if (drag.grab) { var nb = bend(drag.grab.k, drag.grab.P); drag.grab = null;
            if (nb) { drag.x = nb.at[0]; drag.y = nb.at[1]; drag.p = nb.p; drag.e = null; drag.made = drag.made || nb.k; selN = []; selE = []; selP = [nb.p]; mv = moving(); } }
          drag.dx = Math.round(P[0] - drag.x); drag.dy = Math.round(P[1] - drag.y);
          drag.gx = drag.gy = false;
          drag.lines = []; drag.marks = [];
          if (drag.p != null) snap(drag);
          else if (drag.n != null && !e.altKey && !e.ctrlKey) snapNode(drag);
          if (gridSet.snap && !e.altKey && !e.ctrlKey) onGrid(drag);
          mv.dx = drag.dx; mv.dy = drag.dy; shift();
          if (mv.n.size) liveFit();   // the compartments round it grow with it (user, 2026-11-12)
        }
        paint();
        return;
      }
      if (on && V.current === map && !e.buttons) {   // the move sign only over what a drag would move
        var PP = at(e), hh = e.shiftKey ? null : hit(PP), ez = !e.shiftKey && edgeAt(PP);
        if (ez && hh && (hh.p != null || (hh.n != null && !nodes2[hh.n].comp && selN.indexOf(ez.c) < 0))) ez = null;
        if (ez) { V.view.style.cursor = resizeCursor(ez.s); return; }
        var sel = hh && ((hh.p != null ? selP.indexOf(hh.p) : hh.e != null ? selE.indexOf(hh.e) : selN.indexOf(hh.n)) >= 0 ||
          (hh.p != null && selE.some(function (q) { return edges2[q].pts.indexOf(hh.p) >= 0; })));
        V.view.style.cursor = !hh ? '' : sel ? 'move' : 'pointer';
      }
    }, true);
    function release(e) {
      if (rpan) { rpan = null; V.view.classList.remove('m2-drag'); e.stopImmediatePropagation(); return; }
      var t = tap; tap = null;
      if (t && e.type === 'pointerup' && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 5) {   // a click, not a drag of the map
        e.stopImmediatePropagation();   // the viewer's release would open the annotation (its own pointer ends with the capture)
        var hs = t.h;
        part = null;
        if (!hs) { if (!t.shift) { selN = []; selP = []; selE = []; } paint(); return; }
        var li = hs.p != null ? selP : hs.e != null ? selE : selN, ki = hs.p != null ? hs.p : hs.e != null ? hs.e : hs.n;
        if (t.shift) { if (li.indexOf(ki) >= 0) li.splice(li.indexOf(ki), 1); else li.push(ki); }
        else { selN = hs.n != null ? [ki] : []; selP = hs.p != null ? [ki] : []; selE = hs.e != null ? [ki] : []; }
        paint(); return;
      }
      if (!drag && !band) return;
      e.stopImmediatePropagation();
      if (band) {
        var a = [Math.min(band.x, band.x2), Math.min(band.y, band.y2)], c = [Math.max(band.x, band.x2), Math.max(band.y, band.y2)];
        nodes2.forEach(function (n, i) { var b = boxOf(i); if (cd && /\|proc$/.test(n.id)) return; if (b[0] >= a[0] && b[1] >= a[1] && b[0] + b[2] <= c[0] && b[1] + b[3] <= c[1] && selN.indexOf(i) < 0) selN.push(i); });
        points.forEach(function (p, i) { var X = num(p, 'x'), Y2 = num(p, 'y'); if (X >= a[0] && Y2 >= a[1] && X <= c[0] && Y2 <= c[1] && selP.indexOf(i) < 0) selP.push(i); });
        band = null; part = null; paint(); return;
      }
      var d = drag; drag = null; var sets = mv; mv = null;   // the moved groups and live arcs stay until the map is drawn again
      if (!d.port && !d.rs) frozen = true;   // the copies too: the file now has the new places, the picture not yet
      if (d.port) {   // dragged: the port set; a click: the node there selected, as without a line lit
        if (d.port.to) setPort(d.port); else { selN = [d.port.n]; selP = []; selE = []; paint(); }
        return;
      }
      if (d.rs) {   // a compartment resized: its box set, never smaller than what it holds, the ones round it grown
        var nb = liveC && liveC[d.rs.c];
        if (!nb || nb.every(function (v, j) { return Math.abs(v - d.rs.b0[j]) < 0.01; })) { liveOff(); paint(); return; }
        remember(false);
        fitThen({ resize: [nodes2[d.rs.c].id].concat(nb), moved: [] }, function (k) {
          if (!k) { undo.pop(); liveOff(); paint(); return; }
          render(); paint(); changed();
        });
        return;
      }
      var fitAfter = function () {   // the compartments round what moved grow to hold it, in the same undo step
        fitThen({ moved: movedIds(sets) }, function () { render(); changed(); });
      };
      if (d.made != null && Math.abs(d.dx) < 0.01 && Math.abs(d.dy) < 0.01) {   // a new bend dragged back to where it was made (a snap may leave a hair): none made
        text = undo.pop(); parse(); selP = []; selE = [d.made - 1]; unshift(); paint(); return;
      }
      // a second click on what is selected, with no drag (under 4 px on screen): it is deselected (user, 2026-11-12: "if
      // you click second time and do not move it, then it deselects it"); a bend point of an arc selected keeps its arc
      if (d.made == null && !d.keepE && d.sx0 != null && e.type === 'pointerup' && Math.hypot(e.clientX - d.sx0, e.clientY - d.sy0) < 4) {
        unshift();
        var out1 = function (list, k) { var j = list.indexOf(k); if (k != null && j >= 0) list.splice(j, 1); };
        if (d.p != null) out1(selP, d.p); else if (d.e != null) out1(selE, d.e); else out1(selN, d.n);
        paint(); return;
      }
      if (d.made != null) { move(d.dx, d.dy); fitAfter(); }   // one step for undo: made and moved
      else if (d.dx || d.dy) { remember(false); move(d.dx, d.dy); if (d.keepE) { selE = d.keepE; selP = []; } fitAfter(); }
      else { unshift(); if (d.keepE) { selE = d.keepE; selP = []; } }   // a click with a slight jitter: nothing moved, nothing stays hidden (user, 2026-11-12: a smooth bend
      // turned sharp: the arcs were drawn as plain lines while waiting for a redraw that a move of zero never asked for)
      paint();
    }
    V.view.addEventListener('pointerup', release, true);
    V.view.addEventListener('pointercancel', release, true);

    // an end of a line moved by the keys among the node's five places, as a drag sets it (user, 2026-11-13): from the
    // centre to the side the arrow points to; from a side, the opposite arrow back to the centre, another to its side
    function portKey(pp, d) {
      var e = edges2[pp.k], a = pp.end ? ['tx', 'ty'] : ['sx', 'sy'], b = bx(pp.n);
      var c = [b[0] + b[2] / 2, b[1] + b[3] / 2], o = spot(pp, [c[0] + num(e.path, a[0]), c[1] + num(e.path, a[1])]);
      var u = [Math.sign(d[0]), Math.sign(d[1])], s = [Math.sign(o[0]), Math.sign(o[1])];
      var to = (s[0] || s[1]) && s[0] === -u[0] && s[1] === -u[1] ? [0, 0] : [u[0] * b[2] / 2, u[1] * b[3] / 2];
      setPort({ k: pp.k, end: pp.end, n: pp.n, to: to });
    }
    // the keys: arrows move the selection by 1 (Shift: 10), Ctrl or Cmd with Z undoes, with S saves; Esc clears
    document.addEventListener('keydown', function (e) {
      if (!text) return;
      var mod = e.ctrlKey || e.metaKey, k = /^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();   // letters by their place on the keyboard, so Z, Y, S, A work in any layout
      if (mod && k === 's') { e.preventDefault(); save(); return; }
      if (!on || V.current !== map || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (mod && k === 'a') {   // select all, as yEd (user, 2026-11-13): every node and line; a CellDesigner glyph is no item of its own
        e.preventDefault(); part = null; keyGuides = null; selP = [];
        selN = nodes2.map(function (n, i) { return i; }).filter(function (i) { return !(cd && /\|proc$/.test(nodes2[i].id)); });
        selE = edges2.map(function (x, k2) { return k2; });
        paint(); return;
      }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) back(redo, undo); else back(undo, redo); return; }
      if (mod && k === 'y') { e.preventDefault(); back(redo, undo); return; }
      if (e.key === 'Escape') { selN = []; selP = []; selE = []; part = null; keyGuides = null; paint(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selP.length && !selN.length) { e.preventDefault(); unbend(selP); return; }
      var step = e.shiftKey ? 10 : 1, d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();   // while editing the arrows never step to another map
      if (!selN.length && !selP.length && !selE.length) return;
      // a line selected alone: only its part last pressed moves, as by hand (a bend point, or an end stepped among the
      // node's five places); none pressed, nothing moves
      var pt0 = part && !selN.length && !selP.length && selE.indexOf(part.k) >= 0 ? part : null;
      if (!selN.length && !selP.length && !pt0) return;
      if (pt0 && pt0.port) { portKey(pt0.port, d); return; }
      var ks = pt0 ? { n: new Set(), p: new Set([pt0.p]), dx: 0, dy: 0 } : moving();
      var bp = pt0 ? pt0.p : selP.length === 1 && !selN.length && !selE.length ? selP[0] : null;
      if (bp != null) d = keyAlign(bp, d, ks.p);
      remember(true); move(d[0], d[1], ks); keyShift(ks, d[0], d[1]); keyGuides = bp != null ? bendGuides(bp) : null; paint();
      clearTimeout(timer); timer = setTimeout(function () { fitThen({ moved: movedIds(ks) }, function () { render(); paint(); }); }, 150); changed();
    }, true);
