import { putMap, resetDrawing, resetMap, shared, takeMap, V } from './state.js';
import GE from '../../renderers/converter/graphml_edit.js';   // the GraphML engine: the map's GraphML read and written as text
import H from '../../renderers/layout/holding.js';   // what holds what: regrouping, growing a holder, the holder a box lies in
import { bx, keyShift, liveFit, liveLines, liveOff, posePort, shift, sizeLive, sizeOff, unshift } from './live.js';
import { AF_KINDS, drawGraphml, noNegative, shiftedAhead, yr } from './graphml.js';
import { beyond, cdDoc, cdDraw, cdGraphml, cdJs, cdKnown, cdMap, cdMk, cdNow, cdRebuild, cdRemember, cdSessionSoon, cdpy, glyphArcs, glyphPort, isCd, joinAt, joinGuides, joinSolve, lineGrid, nodeCentre, nodePlaces, plainCanvas } from './celldesigner.js';
import { EMPTY_BASE, edOf, isSb, madeHere, sbBase, sbFollow, sbGraphml, sbJs, sbKind, sbMap, sbNow, sbRemember, sbpy, viaGraphml } from './sbgn.js';
import { ddOpen, hybOn, joinDo, joinPack, joinPlan, link, linkDown, linkMove, linkPaint, linkUp, moveSays, origAll, palDown, palShow, palUp, propFmt, setSize, sizable, svDown, svMarks, tool } from './create.js';
import { help, helpBox } from './help.js';
import { draftDrop, draftPut, folder, folderFile, folderForget, folderSet, keepBeside, keptNow, listFirst, listTop, mine, mineAdd, mineIn, mineMatch, minePut, savedMine, toGh, upAll, upRun } from './own.js';

    // ---------- the editor's shared core (editor/src/core.js) ----------
    // Moves only: nodes and bend points of a map, nudged in the map window. A CellDesigner map is edited as the GraphML
    // its part makes of it, so selection, dragging, guides, the grid, undo and saving are one code for both formats.
    // Nothing is drawn twice: a move changes only the numbers of that position in the file's text (everything else stays
    // byte for byte, so yEd or CellDesigner opens it as before), and the map's renderer draws it again. A map of the site
    // is saved by itself, as in Google Docs: a few seconds after the last move its source file is
    // committed to the site's data repository with a GitHub token kept in this browser only, and the site's build redraws it; a
    // file opened from the computer is saved back into it (Chrome, Edge), else as a download.
    // The viewer's own names (the zoom z, the pan tx and ty, the map shown current, its picture img, ...) are read and
    // written through V, the object the viewer hands the editor (the editor in its own files).

    var lastSvg, lastFor, Y, G, drawing;
    function __run1() {   // run at start, in order (__start)
    lastSvg = null, lastFor = null;   // the last drawing and the texts it was drawn from (keepAhead), kept with the save (the kept drawing itself is the viewer's)
    Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
    drawing = false;
    }           // the renderer busy with the last move
    // the one place the map's text is set (release/check.js refuses another): a whole action goes through commit(), a
    // gesture's steps before its one undo step and the history (undo, redo, a kept history) through this alone
    function setText(t) { shared.text = t; return t; }
    function src() { return shared.cd ? shared.cd.now : shared.sb ? sbNow() : shared.text; }   // the map's own file as it is now (an SBGN-ML map's with the moves written in)
    var box, status, overlay, on, map, name, handle, unsaved, reSel, reGh, doc, geos, points, nodes2, edges2, docText, x0, y0, undo, drag, band, ticket, nudgeAt, timer, gN, gE, mv, keyGuides, keyRun, keyDue;
    function __run2() {   // run at start, in order (__start)
    box = document.getElementById('m2-editwin'), status = document.getElementById('m2-ed-status');
    overlay = document.getElementById('m2-edit-layer');
    on = false, map = null;    // editing, and the map object shown while editing
    name = '', handle = null;
    unsaved = {};   // by map id: a site map left with moves not saved on GitHub { id, name, site, text }; its sha read from site when used
    // the selection kept over a reload of this tab, applied when editing of the same map starts again
    reSel = (function () {
      try {
        var nav = performance.getEntriesByType('navigation')[0], r = JSON.parse(sessionStorage.getItem('atlas-edit-sel') || 'null');
        sessionStorage.removeItem('atlas-edit-sel');
        return nav && nav.type === 'reload' && r && r.path === location.pathname ? r : null;
      } catch (e) { return null; }
    })();
    // GitHub's version of that map as last saved (path, sha, text), so editing starts again without waiting for GitHub;
    // recheck reads GitHub just after, as after any start with a token
    reGh = reSel && reSel.gh && reSel.gh.path && reSel.gh.sha && typeof reSel.gh.text === 'string' ? reSel.gh : null;
    doc = null, geos = [], points = [], nodes2 = [], edges2 = [];
    docText = null;            // the text doc was read from (kept by a move, which changes both alike): the renderer reuses doc then
    x0 = 0, y0 = 0;            // where the drawing's top left is in yEd units
    undo = [], drag = null, band = null, ticket = 0, nudgeAt = 0, timer = null;
    // moving the item itself while it is dragged (in an editor it is already there while it moves):
    // the editor's drawing is put in the page as SVG with each node and arc in a group of its own (gN, gE: by id), so a
    // drag shifts the groups at once; an arc with only one end or some bends moving is hidden and drawn as plain lines
    // following the pointer (live) until the renderer has drawn the map again
    gN = null, gE = null, mv = null;
    // a move by the arrow keys shown on the drawing at once, as a drag (not only when the key is let go,
    // the drawing waiting for the keys to stop): what the keys moved since the map was last drawn
    keyGuides = null, keyRun = null, keyDue = null;
    }   // keyRun: how far the keys moved the selection since what holds what was last settled; keyDue: that settling, waiting for the keys to stop
    function keyFlush() { clearTimeout(timer); if (keyDue) keyDue(); }   // a press or another selection: the keys' run settled now
    function boxesBefore(B0) { var o = {}; nodes2.forEach(function (n, k) { o[n.id] = B0(k); }); return o; }   // every node's box before a change, by id (the map is read again before it is used)
    // the part of a selected line last pressed (a bend point or an end), which the arrow keys move as a drag would (by hand
    // or by keys the same; not every bend point of the line at once):
    // { k: the arc, p: a bend point } or { k, port: { k, end, n } }; a line selected with no part pressed is not moved by
    // the keys, as a drag on the line itself does not move it
    var TOKEN_KEY, AUTOSAVE, site, saveTimer, saving, saveAgain, stuck, siteRef, GRID_KEY, STEP0, stepOk, gridSet;
    function __run3() {   // run at start, in order (__start)
    // saving to the site: the maps are in the site's data repository (<owner>/<owner>-data, private), the map's source
    // maps/<file>.graphml; after a write the site's build is started (its workflow in <owner>/<owner>.github.io)
    TOKEN_KEY = V.tokenKey, AUTOSAVE = 3000;   // the key is the viewer's (it ignores drafts while a token is in)
    site = null;               // { path, sha } of the map being edited, when it is a map of this site
    saveTimer = null, saving = null, saveAgain = false, stuck = false;
    // the click data: the site's boxes of the nodes are those of its own version; the boxes of the
    // nodes moved since follow them, so a click and the search find a molecule where it is drawn now
    siteRef = null;   // { boxes (per node, yEd units, as in the site's version), x0, y0 (its drawing's frame) }
    // the grid: two settings, kept in this browser: the grid shown or hidden (shown by default, it
    // also says the map is being edited), snapping to it on or off (off by default; guides come first). The steps are the
    // layout rules' by default (the layout skill, Grid): node centres on 8 px, bend points on the line step (lineStep), every second
    // line drawn stronger. The demo's maps are mostly not on any grid: a snapped drag moves a node onto it.
    // Grid size (near the Grid and Snap switches; multiples of 8 by default, 4 or another step where wanted):
    // one setting for the grid drawn, the snapping of nodes, bend points (the line step) and
    // compartment edges, and the widths and heights a node resized by its handles takes (Alt or Ctrl held, any size); a
    // field under the switches, any whole number from 1 to 100 typed, its arrow opening 4, 8, 16, 32 and 64 (the
    // browser's datalist shows only the options starting with the value
    // typed, so 8 alone): a list of the page's own in the right-click menu's look, all of them always
    GRID_KEY = 'atlas-edit-grid';
    STEP0 = 8, stepOk = function (v) { return v >= 1 && v <= 100 ? Math.round(v) : STEP0; };
    gridSet = (function () { try { var g = JSON.parse(localStorage.getItem(GRID_KEY) || '{}'); return { shown: g.shown !== false, snap: g.snap === true, step: stepOk(+g.step) }; } catch (e) { return { shown: true, snap: false, step: STEP0 }; } })();
    }
    // the shift out of negative places (graphml.js, cd_edit.place) in whole blocks of the grid: the smallest even number of
    // steps that is 16 or more (16 on 4 and 8), so a map on the grid stays on it, its stronger lines too
    function gridBlock() { var s = gridSet.step; return 2 * s * Math.ceil(8 / s); }
    // the line grid, never drawn: ports (offsets from a node's centre) and bend points step on it. Half of Grid size, halved
    // again while above 8 (so a shape keeps enough places on a coarse grid), the grid itself when odd; it divides Grid
    // size, so with node centres on the grid a port and the bend points of its line meet on one lattice
    function lineStep() { var s = gridSet.step; if (s % 2) return s; s /= 2; while (s > 8 && s % 2 === 0) s /= 2; return s; }
    function gridKeep() { try { localStorage.setItem(GRID_KEY, JSON.stringify(gridSet)); } catch (e) {} }
    function gridButtons() {
      box.querySelector('#m2-ed-grid').setAttribute('aria-pressed', String(gridSet.shown));   // the switches in the tools row
      box.querySelector('#m2-ed-snap').setAttribute('aria-pressed', String(gridSet.snap));
    }
    // the grid one screen pixel wide (2 px is too heavy; 1 CSS px is 2 on a
    // Retina screen, smeared over 3 where a line falls between pixels): drawn on a canvas behind the map at the screen's own
    // pixels, each line on a whole pixel; the tones 7 % and 13 % black
    var gridCv;
    function __run4() {   // run at start, in order (__start)
    gridCv = null;
    }
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
      var s = gridSet.step; while (s * V.z < 6) s *= 2;   // never denser than 6 px on screen
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
      if (all.length !== geos.length) {   // nodes made since (the full editor): the boxes of the nodes the site has, by id
        var d = new DOMParser().parseFromString(pub, 'application/xml'), by = {};
        if (d.getElementsByTagName('parsererror').length) return null;
        Array.prototype.forEach.call(d.getElementsByTagNameNS(G, 'node'), function (n) {
          var r = realizerOf(n), g = r && r.getElementsByTagNameNS(Y, 'Geometry')[0];
          if (g) by[n.getAttribute('id')] = [num(g, 'x'), num(g, 'y'), num(g, 'width'), num(g, 'height')];
        });
        return { ids: nodes2.map(function (n) { return n.id; }), boxes: nodes2.map(function (n) { return by[n.id] || null; }), x0: fr.x0, y0: fr.y0 };
      }
      return { ids: nodes2.map(function (n) { return n.id; }), boxes: nodes2.map(function (n) { return all[n.ag]; }), x0: fr.x0, y0: fr.y0 };
    }
    // the frame of the picture against the file saved (kept with the edited drawing, the start of the next editing): a
    // CellDesigner drawing is in the file's places, which already hold a shift (out of negative places, or the canvas fit), so 0, 0; the
    // editor's own frame (x0, y0) is that shift less (else back in edit mode the map jumps by the shift)
    function picX0() { return shared.cd ? 0 : x0; }
    function picY0() { return shared.cd ? 0 : y0; }
    function nowRef() { return { ids: nodes2.map(function (n) { return n.id; }), boxes: nodes2.map(function (n, i) { return boxOf(i); }), x0: x0, y0: y0 }; }   // ids: nodes made since keep their own boxes apart
    function owner() { var h = location.hostname; return /\.github\.io$/.test(h) ? h.split('.')[0] : null; }
    function repo() { var o = owner(); return o ? o + '/' + o + '-data' : null; }
    function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
    function gh(full, opt) {
      opt = opt || {};
      opt.headers = Object.assign({ Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {});
      opt.cache = 'no-store';
      return fetch('https://api.github.com/repos/' + full, opt);
    }
    function api(path, opt) {   // the data repository; a write that went through starts the site's build
      var r = gh(repo() + path, opt), write = opt && opt.method && opt.method !== 'GET';
      if (write) r.then(function (q) { if (q.ok) startBuild(); }, function () {});
      return r;
    }
    // the site's build, started a few seconds after the last write (one build for a run of saves; GitHub keeps
    // only the newest waiting run), at once when the page is left; a token that may not start it (Actions write on
    // <owner>.github.io) is said in red at every save, as the site then shows the edits only at its next build
    var buildTimer, buildRefused;
    function __run5() {   // run at start, in order (__start)
    buildTimer = null, buildRefused = 0;
    }
    function dispatchBuild(keep) {
      var o = owner();
      return gh(o + '/' + o + '.github.io/actions/workflows/build.yml/dispatches', { method: 'POST', keepalive: !!keep, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }) })
        .then(function (q) { buildRefused = q.ok ? 0 : q.status; if (!q.ok) warn(buildNote()); }, function () {});
    }
    function startBuild() { clearTimeout(buildTimer); buildTimer = setTimeout(function () { buildTimer = null; dispatchBuild(false); }, 4000); }
    function buildNote() { return 'Saved, but the site is not rebuilt (' + buildRefused + '): the token cannot start its build.'; }
    function __run6() {   // run at start, in order (__start)
    addEventListener('pagehide', function () { if (buildTimer) { clearTimeout(buildTimer); buildTimer = null; dispatchBuild(true); } });
    }
    function b64(t) {   // UTF-8 text to base64, in pieces (a map is a few hundred KB)
      var u = new TextEncoder().encode(t), s = '';
      for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function changed() {   // after every move, undo or redo: the site's map is saved a few seconds after the last one
      edits++;
      if (openSay) { if (status.textContent === openSay.t) quiet(); openSay = null; }   // the save clash said until the reader's next change
      goodNow();
      sbFollow();   // a move that turned an SBGN-ML file: the GraphML made again from it (sbgn.js)
      if (site && site.pending) { localFor = site; clearTimeout(localTimer); localTimer = setTimeout(local, 800); localBox(); return; }   // no token: kept in this browser
      if (site && site.mine) { localFor = site; clearTimeout(localTimer); localTimer = setTimeout(local, 800); }   // a reader's map saved on GitHub: its record follows too, so no move waits on GitHub alone
      if (!site || !token() || stuck) return;
      note();
      clearTimeout(saveTimer); saveTimer = setTimeout(push, AUTOSAVE);
    }
    function push(again) {
      clearTimeout(saveTimer); saveTimer = null;
      if (!site || !shared.dirty || stuck) return Promise.resolve();
      if (saving) { saveAgain = true; return saving; }
      if (drawing) { saveTimer = setTimeout(push, 300); return Promise.resolve(); }   // the last move not yet in the file
      var target = site, body = src();
      note();
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
              if (target.mine) savedMine(target, body);   // a reader's map on its way to the site: its record shown until the build is of this save
              var ks = lastFor && lastFor[2] === target.id && !lastFor[3] ? lastSvg : null;   // this map's drawing only, never the map edited before
              if (ks && site === target && src() === body && !target.mine) {
                var all = V.stored();
                var one = {}; one[target.id] = all[target.id] = { v: target.v, sha: target.sha, svg: ks, text: body, file: name, width: map.width, height: map.height, x0: picX0(), y0: picY0(), at: Date.now(), ref: siteRef, cur: nowRef() };
                // the browser's storage full (a few large maps): the other maps' files left out first (their downloads after a
                // reload are then the site's), then this map's, then this map's drawing alone, else none of it (never an older one)
                var bare = function (o, keep) { Object.keys(o).forEach(function (k) { if (k !== keep) delete o[k].text; }); return o; };
                if (!V.store(all) && !V.store(bare(all, target.id)) && !V.store(bare(all)) && !V.store(bare(one))) { all = V.stored(); delete all[target.id]; V.store(all); }
              }
              if (site === target && src() === body) shared.dirty = false;
              var uk = unsaved[target.id];
              if (uk && uk.site === target && (uk.text === body || (site === target && !shared.dirty))) delete unsaved[target.id];
              note();
            } else if (r.status === 409 || r.status === 422) {
              // GitHub also refuses a save when its branch moved meanwhile (another page or tab saved meanwhile,
              // so the move would be 'Not saved'): the file as it is there now is read, and if it is
              // still what this page last saved, the save goes again on its new sha; only a file changed by someone
              // else stops saving
              return again ? conflict(target, body) : Promise.all([api('/contents/' + target.path + '?ref=main').then(function (q) { return q.json(); }),
                api('/contents/' + target.path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (q) { return q.text(); })])
                .then(function (f) {
                  if (f[1] !== (target.saved || target.base)) return conflict(target, body);
                  target.sha = f[0].sha; saving = null; saveAgain = false;
                  return push(true);
                }, function (e) { warn('Not saved: no connection (' + (e && e.message ? e.message : e) + '). The next move tries again.'); });   // GitHub not reached to compare: no clash claimed
            } else if (r.status === 401 || r.status === 403 || r.status === 404) {
              warn('Not saved: the token was refused (' + r.status + '). Connect again with a token that can write to ' + repo() + '.');
              ghForm(true);
            } else warn('Not saved (' + r.status + '): ' + (d.message || '') + '. The next move tries again.');
          });
        })
        .catch(function (e) { warn('Not saved: no connection (' + e.message + '). The next move tries again.'); })
        .then(function () { if (saving !== ours) return; saving = null; if (saveAgain) { saveAgain = false; if (shared.dirty) return push(); } });
      var ours = saving;
      return saving;
    }
    // no token (the first layer): the map's file as edited and its drawing kept in this browser
    // (draftPut, own.js), a moment after the last move once the move is drawn, so a reload shows it and editing goes on from
    // it; the map back as the site has it (every move undone): let go. force: written now, the drawing as it is (another
    // map is being opened)
    var localTimer, localFor, lq;
    function __run7() {   // run at start, in order (__start)
    localTimer = null, localFor = null, lq = Promise.resolve();
    }
    function local(force) {
      clearTimeout(localTimer); localTimer = null;
      var s = localFor;
      if (!s || site !== s) return;
      var drawn = !drawing && lastFor && lastFor[0] === shared.text && lastFor[1] === (shared.cd ? shared.cd.now : null);
      if (!drawn && !force) { localTimer = setTimeout(local, 300); return; }
      localFor = null;
      if (s.clashed) return;   // kept beside already (clashed): the map itself is never written by this page again
      var t = src(), at = { width: map.width, height: map.height, x0: picX0(), y0: picY0(), ref: siteRef, cur: nowRef() };
      // this map's drawing only: the map edited before still drawn while this one's first redraw runs (another map opened
      // at once) is never stored with it; then this text is drawn for it here
      var own = lastFor && lastFor[2] === s.id && !lastFor[3] ? lastSvg : null;
      // taken now: by the time the check below is done another map may be open (local(true) at opening), the globals its own
      var nm = name, back = !s.mine && atSite(), g0 = shared.sb && !s.mine ? shared.sb.g0 : null;
      var pic = function () { return own ? Promise.resolve({ svg: own, width: at.width, height: at.height }) : drawText(t, g0); };   // a site map's SBGN-ML drawn from the build's GraphML, as the site draws it
      var fail = function (e) { if (site === s) warn('Not kept in this browser: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '. Download the map to keep your changes.'); };
      // what this browser keeps of the map read afresh first: written by another tab since this page opened it, it is
      // not written over (clashed). One check and write at a time, so this page's own last write is the one compared
      lq = lq.then(function () { return keptNow(s).catch(function () { return s.known; }); }).then(function (k) {
        if (s.clashed) return;
        if (k !== s.known) return clashed(s, t, 'in another tab');
        return write();
      }).catch(fail);   // never left rejected: every later check and write waits on it
      function write() {
      if (s.mine) {   // a reader's own map: the map itself changed, in this browser and its folder (no draft), and on GitHub with a token
        if (!mine[s.id]) return;   // gone from this browser meanwhile: nothing to keep
        toFolder(s.id, nm, t);
        return pic().then(function (d) { if (mine[s.id]) return minePut(Object.assign({}, mine[s.id], { text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now() })).then(function () { s.known = t; }); })
          .then(function () {
            if (s.pending && site === s && src() === t) shared.dirty = false;   // saved on GitHub: dirty is the save's to clear
            if (s.pending && repo() && token() && mine[s.id]) toGh(s);   // not saving on GitHub yet: sent, or its place there taken up
            if (!on || site !== s) V.refreshMine();
          })
          .catch(fail);
      }
      if (back) { if (site === s) { shared.dirty = false; localBox(); } toFolder(s.id, nm, t, true); return draftDrop(s.id).then(function () { s.known = null; }); }   // a file in the folder back to the site's map too
      toFolder(s.id, nm, t);   // layer 2: the same file into the reader's folder, when there is one
      return pic().then(function (d) { return draftPut(s.id, { file: nm, v: s.v, text: t, svg: d.svg, width: d.width, height: d.height, x0: at.x0, y0: at.y0, ref: at.ref, cur: at.cur, at: Date.now() }); })
        .then(function () { s.known = t; if (site === s && src() === t) shared.dirty = false; })
        .catch(fail);
      }
    }
    // the map as the site has it: its text, or every move undone (a map shifted out of negative places never gives the
    // site's text back)
    // out of editing histKeep has emptied undo: a write still waiting after a quick leave counts the moves as they were
    // on leaving (leftMoves, set by stop), else it would take the map for the site's and drop the draft
    var leftMoves;
    function __run8() {   // run at start, in order (__start)
    leftMoves = null;
    }
    function atSite() {
      var n = !on && leftMoves && leftMoves.site === site ? leftMoves.n : undo.length;
      return site.pending && (src() === site.pub || (!n && !site.fromDraft));
    }
    function unkeep(id) {   // the reader's changes let go (Back to the site's map, a token connected): a write waiting dropped too
      if (localFor && localFor.id === id) { clearTimeout(localTimer); localTimer = null; localFor = null; }
      return draftDrop(id);
    }
    // layer 2: a folder the reader chooses on their computer, saved to automatically,
    // chosen once (Chrome, Edge: showDirectoryPicker), where every map kept in this browser is also written as its file, a
    // moment after the last move. A file this browser did not write is never overwritten: one there already, or changed
    // since by another program, gets the next free name beside it (acly-2.graphml). After a reload the browser may ask
    // again (Allow), unless it keeps the permission (Chrome 122 and later can). Its record: folder() in own.js
    var canFolder, folderOk, fq;
    function __run9() {   // run at start, in order (__start)
    canFolder = 'showDirectoryPicker' in window, folderOk = null, fq = Promise.resolve();
    }   // folderOk null: not known yet (no text 3 or 4)
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
    function toFolder(id, file, t, ours) {   // one at a time, in the order asked; the last argument: write only into a file this page wrote before
      if (!canFolder || !V.folderName() || !file || (repo() && token())) return fq;   // connected: GitHub is the only place saved to
      fq = fq.then(function () {
        return folder().then(function (f) {
          if (!f) return;
          var w = f.files[id];
          if (w && w.name.indexOf('/') >= 0) w = null;   // its file in Deleted/ (own.js folderMove): written anew beside the others
          if (ours && !w) return;
          return f.dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
            folderOk = p === 'granted';
            if (!folderOk) { localBox(); return; }
            var nm = w ? w.name : file;
            return f.dir.getFileHandle(nm).then(function (h) { return h.getFile(); }, function () { return null; }).then(function (old) {
              // not written here (there before, or changed since by another program): beside it
              return old && !(w && old.lastModified === w.mod && old.size === w.size) ? freeName(f.dir, file, 2) : nm;
            }).then(function (nm2) {
              var h;
              return f.dir.getFileHandle(nm2, { create: true }).then(function (x) { h = x; return h.createWritable(); })
                .then(function (wr) { return wr.write(t).then(function () { return wr.close(); }); })
                .then(function () { return h.getFile(); })
                .then(function (fl) { return folderFile(id, { name: nm2, mod: fl.lastModified, size: fl.size }); })
                .then(function () {   // a new file: no record left under its name, and the map's own one (taken before) beside it
                  if (w && w.name === nm2) return;
                  return origFolderDrop(f, nm2).then(function () { var r = origAll()[id]; if (r && (r.fill || r.node)) return origWrite(f, nm2, r); });
                });
            });
          });
        });
      }).catch(function (e) { if (e && (e.name === 'NotFoundError' || e.name === 'NotAllowedError')) lost(e); else warn('Not saved to the folder: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '.'); });
      return fq;
    }
    // Original's record (create.js colsPick) beside the maps in the folder too, in its hidden .viewer/colours/<file>.json
    // (a name starting with a dot: hidden in Finder and the Explorer, never read by other programs), so it outlives the
    // browser's site data. By the map's file name there: written with the map's first file (a record taken before), taken
    // out when a new file takes a name (a record left by a map deleted or moved), deleted with the map, moved with its
    // file back from Deleted/ (own.js); a file renamed elsewhere does not carry it (Original then starts from the map)
    function origFolderDir(f, make) { return f.dir.getDirectoryHandle('.viewer', { create: make }).then(function (d) { return d.getDirectoryHandle('colours', { create: make }); }); }
    function origFolderName(id, f) { var w = f && f.files[id]; return w && w.name.indexOf('/') < 0 ? w.name : null; }
    function origWrite(f, nm, rec) {
      return origFolderDir(f, true).then(function (d) { return d.getFileHandle(nm + '.json', { create: true }); }).then(function (h) { return h.createWritable(); })
        .then(function (w) { return w.write(JSON.stringify(Object.assign({}, rec, { sent: undefined }))).then(function () { return w.close(); }); });
    }
    function origFolderDrop(f, nm) { return origFolderDir(f, false).then(function (d) { return d.removeEntry(nm + '.json'); }).catch(function () {}); }   // none there: nothing to do
    function origRead(f, nm) {   // a record, or null (none, unreadable, not a record)
      return origFolderDir(f, false).then(function (d) { return d.getFileHandle(nm + '.json'); }).then(function (h) { return h.getFile(); }).then(function (fl) { return fl.text(); })
        .then(function (t) { var r = JSON.parse(t); return r && typeof r === 'object' && !Array.isArray(r) && (r.fill || r.node) ? r : null; }).catch(function () { return null; });
    }
    function origToFolder(id, rec) {
      if (!canFolder || !V.folderName() || (repo() && token())) return;   // connected: GitHub has it
      fq = fq.then(function () {
        return folder().then(function (f) {
          var nm = origFolderName(id, f);
          if (!nm) return;   // the map not in the folder yet: written with its first file (toFolder)
          return f.dir.queryPermission({ mode: 'readwrite' }).then(function (p) { if (p === 'granted') return origWrite(f, nm, rec); });
        });
      }).catch(function (e) { if (e && (e.name === 'NotFoundError' || e.name === 'NotAllowedError')) lost(e); else warn('The map\u2019s own colours were not kept in the folder: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '.'); });
    }
    function origFromFolder(id) {   // the record in the folder, or null
      if (!canFolder || !V.folderName() || (repo() && token())) return Promise.resolve(null);
      return folder().then(function (f) { var nm = origFolderName(id, f); return nm ? origRead(f, nm) : null; }).catch(function () { return null; });
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
    // the folder as the list (My maps): the GraphML and CellDesigner files a reader put there, and SBGN-ML ones made here (New map), are added, one changed
    // since by another program (yEd, CellDesigner) is read again; the files written here for the site's maps are left
    // out, a map in Deleted stays there (its file in the folder's Deleted/, not read)
    function syncFolder() {
      if (!canFolder || !V.folderName() || (repo() && token())) return Promise.resolve();   // connected: the folder not used
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
            return hs.filter(function (h) { return h.kind === 'file' && /\.(graphml|xml|sbgn)$/i.test(h.name); }).reduce(function (q, h) {
              return q.then(function () {
                var id = ours[h.name];
                if (id ? !mine[id] : siteFiles[h.name.replace(/-\d+(\.[^.]+)$/, '$1')]) return;   // a site's map kept here
                var r = id ? mine[id] : null, w = r && f.files[r.id];
                if (r && r.hidden) return;
                return h.getFile().then(function (fl) {
                  if (r && w && fl.lastModified === w.mod && fl.size === w.size) return;
                  return fl.text().then(function (t) {
                    // a file not written here: a map of its own only when no map of the reader's is this file (name and
                    // content), so their original beside the copy written here, or a map taken off the
                    // list, is left as it is
                    if (!id && mineMatch(h.name, t)) return;
                    if (isSb(t) && !madeHere(t)) return;   // another editor's SBGN-ML: not drawn from the empty base (sbgn.js)
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
    function drawText(t, g0, keep) {   // a reader's map: GraphML, CellDesigner, or SBGN-ML made here (New map), drawn from the empty base (own.js); g0: a site SBGN-ML map's build GraphML; keep: 'adding' when the map is shown next (a CellDesigner file's document kept for it, celldesigner.js cdDoc)
      var c = isCd(t), s = !c && isSb(t);
      if (!c && !s && !/<graphml[\s>]/.test(t.slice(0, 3000))) return Promise.reject(new Error('not a GraphML, CellDesigner or SBGN-ML file'));
      return (c ? cdpy() : s ? sbpy() : yr()).then(function () {
        var svg = c ? window.cdrender.render(cdDoc(t, keep || false), { classes: true, groups: true }) : window.yrender.render(s ? sbGraphml(t, g0 || EMPTY_BASE) : t, { classes: true, groups: true, sbgn: s }).svg;   // grouped: the editor's own drawing, taken as it is on entering edit (adopt)
        var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
        if (!w) throw new Error('not a map this viewer can draw');
        return { svg: svg, width: parseFloat(w[1]), height: parseFloat(w[2]) };
      });
    }
    function __run10() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-l-folder').addEventListener('click', function () { chooseFolder().catch(function () {}); });
    box.querySelector('#m2-ed-l-allow').addEventListener('click', allowFolder);
    }
    // what the Edit window says while a map of the site is edited with no token, once a move is made: no folder,
    // text 1 the first time in this browser and Choose a folder (Chrome, Edge) or
    // Download the map with text 2 (other browsers); the folder allowed, text 3; the folder to allow again, text 4 and Allow
    function localBox() {
      var b = box.querySelector('#m2-ed-local'), show = !!(on && site && site.pending && (undo.length || site.fromDraft) && !(repo() && token()));   // connected: no folder offered
      b.hidden = !show;
      if (!show) return;
      if (!b.dataset.seen) {
        var told = null; try { told = localStorage.getItem('atlas-edit-told'); localStorage.setItem('atlas-edit-told', '1'); } catch (e) {}
        b.dataset.seen = told ? 'before' : 'now';
      }
      var first = b.dataset.seen === 'now', fn = canFolder ? V.folderName() : '', q = function (k) { return b.querySelector(k); };
      q('#m2-ed-l1').hidden = !first || !!fn;
      var l5 = q('#m2-ed-l5');   // after the first time: one short line stays while nothing outside this browser keeps the map
      if (l5) l5.hidden = first || !!fn;   // none in a page older than this editor (a cached page)
      if (l5) l5.textContent = canFolder ? 'Kept in this browser only: choose a folder so your maps cannot be lost.' : 'Kept in this browser only: download the map so it cannot be lost.';
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
    function __run11() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-local-dl').addEventListener('click', function () { if (shared.text) download(); });
    }
    function conflict(s, body) {   // s: the map whose save GitHub refused as changed by someone else; body: the text that save sent
      if (site === s) stuck = true;   // a map opened since then saves as before
      var u = unsaved[s.id];
      if (u && u.site === s) body = u.text;   // left with moves after that save: those are the reader's version
      forget(s.id); learnt(s.path, 'changed'); delete unsaved[s.id];   // opened again, the map is read afresh from GitHub
      clashed(s, body, 'on GitHub');
    }
    // the save clash: map s changed elsewhere since this page opened it (where: on GitHub, in another tab) is left as it
    // is there; the reader's version t is kept as a map of theirs right under it (own.js keepBeside), said, and editing
    // goes on in it. openSay: { id, t }, the same words said again while the copy (its list id) is open for editing,
    // until the reader's next change
    var openSay;
    function __run45() {   // run at start, in order (__start)
    openSay = null;
    }
    function sayOpen() { if (openSay && site && site.id === openSay.id) warn(openSay.t); }
    function clashed(s, t, where) {   // t: the text last written, taken for the copy unless the map is still being edited (its moves since then too)
      if (s.clashed) return;
      s.clashed = true;
      var m0 = V.byId[s.id], n = m0 ? m0.topic || m0.title : name;
      return keepBeside(s.id, function () { return on && site === s ? src() : t; }, function (title, id, was) {
        openSay = { id: id, t: (n = was) + ' was changed ' + where + ' since you opened it, so it is not overwritten: your version is kept beside it as ' + title + ', and editing goes on there.' };
        warn(openSay.t);
      }).catch(function (e) {
        warn('Not saved: ' + n + ' was changed ' + where + ' since you opened it, so it is not overwritten, and your version could not be kept beside it (' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '). Download the map to keep your changes.');
      });
    }
    // The error catcher: an error nobody caught while a map is edited (in a gesture, a key, a timer, a promise) is said in
    // one line with where it happened in the editor's sources (editor.js.map, fetched at the first error), and the map is
    // put back as it was after the last change that ended (good: its text, how many undo steps), drawn again, any drag
    // let go. Passed by: what the browser reports that is no fault of the page (a ResizeObserver loop, a fetch cut off by
    // leaving or a lost connection, another site's script). A second error within a second is said, not undone again
    var good, caughtAt, srcMap, PASSED;
    function __run46() {   // run at start, in order (__start)
    good = null, caughtAt = 0, srcMap = null;
    PASSED = /ResizeObserver loop|Failed to fetch|Load failed|NetworkError|network connection was lost|appears to be offline|request timed out|access control checks|The operation was aborted|AbortError|^Script error\.?$/;
    addEventListener('error', function (e) { caught(e.error || e.message, e.filename); });
    addEventListener('unhandledrejection', function (e) { caught(e.reason, ''); });
    }
    function goodNow() { good = { u: undoText(), n: undo.length, sb: shared.sb ? shared.sb.base : null, at: map }; }
    function caught(err, file) {
      var msg = err && err.message ? err.message : String(err), stack = err && err.stack ? String(err.stack) : '';
      if (!on || PASSED.test(msg) || (err && err.name === 'AbortError')) return;
      if (!file) { var u = /([a-z][a-z0-9+.-]*:\/\/[^\s()]+?):\d+:\d+/.exec(stack); if (u) file = u[1]; }   // a rejection: where its stack starts
      if (file && file.indexOf(location.origin) !== 0) return;   // a browser extension's script, another site's
      var now = Date.now(), again = now - caughtAt < 1000;
      caughtAt = now;
      // put back only when something is under way or changed since the last change that ended: an error with the map as
      // it was (a background read, a redraw of that very state failing) leaves it alone, so a redraw that fails never loops
      var back = !again && good && good.at === map && (drag || band || shared.text !== (typeof good.u === 'string' ? good.u : good.u.g) || undo.length !== good.n);
      if (back) {
        drag = null; band = null; shared.tap = null; drawing = false;
        if (good.n < undo.length) { undo.length = good.n; if (undo.ts) undo.ts.length = Math.min(undo.ts.length, good.n); }
        var g = fromUndo(good.u);
        if (shared.sb && good.sb) shared.sb.base = good.sb;
        setText(g); shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null;
        try { parse(); render(); paint(); } catch (e) {}
      }
      var say = function (at) { if (on) warn('Something went wrong in the editor (' + (at ? at + ': ' : '') + msg.split('\n')[0] + ')' + (back ? '; the map is back as it was after the last change.' : '.')); };
      where(stack).then(say, function () { say(''); });
    }
    function where(stack) {   // the first line of the stack in the editor's or a renderer's code, as file:line of its sources
      var m = /(https?:\/\/[^\s()]*\/editor\.js)(\?[^:\s()]*)?:(\d+):(\d+)/.exec(stack);
      if (!m) { var o = /\/([\w.-]+\.js)(\?[^:\s()]*)?:(\d+):\d+/.exec(stack); return Promise.resolve(o ? o[1] + ':' + o[3] : ''); }
      if (!srcMap) srcMap = fetch(m[1] + '.map' + (m[2] || '')).then(function (q) { if (!q.ok) throw new Error(q.status); return q.json(); });
      srcMap.catch(function () { srcMap = null; });
      return srcMap.then(function (sm) { return mapped(sm, +m[3], +m[4]) || 'editor.js:' + m[3]; }, function () { return 'editor.js:' + m[3]; });
    }
    function mapped(sm, line, col) {   // a source map's place for a line and column of the built file (both from 1), as file:line
      var B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', lines = sm.mappings.split(';'), f = 0, l = 0, best = null;
      for (var i = 0; i < line && i < lines.length; i++) {
        var c = 0;
        lines[i].split(',').forEach(function (seg) {
          if (!seg) return;
          var d = [], v = 0, sh = 0;
          for (var k = 0; k < seg.length; k++) { var x = B.indexOf(seg[k]); v += (x & 31) << sh; if (x & 32) sh += 5; else { d.push(v & 1 ? -(v >> 1) : v >> 1); v = 0; sh = 0; } }
          c += d[0];
          if (d.length > 3) { f += d[1]; l += d[2]; if (i === line - 1 && c <= col - 1) best = [f, l]; }
        });
      }
      return best ? String(sm.sources[best[0]]).split('/').pop() + ':' + (best[1] + 1) : '';
    }
    function ghForm(show) {   // the token field: shown while editing a map of this site with no token
      var f = box.querySelector('#m2-ed-gh');
      f.hidden = !show;
      box.querySelector('#m2-ed-gh-off').hidden = show || !token() || !repo();
    }

    // the status line says only what went wrong, in red: nothing while things work (no save messages, no save time or
    // mark by the title: when and how a map is saved is the system's concern). A warning stays until the next thing that works.
    function warn(t) { status.textContent = t; status.classList.add('m2-ed-warn'); }
    function note() { if (buildRefused) return warn(buildNote()); quiet(); }   // a step that worked: nothing said, a warning before it cleared; a build refused stays said
    function quiet() { status.textContent = ''; status.classList.remove('m2-ed-warn'); }

    // the layout tools (renderers/layout/layout.js, its own master since it was unlinked from the layout skill it began
    // as), run on the map's text; only the numbers they change are written back (tidy), so the rest stays byte for byte.
    // One undo step. Checked by tests/layout-compare.js: layout.tidy(text, what, ids, keepPorts)
    var lay;
    function __run12() {   // run at start, in order (__start)
    lay = null;
    }
    function layout() {
      if (lay) return lay;
      lay = new Promise(function (res, rej) {
        if (window.layout) return res(window.layout);
        var s = document.createElement('script');
        s.src = V.renderers + 'layout/layout.js' + V.build; s.onload = function () { res(window.layout); window.dispatchEvent(new Event('m2-layout')); }; s.onerror = function () { rej('layout tools not found'); };
        document.head.appendChild(s);
      });
      lay.catch(function (e) { lay = null; warn('The layout tools did not load: ' + e); });
      return lay;
    }
    function layTool(what, ids, same) {   // not tool: create.js's palette sign in hand, of the same scope, replaced it (Snap map to grid and Pack would fail)
      if (!on || V.current !== map || !shared.text) return;   // same: part of the change just made (its undo step)
      if (!same) quiet();
      var uAt = undo.length, uTop = undo[uAt - 1];   // the step it belongs to (render may write the same text in other numbers first)
      var m0 = map;
      Promise.all([layout(), sbpy()]).then(function (q) {
        if (!on || map !== m0) return;   // the map left meanwhile
        if (same && (undo.length !== uAt || undo[uAt - 1] !== uTop)) return;   // undone or another change meanwhile
        // the layout tools grow a compartment round all it holds, which would take an edge member inside: what crosses a
        // compartment's border is taken out of it for the run and put back after, its compartment then grown only so far
        // that it crosses again (grown), so every member keeps its place
        var L = q[0], N = q[1], out = [], t1 = shared.text, before = boxesBefore(boxOf);
        nodes2.forEach(function (n, k) {
          var p = n.up;
          if (p != null && nodes2[p].comp && !cdOwn(k) && overlap(boxOf(k), boxOf(p)) && !inBox(boxOf(k), boxOf(p))) out.push([n.id, nodes2[p].id]);
        });
        out.forEach(function (m) { t1 = N.moveInto(t1, [[m[0], null]]); });
        var r = L.tidy(t1, what, ids || [], !!shared.cd, { grid: gridSet.step, route: lineStep() });   // Snap map to grid on Grid size, bend points on the line step
        if (r[1] < 0) return;   // nothing it applies to: nothing said
        if (!r[1]) return;   // nothing to change: nothing said
        var t2 = r[0];
        out.slice().reverse().forEach(function (m) { t2 = N.moveInto(t2, [m]); });
        if (!same) remember(false);
        var keepSel = same ? shared.selN.map(function (i) { return nodes2[i].id; }) : [];
        setText(t2); parse(); shared.selN = []; shared.selP = []; shared.selE = []; shared.dirty = true;
        if (keepSel.length) nodes2.forEach(function (n, k) { if (keepSel.indexOf(n.id) >= 0) shared.selN.push(k); });
        if (out.length) {
          var at = {}; nodes2.forEach(function (n, k) { at[n.id] = k; });
          setBoxes(grown(out.map(function (m) { return at[m[0]]; }), boxOf, function (k) { return before[nodes2[k].id] || boxOf(k); }, function () { return false; }));
          refit(out.map(function (m) { return m[0]; }));
        }
        render(); paint(); changed();
      }).catch(function (e) { warn('Not done: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); });
    }
    function snapMap() { layTool('grid', []); }
    function pack(ids) {
      layTool('pack', ids);
    }
    function __run13() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-tidy-grid').addEventListener('click', snapMap);
    }
    function outerComplex(i) {   // the outermost complex round node i (itself included), or null: the layout tools pack a complex inside another
      var c = null;   // with it, and one packed alone would land where the outer's packing puts it, over its neighbours
      for (var u = i; u != null; u = nodes2[u].up) if (nodes2[u].shape.kind === 'Complex') c = u;
      return c;
    }
    function __run14() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-tidy-pack').addEventListener('click', function () { pack(shared.selN.map(function (i) { var c = outerComplex(i); return nodes2[c == null ? i : c].id; })); });
    }

    // the file read: every y:Geometry and y:Point in document order, which is also their order in the text
    function parse() {
      var how = shared.sbBack ? 'back' : 'follow'; shared.sbBack = false;
      if (shared.sb) sbKind(how);   // a change that turned an SBGN-ML file: the GraphML made again from it first (sbgn.js)
      var pd = preDoc.filter(function (x) { return x.text === shared.text; })[0];   // read ahead, each used once
      preDoc = preDoc.filter(function (x) { return x !== pd; });
      var R = GE.read(shared.text, { doc: pd ? pd.doc : null, cd: !!shared.cd });
      doc = R.doc; docText = shared.text; geos = R.geos; points = R.points; nodes2 = R.nodes; edges2 = R.edges; shared.procs = R.procs;
      parseFix.forEach(function (f) { f(); });
    }
    function realizerOf(el) { return GE.realizerOf(el); }   // the node's own yEd realizer (of a group: the one shown)
    // after a move of nodes (a drag, the keys): each function given the nodes moved (their indices) puts what it keeps in
    // place (a terminal back onto its submap's border, create.js), in the same undo step
    var moveFix, parseFix, keyTake;
    function __run15() {   // run at start, in order (__start)
    moveFix = [], parseFix = [];   // parseFix: after the nodes are read, a format's part adds what moves with what (create.js terminals)
    keyTake = [];
    }   // an arrow key on the selection taken by a part of its own (create.js: a terminal round its submap): f(d, the key's event) true when taken
    function fixMoved(set, alone) {   // alone: moved with Shift. A fix may reorder the nodes (a tag joining a submap): the
      // moved set and the selection kept by id
      var ids = [], sel = shared.selN.map(function (i) { return nodes2[i].id; });
      set.forEach(function (i) { ids.push(nodes2[i].id); });
      moveFix.forEach(function (f) { f(set, alone); });
      set.clear(); shared.selN = [];
      nodes2.forEach(function (n, i) { if (ids.indexOf(n.id) >= 0) set.add(i); if (sel.indexOf(n.id) >= 0) shared.selN.push(i); });
    }
    function num(el, a) { return parseFloat(el.getAttribute(a)); }
    function boxOf(i) { var g = geos[nodes2[i].ag]; return [num(g, 'x'), num(g, 'y'), num(g, 'width'), num(g, 'height')]; }
    function fmt(v) { return GE.fmt(v); }

    // the move: new x and y for some y:Geometry and y:Point, written into the text in one pass, the rest untouched
    function write(g, p) {
      var same = docText === shared.text;   // the elements of doc got these numbers already (move)
      setText(GE.place(shared.text, g, p));
      if (same) docText = shared.text;
    }
    function moving(alone) {   // what a move of the selection moves: nodes (a group with what it holds) and bend points;
      // alone (Shift with a drag, to move a node without its content): the
      // nodes selected without what they hold
      var all = new Set();
      // a process glyph never moves by itself (as in CellDesigner, where a process
      // cannot be moved itself): it stays midway on its segment, which moves by its anchor (bend) points and its ends; it goes only with
      // a group that holds its whole reaction
      shared.selN.forEach(function (i) { if (!(shared.cd && /\|proc$/.test(nodes2[i].id))) all.add(i); nodes2[i].inside.forEach(function (c) { if (!alone || nodes2[c].sub === i) all.add(c); }); });   // a submap's terminals go with it even alone
      var ps = new Set(shared.selP);
      shared.selE.forEach(function (k) { edges2[k].pts.forEach(function (p) { ps.add(p); }); });
      edges2.forEach(function (e) { if (all.has(e.s) && all.has(e.t)) e.pts.forEach(function (p) { ps.add(p); }); });
      return { n: all, p: ps, dx: 0, dy: 0 };
    }
    function movedIds(sets) { var a = []; sets.n.forEach(function (i) { a.push(nodes2[i].id); }); return a; }
    // what holds what, freely changed, on every format (the member's place and the compartment rules
    // as in the SBGN editor). A compartment's member is inside (its box fully in) or on the edge
    // (crossing the border, a membrane protein half out), read from geometry when a drag starts; a plain drag or the keys
    // (Layout and Full) keep that: an inside member pushed against the border grows the compartment, keeping PAD from its
    // inner line; an edge member moves freely along and across the edge, the compartment growing only to keep it crossing,
    // and dragged inward it goes fully inside freely; the state read at drag start holds until release, so in one drag it
    // may cross the whole compartment and still come out on the far edge; released fully inside it is an inside member
    // (back onto the edge only with Shift); a member
    // another tool left fully outside is left as it is. With Shift (to move a node without its content, breaking the connection) a node
    // moves by itself and changes its state: dropped crossing the border it is on the edge, fully inside it is inside, and
    // in Full only, fully outside, it leaves for the innermost compartment holding its whole box, or none; in Layout the
    // drag is held where it still overlaps (tether) and nothing grows. A compartment or complex moved with Shift (Full)
    // lets go of what no longer overlaps it (a complex: of what is no longer fully inside). A complex holds its members
    // fully: a drag grows it, only Shift in Full lets one leave. An edge member crossing into a neighbouring compartment
    // still belongs to its own. Layout editing never changes what holds what; in Full a free node
    // dragged fully into a compartment joins it (also one deeper inside its own), a compartment resized lets go of what no
    // longer overlaps it and leaves its own holder once resized past its edge, a compartment moved past its holder's edge
    // grows the holder, and a compartment whose box changed (drawn, moved, resized) takes in every compartment and glyph
    // whose whole box it newly holds, with what is inside, also one that held it once it has left it. regroup puts
    // nothing into a complex: a glyph dropped on one joins it after (joinPlan, create.js); processes and logic gates are
    // never taken in, only let go to a compartment already round them; a CellDesigner glyph or gate the same, cd_edit
    // placing it again.
    function full() { return V.level === 'full'; }
    function inBox(b, c) { return H.inBox(b, c); }   // holding.js
    function overlap(b, c) { return H.overlap(b, c); }
    function under(i, a) { return hm().under(i, a); }   // a holds i, at any depth
    function notIn(i) { return hm().notIn(i); }   // neither the node nor what it holds
    function cdOwn(i) { return hm().cdOwn(i); }   // a CellDesigner process glyph or gate
    function holder(b, not, B) { return hm().holder(b, not, B); }   // the innermost compartment whose box holds box b fully, none for which not() holds
    function tops(set, alone) { return hm().tops(set, alone); }   // the nodes a move grows round: those not moving with their holder; with Shift only compartments (rule 2)
    // an inside member's least space to its compartment's inner line (inside CellDesigner's double border, clear of a
    // compartment's name) when a drag grows the compartment round it (PAD in grown):
    // its value Settings' Compartments padding (the viewer writes the key), 12 by default, 0 to 64 in steps of 4; a
    // compartment inside another the same, from its outer line (its box) to the holder's inner line (CellDesigner: inside
    // the membrane, the inset its thickness gives); a value off the steps (an older 10) read as the default; a complex's room
    // its Complex padding: As Repack (layout.js room, what Pack leaves: the sides, top and bottom, or NAMED over a name
    // inside) or a number on every side, the name's own height added (cxRoom)
    var PAD_KEY;
    function __run16() {   // run at start, in order (__start)
    PAD_KEY = 'atlas-edit-padding';
    }
    function pads() {
      var p = {}; try { p = JSON.parse(localStorage.getItem(PAD_KEY) || '{}') || {}; } catch (e) {}
      var ok = function (v, m) { return typeof v === 'number' && v >= 0 && v <= m && v % 4 === 0; };
      return { comp: ok(p.comp, 64) ? p.comp : 12, cx: ok(p.cx, 32) ? p.cx : 'repack' };
    }
    // what holds what (holding.js, the engine the rules live in), bound to the map as the editor reads it now: its nodes,
    // their boxes, what each draws round its box, the paddings of Settings
    // (made again only when the map's node list or format changes; the paddings read when used)
    var hmOf;
    function hm() {
      if (hmOf && hmOf.nodes === nodes2 && hmOf.cd === !!shared.cd) return hmOf.H;
      var M = { nodes: nodes2, box: boxOf, ext: extOf, cd: !!shared.cd, get pad() { return pads().comp; }, get cx() { return pads().cx; }, get room() { return window.layout && window.layout.room; } };
      hmOf = { nodes: nodes2, cd: M.cd, H: H.make(M) };
      return hmOf.H;
    }
    // the holders grown round a change of places (holding.js grown, its rules there)
    function grown(ks, B, B0, moving, away) { return hm().grown(ks, B, B0, moving, away); }
    function extOf(k, b) {   // what node k draws round box b (its labels, units of information, a multimer's second outline), as layout.js extent() measures it for the fit's room(): [x0, y0, x1, y1]
      var L = window.layout, g = boxOf(k);
      if (!L || !L.extent) return [b[0], b[1], b[0] + b[2], b[1] + b[3]];
      var e = L.extent(nodes2[k].el);
      return [b[0] + e[0] - g[0], b[1] + e[1] - g[1], b[0] + b[2] + e[2] - g[0] - g[2], b[1] + b[3] + e[3] - g[1] - g[3]];
    }
    // yEd draws a group round what it holds with its Insets and BorderInsets (yEd's auto bounds): on a GraphML map the
    // holders of ids (and those round them) get the BorderInsets that make that box the one saved, an Insets lowered
    // where an inside member now sits closer, as the fit's room() measures it (layout.js's tidy 'fit'); an edge
    // member is left out (yEd will draw its group round it). CellDesigner and SBGN-ML files
    // keep no insets
    function refit(ids) {
      if (shared.cd || !ids.length) return;
      var want = new Set(), at = {};
      nodes2.forEach(function (n, k) { at[n.id] = k; });
      ids.forEach(function (id) { for (var u = at[id]; u != null; u = nodes2[u].up) if (nodes2[u].kids.length && nodes2[u].el.getAttribute('yfiles.foldertype') === 'group') want.add(u); });
      var t0 = shared.text;
      want.forEach(function (u) {
        var n = nodes2[u], b = boxOf(u), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        n.kids.forEach(function (k) { if (!inBox(boxOf(k), b)) return; var e = extOf(k, boxOf(k)); x0 = Math.min(x0, e[0]); y0 = Math.min(y0, e[1]); x1 = Math.max(x1, e[2]); y1 = Math.max(y1, e[3]); });
        if (x0 === Infinity) return;
        var need = [x0 - b[0], y0 - b[1] - n.lab.t, b[0] + b[2] - x1, b[1] + b[3] - y1 - n.lab.b].map(function (v, j) { return v - n.ins[j]; });
        var ins = n.ins.map(function (v, j) { return need[j] < 0 ? Math.max(v + need[j], 0) : null; }), bins = need.map(function (v) { return Math.max(v, 0); });
        insetsOf(n.id, ins, bins);
      });
      if (shared.text !== t0) parse();
    }
    function insetsOf(id, ins, bins) { setText(GE.insets(shared.text, id, ins, bins)); }   // the y:Insets (null: kept) and y:BorderInsets of node id's realizer shown, written into the text
    function setBoxes(nb) {   // boxes written into the text (node index -> [x, y, w, h]), the map read again
      var at = {};
      Object.keys(nb).forEach(function (k) { at[nodes2[+k].ag] = nb[k].map(fmt); });
      if (!Object.keys(at).length) return;
      setText(GE.boxes(shared.text, at));
      parse(); shared.dirty = true;
    }
    // the new holders after a change of places, Full editing only (holding.js regroup, its rules there)
    function regroup(how, set, B, B0) { return hm().regroup(how, set, B, B0); }
    // the new holders written into the GraphML (sbgn_edit.moveInto, the master of moving a GraphML node into another), the
    // map read again with the selection kept (by id: moveInto may reorder what a group's graph holds); then a glyph
    // dropped on a complex put into it (arg.join, the ids moved: joinPlan, create.js) and the holders grown round what
    // moved (arg.grow: the ids grown round, arg.before: every node's box before, by id, arg.moving: the ids that moved, arg.away: the drag's furthest moves, grown);
    // all in the undo step taken before. A CellDesigner file that cannot hold the change (cd_edit.nestCheck, a species
    // dropped on a complex) is not changed: refused(), nothing said. An undo while it waits stops it
    // a compartment that partly overlaps another of its holder is
    // drawn behind it when larger, in front when smaller (sbgn_edit.stack, the order in the file); not on CellDesigner maps
    function stackComps(ids) {   // in Full editing (Layout keeps the file's order), GraphML and SBGN-ML maps (sbgn_edit loaded at the start, begin)
      if (shared.cd || !full() || !sbJs || !sbJs.stack) return;
      var t2 = shared.text, at = {};
      nodes2.forEach(function (n, i) { at[n.id] = i; });
      ids.forEach(function (id) { var i = at[id]; if (i != null && nodes2[i].comp) t2 = sbJs.stack(t2, id); });
      if (t2 === shared.text) return;
      var keep = shared.selN.map(function (i) { return nodes2[i].id; }); setText(t2); parse(); shared.dirty = true;
      shared.selN = []; nodes2.forEach(function (n, i) { if (keep.indexOf(n.id) >= 0) shared.selN.push(i); });
    }
    function settle(out, arg, done, refused) {
      var moves = [], at = {};
      nodes2.forEach(function (n, i) { at[n.id] = i; });
      out.forEach(function (t, i) { moves.push([nodes2[i].id, t == null ? null : nodes2[t].id]); });
      var why = moves.length && shared.cd && cdJs && cdJs.nestCheck ? cdJs.nestCheck(shared.cd.now, moves, { doc: cdDoc(shared.cd.now) }) : null;   // the file's kept document, read only
      if (why) return refused(why);
      var jp = arg.join && arg.join.length ? joinPlan(arg.join, moves.map(function (m) { return m[0]; })) : { joins: [], why: '' };   // a glyph dropped on a complex: its member (create.js)
      if (jp.why) return refused(jp.why);
      // CellDesigner: a member that left its complex (Shift) made a species of the compartment it went to (cd_make.leave);
      // the GraphML made again from the file
      var cdLeave = function () {
        if (!shared.cd || !cdMk || !moves.some(function (m) { try { return !!cdMk.aliasInfo(shared.cd.now, m[0]).complex; } catch (err) { return false; } })) return;
        var N = cdNow(), t = N.t, t0 = t, sel = shared.selN.map(function (i) { return nodes2[i].id; });
        moves.forEach(function (m) { try { if (cdMk.aliasInfo(t, m[0]).complex) t = cdMk.leave(t, m[0], m[1]); } catch (err) { warn(String(err && err.message || err)); } });
        if (t === t0) return;
        cdRebuild(t, N.sh); parse(); shared.dirty = true;
        var ix = {}; nodes2.forEach(function (n, i) { ix[n.id] = i; });
        shared.selN = sel.filter(function (id) { return ix[id] != null; }).map(function (id) { return ix[id]; });
      };
      var rest = function () {
        cdLeave();
        var cids = joinDo(jp.joins);
        var grew = [];   // the holders grown: their boxes changed too (stacked below)
        if (arg.grow && arg.grow.length) {
          var idx = {}, mvd = {}; nodes2.forEach(function (n, i) { idx[n.id] = i; }); (arg.moving || []).forEach(function (id) { mvd[id] = 1; });
          var gb = grown(arg.grow.map(function (id) { return idx[id]; }).filter(function (i) { return i != null; }), boxOf,
            function (k) { return (arg.before && arg.before[nodes2[k].id]) || boxOf(k); }, function (k) { return !!mvd[nodes2[k].id]; }, arg.away);
          Object.keys(gb || {}).forEach(function (k) { if (nodes2[+k]) grew.push(nodes2[+k].id); });
          setBoxes(gb);
        }
        stackComps((arg.moving || []).concat(moves.map(function (m) { return m[0]; }), grew));   // compartments whose box or holder changed: the smaller in front where they partly overlap (sbgn_edit.stack)
        refit((arg.moving || []).concat(moves.map(function (m) { return m[0]; })));   // yEd's box the one saved
        done(); joinPack(cids);   // the complexes that took a member packed, in this undo step
      };
      if (!moves.length) return rest();
      var t0 = shared.text;
      sbpy().then(function (N) {
        if (shared.text !== t0) return;   // changed meanwhile (an undo): nothing written on top of it
        var t2 = shared.text, left = moves.slice();
        for (var r = 0; left.length && r <= moves.length; r++) left = left.filter(function (m) { try { t2 = N.moveInto(t2, [m]); return false; } catch (e) { return true; } });   // one put into another that leaves it later: after it
        if (left.length) { warn('Not regrouped: ' + left.map(function (m) { return m[0]; }).join(', ')); return rest(); }
        var ids = shared.selN.map(function (i) { return nodes2[i].id; }), es = shared.selE.map(function (k) { return edges2[k].id; });
        var ps = shared.selP.map(function (pi) { var k = edges2.findIndex(function (e) { return e.pts.indexOf(pi) >= 0; }); return k < 0 ? null : [edges2[k].id, edges2[k].pts.indexOf(pi)]; });
        setText(t2); parse(); shared.dirty = true; shared.part = null;
        var byN = {}, byE = {}; nodes2.forEach(function (n, i) { byN[n.id] = i; }); edges2.forEach(function (e, k) { byE[e.id] = k; });
        shared.selN = ids.filter(function (id) { return byN[id] != null; }).map(function (id) { return byN[id]; });
        shared.selE = es.filter(function (id) { return byE[id] != null; }).map(function (id) { return byE[id]; });
        shared.selP = ps.filter(function (x) { return x && byE[x[0]] != null && edges2[byE[x[0]]].pts[x[1]] != null; }).map(function (x) { return edges2[byE[x[0]]].pts[x[1]]; });
        rest();
      }).catch(function (e) { warn('Not regrouped: ' + (e && e.message || e)); rest(); });
    }
    // an edge of a compartment under the pointer (5 px on screen), or a handle of one selected, or of a node that can be
    // resized selected in the full editor (sizable, create.js: the format's part says which): which sides it moves
    function handleAt(P, only) {   // a handle of a compartment or a sizable node selected (only: sizable nodes alone)
      var hs = Math.max(HANDLE / 2, 4 / V.z), best = null;
      shared.selN.forEach(function (i) {
        if (!(only ? sizable(i) : nodes2[i].comp || sizable(i)) || best) return;
        var b = bx(i), off = 3.3, L = b[0] - off, Tp = b[1] - off, R = b[0] + b[2] + off, B = b[1] + b[3] + off;
        [[L, Tp, 'lt'], [(L + R) / 2, Tp, 't'], [R, Tp, 'rt'], [L, (Tp + B) / 2, 'l'], [R, (Tp + B) / 2, 'r'], [L, B, 'lb'], [(L + R) / 2, B, 'b'], [R, B, 'rb']].forEach(function (q) {
          if (!best && Math.abs(P[0] - q[0]) <= hs && Math.abs(P[1] - q[1]) <= hs) best = { c: i, s: q[2] };
        });
      });
      return best;
    }
    function edgeAt(P, any) {   // any: a compartment not selected too (a click on its border selects it)
      var T = 5 / V.z, best = handleAt(P);
      if (best) return best;
      nodes2.forEach(function (n, i) {
        if (!n.comp || (!any && shared.selN.indexOf(i) < 0)) return;   // a compartment selected first: a drag that moves the map never resizes one
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
      var g = function (v) { return snapOn ? Math.round(v / gridSet.step) * gridSet.step : Math.round(v); };
      if (/l/.test(s)) x0 = g(x0 + dx); if (/r/.test(s)) x1 = g(x1 + dx);
      if (/t/.test(s)) y0 = g(y0 + dy); if (/b/.test(s)) y1 = g(y1 + dy);
      // smaller than what it holds too (all inside may end up outside: allowed): in Full what no longer overlaps it is let go on release (regroup); in Layout
      // (what holds what never changes there) held where every member it overlapped still overlaps it by one unit
      if (!full()) { var kp = hm().keepMembers(d.rs.c, b, [x0, y0, x1, y1]); x0 = kp[0]; y0 = kp[1]; x1 = kp[2]; y1 = kp[3]; }
      if (x1 - x0 < 30) { if (/l/.test(s)) x0 = x1 - 30; else x1 = x0 + 30; }   // 30 at least: room for a CellDesigner compartment's two lines (12 apart on each side)
      if (y1 - y0 < 30) { if (/t/.test(s)) y0 = y1 - 30; else y1 = y0 + 30; }
      return [x0, y0, x1 - x0, y1 - y0];
    }
    function sized(d, P, free) {   // the box of a node resized by its handles (not a compartment): the sides dragged move, the
      // others stay; its width and height in multiples of Grid size (free: Alt or Ctrl held, any size), one step at least
      var b = d.rs.b0, s = d.rs.s, st = gridSet.step, dx = P[0] - d.x, dy = P[1] - d.y;
      var size = function (v) { return free ? Math.max(4, Math.round(v * 100) / 100) : Math.max(st, Math.round(v / st) * st); };
      var w = /[lr]/.test(s) ? size(b[2] + (/l/.test(s) ? -dx : dx)) : b[2], h = /[tb]/.test(s) ? size(b[3] + (/t/.test(s) ? -dy : dy)) : b[3];
      return [/l/.test(s) ? b[0] + b[2] - w : b[0], /t/.test(s) ? b[1] + b[3] - h : b[1], w, h];
    }
    // a node that holds others (a compartment; a complex with members, the only other holder a format part makes
    // resizable): resized as a holder, its parts drawn by liveDraw
    function holds(i) { return !!nodes2[i].comp || nodes2[i].kids.length > 0; }
    // a complex resized by its handles, held where its members still fit (holding.js roomy)
    function roomy(i, b, s, b0) { return hm().roomy(i, b, s, b0); }
    function pt(pi) { var p = points[pi], o = mv && mv.p.has(pi); return [num(p, 'x') + (o ? mv.dx : 0), num(p, 'y') + (o ? mv.dy : 0)]; }
    // the grey guides of a bend point moved by the keys (as in a drag, to see when a segment is level or
    // upright): one bend point selected alone, a segment drawn while it is exactly level or upright; no snapping, the
    // keys move by whole steps
    function bendGuides(bp) {
      if (bp == null) { if (shared.selP.length !== 1 || shared.selN.length || shared.selE.length) return null; bp = shared.selP[0]; }
      var k = -1, j = -1, out = [];
      edges2.forEach(function (e, i) { var at2 = e.pts.indexOf(bp); if (at2 >= 0) { k = i; j = at2 + 1; } });
      if (k < 0 || edges2[k].s == null || edges2[k].t == null) return null;
      var all = ports(k), B = all[j];
      [beyond(k, j - 1, all)[0], beyond(k, j + 1, all)[0]].forEach(function (q) { if (Math.abs(q[0] - B[0]) < 0.01 || Math.abs(q[1] - B[1]) < 0.01) out.push([B, q]); });
      out = out.concat(joinGuides(bp, B));
      return out.length ? out : null;
    }
    // a bend point moved by the keys stops where one of its segments turns level or upright, when the step would carry it
    // past (a neighbour at x.5 is never met by whole steps, so the guides would never show)
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
      shared.dirty = true;
    }
    // undo and redo keep only what changed (a whole copy of the text per step, up to 200, could reach
    // about 320 MB on the 1.6 MB mast cell GraphML). Each stack's top entry is whole, each entry below a change that
    // rebuilds it from the entry above, so nothing depends on the text now (a CellDesigner redraw, a late fit or a merged
    // nudge may change it between steps). A change: the part between the common start and end, and
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
      if (typeof d === 'string' || d.g != null) return d;   // a top entry, whole
      if (d.pg) return { g: rebuild(d.pg, from.g), b: rebuild(d.pb, from.b) };   // a CellDesigner step: each part its own change
      var mid;
      if (d.at) { mid = from.slice(d.a, from.length - d.b).split('\n'); d.at.forEach(function (i, j) { mid[i] = d.lines[j]; }); mid = mid.join('\n'); }
      else mid = d.mid;
      var t = from.slice(0, d.a) + mid + from.slice(from.length - d.b);
      if (t.length !== d.len) throw 'undo history broken';
      return t;
    }
    function sizeOf(d) { if (d.g != null) return d.g.length + d.b.length; if (d.pg) return sizeOf(d.pg) + sizeOf(d.pb); return typeof d === 'string' ? d.length : d.at ? d.lines.reduce(function (k, l) { return k + l.length + 8; }, 0) : d.mid.length; }
    // the editor's places shifted as a whole (a map moved out of negative places, a CellDesigner file made again in its own
    // places): shiftSum the sum of those shifts; the frame (x0, y0) moves with them, so nothing moves on screen. Each undo step
    // keeps the sum it was taken at (stack.rb beside the stack), and taking a step back puts the frame where that step's
    // places are drawn where they were, so an undo or redo across a shift never moves the map
    var shiftSum, tookShift;
    function __run17() {   // run at start, in order (__start)
    shiftSum = [0, 0], tookShift = null;
    }
    function rebase(dx, dy) { shiftSum = [shiftSum[0] + dx, shiftSum[1] + dy]; x0 += dx; y0 += dy; }
    // each step also keeps when it was taken (stack.ts, V.tick), so the keys undo a setting and a map's step in the order made
    function step(stack, t, fresh) {   // t whole on top; the old top a change from it; fresh: a new change (remember), not an undo or redo
      var top = stack.length - 1, rs = stack.rb || (stack.rb = []), ts = stack.ts || (stack.ts = []);
      if (rs.length !== stack.length) rs = stack.rb = stack.map(function () { return null; });   // never expected: steps without a frame are taken as they are
      if (ts.length !== stack.length) ts = stack.ts = stack.map(function () { return 0; });
      rs.push(shiftSum); ts.push(V.tick(fresh));
      if (top >= 0) { var o = stack[top]; stack[top] = typeof t === 'string' && typeof o === 'string' ? delta(t, o) : t.g != null && o.g != null ? { pg: delta(t.g, o.g), pb: delta(t.b, o.b) } : o; }
      stack.push(t);
      for (var k = 0, i = stack.length - 1; i >= 0; i--) { k += sizeOf(stack[i]); if (k > 40e6 || stack.length - i > 200) { stack.splice(0, i + 1); rs.splice(0, i + 1); ts.splice(0, i + 1); break; } }   // 200 steps or 40 million characters
    }
    function take(stack) {   // the top, whole; the one below made whole in its place
      tookShift = stack.rb && stack.rb.length === stack.length ? stack.rb.pop() : null;
      if (stack.ts && stack.ts.length === stack.length) stack.ts.pop();
      var t = stack.pop(), top = stack.length - 1;
      if (top >= 0) stack[top] = rebuild(stack[top], t);
      return t;
    }
    // on a CellDesigner map a step also keeps the file the GraphML was made from (cd.base): what the palette makes or
    // deletes changes the file itself, not only the places in the GraphML (cdcreate.js), so undo takes both back. The
    // two kept apart, { g, b }, each as its own change below the top (as one string a step on the 2 MB mast
    // cell map kept 1.7 MB)
    function undoText() { return shared.cd ? { g: shared.text, b: shared.cd.base } : shared.text; }
    function fromUndo(t) {   // the GraphML of a step, its file put back where the step kept one, its frame as it was
      if (tookShift) { x0 += tookShift[0] - shiftSum[0]; y0 += tookShift[1] - shiftSum[1]; shiftSum = tookShift; tookShift = null; }
      if (typeof t === 'string') return t;
      if (shared.cd) shared.cd.base = t.b;
      return t.g;
    }
    function unpush() { return fromUndo(take(undo)); }   // the text before the step just taken, which is taken back
    // undo and redo kept per map for the page's life: a map left keeps its history (hist, by the list's map id), given
    // back when it is opened again with its file as it was left (src), else dropped, so a step never lands on a file
    // changed elsewhere (GitHub, the folder, Restore example maps). All kept histories together at most 40 million
    // characters, the oldest let go first; the map being edited keeps its own limit (step). An SBGN-ML step holds only
    // the GraphML, the file being written from the file as opened (sb.base), so that file is kept and given back too
    var hist, histKey, openKey, histLast, edits;
    function __run18() {   // run at start, in order (__start)
    hist = {}, histKey = null, openKey = null, histLast = null, edits = 0;
    }   // edits: changes, undos and redos since this map was opened (its history may be older)
    function histKeep() {
      if (!histKey) return;
      var id = histKey; histKey = null; delete hist[id]; histLast = null;
      if (undo.length || shared.redo.length) {
        var h = hist[id] = { undo: undo, redo: shared.redo, u: undoText(), src: src(), shift: shiftSum, sbBase: shared.sb && shared.sb.base, size: 0 };
        h.size = sizeOf(h.u) + h.src.length + h.undo.concat(h.redo).reduce(function (k, d) { return k + sizeOf(d); }, 0);
        histLast = { id: id, h: h, site: site };
        var ids = Object.keys(hist), sum = ids.reduce(function (k, i) { return k + hist[i].size; }, 0);
        for (var i = 0; sum > 40e6 && i < ids.length; i++) { sum -= hist[ids[i]].size; delete hist[ids[i]]; }   // oldest first (insertion order)
      }
      undo = []; shared.redo = [];   // the kept stacks are no longer the editor's (a late layout step, Back to a file)
    }
    function histLate() {   // a redraw that ended after the map was left (a CellDesigner file follows a move once drawn): the kept history as drawn
      var L = histLast;
      if (!on && L && L.site === site && hist[L.id] === L.h) { L.h.src = src(); L.h.u = undoText(); L.h.shift = shiftSum; }
    }
    function histBack() {   // Back to a file with moves not saved: its history taken up again
      var L = histLast;
      if (!L || hist[L.id] !== L.h) return;
      delete hist[L.id]; histKey = L.id; histLast = null; undo = L.h.undo; shared.redo = L.h.redo;
    }
    function histTake(t, g0) {   // in begin: the history of the map opened, if its file is as it was left; t: the file opened, g0: its GraphML
      var id = openKey && openKey.tk === opening ? openKey.id : null, h = id && hist[id];
      openKey = null; histKey = id;
      if (!h || h.src !== t) return;   // a file not as left: its history stays until this map is left again (a newer read may match)
      delete hist[id]; histLast = null;
      try {
        if (h.sbBase && shared.sb) shared.sb.base = h.sbBase;
        var g = fromUndo(h.u);   // the editor's own text and file as they were (a CellDesigner map's GraphML and base)
        if (g !== shared.text) { setText(g); parse(); }
        undo = h.undo; shared.redo = h.redo; shiftSum = h.shift;
      } catch (e) { undo = []; shared.redo = []; if (shared.text !== g0) { setText(g0); parse(); } }
    }
    // a whole action, the one change path: nothing when t2 is the text already; else one undo step (o.merge: nudges in a
    // row one step), the text set and read again, o.then (the rest of the same action: what it writes goes through
    // setText into the same step), the selection (o.sel node ids, o.selE line ids, the rest cleared; neither given: left
    // as it is), saved and drawn. It records what changed: shared.lastChange { name, ids } (o.name, o.ids or the ids
    // selected), read by the tests. o.write in place of t2 (null): the action writes itself (a CellDesigner file made again,
    // boxes set), the caller having checked that it changes something; o.parsed: that write read the map already;
    // o.reparse: read again after o.then, which wrote more
    function commit(t2, o) {
      o = o || {};
      if (!o.write && t2 === shared.text) return false;
      remember(!!o.merge);
      if (o.write) o.write(); else setText(t2);
      if (!o.parsed) parse();
      if (o.then) o.then();
      if (o.reparse) parse();
      if (o.sel || o.selE) {
        var n = o.sel || [], e = o.selE || [];
        shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null;
        nodes2.forEach(function (q, i) { if (n.indexOf(q.id) >= 0) shared.selN.push(i); });
        edges2.forEach(function (q, k) { if (e.indexOf(q.id) >= 0) shared.selE.push(k); });
      }
      shared.dirty = true; shared.lastChange = { name: o.name || 'change', ids: [].concat(o.ids || o.sel || [], o.ids ? [] : o.selE || []) };
      if (o.quiet) quiet();
      render(); paint(); changed();
      return true;
    }
    function remember(merge) {   // the text before a change, for undo; nudges in a row are one step
      var now = Date.now();
      if (!(merge && now - nudgeAt < 800)) { step(undo, undoText(), true); shared.redo = []; }
      else if (undo.ts && undo.ts.length === undo.length && undo.length) undo.ts[undo.ts.length - 1] = V.tick(true);   // merged: the step dated by its last nudge
      nudgeAt = merge ? now : 0;
    }
    function mapTop(back) { var s = back ? undo : shared.redo; return on && V.current === map && s.length && s.ts && s.ts.length === s.length ? s.ts[s.ts.length - 1] : 0; }   // when the map's next undo (or redo) was taken; 0: none
    function back(from, to) {
      if (!from.length) return;
      var t;
      try { t = take(from); } catch (e) { from.length = 0; from.rb = []; from.ts = []; tookShift = null; warn('Undo history lost: ' + e + '.'); return; }
      clearTimeout(timer); keyDue = null; keyRun = null;   // the keys' run undone: nothing settled on top of it
      var was = undoText();
      step(to, was); setText(fromUndo(t)); shared.lastChange = { name: from === undo ? 'undo' : 'redo', ids: [] }; nudgeAt = 0; shared.cdGate = null; shared.sbBack = true; parse(); shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null; shared.dirty = true; render(); paint(); changed();
    }

    // the drawing: the renderer in the browser; the map keeps its place on screen when the drawing's edges change
    function render() {
      var t = ++ticket;
      drawing = true;
      return (shared.cd ? cdpy() : yr()).then(function (p) {
        var r;
        if (shared.cd) {   // the moves written into the CellDesigner file, drawn, and the GraphML made of it again
          var dm = drawMemo && drawMemo.cd && drawMemo.base === shared.cd.base && drawMemo.text === shared.text && drawMemo.block === gridBlock() && !undo.length ? drawMemo : null;   // drawn ahead unfitted, as the map before any change, on this Grid size's block
          var q = dm ? dm.q : cdDraw(shared.cd.base, shared.text);
          if (t !== ticket) return;
          shared.cd.now = q[1]; r = [q[0], []]; shared.cdBase = { now: q[1], text: q[2] };   // what the live drawing of a move starts from
          if (q[2] !== shared.text && !drag) {   // the same map, its new bend points (a glyph moved) now its own
            var ids = shared.selN.map(function (i) { return nodes2[i].id; }), np = points.length;
            setText(q[2]); parse();
            shared.selN = ids.map(function (id) { return nodes2.findIndex(function (n) { return n.id === id; }); }).filter(function (i) { return i >= 0; });
            if (points.length !== np) { shared.selP = []; shared.selE = []; }
          }
        } else {
          // shifted: the editor's places moved, so its frame moves with them and nothing moves on screen (taken for a new
          // frame of the drawing, the shift would make the map jump right and down, out of sight on some maps)
          // a step of its own, named 'shift' (the tests read it), inside the undo step of the change that caused it: undone
          // alone, the map would be back in negative places and shifted again by the next drawing
          var sh = !drag && noNegative();
          if (sh) { parse(); rebase(sh[0], sh[1]); var lc = shared.lastChange; shared.lastChange = { name: 'shift', ids: lc ? lc.ids : [], shift: sh, after: lc ? lc.name : null }; }
          r = drawMemo && !drawMemo.cd && drawMemo.text === shared.text && !shared.afSbgn ? drawMemo.r : drawGraphml(shared.text);   // the read-ahead drawing is never in the SBGN AF view
        }
        if (t !== ticket) return;
        drawing = false;
        showDrawing(r);
      }).catch(function (e) { if (t === ticket) { drawing = false; warn('Not drawn: ' + (e && e.message ? e.message.split('\n').slice(-2).join(' ') : e)); } });
    }
    // a drawing put in place of the picture on screen, the map kept where it is: r = [svg, warnings]. From render(),
    // or from adopt() when the picture on screen is already the editor's drawing of the file opened
    function showDrawing(r) {
        if (r[1].length) warn('Drawn with warnings: ' + r[1].join('; '));
        var svg = r[0]; lastSvg = svg; lastFor = [shared.text, shared.cd ? shared.cd.now : null, site && site.id, shared.afSbgn];   // [3]: drawn in the SBGN AF view, never kept, saved or downloaded (graphml.js)
        if (!on && site && V.kept && V.kept.id === site.id && V.kept.text != null) { V.kept.text = src(); V.kept.svg = svg; }   // left before this redraw ended: the kept file and drawing as drawn
        if (!on && site && unsaved[site.id] && unsaved[site.id].site === site) unsaved[site.id].text = src();   // the same for moves not saved
        histLate();
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
          pic.style.visibility = '';   // a drawing kept on leaving edit was hidden by the viewer while the site's picture loaded (else an empty map on going back to edit)
          var old = V.img.src || '';
          V.img.removeAttribute('id'); pic.id = 'm2-img'; pic.setAttribute('aria-label', map.title); V.img.replaceWith(pic); V.img = pic;
          if (old.indexOf('blob:') === 0) URL.revokeObjectURL(old);
          gN = {}; gE = {}; resetDrawing();
          pic.querySelectorAll('[data-n]').forEach(function (g) { gN[g.getAttribute('data-n')] = g; });
          pic.querySelectorAll('[data-e]').forEach(function (g) { var k = g.getAttribute('data-e'); (gE[k] = gE[k] || []).push(g); });
          if (shared.cd) cdSessionSoon();
          if (first) V.fit(); else V.draw();
          if (!r[1].length && !saveTimer && !saving && !shared.dirty) { if (takenIn) warn(takenIn); else quiet(); sayOpen(); takenIn = null; }   // the file changed by opening it: said in red, as a change the reader did not make
        })();
    }
    // entering edit on the picture as it is: the site's build and a reader's own map draw it as the editor does (each node
    // and line in a group of its own, render.js groups, drawText), so it is taken as the editor's drawing, nothing drawn
    // again. Any later change is drawn by render() as before
    function adopt(svg) {
      ++ticket; drawing = false;   // a redraw under way is let go
      showDrawing([svg, []]);
    }
    // an opening under way (the files read, a CellDesigner file converted) is dropped when the Edit window is left or
    // another map is opened before it is done (else leaving at once leaves edit mode on, autosave armed)
    var opening;
    function __run19() {   // run at start, in order (__start)
    opening = 0;
    }
    function start(t, n, h, s, same, g0) {   // a CellDesigner file is first made into the GraphML the editor edits; g0: an SBGN-ML map's GraphML as the build made it
      if (shared.typing) shared.typing.done(true);
      if (localTimer) local(true);   // the last move of the map before kept first, before cd and text change
      var tk = opening;
      // the new map's format is handed to begin, which writes it after resetMap: until then the map left stays whole
      if (viaGraphml(t)) {   // an SBGN-ML map (or SBML, layout only): the GraphML of its text, made from the build's (g0, read with the map)
        quiet();
        return sbpy().then(function () {
          if (tk !== opening) return;
          if (!g0) throw 'its GraphML did not load';
          var t0 = t, ed0 = edOf(t);
          if (ed0.unique) t = ed0.unique(t, g0);   // two glyphs of one id: the later renamed as the build's GraphML has it, written at the next save
          var g = sbGraphml(t, g0);
          var sb1 = { base: t, g0: g0 };
          var last = [g, edOf(t).write(t, g), sb1];   // a file whose moves could not be written back is said now, not at the first save; kept for src()
          begin(g, t, n, h, s, same, t0, { sb: sb1, sbLast: last });
        })
          .catch(function (e) { if (tk === opening) warn('Cannot edit ' + n + ': ' + e); });
      }
      if (!isCd(t)) return begin(t, t, n, h, s, same, null, {});
      quiet();
      return cdpy().then(function () {
        if (tk !== opening) return;
        // CellDesigner's open arrowhead taken in as SBGN's open triangle (cd_make sbgn): the editor works on the changed
        // text, written at the next save; the file as it was stays the site's base (what GitHub and the site hold)
        var sg = cdMk ? cdMk.sbgn(t) : { n: 0 }, t0 = t;
        if (sg.n) { t = sg.text; takenIn = sg.n + (sg.n > 1 ? ' positive influences' : ' positive influence') + ' (open arrowhead, not SBGN) made reduced physical stimulation (open triangle).'; }
        begin(cdGraphml(t), t, n, h, s, same, t0, { cd: { base: t, now: t } });
      })
        .catch(function (e) { if (tk === opening) warn('Cannot edit ' + n + ': ' + e); });
    }
    var takenIn;
    function __run20() {   // run at start, in order (__start)
    takenIn = null;
    }   // what the opening changed in the file (cd_make sbgn), said once the map is drawn
    function begin(g, t, n, h, s, same, t0, fmt) {   // same: { width, height, x0, y0, scale } of the picture on screen, drawn from this very file; t0: the file as read, where the opening changed it; fmt: the map's format ({ cd } or { sb, sbLast }; {}: GraphML)
      var was = takeMap();   // the map before, put back if this one cannot be read
      resetMap();   // every field of the map, gesture, drawing and cache lifetimes as at the start (state.js), then the new map's own
      if (fmt.cd) shared.cd = fmt.cd;
      if (fmt.sb) { shared.sb = fmt.sb; shared.sbLast = fmt.sbLast; }
      layout();   // its extent() measures what the holders grow round (extOf), at the first move
      sbpy();   // sbgn_edit quietly, on every map: its stacking (stackComps) and moveInto serve GraphML maps too
      try { setText(g); parse(); } catch (e) { putMap(was); try { parse(); } catch (e2) {} warn('Cannot edit ' + n + ': ' + e); return; }   // its moves not saved still said and kept
      siteRef = null; name = n; handle = h; site = s || null;
      t0 = t0 || t;
      if (site) { site.base = site.pending && site.pub != null ? site.pub : t0; site.fromDraft = t0 !== site.base; }   // no token: the site's text, a draft on top of it
      if (site) { site.known = site.mine ? (mine[site.id] ? mine[site.id].text : null) : V.drafts[site.id] ? V.drafts[site.id].text : null; site.clashed = false; }   // what this browser kept of the map when it was opened (local: the save clash)
      if (site && site.pending && canFolder && V.folderName()) folderCheck();
      stuck = false; undo = [];
      histTake(t, g);
      edits = 0;
      if (reSel && V.chosen && reSel.map === V.chosen.id) {   // reloaded while editing this map: its selection back
        nodes2.forEach(function (n, i) { if (reSel.n.indexOf(n.id) >= 0) shared.selN.push(i); });
        edges2.forEach(function (a, i) { if (reSel.e.indexOf(a.id) >= 0) shared.selE.push(i); });
      }
      reSel = null; reGh = null;   // used by this start or not at all
      map = { id: 'edit', title: openTitle || n, width: 0, height: 0, scale: 1, downloads: [], colours: true,   // drawn with the role classes (graphml.js, V.recolour): Settings' Map colours offered while editing
        layoutOnly: !!(V.chosen && (V.chosen.site || V.chosen).layoutOnly) };   // the map's own limit kept while editing (V.level)
      if (same) {   // editing starts on the picture as it is: no redraw, the map stays where it is
        map.width = same.width; map.height = same.height; map.scale = same.scale; x0 = same.x0; y0 = same.y0;
      }
      V.current = map; on = true; goodNow();
      if (shared.cd) plainCanvas();
      V.nodes = null; V.sel = null; V.renderInfo(); V.drawPin();
      document.getElementById('m2-title').textContent = n;
      V.grid.classList.add('m2-editing');
      buttons();
      gN = gE = null; mv = null;
      if (same && same.text === t) {
        var grouped = same.svg && same.svg.indexOf(' data-n="') >= 0;   // the editor's own drawing of this very file
        (shared.cd ? cdpy() : yr()).then(function () { if (on && V.current === map && !edits && !gN && !grouped) render(); });   // the renderer loaded quietly for the first change
        if (grouped) adopt(same.svg);
        paint(); quiet(); sayOpen(); shownWhole(); return;
      }
      quiet(); sayOpen();
      render();
      shownWhole();
    }
    function shownWhole() { if (window.m2Shown) window.m2Shown(); }   // a reload in edit mode: the page shown once editing has started, in one step
    function stop() {
      if (shared.typing) shared.typing.done(true);   // a name being typed kept on its own map first (create.js)
      if (!on) return;
      keyFlush();   // the arrow keys' last run settled on this map, not on the next one opened (its 150 ms timer)
      if (saveTimer) push();   // a move still waiting is saved now
      leftMoves = { site: site, n: undo.length };   // before histKeep, which empties undo
      var moved = undo.length > 0 || edits > 0;   // every move undone counts too: the kept picture follows the text left
      histKeep();   // its undo and redo kept for when it is opened again
      var kpic = V.img;
      if (shared.afSbgn && !shared.cd) {   // the SBGN AF view stays in the editor: the map left drawn plainly, for the viewer and what is kept
        shared.afSbgn = false;
        var pl = drawGraphml(shared.text); lastSvg = pl[0]; lastFor = [shared.text, null, site && site.id, false];
        kpic = new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(V.img); }; im.src = URL.createObjectURL(new Blob([V.recolour(pl[0])], { type: 'image/svg+xml' })); });
      }
      if (site && site.id && moved && !site.clashed)   // not atSite(): a CellDesigner map's text follows a move only once drawn; a clash's version is kept beside it
        V.kept = { sites: V.sites, id: site.id, v: site.v, sha: site.sha, pic: kpic, width: map.width, height: map.height, x0: picX0(), y0: picY0(), text: src(), svg: nowSvg(), file: name, ref: siteRef, cur: nowRef(), draft: !!site.pending && !site.mine, mine: !!site.mine };
      if (helpBox) help(false);
      on = false; drag = null; band = null; V.grid.classList.remove('m2-editing'); paint(); buttons();
      if (site && site.mine && !localTimer) V.refreshMine();   // its last version saved already: the list takes it (else local() does)
      if (shared.dirty && !site) warn(name + ' has moves not saved: Back to it, or Save.'); else quiet();
      // a site map whose last save did not go through (no connection, a GitHub error): its file kept in this page, so
      // editing it again starts from it and saves it, and said until then (else going back read GitHub's older version)
      if (site && site.id && !site.pending && !stuck && shared.dirty && token()) { unsaved[site.id] = { id: site.id, name: name, site: site, text: src() }; leftLater(unsaved[site.id]); }
      else leftSay();
      drawMemo = null; preDoc = [];   // what was read ahead for this opening, let go
      if (!keepAhead()) forget(editPre && editPre.id);   // else read afresh (a conflict, a move not saved: the repository may differ)
      aheadSoon();
    }
    // a site map left with moves not saved: said once its last save has settled (a move still drawn, a save waiting or
    // under way), its text then as saved would be; let go if that save went through or met a conflict
    function leftLater(u) {
      if (unsaved[u.id] !== u) return leftSay();
      if (on) return;   // another map opened meanwhile: kept as it is, said when that one is left
      if (drawing || saveTimer || saving) { setTimeout(function () { leftLater(u); }, 300); return; }
      if (stuck || (site === u.site && !shared.dirty)) { delete unsaved[u.id]; return leftSay(); }
      if (site === u.site) u.text = src();
      leftSay();
    }
    function leftSay() {   // out of editing: the maps still holding moves not saved, said (kept in this page only)
      var l = Object.keys(unsaved).map(function (k) { return unsaved[k].name; });
      if (!on && l.length) warn(l.join(', ') + (l.length > 1 ? ': moves' : ': the last moves') + ' not saved on GitHub. Edit ' + (l.length > 1 ? 'each' : 'it') + ' again before leaving this page to save them.');
    }
    // going back to edit at once (without this, switching back and forth waited 0.5-1.5 s, the read-ahead thrown away
    // on leaving and read again over the network, the drawing made again): what the editor holds of the site's map it
    // edited is kept as that map's read-ahead: the site's files as read before, the repository's version as this page
    // last saved it (its sha from GitHub's answer, once a save under way is done), and the editor's own drawing of it.
    // Not when a move is not saved or saving stopped. The check of GitHub just after the switch (recheck) stays
    function ghKnown(s) {   // GitHub's version of a site map as last saved (sha and text), never moves not saved; null when not known
      return stuck || !s || !s.sha || (shared.dirty && site === s) ? null : { sha: s.sha, text: s.saved || s.base };
    }
    function keepAhead() {
      var s = site, m = s && s.id ? V.byId[s.id] : null, old = editPre;
      if (!m || !old || stuck || s.pending || old.key !== preKey(m)) return false;
      var p = { key: old.key, id: old.id, path: old.path, file: old.file, img: old.img, sitePub: old.sitePub, siteFrame: old.siteFrame, base: old.base, kept: s };
      // the version as saved once a save under way is done; a save that did not go through: GitHub read afresh
      p.gh = (saving || Promise.resolve()).then(function () {
        var k = ghKnown(s);
        if (!k) throw 'not saved';
        return k;
      }).catch(function () { return ghRead(p.path); });
      p.gh.catch(function () { if (bank[p.id] === p) forget(p.id); });
      p.sitePub.catch(function () {});
      bank[p.id] = p;
      // the drawing on screen kept with it, only when it is the drawing of the text the next editing starts from: every
      // move in the text drawn, none moving; made ahead now, or once the save under way has written that very text
      var S = src(), g = shared.text, d0 = doc, el = V.img, svg = lastSvg;
      if (!(svg && !drawing && !mv && !shared.keyed && !shared.liveC && docText === g && lastFor && !lastFor[3] && lastFor[0] === g && lastFor[1] === (shared.cd ? S : null))) return true;
      var isCd = !!shared.cd, isSbm = !!shared.sb, sbG0 = shared.sb && shared.sb.g0, make = function () {
        var dm = isCd ? { cd: true, base: S, text: g, q: [svg, S, g] } : { cd: false, text: g, r: [svg, []] };
        if (isCd) cdRemember(S, g);
        else if (isSbm) sbRemember(S, g, sbG0);   // an SBGN-ML map reopened on the very GraphML it was left with
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
      if (!shared.dirty && !saving && S === (s.saved || s.base)) make();
      else p.gh.then(function (r) { if (r && r.text === S && bank[p.id] === p && !on) make(); }, function () {});
      return true;
    }
    function buttons() {
      ['#m2-ed-save', '#m2-ed-undo', '#m2-ed-redo', '#m2-ed-grid', '#m2-ed-snap', '#m2-ed-tidy-grid', '#m2-ed-tidy-pack', '#m2-ed-help'].forEach(function (k) { box.querySelector(k).disabled = !on; });   // Grid and Snap too (else they would be on while the rest waits, two states in one row)   // the layout skill's tools on both formats (a CellDesigner map through cd_edit's GraphML, its ports kept)
      box.querySelector('#m2-ed-save').hidden = !!site;   // a map of the site saves by itself
      ghForm(!!(on && site && !site.mine && !token()));
      localBox();
      box.querySelector('#m2-ed-back').hidden = on || !shared.text;
      box.querySelector('#m2-ed-back').textContent = 'Back to ' + name;
      box.querySelector('#m2-ed-stop').hidden = !on;
      var g = V.current && V.current.binned ? null : graphmlOf(V.current);   // a map in Deleted is not edited
      box.querySelector('#m2-ed-this').hidden = on || !g;
      // the Edit tab only on a map that can be edited, or while a file is being edited (no edit icon
      // for maps that cannot be edited); its window gives way to the Maps list when the tab goes
      var off = !on && !(shared.dirty && !site) && !g;
      V.grid.classList.toggle('m2-edit-off', off);
      // no map yet (the page just loaded, reloaded in edit mode): nothing to judge; another map chosen while editing:
      // judged once it is shown (left); the Edit panel on the right stays open, hidden, until a map that can be edited
      if (off && V.win === 'edit' && V.current && !shared.switching && !V.editRight) { V.win = 'list'; V.railMark(); }
    }
    function graphmlOf(m) {   // a map drawn from its own file, GraphML, CellDesigner, or a file with an editBase (SBGN-ML, SBML): that file is first in its downloads
      var d = m && m.downloads && m.downloads[0];
      return d && (d.label === 'GraphML' || d.label === 'CellDesigner' || sbMap(m)) ? d.url : null;
    }

    function save() {
      if (!shared.text) return;
      if (site) { if (site.pending) { if (localTimer) local(); } else if (token()) push(); return; }   // kept in this browser (and the folder), never GitHub
      var blob = new Blob([src()], { type: 'application/xml' });
      var done = function () { shared.dirty = false; quiet(); };
      var into = function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(done); };
      if (handle) return into(handle).catch(function (e) { warn('Not saved: ' + e.message); });
      if (window.showSaveFilePicker) {
        return window.showSaveFilePicker({ suggestedName: name, types: [shared.cd ? { description: 'CellDesigner', accept: { 'application/xml': ['.xml'] } } : shared.sb ? { description: 'SBGN-ML', accept: { 'application/xml': ['.sbgn', '.nwt'] } } : { description: 'yEd GraphML', accept: { 'application/xml': ['.graphml'] } }] })
          .then(function (h) { handle = h; name = h.name; return into(h); })
          .catch(function (e) { if (e.name !== 'AbortError') warn('Not saved: ' + e.message); });
      }
      download(); done();   // other browsers: a download
    }
    // what editing a map needs, loaded ahead while the map is only shown (the switch to edit
    // immediate and immediately functional, not only looking so): the map's own file, the frame of its drawing, with a
    // token the repository's version and its sha, the renderer and, on a CellDesigner map, the GraphML the editor edits.
    // The switch then waits for nothing. Dropped after a save (unless kept on leaving: keepAhead), after a refused save
    // and when the site's version changes.
    // Every map, not only the one shown (each brought quietly to the state after background reading,
    // nearest the map shown first, lowest priority): the files and a CellDesigner map's GraphML for every map that
    // can be edited, one map at a time once the viewer's pictures are in; the editor's drawing (the heavy part, in
    // memory) only for the map shown and its two nearest, dropped for maps further away. One entry per map in bank.
    var bank, preTimer, sweepT, openTitle, drawMemo, preDoc, editPre;
    function __run21() {   // run at start, in order (__start)
    bank = {}, preTimer = null, sweepT = 0, openTitle = null, drawMemo = null, preDoc = [], editPre = null;
    }   // drawMemo, preDoc: the drawing and documents of the map being opened
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
    // version GitHub already said is newer (else the check after the switch reopens in a loop)
    var known;
    function __run22() {   // run at start, in order (__start)
    known = {};
    }
    function ghList() {
      if (shared.ghDir && Date.now() - shared.ghDir.at < 300000) return shared.ghDir;
      shared.ghDir = { at: Date.now() };
      shared.ghDir.p = api('/contents/maps?ref=main').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!Array.isArray(d) || d.length >= 1000) return null;   // GitHub lists at most 1000 files here: then map by map
        var o = {};
        d.forEach(function (f) { o[f.path] = f.sha; });
        return o;
      }).catch(function () { return null; });
      return shared.ghDir;
    }
    function learnt(path, sha) { known[path] = { sha: sha, at: Date.now() }; }
    function blobSha(t) {   // git's sha of a text, as GitHub gives it
      var u = new TextEncoder().encode(t), h = new TextEncoder().encode('blob ' + u.length + '\0'), all = new Uint8Array(h.length + u.length);
      all.set(h); all.set(u, h.length);
      return crypto.subtle.digest('SHA-1', all).then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); });
    }
    function ghFor(path, sitePub) {
      if (!(repo() && token())) return Promise.resolve(undefined);
      if (reGh && reGh.path === path) { var r0 = reGh; reGh = null; return Promise.resolve({ sha: r0.sha, text: r0.text }); }
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
        return w ? { width: parseFloat(w[1]), height: parseFloat(w[2]), x0: t ? -parseFloat(t[1]) : 0, y0: t ? -parseFloat(t[2]) : 0, scale: 1, svg: svg } : null;   // a CellDesigner drawing: no offset; svg: taken as the editor's drawing when grouped (begin, adopt)
      }).catch(function () { return null; });
      return p.siteFrame;
    }
    var idle, lastInput, mark;
    function __run23() {   // run at start, in order (__start)
    idle = function () { return new Promise(function (res) { (window.requestIdleCallback || function (f) { setTimeout(f, 0); })(res); }); };
    // lowest priority (it never competes with anything else): a step for a map other than the
    // one shown waits until the reader has not clicked, scrolled, dragged or typed for 1.5 s, then for an idle moment.
    // A step cannot be stopped once begun (the largest, a big CellDesigner map's conversion, 80-160 ms measured
    // headless), so it starts only while the reader is reading, not moving
    lastInput = 0, mark = function () { lastInput = Date.now(); };
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (k) { document.addEventListener(k, mark, { capture: true, passive: true }); });
    document.addEventListener('pointermove', function (e) { if (e.buttons) mark(); }, { capture: true, passive: true });
    }
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
    // the edited text this page holds for a map in the viewer's keeping (a draft shown, or a drawing still ahead of the
    // site's), read without V.keep (it would load a stored drawing and replace the viewer's kept one); null: none
    function heldText(m) { var k = V.kept; return k && k.id === m.id && (k.draft || V.behind(m, k)) && k.text ? k.text : null; }
    function readyOf(p, m) {   // made again when an earlier try stopped (editing began, a newer entry)
      if (p.ready) return p.ready;
      var cdm = cdMap(m), sbm = sbMap(m), still = function () { return bank[m.id] === p && !on; };
      var r = p.ready = (cdm ? cdpy() : sbm ? sbpy() : yr()).then(function () {
        return Promise.all([heldText(m) || p.sitePub, p.gh]);
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
          p.g = cdKnown(p.t) || cdJs.graphml(p.t, null, { doc: cdDoc(p.t, V.current && V.current.id === m.id ? m.id : false) });   // a CellDesigner file made into the editor's GraphML: a step of its own (its document kept for the map shown)
          return p;
        });
      });
      r.catch(function () { if (p.ready === r) p.ready = null; });
      return r;
    }
    // the editor's own drawing of a map (each node and line in a group of its own, for live drags), made from the text
    // editing will start from, so the switch only puts it in (else 100-320 ms of
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
        return Promise.all([frameOf(p), p.sitePub]);
      }).then(function (x) {
        if (!still()) throw 0;
        // the site's picture already the editor's drawing of the text editing starts from (grouped, render.js): nothing
        // drawn again, editing takes it as it is (adopt); only its page elements made ahead, and only on a map small
        // enough for one idle moment (a larger one is put in when editing starts)
        var fr = x[0];
        if (fr && fr.svg && fr.svg.indexOf(' data-n="') >= 0 && p.t === x[1]) { dm = { cd: null, text: null, pic: null, own: fr.svg }; p.memo = dm; return waitFor(m); }
        if (cdm) dm = { cd: true, base: p.t, text: g, q: cdDraw(p.t, g, false), block: gridBlock() };
        else { var y = window.yrender.render(d2, { classes: true, groups: true, sbgn: sbMap(m) }); dm = { cd: false, text: g2, r: [y.svg, y.errors] }; }   // the renderer only reads the document
        p.memo = dm;
        return waitFor(m);
      }).then(function () {
        if (!still() || p.memo !== dm) throw 0;
        if (dm.own && dm.own.length >= 3e6) return;
        dm.rec = V.recolour(dm.own || (cdm ? dm.q[0] : dm.r[0]));   // the drawing as the page's elements, ready to put in
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
      if (!V.draftsDone()) { V.draftsIn.then(function () { setTimeout(shown, 0); }); return; }   // a draft of this map read first
      if (shared.dirty && !site && !confirm(name + ' has moves not saved. Edit this map instead?')) return;
      if (saveTimer) push();
      var tk = ++opening;
      openKey = { tk: tk, id: m.id };
      var p = ahead(m), file = m.mine ? m.file : p.file, path = p.path;
      editPre = p;   // kept on leaving (keepAhead)
      // the picture on screen is the site's drawing of its published file: its frame (size and the offset of yEd's
      // coordinates) is read from that SVG, so editing starts on it without a redraw; the moved map is drawn again
      var k = V.keep(m), shownPic = V.img;
      var published = k && k.text ? Promise.resolve(k.text) : p.sitePub;
      var frame = k ? Promise.resolve({ width: k.width, height: k.height, x0: k.x0, y0: k.y0, scale: 1 }) : frameOf(p);   // a kept drawing is drawn again (its frame carries the canvas fit's shift)
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
            siteRef = r[3] ? baseOf(isCd(r[2]) && cdJs ? cdGraphml(r[2]) : shared.sb && viaGraphml(r[2]) ? sbGraphml(r[2], shared.sb.g0) : r[2], r[3]) : null;
            map.title = m.title; document.getElementById('m2-title').textContent = m.title;
          });
        });
      };
      // the map's own file not loaded (the site's copy missing, no connection): said, not left at Opening
      var notLoaded = function (e) { if (tk === opening) warn('Cannot edit ' + m.title + ': its file did not load (' + e + ').'); };
      var fromSite = function (s) { return published.then(function (t) { return go(t, s); }).catch(notLoaded); };
      quiet();
      var w = m.mine && mine[m.id];
      if (w && w.site && !w.path) { warn('Cannot edit ' + m.title + ' yet: the site is building it (a few minutes).'); return; }   // sent by an older version: its file's sha not known
      if (w && w.site && repo() && token()) {   // on its way to the site: edited and saved there, the record kept beside (after a send of its changes under way)
        return Promise.resolve(upRun).then(function () {
          var w2 = mine[m.id];
          if (tk !== opening || !w2) return;
          return fromSite({ path: w2.path, sha: w2.sha, saved: w2.saved, mine: true }).then(function () {
            if (tk === opening && on && site && site.mine && site.id === m.id && src() !== site.saved) { shared.dirty = true; changed(); }   // moves not on GitHub yet: saved now
          });
        });
      }
      if (m.mine) return fromSite({ path: null, sha: null, pending: true, mine: true }).then(function () {   // a reader's own map: in this browser (and its folder with no token), its changes sent once connected
        if (tk === opening && on && site && site.mine && site.pending && repo() && token()) toGh(site);   // connected: sent to GitHub now
      });
      if (!repo()) return fromSite(null);
      if (!token()) return fromSite({ path: path, sha: null, pending: true });
      p.gh.then(function (g) {
        // moves of this map not saved on GitHub when editing was left: taken up again and saved, if GitHub is still at
        // the version they were made on (saved: GitHub's text, for the check of a refused save; an SBGN-ML map's edited
        // copy not made yet: none on GitHub still)
        var u = unsaved[m.id], usha = u ? u.site.sha || null : undefined;
        delete unsaved[m.id];
        if (u && (g ? g.sha : null) === usha) return go(u.text, g ? { path: path, sha: g.sha, saved: g.text } : { path: path, sha: null }).then(function () {
          if (tk !== opening) return;
          shared.dirty = true; changed(); note();
        }, notLoaded);
        var gone = function () { if (tk === opening && u) warn('The moves not saved before could not be taken up: the map changed on GitHub meanwhile. This is its version there.'); };
        if (!g && sbMap(m)) return published.then(function (t) { return go(t, { path: path, sha: null }); }).then(gone).catch(notLoaded);   // an SBGN-ML map with no edited copy yet: the first save makes it
        if (!g) return fromSite(null);   // not a map of this repository: saved as a file
        return go(g.text, { path: path, sha: g.sha }).then(function () {
          if (tk !== opening) return;
          recheck(p, g, m); gone();
        }, notLoaded);
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
        if (!edits && !shared.dirty) { on = false; editMap(m); }   // the site's map, not the editor's own (V.current is that now)
      }).catch(function () {});
    }
    // the token: pasted once, checked against the repository, kept in this browser only (localStorage)
    function __run24() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-gh-go').addEventListener('click', function () {
      var v = box.querySelector('#m2-ed-gh-token').value.trim();
      if (!v) return;
      try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { warn('This browser does not keep the token.'); return; }
      quiet();
      api('').then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (d) {
        if (!d.permissions || !d.permissions.push) throw 'it cannot write to ' + repo();
        box.querySelector('#m2-ed-gh-token').value = '';
        upAll();   // the reader's maps kept in this browser go to GitHub
        if (on && site && site.mine) { buttons(); quiet(); if (site.pending) toGh(site); return; }   // a reader's map edited: sent (or its save taken up), then saved there
        var moved = shared.dirty || !!(site && site.pending && src() !== site.pub);   // moves kept in the browser count too
        if (on && site) {   // connected while editing: go on from the repository's version, keeping the moves made
          var keep = shared.text;
          var s0 = site;   // (s0.base: the text editing started from)
          Promise.all([api('/contents/' + s0.path + '?ref=main').then(function (r) { return r.status === 404 && shared.sb ? {} : r.json(); }),   // an SBGN-ML map's edited copy not made yet: the first save makes it
            api('/contents/' + s0.path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (r) { return r.status === 404 && shared.sb ? s0.base : r.text(); })])
            .then(function (f) {
              if (!on || site !== s0) return;   // another map opened meanwhile: this one stays as kept in the browser, taken up when it is opened again (its moves never written into the map open now)
              s0.sha = f[0].sha || null; s0.pending = false; buttons();
              if (f[1] !== s0.base) { stuck = true; warn('Connected, but the map in the repository is newer than the copy opened: moves not saved, nothing overwritten. Stop editing and open the map again.'); return; }
              if (s0.id) unkeep(s0.id);   // GitHub holds the map from now on
              if (moved) { setText(keep); shared.dirty = true; push(); } else quiet();
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
      if (site && !site.pending) { site.pending = true; site.pub = site.saved || site.base; site.fromDraft = false; }   // further moves kept in this browser (else lost silently)
      buttons(); quiet();
    });
    box.querySelector('#m2-ed-this').addEventListener('click', editShown);
    }
    function gridPut(g) { Object.assign(gridSet, { shown: g.shown, snap: g.snap, step: g.step }); gridKeep(); inGrid.value = String(gridSet.step); gridButtons(); paint(); }   // an undo or redo of Grid, Snap or Grid size
    function gridDid(was) { V.setDid(gridPut, was, { shown: gridSet.shown, snap: gridSet.snap, step: gridSet.step }); }
    function gridShow() { var was = Object.assign({}, gridSet); gridSet.shown = !gridSet.shown; gridKeep(); gridButtons(); paint(); gridDid(was); }
    function gridSnap() { var was = Object.assign({}, gridSet); gridSet.snap = !gridSet.snap; gridKeep(); gridButtons(); gridDid(was); }
    var inGrid, gsMenu;
    function __run25() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-grid').addEventListener('click', gridShow);
    box.querySelector('#m2-ed-snap').addEventListener('click', gridSnap);
    inGrid = box.querySelector('#m2-ed-gsize');
    inGrid.value = String(gridSet.step);
    inGrid.addEventListener('change', function () { var was = Object.assign({}, gridSet); gridSet.step = stepOk(parseFloat(inGrid.value)); gridKeep(); inGrid.value = String(gridSet.step); paint(); gridDid(was); });
    inGrid.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') inGrid.value = String(gridSet.step); inGrid.blur(); } });
    gsMenu = null;
    }
    function gsClose() { if (gsMenu) { gsMenu.remove(); gsMenu = null; } }
    var kwBox, kwBy;
    function __run26() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-gsdrop').addEventListener('click', function (e) {
      e.stopPropagation();
      if (gsMenu) { gsClose(); return; }
      var r = inGrid.parentNode.getBoundingClientRect();
      gsMenu = document.createElement('div'); gsMenu.className = 'm2-cx m2-gs-menu'; gsMenu.setAttribute('role', 'menu');
      [4, 8, 16, 32, 64].forEach(function (v) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = String(v); b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(v === gridSet.step));
        b.addEventListener('click', function (ev) { ev.stopPropagation(); gsClose(); inGrid.value = String(v); inGrid.dispatchEvent(new Event('change')); });
        gsMenu.appendChild(b);
      });
      document.body.appendChild(gsMenu);
      var k = gsMenu.getBoundingClientRect().width / gsMenu.offsetWidth || 1;   // the page's own zoom: a fixed box is placed in its units
      gsMenu.style.left = r.left / k + 'px'; gsMenu.style.top = (r.bottom + 2) / k + 'px';
    });
    document.addEventListener('pointerdown', function (e) { if (gsMenu && !gsMenu.contains(e.target) && !e.target.closest('#m2-ed-gsdrop')) gsClose(); }, true);
    document.addEventListener('keydown', function (e) { if (gsMenu && e.key === 'Escape') { e.preventDefault(); gsClose(); } }, true);   // marked done: Escape closes the menu only
    window.addEventListener('resize', gsClose);
    gridButtons();
    // Change identity's list, for any format's part: a submenu beside its menu item (r from the viewer's menu: the item's
    // box, the menu's sides mleft and mright, by the item, shut to call on closing), each kind by its name ({ name, own,
    // go }), the own kind greyed and not a choice. A click runs go() only while the editor is still on the same map
    // and its text is unchanged since it opened (every format's change passes through text). The menu stays until a kind
    // is chosen (done closes it); Escape or the left arrow close the list alone, back on its item; another key, a click
    // outside, a scroll or a resize close it
    kwBox = null, kwBy = null;
    }
    function kwClose(back) {
      if (!kwBox) return;
      var b = kwBox; kwBox = null; b.remove();
      if (kwBy && kwBy.shut) kwBy.shut();
      if (back && kwBy && kwBy.by && kwBy.by.isConnected) kwBy.by.focus();
      kwBy = null;
    }
    function kindWindow(r, items, done) {
      kwClose();
      var t0 = shared.text, m0 = map;
      kwBox = document.createElement('div'); kwBox.className = 'm2-cx m2-ci'; kwBox.setAttribute('role', 'menu'); kwBox.setAttribute('aria-label', 'Change identity'); kwBy = r;
      items.forEach(function (q) {
        var b = document.createElement('button'); b.type = 'button';
        b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(!!q.own)); b.disabled = !!q.own;
        b.textContent = q.name;
        b.addEventListener('click', function (e) { e.stopPropagation(); kwClose(); if (done) done(); if (on && V.current === m0 && shared.text === t0) q.go(); });
        kwBox.appendChild(b);
      });
      document.body.appendChild(kwBox);
      // beside the menu, its first kind level with the item (the list's top padding and border above it), on the left
      // where the right has no room; inside the window. The page's own zoom: a fixed box is placed in its units
      var k = kwBox.getBoundingClientRect().width / kwBox.offsetWidth || 1, w = kwBox.offsetWidth * k, h = kwBox.offsetHeight * k;
      var first = kwBox.firstChild, lift = first ? first.getBoundingClientRect().top - kwBox.getBoundingClientRect().top : 0;
      var mr = r.mright != null ? r.mright : r.right, ml = r.mleft != null ? r.mleft : r.left;
      var x = mr - 2 * k + w <= V.winW() - 4 ? mr - 2 * k : ml + 2 * k - w >= 4 ? ml + 2 * k - w : V.winW() - 4 - w;
      kwBox.style.left = Math.max(4, x) / k + 'px'; kwBox.style.top = Math.max(4, Math.min(r.top - lift, V.winH() - 4 - h)) / k + 'px';
      var box = kwBox;
      kwBox.m2close = function () { if (kwBox === box) kwClose(); };
      kwBox.m2first = function () { var f = box.querySelector('button:not(:disabled)'); if (f) f.focus(); };
      return kwBox;
    }
    function subItem(f) { f.sub = true; return f; }   // a right-click item that opens its list beside the menu (the viewer keeps the menu)
    function __run27() {   // run at start, in order (__start)
    document.addEventListener('pointerdown', function (e) { if (kwBox && !kwBox.contains(e.target) && !(kwBy && kwBy.by && kwBy.by.contains(e.target))) kwClose(); }, true);
    // the list's keys, before the editor's own (arrows would also move the selection): up and down walk its kinds, Enter
    // or Space choose, Escape or the left arrow close it; another key closes it and goes on
    document.addEventListener('keydown', function (e) {
      if (!kwBox || e.key === 'Enter' || e.key === ' ' || /^(Shift|Control|Alt|Meta)$/.test(e.key)) return;
      if (!/^(ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Escape)$/.test(e.key)) { kwClose(); return; }
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.key === 'ArrowRight') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        var list = Array.prototype.slice.call(kwBox.querySelectorAll('button:not(:disabled)')), i = list.indexOf(document.activeElement), d = e.key === 'ArrowDown' ? 1 : -1;
        if (list.length) list[i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length].focus();
        return;
      }
      kwClose(true);
    }, true);
    window.addEventListener('resize', kwClose);
    document.addEventListener('scroll', function (e) { if (kwBox && !kwBox.contains(e.target)) kwClose(); }, true);
    }
    function lateItem(it) { var out = [it]; out.late = true; return out; }   // a rarely used right-click item: after the common ones, above Delete
    // the Edit tab starts editing the map shown at once; a map that
    // cannot be edited says why
    var picWait;
    function __run28() {   // run at start, in order (__start)
    picWait = false;   // the Edit window open before the map's picture is in (a reload in edit mode): started once it is
    }   // editing ends because another map was chosen (leaving): the Edit window stays
    function shown(any) {   // the Edit window open on a map: edit it, or say why not (also when another map is chosen); any: its picture failed
      if (!V.grid.classList.contains('m2-win-edit') || on) return;
      if (!any && V.img && V.img.style.visibility === 'hidden') { picWait = true; return; }   // editing starts on the picture as it is shown
      picWait = false;
      if (shared.text && shared.dirty && !site) return resume();
      if (graphmlOf(V.current)) return editShown();
      buttons();
      shownWhole();   // nothing to edit here: nothing more to wait for

    }
    function __run29() {   // run at start, in order (__start)
    document.querySelectorAll('#m2-rail .m2-ri[data-win="edit"]').forEach(function (b) { b.addEventListener('click', shown); });
    box.querySelector('#m2-ed-save').addEventListener('click', save);
    box.querySelector('#m2-ed-undo').addEventListener('click', function () { if (on && !V.setFirst(true, Math.max(mapTop(true), listTop(true))) && !listFirst(true)) back(undo, shared.redo); });   // the newest of a setting, the list's step and the map's, in the order made
    box.querySelector('#m2-ed-redo').addEventListener('click', function () { if (on && !V.setFirst(false, Math.max(mapTop(false), listTop(false))) && !listFirst(false)) back(shared.redo, undo); });
    box.querySelector('#m2-ed-stop').addEventListener('click', function () { V.win = 'list'; V.railMark(); if (V.chosen) V.put(V.chosen); else stop(); });
    }
    function resume() {   // back to a file from the computer with moves not saved
      V.current = map; on = true; V.grid.classList.add('m2-editing'); buttons(); histBack();
      document.getElementById('m2-title').textContent = map.title;
      x0 = y0 = 0; map.width = 0; render();
    }
    function __run30() {   // run at start, in order (__start)
    box.querySelector('#m2-ed-back').addEventListener('click', resume);
    }
    // silent editing (the Edit tab enters editing at once, switching to the list or elsewhere
    // leaves it): no Edit this map or Stop editing; leaving the Edit window, or closing the panel,
    // ends editing and shows the map of the site again (the edited drawing until the site catches up)
    function away() {
      if (!on) {   // an opening under way is dropped; a reopen under way (recheck) also gives the site's map back
        opening++;
        if (V.grid.classList.contains('m2-editing')) { V.grid.classList.remove('m2-editing'); buttons(); if (V.chosen) V.put(V.chosen, true); }
        return;
      }
      if (V.chosen) V.put(V.chosen, true); else stop();   // at the same place and zoom: nothing jumps
    }
    var HANDLE, BEND;
    function __run31() {   // run at start, in order (__start)
    window.addEventListener('beforeunload', function (e) { if (shared.dirty) { if (saveTimer) push(); e.preventDefault(); e.returnValue = ''; } });
    addEventListener('pagehide', function () {
      try {
        if (!(on && V.chosen)) return;
        var rec = { path: location.pathname, map: V.chosen.id,
          n: shared.selN.map(function (i) { return nodes2[i] && nodes2[i].id; }).filter(Boolean), e: shared.selE.map(function (i) { return edges2[i] && edges2[i].id; }).filter(Boolean) };
        var put = function (r) { sessionStorage.setItem('atlas-edit-sel', JSON.stringify(r)); };
        // a site map on GitHub: its version there as last saved; none while a save is waiting or under way (its sha not known yet)
        var k = site && site.path && !site.mine && !site.pending && !saving && !saveTimer ? ghKnown(site) : null;
        if (!k || typeof k.text !== 'string') return put(rec);
        try { put(Object.assign({ gh: { path: site.path, sha: k.sha, text: k.text } }, rec)); } catch (e) { put(rec); }   // too large for this tab's storage: the selection alone
      } catch (e) {}
    });

    // on screen: the selection as yEd shows it, over the drawing: a node
    // selected in a light grey with eight small black handles; an arc selected with black squares on its bend points and
    // its two ports; nothing else is drawn, so the map at rest with nothing selected looks as the original diagram
    HANDLE = 5, BEND = 5;
    }   // sizes of the handles and of the squares on an arc, in the map's units (the same)
    function sq() { return Math.max(2, BEND * V.z); }
    // line widths in the map's units too (zooming in or out keeps the relative size and thickness of
    // every mark, as the handles): as inline style, which wins over the stylesheet's width
    function sw(units) { return ' style="stroke-width:' + f1(units * V.z) + 'px"'; }
    // guides as yEd's: 1 map unit wide, as yEd's grow with the zoom, but never under 2 screen pixels,
    // so a guide zoomed out stays apart from the 1 px grid lines
    function gw() { var k = (window.devicePixelRatio || 1) * V.pz(); return ' style="stroke-width:' + Math.max(V.z, 2 / k).toFixed(2) + 'px"'; }
    function handleMarks(b, cls) {   // eight handles round box b in the map's units, so they grow and shrink with the zoom as
      // yEd's: 5 units wide, their centres 3.3 units outside the box (as measured on yEd)
      var hs = Math.max(2, HANDLE * V.z), off = 3.3 * V.z, o = '';
      var L = sx(b[0]) - off, T = sy(b[1]) - off, R = sx(b[0] + b[2]) + off, B = sy(b[1] + b[3]) + off;
      [[L, T], [(L + R) / 2, T], [R, T], [L, (T + B) / 2], [R, (T + B) / 2], [L, B], [(L + R) / 2, B], [R, B]].forEach(function (q) {
        o += '<rect class="' + cls + '" x="' + f1(q[0] - hs / 2) + '" y="' + f1(q[1] - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>';
      });
      return o;
    }
    function landMarks(Ps, Q, cls) {   // where a line's end may land (points in the map's units), as CellDesigner shows them: each place
      // a small grey square (3 units), the one it would take (Q) blue at 4 (cls: another class), on every format
      var sqr = function (q, cls, u) { var h = Math.max(u, u * V.z); return '<rect class="' + cls + '" x="' + f1(sx(q[0]) - h / 2) + '" y="' + f1(sy(q[1]) - h / 2) + '" width="' + f1(h) + '" height="' + f1(h) + '"/>'; }, o = '';
      Ps.forEach(function (q) { if (!Q || Math.hypot(q[0] - Q[0], q[1] - Q[1]) > 1e-6) o += sqr(q, 'm2-ed-place', 3); });
      return Q ? o + sqr(Q, cls || 'm2-ed-port', cls ? HANDLE : 4) : o;
    }
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
      var f = parseFloat(sh.props.inset || 0);   // inset: the shape drawn inside its box by that share of it on each side (CellDesigner's degraded 0.125)
      if (f > 0) { x += w * f; y += h * f; w *= 1 - 2 * f; h *= 1 - 2 * f; }
      var k = sh.kind, pr = sh.props, i = h * parseFloat(pr.indent || 0.25);   // indent: a hexagon's points as a share of the height (CellDesigner's phenotype 0.5)
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
      if (k === 'Tag') {   // yrender's tagShape: the point 3/8 as deep as the box across it, its way by inverse or orientation
        var o = pr.orientation, way = /^(left|right|up|down)$/.test(o || '') ? o : pr.inverse === 'true' ? 'left' : 'right', a = Math.min(h * 3 / 8, w), b2 = Math.min(w * 3 / 8, h);
        if (way === 'right') return poly([[x, y], [x + w - a, y], [x + w, y + h / 2], [x + w - a, y + h], [x, y + h]]);
        if (way === 'left') return poly([[x + a, y], [x + w, y], [x + w, y + h], [x + a, y + h], [x, y + h / 2]]);
        if (way === 'down') return poly([[x, y], [x + w, y], [x + w, y + h - b2], [x + w / 2, y + h], [x, y + h - b2]]);
        return poly([[x + w / 2, y], [x + w, y + b2], [x + w, y + h], [x, y + h], [x, y + b2]]);
      }
      return rr(x, y, w, h, 0);
    }
    function shapeD(i) {   // the outline of node i as it is drawn now, a multimer's second outline with it
      var b = shared.liveC && shared.liveC[i] ? shared.liveC[i] : bx(i), n = nodes2[i];
      // the SBGN AF view draws an activity as a sharp rectangle: its outline takes that shape
      var sh = drawnShape(i), d = outlineD(sh, b[0], b[1], b[2], b[3]);
      if (sh === n.shape && n.shape.props.mcount === '2') d = outlineD(n.shape, b[0] + 6, b[1] + 6, b[2], b[3]) + d;
      return d;
    }
    function drawnShape(i, still) {   // a node posed during a drag (live.js posed) with its way there, a tag's orientation (still: at rest)
      var p = !still && shared.poseNow && shared.poseNow[i];
      if (p && p.way) return { kind: nodes2[i].shape.kind, props: Object.assign({}, nodes2[i].shape.props, { orientation: p.way }) };
      return shared.afSbgn && AF_KINDS.test(nodes2[i].shape.kind) ? { kind: 'Macromolecule', props: { radius: '0' } } : nodes2[i].shape;
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
      if (B === bx) { so = posePort(e.s, glyphPort(e.s, so, e.id), k); to = posePort(e.t, glyphPort(e.t, to, e.id), k); }
      var pts = [[S[0] + S[2] / 2 + so[0], S[1] + S[3] / 2 + so[1]]];
      e.pts.forEach(function (pi) { pts.push(P(pi)); });
      pts.push([T[0] + T[2] / 2 + to[0], T[1] + T[3] / 2 + to[1]]);
      pts[0] = cutShape(mine && !pp.end && pp.n2 != null ? pp.n2 : e.s, pts[0], pts[1], S, B !== bx);
      pts[pts.length - 1] = cutShape(mine && pp.end && pp.n2 != null ? pp.n2 : e.t, pts[pts.length - 1], pts[pts.length - 2], T, B !== bx);
      return pts;
    }
    // where the arc from outer to its port inside node n's shape (at box b) first meets the shape outline, as the
    // renderer's visual end (so a line followed live ends where the drawing after the drop ends it, not at the box's
    // edge off a round shape); a port on the outline (within half a unit, as the renderer) counts as inside, so one on the
    // far side is reached where the line first meets the shape, never across it; the port itself when outside
    function cutShape(n, port, outer, b, still) {   // still: at rest, a pose left aside
      var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2, R = rimOf(n, b, still), q = [port[0] - cx, port[1] - cy];
      if (!inRim(R, q) && onRim(R, q).d >= 0.5) return port;
      var o = [outer[0] - cx, outer[1] - cy], best = null;
      R.forEach(function (A, i) {
        var B = R[(i + 1) % R.length], den = (q[0] - o[0]) * (B[1] - A[1]) - (q[1] - o[1]) * (B[0] - A[0]);
        if (Math.abs(den) < 1e-12) return;
        var t = ((A[0] - o[0]) * (B[1] - A[1]) - (A[1] - o[1]) * (B[0] - A[0])) / den, u = ((A[0] - o[0]) * (q[1] - o[1]) - (A[1] - o[1]) * (q[0] - o[0])) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
      });
      return best === null ? port : [outer[0] + (port[0] - outer[0]) * best, outer[1] + (port[1] - outer[1]) * best];
    }
    function livePath(pts, smooth) {   // the arc while dragged, its bends rounded as the renderer rounds them (10 units each side), so the line does not turn sharp during a drag
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
    // the lines lit by the selection (the arcs selected; on a CellDesigner map the whole reaction of a main line or glyph
    // selected, an added reactant or product alone, as CellDesigner selects them) and the glyphs lit with them
    var MAIN;
    function __run32() {   // run at start, in order (__start)
    MAIN = /^(.*)\|(a|b|r\d+|p\d+)$/;
    }
    function lit() {
      var hlE = new Set(shared.selE), glyphs = new Set();
      if (shared.cd) {
        var rx = new Set();
        shared.selE.forEach(function (k) { var m = edges2[k].id.match(/^(.*)\|[ab]$/); if (m) rx.add(m[1]); });
        shared.selN.forEach(function (i) { var m = nodes2[i].id.match(/^(.*)\|proc$/); if (m) rx.add(m[1]); });
        if (rx.size) {
          edges2.forEach(function (e, k) { var m = e.id.match(MAIN); if (m && rx.has(m[1])) hlE.add(k); });
          nodes2.forEach(function (n, i) { var m = n.id.match(/^(.*)\|proc$/); if (m && rx.has(m[1])) glyphs.add(i); });
        }
      }
      return { e: hlE, g: glyphs };
    }
    // a line's end moved on its node (on the ports' grid, gridSpot; else snapped to the centre or the middle of a
    // side): an end square of a lit line dragged; it snaps to the nearest of the five, written as the port's offset
    // from the node's centre (yEd's sx, sy or tx, ty); on a CellDesigner map cd_edit makes it CellDesigner's port
    // (none for the centre, N, S, W, E). A process glyph's main lines are not moved this way; a modifier's end there goes round it (procSpots)
    function partSel() { return shared.part && !shared.selN.length && !shared.selP.length && shared.selE.indexOf(shared.part.k) >= 0 ? shared.part : null; }   // the part of a line selected alone that the keys move (marked)
    function markSize() { return Math.max(1.5, 4 * V.z); }   // the four marks round a selected bend point or end, in screen px
    function markReach() { return markSize() + Math.max(1, 2 * V.z) / 2; }   // from their centre to their outer edge
    function portAt(P) {
      // a line selected alone: its ends taken anywhere within the square their four marks cover (the end pressed before
      // first), so a press a little off an end never falls on the node and begins a new line from it; the line's own
      // bend point under the press keeps the press
      var R = 6 / V.z, L = lit(), best = null, dB = R, ps = partSel(), wide = !shared.selN.length && !shared.selP.length, hp = wide && L.e.size && hit(P);
      L.e.forEach(function (k) {
        var e = edges2[k];
        if (e.s == null || e.t == null || !e.path) return;
        var all = ports(k);
        [[0, e.s], [all.length - 1, e.t]].forEach(function (q, end) {
          if (shared.cd && /\|proc$/.test(nodes2[q[1]].id) && !procSpots({ k: k, end: end, n: q[1] })) return;   // a glyph's main lines stay
          var d = Math.hypot(all[q[0]][0] - P[0], all[q[0]][1] - P[1]), hb = !!hubEnd(k, end), b = hb && bx(q[1]);   // an end at a process's or gate's port goes with the process, or to another node
          if (hb && P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3]) return;   // a press on the process itself moves the process
          var sq = Math.max(Math.abs(all[q[0]][0] - P[0]), Math.abs(all[q[0]][1] - P[1])) * V.z;
          if (wide && shared.selE.indexOf(k) >= 0 && !(hp && hp.e === k && hp.p != null) && sq <= markReach() + 2)
            d = ps && ps.port && ps.k === k && ps.port.end === end ? 0 : sq / 1e4;   // within the marks' square: before any plain hit, the nearest end
          if (d <= dB) { dB = d; best = { k: k, end: end, n: q[1], to: null, hub: hb }; }
        });
      });
      return best;
    }
    // a modifier's end at a CellDesigner process glyph: CellDesigner's six places, its corners and the
    // middles of the two sides off the main line, turned with the line (no centre, nothing on the line itself; cd_edit
    // writes targetLineIndex from the place's number, spot on the path: 2 to 7 in this order, cdrender's SQUARE); null
    // for any other end
    function procSpots(pp) { return pp.end && /\|m\d+$/.test(edges2[pp.k].id) ? procPlaces(pp.n) : null; }
    function procPlaces(n) {   // the six places round process glyph n, from its centre (cdcreate.js's landing too); null for any other node
      var m = shared.cd && nodes2[n].id.match(/^(.*)\|proc$/);
      if (!m) return null;
      var ka = edges2.findIndex(function (e) { return e.id === m[1] + '|a'; });
      if (ka < 0) return null;
      var p = ports(ka), A = p[p.length - 2], C = p[p.length - 1], L = Math.hypot(C[0] - A[0], C[1] - A[1]), h = bx(n)[2] / 2;
      if (!L) return null;
      var f = [(C[0] - A[0]) / L, (C[1] - A[1]) / L];
      return [[0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (s) { return [h * (s[0] * f[0] - s[1] * f[1]), h * (s[0] * f[1] + s[1] * f[0])]; });
    }
    // a process or logic gate as one object with its two ports (as in yEd, as if yEd's SBGN palette
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
    function hubPorts() {   // the ports as the renderer draws them, per node id: [port one, port two, anything coming in]
      if (!shared.hpMemo || shared.hpMemo[0] !== shared.text) shared.hpMemo = [shared.text, window.yrender.render(docText === shared.text ? doc : shared.text, {}).ports];   // the editor's own drawing sets it (drawGraphml): this only before it
      return shared.hpMemo[1];
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
          var L = Math.abs(o[0]) >= Math.abs(o[1]) ? Math.abs(o[0]) - b[2] / 2 : Math.abs(o[1]) - b[3] / 2, port = L > 0.5 && Math.min(Math.abs(o[0]), Math.abs(o[1])) <= 0.5;
          // turned round the centre and put on the side it turns to: a port at the same antenna, any other end scaled
          // to the box (a glyph not square keeps an end on its side on a side)
          list.push({ k: k, end: end, to: port ? (Math.abs(o[0]) >= Math.abs(o[1]) ? [0, Math.sign(o[0]) * (b[3] / 2 + L)] : [-Math.sign(o[1]) * (b[2] / 2 + L), 0]) : [-o[1] * b[2] / b[3], o[0] * b[3] / b[2]] });
        });
      });
      if (list.length) setPorts(list);
    }
    function placesOf(pp) {   // the places an end may take at node pp.n (portOn's choice), as offsets from its centre; null on the ports' grid (any point of it)
      if (nodes2[pp.n].hub && !(MODS.test(edges2[pp.k].arr[1]) && pp.end) && window.yrender && hubPorts()[nodes2[pp.n].id]) return null;   // a process's or gate's own port: the one place
      var N = nodePlaces(pp.n);
      return procSpots(pp) || hubSides(pp) || (N && [[0, 0]].concat(N)) || (lineGrid() ? null : fivePlaces(pp.n));
    }
    function fivePlaces(n) { var b = bx(n); return [[0, 0], [0, -b[3] / 2], [0, b[3] / 2], [-b[2] / 2, 0], [b[2] / 2, 0]]; }   // the centre and the sides' middles
    function spot(pp, P, free) {   // the end's place on its node as an offset from its centre: a glyph's six, the ports' grid (free: anywhere, gridSpot), else the nearest of the node's places (nodePlaces) or five
      var b = bx(pp.n), c = [b[0] + b[2] / 2, b[1] + b[3] / 2], S = procSpots(pp) || hubSides(pp), N = S ? null : nodePlaces(pp.n), F = null;
      if (!S && lineGrid()) return gridSpot(pp.n, [P[0] - c[0], P[1] - c[1]], free);
      if (N && nodeCentre(pp.n, P)) return [0, 0];
      // at a glyph a tie (a drop on its centre) goes to the side facing the modifier: the point
      // before the end weighs in a little
      if (S) { var all = ports(pp.k); F = all[all.length - 2]; }
      var cost = function (o) { var q = [c[0] + o[0], c[1] + o[1]]; return Math.hypot(q[0] - P[0], q[1] - P[1]) + (F ? 1e-3 * Math.hypot(q[0] - F[0], q[1] - F[1]) : 0); };
      return (S || N || fivePlaces(pp.n)).reduce(function (m, o) { return cost(o) < cost(m) ? o : m; });
    }
    // ---- ports on the line grid (where the format's part says so: lineGrid), as offsets from the node's centre ----
    // Inside the shape a grid of the line step (lineStep) from the centre. On the outline the port stays on it, and the coordinate on the grid
    // is the axis the outline runs closer to there (x on a top or bottom side, y on a left or right side; on a curve
    // switching where it runs at 45 degrees); the other is read from the outline. A run of one axis ends at that switch or
    // at a corner. The outline is the drawn one (outlineD), flattened into a polygon with the 45 degree points kept.
    var rimMemo;
    function __run34() {   // run at start, in order (__start)
    rimMemo = new Map();
    }
    function rim(n) { return rimOf(n, bx(n)); }   // node n's outline round its centre, a closed polygon
    function rimOf(n, b, still) {   // the same at box b
      var sh = drawnShape(n, still), key = sh.kind + JSON.stringify(sh.props) + '|' + b[2] + '|' + b[3], R = rimMemo.get(key);
      if (!R) { R = flatten(outlineD(sh, -b[2] / 2, -b[3] / 2, b[2], b[3])); if (rimMemo.size > 200) rimMemo.clear(); rimMemo.set(key, R); }
      return R;
    }
    function flatten(d) {   // an outline path (M, L, h, v, Q, A, Z, absolute but h and v) as points; curves fine, with their 45 degree points
      var tk = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [], i = 0, P = [], cur = [0, 0], st = [0, 0], c = '';
      var n = function () { return parseFloat(tk[i++]); }, same = function (a, q) { return Math.abs(a[0] - q[0]) < 1e-9 && Math.abs(a[1] - q[1]) < 1e-9; };
      var add = function (q) { if (!P.length || !same(P[P.length - 1], q)) P.push(q); cur = q; };
      var inside = function (ts) { return ts.filter(function (t) { return t > 0 && t <= 1; }).sort(function (x, y) { return x - y; }); };
      while (i < tk.length) {
        if (/[a-zA-Z]/.test(tk[i])) c = tk[i++];
        if (c === 'M') { st = [n(), n()]; add(st); }
        else if (c === 'L') add([n(), n()]);
        else if (c === 'h') add([cur[0] + n(), cur[1]]);
        else if (c === 'v') add([cur[0], cur[1] + n()]);
        else if (c === 'Q') {
          var q0 = cur, q1 = [n(), n()], q2 = [n(), n()], a = [q1[0] - q0[0], q1[1] - q0[1]], e = [q2[0] - q1[0], q2[1] - q1[1]], ts = [];
          [1, -1].forEach(function (sg) { var den = (e[0] - a[0]) - sg * (e[1] - a[1]); if (Math.abs(den) > 1e-12) ts.push(-(a[0] - sg * a[1]) / den); });
          for (var k = 1; k <= 24; k++) ts.push(k / 24);
          inside(ts).forEach(function (t) { var u = 1 - t; add([u * u * q0[0] + 2 * u * t * q1[0] + t * t * q2[0], u * u * q0[1] + 2 * u * t * q1[1] + t * t * q2[1]]); });
        } else if (c === 'A') {
          var rx = n(), ry = n(); n(); var fa = n(), fs = n(), p2 = [n(), n()], p1 = cur;
          var dx = (p1[0] - p2[0]) / 2, dy = (p1[1] - p2[1]) / 2, lam = dx * dx / (rx * rx) + dy * dy / (ry * ry);
          if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
          var co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx) / (rx * rx * dy * dy + ry * ry * dx * dx)));
          var cxp = co * rx * dy / ry, cyp = -co * ry * dx / rx, cx = cxp + (p1[0] + p2[0]) / 2, cy = cyp + (p1[1] + p2[1]) / 2;
          var t1 = Math.atan2((dy - cyp) / ry, (dx - cxp) / rx), dt = Math.atan2((-dy - cyp) / ry, (-dx - cxp) / rx) - t1;
          if (fs && dt < 0) dt += 2 * Math.PI; if (!fs && dt > 0) dt -= 2 * Math.PI;
          var m = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 180))), th = [], t0 = Math.atan(ry / rx);
          for (var k2 = 1; k2 <= m; k2++) th.push(k2 / m);
          for (var j = -4; j <= 4; j++) [t0, -t0].forEach(function (x) { th.push((x + j * Math.PI - t1) / dt); });
          inside(th).forEach(function (f) { var t = t1 + f * dt; add([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); });
          add(p2);
        } else if (c === 'Z' || c === 'z') add(st);
        else i++;
      }
      if (P.length > 1 && same(P[0], P[P.length - 1])) P.pop();
      return P;
    }
    function keyAx(v) { return Math.abs(v[0]) >= Math.abs(v[1]) ? 0 : 1; }   // the axis a piece of outline runs closer to
    function gridNext(v, s, g) { var e = 0.02 / g; return s > 0 ? (Math.floor(v / g + e) + 1) * g : (Math.ceil(v / g - e) - 1) * g; }   // within 0.02 of a grid value counts as on it (offsets kept to two decimals)
    function dec2(q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; }
    function onRim(R, o) {   // the outline's point nearest o: its segment j (R[j] to R[j+1]), the point, the distance
      var best = { d: Infinity };
      R.forEach(function (p, j) {
        var q = R[(j + 1) % R.length], v = [q[0] - p[0], q[1] - p[1]], L = v[0] * v[0] + v[1] * v[1];
        var t = L ? Math.max(0, Math.min(1, ((o[0] - p[0]) * v[0] + (o[1] - p[1]) * v[1]) / L)) : 0, X = [p[0] + t * v[0], p[1] + t * v[1]], d = Math.hypot(X[0] - o[0], X[1] - o[1]);
        if (d < best.d) best = { d: d, j: j, pt: X };
      });
      return best;
    }
    function inRim(R, o) {
      var inn = false;
      for (var i = 0, j = R.length - 1; i < R.length; j = i++) {
        var a = R[i], b = R[j];
        if ((a[1] > o[1]) !== (b[1] > o[1]) && o[0] < (b[0] - a[0]) * (o[1] - a[1]) / (b[1] - a[1]) + a[0]) inn = !inn;
      }
      return inn;
    }
    // from loc along the outline one way (di 0: in the polygon's order, 1: against it) while it runs closer to one axis A
    // (given with its sign s, or null: the axis of the piece ahead): the point where A reaches its next grid value, else
    // the run's end; null when no run goes that way from here
    function walk(R, loc, di, A, s, g) {
      var N = R.length, p = loc.pt, moved = false;
      for (var m = 0; m < N; m++) {
        var q = di ? R[((loc.j - m) % N + N) % N] : R[(loc.j + 1 + m) % N], w = [q[0] - p[0], q[1] - p[1]];
        if (Math.hypot(w[0], w[1]) < 0.05) { p = q; continue; }   // a piece within rounding of the start (an offset kept to two decimals)
        if (A == null) { A = keyAx(w); s = Math.sign(w[A]); }
        if (keyAx(w) !== A || Math.sign(w[A]) !== s) break;
        var v = gridNext(loc.pt[A], s, g);
        if ((q[A] - v) * s >= -1e-9) { var t = (v - p[A]) / w[A], X = [p[0] + t * w[0], p[1] + t * w[1]]; X[A] = v; return X; }
        p = q; moved = true;
      }
      return moved && Math.hypot(p[0] - loc.pt[0], p[1] - loc.pt[1]) > 0.05 ? p : null;
    }
    function along(R, loc, A, s, g) {   // walk with coordinate A going toward s, whichever way round that is: { to, di } or null
      for (var di = 0; di < 2; di++) { var X = walk(R, loc, di, A, s, g); if (X) return { to: X, di: di }; }
      return null;
    }
    // an arrow key on a port at offset o (d: the arrow; g: the step): { to, di } or null. Inside, a grid step, stopping on
    // the outline where the line along the arrow meets it. On the outline, along it as the arrow points (along), else one
    // step inward, outward nothing; round (di given: the same key again), on round the outline that way past every run's end
    function portStep(n, o, d, g, round) {
      var R = rim(n), A = d[0] ? 0 : 1, s = Math.sign(d[A]), loc = onRim(R, o), t = o.slice();
      if (loc.d > 0.05 && !inRim(R, o)) return { to: dec2(loc.pt) };   // outside (a node resized smaller): onto the outline first
      if (loc.d > 0.05) {
        t[A] = gridNext(o[A], s, g);
        if (inRim(R, t) && onRim(R, t).d > 0.05) return { to: dec2(t) };
        var hit = null;   // where the line from o along the arrow leaves the shape
        R.forEach(function (p, j) {
          var q = R[(j + 1) % R.length], B = 1 - A;
          if ((p[B] - o[B]) * (q[B] - o[B]) > 0 || p[B] === q[B]) return;
          var X = p[A] + (q[A] - p[A]) * (o[B] - p[B]) / (q[B] - p[B]);
          if ((X - o[A]) * s > 1e-9 && (hit == null || (X - hit) * s < 0)) hit = X;
        });
        if (hit == null) return null;
        t[A] = hit; return { to: dec2(t) };
      }
      if (round != null) { var X = walk(R, loc, round, null, 0, g); return X ? { to: dec2(X), di: round } : null; }
      var r = along(R, loc, A, s, g);
      if (r) return { to: dec2(r.to), di: r.di };
      var probe = loc.pt.slice(); probe[A] += s * 0.5; t = loc.pt.slice(); t[A] = gridNext(t[A], s, g);
      return inRim(R, probe) && inRim(R, t) && onRim(R, t).d > 0.05 ? { to: dec2(t) } : null;
    }
    // a port dragged to offset q: onto the outline within 3 px of it or outside (its grid coordinate on the grid), else
    // the nearest grid point inside; free (Alt or Ctrl): where it is, inside or on the outline
    function gridSpot(n, q, free) {
      var R = rim(n), loc = onRim(R, q), inn = inRim(R, q);
      if (free) return dec2(inn ? q : loc.pt);
      if (inn && loc.d > 3 / V.z) {   // inside: the nearest grid point inside the shape (the rounded one may lie outside, near a curve)
        var PG = lineStep(), x0 = Math.floor(q[0] / PG) * PG, y0 = Math.floor(q[1] / PG) * PG, best = null, bd = Infinity;
        [0, PG].forEach(function (dx) { [0, PG].forEach(function (dy) {
          var g = [x0 + dx, y0 + dy], d = Math.hypot(g[0] - q[0], g[1] - q[1]);
          if (d < bd && inRim(R, g) && onRim(R, g).d > 0.05) { bd = d; best = g; }
        }); });
        if (best) return best;
      }
      var PG = lineStep(), p = loc.pt, j = loc.j, w = [R[(j + 1) % R.length][0] - R[j][0], R[(j + 1) % R.length][1] - R[j][1]], A = keyAx(w), v = Math.round(p[A] / PG) * PG;
      if (Math.abs(v - p[A]) < 1e-6) return dec2(p);
      var r = along(R, loc, A, Math.sign(v - p[A]), PG);
      return dec2(r ? r.to : p);
    }
    function spotNo(pp, to) {   // the number of the glyph's place at offset to (procSpots' order), null off a glyph
      var S = procSpots(pp), best = null, bd = Infinity;
      if (S) S.forEach(function (o, i) { var d = Math.hypot(o[0] - to[0], o[1] - to[1]); if (d < bd) { bd = d; best = i + 2; } });
      return best;
    }
    // an end moved to another node (to any node that can take it): an end square dragged off its node goes, on release, to the node under the pointer that can take it,
    // lit while the pointer is over it, else back where it was (on the ports' grid: on its own outline, aim). SBGN's rules: an arc goes from or
    // to a complex, never a member inside it (the complex takes the end); a logic gate takes only the one
    // arrowhead-less line, a consumption at a process and an input at a gate alike, and its modulations leave from it.
    // GraphML, SBGN-ML and CellDesigner maps: on a CellDesigner map
    // an end at a species goes to another species or complex, never the process glyph's end, and cd_edit rewrites the
    // reaction's participant in every place the file keeps it
    var EPN, MODS;
    function __run35() {   // run at start, in order (__start)
    EPN = /^(Macromolecule|SimpleChemical|Complex|NucleicAcidFeature|UnspecifiedEntity|EmptySet|PerturbingAgent)$/;
    MODS = /^(white_circle|white_delta|white_delta_bar|t_shape|crows_foot_one|white_diamond)$/;
    }
    function roleOf(i) {   // 'epn', 'proc', 'gate', 'pheno', 'tag' (a tag or a submap's terminal), or null (a compartment, a member inside a complex, a decoration)
      var n = nodes2[i];
      if (n.comp || (n.up != null && !nodes2[n.up].comp)) return null;
      if (n.hub) return n.shape.kind === 'Operator' ? 'gate' : 'proc';
      return EPN.test(n.shape.kind) ? 'epn' : n.shape.kind === 'Phenotype' ? 'pheno' : n.shape.kind === 'Tag' ? 'tag' : null;
    }
    function takes0(k, end, i) {   // whether node i can take that end of arc k (its own node aside)
      // moving an end to another node changes the network: full editing only (Settings, Editing)
      if (V.level !== 'full') return false;
      var e = edges2[k], a = e.arr, other = end ? e.s : e.t, r = roleOf(i), ro = roleOf(other);
      var hub = function (x) { return x === 'proc' || x === 'gate'; };
      if (shared.cd) {   // a reaction's end at a species, to another species or complex (no member, no compartment, no glyph or gate, none
        // the reaction has already); its other end at a species or at the reaction's glyph, never a gate's line (cd_edit rewire)
        var nd = nodes2[i], here = end ? e.t : e.s, proc = function (x) { return /\|(proc|g\d*)$/.test(nodes2[x].id); }, rid = e.id.slice(0, e.id.lastIndexOf('|') + 1);
        if (edges2.some(function (f) { return f.id.indexOf(rid) === 0 && (f.s === i || f.t === i); })) return false;
        return !proc(here) && !/\|g\d*$/.test(nodes2[end ? e.s : e.t].id) && !proc(i) && !nd.comp && !(nd.up != null && !nodes2[nd.up].comp);
      }
      if (i === other || (!r && !(hybOn() && nodes2[i].shape.kind === 'Submap')) || a[0] !== 'none') return false;
      var tg = roleOf(e.s) === 'tag' ? e.s : roleOf(e.t) === 'tag' ? e.t : null;
      if (a[1] === 'none' && tg != null) return (end ? e.t : e.s) !== tg && r === 'epn';   // a tag's or terminal's equivalence arc: its entity end to another entity, the tag's end stays (SBGN only; the table's tagRoom)
      if (a[1] === 'none') {   // the arrowhead-less line: its hub end at a process or gate, its other end at an entity (or a gate into a gate)
        if (!hub(roleOf(e.s)) && !hub(roleOf(e.t))) return false;   // a plain line between other glyphs (an equivalence arc): not this line
        var h = hub(roleOf(e.t)) ? 1 : 0;
        return end === h ? hub(r) && !(r === 'proc' && ro === 'gate') : r === 'epn' || r === 'gate' || r === 'pheno';   // which of these the line may join: the rules table (create.js moveSays)
      }
      if (a[1] === 'delta') return hub(roleOf(end ? e.t : e.s)) ? r === 'proc' : r !== 'proc';   // a production: its process end stays on a process
      return MODS.test(a[1]);   // a modulation: either end, the rules table says onto what (create.js moveSays)
    }
    function takes(k, end, i) {   // takes0, and the rules table for the line as it would be (create.js moveSays)
      return takes0(k, end, i) && !moveSays(k, end, i);
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
    function portOn(pp, i, P, free) {   // the end's place at node i from its centre: at a process or gate the port its line takes, else spot's (a modifier: one of the two sides)
      var b = bx(i), e = edges2[pp.k], H = nodes2[i].hub && window.yrender && hubPorts()[nodes2[i].id];
      if (!H || (MODS.test(e.arr[1]) && pp.end)) return spot({ k: pp.k, end: pp.end, n: i }, P, free);
      var q = pp.end || (e.arr[1] === 'none' && !nodes2[e.t].hub) ? H[0] : H[1];   // into port one, or out of port two
      return [q[0] - b[0] - b[2] / 2, q[1] - b[1] - b[3] / 2];
    }
    function aim(pp, P, free) {   // the dragged end's next place: on its own node, on a node that takes it, or free at the pointer (Alt or Ctrl, a process's port, or off the ports' grid)
      var i = takerAt(pp, P), b;
      pp.n2 = null; pp.free = false;
      if (i == null && !pp.hub && !free && lineGrid()) i = pp.n;   // on the ports' grid, over nothing that takes it: on its own outline, nearest the pointer
      if (i === pp.n) { pp.to = pp.hub ? null : spot(pp, P, free); return; }   // an end at a port stays with its process
      if (i != null) { pp.n2 = i; pp.to = portOn(pp, i, P, free); return; }
      b = bx(pp.n); pp.free = true; pp.to = [P[0] - b[0] - b[2] / 2, P[1] - b[1] - b[3] / 2];
    }
    function reconnect(pp) {   // the end of arc pp.k put on node pp.n2 at offset pp.to, one undo step; the line's end square no longer pressed
      shared.part = null; shared.frozen = true;   // the copy stays until the map is drawn again (no flash of the old line)
      setPorts([pp], { k: pp.k, att: pp.end ? 'target' : 'source', id: nodes2[pp.n2].id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') });
    }
    function setPort(pp, merge) { setPorts([pp], null, merge); }
    function setPorts(list, re, merge) {   // ends of lines put at their offsets (pp: k, end, to), one undo step (merge: a key's steps in a row one step); re: { k, att, id }, that edge's source or target set too
      var all = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Path')), by = new Map();
      if (re && (shared.text.match(/<edge\b[^>]*>/g) || []).length !== edges2.length) { shared.frozen = false; warn('The line could not be moved to another node: the file is not read edge for edge.'); unshift(); paint(); return; }
      list.forEach(function (pp) {
        var e = edges2[pp.k], a = pp.end ? ['tx', 'ty'] : ['sx', 'sy'], no = spotNo(pp, pp.to), vals = [fmt(pp.to[0]), fmt(pp.to[1])];
        if (no) { a = a.concat('spot'); vals.push(String(no)); }
        if (!re && Math.abs((num(e.path, a[0]) || 0) - pp.to[0]) < 0.01 && Math.abs((num(e.path, a[1]) || 0) - pp.to[1]) < 0.01) return;
        var nth = all.indexOf(e.path);
        by.set(nth, (by.get(nth) || []).concat(a.map(function (k, j) { return [k, vals[j]]; })));
      });
      if (!by.size) { unshift(); paint(); return; }
      remember(!!merge);
      setText(GE.ends(shared.text, by, re));
      parse(); shared.dirty = true; render(); paint(); changed();
    }
    function paint() {
      palShow();
      if (V.img && V.img.querySelectorAll) {
        V.img.querySelectorAll('.m2-ed-blue').forEach(function (x) { x.classList.remove('m2-ed-blue'); });
      }
      gridPaint();
      if (!on || V.current !== map) { overlay.innerHTML = ''; return; }
      var out = [], over = [];
      var pk0 = liveLines(out);   // the arcs following a move (live.js)
      // arcs selected, or holding a bend point selected: drawn blue, then their bends as squares on top
      // a bend point selected alone, the arc not highlighted (as yEd): four small black squares round
      // the point, the lines through it seen in the gap between them (measured on yEd: squares 4 units, gap 2 units)
      shared.selP.forEach(function (pi) {
        if (shared.selE.some(function (k) { return edges2[k].pts.indexOf(pi) >= 0; })) return;
        var q = pt(pi), a = markSize(), g = markReach() - a, X = sx(q[0]), Y3 = sy(q[1]);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(c[0] < 0 ? X - g - a : X + g) + '" y="' + f1(c[1] < 0 ? Y3 - g - a : Y3 + g) + '" width="' + f1(a) + '" height="' + f1(a) + '"/>');
        });
      });
      // an arc selected (as yEd): black squares on its bend points and on its two ports, where it starts
      // and ends (often in the middle of a node); and drawn blue (below). On a CellDesigner map a
      // reaction is one item, as in CellDesigner: a click on its main line (reactant to glyph to
      // product) or its glyph lights it all up; an added reactant or product, or a modifier, stays on its own
      var L = lit(), hlE = L.e, glyphs = L.g, main = MAIN;
      // a line selected is drawn blue itself, in CellDesigner's selection blue, on GraphML and CellDesigner maps alike
      // (no blue band under the line): its
      // own group (a CellDesigner line's, not its white halo's), or the copy following a move; a glyph lit the same.
      // Before the editor's drawing is in the page, a thin blue line over the map
      var blueG = function (g) {
        var cs = shared.copies.filter(function (c) { return c[1] === g; });
        if (cs.length) cs.forEach(function (c) { if (c[0].classList) c[0].classList.add('m2-ed-blue'); }); else g.classList.add('m2-ed-blue');   // a line drawn in more pieces: the pieces after the first stand in as empty comments (graphml.js yLines)
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
        var all = ports(k, pk0), grouped = shared.cd && main.test(e.id);   // a reaction's own lines: no squares in its glyph
        var pj = !drag && shared.part && shared.part.k === k && !shared.selN.length && !shared.selP.length ? (shared.part.port ? (shared.part.port.end ? all.length - 1 : 0) : e.pts.indexOf(shared.part.p) + 1) : -1;
        all.forEach(function (q, j) {
          var sqAt = function (n) { return glyphs.has(n) || /\|proc$/.test(nodes2[n].id); };   // an end at the reaction's square stays (portAt): no square drawn there
          if (grouped && ((j === 0 && sqAt(e.s)) || (j === all.length - 1 && sqAt(e.t)))) return;
          if (j === pj) return;   // the part the keys move: its four squares alone (below)
          if (drag && drag.port && drag.port.to && drag.port.k === k && j === (drag.port.end ? all.length - 1 : 0)) return;   // the end dragged: its landing marks alone (below)
          over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(sx(q[0]) - sq() / 2) + '" y="' + f1(sy(q[1]) - sq() / 2) + '" width="' + f1(sq()) + '" height="' + f1(sq()) + '"/>');
        });
      });
      // the part of the line the keys move: four small squares round it, as a bend point selected alone
      var pt1 = !drag ? partSel() : null;
      if (pt1) {
        var qa = ports(pt1.k), Q = pt1.port ? qa[pt1.port.end ? qa.length - 1 : 0] : pt(pt1.p);
        var a1 = markSize(), g1 = markReach() - a1, X1 = sx(Q[0]), Y1 = sy(Q[1]);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(c[0] < 0 ? X1 - g1 - a1 : X1 + g1) + '" y="' + f1(c[1] < 0 ? Y1 - g1 - a1 : Y1 + g1) + '" width="' + f1(a1) + '" height="' + f1(a1) + '"/>');
        });
      }
      if (drag && drag.port && drag.port.to) {   // the end's places on the node it would land on, the one it takes filled
        var pk = drag.port, n0 = pk.n2 != null ? pk.n2 : pk.n, b0 = bx(n0), c0 = [b0[0] + b0[2] / 2, b0[1] + b0[3] / 2];
        var at0 = function (o) { return [c0[0] + o[0], c0[1] + o[1]]; };
        // free at the pointer (no node takes it): the plain end square, with a modifier's places at its own glyph still shown
        over.push(pk.free ? landMarks((procSpots(pk) || hubSides(pk) || []).map(at0), null) + landMarks([], at0(pk.to), 'm2-ed-handle')
          : landMarks((placesOf({ k: pk.k, end: pk.end, n: n0 }) || []).map(at0), at0(pk.to)));
      }
      if (!drag && keyGuides) keyGuides.forEach(function (g) {
        out.push('<path class="m2-ed-guide"' + gw() + ' d="M' + f1(sx(g[0][0])) + ' ' + f1(sy(g[0][1])) + 'L' + f1(sx(g[1][0])) + ' ' + f1(sy(g[1][1])) + '"/>');
      });
      if (drag && drag.guides) drag.guides.forEach(function (g) {
        out.push('<path class="m2-ed-guide"' + gw() + ' d="M' + f1(sx(g[0][0])) + ' ' + f1(sy(g[0][1])) + 'L' + f1(sx(g[1][0])) + ' ' + f1(sy(g[1][1])) + '"/>');
      });
      var seg = function (g) { return 'M' + f1(sx(g[0][0])) + ' ' + f1(sy(g[0][1])) + 'L' + f1(sx(g[1][0])) + ' ' + f1(sy(g[1][1])); };
      if (drag && drag.lines) drag.lines.forEach(function (g) { out.push('<path class="m2-ed-snapline"' + gw() + ' d="' + seg(g) + '"/>'); });
      // yEd's crosses: a small x at each point a centre or side line refers to, the middle of each
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
      // nodes selected: the eight handles round the box, in the map's units, so they grow and shrink with the zoom as
      // yEd's: 5 units wide, their centres 3.3 units outside the box (as measured on yEd); no fill over the node
      shared.selN.forEach(function (i) { over.push(handleMarks(bx(i), 'm2-ed-handle')); });
      // while a drag runs: a thin grey outline of where it goes (or the area being selected), gone on release
      if (drag && (drag.dx || drag.dy) && !gN) {   // no drawing to move yet: where it goes, as an outline
        var dx = drag.dx, dy = drag.dy, moving = new Set(), ps = new Set(shared.selP);
        shared.selN.forEach(function (i) { moving.add(i); nodes2[i].inside.forEach(function (c) { moving.add(c); }); });
        shared.selE.forEach(function (k) { edges2[k].pts.forEach(function (p) { ps.add(p); }); });
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
      // the square marks magenta on a CellDesigner map, as in CellDesigner, so a CellDesigner map is
      // recognised while editing; black on a GraphML map, as in yEd
      overlay.classList.toggle('m2-ed-cd', !!shared.cd);
      svMarks(over);   // a state variable selected (create.js)
      linkPaint(out);   // an arc being drawn (create.js)
      overlay.innerHTML = out.concat(over).join('');
    }

    // the pointer: a press on a node, an arc or a bend point selects it and moves it (an arc: its bends), Shift adds to
    // the selection; a drag from anywhere but the selection moves the map, with Shift selects an area (added to the selection), as in the viewer
    function at(e) {
      var r = V.view.getBoundingClientRect(), vx = (e.clientX - r.left) / V.pz(), vy = (e.clientY - r.top) / V.pz();
      return [(vx - V.tx) / V.z + x0, (vy - V.ty) / V.z + y0];
    }
    function near(P, a, b) {   // the distance from P to the segment a-b
      var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L)) : 0;
      return Math.hypot(P[0] - a[0] - dx * t, P[1] - a[1] - dy * t);
    }
    function inComplex(i) { return hm().inComplex(i); }
    function hit(P) {   // a bend point first, then a node, then an arc, then a group (its contents and arcs come first)
      var R = 6 / V.z, best = null, group = null;
      // among bend points close together the one selected wins, then one of the arc selected (select
      // the arc, see its bends, then click the bend wanted: the arc is the hint), else the nearest (else a nearby bend is
      // taken and the wrong arc dragged)
      var dB = Infinity, ofArc = new Set();
      shared.selE.forEach(function (k) { edges2[k].pts.forEach(function (q) { ofArc.add(q); }); });
      points.forEach(function (p, i) {
        var dx = Math.abs(num(p, 'x') - P[0]), dy = Math.abs(num(p, 'y') - P[1]);
        if (dx > R || dy > R) return;
        var d = Math.hypot(dx, dy) - (shared.selP.indexOf(i) >= 0 ? 4 * R : ofArc.has(i) ? 2 * R : 0);
        if (d < dB) { dB = d; best = { p: i }; }
      });
      if (best) return best;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i);
        if (!(P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3])) return;
        var h = { n: i, area: b[2] * b[3] };
        // a process glyph is not an item of its own (in CellDesigner it is not selectable, part of
        // the link): a click on it is a click on its reaction's main line, no node handles; a drag on it moves the map
        var gm = shared.cd && n.id.match(/^(.*)\|proc$/);
        if (gm) { var ga = edges2.findIndex(function (q) { return q.id === gm[1] + '|a'; }); if (ga >= 0 && !best) best = { e: ga, glyph: true, area: 0 }; return; }
        if (shared.afSbgn && inComplex(i)) return;   // the SBGN AF view: a complex's members not drawn, the complex taken whole
        // a holder (anything with contents, and a compartment always, empty or not) only where no node or line is hit
        if ((n.kids.length || n.comp) && !(shared.afSbgn && n.shape.kind === 'Complex')) { if (!group || h.area < group.area) group = h; }
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
    function editing(e) { return on && V.current === map && !e.target.closest('.m2-ctrl, .m2-info, .m2-ed-type'); }   // a press in the name box is the box's
    function __run36() {   // run at start, in order (__start)
    // edit mode is view mode plus the selection (the same gestures as in view mode):
    // two-finger scrolling moves the map, a pinch zooms (the viewer's wheel handler); a drag on empty
    // space or on an item not selected moves the map, as in the viewer; a click selects (on empty space: clears the
    // selection; Shift with a click adds or takes out); a drag on what is selected moves it (with Shift by itself, out
    // of its container: regroup); Shift with a drag from anywhere else, inside a compartment too, selects an area, added
    // to the selection; a right click opens the viewer's menu, as outside edit mode
    V.view.addEventListener('pointerdown', function (e) {
      keyGuides = null; keyFlush();
      shared.tap = null;
      if (!editing(e)) return;
      var P0 = at(e);
      if (e.button === 2 || (e.button === 0 && e.ctrlKey && /Mac/.test(navigator.platform))) {   // a right click: the viewer's menu
        rclick = P0;
        e.stopImmediatePropagation();   // (no right drag for the map, two fingers move it)
        return;
      }
      if (e.button !== 0) return;
      if (palDown(e)) return;   // something in hand from the palette: the click puts it there (create.js)
      var P = at(e), h = hit(P);
      var pp = !e.shiftKey && portAt(P);
      if (pp) {   // a lit line's end square: its port moved among the node's five places
        e.stopImmediatePropagation(); e.preventDefault();
        V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
        drag = { port: pp, x: P[0], y: P[1], dx: 0, dy: 0, cx: e.clientX, cy: e.clientY }; mv = null;
        shared.part = { k: pp.k, port: pp }; paint(); return;
      }
      if (!(!e.shiftKey && handleAt(P, true)) && svDown(e, P, h)) return;   // a state variable before its node (create.js); a node's handle over it first
      // an edge of a compartment, or a handle of one selected: a drag resizes it (compartments are
      // containers, resized by hand by dragging their edge); a bend point or a node there comes first
      var rz = !e.shiftKey && edgeAt(P);
      if (rz && h && h.p != null) rz = null;
      if (!rz && !e.shiftKey) {   // the border of a compartment not selected: a click there selects it, a drag moves the map
        var ez0 = edgeAt(P, true);
        if (ez0 && (!h || (h.p == null && h.e == null && h.n != null && nodes2[h.n].comp))) h = { n: ez0.c };
      }
      if (rz) {
        e.stopImmediatePropagation(); e.preventDefault();
        V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
        shared.selN = [rz.c]; shared.selP = []; shared.selE = [];
        drag = { x: P[0], y: P[1], dx: 0, dy: 0, rs: { c: rz.c, s: rz.s, b0: boxOf(rz.c), cx: e.clientX, cy: e.clientY } };
        mv = null; paint(); return;
      }
      // Shift on a node selected: a drag moves the selection by itself, out of what holds it and without what it holds
      // (regroup); a click with no move still takes it out of the selection, as Shift with a click does (release)
      // (in Layout only a member that holds nothing, not in a complex: what holds what never changes there; else a plain drag)
      var shiftOn = e.shiftKey && !!h && h.n != null && !h.glyph && shared.selN.indexOf(h.n) >= 0;
      var alone = shiftOn && (full() || shared.selN.every(function (i) { return !nodes2[i].kids.length && !inComplex(i); }));
      if (e.shiftKey && !shiftOn) {   // Shift with a drag from anywhere but the selection (inside a compartment or a complex too): an
        // area added to the selection; Shift with a click (no move) adds or takes out what is under it (release)
        e.stopImmediatePropagation(); e.preventDefault();
        V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
        band = { x: P[0], y: P[1], x2: P[0], y2: P[1], h: h, add: true, cx: e.clientX, cy: e.clientY }; paint(); return;
      }
      // empty space or an item not selected: a drag moves the map (the viewer's, mouse, trackpad and finger alike), a
      // click is taken on release (selects, or on empty space clears)
      var tapped = function () {
        if (e.pointerType === 'mouse' && !V.grab) {   // Settings, Gestures, Drag selects an area ticked: a drag selects an area in place of the selection
          e.stopImmediatePropagation(); e.preventDefault();
          V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
          band = { x: P[0], y: P[1], x2: P[0], y2: P[1], h: h, add: false, cx: e.clientX, cy: e.clientY }; paint(); return;
        }
        shared.tap = { h: h, shift: e.shiftKey, x: e.clientX, y: e.clientY }; V.view.focus({ preventScroll: true });
      };
      if (!h) return tapped();
      if (!alone && linkDown(e, P, h)) return;   // an arc's sign picked: a drag from an entity or a process draws it (create.js; a press off a node only where the format's part says the line stands for its process)
      if (h.glyph) return tapped();   // a glyph is not dragged: a drag on it moves the map, a click selects its reaction
      var list = h.p != null ? shared.selP : h.e != null ? shared.selE : shared.selN, k = h.p != null ? h.p : h.e != null ? h.e : h.n, there = list.indexOf(k) >= 0;
      // a bend point of an arc selected is a part of that connector: dragged at once, as its ends, the arc staying
      // selected after (as yEd does for connectors: the whole connector selected, its
      // parts move with the next press); a molecule still needs its first click
      var keepE = null;
      if (!there && h.p != null && shared.selE.some(function (q) { return edges2[q].pts.indexOf(h.p) >= 0; })) {
        shared.part = { k: shared.selE.find(function (q) { return edges2[q].pts.indexOf(h.p) >= 0; }), p: h.p };
        keepE = shared.selE.slice(); shared.selN = []; shared.selE = []; shared.selP = [h.p]; list = shared.selP; there = true;
      }
      // a first click on a bend point of a line not selected selects the whole line, as a click anywhere on it (consistent:
      // a line selected first, its bend points then moved with the next press);
      // a bend point alone is selected only by an area or Shift with a click
      if (!there && h.p != null && !keepE) {
        var ak = edges2.findIndex(function (q) { return q.pts.indexOf(h.p) >= 0; });
        if (ak >= 0) { h = { e: ak }; return tapped(); }   // taken on release as a click on the line; a drag moves the map
      }
      // the first click selects, a drag moves only what is selected already (as yEd: the first click
      // selects an item, the second drags it)
      if (!there) return tapped();
      e.stopImmediatePropagation(); e.preventDefault();
      V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
      drag = { x: P[0], y: P[1], dx: 0, dy: 0, p: h.p != null && shared.selP.indexOf(h.p) >= 0 ? h.p : null, guides: [],
               n: h.n != null && shared.selN.indexOf(h.n) >= 0 ? h.n : null, e: h.e != null && shared.selE.indexOf(h.e) >= 0 ? h.e : null, keepE: keepE,
               sx0: e.clientX, sy0: e.clientY, alone: alone, away: { x0: 0, x1: 0, y0: 0, y1: 0 } };
      // an arc grabbed anywhere and dragged makes a new bend point there (as yEd); a click selects it
      if (h.e != null && !e.shiftKey) drag.grab = { k: h.e, P: P, sx: e.clientX, sy: e.clientY };
      mv = moving(alone);
      paint();
    }, true);
    }
    // guides for a bend point (as yEd's for an L-shaped bend): the
    // bend pressed snaps when one of its two segments is nearly level or upright, and a segment so lined up is drawn
    // as a thick grey line while the drag runs (both for an L)
    function ports(k, pp) {   // the arc's points with its ends at the ports (node centre and offset), as yEd lines them up;
      // a node the drag poses (a terminal held on its border) at its posed box (bx) and ports, where the drop puts them
      var e = edges2[k], mine = pp && pp.to && pp.k === k, ns = mine && !pp.end && pp.n2 != null ? pp.n2 : e.s, nt = mine && pp.end && pp.n2 != null ? pp.n2 : e.t, pa = e.path, o = function (a) {
        if (mine && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
        return pa ? parseFloat(pa.getAttribute(a)) || 0 : 0;
      };
      var S = bx(ns), T = bx(nt), so = posePort(ns, [o('sx'), o('sy')], k), to = posePort(nt, [o('tx'), o('ty')], k);
      return [[S[0] + S[2] / 2 + so[0], S[1] + S[3] / 2 + so[1]]].concat(e.pts.map(pt), [[T[0] + T[2] / 2 + to[0], T[1] + T[3] / 2 + to[1]]]);
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
      // upright too
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
    // a new bend point (as yEd: a line grabbed at any point and dragged): put on the arc's
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
      var at = j - 1, first = function () { return Array.prototype.indexOf.call(doc.getElementsByTagNameNS(Y, 'Path'), e.path); };   // the path's index, only for a line's first bend
      var t2 = GE.bend(shared.text, at < e.pts.length ? { before: e.pts[at] } : e.pts.length ? { after: e.pts[e.pts.length - 1] } : { path: first() }, Q[0], Q[1]);
      if (t2 == null) return null;
      remember(false); setText(t2);
      parse();
      return { p: edges2[k].pts[at], at: Q, k: k + 1 };
    }
    // a bend point taken away (CellDesigner's own model: bend points are put and removed by hand,
    // CellDesigner's right click Remove Anchor Point; yEd: Delete): its y:Point out of the text, one undo step.
    // On a CellDesigner map the glyph then sits midway on the segment it is on, as CellDesigner puts it
    function unbend(list) {
      var t = GE.unbend(shared.text, list);
      if (t === shared.text) return false;
      keyGuides = null;
      return commit(t, { name: 'bend point removed', sel: [] });
    }
    var rclick;
    function __run37() {   // run at start, in order (__start)
    rclick = null;
    }   // where the last right click was, for the menu's Remove bend point
    // the drawing of the file as it is now, when the renderer has drawn it (not before the first move: the picture is then still the one editing started on)
    function nowSvg() { return lastFor && !lastFor[3] && lastFor[0] === shared.text && lastFor[1] === (shared.cd ? shared.cd.now : null) ? lastSvg : null; }
    // while a redraw runs, the last drawing of this map (one move behind for a moment) in place of the site's picture
    function shownSvg() { return nowSvg() || (lastFor && !lastFor[3] && site && lastFor[2] === site.id ? lastSvg : null); }
    // the map being edited as it is now, for the viewer's menu (the download is what is on the screen;
    // else Download CellDesigner XML gives the site's file without the moves just made)
    function __run38() {   // run at start, in order (__start)
    window.m2EditNow = function () { return on && site && site.id && shared.text ? { id: site.id, text: src(), svg: shownSvg(), file: name } : null; };
    window.m2EditTurn = function () {   // the right-click menu's Turn process over a process or logic gate
      if (!on || V.current !== map || !rclick || !window.yrender || onOwnMenu()) return null;
      var h = hit(rclick);
      if (!h || h.n == null || !nodes2[h.n].hub) return null;
      var i = h.n, gate = nodes2[i].shape.kind === 'Operator';
      return { label: gate ? 'Turn logic gate' : 'Turn process', go: function () { turn(i); } };
    };
    // Make main (CellDesigner's main reactant or product is often an accident of the conversion): the
    // right-click menu on an added reactant's or product's line of a CellDesigner reaction (or a bend point of it) swaps
    // it with the main one, cd_edit.makeMain on the GraphML (the network stays: layout editing too); place() writes the
    // participants and CellDesigner's process square goes to the middle of the new main line. One undo step.
    window.m2EditMain = function () {
      if (!on || V.current !== map || !rclick || !shared.cd || !window.cd_edit || onOwnMenu()) return null;
      var h = hit(rclick), k = h && h.e != null && !h.glyph ? h.e : h && h.p != null ? edges2.findIndex(function (e) { return e.pts.indexOf(h.p) >= 0; }) : -1;
      if (k < 0 || !/\|[rp]\d+$/.test(edges2[k].id)) return null;
      var t2 = window.cd_edit.makeMain(shared.text, edges2[k].id);
      if (!t2) return null;
      return { label: /\|r\d+$/.test(edges2[k].id) ? 'Make main reactant' : 'Make main product', go: function () {
        keyGuides = null; commit(t2, { name: 'make main', ids: [edges2[k].id], sel: [] });
      } };
    };
    }
    // a state variable or unit of information with its own menu under the right click: the line, bend point or
    // process behind it offers nothing there
    function onOwnMenu() { return ownMenus.some(function (f) { return f(rclick); }); }
    function __run39() {   // run at start, in order (__start)
    window.m2EditBend = function () {
      if (!on || V.current !== map || !rclick || onOwnMenu()) return null;
      var h = hit(rclick);
      if (!h || h.p == null) return null;
      var pi = h.p;
      return function () { unbend([pi]); };
    };
    }
    function emptyClick() {   // the right click on empty map space (inside a compartment counts as empty, inside a complex not: the complex's own items there) of the map being edited
      if (!on || V.current !== map || !shared.text || !rclick) return false;
      if (ownMenus.some(function (f) { return f(rclick); })) return false;   // a state variable standing out of its node: its own menu, not the map's
      var h = hit(rclick);
      return !h || (h.n != null && asSpace(h.n));
    }
    function asSpace(i) { return nodes2[i].kids.length > 0 && nodes2[i].shape.kind !== 'Complex'; }   // a holder clicked inside that is not a complex (a compartment with contents): empty map space to the menus
    // every bend point of the map taken away at once (maps from another editor can be so messy that
    // removing them all and rerouting by hand is quicker than one by one): the right-click menu's Remove all bend points,
    // on empty map space while editing (a right click on a bend point means that bend point; inside a
    // compartment counts as empty); one undo step
    var ownMenus;
    function __run40() {   // run at start, in order (__start)
    window.m2EditOnObject = function () { return !!(on && V.current === map && shared.text && rclick) && !emptyClick(); };   // the right click on an item (a node, a line, inside a complex), so its menu holds that item's items only
    window.m2EditAllBends = function () {
      if (!points.length || !emptyClick()) return null;
      return function () { unbend(points.map(function (p, i) { return i; })); };
    };
    // the whole map's tools of the Edit window in the right-click menu too, on empty map space:
    // Snap map to grid, Repack all complexes (every complex, whatever is selected), and the
    // Show grid and Snap to grid switches, a check beside a switch that is on; each the same code as its button
    // and Repack complex, in the object's menu of a complex (a right click inside it) or of a member, above Select all of
    // this kind: the outermost complex round it (outerComplex), alone; above it Name by members for the innermost
    // complex there (create.js)
    ownMenus = [];
    }   // a format's part: functions telling a point that has its own right-click menu (a state variable), where no complex item is offered
    function complexHere(member) {   // the innermost complex round the right click, or null; member: asked by the object's menu, so not on empty space
      if (!on || V.current !== map || !shared.text || !rclick || (member && (emptyClick() || ownMenus.some(function (f) { return f(rclick); })))) return null;
      var h = hit(rclick), c = h && h.n != null ? h.n : null;
      while (c != null && nodes2[c].shape.kind !== 'Complex') c = nodes2[c].up;
      return c;
    }
    var GAP_OUT, CLOSE;
    function __run41() {   // run at start, in order (__start)
    window.m2EditPackHere = function (member) {
      var c = complexHere(member);
      if (c != null) c = outerComplex(c);
      if (c == null) return null;
      var id = nodes2[c].id;
      return function () { pack([id]); };
    };
    window.m2EditMapItems = function () {
      if (!emptyClick()) return null;
      var tick = function (v) { return v ? '<span class="m2-cx-key" aria-hidden="true">\u2713</span>' : ''; };
      return [['Snap map to grid', snapMap], ['Repack all complexes', function () { pack([]); }],
        ['Show grid', gridShow, tick(gridSet.shown), gridSet.shown], ['Snap to grid', gridSnap, tick(gridSet.snap), gridSet.snap]];
    };
    // a bend point put where the right click was on a line (as
    // CellDesigner's right click Add Anchor Point): the same new point a drag on the line makes, left
    // in place, the line selected so its points show and the new one is dragged with the next press; one undo step.
    // Not on the process glyph (no bend point there: it sits midway on its segment)
    window.m2EditAddBend = function () {
      if (!on || V.current !== map || !rclick || onOwnMenu()) return null;
      var h = hit(rclick), P = rclick;
      if (!h || h.e == null || h.glyph) return null;
      var k = h.e;
      return function () {
        var nb = bend(k, P);
        if (!nb) return;
        shared.selN = []; shared.selP = []; shared.selE = [k]; keyGuides = null; shared.dirty = true;
        render(); paint(); changed();
      };
    };
    // guides for nodes, as yEd's snap lines: the node pressed (the
    // selection moving with it) snaps when (1) one of its own arcs' segments becomes level or upright, (2) its centre lines
    // up with another node's, (3) a side with the same side of another node (opposite sides only when the two are close),
    // (4) it sits midway between two nodes, or its gap to a neighbour repeats a gap between two nodes in sight, (5) it is
    // dragged nearly straight across or down (only x or only y changes).
    // Each axis on its own; 6 px on screen; the smallest correction wins, near ties (1 px) by that order; every reason
    // that holds is shown: thick grey for an arc, a thin line for centres and sides, marks for equal gaps. Ctrl or Alt held,
    // no snapping (yEd: Ctrl). Not handled: the set node to node and node to arc distances (no default in yEd's manual).
    GAP_OUT = 12;   // equal gap marks this far beside the nodes (map units)
    CLOSE = 40;
    }   // opposite sides snap only within this gap (map units), and lines reach this far past the nodes
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
      // (4) equal gaps, as yEd's: midway between the nearest node on each side (a process glyph too,
      // as yEd), or the gap to a node on one side the same as that node's gap to one beyond it, as a chain. A node
      // counts on a side when it is wholly on that side and can be seen from the other past the nodes nearer it (some of
      // the width they share not covered), as yEd measures across a process glyph between two metabolites; for midway the
      // node moved sees within NEAR across, as yEd takes a node just beside its row or column. Only the chain, as in every
      // case of yEd's seen: gaps from any pair in sight matched nearly every place (42 to 100% of
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
    function onGrid(d) {   // snap to the grid, an axis a guide has not taken: the node pressed by its centre on Grid size, a
      // bend point (alone, or the first of an arc dragged) on the line step where the format has a line grid (lineGrid; else
      // its guides alone); Alt or Ctrl held, no snapping
      var X, Y2, st;
      if (d.n != null) { var b = boxOf(d.n); X = b[0] + b[2] / 2; Y2 = b[1] + b[3] / 2; st = gridSet.step; }
      else {
        var pi = d.p != null ? d.p : d.e != null && edges2[d.e].pts.length ? edges2[d.e].pts[0] : null;
        if (pi == null || !lineGrid()) return;
        X = num(points[pi], 'x'); Y2 = num(points[pi], 'y'); st = lineStep();
      }
      if (!d.gx) d.dx += toGrid(X + d.dx, st);
      if (!d.gy) d.dy += toGrid(Y2 + d.dy, st);
    }
    // Shift with a drag in Layout editing: a compartment's member may go onto the edge, never fully out:
    // the drag held where each one moved still overlaps its compartment by one unit (one outside from the start: free)
    function tether(d) {
      mv.n.forEach(function (i) {
        var p = nodes2[i].up, s0 = boxOf(i);
        if (p == null || mv.n.has(p) || !nodes2[p].comp) return;
        var c = boxOf(p);
        if (!overlap(s0, c)) return;
        d.dx = Math.max(c[0] - s0[0] - s0[2] + 1, Math.min(c[0] + c[2] - s0[0] - 1, d.dx));
        d.dy = Math.max(c[1] - s0[1] - s0[3] + 1, Math.min(c[1] + c[3] - s0[1] - 1, d.dy));
      });
    }
    function __run42() {   // run at start, in order (__start)
    V.view.addEventListener('pointermove', function (e) {
      if (linkMove(e)) return;   // an arc being drawn (create.js)
      if (shared.tap && Math.hypot(e.clientX - shared.tap.x, e.clientY - shared.tap.y) >= 5) shared.tap = null;   // a drag of the map, no click even if it comes back
      if ((drag || band) && e.pointerType === 'mouse' && !e.buttons) return release(e);   // its release never came
      if (drag || band) {
        e.stopImmediatePropagation();
        var P = at(e);
        if (band) { band.x2 = P[0]; band.y2 = P[1]; }
        else if (drag.port) { if (drag.port.moved || Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) >= 4) { drag.port.moved = true; aim(drag.port, P, e.altKey || e.ctrlKey); } }
        else if (drag.rs && !drag.rs.go && Math.hypot(e.clientX - drag.rs.cx, e.clientY - drag.rs.cy) < 4) return;   // not a resize yet: a click with a jitter changes nothing
        else if (drag.rs) {
          var seed = {}, rc = drag.rs.c; drag.rs.go = true;
          seed[rc] = nodes2[rc].comp ? resized(drag, P, gridSet.snap && !e.altKey && !e.ctrlKey) : holds(rc) ? roomy(rc, sized(drag, P, e.altKey || e.ctrlKey), drag.rs.s, drag.rs.b0) : sized(drag, P, e.altKey || e.ctrlKey);
          liveFit(seed);
          if (!holds(rc)) sizeLive(rc, seed[rc]);
        }
        else if (drag.grab && Math.hypot(e.clientX - drag.grab.sx, e.clientY - drag.grab.sy) < 4) return;   // not a drag yet
        else {
          if (drag.grab) { var nb = bend(drag.grab.k, drag.grab.P); drag.grab = null;
            if (nb) { drag.x = nb.at[0]; drag.y = nb.at[1]; drag.p = nb.p; drag.e = null; drag.made = drag.made || nb.k; shared.selN = []; shared.selE = []; shared.selP = [nb.p]; mv = moving(); } }
          drag.dx = Math.round(P[0] - drag.x); drag.dy = Math.round(P[1] - drag.y);
          drag.gx = drag.gy = false;
          drag.guides = []; drag.lines = []; drag.marks = []; drag.ext = []; drag.crosses = [];
          if (drag.p != null) snap(drag);
          else if (drag.n != null && !e.altKey && !e.ctrlKey) snapNode(drag);
          if (gridSet.snap && !e.altKey && !e.ctrlKey) onGrid(drag);
          if (drag.alone && !full()) tether(drag);
          mv.dx = drag.dx; mv.dy = drag.dy; shift();
          var aw = drag.away; if (aw) aw.x0 = Math.min(aw.x0, drag.dx), aw.x1 = Math.max(aw.x1, drag.dx), aw.y0 = Math.min(aw.y0, drag.dy), aw.y1 = Math.max(aw.y1, drag.dy);
          if (mv.n.size) liveFit();   // the holders round it grow with it (grown)
        }
        paint();
        return;
      }
      if (tool && on && V.current === map && !e.buttons) { V.view.style.cursor = 'default'; return; }   // something in hand from the palette: the plain arrow (no cross)
      if (on && V.current === map && !e.buttons) {   // the move sign only over what a drag would move
        var PP = at(e);
        var hh = e.shiftKey ? null : hit(PP), ez = !e.shiftKey && edgeAt(PP);
        if (ez && hh && hh.p != null) ez = null;
        if (ez) { V.view.style.cursor = resizeCursor(ez.s); return; }
        var sel = hh && ((hh.p != null ? shared.selP.indexOf(hh.p) : hh.e != null ? shared.selE.indexOf(hh.e) : shared.selN.indexOf(hh.n)) >= 0 ||
          (hh.p != null && shared.selE.some(function (q) { return edges2[q].pts.indexOf(hh.p) >= 0; })));
        V.view.style.cursor = !hh ? '' : sel ? 'move' : 'pointer';
      }
    }, true);
    }
    function release(e) {
      if (palUp(e)) return;
      if (linkUp(e)) return;   // an arc drawn (create.js); a click on its node goes on to select it
      var t = shared.tap; shared.tap = null;
      if (t && e.type === 'pointerup' && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 5) {   // a click, not a drag of the map
        e.stopImmediatePropagation();   // the viewer's release would open the annotation (its own pointer ends with the capture)
        click(t); return;
      }
      if (!drag && !band) return;
      e.stopImmediatePropagation();
      if (band) {
        var bd = band; band = null;
        if (e.type === 'pointerup' && Math.hypot(e.clientX - bd.cx, e.clientY - bd.cy) < 5) { click({ h: bd.h, shift: bd.add }); return; }   // a click (with Shift: adds or takes out)
        if (!bd.add) { shared.selN = []; shared.selP = []; shared.selE = []; }
        var a = [Math.min(bd.x, bd.x2), Math.min(bd.y, bd.y2)], c = [Math.max(bd.x, bd.x2), Math.max(bd.y, bd.y2)];
        nodes2.forEach(function (n, i) { var b = boxOf(i); if (shared.cd && /\|proc$/.test(n.id)) return; if (b[0] >= a[0] && b[1] >= a[1] && b[0] + b[2] <= c[0] && b[1] + b[3] <= c[1] && shared.selN.indexOf(i) < 0) shared.selN.push(i); });
        points.forEach(function (p, i) { var X = num(p, 'x'), Y2 = num(p, 'y'); if (X >= a[0] && Y2 >= a[1] && X <= c[0] && Y2 <= c[1] && shared.selP.indexOf(i) < 0) shared.selP.push(i); });
        shared.part = null; paint(); return;
      }
      dragEnd(e);
    }
    function click(t) {   // a click taken on release: selects, clears, or with Shift adds or takes out
      var hs = t.h;
      shared.part = null;
      if (!hs) { if (!t.shift) { shared.selN = []; shared.selP = []; shared.selE = []; } paint(); return; }
      var li = hs.p != null ? shared.selP : hs.e != null ? shared.selE : shared.selN, ki = hs.p != null ? hs.p : hs.e != null ? hs.e : hs.n;
      if (t.shift) { if (li.indexOf(ki) >= 0) li.splice(li.indexOf(ki), 1); else li.push(ki); }
      else { shared.selN = hs.n != null ? [ki] : []; shared.selP = hs.p != null ? [ki] : []; shared.selE = hs.e != null ? [ki] : []; }
      paint();
    }
    // a compartment or a complex given a new box (its handles dragged, or Width and Height typed): in Full what no longer
    // overlaps it let go, what it now covers taken in, past its holder's edge it leaves it (regroup); in Layout its holder
    // grows (grown); a complex keeps its members (roomy, applied before)
    function holderSize(rc, nb, b0r) {
      var rid = nodes2[rc].id, one = {}; remember(false);
      one[rc] = nb; setBoxes(one);
      var pf = propFmt(); if (pf && pf.ends) pf.ends(rid, b0r, nb);   // the format's part: its line ends at the box scaled with it (SBGN-ML)
      var before = boxesBefore(function (k) { return nodes2[k].id === rid ? b0r : boxOf(k); });
      var B0r = function (k) { return before[nodes2[k].id] || boxOf(k); }, doneR = function () { render(); paint(); changed(); }, ri = nodes2.findIndex(function (n) { return n.id === rid; });
      if (!full() || !nodes2[ri].comp) { setBoxes(grown([ri], boxOf, B0r, function () { return false; })); refit([rid]); doneR(); return; }   // a complex: its members kept (roomy), its holders grown
      settle(regroup('box', new Set([ri]), boxOf, B0r), { moving: [rid] }, doneR, function () { setText(unpush()); parse(); liveOff(); paint(); });   // refused: taken back, nothing said
    }
    function dragEnd(e) {   // the end of a drag of the selection, a port or a resize
      var d = drag; drag = null; var sets = mv; mv = null; shared.poseNow = null;   // the file holds the pose from here (the drawing keeps it until drawn again)   // the moved groups and live arcs stay until the map is drawn again
      if (!d.port && !d.rs) shared.frozen = true;   // the copies too: the file now has the new places, the picture not yet
      if (d.port) {   // dragged: the port set; a click: that end selected, the line staying lit, for the arrow keys
        if (d.port.n2 != null) reconnect(d.port);
        else if (d.port.free || (d.port.moved && !d.port.to) || (d.port.hub && !d.port.to)) { unshift(); paint(); }   // over nothing that takes it, or on its own process: back where it was (a click there keeps the line)
        else if (d.port.to) setPort(d.port);
        else paint();
        return;
      }
      if (d.rs) {   // a compartment or a complex resized: its box set; in Full what no longer overlaps it let go, what it now covers taken in, past its holder's edge it leaves it (regroup); in Layout its holder grows (grown)
        var nb = shared.liveC && shared.liveC[d.rs.c];
        if (!nb || nb.every(function (v, j) { return Math.abs(v - d.rs.b0[j]) < 0.01; })) { liveOff(); sizeOff(); paint(); return; }
        if (!holds(d.rs.c)) { setSize(d.rs.c, nb); return; }   // a node resized by its handles (create.js, the format's part)
        holderSize(d.rs.c, nb, d.rs.b0);
        return;
      }
      var movedNow = sets ? movedIds(sets) : [];   // by id: the map is read again below
      var fitAfter = function () {   // what holds what settled again (Full: regroup), a glyph dropped on a complex put into it (joinPlan, create.js), the holders round what moved grown (grown), in the same undo step
        var B0 = function (k) { var b = boxOf(k); return sets.n.has(k) ? [b[0] - d.dx, b[1] - d.dy, b[2], b[3]] : b; };   // the boxes before the drag
        settle(full() ? regroup(d.alone ? 'alone' : 'plain', sets.n, boxOf, B0) : new Map(), { join: full() ? movedNow : null, grow: tops(sets.n, d.alone).map(function (k) { return nodes2[k].id; }), before: boxesBefore(B0), moving: movedNow, away: d.away },
          function () { render(); changed(); }, function () { setText(unpush()); parse(); unshift(); paint(); });   // a CellDesigner file that cannot hold it: not moved, nothing said
      };
      if (d.made != null && Math.abs(d.dx) < 0.01 && Math.abs(d.dy) < 0.01) {   // a new bend dragged back to where it was made (a snap may leave a hair): none made
        setText(unpush()); parse(); shared.selP = []; shared.selE = [d.made - 1]; unshift(); paint(); return;
      }
      // a second click on what is selected, with no drag (under 4 px on screen): it is deselected;
      // a bend point of an arc selected keeps its arc
      if (d.made == null && !d.keepE && d.sx0 != null && e.type === 'pointerup' && Math.hypot(e.clientX - d.sx0, e.clientY - d.sy0) < 4) {
        unshift();
        var out1 = function (list, k) { var j = list.indexOf(k); if (k != null && j >= 0) list.splice(j, 1); };
        if (d.p != null) out1(shared.selP, d.p); else if (d.e != null) out1(shared.selE, d.e); else out1(shared.selN, d.n);
        paint(); return;
      }
      if (d.made != null) { move(d.dx, d.dy); fitAfter(); }   // one step for undo: made and moved
      else if (d.dx || d.dy) { remember(false); move(d.dx, d.dy, sets); fixMoved(sets.n, d.alone); if (d.keepE) { shared.selE = d.keepE; shared.selP = []; } fitAfter(); }   // what the drag showed moving (with Shift, the selection by itself)
      else { unshift(); if (d.keepE) { shared.selE = d.keepE; shared.selP = []; } }   // a click with a slight jitter: nothing moved, nothing stays hidden (else a smooth bend
      // turns sharp: the arcs drawn as plain lines while waiting for a redraw that a move of zero never asks for)
      paint();
    }
    function __run43() {   // run at start, in order (__start)
    V.view.addEventListener('pointerup', release, true);
    V.view.addEventListener('pointercancel', release, true);
    }

    // an end of a line moved by the keys, as a drag sets it: round a glyph or a node's fixed places (nodePlaces) to the next
    // place; on the ports' grid (portStep); else among the node's five places, from the centre to the side the arrow points to, from a side the
    // opposite arrow back to the centre, another to its side
    function portKey(pp, d, fine) {
      if (pp.hub) return;   // at a process's or gate's port: it goes with the process
      var e = edges2[pp.k], a = pp.end ? ['tx', 'ty'] : ['sx', 'sy'], b = bx(pp.n), u = [Math.sign(d[0]), Math.sign(d[1])];
      var off = [num(e.path, a[0]) || 0, num(e.path, a[1]) || 0], G = procSpots(pp) || hubSides(pp), N = G ? null : nodePlaces(pp.n), S = G || (N && [[0, 0]].concat(N));
      if (!S && lineGrid()) {   // plain arrows a step of the line step, Shift 1; the same key again goes on round the outline the same way
        var rn = pp.run, go = rn && rn.u + '' === u + '' && Math.abs(rn.to[0] - off[0]) < 0.01 && Math.abs(rn.to[1] - off[1]) < 0.01 ? rn.di : null;   // the run lives on the pressed end: a new press, undo or Esc ends it
        var g2 = portStep(pp.n, off, u, fine ? 1 : lineStep(), go);
        pp.run = g2 && g2.di != null ? { u: u, di: g2.di, to: g2.to } : null;
        if (g2) setPort({ k: pp.k, end: pp.end, n: pp.n, to: g2.to }, true);
        return;
      }
      var c = [b[0] + b[2] / 2, b[1] + b[3] / 2], o = spot(pp, [c[0] + off[0], c[1] + off[1]]), s = [Math.sign(o[0]), Math.sign(o[1])];
      if (S) {   // round a glyph: the place the arrow points to most nearly; among a node's places (nodePlaces) the nearest
        // within 60 degrees of the arrow, nearer and straighter first, so the arrows walk round its outline place by place
        var best = null, bs = G ? 0.3 : -Infinity;
        S.forEach(function (q) {
          var v = [q[0] - o[0], q[1] - o[1]], L = Math.hypot(v[0], v[1]), cs = L > 0.01 ? (v[0] * u[0] + v[1] * u[1]) / L : -1;
          var sc = G ? cs - L / 1000 : cs >= 0.5 ? -L / cs : -Infinity;
          if (sc > bs) { bs = sc; best = q; }
        });
        if (best) setPort({ k: pp.k, end: pp.end, n: pp.n, to: best }, true);
        return;
      }
      var to = (s[0] || s[1]) && s[0] === -u[0] && s[1] === -u[1] ? [0, 0] : [u[0] * b[2] / 2, u[1] * b[3] / 2];
      setPort({ k: pp.k, end: pp.end, n: pp.n, to: to }, true);
    }
    // the keys: arrows move the selection by 1 (Shift: 10), Ctrl or Cmd with Z undoes, with S saves; Esc clears
    function __run44() {   // run at start, in order (__start)
    document.addEventListener('keydown', function (e) {
      if (!shared.text) return;
      var mod = e.ctrlKey || e.metaKey, k = V.letter(e) || (e.key || '').toLowerCase();   // the letter typed, else its place on the keyboard, so Z, Y, S, A work in any layout
      if (mod && k === 's') { e.preventDefault(); save(); return; }
      if (!on || V.current !== map || V.typing()) return;
      if (/input|select/i.test(document.activeElement.tagName) && !(mod && (k === 'z' || k === 'y'))) return;   // a tick box or a list: only the undo keys pass (own.js chose the map's)
      if ((mod && k === 'a') || e.key === 'Escape') keyFlush();   // the selection changes: the keys' run ends
      if (mod && k === 'a') {   // select all, as yEd: every node and line; a CellDesigner glyph is no item of its own
        e.preventDefault(); shared.part = null; keyGuides = null; shared.selP = [];
        shared.selN = nodes2.map(function (n, i) { return i; }).filter(function (i) { return !(shared.cd && /\|proc$/.test(nodes2[i].id)); });
        shared.selE = edges2.map(function (x, k2) { return k2; });
        paint(); return;
      }
      if (mod && (k === 'z' || k === 'y')) { e.preventDefault(); if (k === 'z' && !e.shiftKey) back(undo, shared.redo); else back(shared.redo, undo); return; }   // a newer setting was taken by own.js first
      // Escape does one thing: a window, menu, list, help box, tool or line in hand closed first (their own listeners), the selection after
      if (e.key === 'Escape') { if (e.defaultPrevented || ddOpen || tool || link || (helpBox && !helpBox.hidden)) return; shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null; keyGuides = null; paint(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && shared.selP.length && !shared.selN.length) { e.preventDefault(); unbend(shared.selP); return; }
      var step = e.shiftKey ? 10 : 1, d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();   // while editing the arrows never step to another map
      if (!shared.selN.length && !shared.selP.length && !shared.selE.length) return;
      // a line selected alone: only its part last pressed moves, as by hand (a bend point, or an end stepped among the
      // node's five places); none pressed, nothing moves
      var pt0 = partSel();
      if (!shared.selN.length && !shared.selP.length && !pt0) return;
      if (pt0 && pt0.port) { portKey(pt0.port, d, e.shiftKey); return; }
      if (!pt0 && keyTake.some(function (f) { return f(d, e); })) return;
      var ks = pt0 ? { n: new Set(), p: new Set([pt0.p]), dx: 0, dy: 0 } : moving();
      var bp = pt0 ? pt0.p : shared.selP.length === 1 && !shared.selN.length && !shared.selE.length ? shared.selP[0] : null;
      if (bp != null) d = keyAlign(bp, d, ks.p);
      if (ks.n.size && shared.cd && full() && cdJs && cdJs.nestCheck) {   // a move the CellDesigner file cannot hold refused at once, not after the run (a jump back)
        var r0 = keyRun || [0, 0], dd = d, Bk = function (k) { var b = boxOf(k); return ks.n.has(k) ? [b[0] + dd[0], b[1] + dd[1], b[2], b[3]] : b; };
        var mvs = []; regroup('plain', ks.n, Bk, function (k) { var b = boxOf(k); return ks.n.has(k) ? [b[0] - r0[0], b[1] - r0[1], b[2], b[3]] : b; }).forEach(function (t2, i) { mvs.push([nodes2[i].id, t2 == null ? null : nodes2[t2].id]); });
        var whyK = mvs.length ? cdJs.nestCheck(shared.cd.now, mvs, { doc: cdDoc(shared.cd.now) }) : null;
        if (whyK) return;   // refused: nothing moves, nothing said
      }
      remember(true); move(d[0], d[1], ks); keyShift(ks, d[0], d[1]); keyGuides = bp != null ? bendGuides(bp) : null; paint();
      var kids = movedIds(ks);
      keyRun = keyRun || [0, 0]; keyRun[0] += d[0]; keyRun[1] += d[1];   // the keys' move since the last settling
      keyDue = function () {   // what holds what settled as after a plain drag (regroup), the holders grown
        keyDue = null;
        var run = keyRun || [0, 0]; keyRun = null;
        var set = new Set(nodes2.map(function (n, i) { return kids.indexOf(n.id) >= 0 ? i : -1; }).filter(function (i) { return i >= 0; }));
        fixMoved(set);
        var B0 = function (k) { var b = boxOf(k); return set.has(k) ? [b[0] - run[0], b[1] - run[1], b[2], b[3]] : b; };
        settle(full() ? regroup('plain', set, boxOf, B0) : new Map(), { grow: tops(set, false).map(function (k) { return nodes2[k].id; }), before: boxesBefore(B0), moving: kids }, function () { render(); paint(); },
          function () { setText(unpush()); parse(); shared.keyed = null; render(); paint(); });   // refused (checked at each key already): taken back, nothing said
      };
      clearTimeout(timer); timer = setTimeout(function () { if (keyDue) keyDue(); }, 150); changed();
    }, true);
    }

    export function __start() { __run1(); __run2(); __run3(); __run4(); __run5(); __run6(); __run7(); __run8(); __run9(); __run10(); __run11(); __run12(); __run13(); __run14(); __run15(); __run16(); __run17(); __run18(); __run19(); __run20(); __run21(); __run22(); __run23(); __run24(); __run25(); __run26(); __run27(); __run28(); __run29(); __run30(); __run31(); __run32(); __run34(); __run35(); __run36(); __run37(); __run38(); __run39(); __run40(); __run41(); __run42(); __run43(); __run44(); __run45(); __run46(); }   // the part's statements, in their order
    export { asSpace, G, GE, HANDLE, MODS, Y, ahead, aheadSoon, api, at, away, b64, blobSha, box, boxOf, buttons, cdOwn, changed, chooseFolder, commit, complexHere, cut, cutShape, doc, docText, drag, drawText, edgeAt, edges2, editing, f1, fmt, freeName, full, gE, gN, gh, graphmlOf, gridBlock, gridSet, grown, handleMarks, heldText, hit, holder, holderSize, holds, hubPorts, inComplex, inRim, keyFlush, keyTake, kindWindow, landMarks, lastFor, lastSvg, lateItem, layTool, line, livePath, localBox, map, mapTop, moveFix, mv, name, near, nodes2, note, num, on, origFolderDrop, origFromFolder, origRead, origToFolder, origWrite, outlineD, overlap, ownMenus, paint, parse, parseFix, picWait, points, ports, procPlaces, pt, quiet, rclick, realizerOf, rebase, refit, regroup, remember, render, repo, rimOf, roleOf, roomy, setBoxes, setPort, setText, settle, shapeD, shown, site, spotNo, src, status, stop, subItem, sx, sy, syncFolder, takes, toFolder, toGrid, token, tops, under, undo, unkeep, unpush, warn, x0, y0 };
