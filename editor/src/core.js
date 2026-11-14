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
    function src() { return cd ? cd.now : sb ? sbNow() : text; }   // the map's own file as it is now (an SBGN-ML map's with the moves written in)
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
    var TOKEN_KEY = V.tokenKey, AUTOSAVE = 3000;   // the key is the viewer's (it ignores drafts while a token is in)
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
    // a reader's map added to the site (user, 2026-11-14: with a token, Add map "would be saved indeed" on GitHub): the
    // file as maps/<id>.graphml or .xml and its maps/<id>.md (title from the file's name, group, order) in one commit on
    // main, so the build makes it a map of the site; the id from the file's name, made unique among maps/. A branch moved
    // meanwhile (the build commits after each push): built again on the newest main, three tries
    function toSite(name, text, group, order) {
      if (!(repo() && token())) return Promise.reject(new Error('not connected to GitHub'));
      var ext = /\.graphml$/i.test(name) ? '.graphml' : '.xml', base = name.replace(/\.(graphml|xml)$/i, ''),
          slug = (base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map').replace(/-(sbgn|sbgnml)$|^external-/, function (x) { return x === 'external-' ? 'map-external-' : x + '-map'; });   // the build's own ids end or start so
      var head = text.slice(0, 5000);
      if (ext === '.graphml' ? head.indexOf('yworks.com') < 0 : !(/<sbml[\s>]/.test(head) && text.indexOf('celldesigner') >= 0))
        return Promise.reject(new Error(ext === '.graphml' ? 'not a yEd GraphML file' : 'not a CellDesigner file'));
      base = base.replace(/["\\]/g, '');   // the build reads the front matter's quotes plainly
      var md = '---\ntitle: ' + JSON.stringify(base) + '\ntopic: ' + JSON.stringify(base) + '\ngroup: ' + JSON.stringify(group || '') + '\norder: ' + (order | 0) + '\n---\n';
      var j = function (r) { return r.ok ? r.json() : r.json().then(function (d) { var e = new Error(d && d.message || 'GitHub ' + r.status); e.status = r.status; throw e; }); };
      var post = function (path, body, method) { return api(path, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j); };
      var listing = api('/contents/maps?ref=main').then(j).then(function (d) { var o = {}; d.forEach(function (f) { o[f.name.replace(/\.[^.]+$/, '')] = 1; }); return o; });
      return listing.then(function (taken) {
        var id = slug; for (var k = 2; taken[id]; k++) id = slug + '-' + k;
        return Promise.all([post('/git/blobs', { content: b64(text), encoding: 'base64' }), post('/git/blobs', { content: b64(md), encoding: 'base64' })]).then(function (b) {
          var tries = 0;
          var go = function () {
            return api('/git/ref/heads/main').then(j).then(function (ref) {
              return api('/git/commits/' + ref.object.sha).then(j).then(function (c) {
                return post('/git/trees', { base_tree: c.tree.sha, tree: [{ path: 'maps/' + id + ext, mode: '100644', type: 'blob', sha: b[0].sha }, { path: 'maps/' + id + '.md', mode: '100644', type: 'blob', sha: b[1].sha }] });
              }).then(function (t) { return post('/git/commits', { message: 'Map added in the viewer: ' + id + ext, tree: t.sha, parents: [ref.object.sha] }); })
                .then(function (c) { return post('/git/refs/heads/main', { sha: c.sha }, 'PATCH'); });
            }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
          };
          return go().then(function () { ghDir = null; return { id: id }; });   // the listing read again next time
        });
      });
    }
    function changed() {   // after every move, undo or redo: the site's map is saved a few seconds after the last one
      if (site && site.pending) { localFor = site; clearTimeout(localTimer); localTimer = setTimeout(local, 800); localBox(); return; }   // no token: kept in this browser
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
        body: JSON.stringify({ message: 'Moved in the viewer: ' + target.path.split('/').pop(), content: b64(body), sha: target.sha || undefined, branch: 'main' }) })
        .then(function (r) {
          return r.json().then(function (d) {
            if (r.ok) {
              target.sha = d.content.sha; target.saved = body;
              if (bank[target.id] && bank[target.id].kept !== target) forget(target.id);   // what was read ahead is older than this save (the copy kept on leaving waits for it: keepAhead)
              learnt(target.path, target.sha);   // the folder's listing read before is older for this map
              if (V.kept && V.kept.id === target.id) V.kept.sha = target.sha;
              var sm = V.byId[target.id];
              if (sm) target.v = V.ver(sm);   // the site's version still without this move
              var ks = lastFor && lastFor[2] === target.id ? lastSvg : null;   // this map's drawing only, never the map edited before (the review, 2026-11-14)
              if (ks && site === target && src() === body) {
                var all = V.stored();
                var one = {}; one[target.id] = all[target.id] = { v: target.v, sha: target.sha, svg: ks, text: body, file: name, width: map.width, height: map.height, x0: picX0(), y0: picY0(), at: Date.now(), ref: siteRef, cur: nowRef() };
                // the browser's storage full (a few large maps): the other maps' files left out first (their downloads after a
                // reload are then the site's), then this map's, then this map's drawing alone, else none of it (never an older one)
                var bare = function (o, keep) { Object.keys(o).forEach(function (k) { if (k !== keep) delete o[k].text; }); return o; };
                if (!V.store(all) && !V.store(bare(all, target.id)) && !V.store(bare(all)) && !V.store(bare(one))) { all = V.stored(); delete all[target.id]; V.store(all); }
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
    // no token (user, 2026-11-13, the first layer): the map's file as edited and its drawing kept in this browser
    // (draftPut, own.js), a moment after the last move once the move is drawn, so a reload shows it and editing goes on from
    // it; the map back as the site has it (every move undone): let go. force: written now, the drawing as it is (another
    // map is being opened)
    var localTimer = null, localFor = null;
    function local(force) {
      clearTimeout(localTimer); localTimer = null;
      var s = localFor;
      if (!s || site !== s) return;
      var drawn = !drawing && lastFor && lastFor[0] === text && lastFor[1] === (cd ? cd.now : null);
      if (!drawn && !force) { localTimer = setTimeout(local, 300); return; }
      localFor = null;
      var t = src(), at = { width: map.width, height: map.height, x0: picX0(), y0: picY0(), ref: siteRef, cur: nowRef() };
      // this map's drawing only: the map edited before still drawn while this one's first redraw runs (another map opened
      // at once) is never stored with it; then this text is drawn for it here (the review, 2026-11-14)
      var own = lastFor && lastFor[2] === s.id ? lastSvg : null;
      var pic = function () { return own ? Promise.resolve({ svg: own, width: at.width, height: at.height }) : drawText(t); };
      var fail = function (e) { if (site === s) warn('Not kept in this browser: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '. Download the map to keep your changes.'); };
      if (s.mine) {   // a reader's own map: the map itself changed, in this browser and its folder (no draft)
        if (!mine[s.id] || mine[s.id].site) return;   // gone from this browser meanwhile (to the site): nothing to keep
        toFolder(s.id, name, t);
        pic().then(function (d) { return minePut(Object.assign({}, mine[s.id], { text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now() })); })
          .then(function () { if (site === s && src() === t) dirty = false; if (!on || site !== s) V.refreshMine(); })
          .catch(fail);
        return;
      }
      if (atSite()) { draftDrop(s.id); dirty = false; localBox(); toFolder(s.id, name, t, true); return; }   // a file in the folder back to the site's map too
      toFolder(s.id, name, t);   // layer 2: the same file into the reader's folder, when there is one
      pic().then(function (d) { return draftPut(s.id, { file: name, v: s.v, text: t, svg: d.svg, width: d.width, height: d.height, x0: at.x0, y0: at.y0, ref: at.ref, cur: at.cur, at: Date.now() }); })
        .then(function () { if (site === s && src() === t) dirty = false; })
        .catch(fail);
    }
    // the map as the site has it: its text, or every move undone (a map shifted out of negative places never gives the
    // site's text back: the review, 2026-11-13)
    function atSite() { return site.pending && (src() === site.pub || (!undo.length && !site.fromDraft)); }
    function unkeep(id) {   // the reader's changes let go (Back to the site's map, a token connected): a write waiting dropped too
      if (localFor && localFor.id === id) { clearTimeout(localTimer); localTimer = null; localFor = null; }
      return draftDrop(id);
    }
    // layer 2 (user, 2026-11-13: "saved automatically in a certain folder they choose"): a folder on the reader's computer,
    // chosen once (Chrome, Edge: showDirectoryPicker), where every map kept in this browser is also written as its file, a
    // moment after the last move. A file this browser did not write is never overwritten: one there already, or changed
    // since by another program, gets the next free name beside it (acly-2.graphml). After a reload the browser may ask
    // again (Allow), unless it keeps the permission (Chrome 122 and later can). Its record: folder() in own.js
    var canFolder = 'showDirectoryPicker' in window, folderOk = null, fq = Promise.resolve();   // folderOk null: not known yet (no text 3 or 4)
    function folderCheck() {   // whether the page may write into the folder now (the Edit window's texts follow it)
      folderOk = null; localBox();
      return folder().then(function (f) {
        if (!f) return folderForget().then(function () { return null; });   // its record lost: Choose a folder again
        return f.dir.queryPermission({ mode: 'readwrite' });
      }).then(function (p) { folderOk = p === 'granted'; localBox(); }, function () { folderOk = false; localBox(); });
    }
    function lost(e) {   // the folder moved, deleted or refused for good: said, and Choose a folder offered again
      folderForget().then(function () { folderOk = null; localBox(); });
      warn('Not saved to the folder: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '.');
    }
    function freeName(dir, file, n) {
      var nm = file.replace(/(\.[^.]+)?$/, '-' + n + '$1');
      return dir.getFileHandle(nm).then(function () { return freeName(dir, file, n + 1); }, function () { return nm; });
    }
    function toFolder(id, file, t, ours) {   // one at a time, in the order asked; ours: only into a file written here before
      if (!canFolder || !V.folderName() || !file) return fq;
      fq = fq.then(function () {
        return folder().then(function (f) {
          if (!f) return;
          var w = f.files[id];
          if (ours && !w) return;
          return f.dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
            folderOk = p === 'granted';
            if (!folderOk) { localBox(); return; }
            var nm = w ? w.name : file;
            return f.dir.getFileHandle(nm).then(function (h) { return h.getFile(); }, function () { return null; }).then(function (old) {
              // not ours (there before, or changed since by another program): beside it
              return old && !(w && old.lastModified === w.mod && old.size === w.size) ? freeName(f.dir, file, 2) : nm;
            }).then(function (nm2) {
              var h;
              return f.dir.getFileHandle(nm2, { create: true }).then(function (x) { h = x; return h.createWritable(); })
                .then(function (wr) { return wr.write(t).then(function () { return wr.close(); }); })
                .then(function () { return h.getFile(); })
                .then(function (fl) { return folderFile(id, { name: nm2, mod: fl.lastModified, size: fl.size }); });
            });
          });
        });
      }).catch(function (e) { if (e && (e.name === 'NotFoundError' || e.name === 'NotAllowedError')) lost(e); else warn('Not saved to the folder: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '.'); });
      return fq;
    }
    function allToFolder() {   // every map kept in this browser, once a folder is chosen or allowed again
      var d = V.drafts;
      Object.keys(d).forEach(function (id) {
        var m = V.byId[id], f = d[id].file || (graphmlOf(m && m.site || m) || '').split('?')[0].split('/').pop();   // site: the map's own entry, when it is shown from its SBGN-ML
        toFolder(id, f, d[id].text);
      });
      Object.keys(mine).forEach(function (id) { var r = mine[id]; if (!r.hidden && !r.site) toFolder(id, r.file, r.text); });   // one added to the site is not the folder's
      return fq;
    }
    function chooseFolder() {
      if (!canFolder) return Promise.resolve();
      return window.showDirectoryPicker({ id: 'atlas-maps', mode: 'readwrite' })
        .then(function (dir) { return folderSet(dir); })
        .then(function () { folderOk = true; localBox(); return allToFolder(); }).then(syncFolder)
        .catch(function (e) { if (e && e.name === 'AbortError') return; warn('No folder chosen: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '.'); throw e; });
    }
    function allowFolder() {
      return folder().then(function (f) { return f ? f.dir.requestPermission({ mode: 'readwrite' }) : 'denied'; })
        .then(function (p) {
          if (p === 'granted') { folderOk = true; localBox(); return allToFolder().then(syncFolder); }
          lost('the browser did not allow it');   // refused for good (or its record lost): Choose a folder again
        })
        .catch(lost);
    }
    // the folder as the list (My maps): the GraphML and CellDesigner files a reader put there are added, one changed
    // since by another program (yEd, CellDesigner) is read again; the files written here for the site's maps are left
    // out, a map taken off the list stays off
    function syncFolder() {
      if (!canFolder || !V.folderName()) return Promise.resolve();
      var news = false;
      var all = function (dir) {
        var it = dir.values(), out = [];
        return (function next() { return it.next().then(function (x) { if (x.done) return out; out.push(x.value); return next(); }); })();
      };
      return mineIn.then(folder).then(function (f) {   // the reader's maps read first, else one would be added twice
        if (!f) return;
        return f.dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
          if (p !== 'granted') return;
          var ours = {}, siteFiles = {};
          Object.keys(f.files).forEach(function (id) { ours[f.files[id].name] = id; });
          V.maps.forEach(function (m) { if (!m.mine) siteFiles[(graphmlOf(m.site || m) || '').split('?')[0].split('/').pop()] = 1; });   // the site's maps' files (a draft kept here)
          return all(f.dir).then(function (hs) {
            return hs.filter(function (h) { return h.kind === 'file' && /\.(graphml|xml)$/i.test(h.name); }).reduce(function (q, h) {
              return q.then(function () {
                var id = ours[h.name];
                if (id ? !mine[id] : siteFiles[h.name.replace(/-\d+(\.[^.]+)$/, '$1')]) return;   // a site's map kept here
                var r = id ? mine[id] : null, w = r && f.files[r.id];
                if (r && r.hidden) return;
                return h.getFile().then(function (fl) {
                  if (r && w && fl.lastModified === w.mod && fl.size === w.size) return;
                  return fl.text().then(function (t) {
                    // a file not written here: a map of its own only when no map of the reader's is this file (name and
                    // content, user 2026-11-14), so their original beside the copy written here, or a map taken off the
                    // list, is left as it is
                    if (!id && mineMatch(h.name, t)) return;
                    return drawText(t).then(function (d) { return mineAdd(h.name, t, d, id || null); }).then(function (n) {
                      news = true;
                      return folderFile(n.id, { name: h.name, mod: fl.lastModified, size: fl.size });
                    });
                  });
                }).catch(function () {});   // not a map this viewer can draw: left out
              });
            }, Promise.resolve());
          });
        });
      }).then(function () { if (news) V.refreshMine(); }, function () {});
    }
    // a reader's own map drawn for the list (My maps): as the build draws, with the role classes
    function drawText(t) {
      var c = isCd(t);
      if (!c && !/<graphml[\s>]/.test(t.slice(0, 3000))) return Promise.reject(new Error('not a GraphML or CellDesigner file'));
      return (c ? cdpy() : yr()).then(function () {
        var svg = c ? window.cdrender.render(t, { classes: true }) : window.yrender.render(t, { classes: true }).svg;
        var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        if (!w) throw new Error('not a map this viewer can draw');
        return { svg: svg, width: parseFloat(w[1]), height: parseFloat(w[2]) };
      });
    }
    box.querySelector('#m2-ed-l-folder').addEventListener('click', function () { chooseFolder().catch(function () {}); });
    box.querySelector('#m2-ed-l-allow').addEventListener('click', allowFolder);
    // what the Edit window says while a map of the site is edited with no token, once a move is made (texts approved by
    // the user, 2026-11-13): no folder, text 1 the first time in this browser and Choose a folder (Chrome, Edge) or
    // Download the map with text 2 (other browsers); the folder allowed, text 3; the folder to allow again, text 4 and Allow
    function localBox() {
      var b = box.querySelector('#m2-ed-local'), show = !!(on && site && site.pending && (undo.length || site.fromDraft));
      b.hidden = !show;
      if (!show) return;
      if (!b.dataset.seen) {
        var told = null; try { told = localStorage.getItem('atlas-edit-told'); localStorage.setItem('atlas-edit-told', '1'); } catch (e) {}
        b.dataset.seen = told ? 'before' : 'now';
      }
      var first = b.dataset.seen === 'now', fn = canFolder ? V.folderName() : '', q = function (k) { return b.querySelector(k); };
      q('#m2-ed-l1').hidden = !first || !!fn;
      q('#m2-ed-l2').hidden = !first || canFolder;
      q('#m2-ed-local-dl').hidden = canFolder;
      q('#m2-ed-l-folder').hidden = !canFolder || !!fn;
      q('#m2-ed-l3').hidden = !fn || folderOk !== true;
      q('#m2-ed-l4').hidden = q('#m2-ed-l-allow').hidden = !fn || folderOk !== false;
      q('#m2-ed-l3 span').textContent = q('#m2-ed-l4 span').textContent = fn;
    }
    function download() {   // the map's file as it is now, where the browser puts downloads
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([src()], { type: 'application/xml' })); a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
    box.querySelector('#m2-ed-local-dl').addEventListener('click', function () { if (text) download(); });
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
        s.src = V.renderers + 'layout/layout.js' + V.build; s.onload = function () { res(window.layout); }; s.onerror = function () { rej('layout tools not found'); };
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
        n.hub = !cd && /sbgn\.(Process|Operator)$/.test(r ? r.getAttribute('configuration') || '' : '');   // a process or logic gate: one object with its two ports
        n.eq = n.hub && n.shape.kind === 'Operator' && Array.prototype.some.call(r.getElementsByTagNameNS(Y, 'NodeLabel'), function (l) { return l.textContent.trim() === '\u2261'; });   // an equivalence gate (yrender's eq)
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
        var ar = e.getElementsByTagNameNS(Y, 'Arrows')[0];
        return { id: e.getAttribute('id'), s: byId[e.getAttribute('source')], t: byId[e.getAttribute('target')], path: e.getElementsByTagNameNS(Y, 'Path')[0] || null,
                 arr: ar ? [ar.getAttribute('source') || 'none', ar.getAttribute('target') || 'none'] : ['none', 'none'],
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
    // undo and redo keep only what changed (review 2026-11-13: a whole copy of the text per step, up to 200, could reach
    // about 320 MB on the 1.6 MB mast cell GraphML). Each stack's top entry is whole, each entry below a change that
    // rebuilds it from the entry above, so nothing depends on the text now (a CellDesigner redraw, a late fit or a merged
    // nudge may change it between steps; review 2026-11-13). A change: the part between the common start and end, and
    // inside it only the lines that differ when the line count is the same (a move changes numbers in place)
    function delta(from, to) {   // what rebuilds to from from
      var a = 0, n = Math.min(from.length, to.length);
      while (a < n && from.charCodeAt(a) === to.charCodeAt(a)) a++;
      var b = 0;
      while (b < n - a && from.charCodeAt(from.length - 1 - b) === to.charCodeAt(to.length - 1 - b)) b++;
      var fl = from.slice(a, from.length - b).split('\n'), tl = to.slice(a, to.length - b).split('\n'), d = { a: a, b: b, len: to.length };
      if (fl.length === tl.length) {
        var at = [], lines = [];
        for (var i = 0; i < tl.length; i++) if (fl[i] !== tl[i]) { at.push(i); lines.push(tl[i]); }
        d.at = at; d.lines = JSON.parse(JSON.stringify(lines));   // copies of their own: a slice would keep the whole text alive
      } else d.mid = JSON.parse(JSON.stringify(to.slice(a, to.length - b)));
      return d;
    }
    function rebuild(d, from) {
      if (typeof d === 'string') return d;   // a top entry, whole
      var mid;
      if (d.at) { mid = from.slice(d.a, from.length - d.b).split('\n'); d.at.forEach(function (i, j) { mid[i] = d.lines[j]; }); mid = mid.join('\n'); }
      else mid = d.mid;
      var t = from.slice(0, d.a) + mid + from.slice(from.length - d.b);
      if (t.length !== d.len) throw 'undo history broken';
      return t;
    }
    function sizeOf(d) { return typeof d === 'string' ? d.length : d.at ? d.lines.reduce(function (k, l) { return k + l.length + 8; }, 0) : d.mid.length; }
    function step(stack, t) {   // t whole on top; the old top a change from it
      var top = stack.length - 1;
      if (top >= 0) stack[top] = delta(t, stack[top]);
      stack.push(t);
      for (var k = 0, i = stack.length - 1; i >= 0; i--) { k += sizeOf(stack[i]); if (k > 40e6 || stack.length - i > 200) { stack.splice(0, i + 1); break; } }   // 200 steps or 40 million characters
    }
    function take(stack) {   // the top, whole; the one below made whole in its place
      var t = stack.pop(), top = stack.length - 1;
      if (top >= 0) stack[top] = rebuild(stack[top], t);
      return t;
    }
    function unpush() { return take(undo); }   // the text before the step just taken, which is taken back
    function remember(merge) {   // the text before a change, for undo; nudges in a row are one step
      var now = Date.now();
      if (!(merge && now - nudgeAt < 800)) { step(undo, text); redo = []; }
      nudgeAt = merge ? now : 0;
    }
    function back(from, to) {
      if (!from.length) return;
      var t;
      try { t = take(from); } catch (e) { from.length = 0; warn('Undo history lost: ' + e + '.'); return; }
      step(to, text); text = t; nudgeAt = 0; parse(); selN = []; selP = []; selE = []; part = null; dirty = true; render(); paint(); changed();
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
        var svg = r[0]; lastSvg = svg; lastFor = [text, cd ? cd.now : null, site && site.id];
        if (!on && site && V.kept && V.kept.id === site.id && V.kept.text != null) { V.kept.text = src(); V.kept.svg = svg; }   // left before this redraw ended: the kept file and drawing as drawn
        var m = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/);
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
    // an opening under way (the files read, a CellDesigner file converted) is dropped when the Edit window is left or
    // another map is opened before it is done (review 2026-11-13: leaving at once left edit mode on, autosave armed)
    var opening = 0;
    function start(t, n, h, s, same, g0) {   // a CellDesigner file is first made into the GraphML the editor edits; g0: an SBGN-ML map's GraphML as the build made it
      if (localTimer) local(true);   // the last move of the map before kept first, before cd and text change (the review, 2026-11-13)
      var tk = opening;
      if (isSb(t)) {   // an SBGN-ML map: the GraphML of its text, made from the build's (g0, read with the map)
        cd = null; quiet();
        return sbpy().then(function () {
          if (tk !== opening) return;
          if (!g0) throw 'its GraphML did not load';
          var g = sbGraphml(t, g0);
          sbJs.write(t, g);   // a file whose moves could not be written back is said now, not at the first save
          sb = { base: t, g0: g0 }; begin(g, t, n, h, s, same);
        })
          .catch(function (e) { if (tk === opening) warn('Cannot edit ' + n + ': ' + e); });
      }
      sb = null;
      if (!isCd(t)) { cd = null; return begin(t, t, n, h, s, same); }
      quiet();
      return cdpy().then(function () { if (tk !== opening) return; cd = { base: t, now: t }; begin(cdGraphml(t), t, n, h, s, same); })
        .catch(function (e) { if (tk === opening) warn('Cannot edit ' + n + ': ' + e); });
    }
    function begin(g, t, n, h, s, same) {   // same: { width, height, x0, y0, scale } of the picture on screen, drawn from this very file
      try { text = g; parse(); } catch (e) { warn('Cannot edit ' + n + ': ' + e); return; }
      siteRef = null; name = n; handle = h; site = s || null;
      if (site) { site.base = site.pending && site.pub != null ? site.pub : t; site.fromDraft = t !== site.base; }   // no token: the site's text, a draft on top of it
      if (site && site.pending && canFolder && V.folderName()) folderCheck();
      stuck = false; dirty = false; undo = []; redo = []; selN = []; selP = []; selE = [];
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
      if (site && site.id && undo.length)   // not atSite(): a CellDesigner map's text follows a move only once drawn
        V.kept = { id: site.id, v: site.v, sha: site.sha, pic: V.img, width: map.width, height: map.height, x0: picX0(), y0: picY0(), text: src(), svg: nowSvg(), file: name, ref: siteRef, cur: nowRef(), draft: !!site.pending && !site.mine, mine: !!site.mine };
      if (helpBox) help(false);
      on = false; drag = null; band = null; V.grid.classList.remove('m2-editing'); paint(); buttons();
      if (site && site.mine && !localTimer) V.refreshMine();   // its last version saved already: the list takes it (else local() does)
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
      var p = { key: old.key, id: old.id, path: old.path, file: old.file, img: old.img, sitePub: old.sitePub, siteFrame: old.siteFrame, base: old.base, kept: s };
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
      var isCd = !!cd, isSbm = !!sb, make = function () {
        var dm = isCd ? { cd: true, base: S, text: g, q: [svg, S, g] } : { cd: false, text: g, r: [svg, []] };
        if (isCd) cdRemember(S, g);
        else if (isSbm) sbRemember(S, g);   // an SBGN-ML map reopened on the very GraphML it was left with
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
      ghForm(!!(on && site && !site.mine && !token()));
      localBox();
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
    function graphmlOf(m) {   // a map drawn from its own file, GraphML, CellDesigner (2026-11-12) or SBGN-ML with an editBase (2026-11-14): that file is first in its downloads
      var d = m && m.downloads && m.downloads[0];
      return d && (d.label === 'GraphML' || d.label === 'CellDesigner' || (d.label === 'SBGN-ML' && sbMap(m))) ? d.url : null;
    }

    function save() {
      if (!text) return;
      if (site) { if (site.pending) { if (localTimer) local(); } else if (token()) push(); return; }   // kept in this browser (and the folder), never GitHub
      var blob = new Blob([src()], { type: 'application/xml' });
      var done = function () { dirty = false; quiet(); };
      var into = function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(done); };
      if (handle) return into(handle).catch(function (e) { warn('Not saved: ' + e.message); });
      if (window.showSaveFilePicker) {
        return window.showSaveFilePicker({ suggestedName: name, types: [cd ? { description: 'CellDesigner', accept: { 'application/xml': ['.xml'] } } : sb ? { description: 'SBGN-ML', accept: { 'application/xml': ['.sbgn', '.nwt'] } } : { description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }] })
          .then(function (h) { handle = h; name = h.name; return into(h); })
          .catch(function (e) { if (e.name !== 'AbortError') warn('Not saved: ' + e.message); });
      }
      download(); done();   // other browsers: a download
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
      if (sbMap(m)) { path = m.editPath; file = path.split('/').pop(); }   // an SBGN-ML map: its edited copy (maps/sbgn-ml/...), under the file's own name
      var p = { key: key, id: m.id, path: path, file: file, img: m.image + V.ver(m) };
      if (sbMap(m)) { p.base = sbBase(m, low); p.base.catch(function () { p.bad = p.bad || Date.now(); }); }
      p.sitePub = fetch(url, { cache: 'no-cache', priority: low ? 'low' : 'auto' }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
      // the repository's version (newer than the site while a build runs) and its sha, which makes GitHub refuse a save
      // over a version changed meanwhile; null: not a map of this repository (saved as a file)
      p.gh = m.mine ? Promise.resolve(null) : ghFor(path, p.sitePub);
      // a file or GitHub that failed: the sweep leaves the map for 5 minutes (a refused token, a rate limit, no
      // connection: else every map switch asked again for every map); opening the map asks afresh
      var drop = function () { p.bad = p.bad || Date.now(); };
      p.sitePub.catch(drop); p.gh.catch(drop);
      bank[m.id] = p;
      return p;
    }
    function readyOf(p, m) {   // made again when an earlier try stopped (editing began, a newer entry)
      if (p.ready) return p.ready;
      var cdm = cdMap(m), sbm = sbMap(m), still = function () { return bank[m.id] === p && !on; };
      var r = p.ready = (cdm ? cdpy() : sbm ? sbpy() : yr()).then(function () {
        // the edited text this page holds for the map, read without V.keep (it would load a stored drawing and replace
        // the viewer's kept one: the review, 2026-11-13)
        var k = V.kept && V.kept.id === m.id && (V.kept.draft || V.behind(m, V.kept)) ? V.kept : null;
        return Promise.all([k && k.text ? k.text : p.sitePub, p.gh]);
      }).then(function (x) {
        p.t = x[1] ? x[1].text : x[0];
        if (sbm) return p.base.then(function (b) { p.b = b; return waitFor(m); }).then(function () {   // an SBGN-ML map: the GraphML of its text, a step of its own
          if (!still()) throw 0;
          p.g = sbGraphml(p.t, p.b);
          return p;
        });
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
        g = p.g || p.t;   // a CellDesigner or SBGN-ML map: the GraphML made of it
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
      if (!V.draftsDone()) { V.draftsIn.then(function () { setTimeout(shown, 0); }); return; }   // a draft of this map read first (the review, 2026-11-13)
      if (dirty && !site && !confirm(name + ' has moves not saved. Edit this map instead?')) return;
      if (saveTimer) push();
      var tk = ++opening;
      var p = ahead(m), file = m.mine ? m.file : p.file, path = p.path;
      editPre = p;   // kept on leaving (keepAhead)
      // the picture on screen is the site's drawing of its published file: its frame (size and the offset of yEd's
      // coordinates) is read from that SVG, so editing starts on it without a redraw; the moved map is drawn again
      var k = V.keep(m), shownPic = V.img;
      var published = k && k.text ? Promise.resolve(k.text) : p.sitePub;
      var frame = k ? Promise.resolve({ width: k.width, height: k.height, x0: k.x0, y0: k.y0, scale: 1 }) : frameOf(p);
      var go = function (t, s) {
        return Promise.all([published, frame, p.sitePub, frameOf(p)]).then(function (r) {
          if (tk !== opening) return;   // left, or another map opened, meanwhile
          // what was read ahead for this map handed to the editor, used once (made again by the sweep if wanted)
          drawMemo = p.memo || null; preDoc = p.docs || [];
          if (p.g && p.t === t && !p.b) cdRemember(t, p.g);
          dropDrawing(p);
          var same = r[1] && V.img === shownPic && V.current === m ? Object.assign({}, r[1], { text: r[0] }) : null;
          if (s) { s.id = m.id; s.v = V.ver(m); if (s.pending) s.pub = r[2]; }   // the site's own text: a draft back to it is let go
          openTitle = m.title;   // the map's own title in the first line said, not its file's name
          return Promise.resolve(p.base || null).then(function (b) { if (tk === opening) return start(t, file, null, s, same, b); }).then(function () {
            openTitle = null;
            if (tk !== opening) return;
            siteRef = r[3] ? baseOf(isCd(r[2]) && cdJs ? cdGraphml(r[2]) : sb && isSb(r[2]) ? sbGraphml(r[2], sb.g0) : r[2], r[3]) : null;
            map.title = m.title; document.getElementById('m2-title').textContent = m.title;
          });
        });
      };
      // the map's own file not loaded (the site's copy missing, no connection): said, not left at Opening
      var notLoaded = function (e) { if (tk === opening) warn('Cannot edit ' + m.title + ': its file did not load (' + e + ').'); };
      var fromSite = function (s) { return published.then(function (t) { return go(t, s); }).catch(notLoaded); };
      quiet();
      if (m.mine && mine[m.id] && mine[m.id].site) { warn('Cannot edit ' + m.title + ' yet: the site is building it (a few minutes).'); return; }   // its moves would be lost when the site's map takes its place
      if (m.mine) return fromSite({ path: null, sha: null, pending: true, mine: true });   // a reader's own map: kept in this browser and its folder
      if (!repo()) return fromSite(null);
      if (!token()) return fromSite({ path: path, sha: null, pending: true });
      p.gh.then(function (g) {
        if (!g && sbMap(m)) return published.then(function (t) { return go(t, { path: path, sha: null }); }).catch(notLoaded);   // an SBGN-ML map with no edited copy yet: the first save makes it
        if (!g) return fromSite(null);   // not a map of this repository: saved as a file
        return go(g.text, { path: path, sha: g.sha }).then(function () { if (tk === opening) recheck(p, g, m); }, notLoaded);
      }, function (e) { if (tk !== opening) return; warn('Could not read the map from GitHub (' + e + '); the token may be refused.'); ghForm(true); });
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
        var moved = dirty || !!(site && site.pending && src() !== site.pub);   // moves kept in the browser count too
        if (on && site) {   // connected while editing: go on from the repository's version, keeping the moves made
          var keep = text;
          var s0 = site;   // (s0.base: the text editing started from)
          Promise.all([api('/contents/' + s0.path + '?ref=main').then(function (r) { return r.status === 404 && sb ? {} : r.json(); }),   // an SBGN-ML map's edited copy not made yet: the first save makes it
            api('/contents/' + s0.path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (r) { return r.status === 404 && sb ? s0.base : r.text(); })])
            .then(function (f) {
              s0.sha = f[0].sha || null; s0.pending = false; buttons();
              if (f[1] !== s0.base) { stuck = true; warn('Connected, but the map in the repository is newer than the copy opened: moves not saved, nothing overwritten. Stop editing and open the map again.'); return; }
              if (s0.id) unkeep(s0.id);   // GitHub holds the map from now on
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
      if (site && !site.pending) { site.pending = true; site.pub = site.saved || site.base; site.fromDraft = false; }   // further moves kept in this browser (the review: else lost silently)
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
      if (!on) {   // an opening under way is dropped; a reopen under way (recheck) also gives the site's map back
        opening++;
        if (V.grid.classList.contains('m2-editing')) { V.grid.classList.remove('m2-editing'); buttons(); if (V.chosen) V.put(V.chosen, true); }
        return;
      }
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
      var mine = pp && pp.to && pp.k === k, S = B(mine && !pp.end && pp.n2 != null ? pp.n2 : e.s), T = B(mine && pp.end && pp.n2 != null ? pp.n2 : e.t), pa = e.path, o = function (a) {
        if (mine && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
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
        var nA = t <= 15, nB = S.L - t <= 15;
        if (nA && nB) { nA = t <= S.L - t; nB = !nA; }   // a short segment: the nearer end (a line's end 1.5 units from a new bend went with the bend)
        var t1 = nA || S.L <= 0 ? t : nB ? S.L1 - (S.L - t) : t * S.L1 / S.L;
        return [S.a1[0] + t1 * S.u1[0] - w * S.u1[1], S.a1[1] + t1 * S.u1[1] + w * S.u1[0]];
      };
    }
    // what is drawn at an end of an arc (an arrowhead, a circle, a bar) carried whole with that end and turned as its end
    // segment turned, so its shape never changes (user, 2026-11-13: an arrowhead stretched to a long thin triangle when
    // its segment had been short, follow taking its base corners as near the segment's start); null for anything else.
    // c: the shape's centre; P: its points, for an open shape (only a bar across the end segment counts)
    function endShape(o, n, c, P) {
      var L = o.length - 1, best = null, bd = 25;
      [[o[L], o[L - 1], n[L], n[L - 1]], [o[0], o[1], n[0], n[1]]].forEach(function (E) {
        var d = Math.hypot(c[0] - E[0][0], c[1] - E[0][1]);
        if (d < bd) { bd = d; best = E; }
      });
      if (!best) return null;
      var A = best[0], B = best[1], A1 = best[2], B1 = best[3], l = Math.hypot(A[0] - B[0], A[1] - B[1]), l1 = Math.hypot(A1[0] - B1[0], A1[1] - B1[1]);
      var u = l ? [(A[0] - B[0]) / l, (A[1] - B[1]) / l] : [1, 0], u1 = l1 ? [(A1[0] - B1[0]) / l1, (A1[1] - B1[1]) / l1] : u;
      if (P) {
        if (P.length !== 2) return null;
        var dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1], dl = Math.hypot(dx, dy);
        if (!dl || Math.abs(dx * u[0] + dy * u[1]) / dl > 0.2) return null;
      }
      return function (p) {
        var x = p[0] - A[0], y = p[1] - A[1], t = x * u[0] + y * u[1], w = -x * u[1] + y * u[0];
        return [A1[0] + t * u1[0] - w * u1[1], A1[1] + t * u1[1] + w * u1[0]];
      };
    }
    // a bend point the renderer's drawing does not have yet (made by grabbing the line in this drag, user 2026-11-14: the
    // line stayed straight until the release) put into the drawn line where it lies, so follow takes it to its new place.
    // str: a path's d (M, L, Q, C) or a polyline's points; R: the arc's bend points at rest
    function withBends(str, R) {
      var tk = str.match(/[MLQCZ]|-?[\d.]+(?:e-?\d+)?/gi) || [], poly = !/[A-Z]/i.test(str);
      if (poly) { var q = ['M']; tk.forEach(function (x, i) { if (i > 0 && i % 2 === 0) q.push('L'); q.push(x); }); tk = q; }
      var segs = [], seen = [], cur = null, N = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
      for (var i = 0; i < tk.length;) {
        var c = tk[i], m = N[c];
        if (m == null) return str;   // relative or implicit commands: left as drawn
        var a = tk.slice(i + 1, i + 1 + m).map(Number);
        for (var j = 0; j + 1 < a.length; j += 2) seen.push([a[j], a[j + 1]]);
        if (c === 'L' && cur) segs.push({ at: i, a: cur });
        if (m) cur = [a[m - 2], a[m - 1]];
        i += 1 + m;
      }
      var add = [];
      R.forEach(function (r) {
        if (seen.some(function (s) { return Math.hypot(s[0] - r[0], s[1] - r[1]) < 0.5; })) return;
        segs.some(function (s) {
          var b = [+tk[s.at + 1], +tk[s.at + 2]], dx = b[0] - s.a[0], dy = b[1] - s.a[1], L = dx * dx + dy * dy;
          if (!L) return false;
          var t = ((r[0] - s.a[0]) * dx + (r[1] - s.a[1]) * dy) / L;
          if (t <= 0 || t >= 1 || Math.hypot(s.a[0] + dx * t - r[0], s.a[1] + dy * t - r[1]) > 1.5) return false;
          add.push([s.at, t, r]); return true;
        });
      });
      if (!add.length) return str;
      add.sort(function (x, y) { return y[0] - x[0] || y[1] - x[1]; });   // from the end, so the places before stay
      add.forEach(function (x) { tk.splice(x[0], 0, 'L', String(x[2][0]), String(x[2][1])); });
      if (poly) return tk.filter(function (x) { return !/^[ML]$/.test(x); }).reduce(function (s, x, i) { return s + (i % 2 ? ',' : i ? ' ' : '') + x; }, '');
      return tk.join(' ');
    }
    function fullLines(ks, pp) {   // ks: the arcs to draw (indices in edges2), pp: a port being dragged
      dropCopies();
      ks.forEach(function (k) {
        var e = edges2[k], gs = gE && gE[e.id];
        if (!gs) return;
        var o = line(k, restBox, restPt), n = line(k, null, null, pp);
        if (!o || !n) return;
        var F0 = follow(o, n), pair = function (str, closed) {   // every x y of an attribute taken along, an end's shape whole
          if (!closed) str = withBends(str, o.slice(1, -1));
          var v = str.match(/-?[\d.]+(?:e-?\d+)?/g) || [], k2 = 0, P = [];
          for (var i = 0; i + 1 < v.length; i += 2) P.push([+v[i], +v[i + 1]]);
          var c = P.reduce(function (s, q) { return [s[0] + q[0] / P.length, s[1] + q[1] / P.length]; }, [0, 0]);
          var F = (P.length && endShape(o, n, c, closed ? null : P)) || F0;
          return str.replace(/-?[\d.]+(?:e-?\d+)?/g, function (m) {
            var j = k2++; if (j % 2) return f1(F([+v[j - 1], +v[j]])[1]); return f1(F([+v[j], +v[j + 1]])[0]);
          });
        }, F = F0;
        gs.forEach(function (g) {
          g.style.display = 'none';
          var c = g.cloneNode(true);
          c.removeAttribute('data-e'); c.style.display = ''; c.classList.add('m2-ed-copy');
          g.parentNode.insertBefore(c, g.nextSibling); copies.push([c, g, k]);
          c.querySelectorAll('*').forEach(function (el) {
            var nm = el.localName;
            if ((nm === 'polyline' || nm === 'polygon') && !el.getAttribute('transform')) el.setAttribute('points', pair(el.getAttribute('points') || '', nm === 'polygon'));
            else if (nm === 'path' && !el.getAttribute('transform') && /^[MLQCZ\s\d.,e-]*$/.test(el.getAttribute('d') || '')) el.setAttribute('d', pair(el.getAttribute('d'), /Z\s*$/i.test(el.getAttribute('d'))));
            else if (nm === 'line') { var q1 = F([+el.getAttribute('x1'), +el.getAttribute('y1')]), q2 = F([+el.getAttribute('x2'), +el.getAttribute('y2')]);
              el.setAttribute('x1', f1(q1[0])); el.setAttribute('y1', f1(q1[1])); el.setAttribute('x2', f1(q2[0])); el.setAttribute('y2', f1(q2[1])); }
            else if (nm !== 'g' && nm !== 'title' && nm !== 'tspan') {   // anything else (a circle, a rect, a text) moved by its centre
              var b; try { b = el.getBBox(); } catch (x) { return; }
              var m = [b.x + b.width / 2, b.y + b.height / 2], q = (nm !== 'text' && endShape(o, n, m) || F)(m);
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
    // from the node's centre (yEd's sx, sy or tx, ty); on a CellDesigner map cd_edit makes it CellDesigner's port
    // (none for the centre, N, S, W, E). A process glyph's main lines are not moved this way; a modifier's end there goes round it (procSpots)
    function portAt(P) {
      var R = 6 / V.z, L = lit(), best = null, dB = R;
      L.e.forEach(function (k) {
        var e = edges2[k];
        if (e.s == null || e.t == null || !e.path) return;
        var all = ports(k);
        [[0, e.s], [all.length - 1, e.t]].forEach(function (q, end) {
          if (cd && /\|proc$/.test(nodes2[q[1]].id) && !procSpots({ k: k, end: end, n: q[1] })) return;   // a glyph's main lines stay
          var d = Math.hypot(all[q[0]][0] - P[0], all[q[0]][1] - P[1]), hb = !!hubEnd(k, end), b = hb && bx(q[1]);   // an end at a process's or gate's port goes with the process, or to another node
          if (hb && P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3]) return;   // a press on the process itself moves the process
          if (d <= dB) { dB = d; best = { k: k, end: end, n: q[1], to: null, hub: hb }; }
        });
      });
      return best;
    }
    // a modifier's end at a CellDesigner process glyph (user, 2026-11-13): CellDesigner's six places, its corners and the
    // middles of the two sides off the main line, turned with the line (no centre, nothing on the line itself; cd_edit
    // writes targetLineIndex from the place's number, spot on the path: 2 to 7 in this order, cdrender's SQUARE); null
    // for any other end
    function procSpots(pp) {
      var m = cd && pp.end && nodes2[pp.n].id.match(/^(.*)\|proc$/);
      if (!m || !/\|m\d+$/.test(edges2[pp.k].id)) return null;
      var ka = edges2.findIndex(function (e) { return e.id === m[1] + '|a'; });
      if (ka < 0) return null;
      var p = ports(ka), A = p[p.length - 2], C = p[p.length - 1], L = Math.hypot(C[0] - A[0], C[1] - A[1]), h = bx(pp.n)[2] / 2;
      if (!L) return null;
      var f = [(C[0] - A[0]) / L, (C[1] - A[1]) / L];
      return [[0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (s) { return [h * (s[0] * f[0] - s[1] * f[1]), h * (s[0] * f[1] + s[1] * f[0])]; });
    }
    // a process or logic gate as one object with its two ports (user, 2026-11-14: "as in yEd", as if yEd's SBGN palette
    // had a process with antennas, turned to any of four directions): its consumptions (a gate's inputs) end on port one,
    // its products leave from port two, both drawn by the yEd renderer at the ends of its antennas; a modifier ends on one
    // of the two sides off the antennas. The ports move with the process; Turn process (the right-click menu over it)
    // turns it a quarter clockwise, every end at it with it. GraphML and SBGN-ML maps alike (CellDesigner has its own glyph)
    function hubEnd(k, end) {   // 'in', 'out' or null: how arc k meets a process or gate at that end (yrender's ends)
      var e = edges2[k], n = end ? e.t : e.s;
      if (n == null || !nodes2[n].hub) return null;
      if (end) return e.arr[1] === 'none' ? 'in' : null;
      return !(e.t != null && nodes2[e.t].hub) && e.arr[0] === 'none' && e.arr[1] === 'none' && !nodes2[n].eq ? 'in' : 'out';
    }
    var hpMemo = null;
    function hubPorts() {   // the ports as the renderer draws them, per node id: [port one, port two, anything coming in]
      if (!hpMemo || hpMemo[0] !== text) hpMemo = [text, window.yrender.render(docText === text ? doc : text, {}).ports];   // the editor's own drawing sets it (drawGraphml): this only before it
      return hpMemo[1];
    }
    function hubSides(pp) {   // a modifier's places at a process or gate: the middles of the two sides off its antennas
      var n = nodes2[pp.n];
      if (!n.hub || hubEnd(pp.k, pp.end) || !window.yrender) return null;
      var P = hubPorts()[n.id], b = bx(pp.n);
      if (!P) return null;
      return Math.abs(P[1][0] - P[0][0]) >= Math.abs(P[1][1] - P[0][1]) ? [[0, -b[3] / 2], [0, b[3] / 2]] : [[-b[2] / 2, 0], [b[2] / 2, 0]];
    }
    function turn(i) {   // a quarter clockwise: every end at the process turned round its centre, an end at a port first put there
      var P = hubPorts()[nodes2[i].id], b = boxOf(i), c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
      if (!P) return;
      var rel = function (q) { return [q[0] - c[0], q[1] - c[1]]; }, list = [];
      edges2.forEach(function (e, k) {
        if (!e.path) return;
        [0, 1].forEach(function (end) {
          if ((end ? e.t : e.s) !== i) return;
          var a = end ? ['tx', 'ty'] : ['sx', 'sy'], o = [num(e.path, a[0]) || 0, num(e.path, a[1]) || 0], role = hubEnd(k, end);
          if (role && Math.abs(o[0]) <= b[2] / 2 + 0.5 && Math.abs(o[1]) <= b[3] / 2 + 0.5) {   // on the glyph, not a port the renderer takes as given: at the port it chose (a product of a process with nothing coming in: the nearer)
            if (role === 'in') o = rel(P[0]);
            else if (P[2]) o = rel(P[1]);
            else { var all = ports(k), nx = all[1]; o = rel(Math.hypot(P[1][0] - nx[0], P[1][1] - nx[1]) <= Math.hypot(P[0][0] - nx[0], P[0][1] - nx[1]) ? P[1] : P[0]); }
          }
          list.push({ k: k, end: end, to: [-o[1], o[0]] });
        });
      });
      if (list.length) setPorts(list);
    }
    function spot(pp, P) {   // the nearest of the node's places (five, or a glyph's six), as an offset from its centre
      var b = bx(pp.n), c = [b[0] + b[2] / 2, b[1] + b[3] / 2], S = procSpots(pp) || hubSides(pp), F = null;
      // at a glyph a tie (a drop on its centre) goes to the side facing the modifier (user, 2026-11-13): the point
      // before the end weighs in a little
      if (S) { var all = ports(pp.k); F = all[all.length - 2]; }
      var cost = function (o) { var q = [c[0] + o[0], c[1] + o[1]]; return Math.hypot(q[0] - P[0], q[1] - P[1]) + (F ? 1e-3 * Math.hypot(q[0] - F[0], q[1] - F[1]) : 0); };
      return (S || [[0, 0], [0, -b[3] / 2], [0, b[3] / 2], [-b[2] / 2, 0], [b[2] / 2, 0]]).reduce(function (m, o) { return cost(o) < cost(m) ? o : m; });
    }
    function spotNo(pp, to) {   // the number of the glyph's place at offset to (procSpots' order), null off a glyph
      var S = procSpots(pp), best = null, bd = Infinity;
      if (S) S.forEach(function (o, i) { var d = Math.hypot(o[0] - to[0], o[1] - to[1]); if (d < bd) { bd = d; best = i + 2; } });
      return best;
    }
    // an end moved to another node (user, 2026-11-14: "yes ... to any viable option to another node ... Sometimes it's
    // needed"): an end square dragged off its node goes, on release, to the node under the pointer that can take it,
    // lit while the pointer is over it, else back where it was. SBGN's rules (user, the same day): an arc goes from or
    // to a complex, never a member inside it (the complex takes the end); a logic gate takes only the one
    // arrowhead-less line, a consumption at a process and an input at a gate alike, and its modulations leave from it.
    // GraphML, SBGN-ML and CellDesigner maps (user, 2026-11-14: "let's implement for CellDesigner"): on a CellDesigner map
    // an end at a species goes to another species or complex, never the process glyph's end, and cd_edit rewrites the
    // reaction's participant in every place the file keeps it
    var EPN = /^(Macromolecule|SimpleChemical|Complex|NucleicAcidFeature|UnspecifiedEntity|EmptySet|PerturbingAgent)$/;
    var MODS = /^(white_circle|white_delta|white_delta_bar|t_shape|crows_foot_one|white_diamond)$/;
    function roleOf(i) {   // 'epn', 'proc', 'gate', 'pheno', or null (a compartment, a member inside a complex, a decoration)
      var n = nodes2[i];
      if (n.comp || (n.up != null && !nodes2[n.up].comp)) return null;
      if (n.hub) return n.shape.kind === 'Operator' ? 'gate' : 'proc';
      return EPN.test(n.shape.kind) ? 'epn' : n.shape.kind === 'Phenotype' ? 'pheno' : null;
    }
    function takes(k, end, i) {   // whether node i can take that end of arc k (its own node aside)
      // moving an end to another node changes the network: full editing only (Settings, Editing; user, 2026-11-14)
      if (V.level !== 'full') return false;
      var e = edges2[k], a = e.arr, other = end ? e.s : e.t, r = roleOf(i), ro = roleOf(other);
      var hub = function (x) { return x === 'proc' || x === 'gate'; };
      if (cd) {   // a reaction's end at a species, to another species or complex (no member, no compartment, no glyph, none the reaction has already)
        var nd = nodes2[i], here = end ? e.t : e.s, proc = function (x) { return /\|proc$/.test(nodes2[x].id); }, rid = e.id.slice(0, e.id.lastIndexOf('|') + 1);
        if (edges2.some(function (f) { return f.id.indexOf(rid) === 0 && (f.s === i || f.t === i); })) return false;
        return !proc(here) && !proc(i) && !nd.comp && !(nd.up != null && !nodes2[nd.up].comp);
      }
      if (i === other || !r || a[0] !== 'none') return false;
      if (a[1] === 'none') {   // the arrowhead-less line: its hub end at a process or gate, its other end at an entity (or a gate into a gate)
        if (!hub(roleOf(e.s)) && !hub(roleOf(e.t))) return false;   // a plain line between other glyphs (an equivalence arc): not this line
        var h = hub(roleOf(e.t)) ? 1 : 0;
        return end === h ? hub(r) && !(r === 'proc' && ro === 'gate') : r === 'epn' || (r === 'gate' && ro === 'gate');
      }
      if (a[1] === 'delta') return hub(roleOf(end ? e.t : e.s)) ? r === 'proc' : r === 'epn';   // a production: from a process to an entity
      if (MODS.test(a[1])) return end ? r === 'proc' || r === 'pheno' : r === 'epn' || r === 'gate';   // a modulation: from an entity or gate to a process or phenotype
      return false;
    }
    function takerAt(pp, P) {   // the innermost node under P that can take the end, or its own node; null over nothing that can
      var R = 4 / V.z, best = null, ba = Infinity;
      nodes2.forEach(function (n, i) {
        var b = bx(i);
        if (P[0] < b[0] - R || P[0] > b[0] + b[2] + R || P[1] < b[1] - R || P[1] > b[1] + b[3] + R) return;
        if (i !== pp.n && !takes(pp.k, pp.end, i)) return;
        if (b[2] * b[3] < ba) { ba = b[2] * b[3]; best = i; }
      });
      return best;
    }
    function portOn(pp, i, P) {   // the end's place at node i from its centre: at a process or gate the port its line takes, else spot's (a modifier: one of the two sides)
      var b = bx(i), e = edges2[pp.k], H = nodes2[i].hub && window.yrender && hubPorts()[nodes2[i].id];
      if (!H || (MODS.test(e.arr[1]) && pp.end)) return spot({ k: pp.k, end: pp.end, n: i }, P);
      var q = pp.end || (e.arr[1] === 'none' && !nodes2[e.t].hub) ? H[0] : H[1];   // into port one, or out of port two
      return [q[0] - b[0] - b[2] / 2, q[1] - b[1] - b[3] / 2];
    }
    function aim(pp, P) {   // the dragged end's next place: on its own node, on a node that takes it, or free at the pointer
      var i = takerAt(pp, P), b;
      pp.n2 = null; pp.free = false;
      if (i === pp.n) { pp.to = pp.hub ? null : spot(pp, P); return; }   // an end at a port stays with its process
      if (i != null) { pp.n2 = i; pp.to = portOn(pp, i, P); return; }
      b = bx(pp.n); pp.free = true; pp.to = [P[0] - b[0] - b[2] / 2, P[1] - b[1] - b[3] / 2];
    }
    function reconnect(pp) {   // the end of arc pp.k put on node pp.n2 at offset pp.to, one undo step; the line's end square no longer pressed
      part = null; frozen = true;   // the copy stays until the map is drawn again (no flash of the old line)
      setPorts([pp], { k: pp.k, att: pp.end ? 'target' : 'source', id: nodes2[pp.n2].id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') });
    }
    function setPort(pp) { setPorts([pp]); }
    function setPorts(list, re) {   // ends of lines put at their offsets (pp: k, end, to), one undo step; re: { k, att, id }, that edge's source or target set too
      var all = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Path')), by = new Map();
      if (re && (text.match(/<edge\b[^>]*>/g) || []).length !== edges2.length) { frozen = false; warn('The line could not be moved to another node: the file is not read edge for edge.'); unshift(); paint(); return; }
      list.forEach(function (pp) {
        var e = edges2[pp.k], a = pp.end ? ['tx', 'ty'] : ['sx', 'sy'], no = spotNo(pp, pp.to), vals = [fmt(pp.to[0]), fmt(pp.to[1])];
        if (no) { a = a.concat('spot'); vals.push(String(no)); }
        if (!re && Math.abs((num(e.path, a[0]) || 0) - pp.to[0]) < 0.01 && Math.abs((num(e.path, a[1]) || 0) - pp.to[1]) < 0.01) return;
        var nth = all.indexOf(e.path);
        by.set(nth, (by.get(nth) || []).concat(a.map(function (k, j) { return [k, vals[j]]; })));
      });
      if (!by.size) { unshift(); paint(); return; }
      remember(false);
      var c = -1, ce = -1;
      if (re) text = text.replace(/<edge\b[^>]*>/g, function (tag) {
        return ++ce !== re.k ? tag : tag.replace(new RegExp('(\\s' + re.att + '\\s*=\\s*)("[^"]*"|\'[^\']*\')'), function (m, p1) { return p1 + '"' + re.id + '"'; });
      });
      text = text.replace(/<y:Path\b[^>]*>/g, function (tag) {
        var kv = by.get(++c);
        if (!kv) return tag;
        kv.forEach(function (q) {
          var re = new RegExp('(\\s' + q[0] + '=")[^"]*"');
          tag = re.test(tag) ? tag.replace(re, '$1' + q[1] + '"') : tag.replace(/(\/?>)$/, ' ' + q[0] + '="' + q[1] + '"$1');
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
      var away = pk0 && (pk0.n2 != null || pk0.free);   // an end going to another node: its line follows as a copy (a CellDesigner glyph keeps its place until the drop)
      if (pk0) { if (!away) glyphFollow(new Set(), new Set(), null, pk0); (live || []).forEach(function (k) { lk.add(k); }); lk.add(pk0.k); }
      if (gE) { if (!frozen) { if (lk.size) { if (away || !cdLines(lk, pk0)) fullLines(lk, pk0); } else dropCopies(); } }
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
        var pk = drag.port, b0 = bx(pk.n2 != null ? pk.n2 : pk.n), C = [b0[0] + b0[2] / 2 + pk.to[0], b0[1] + b0[3] / 2 + pk.to[1]];
        var ph = Math.max(2, HANDLE * V.z);
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(C[0]) - ph / 2) + '" y="' + f1(sy(C[1]) - ph / 2) + '" width="' + f1(ph) + '" height="' + f1(ph) + '"/>');
      }
      if (drag && drag.port && drag.port.n2 != null) out.push(frame + '<path class="m2-ed-dark" d="' + shapeD(drag.port.n2) + '"/></g>');   // the node that takes the end
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
      if (drag && drag.ext) drag.ext.forEach(function (g) { out.push('<path class="m2-ed-snapline"' + gw() + ' d="' + seg(g) + '"/>'); });
      if (drag && drag.marks) drag.marks.forEach(function (g) {   // an equal gap, as yEd's: a line with an open arrowhead at each end
        var X0 = sx(g[0][0]), Y0 = sy(g[0][1]), X1 = sx(g[1][0]), Y1 = sy(g[1][1]), t = Math.max(3 * V.z, 3);
        var u = X1 - X0, v = Y1 - Y0, L = Math.hypot(u, v) || 1; u *= t / L; v *= t / L;
        var head = function (X, Y, s) { return 'M' + f1(X + s * u - v) + ' ' + f1(Y + s * v + u) + 'L' + f1(X) + ' ' + f1(Y) + 'L' + f1(X + s * u + v) + ' ' + f1(Y + s * v - u); };
        out.push('<path class="m2-ed-mark"' + gw() + ' d="' + seg(g) + head(X0, Y0, 1) + head(X1, Y1, -1) + '"/>');
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
      var e = edges2[k], mine = pp && pp.to && pp.k === k, S = bx(mine && !pp.end && pp.n2 != null ? pp.n2 : e.s), T = bx(mine && pp.end && pp.n2 != null ? pp.n2 : e.t), pa = e.path, o = function (a) {
        if (mine && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
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
    // a bend point taken away (user, 2026-11-13, CellDesigner's own model: bend points are put and removed by the user,
    // CellDesigner's right click Remove Anchor Point; yEd: Delete): its y:Point out of the text, one undo step.
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
    var rclick = null;   // where the last right click was, for the menu's Remove bend point
    // the drawing of the file as it is now, when the renderer has drawn it (not before the first move: the picture is then still the one editing started on)
    function nowSvg() { return lastFor && lastFor[0] === text && lastFor[1] === (cd ? cd.now : null) ? lastSvg : null; }
    // while a redraw runs, the last drawing of this map (one move behind for a moment) in place of the site's picture
    function shownSvg() { return nowSvg() || (lastFor && site && lastFor[2] === site.id ? lastSvg : null); }
    // the map being edited as it is now, for the viewer's menu (user, 2026-11-13: "Download what is on the screen";
    // Download CellDesigner XML gave the site's file without the moves just made)
    window.m2EditNow = function () { return on && site && site.id && text ? { id: site.id, text: src(), svg: shownSvg(), file: name } : null; };
    window.m2EditTurn = function () {   // the right-click menu's Turn process over a process or logic gate
      if (!on || V.current !== map || !rclick || !window.yrender) return null;
      var h = hit(rclick);
      if (!h || h.n == null || !nodes2[h.n].hub) return null;
      var i = h.n, gate = nodes2[i].shape.kind === 'Operator';
      return { label: gate ? 'Turn logic gate' : 'Turn process', go: function () { turn(i); } };
    };
    // Make main (user, 2026-11-14: CellDesigner's main reactant or product is often an accident of the conversion): the
    // right-click menu on an added reactant's or product's line of a CellDesigner reaction (or a bend point of it) swaps
    // it with the main one, cd_edit.makeMain on the GraphML (the network stays: layout editing too); place() writes the
    // participants and CellDesigner's process square goes to the middle of the new main line. One undo step.
    window.m2EditMain = function () {
      if (!on || V.current !== map || !rclick || !cd || !window.cd_edit) return null;
      var h = hit(rclick), k = h && h.e != null && !h.glyph ? h.e : h && h.p != null ? edges2.findIndex(function (e) { return e.pts.indexOf(h.p) >= 0; }) : -1;
      if (k < 0 || !/\|[rp]\d+$/.test(edges2[k].id)) return null;
      var t2 = window.cd_edit.makeMain(text, edges2[k].id);
      if (!t2) return null;
      return { label: /\|r\d+$/.test(edges2[k].id) ? 'Make main reactant' : 'Make main product', go: function () {
        remember(false); text = t2;
        parse(); selN = []; selP = []; selE = []; keyGuides = null; dirty = true; render(); paint(); changed();
      } };
    };
    window.m2EditBend = function () {
      if (!on || V.current !== map || !rclick) return null;
      var h = hit(rclick);
      if (!h || h.p == null) return null;
      var pi = h.p;
      return function () { unbend([pi]); };
    };
    // every bend point of the map taken away at once (user, 2026-11-14: maps from another editor can be so messy that
    // removing them all and rerouting by hand is quicker than one by one): the right-click menu's Remove all bend points,
    // on empty map space while editing (user, 2026-11-14: a right click on a bend point means that bend point; inside a
    // compartment counts as empty); one undo step
    window.m2EditAllBends = function () {
      if (!on || V.current !== map || !points.length || !rclick) return null;
      var h = hit(rclick);
      if (h && !(h.n != null && nodes2[h.n].kids.length)) return null;
      return function () { unbend(points.map(function (p, i) { return i; })); };
    };
    // a bend point put where the right click was on a line (user, 2026-11-13: "not only remove anchor point, but also
    // add anchor point"; CellDesigner's right click Add Anchor Point): the same new point a drag on the line makes, left
    // in place, the line selected so its points show and the new one is dragged with the next press; one undo step.
    // Not on the process glyph (no bend point there: it sits midway on its segment)
    window.m2EditAddBend = function () {
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
    // (4) it sits midway between two nodes, or its gap to a neighbour repeats a gap between two nodes in sight, (5) it is
    // dragged nearly straight across or down (only x or only y changes).
    // Each axis on its own; 6 px on screen; the smallest correction wins, near ties (1 px) by that order; every reason
    // that holds is shown: thick grey for an arc, a thin line for centres and sides, marks for equal gaps. Ctrl or Alt held,
    // no snapping (yEd: Ctrl). Not yet: the set node to node and node to arc distances (no default in yEd's manual).
    var GAP_OUT = 12;   // equal gap marks this far beside the nodes (map units)
    var CLOSE = 40;   // opposite sides snap only within this gap (map units), and lines reach this far past the nodes
    function snapNode(d) {
      d.guides = []; d.lines = []; d.marks = []; d.ext = []; d.crosses = [];
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
      // (4) equal gaps (user, 2026-11-14, from yEd's): midway between the nearest node on each side (a process glyph too,
      // as yEd), or the gap to a node on one side the same as that node's gap to one beyond it, as a chain. A node
      // counts on a side when it is wholly on that side and can be seen from the other past the nodes nearer it (some of
      // the width they share not covered), as yEd measures across a process glyph between two metabolites; for midway the
      // node moved sees within NEAR across, as yEd takes a node just beside its row or column. Only the chain, as in every
      // case of yEd's seen: gaps from any pair in sight matched nearly every place (review, 2026-11-14: 42 to 100% of
      // places on the demo maps, the grid never reached; the chain 6 to 15%).
      var NEAR = CLOSE / 2;
      ['x', 'y'].forEach(function (ax) {
        var h = ax === 'x' ? 0 : 1, w = 1 - h;
        function seen(a, m, dir) {   // the nodes a sees on side dir (1 after, -1 before), nearest first
          var lo = a[w] - m, hi = a[w] + a[w + 2] + m, cov = [], out = [];   // cov: the nearer nodes' widths, by start
          var gap = function (o) { return dir > 0 ? o[h] - a[h] - a[h + 2] : a[h] - o[h] - o[h + 2]; };
          others.filter(function (o) { return o !== a && gap(o) >= 0; }).sort(function (p, q) { return gap(p) - gap(q); }).some(function (o) {
            var s0 = Math.max(o[w], lo), e0 = Math.min(o[w] + o[w + 2], hi);
            if (s0 >= e0) return false;
            var reach = function (x) { cov.forEach(function (c) { if (c[0] <= x && c[1] > x) x = c[1]; }); return x; };
            if (reach(s0) < e0) out.push([o, gap(o)]);   // some of [s0, e0] left open by the nearer nodes
            var k = 0; while (k < cov.length && cov[k][0] <= s0) k++;
            cov.splice(k, 0, [s0, e0]);
            return reach(lo) >= hi;   // all covered: nothing further is seen
          });
          return out;
        }
        var lo = seen(B, NEAR, -1)[0], hi = seen(B, NEAR, 1)[0], bef = seen(B, 0, -1), aft = seen(B, 0, 1);
        if (lo && hi) add(ax, B[h], (lo[0][h] + lo[0][h + 2] + hi[0][h] - B[h + 2]) / 2, 4, { mid: [lo[0], hi[0]] });
        if (!bef.length && !aft.length) return;
        [[bef, -1], [aft, 1]].forEach(function (sd) {
          sd[0].forEach(function (nq) {
            var nb = nq[0];
            seen(nb, 0, sd[1]).forEach(function (fq) {
              if (fq[1] <= 0) return;
              var p = sd[1] > 0 ? [nb, fq[0], fq[1]] : [fq[0], nb, fq[1]];
              if (sd[1] > 0) add(ax, B[h] + B[h + 2], nb[h] - fq[1], 4, { rep: p, nb: nb, side: 1 });
              else add(ax, B[h], nb[h] + nb[h + 2] + fq[1], 4, { rep: p, nb: nb, side: 0 });
            });
          });
        });
      });
      add('x', d.dx, 0, 5, null); add('y', d.dy, 0, 5, null);   // (5) dragged straight: the start's x or y kept
      ['x', 'y'].forEach(function (ax) {
        var l = cand[ax];
        if (!l.length) { d['w' + ax] = []; return; }   // no guide left over from the move before
        var m = Math.min.apply(null, l.map(function (q) { return Math.abs(q.c); })), z1 = 1 / V.z;
        var pick = l.filter(function (q) { return Math.abs(q.c) <= m + z1; }).sort(function (a, b) { return a.rank - b.rank; })[0];
        if (ax === 'x') { d.dx += pick.c; d.gx = true; } else { d.dy += pick.c; d.gy = true; }
        d['w' + ax] = l.filter(function (q) { return Math.abs(q.c - pick.c) < 0.01 && q.why; }).map(function (q) { return q.why; });
      });
      // what is shown, at the place reached
      mv.dx = d.dx; mv.dy = d.dy;
      var F = [b0[0] + d.dx, b0[1] + d.dy, b0[2], b0[3]], E = CLOSE / 2;
      var dist = function (p) { return Math.abs(p[0][0] + p[1][0] + (p[0][2] + p[1][2]) / 2 - 2 * F[0] - F[2]) + Math.abs(p[0][1] + p[1][1] + (p[0][3] + p[1][3]) / 2 - 2 * F[1] - F[3]); };
      ['x', 'y'].forEach(function (ax) {
        var h = ax === 'x' ? 0 : 1, w = 1 - h;
        var gaps = [], rep = [];
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
          if (q.mid) gaps.push([q.mid[0], F], [F, q.mid[1]]);
          if (q.rep && (!rep[q.side] || dist(q.rep) < dist(rep[q.side].rep))) rep[q.side] = q;   // one pair a side, the nearest
        });
        var has = function (a, b) { return gaps.some(function (g) { return g[0] === a && g[1] === b; }); };
        rep.forEach(function (q) {   // the node's gap and the one it repeats, each once
          [q.side ? [F, q.nb] : [q.nb, F], [q.rep[0], q.rep[1]]].forEach(function (g) { if (!has(g[0], g[1])) gaps.push(g); });
        });
        // as yEd draws them: each gap a line with an arrowhead at each end, on one line beside the nodes, on the side the
        // node moved sticks out to, with thin lines from the nodes' sides out to it
        var pt2 = function (along, acr) { return h === 0 ? [along, acr] : [acr, along]; };
        var mark = function (gs, far) {
          var boxes = [];
          gs.forEach(function (g) { g.forEach(function (o) { if (boxes.indexOf(o) < 0) boxes.push(o); }); });
          var at = far ? Math.max.apply(null, boxes.map(function (o) { return o[w] + o[w + 2]; })) + GAP_OUT
            : Math.min.apply(null, boxes.map(function (o) { return o[w]; })) - GAP_OUT, past = far ? 4 : -4;
          gs.forEach(function (g) {
            var a = g[0][h] + g[0][h + 2], b = g[1][h];
            d.marks.push([pt2(a, at), pt2(b, at)]);
            d.ext.push([pt2(a, at + past), pt2(a, far ? g[0][w] + g[0][w + 2] : g[0][w])], [pt2(b, at + past), pt2(b, far ? g[1][w] + g[1][w + 2] : g[1][w])]);
          });
        };
        var mid = function (o) { return o[w] + o[w + 2] / 2; }, mean = 0, k = 0;
        gaps.forEach(function (g) { g.forEach(function (o) { if (o !== F) { mean += mid(o); k++; } }); });
        if (gaps.length) mark(gaps, k > 0 && mid(F) > mean / k + 0.5);
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
        else if (drag.port) { if (drag.port.moved || Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) >= 4) { drag.port.moved = true; aim(drag.port, P); } }
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
          drag.guides = []; drag.lines = []; drag.marks = []; drag.ext = []; drag.crosses = [];
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
      if (d.port) {   // dragged: the port set; a click: the node there selected, as without a line lit (not a glyph)
        if (d.port.n2 != null) reconnect(d.port);
        else if (d.port.free || (d.port.moved && !d.port.to) || (d.port.hub && !d.port.to)) { unshift(); paint(); }   // over nothing that takes it, or on its own process: back where it was (a click there keeps the line)
        else if (d.port.to) setPort(d.port);
        else if (procSpots(d.port)) paint();   // at a glyph, no item of its own: the line stays selected, its end pressed for the keys
        else { selN = [d.port.n]; selP = []; selE = []; paint(); }
        return;
      }
      if (d.rs) {   // a compartment resized: its box set, never smaller than what it holds, the ones round it grown
        var nb = liveC && liveC[d.rs.c];
        if (!nb || nb.every(function (v, j) { return Math.abs(v - d.rs.b0[j]) < 0.01; })) { liveOff(); paint(); return; }
        var mine = text; remember(false);
        fitThen({ resize: [nodes2[d.rs.c].id].concat(nb), moved: [] }, function (k) {
          if (!k) { if (undo[undo.length - 1] === mine) unpush(); liveOff(); paint(); return; }   // only this resize's step
          render(); paint(); changed();
        });
        return;
      }
      var fitAfter = function () {   // the compartments round what moved grow to hold it, in the same undo step
        fitThen({ moved: movedIds(sets) }, function () { render(); changed(); });
      };
      if (d.made != null && Math.abs(d.dx) < 0.01 && Math.abs(d.dy) < 0.01) {   // a new bend dragged back to where it was made (a snap may leave a hair): none made
        text = unpush(); parse(); selP = []; selE = [d.made - 1]; unshift(); paint(); return;
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
      if (pp.hub) return;   // at a process's or gate's port: it goes with the process
      var e = edges2[pp.k], a = pp.end ? ['tx', 'ty'] : ['sx', 'sy'], b = bx(pp.n);
      var c = [b[0] + b[2] / 2, b[1] + b[3] / 2], o = spot(pp, [c[0] + num(e.path, a[0]), c[1] + num(e.path, a[1])]);
      var u = [Math.sign(d[0]), Math.sign(d[1])], s = [Math.sign(o[0]), Math.sign(o[1])], S = procSpots(pp) || hubSides(pp);
      if (S) {   // round a glyph: the next of its six places the arrow points to
        var best = null, bs = 0.3;
        S.forEach(function (q) {
          var v = [q[0] - o[0], q[1] - o[1]], L = Math.hypot(v[0], v[1]), sc = L > 0.01 ? (v[0] * u[0] + v[1] * u[1]) / L - L / 1000 : -1;
          if (sc > bs) { bs = sc; best = q; }
        });
        if (best) setPort({ k: pp.k, end: pp.end, n: pp.n, to: best });
        return;
      }
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
