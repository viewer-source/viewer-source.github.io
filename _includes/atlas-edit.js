  // ---------- editing (--m2-edit: 1; user, 2026-11-12) ----------
  // Moves only: nodes and bend points of a yEd GraphML, nudged in the map window. Nothing is drawn twice: a move changes
  // only the numbers of that position in the file's text (everything else stays byte for byte, so yEd opens it as
  // before), and the viewer's own yEd renderer, run in the browser by Pyodide, draws the map again. A map of the site is
  // saved by itself, as in Google Docs (user, 2026-11-12): a few seconds after the last move its source file is committed
  // to the site's repository with a GitHub token kept in this browser only, and the site's build redraws it; a file opened
  // from the computer is saved back into it (Chrome, Edge), else as a download. Included inside the viewer's script.
  var ed = (function () {
    var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';   // as the converter's page
    var Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
    var DRIVER = [
      'import sys, json',
      "sys.path.insert(0, '/home/pyodide')",
      'import yrender',
      'yrender.CLASSES = True',
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
    // saving to the site: the repository is the site's own (<owner>.github.io), the map's source maps/<file>.graphml
    var TOKEN_KEY = 'atlas-edit-token', AUTOSAVE = 3000;
    var site = null;               // { path, sha } of the map being edited, when it is a map of this site
    var saveTimer = null, saving = null, saveAgain = false, stuck = false;
    // the edited drawing, kept on screen after editing stops until the site's own build of the map has caught up
    // (user, 2026-11-12: "after I exit this mode I don't see changes"): { id, v (the site's version when last saved), pic, width, height }
    var kept = null;
    // and across a reload (user, 2026-11-12): the last saved drawing of each map is kept in this browser
    // (localStorage atlas-edit-kept: { id: { v, svg, width, height, x0, y0, at } }) until the site's version changes, an hour at most
    var KEPT_KEY = 'atlas-edit-kept', lastSvg = null;
    // the click data (user, 2026-11-12): the site's boxes of the nodes are those of its own version; the boxes of the
    // nodes moved since follow them, so a click and the search find a molecule where it is drawn now
    var siteRef = null;   // { boxes (per node, yEd units, as in the site's version), x0, y0 (its drawing's frame) }
    function baseOf(pub, fr) {
      var all = (pub.match(/<y:Geometry\s[^>]*>/g) || []).map(function (tag) {
        var a = function (n) { var m = tag.match(new RegExp('\\s' + n + '="([^"]*)"')); return m ? parseFloat(m[1]) : NaN; };
        return [a('x'), a('y'), a('width'), a('height')];
      });
      if (all.length !== geos.length) return null;   // not the same file with moves only
      return { boxes: nodes2.map(function (n) { return all[n.geo[0]]; }), x0: fr.x0, y0: fr.y0 };
    }
    function nowRef() { return { boxes: nodes2.map(function (n, i) { return boxOf(i); }), x0: x0, y0: y0 }; }
    function boxes(k, list) {   // the site's click data with each node's box where the edited drawing has it
      if (!k || !k.ref || !k.cur || !list) return list;
      var ref = k.ref, cur = k.cur, near = function (a, b) { return Math.abs(a - b) < 0.6; };
      return list.map(function (n) {
        var b = n.box, i = -1;
        for (var j = 0; j < ref.boxes.length; j++) {
          var r = ref.boxes[j];
          if (r && near(b[0], r[0] - ref.x0) && near(b[1], r[1] - ref.y0) && near(b[2], r[2]) && near(b[3], r[3])) { i = j; break; }
        }
        var c = i >= 0 ? cur.boxes[i] : null;
        var nb = c ? [c[0] - cur.x0, c[1] - cur.y0, b[2], b[3]] : [b[0] + ref.x0 - cur.x0, b[1] + ref.y0 - cur.y0, b[2], b[3]];
        return Object.assign({}, n, { box: nb });
      });
    }
    function stored() { try { return JSON.parse(localStorage.getItem(KEPT_KEY) || '{}'); } catch (e) { return {}; } }
    function store(all) { try { if (Object.keys(all).length) localStorage.setItem(KEPT_KEY, JSON.stringify(all)); else localStorage.removeItem(KEPT_KEY); } catch (e) {} }
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
    function hm() { return new Date().toTimeString().slice(0, 5); }
    function changed() {   // after every move, undo or redo: the site's map is saved a few seconds after the last one
      if (!site || !token() || stuck) return;
      say('Saving in a moment...');
      clearTimeout(saveTimer); saveTimer = setTimeout(push, AUTOSAVE);
    }
    function push() {
      clearTimeout(saveTimer); saveTimer = null;
      if (!site || !dirty || stuck) return Promise.resolve();
      if (saving) { saveAgain = true; return saving; }
      var target = site, body = text;
      say('Saving...');
      saving = api('/contents/' + target.path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Moved in the viewer: ' + target.path.split('/').pop(), content: b64(body), sha: target.sha, branch: 'main' }) })
        .then(function (r) {
          return r.json().then(function (d) {
            if (r.ok) {
              target.sha = d.content.sha;
              var sm = byId[target.id];
              if (sm) target.v = ver(sm);   // the site's version still without this move
              if (lastSvg && site === target && text === body) {
                var all = stored();
                all[target.id] = { v: target.v, svg: lastSvg, width: map.width, height: map.height, x0: x0, y0: y0, at: Date.now(), ref: siteRef, cur: nowRef() };
                store(all);
              }
              if (site === target && text === body) dirty = false;
              say('Saved to the site ' + hm() + '. The site shows it in about two minutes; this page swaps it in by itself.');
            } else if (r.status === 409 || r.status === 422) {
              stuck = true;
              say('Not saved: the map was changed on GitHub since it was opened, and it is not overwritten. Stop editing and open the map again to go on from that version.');
            } else if (r.status === 401 || r.status === 403 || r.status === 404) {
              say('Not saved: the token was refused (' + r.status + '). Connect again with a token that can write to ' + repo() + '.');
              ghForm(true);
            } else say('Not saved (' + r.status + '): ' + (d.message || '') + '. The next move tries again.');
          });
        })
        .catch(function (e) { say('Not saved: no connection (' + e.message + '). The next move tries again.'); })
        .then(function () { saving = null; if (saveAgain) { saveAgain = false; if (dirty) return push(); } });
      return saving;
    }
    function ghForm(show) {   // the token field: shown while editing a map of this site with no token
      var f = box.querySelector('#m2-ed-gh');
      f.hidden = !show;
      box.querySelector('#m2-ed-gh-off').hidden = show || !token() || !repo();
    }

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
      to.push(text); text = from.pop(); parse(); selN = []; selP = []; dirty = true; render(); paint(); changed();
    }

    // the drawing: the renderer in the browser; the map keeps its place on screen when the drawing's edges change
    function render() {
      var t = ++ticket;
      return python().then(function (p) {
        var r = JSON.parse(p.globals.get('draw')(text));
        if (t !== ticket) return;
        if (r[1].length) say('Drawn with warnings: ' + r[1].join('; '));
        var svg = r[0]; lastSvg = svg; var m = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/);
        var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        var nx = -parseFloat(m[1]), ny = -parseFloat(m[2]), first = !map.width;
        if (!first) { tx += (nx - x0) * z; ty += (ny - y0) * z; }
        x0 = nx; y0 = ny; map.width = parseFloat(w[1]); map.height = parseFloat(w[2]);
        var pic = new Image(), url = URL.createObjectURL(new Blob([recolour(svg)], { type: 'image/svg+xml' }));
        pic.onload = function () {
          if (t !== ticket || current !== map) return URL.revokeObjectURL(url);
          var old = img.src;
          img.removeAttribute('id'); pic.id = 'm2-img'; pic.alt = map.title; img.replaceWith(pic); img = pic;
          if (old.indexOf('blob:') === 0) URL.revokeObjectURL(old);
          if (first) fit(); else draw();
          if (!r[1].length && !site) say(name + (dirty ? ' (not saved)' : ''));
          else if (!r[1].length && site && !saveTimer && !saving && !dirty) say(site.pending ? 'Editing ' + map.title + '. Connect to GitHub below so the moves are saved to the site.' : 'Editing ' + map.title + '. Every move is saved to the site by itself.');
        };
        pic.src = url;
      }).catch(function (e) { if (t === ticket) say('Not drawn: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); });
    }
    function start(t, n, h, s, same) {   // same: { width, height, x0, y0, scale } of the picture on screen, drawn from this very text
      try { text = t; parse(); } catch (e) { say('Cannot edit ' + n + ': ' + e); return; }
      siteRef = null; name = n; handle = h; site = s || null; if (site) site.base = t; stuck = false; dirty = false; undo = []; redo = []; selN = []; selP = [];
      map = { id: 'edit', title: n, width: 0, height: 0, scale: 1, downloads: [] };
      if (same) {   // editing starts on the picture as it is: no redraw, the map stays where it is (user, 2026-11-12)
        map.width = same.width; map.height = same.height; map.scale = same.scale; x0 = same.x0; y0 = same.y0;
      }
      current = map; on = true;
      nodes = null; sel = null; renderInfo(); drawPin();
      document.getElementById('m2-title').textContent = n;
      grid.classList.add('m2-editing');
      buttons();
      if (same && same.text === t) { python(); paint(); say((site && site.pending) ? 'Connect to GitHub below so the moves are saved to the site.' : site ? 'Every move is saved to the site by itself.' : 'Editing ' + n + '.'); return; }
      say('Drawing ' + n + '...');
      render();
    }
    function stop() {
      if (!on) return;
      if (saveTimer) push();   // a move still waiting is saved now
      if (site && site.id && undo.length) kept = { id: site.id, v: site.v, pic: img, width: map.width, height: map.height, x0: x0, y0: y0, text: text, ref: siteRef, cur: nowRef() };
      on = false; drag = null; band = null; grid.classList.remove('m2-editing'); paint(); buttons();
      say(dirty && !site ? name + ' has moves not saved: Back to it, or Save.' : 'Edit the map shown, or open a yEd GraphML file.');
    }
    function buttons() {
      ['#m2-ed-save', '#m2-ed-undo', '#m2-ed-redo'].forEach(function (k) { box.querySelector(k).disabled = !on; });
      box.querySelector('#m2-ed-save').hidden = !!site;   // a map of the site saves by itself
      ghForm(!!(on && site && !token()));
      box.querySelector('#m2-ed-back').hidden = on || !text;
      box.querySelector('#m2-ed-back').textContent = 'Back to ' + name;
      box.querySelector('#m2-ed-stop').hidden = !on;
      var g = graphmlOf(current);
      box.querySelector('#m2-ed-this').hidden = on || !g;
      // the Edit tab only on a map that can be edited, or while a file is being edited (user, 2026-11-12: "do not show
      // edit icon for maps that can not be edited"); its window gives way to the Maps list when the tab goes
      var off = !on && !(dirty && !site) && !g;
      grid.classList.toggle('m2-edit-off', off);
      if (off && win === 'edit') { win = 'list'; railMark(); }
    }
    function graphmlOf(m) {   // a map drawn from its GraphML: that file is first in its downloads
      var d = m && m.downloads && m.downloads[0];
      return d && d.label === 'GraphML' ? d.url : null;
    }

    function save() {
      if (!text) return;
      if (site) { if (token()) push(); return; }
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
      if (dirty && !site && !confirm(name + ' has moves not saved. Edit this map instead?')) return;
      if (saveTimer) push();
      var file = url.split('?')[0].split('/').pop(), path = 'maps/' + file;
      // the picture on screen is the site's drawing of its published GraphML: its frame (size and the offset of yEd's
      // coordinates) is read from that SVG, so editing starts on it without a redraw; the moved map is drawn again
      var k = keep(m), shownPic = img;
      // the site's own version (its GraphML and the frame of its drawing): what its click data was made from
      var sitePub = fetch(url, { cache: 'no-cache' }).then(function (r) { return r.text(); });
      var siteFrame = fetch(m.image + ver(m)).then(function (r) { return r.text(); }).then(function (svg) {
        var t = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/), w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        return t && w ? { width: parseFloat(w[1]), height: parseFloat(w[2]), x0: -parseFloat(t[1]), y0: -parseFloat(t[2]), scale: 1 } : null;
      }).catch(function () { return null; });
      var published = k && k.text ? Promise.resolve(k.text) : sitePub;
      var frame = k ? Promise.resolve({ width: k.width, height: k.height, x0: k.x0, y0: k.y0, scale: 1 }) : siteFrame;
      var go = function (t, s) {
        return Promise.all([published, frame, sitePub, siteFrame]).then(function (r) {
          var same = r[1] && img === shownPic && current === m ? Object.assign({}, r[1], { text: r[0] }) : null;
          if (s) { s.id = m.id; s.v = ver(m); }
          start(t, file, null, s, same);
          siteRef = r[3] ? baseOf(r[2], r[3]) : null;
          map.title = m.title; document.getElementById('m2-title').textContent = m.title;
        });
      };
      var fromSite = function (s) { return published.then(function (t) { return go(t, s); }); };
      say('Opening ' + m.title + '...');
      if (!repo()) return fromSite(null);
      if (!token()) return fromSite({ path: path, sha: null, pending: true });
      // with a token: the source as it is in the repository now (newer than the site while a build runs), and its sha,
      // which makes GitHub refuse a save over a version changed meanwhile
      api('/contents/' + path + '?ref=main').then(function (r) {
        if (r.status === 404) return fromSite(null);   // not a map of this repository: saved as a file
        if (!r.ok) throw r.status;
        return r.json().then(function (d) {
          return api('/contents/' + path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } })
            .then(function (r2) { if (!r2.ok) throw r2.status; return r2.text(); })
            .then(function (t) { go(t, { path: path, sha: d.sha }); });
        });
      }).catch(function (e) { say('Could not read the map from GitHub (' + e + '); the token may be refused.'); ghForm(true); });
    }
    // the token: pasted once, checked against the repository, kept in this browser only (localStorage)
    box.querySelector('#m2-ed-gh-go').addEventListener('click', function () {
      var v = box.querySelector('#m2-ed-gh-token').value.trim();
      if (!v) return;
      try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { say('This browser does not keep the token.'); return; }
      say('Checking the token...');
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
              if (f[1] !== s0.base) { stuck = true; say('Connected, but the map in the repository is newer than the copy opened: moves not saved, nothing overwritten. Stop editing and open the map again.'); return; }
              if (moved) { text = keep; dirty = true; push(); } else say('Connected. Every move is now saved to the site by itself.');
            });
        } else { buttons(); say('Connected. Every move on a map of this site is saved by itself.'); }
      }).catch(function (e) {
        try { localStorage.removeItem(TOKEN_KEY); } catch (x) {}
        say('The token was not accepted (' + e + ').'); ghForm(true);
      });
    });
    box.querySelector('#m2-ed-gh-off').addEventListener('click', function () {
      if (saveTimer) push();
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      buttons(); say('Disconnected: the token is removed from this browser.');
    });
    box.querySelector('#m2-ed-this').addEventListener('click', editShown);
    // the Edit tab starts editing the map shown at once (user, 2026-11-12: "does not look i can edit yet"); a map drawn
    // from a CellDesigner file says why it cannot be edited yet
    function shown() {   // the Edit window open on a map: edit it, or say why not (also when another map is chosen)
      if (!grid.classList.contains('m2-win-edit') || on) return;
      if (text && dirty && !site) return resume();
      if (graphmlOf(current)) return editShown();
      buttons();

    }
    document.querySelectorAll('#m2-rail .m2-ri[data-win="edit"]').forEach(function (b) { b.addEventListener('click', shown); });
    box.querySelector('#m2-ed-save').addEventListener('click', save);
    box.querySelector('#m2-ed-undo').addEventListener('click', function () { if (on) back(undo, redo); });
    box.querySelector('#m2-ed-redo').addEventListener('click', function () { if (on) back(redo, undo); });
    box.querySelector('#m2-ed-stop').addEventListener('click', function () { win = 'list'; railMark(); if (chosen) put(chosen); else stop(); });
    function resume() {   // back to a file from the computer with moves not saved
      current = map; on = true; grid.classList.add('m2-editing'); buttons();
      document.getElementById('m2-title').textContent = map.title;
      x0 = y0 = 0; map.width = 0; render();
    }
    box.querySelector('#m2-ed-back').addEventListener('click', resume);
    // silent editing (user, 2026-11-12: "as soon as I click edit icon ... I am in editing mode. And when I switch to list
    // or something else, I am out"): no Edit this map or Stop editing; leaving the Edit window, or closing the panel,
    // ends editing and shows the map of the site again (the edited drawing until the site catches up)
    function away() {
      if (!on) return;
      if (chosen) put(chosen, true); else stop();   // at the same place and zoom: nothing jumps
    }
    window.addEventListener('beforeunload', function (e) { if (dirty) { if (saveTimer) push(); e.preventDefault(); e.returnValue = ''; } });

    // on screen: the selection's outlines and every bend point, over the drawing
    function sx(X) { return tx + (X - x0) * z; }
    function sy(Y2) { return ty + (Y2 - y0) * z; }
    function paint() {
      // nothing over the drawing at rest (user, 2026-11-12: "it should look exactly as the original diagram"): no
      // selection outlines, no bend handles; only while a drag runs, a thin grey outline of what moves (or the area
      // being selected), gone on release
      if (!on || current !== map || (!drag && !band)) { overlay.innerHTML = ''; return; }
      var out = [];
      if (drag && (drag.dx || drag.dy)) {
        var dx = drag.dx, dy = drag.dy, moving = new Set();
        selN.forEach(function (i) { moving.add(i); nodes2[i].inside.forEach(function (c) { moving.add(c); }); });
        moving.forEach(function (i) {
          var b = boxOf(i);
          out.push('<rect class="m2-ed-ghost" x="' + sx(b[0] + dx) + '" y="' + sy(b[1] + dy) + '" width="' + b[2] * z + '" height="' + b[3] * z + '"/>');
        });
        selP.forEach(function (i) {
          var p = points[i];
          out.push('<circle class="m2-ed-ghost" cx="' + sx(num(p, 'x') + dx) + '" cy="' + sy(num(p, 'y') + dy) + '" r="3"/>');
        });
      }
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
      if (d.dx || d.dy) { remember(false); move(d.dx, d.dy); render(); changed(); }
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
      clearTimeout(timer); timer = setTimeout(render, 150); changed();
    }, true);

    buttons();
    function keep(m) {   // the edited picture, while the site still shows the version before the last save
      if (kept && kept.id === m.id) {
        if (ver(m) === kept.v) return kept;
        kept = null;
      }
      var all = stored(), k = all[m.id];
      if (!k) return null;
      if (ver(m) !== k.v || Date.now() - k.at > 3600000) { delete all[m.id]; store(all); return null; }
      // after a reload: the saved drawing again, decoded before it is shown
      var url = URL.createObjectURL(new Blob([recolour(k.svg)], { type: 'image/svg+xml' }));
      var pic = new Promise(function (res) {
        var i = new Image();
        i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).catch(function () {}).then(function () { res(i); }); };
        i.onerror = function () { res(null); };
        i.src = url;
      });
      kept = { id: m.id, v: k.v, pic: pic, width: k.width, height: k.height, x0: k.x0, y0: k.y0, text: null, ref: k.ref, cur: k.cur };
      return kept;
    }
    return { paint: paint, keep: keep, boxes: boxes, away: away, leaving: function (m) { if (on && m !== map) stop(); }, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); } };
  })();
