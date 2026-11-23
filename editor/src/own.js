import { shared, V } from './state.js';
import { ahead, api, b64, blobSha, changed, drawText, freeName, gh, graphmlOf, heldText, localBox, map, mapTop, note, on, origFolderDrop, origRead, origWrite, repo, site, src, stop, toFolder, token, unkeep, warn } from './core.js';
import { cdMap, cdMk, cdpy, isCd } from './celldesigner.js';
import { NEW_ID, emptyBase, isSb, madeHere, sbMap } from './sbgn.js';

    // ---------- the reader's own storage (editor/src/own.js) ----------
    // What a reader without a GitHub token keeps (three layers: this browser, a folder on the computer,
    // GitHub): the drafts' writes, the folder's record, and the reader's own maps with their groups, the list's right-click
    // menu, Add map (to the site with a token), the drop, Delete map and Deleted. Moved out of the
    // viewer, so a page without the Edit tab loads none of it; the viewer keeps the
    // database's opening (V.draftDo, one place for its version), the drafts' read, the folder's name, the list's refresh
    // and the maps arrived on the site (V.arrived), and asks this part for the reader's maps (own, below).
    function draftPut(id, rec) { rec.id = id; V.drafts[id] = rec; V.draftIds(); return V.draftDo('readwrite', function (st) { return st.put(rec, id); }); }
    function draftDrop(id) {
      if (V.kept && V.kept.id === id && V.kept.draft) V.dropKept();
      if (!V.drafts[id]) return Promise.resolve();
      delete V.drafts[id]; V.draftIds();
      return V.draftDo('readwrite', function (st) { return st.delete(id); }).catch(function () {});
    }
    // the reader's folder (layer 2), kept beside the drafts (store folder): its handle (key dir), read
    // once per page, and the files written here (key files: map id -> { name, mod, size }), read afresh each time, since
    // another tab of the site may have written one since; its name in localStorage (V.folderName)
    var dirP;
    function __run1() {   // run at start, in order (__start)
    dirP = null;
    }
    function folder() {
      if (!V.folderName() || !window.indexedDB) return Promise.resolve(null);
      if (!dirP) dirP = V.draftDo('readonly', function (st) { return st.get('dir'); }, 'folder');
      dirP.catch(function () { dirP = null; });
      return Promise.all([dirP, V.draftDo('readonly', function (st) { return st.get('files'); }, 'folder')])   // a failed read rejects: never taken for no folder
        .then(function (r) { return r[0] ? { dir: r[0], files: r[1] || {} } : null; });
    }
    function folderSet(dir) {   // a folder chosen: its name said only once it is stored
      return V.draftDo('readwrite', function (st) { st.put({}, 'files'); return st.put(dir, 'dir'); }, 'folder')
        .then(function () { dirP = Promise.resolve(dir); try { localStorage.setItem(V.folderKey, dir.name); } catch (e) {} });
    }
    function folderFile(id, w) {   // one file written: only its own entry changed, in one step
      return V.draftDo('readwrite', function (st) {
        var q = st.get('files');
        q.onsuccess = function () { var r = q.result || {}; r[id] = w; st.put(r, 'files'); };
        return q;
      }, 'folder');
    }
    function folderForget() {   // the folder gone or refused: Choose a folder offered again
      try { localStorage.removeItem(V.folderKey); } catch (e) {}
      dirP = null;
      return V.draftDo('readwrite', function (st) { st.delete('files'); return st.delete('dir'); }, 'folder').catch(function () {});
    }
    // The reader's own maps (the third layer): maps a reader adds (a file
    // chosen with Add map in the list's right-click menu or dropped on the page, or one in their folder), drawn in this browser by the editor's
    // renderers and edited as any map, only where the Edit tab is. Kept in IndexedDB (store mine: { id, title, file, text,
    // svg, width, height, at, hidden, group; on the site with a token: site, path, sha, saved, siteTitle) and, with a
    // folder and no token, as their files in it. Delete map puts one in Deleted (hidden, with deleted: the time; below),
    // the same file added again brings it back. Example maps: the site's maps marked example: true in their pages
    // (below, exampleIds), every other map being the reader's, however it was made
    var MINE_KEY, mine, mineURLs;
    function __run2() {   // run at start, in order (__start)
    MINE_KEY = 'atlas-mine', mine = {}, mineURLs = {};
    }
    function mineFlag() { try { if (Object.keys(mine).length) localStorage.setItem(MINE_KEY, '1'); else localStorage.removeItem(MINE_KEY); } catch (e) {} }
    var mineIn;
    function __run3() {   // run at start, in order (__start)
    mineIn = (function () {
      var has; try { has = localStorage.getItem(MINE_KEY); } catch (e) {}
      if (!has || !window.indexedDB) return Promise.resolve();
      return V.draftDo('readonly', function (st) { return st.getAll(); }, 'mine').then(function (all) {
        (all || []).forEach(function (r) { if (r && r.id && !mine[r.id]) mine[r.id] = r; });
        var legacy = null; try { legacy = localStorage.getItem('atlas-mine-group'); localStorage.removeItem('atlas-mine-group'); } catch (e) {}
        if (legacy && mineGroups().indexOf(legacy) < 0) mineGroupsSet(mineGroups().concat([legacy]));   // the single group of an older version, named by the reader
        Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === undefined) { r.group = legacy || ''; minePut(r).catch(function () {}); } });
      }).catch(function () {});
    })();
    }
    function minePut(r) {
      mine[r.id] = r; mineFlag();
      return V.draftDo('readwrite', function (st) { return st.put(r, r.id); }, 'mine');
    }
    function mineShown() { return Object.keys(mine).map(function (k) { return mine[k]; }).filter(function (r) { return !r.hidden; }); }
    // the reader's groups (each named at once when added, no predefined name): as many as they
    // like, each named when made, kept in their browser in the order made (atlas-mine-groups); a map in no group stands
    // at the top of the list. Never a name of the site's groups or another of theirs (the two would merge)
    var GROUPS_KEY;
    function __run4() {   // run at start, in order (__start)
    GROUPS_KEY = 'atlas-mine-groups';
    }
    function mineGroups() {
      try { var a = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (g) { return typeof g === 'string' && g; }) : []; } catch (e) { return []; }
    }
    function mineGroupsSet(a) { try { if (a.length) localStorage.setItem(GROUPS_KEY, JSON.stringify(a)); else localStorage.removeItem(GROUPS_KEY); } catch (e) {} }
    // kept for every atlas page of this address; on a page whose site has a group of the same name, that group of the
    // reader's is not shown (its maps stand at the top), so the two never merge
    var groupsHere;
    function __run5() {   // run at start, in order (__start)
    groupsHere = [];
    }
    function mineGroupsHere() {
      var site = (V.siteList || []).map(function (m) { return m.group; });
      return mineGroups().filter(function (g) { return site.indexOf(g) < 0; });
    }
    function ownGroup(name) { return !!name && groupsHere.indexOf(name) >= 0; }
    function sameName(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }   // as a Mac: case kept as typed, never told apart
    function groupTaken(v, was) {   // another group of this name, the site's or the reader's, whatever the case
      return !sameName(v, was || '') && (V.siteList || []).map(function (m) { return m.group || ''; }).concat(mineGroups(), V.listGroups()).some(function (g) { return g && sameName(g, v); });
    }
    function mineValid(v, was) { return v === was || !groupTaken(v, was); }
    // a name typed in place in the list, one way for groups and maps (inPlace): the field where the line was; Enter or a click elsewhere keeps it, Esc leaves it; o.bad(v) gives why a name is
    // refused (the field red, kept open). The list is not built again while it is open (V.naming, the viewer's
    // buildList), so a save or a folder scan meanwhile never drops what is being typed
    var naming;
    function __run6() {   // run at start, in order (__start)
    naming = null;
    }
    function inPlace(at, o) {
      if (naming) naming(true);
      var f = document.createElement('input'), done = false;
      f.type = 'text'; f.className = o.cls; f.maxLength = o.max; f.value = o.value; f.placeholder = o.label;
      f.setAttribute('aria-label', o.label);
      at.replaceWith(f);
      f.scrollIntoView({ block: 'nearest' });
      f.focus(); f.select();
      var end = naming = function (keep) {
        if (done) return; done = true; naming = null;
        o.end(keep ? f.value.trim() : null);
        V.refreshMine();
      };
      f.addEventListener('input', function () { f.classList.remove('m2-bad'); f.title = ''; });
      f.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') return end(false);
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var why = o.bad && o.bad(f.value.trim());
        if (why) { f.classList.add('m2-bad'); f.title = why; return; }
        end(true);
      });
      f.addEventListener('blur', function () {
        if (!document.hasFocus()) return;   // another window or tab: the field waits, its blur comes when the reader clicks elsewhere here
        if (pressed) document.addEventListener('click', function () { setTimeout(function () { end(true); }, 0); }, { once: true, capture: true });
        else end(true);   // a press elsewhere (a map) gets its click before the list is built again
      });
    }
    // a group's name: Rename group, a double-click on its name, or a new group (Add group): made at once as New group,
    // first of the reader's groups, its name then typed in place as a rename; a new group left empty or with Esc is not
    // made; a name already taken is refused
    // A site group renamed (the same field, a double-click or Rename group): every map shown in it moves to the new name,
    // kept in this browser at once (V.setMoved); with a token its maps' pages get the new group in one commit, and an
    // example among them becomes the reader's (example: dropped; Restore example maps then brings the examples back
    // beside it, examplesToSite). Maps with no page of their own (the group SBGN-ML, the external ones) are renamed in
    // this browser only, as their group comes from the build
    function canRenameGroup(name) { return !!name && (ownGroup(name) || V.listGroups().indexOf(name) >= 0); }
    function renameSiteGroup(was) {
      if (naming) naming(true);   // the open field ends first: it rebuilds the list, so the heading is looked up after it
      var at = document.getElementById('m2-list').querySelector('.m2-group:not(.m2-mine):not(.m2-bin)[data-group="' + CSS.escape(was) + '"]');
      if (!at) return;
      var clean = function (v) { return (v || '').replace(/["\\]/g, '').trim(); };   // as the pages' front matter holds it
      var taken = function (v) { return v !== was && groupTaken(v, was); };
      inPlace(at, { cls: 'm2-group-edit', max: 60, value: was, label: 'Name of the group',
        bad: function (v) { v = clean(v); return v && taken(v) ? 'A group of this name is in the list already' : ''; },
        end: function (v) {
          v = clean(v);
          if (!v || v === was || taken(v)) return;
          var ex = (V.siteList || []).filter(function (m) { return m.example; }).map(function (m) { return m.id; });   // examples it holds lose the mark; an undo gives it back
          var fwd = siteGroupRename(was, v);
          listDid(function () { return fwd.then(function () { return siteGroupRename(v, was, ex); }); }, function () { return siteGroupRename(was, v); });
        } });
    }
    function siteGroupRename(was, v, ex) {   // a site group renamed: kept in this browser, with a token its maps' pages in one commit (ex: ids marked example again)
      var gh = !!(repo() && token()), pages = [];
      (V.siteList || []).forEach(function (m) {   // every map of the group, also one in Deleted or hidden as an example
        var g = V.movedOf(m.id); if (g === null) g = m.group || '';
        if (g !== was) return;
        V.setMoved(m.id, v);
        if (gh && canRename(m, true)) pages.push(m.id);
      });
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === was) { r.group = v; minePut(r).catch(function () {}); } });
      V.regroupRename(was, v);   // the reader's order of groups and of the maps in it, and maps moved into it
      if (V.closed[was]) { V.closed[v] = true; delete V.closed[was]; V.saveClosed(); }
      V.refreshMine();
      return pages.length ? siteGroupTo(pages, v, ex).catch(function (e) { alert(was + ' was not renamed on the site: ' + (e && e.message ? e.message : e) + '. The new name is kept in this browser only.'); }) : Promise.resolve();
    }
    function siteGroupTo(ids, g, ex) {   // maps/<id>.md of every map given: group g, example: dropped; one commit on the pages as
      // the commit read has them (a page gone meanwhile left out), three tries
      var tries = 0, post = ghPost;
      var go = function () {
        return api('/git/ref/heads/main').then(ghJson).then(function (ref) {
          return Promise.all(ids.map(function (id) {
            return api('/contents/maps/' + encodeURIComponent(id) + '.md?ref=' + ref.object.sha).then(function (r) { return r.status === 404 ? null : ghJson(r); }).then(function (d) {
              if (!d) return null;
              var md = textOf(d.content), fm = /^---(\r?\n)([\s\S]*?)\r?\n---/.exec(md);
              if (!fm) return null;
              var head = fm[2].replace(/^group:[^\r\n]*/m, 'group: ' + JSON.stringify(g)).replace(/^example:.*(\r?\n|$)/m, '').replace(/\r?\n$/, '');
              if ((ex || []).indexOf(id) >= 0) head += fm[1] + 'example: true';
              if (!/^group:/m.test(head)) head += fm[1] + 'group: ' + JSON.stringify(g);
              return { path: 'maps/' + id + '.md', mode: '100644', type: 'blob', content: '---' + fm[1] + head + md.slice(3 + fm[1].length + fm[2].length) };
            });
          })).then(function (tree) {
            tree = tree.filter(Boolean);
            if (!tree.length) return;
            return api('/git/commits/' + ref.object.sha).then(ghJson).then(function (c) { return post('/git/trees', { base_tree: c.tree.sha, tree: tree }); })
              .then(function (t) { return post('/git/commits', { message: 'Group renamed in the viewer: ' + g, tree: t.sha, parents: [ref.object.sha] }); })
              .then(function (n) { return post('/git/refs/heads/main', { sha: n.sha }, 'PATCH'); });
          });
        }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
      };
      return go();
    }
    function renameGroup(was) {
      if (was && !ownGroup(was)) return renameSiteGroup(was);
      if (naming) naming(true);   // the open field ends first: it rebuilds the list, so the line is looked up after it
      var box = document.getElementById('m2-list'), at = null, fresh = null;
      if (!was) {
        fresh = was = 'New group';
        for (var k = 2; !mineValid(was); k++) was = fresh + ' ' + k;
        fresh = was;
        mineGroupsSet([was].concat(mineGroups()));
        V.refreshMine();
      }
      if (!(at = box.querySelector('.m2-group.m2-mine[data-group="' + CSS.escape(was) + '"]'))) {   // not in sight (a search): no new group left behind
        if (fresh) { mineGroupsSet(mineGroups().filter(function (g) { return g !== fresh; })); V.refreshMine(); }
        return;
      }
      inPlace(at, { cls: 'm2-group-edit', max: 60, value: was || '', label: 'Name of the group',
        bad: function (v) { return v && !mineValid(v, was) ? 'A group of this name is in the list already' : ''; },
        end: function (v) {
          if (fresh && (!v || !mineValid(v, was))) return mineGroupsSet(mineGroups().filter(function (g) { return g !== fresh; }));
          if (!v || v === was || !mineValid(v, was)) {   // a new group kept under the name it was made with
            if (fresh) listDid(function () { removeGroup(fresh); }, function () { groupBack(fresh, 0); });
            return;
          }
          ownGroupTo(was, v);
          if (fresh) listDid(function () { removeGroup(v); }, function () { groupBack(v, 0); });
          else listDid(function () { ownGroupTo(v, was); V.refreshMine(); }, function () { ownGroupTo(was, v); V.refreshMine(); });
        } });
    }
    function ownGroupTo(was, v) {   // a group of the reader's renamed: its maps, site maps moved into it, its order and whether it is closed follow
      var gs = mineGroups(), k = gs.indexOf(was);
      if (k < 0) return;
      gs[k] = v;
      Object.keys(mine).forEach(function (id) { var r = mine[id]; if (r.group === was) { r.group = v; minePut(r).catch(function () {}); } });
      V.regroupRename(was, v);
      if (V.closed[was]) { V.closed[v] = true; delete V.closed[was]; V.saveClosed(); }
      mineGroupsSet(gs);
    }
    function groupBack(name, at) { var gs = mineGroups().filter(function (g) { return g !== name; }); gs.splice(Math.min(at, gs.length), 0, name); mineGroupsSet(gs); V.refreshMine(); }
    var pressed;
    function __run7() {   // run at start, in order (__start)
    pressed = false;
    document.addEventListener('pointerdown', function () { pressed = true; }, true);
    document.addEventListener('pointerup', function () { setTimeout(function () { pressed = false; }, 0); }, true);
    }
    function removeGroup(name) {   // the group goes, its maps stay, at the top of the list
      mineGroupsSet(mineGroups().filter(function (g) { return g !== name; }));
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === name) { r.group = ''; minePut(r).catch(function () {}); } });
      V.regroupRename(name, null);   // site maps moved into it back to their own groups
      if (V.closed[name]) { delete V.closed[name]; V.saveClosed(); }
      V.refreshMine();
    }
    // the right-click menu over the list, where the Edit tab is: on a map Rename map, Make a copy, Move to, or on a group
    // of theirs Rename group, first; then New SBGN-ML map, New CellDesigner map, Add map from file (into the group
    // clicked, if it is the reader's or with a token the site's, else at the top), Add group; Delete map, or Remove group and Delete group
    // last of all (items.last). The viewer asks for them (listItems) and shows the menu, its own entries (Open all groups, ...) between
    var addTo;
    function __run8() {   // run at start, in order (__start)
    addTo = '';
    }
    function listItems(e) {
      var t = e.target.closest('.m2-map, .m2-group, .m2-empty'), m = t && t.classList.contains('m2-map') ? V.byId[t.dataset.id] : null;
      var gh = !!(repo() && token()), tg = t && !t.classList.contains('m2-link-group') && t.dataset.group;   // with a token a site group takes maps too
      var g = m ? (m.mine || gh ? m.group || '' : '') : tg && (ownGroup(tg) || gh) ? tg : '', onGroup = t && !m && ownGroup(g);
      var into = m ? m.group || '' : tg && (ownGroup(tg) || V.siteGroupOf(tg) || t.classList.contains('m2-empty')) ? tg : '';   // a new map: into the group clicked, whoever's it is
      var items = [['New SBGN-ML map', function () { listMade(function () { return newMap(into); }); }], ['New CellDesigner map', function () { listMade(function () { return newMap(into, 'cd'); }); }], ['Add map from file', function () { addTo = g; picker.click(); }], ['Add group', function () { renameGroup(null); }]];
      if (canRestoreExamples()) items.push(['Restore example maps', restoreExamples]);   // maps back into the list, rarely: the group's end
      var editing = V.grid.classList.contains('m2-editing') && V.chosen && V.chosen.id === (m && m.id);   // while editing, current is the editor's own
      // Deleted (as a mailbox's or the Mac's Bin): on a map in it Restore, then Delete forever last; on its heading
      // Delete all forever. Nothing else there (a deleted map is not renamed, copied, moved or edited)
      if (m && m.binned) { var bi = [['Restore', function () { restoreU(m); }]]; bi.last = [['Delete forever', function () { erase([m]); }]]; return bi; }
      if (t && t.dataset.bin) { var bh = [], gone = V.maps.filter(function (x) { return x.binned; }); if (gone.length) bh.last = [['Delete all forever', function () { erase(gone); }]]; return bh; }   // an empty Deleted: nothing to delete
      // on a map: Rename map, Make a copy, Move to, at the top; Delete map last of all, under a line of its own, away
      // from the others (as the map's menu: not while it is edited)
      var mapItems = [], x = e.clientX, y = e.clientY;
      // on one of several maps selected (the viewer's picked, as in Finder): Move N maps to... and Delete N maps, for
      // those that can be; a right click on a map outside the selection makes it the selection alone
      var sel = V.picked();
      if (m && sel.indexOf(m.id) < 0) V.pickSet([]);   // a map outside the selection: the selection is that map
      else if (m && sel.length > 1) {
        var ms = sel.map(function (id) { return V.byId[id]; }).filter(Boolean), mv = ms.filter(movable), del = ms.filter(function (x) { return canDelete(x, gh) && !(V.grid.classList.contains('m2-editing') && V.chosen && V.chosen.id === x.id); });
        if (mv.length && V.listGroups().length) mapItems.push(['Move ' + mv.length + ' maps to...', function () { moveMenuMany(mv, x, y); }]);
        items = mapItems.length ? mapItems.concat([null], items) : items;
        if (del.length) items.last = [['Delete ' + del.length + ' maps', function () { binU(del, true); }, false, DEL_KEY]];
        return items;
      }
      if (m && canRename(m, gh)) mapItems.push(['Rename map', function () { renameMap(m.id); }]);
      if (m && canCopy(m)) mapItems.push(['Make a copy', function () { listMade(function () { return copyMap(m.id); }); }]);
      if (m && movable(m) && V.listGroups().length) mapItems.push(['Move to...', function () { moveMenu(m, x, y); }]);
      // the clicked map's or group's own items first, as file lists keep them; the new maps and groups under a line
      if (mapItems.length) items = mapItems.concat([null], items);
      items.mapItems = mapItems.length;   // the viewer puts the map's downloads after them
      var siteG = t && !m && tg && !ownGroup(tg) && !t.dataset.bin && canRenameGroup(tg) ? tg : null;   // a site group: renamed too
      if (onGroup || siteG) items = [['Rename group', function () { renameGroup(siteG || g); }], null].concat(items);
      // items.last: put by the viewer under its own entries too, so Delete map is the menu's last line
      if (onGroup) items.last = [['Remove group', function () { removeU(g); }]];   // a removal: last, as Delete map
      var dg = t && !m && tg && !t.dataset.bin ? groupMaps(tg, gh) : null;   // Delete group: its maps into Deleted, each remembering its group
      if (dg && (dg.length || (onGroup && !inGroup(tg).length))) (items.last = items.last || []).push(['Delete group', function () { deleteGroupU(tg, dg); }, false, DEL_KEY]);
      if (m && !editing && canDelete(m, gh)) items.last = [['Delete map', function () { binU([m]); }, false, DEL_KEY]];   // one on the site already: with a token, its page there too
      return items;
    }
    // a reader's own map moved to another group, theirs or the site's ('': no group, at the top of the list): by Move to
    // in the list's menu or by dragging it there (the viewer's dropPlace); put before the map `before`, else at the
    // group's end. A map on its way to the site goes where the site puts it, so it is not moved
    // A site map too: kept in this browser (V.setMoved), and with a token written to its maps/<id>.md (group, and order
    // after the group's last on the site), as Rename map; the build's own maps (no page of their own) stay in this browser
    function movable(m) {
      if (!m || m.shownAs) return false;
      var r = m.mine && mine[m.id]; return m.mine ? !!r && !r.site : true;
    }
    function moveTo(id, g, before, k, many) {   // k: its place among `many` maps moved together (their order on the site); before true: first in the group (Move to)
      g = g || '';
      var m = V.byId[id], r = mine[id], sent = null;
      if (r) { r.group = g; minePut(r).catch(function () {}); }
      else if (m) {
        if (g !== (m.group || '')) {   // a reorder in its own group is the reader's order alone
          // to the site with a token, the move kept in this browser too until the build has it; a reader's group stays theirs
          // (its name never written to the site, where it would merge with theirs); the build's own maps (no page) here only
          if (repo() && token() && canRename(m, true) && !ownGroup(g)) g = g.replace(/["\\]/g, '');
          V.setMoved(id, g);
          if (repo() && token() && canRename(m, true) && !ownGroup(g)) sent = toSiteGroup(id, g, k, before === true ? many || 1 : 0).then(function () { return true; }, function (e) {
            if (!e || !e.noPage) alert((m.topic || m.title) + ' was not moved on the site: ' + (e && e.message ? e.message : e) + '. The move is kept in this browser only.');
            return false;
          });
        }
      } else return Promise.resolve();
      put(id, g, before);
      // into another group where its name is taken for its format: renamed "<name> (1)", Finder's Keep both, once the move
      // is written. A site map's new name goes where its move went: its page with a token into one of the site's groups,
      // else this browser (no token, a group of the reader's own, a map with no page), so no group ever shows two
      var moved = !!m && g !== (m.group || ''), n = m && mapName(m);
      var keep = moved && nameTaken(n, g, fmtOf(m), id, m.tab), local = !r && !(canRename(m, !!(repo() && token())) && !ownGroup(g));
      return Promise.resolve(sent).then(function (ok) {
        if (keep) { nameTo(V.byId[id] || m, freeTitle(n, g, fmtOf(m), null, id, m.tab), local || ok === false); V.refreshMine(); }
      });
    }
    function moveMany(ids, g, before) {   // several maps selected, one after another (each a commit with a token), in their order
      var top = before === true, run = top ? ids.slice().reverse() : ids;   // first in the group: the last put first, so they keep their order
      return run.reduce(function (p, id) { return p.then(function () { return moveTo(id, g, before, ids.indexOf(id), ids.length); }); }, Promise.resolve());
    }
    var pageWas;
    function __run9() {   // run at start, in order (__start)
    pageWas = {};
    }   // a page's order as the last move found it (moveU's undo puts it back; the build's may lag)
    function toSiteGroup(id, g, k, top) {   // maps/<id>.md: its group and its order (after the group's last, k after it; top: n maps before its first); one commit
      var at = top ? siteFirst(g) - top + (k | 0) : siteOrder(g) + (k | 0);
      return siteFront(id, function (f) { pageWas[id] = { order: f.get('order') }; f.set('group', JSON.stringify(g.replace(/["\\]/g, ''))); f.set('order', String(at)); f.drop('example'); }, 'Map moved in the viewer');   // moved out of its group: the reader's
    }
    function put(id, g, before) {   // a map into the reader's order of group g, the group opened so the map stays in sight
      if (g && V.closed[g]) { delete V.closed[g]; V.saveClosed(); }
      V.placeMap(id, g, before); V.refreshMine();
    }
    function moveMenuMany(ms, x, y) {   // the groups several maps can go to, in the list's order
      var site = (V.siteList || []).map(function (s) { return s.group; }), ids = ms.map(function (m) { return m.id; });
      var gs = V.listGroups().filter(function (n) { return n && (ownGroup(n) || site.indexOf(n) >= 0); });
      V.listMenu(x, y, [['No group', function () { V.pickSet([]); moveU(ids, '', true); }], null].concat(gs.map(function (n) {
        return [n, function () { V.pickSet([]); moveU(ids, n, true); }];
      })));
    }
    function moveMenu(m, x, y) {   // the groups the map can go to, in the list's order; its own greyed
      var site = (V.siteList || []).map(function (s) { return s.group; });
      var gs = V.listGroups().filter(function (n) { return n && (ownGroup(n) || site.indexOf(n) >= 0); });
      V.listMenu(x, y, [['No group', function () { moveU([m.id], '', true); }, !m.group], null].concat(gs.map(function (n) {
        return [n, function () { moveU([m.id], n, true); }, n === m.group];
      })));
    }
    // Make a copy, in the list's menu: a new map named Copy of <name> (as in Google Docs), in the same group right under
    // the original, opened at once (no name field: one command at a time, as Finder's Duplicate). Of a reader's own map, or of the site's
    // GraphML or CellDesigner map as it is now (the edits this page holds, else GitHub's version, else the site's);
    // with a token every copy goes to the site, as Add map does (an SBGN-ML one only made here)
    function canCopy(m) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] : !!graphmlOf(m) && (!sbMap(m) || /^maps\/[^/]+\.sbgn$/.test(m.editPath || '') && !!m.madeHere)); }   // an SBGN-ML map of the site's own made with New map (build.py made_here; copyOf refuses another editor's), not one of its groups'
    // Names as in Finder, the format being the extension the list shows: two maps may share a name unless they are in
    // the same group and of the same format. A name taken there is refused when typed (Rename map); a name the viewer
    // makes (Make a copy, New map, Add map from file), or a clash a move or a Restore brings, takes (1), (2), ... after it
    function fmtOf(m) { return (((m.site || m).downloads || [])[0] || {}).label || ''; }   // its own file's, also while Source shows its SBGN-ML
    function fmtOfText(t) { return isCd(t) ? 'CellDesigner' : isSb(t) ? 'SBGN-ML' : 'GraphML'; }
    function mapName(m) { return m.mine ? m.title : m.topic || m.title; }
    function bare(v) { return String(v || '').replace(/["\\]/g, '').trim(); }   // as a site page keeps a name
    function nameTaken(name, group, fmt, id, tab) {   // another map of this name (and tab, as the list shows them) and format in the group, Deleted left out
      var key = bare(name) + (tab ? ' (' + tab + ')' : ''), seen = {};
      var all = (V.maps || []).concat(mineShown().map(function (r) { return { id: r.id, mine: true, title: r.title, group: r.group || '', downloads: [{ label: fmtOfText(r.text) }] }; }));   // records not in the list yet
      return all.some(function (m) {
        if (seen[m.id]) return false; seen[m.id] = 1;
        return m.id !== id && !m.binned && !m.deleted && (m.group || '') === (group || '') && fmtOf(m) === fmt && sameName(bare(mapName(m)) + (m.tab ? ' (' + m.tab + ')' : ''), key);
      });
    }
    function freeTitle(t, group, fmt, also, id, tab) {   // t, else t (1), t (2), ... free in the group for that format (nor one of also)
      var f = t;
      for (var k = 1; nameTaken(f, group, fmt, id, tab) || (also || []).some(function (a) { return sameName(a, f); }); k++) f = t + ' (' + k + ')';
      return f;
    }
    function nameTo(m, v, local) {   // a map's name set: the reader's record (and its page, once on the site), a site map's page, or with local this browser's name of it
      var shown = mapName(m);
      if (!v || v === shown) return;
      if (m.mine) {
        var r = mine[m.id]; if (!r) return;
        r.title = v; minePut(r).catch(function () {});
        if (r.site) {   // its page on the site too, the list's name over the site's until the build has it
          var sid = r.site, was0 = renamed[sid] ? renamed[sid].was : r.siteTitle || shown;
          renamed[sid] = { was: was0, to: v };
          var sent = toSiteName(sid, shown, v).catch(function (e) { delete renamed[sid]; alert(shown + ' was not renamed on the site: ' + (e && e.message ? e.message : e)); });
        }
        if (V.current && V.current.id === m.id) {   // the map on screen, and the editor's own name of it
          document.getElementById('m2-title').textContent = v;
          if (map && map.id === m.id) map.title = v;
        }
        return sent;
      } else if (local) {
        renamed[m.id] = { was: renamed[m.id] ? renamed[m.id].was : (V.siteList || []).filter(function (x) { return x.id === m.id; }).map(function (x) { return x.topic; })[0] || shown, to: v, local: true };
        namedSave();
      } else {
        var was = renamed[m.id] ? renamed[m.id].was : shown;
        renamed[m.id] = { was: was, to: v };
        return toSiteName(m.id, shown, v).catch(function (e) { delete renamed[m.id]; V.refreshMine(); alert(shown + ' was not renamed: ' + (e && e.message ? e.message : e)); });
      }
    }
    function freeFile(name) {   // a file name no map of the reader's has (-2, -3, ... before the extension)
      var files = Object.keys(mine).map(function (k) { return mine[k].file; }), ext = (name.match(/\.[^.]+$/) || [''])[0], base = name.slice(0, name.length - ext.length), f = name;
      for (var k = 2; files.indexOf(f) >= 0; k++) f = base + '-' + k + ext;
      return f;
    }
    // a map's text as it is now: the editor's own while it is edited (every move in), the reader's record, this browser's
    // draft, the text the viewer keeps, GitHub's version, else the site's file (also when GitHub cannot be read)
    function textNow(m) {
      if (on && site && site.id === m.id) return Promise.resolve(src());
      if (m.mine) return Promise.resolve(mine[m.id].text);
      var t = V.drafts[m.id] && V.drafts[m.id].text || heldText(m);
      if (t) return Promise.resolve(t);
      var p = ahead(m);
      if (!p) return Promise.reject(new Error('its file is not known'));
      return Promise.all([p.sitePub, p.gh.catch(function () { return null; })]).then(function (x) { return x[1] ? x[1].text : x[0]; });
    }
    function copyMap(id) {
      if (naming) naming(true);
      var m = V.byId[id]; if (!m || !canCopy(m)) return;
      var r0 = m.mine ? mine[id] : null;
      return copyOf(m, null, 'Copy of ' + (r0 ? r0.title : m.topic || m.title), true).catch(function (e) { alert('No copy was made: ' + (e && e.message ? e.message : e)); });
    }
    // a map of the reader's made from map m, right under it in its group, in every way maps are kept (GitHub with a token,
    // else this browser and the folder): its text, t() (no t: m's text now), named name (made free in the group); go (or
    // go() once made): shown once made, after made(record). Gives the new record. The format, the extension and the name
    // check follow the text, so a tool's text of another format (fromTool) lands as its own kind; a text the reader's
    // maps cannot take is refused as Add map refuses it
    function copyOf(m, t, name, go, made) {
      var id = m.id, r0 = m.mine ? mine[id] : null, group = m.group || '', fmt = fmtOf(m), title = freeTitle(name, group, fmt), next = after(id);   // next: read before the copy is in the list
      var slug = function (v) { return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map'; };   // a name of no letters a to z (another script, signs): never an empty file name
      var ext = r0 ? (r0.file.match(/\.[^.]+$/) || ['.xml'])[0] : cdMap(m) ? '.xml' : sbMap(m) ? '.sbgn' : '.graphml';
      var file = freeFile(slug(title) + ext);
      var gh = !!(repo() && token());
      return mineIn.then(function () { return t ? t() : textNow(m); }).then(function (t) {
        if (isSb(t) && !madeHere(t)) throw new Error(otherSb());
        if (fmtOfText(t) !== fmt) { title = freeTitle(name, group, fmtOfText(t)); ext = isCd(t) ? '.xml' : isSb(t) ? '.sbgn' : '.graphml'; file = freeFile(slug(title) + ext); }
        if (gh) { ext = siteExt(t); if (!ext) throw new Error(siteWhy(t)); }
        var made = r0 && t === r0.text ? Promise.resolve({ svg: r0.svg, width: r0.width, height: r0.height }) : drawText(t);
        return made.then(function (d) {
          var r = { id: newId(), title: title, file: file, text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(t), hidden: false, group: group };
          if (!gh) return minePut(r).then(function () { toFolder(r.id, r.file, r.text); return r; });
          return toSite(title, ext, t, group, siteOrder(group)).then(function (s) { return minePut(onSite(r, s, title)).then(function () { return r; }); });
        });
      }).then(function (r) {
        put(r.id, group, next);
        if (made) made(r);
        if (typeof go === 'function' ? go() : go) V.go(r.id); else V.refreshMine();
        return r;
      });
    }
    // The save clash: a map changed elsewhere since this page opened it (on GitHub, or by another tab of the site in
    // this browser or the folder) is never written over. The reader's version, its text t(), is kept as a map of their own
    // right under it, named '<name> (your version)', and editing goes on there; no merge. Gives the copy's title
    function keepBeside(id, t, said) {   // said(title, id, name): the copy made (its name and list id; the map's name), before it is opened
      var m = V.byId[id]; if (!m) return Promise.reject(new Error('the map is no longer in the list'));
      if (!canCopy(m)) return Promise.reject(new Error('a map of this kind cannot be copied'));
      var r0 = m.mine ? mine[id] : null, was = r0 ? r0.title : m.topic || m.title;
      var still = function () { return on && site && site.id === id; };   // still being edited once the copy is made: editing goes on there
      return copyOf(m, t, was + ' (your version)', still, function (r) {
        var now = t();   // moves made on the map while the copy was drawn and sent: the copy takes them
        if (now !== r.text) { r.text = now; mine[r.id] = r; minePut(r).catch(function () {}); if (!(repo() && token())) toFolder(r.id, r.file, now); }
        said(r.title, r.id, was);
      });
    }
    // A tool's text as a new map of the reader's, right under its source (map id) in its group, opened, in every way maps
    // are kept (copyOf), one step of the list's undo (into Deleted, as a copy). name: the tool's, else '<source> (label)'
    // given by the caller. Gives { id, name }; a text the reader's maps cannot take is refused, nothing added
    function fromTool(id, text, name) {
      var m = V.byId[id]; if (!m) return Promise.reject(new Error('the map is no longer in the list'));
      if (m.binned) return Promise.reject(new Error('the map is in Deleted'));   // its group may be gone and its place is Deleted's: restored first
      if (naming) naming(true);
      var t = String(text == null ? '' : text), out = null, err = null;
      name = String(name == null ? '' : name).replace(/\s+/g, ' ').trim() || 'Unnamed map';   // a tool's name taken as text, as a typed name
      var go = function () {
        return listMade(function () { return copyOf(m, function () { return t; }, name, true, function (r) { out = r; }).catch(function (e) { err = e; }); })
          .then(function () { if (err) throw err; return { id: out.id, name: out.title }; });
      };
      var p = (toolLast || Promise.resolve()).then(go, go);   // one at a time: two at once would take the same free name and file, and one undo step would claim both maps
      toolLast = p.catch(function () {});
      return p;
    }
    var toolLast;   // the last map a tool asked for, made or refused
    // what is kept in this browser now for a map edited without GitHub: its draft, or the reader's record (null: none),
    // read afresh, as another tab of the site may have written it since this page opened the map
    // A clash found: this page's copy of the record taken from what was read, so opening the map again shows the newer version
    function keptNow(s) {
      return V.draftDo('readonly', function (st) { return st.get(s.id); }, s.mine ? 'mine' : 'maps').then(function (r) {
        var k = r ? r.text : null;
        if (k !== s.known) { if (s.mine) { if (r) mine[s.id] = r; } else if (r) V.drafts[s.id] = r; else if (V.drafts[s.id]) { delete V.drafts[s.id]; V.draftIds(); } }
        return k;
      });
    }
    function siteFirst(group) { var os = (V.siteList || []).filter(function (s) { return s.group === group; }).map(function (s) { return s.order || 0; }); return os.length ? Math.min.apply(null, os) : 1; }   // the group's first on the site
    function siteOrder(group) { return (V.siteList || []).reduce(function (a, s) { return (!group || s.group === group) ? Math.max(a, s.order || 0) : a; }, 0) + 1; }   // after the group's last on the site
    function after(id) {   // the map after id in its group, so a copy lands right under the original
      var ms = V.maps, i = ms.findIndex(function (x) { return x.id === id; });
      return i >= 0 && ms[i + 1] && (ms[i + 1].group || '') === (ms[i].group || '') ? ms[i + 1].id : null;
    }
    function __run10() {   // run at start, in order (__start)
    try { localStorage.removeItem('atlas-examples'); } catch (e) {}
    }   // the choice of hiding example maps, removed: the maps shown again
    function letGo(url) {   // an old version's address let go once nothing on the page uses it (a link or picture shown, the map on screen)
      setTimeout(function () {
        var used = (V.current && (V.current.image === url || (V.current.downloads || []).some(function (d) { return d.url === url; }))) ||
          Array.prototype.some.call(document.querySelectorAll('a[href], img[src]'), function (e) { return e.getAttribute('href') === url || e.getAttribute('src') === url; });
        if (used) letGo(url); else URL.revokeObjectURL(url);
      }, 10000);
    }
    function mineEntry(r) {
      var u = mineURLs[r.id];
      if (!u || u.at !== r.at) {   // new addresses for a new version, the old ones let go
        if (u) { letGo(u.svg); letGo(u.text); }
        u = mineURLs[r.id] = { at: r.at, svg: URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' })), text: URL.createObjectURL(new Blob([r.text], { type: 'application/xml' })) };
      }
      var cdm = isCd(r.text), sbm = !cdm && isSb(r.text);
      var e = { id: r.id, title: r.title, group: r.group && (groupsHere.indexOf(r.group) >= 0 || V.siteGroupOf(r.group)) ? r.group : '', topic: r.id, mine: true, file: r.file, width: r.width, height: r.height, v: String(r.at),
        image: u.svg, colours: true, legend: cdm ? 'celldesigner' : 'sbgn', downloads: [{ label: cdm ? 'CellDesigner' : sbm ? 'SBGN-ML' : 'GraphML', url: u.text }] };
      // colours: its picture drawn with the role classes (drawText, core.js), so Settings' Map colours (File, Default) apply
      if (sbm) { e.editBase = emptyBase(); e.editPath = r.file; }   // made here (New map): edited as a site's SBGN-ML map, from the empty base (sbgn.js)
      return e;
    }
    // with a token a map added goes to the site (toSite): until the site's build has it, it is shown from this
    // browser as a reader's map with `site` (its id there), dropped once the site lists that id built from its last save
    // (withMine; arrived: the old id to the site's, so the map shown follows). atlas-hidden-maps: the site's maps an older
    // version's Remove map hid in this browser only; read until they are moved into Deleted (binMigrate)
    var HIDDEN_KEY;
    function __run11() {   // run at start, in order (__start)
    HIDDEN_KEY = 'atlas-hidden-maps';
    }
    function hiddenSet(ids) { try { if (ids.length) localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids)); else localStorage.removeItem(HIDDEN_KEY); } catch (e) {} }
    function siteHidden() { try { var a = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    // A map on its way to the site stays the reader's until the build is of its last save (the entry's src, the file's
    // blob sha) and nothing of it waits: not while it is edited, not with moves GitHub does not have yet (then
    // the site's entry is left out meanwhile); an hour on, the build is taken as it is
    function withMine(list) {
      var ids = {}, held = {}; list.forEach(function (m) { ids[m.id] = m; });
      Object.keys(mine).forEach(function (k) {
        var r = mine[k], s = r.site && ids[r.site];
        if (!s) return;
        var waits = (on && site && site.id === k) || (r.saved != null && r.text !== r.saved);
        if (waits || (r.sha && s.src && s.src !== r.sha && Date.now() - r.at < 3600000)) { held[r.site] = 1; return; }
        V.arrived[k] = r.site; delete mine[k]; delete mineURLs[k]; mineFlag();
        V.draftDo('readwrite', function (st) { return st.delete(k); }, 'mine').catch(function () {});
        if (location.hash.slice(1) === k) setTimeout(function () { if (location.hash.slice(1) === k && V.byId[r.site]) V.go(r.site); }, 0);   // shown: the site's map in its place
      });
      list = siteNamed(list.filter(function (m) { return !held[m.id]; }));
      var hid = siteHidden(), gh = !!(repo() && token()), pend = binPending(), n0 = Object.keys(pend).length, binned = [];
      list = list.filter(function (m) {
        if (hiddenGone[m.id]) return false;   // deleted forever here, the build not run since
        var tb = twinBase(m), tp = tb && (ids[tb + '-graphml'] || ids[tb]), d = tp && m.deleted && m.deleted === tp.deleted ? binState(tp, pend) : (tp && binState(tp, pend)) || binState(m, pend);   // a twin in Deleted with its GraphML map (the build gives it the same date), or on its own
        if (!d && (!gh || hid.indexOf(m.id) < 0)) return true;   // an older version's hiding: without a token no longer hides (a map is kept or deleted), with one it is in Deleted until moved there (binMigrate)
        if (gh) binned.push(Object.assign({}, m, { binned: d ? Date.parse(d) || Date.now() : Date.now() }));   // deleted: seen in Deleted with a token, else not at all
        return false;
      });
      if (Object.keys(pend).length !== n0) binPendingSet(pend);   // entries the build has now let go
      var own = mineShown().sort(function (a, b) { return a.title.localeCompare(b.title); }).map(mineEntry);
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.hidden) binned.push(Object.assign(mineEntry(r), { binned: r.deleted || r.at })); });
      return own.concat(list, binned);
    }
    // Example maps: the site's maps whose pages say example: true (and the SBGN-ML twins of those in the group GraphML);
    // every other map is the reader's, whoever or whatever made it. They are never hidden (a map is kept or
    // deleted, as in Finder; hiding them was removed). Restore example maps puts them back as the
    // site's backup keeps them: the data repository's examples/, the same paths as in maps/. With a token one commit
    // copies it over maps/ (an example deleted, even forever, comes back) and drops their edited SBGN-ML copies
    // (maps/sbgn-ml/<name>-sbgn.sbgn), so the build writes those again from the GraphML maps; in this browser, with or
    // without a token, their drafts, Deleted marks, moves to other groups and names given meanwhile are let go
    var exBackup;
    function __run12() {   // run at start, in order (__start)
    exBackup = null;
    }   // with a token: whether the data repository has examples/, asked once
    function backupKnown() {
      if (exBackup !== null || !(repo() && token())) return;
      exBackup = false;
      api('/contents/examples?ref=main').then(function (r) { exBackup = r.ok; }, function () { exBackup = null; });
    }
    function exampleIds() { return (V.siteList || []).filter(function (m) { return m.example; }).map(function (m) { return m.id; }); }
    function canRestoreExamples() {
      if (V.grid.classList.contains('m2-editing') && V.chosen && V.chosen.example) return false;   // its moves would be saved over the restored file (while editing, current is the editor's own)
      backupKnown();
      return exampleIds().length > 0 || (exBackup === true && !!(repo() && token()));
    }
    function restoreExamples() {
      var gh = !!(repo() && token());   // nothing asked: the examples' earlier versions stay in the data repository's history
      // shown restored at once; with a token GitHub's commit follows, and if it fails the list goes back as it was.
      // One step of the list's undo: the list and this browser's kept edits of the examples put back, with a token also
      // the files the restore changed on GitHub (examplesBack); redo restores again
      var ids = exampleIds(), was = examplesWas(ids), done = null;
      var fwd = run();
      function run() {
        examplesHere(ids, gh);
        if (!gh) return Promise.resolve();
        return examplesToSite().then(function (r) {
          done = r;
          examplesHere(r.ids.filter(function (id) { return ids.indexOf(id) < 0; }), gh);   // deleted forever before (or with no page of their own): shown once the build has them
        }).catch(function (e) {
          examplesPut(was);
          alert('The example maps were not restored: ' + (e && e.message ? e.message : e));
        });
      }
      listDid(function () {
        return fwd.then(function () {
          if (!gh || !done) { examplesPut(was); return; }
          return examplesBack(done.before).then(function () { examplesPut(was); }, function (e) { alert('The restore was not undone: ' + (e && e.message ? e.message : e)); });
        });
      }, function () { was = examplesWas(ids); done = null; fwd = run(); return fwd; });
    }
    function examplesAll(ids) { return ids.concat(ids.filter(function (id) { return /-graphml$/.test(id); }).map(twinOf)); }   // with their SBGN-ML twins
    function examplesWas(ids) {   // what a restore lets go: the list's records of these examples and this browser's kept edits
      var was = { ids: ids, pend: binPending(), hidden: siteHidden(), moved: {}, renamed: {}, gone: {}, drafts: {} };
      examplesAll(ids).forEach(function (id) { was.moved[id] = V.movedOf(id); was.renamed[id] = renamed[id]; was.gone[id] = hiddenGone[id]; if (V.drafts[id]) was.drafts[id] = V.drafts[id]; });
      return was;
    }
    function examplesPut(was) {   // the list and the kept edits as they were before a restore
      binPendingSet(was.pend); hiddenSet(was.hidden);
      Object.keys(was.moved).forEach(function (id) {
        V.setMoved(id, was.moved[id]);
        if (was.renamed[id]) renamed[id] = was.renamed[id]; else delete renamed[id];
        if (was.gone[id]) hiddenGone[id] = was.gone[id]; else delete hiddenGone[id];
      });
      namedSave();
      Object.keys(was.drafts).forEach(function (id) { draftPut(id, Object.assign({}, was.drafts[id])).catch(function () {}); });
      var m = V.current && V.byId[V.current.id];
      if (m && was.drafts[m.id] && !V.grid.classList.contains('m2-editing')) V.put(m, true);   // shown: with its kept edits again
      V.refreshMine();
    }
    // a restore's commit undone: each path it changed under maps/ put back as it was before (null: one it added goes),
    // in one commit on main, three tries; later commits to other paths kept
    function examplesBack(before) {
      var tries = 0;
      var go = function () {
        return api('/git/ref/heads/main').then(ghJson).then(function (ref) {
          return api('/git/commits/' + ref.object.sha).then(ghJson).then(function (c) {
            var tree = Object.keys(before).map(function (p) { return { path: p, mode: '100644', type: 'blob', sha: before[p] }; });
            return ghPost('/git/trees', { base_tree: c.tree.sha, tree: tree })
              .then(function (t) { return ghPost('/git/commits', { message: 'Example maps restored in the viewer: undone', tree: t.sha, parents: [ref.object.sha] }); })
              .then(function (n) { return ghPost('/git/refs/heads/main', { sha: n.sha }, 'PATCH'); })
              .then(function () { shared.ghDir = null; });
          });
        }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
      };
      return go();
    }
    function examplesHere(ids, gh) {   // this browser's changes to these examples (and their SBGN-ML twins) let go, the list drawn again
      var all = examplesAll(ids);
      var pend = binPending(), deleted = {};
      (V.siteList || []).forEach(function (m) { deleted[m.id] = m.deleted; });
      all.forEach(function (id) {
        if (gh && deleted[id]) pend[id] = ['', Date.now()]; else delete pend[id];   // in Deleted on the build still: out of it until the build has the restore
        unkeep(id).catch(function () {}); delete hiddenGone[id]; delete renamed[id]; V.setMoved(id, null);
      });
      namedSave();
      binPendingSet(pend);
      if (V.kept && all.indexOf(V.kept.id) >= 0) V.dropKept();
      var m = V.current && V.byId[V.current.id];
      if (m && all.indexOf(m.id) >= 0 && !V.grid.classList.contains('m2-editing')) V.put(m, true);   // shown: as the site has it
      hiddenSet(siteHidden().filter(function (id) { return all.indexOf(id) < 0; }));   // an older version's hiding
      V.refreshMine();
    }
    // examples/ over maps/ in one commit on main, three tries; the ids restored. An example the reader has made their own
    // (its page no longer says example: true: its group renamed, or the map moved to another group) is kept: its files
    // (maps/<id>.*, maps/extra/<id>/, its edited SBGN-ML twin, its Original record) go to a new id first, <name>-2-<format>,
    // and the example comes back beside it in its own group. One whose page still says example: true is renewed
    function examplesToSite() {
      var tries = 0, post = ghPost;
      var go = function () {
        return api('/git/ref/heads/main').then(ghJson).then(function (ref) {
          return api('/git/commits/' + ref.object.sha).then(ghJson).then(function (c) {
            return api('/git/trees/' + c.tree.sha).then(ghJson).then(function (root) {
              var at = function (n) { return root.tree.filter(function (f) { return f.path === n && f.type === 'tree'; })[0]; };
              if (!at('examples')) throw new Error('this site keeps no example maps to restore');
              return Promise.all([api('/git/trees/' + at('examples').sha + '?recursive=1').then(ghJson),
                at('maps') ? api('/git/trees/' + at('maps').sha + '?recursive=1').then(ghJson) : { tree: [] }]);
            }).then(function (x) {
              if (x[0].truncated || x[1].truncated) throw new Error('the maps are too many to read at once');
              var blobs = x[0].tree.filter(function (f) { return f.type === 'blob' && /^maps\//.test(f.path); });
              var ids = blobs.filter(function (f) { return /^maps\/[^/]+\.md$/.test(f.path); }).map(function (f) { return f.path.slice(5, -3); });
              if (!ids.length) throw new Error('the saved set is empty');
              var now = x[1].tree.filter(function (f) { return f.type === 'blob'; }), shaOf = {};   // paths under maps/
              now.forEach(function (f) { shaOf[f.path] = f.sha; });
              var saved = {}; blobs.forEach(function (f) { saved[f.path.slice(5)] = f.sha; });
              var changed = ids.filter(function (id) { return shaOf[id + '.md'] && shaOf[id + '.md'] !== saved[id + '.md']; });
              return Promise.all(changed.map(function (id) {   // a changed page: still an example, or the reader's now
                return api('/git/blobs/' + shaOf[id + '.md']).then(ghJson).then(function (b) {
                  var md = textOf(b.content);
                  return /^example:[ \t]*"?true"?[ \t]*\r?$/m.test(md) ? null : id;
                });
              })).then(function (taken) {
                taken = taken.filter(Boolean);
                var tree = [], twin = function (id) { return 'sbgn-ml/' + twinOf(id) + '.sbgn'; };
                var put = function (path, sha) { tree.push({ path: 'maps/' + path, mode: '100644', type: 'blob', sha: sha }); };
                taken.forEach(function (id) {
                  var used = function (n) { return now.some(function (f) { return f.path.indexOf(n + '.') === 0 || f.path.indexOf('extra/' + n + '/') === 0 || f.path === twin(n) || f.path === 'colours/' + n + '.json' || f.path === 'colours/' + twinOf(n) + '.json' || f.path.indexOf(twinOf(n) + '.') === 0; }); };
                  var k = 2, nid; do { nid = id.replace(/(-graphml|-celldesigner)?$/, '-' + k++ + '$1'); } while (used(nid));
                  now.forEach(function (f) {
                    var to = f.path.indexOf(id + '.') === 0 ? nid + f.path.slice(id.length)
                      : f.path.indexOf('extra/' + id + '/') === 0 ? 'extra/' + nid + '/' + f.path.slice(id.length + 7).split(id).join(nid)
                      : f.path === twin(id) ? twin(nid) : f.path === 'colours/' + id + '.json' ? 'colours/' + nid + '.json'
                      : f.path === 'colours/' + twinOf(id) + '.json' && /-graphml$/.test(id) ? 'colours/' + twinOf(nid) + '.json' : null;
                    if (!to) return;
                    put(to, f.sha);
                    if (!saved[f.path]) put(f.path, null);   // what the backup does not hold again goes with it
                  });
                });
                blobs.forEach(function (f) { put(f.path.slice(5), f.sha); });
                ids.forEach(function (id) { if (shaOf[twin(id)] && taken.indexOf(id) < 0) put(twin(id), null); });   // a renewed example's edited twin: written again by the build
                // maps with no page of their own deleted (maps/deleted.json): the examples' twins and the external examples back
                var back = [], binRead = shaOf['deleted.json'] ? api('/git/blobs/' + shaOf['deleted.json']).then(ghJson) : Promise.resolve(null);
                return binRead.then(function (b) {
                  if (!b) return;
                  var o = binFileRead(b), twins = ids.map(twinOf);   // a taken example comes back too, at its own id, with its twin
                  Object.keys(o).forEach(function (id) { if (/^external-/.test(id) || twins.indexOf(id) >= 0) { delete o[id]; back.push(id); } });
                  if (back.length) tree.push({ path: BIN_FILE, mode: '100644', type: 'blob', content: binFileText(o) });
                }).then(function () { return post('/git/trees', { base_tree: c.tree.sha, tree: tree }); })
                  .then(function (t) { return post('/git/commits', { message: 'Example maps restored in the viewer' + (taken.length ? '; kept as the reader\'s: ' + taken.join(', ') : ''), tree: t.sha, parents: [ref.object.sha] }); })
                  .then(function (n) { return post('/git/refs/heads/main', { sha: n.sha }, 'PATCH'); })
                  .then(function () {
                    shared.ghDir = null;
                    var before = {}; tree.forEach(function (f) { before[f.path] = shaOf[f.path.slice(5)] || null; });   // each path as it was, for the undo (examplesBack)
                    return { ids: ids.concat(back), before: before };
                  });
              });
            });
          });
        }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
      };
      return go();
    }
    // New map, made in place: an empty SBGN-ML map of the reader's, Process Description, named Unnamed map (2, 3, ... while taken), in
    // the group right-clicked or at the top, opened at once in the Edit window with the palette, nothing asked (no name
    // needed to start, as in Google Docs; a double-click names it).
    // With a token it goes to GitHub at once (toSite) and every change is saved there; else kept as any map of theirs
    // (this browser, their folder). Its map id (NEW_ID, sbgn.js) marks the file as made here (madeHere, sbgn.js), so the folder and Add map from file
    // take it back; an SBGN-ML file of another editor is not taken (it may hold what the empty base cannot draw)
    function newId() { return 'mine-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    // A CellDesigner map too: the reader picks the
    // format in the menu, New SBGN-ML map or New CellDesigner map; an empty CellDesigner file as cd_make writes one, edited
    // with the CellDesigner palette (cdcreate.js)
    var making;
    function __run13() {   // run at start, in order (__start)
    making = false;
    }
    function newMap(group, fmt) {
      if (making) return Promise.resolve();   // one at a time: a second click meanwhile would take the same name
      making = true;
      var F = fmt === 'cd' ? 'CellDesigner' : 'SBGN-ML';
      var files = mineShown().map(function (r) { return r.file; });   // a deleted map's file name free too (in a folder its file is in Deleted/)
      var title = 'Unnamed map', file;
      var ext = fmt === 'cd' ? '.xml' : '.sbgn', text;
      for (var k = 2; nameTaken(title, group, F); k++) title = 'Unnamed map ' + k;
      file = title.toLowerCase().replace(/ /g, '-') + ext;
      for (k = 2; files.indexOf(file) >= 0; k++) file = title.toLowerCase().replace(/ /g, '-') + '-' + k + ext;   // the file's name apart from the map's: unique among all the reader's
      if (fmt !== 'cd') text = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="' + NEW_ID + '" language="process description">\n  </map>\n</sbgn>\n';
      return mineIn.then(function () { return fmt === 'cd' ? cdpy().then(function () { text = cdMk.empty({ id: 'untitled' }); }) : null; })
        .then(function () { return drawText(text); }).then(function (d) {
        var r = { id: newId(), title: title, file: file, text: text, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(text), hidden: false, group: group || '' };
        var up = repo() && token() ? toSite(title, ext, text, r.group, siteOrder(r.group)).then(function (s) { onSite(r, s, title); }, function () {}) : null;   // not sent: the editor says so and tries again
        return Promise.resolve(up).then(function () { return minePut(r); }).then(function () {
          toFolder(r.id, r.file, r.text);
          V.refreshMine(); V.go(r.id);
          var tries = 0;
          (function edit() {   // the Edit tab shows once the editor has taken the map shown
            var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
            if (eb && eb.offsetParent && V.current && V.current.id === r.id) { if (V.win !== 'edit') eb.click(); return; }
            if (++tries < 100 && location.hash === '#' + r.id) setTimeout(edit, 50);   // not once another map is chosen
          })();
        });
      }).catch(function (e) { alert('The new map was not made: ' + (e && e.message ? e.message : e)); })
        .then(function () { making = false; });
    }
    // a map's name typed in place (any map):
    // a double-click on it or Rename map in the list's menu; the reader's maps in their record (title), the site's with a
    // token in their maps/<id>.md (topic, the name the list shows; the title too where it was the same), shown at once
    // while the site's list still has the old name. Maps whose name the build takes from elsewhere (the SBGN-ML groups,
    // their edited copies under maps/sbgn-ml/) are not renamed; an SBGN-ML map with a page of its own (maps/<id>.sbgn) is
    var renamed, NAMED_KEY, nk;
    function __run14() {   // run at start, in order (__start)
    renamed = {};   // site map id -> { was, to }: the list's name before and the one given here
    // a site map's name given in this browser only (local: no token, or a clash in a group of the reader's own, where the
    // site's page is not the place): kept per page as the moves are, until the site's own name of it changes
    NAMED_KEY = 'atlas-named:' + location.pathname;
    try { nk = JSON.parse(localStorage.getItem(NAMED_KEY) || '{}'); Object.keys(nk).forEach(function (id) { renamed[id] = Object.assign({ local: true }, nk[id]); }); } catch (e) {}
    }
    function namedSave() {
      var o = {}; Object.keys(renamed).forEach(function (id) { if (renamed[id].local) o[id] = { was: renamed[id].was, to: renamed[id].to }; });
      try { if (Object.keys(o).length) localStorage.setItem(NAMED_KEY, JSON.stringify(o)); else localStorage.removeItem(NAMED_KEY); } catch (e) {}
    }
    function canDelete(m, gh) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && (!mine[m.id].site || !!gh) : !!gh); }   // every map in sight, with a token the site's too (one with no page of its own: maps/deleted.json)
    function canRename(m, gh) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && (!mine[m.id].site || !!gh) : !!gh && !/^maps\/sbgn-ml\//.test(m.editPath || '')); }   // one on its way to the site: in its page there too
    function siteNamed(list) {   // the names given here over the site's list (copies: the site's own entries untouched)
      return list.map(function (m) {
        var n = renamed[m.id];
        if (!n) return m;
        if ((m.topic === n.to && !V.pageBehind(m)) || (n.local && m.topic !== n.was)) { delete renamed[m.id]; if (n.local) namedSave(); return m; }   // the build has it, or the site renamed it since
        return m.topic === n.was ? Object.assign({}, m, { topic: n.to }) : m;
      });
    }
    function renameMap(id) {
      if (naming) naming(true);
      var m = V.byId[id], b = document.querySelector('#m2-list .m2-map[data-id="' + CSS.escape(id) + '"]');
      if (!m || !b || !canRename(m, repo() && token())) return;
      var shown = m.mine ? m.title : m.topic;
      inPlace(b, { cls: 'm2-group-edit m2-map-edit' + (b.classList.contains('m2-sub') ? ' m2-sub' : ''), max: 120, value: shown, label: 'Name of the map',
        bad: function (v) { return v && v !== shown && nameTaken(v, m.group, fmtOf(m), id, m.tab) ? 'A map of this name and format is in this group already' : ''; },
        end: function (v) {
          if (!v || v === shown || nameTaken(v, m.group, fmtOf(m), id, m.tab)) return;
          var site = m.mine && mine[id] ? mine[id].site : null;
          nameTo(m, v);
          listDid(function () { var c = listCur(id, site); if (c) nameTo(c, shown); }, function () { var c = listCur(id, site); if (c) nameTo(c, v); });
        } });
    }
    function toSiteName(id, was, v) {   // maps/<id>.md: its topic, and its title where it was the same; one commit
      var q = JSON.stringify(v.replace(/["\\]/g, ''));   // the build reads the front matter's quotes plainly
      return siteFront(id, function (f) {
        if (f.get('topic') === null) throw new Error('its page has no topic line');
        if (f.get('title') === f.get('topic')) f.set('title', q);
        f.set('topic', q);
      }, 'Map renamed in the viewer');
    }
    // one way to make or update a reader's map, for files added here and found in their folder (the editor): by its id,
    // else by its file's name and content: the same file again, as
    // first added or as it is now, brings its map back with the reader's changes kept; another file of the same name is
    // a map of its own (its folder file written beside, -2), never over the one edited
    function textHash(t) {   // FNV-1a and the length: tells two files apart, never sent anywhere
      var h = 2166136261;
      for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36) + '.' + t.length;
    }
    // the reader's map a file is: the same name and the same text as now or as first added; a map kept by an older version
    // (no src) by its name alone, its src then taken from the file added; one gone to the site is not theirs here
    function mineMatch(name, text, h) {
      h = h || textHash(text);
      return Object.keys(mine).map(function (k) { return mine[k]; })
        .filter(function (r) { return !r.site && r.file === name && (r.text === text || (r.src ? r.src === h : true)); })[0] || null;
    }
    function mineAdd(name, text, d, id, group) {   // group: the reader's group it was added into (undefined: where it was, else at the top)
      var h = textHash(text), old = id ? mine[id] : mineMatch(name, text, h);
      var back = !id && old && old.text !== text && old.src === h;   // the file as first added, the map since edited: the edits kept (an older map, matched by name alone, takes the new file)
      var r = { id: old ? old.id : newId(), title: old ? old.title : freeTitle(name.replace(/\.(graphml|xml|sbgn)$/i, ''), group || '', fmtOfText(text)),
        file: old ? old.file : name, text: back ? old.text : text, svg: back ? old.svg : d.svg, width: back ? old.width : d.width, height: back ? old.height : d.height,
        at: back ? old.at : Date.now(), src: old ? old.src || (id ? undefined : h) : h, hidden: false, group: group !== undefined ? group : old && old.group || '' };
      if (old && old.site) ['site', 'path', 'sha', 'saved', 'siteTitle'].forEach(function (k) { r[k] = old[k]; });   // on GitHub already: its file there, its new text sent once connected
      return minePut(r).then(function () { return old && old.hidden ? folderMove(r.id, false) : null; }).then(function () { return r; });   // out of Deleted: its folder file too
    }
    // Files being added, shown at once in the list where they will stand (addPaint, after every list built): each file a
    // grey row with a small spinner after the group's maps, the group's heading counting adding k of n; a row goes when
    // its map is in the list (without a token one after another, with one all at once after the commit); a file not
    // added stays a red row with its reason until clicked. Shown only once adding takes longer than ADD_AFTER, so a
    // quick pick never flashes. Not while searching, nor under a closed group (the count stays on its heading)
    var adding, ADD_AFTER;
    function __run15() {   // run at start, in order (__start)
    adding = [], ADD_AFTER = 300;
    }   // { group, rows: [{ name, f, why }], n, done, shown }
    function addPaint() {
      var box = document.getElementById('m2-list');
      if (!box) return;
      Array.prototype.forEach.call(box.querySelectorAll('.m2-wait, .m2-pend-n'), function (x) { x.remove(); });
      Array.prototype.forEach.call(box.querySelectorAll('.m2-empty[hidden]'), function (x) { x.hidden = false; });   // only addPaint hides them
      adding = adding.filter(function (b) { return b.rows.length || b.done < b.n; });
      if (document.getElementById('m2-search').value.trim()) return;
      var count = {};
      adding.forEach(function (b) { if (b.shown && b.done < b.n) { var c = count[b.group] = count[b.group] || [0, 0]; c[0] += b.done; c[1] += b.n; } });
      adding.forEach(function (b) {
        if (!b.shown) return;
        var g = b.group, head = g ? box.querySelector('.m2-group:not(.m2-link-group)[data-group="' + CSS.escape(g) + '"]') : null;
        if (g && !head) return;   // its heading being renamed: back at the next list
        if (head && count[g] && !head.querySelector('.m2-pend-n')) head.appendChild(Object.assign(document.createElement('span'), { className: 'm2-pend-n', textContent: 'adding ' + count[g][0] + ' of ' + count[g][1] }));
        if (head && head.classList.contains('m2-shut')) return;
        var maps = box.querySelectorAll('.m2-map:not(.m2-binned)[data-group="' + CSS.escape(g) + '"]' + (g ? '' : '.m2-mine'));
        var at = box.querySelectorAll('.m2-wait[data-group="' + CSS.escape(g) + '"]'), empty = g && box.querySelector('.m2-empty[data-group="' + CSS.escape(g) + '"]');
        at = at.length ? at[at.length - 1] : maps.length ? maps[maps.length - 1] : empty || head;
        if (empty) empty.hidden = true;
        b.rows.forEach(function (r) {
          var row = document.createElement('div');
          row.className = 'm2-item m2-wait' + (g ? ' m2-sub' : '') + (r.why ? ' m2-wait-bad' : '');
          row.setAttribute('data-group', g);   // a file dropped on it goes into its group
          row.title = r.why ? r.name + ' was not added: ' + r.why + ' (click to dismiss)' : 'Adding ' + r.name;
          if (!r.why) row.appendChild(Object.assign(document.createElement('span'), { className: 'm2-spin' }));
          row.appendChild(Object.assign(document.createElement('span'), { className: 'm2-name', textContent: r.name.replace(/\.(graphml|xml|sbgn)$/i, '') }));
          if (r.why) {
            row.appendChild(Object.assign(document.createElement('span'), { className: 'm2-wait-why', textContent: r.why }));
            row.addEventListener('click', function () { var i = b.rows.indexOf(r); if (i >= 0) b.rows.splice(i, 1); addPaint(); });
          }
          if (at) at.after(row); else box.insertBefore(row, box.firstChild);   // in no group and none of theirs yet: the list's top
          at = row;
        });
      });
    }
    function addFiles(list, group) {   // a reader's files, drawn and kept; group: Add map or a drop on a group of theirs
      list = Array.prototype.slice.call(list);   // the picker's list empties when it is reset
      var picked = list.filter(function (f) { return /\.(graphml|xml|sbgn)$/i.test(f.name); });
      if (!picked.length) return Promise.resolve();
      var gh = repo() && token(), last = null, out = [];   // with a token: all drawn first, then sent in one commit
      var b = { group: group || '', rows: picked.map(function (f) { return { name: f.name, f: f }; }), n: picked.length, done: 0, shown: false };
      adding.push(b);
      if (group && V.closed[group]) { delete V.closed[group]; V.saveClosed(); }
      var timer = setTimeout(function () { b.shown = true; V.refreshMine(); }, ADD_AFTER);
      var rowOf = function (f) { return b.rows.filter(function (r) { return r.f === f; })[0]; };
      var gone = function (f) { var r = rowOf(f); if (r) b.rows.splice(b.rows.indexOf(r), 1); };
      var why = function (f, e) { var r = rowOf(f), w = e && e.message ? e.message : String(e); if (r) r.why = w; else b.rows.push({ name: f.name, f: f, why: w }); };
      return picked.reduce(function (p, f) {
        return p.then(function () { return f.text(); }).then(function (t) {
          if (isSb(t) && !madeHere(t)) throw new Error(otherSb());
          if (gh) return drawText(t, null, 'adding').then(function (d) {   // with a token: to the site, shown from here until built
            var ext = siteExt(t), title = freeTitle(f.name.replace(/\.(graphml|xml|sbgn)$/i, ''), group || '', fmtOfText(t), out.filter(function (o) { return fmtOfText(o.t) === fmtOfText(t); }).map(function (o) { return o.title; }));
            if (!ext) throw new Error(siteWhy(t));
            out.push({ f: f, d: d, t: t, ext: ext, title: title });
            b.done++; if (b.shown) addPaint();
          });
          return drawText(t, null, 'adding').then(function (d) { return mineAdd(f.name, t, d, null, group || undefined); }).then(function (r) {
            last = r.id; gone(f); b.done++; if (b.shown) V.refreshMine();   // the map in the list, its row gone
            return toFolder(r.id, r.file, r.text).catch(function (e) { why(f, new Error('kept in this browser, not in the folder: ' + (e && e.message ? e.message : e))); });
          });
        }).catch(function (e) { why(f, e); b.done++; });
      }, Promise.resolve()).then(function () {
        if (!out.length) return;
        var order = siteOrder(group);
        return toSiteMany(out.map(function (o) { return { title: o.title, ext: o.ext, text: o.t, group: group, order: order++ }; })).then(function (ss) {
          return out.reduce(function (p, o, i) {   // a part GitHub refused said, the parts sent kept
            if (ss[i].err) { why(o.f, ss[i].err); return p; }
            var r = { id: newId(), title: o.title, file: o.f.name, text: o.t, svg: o.d.svg, width: o.d.width, height: o.d.height, at: Date.now(), hidden: false, group: group || '' };
            return p.then(function () { return minePut(onSite(r, ss[i], o.title)); }).then(function () { last = r.id; gone(o.f); }, function (e) { why(o.f, e); });
          }, Promise.resolve());
        }).catch(function (e) { out.forEach(function (o) { if (rowOf(o.f) && !rowOf(o.f).why) why(o.f, e); }); });
      }).then(fin, function (e) { b.rows.forEach(function (r) { if (!r.why) r.why = e && e.message ? e.message : String(e); }); fin(); });
      function fin() {
        clearTimeout(timer);
        b.done = b.n;
        b.rows = b.rows.filter(function (r) { return r.why; });   // only what was not added stays, in red
        b.shown = b.rows.length > 0;
        V.refreshMine(); if (last) V.go(last);
      }
    }
    var picker;
    function __run16() {   // run at start, in order (__start)
    picker = document.createElement('input');
    picker.type = 'file'; picker.multiple = true; picker.accept = '.graphml,.xml,.sbgn'; picker.hidden = true;
    picker.addEventListener('change', function () { var l = Array.prototype.slice.call(picker.files), to = addTo; listMade(function () { return addFiles(l, to); }); picker.value = ''; });
    document.body.appendChild(picker);
    document.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault(); });
    document.addEventListener('drop', function (e) {   // a file dropped on a group of the reader's goes into it, elsewhere to the top
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var t = e.target.closest && e.target.closest('#m2-list [data-group]'), g = t && t.dataset.group;
      var l = Array.prototype.slice.call(e.dataTransfer.files); listMade(function () { return addFiles(l, ownGroup(g) ? g : ''); });
    });
    }
    // With a token GitHub is where the reader's maps are kept: a map made or added goes there at once (toSite), and a
    // map of theirs still only in this browser (made before connecting, or its sending failed) is sent when the page
    // opens connected, when a token is connected, and when it is edited. Its record keeps the site's id, the file's
    // path and sha, and the text GitHub has (saved), so editing saves there (core.js push) and withMine knows when the
    // build has it. The file kinds the site's build takes: a yEd GraphML, a CellDesigner file, an SBGN-ML map made here
    function otherSb() { return 'an SBGN-ML file from another editor cannot be added yet, only one made here with New map'; }   // Add map's and a tool's refusal of another editor's SBGN-ML
    function siteExt(t) { return isCd(t) ? '.xml' : isSb(t) ? (madeHere(t) ? '.sbgn' : null) : /yworks\.com/.test(t.slice(0, 5000)) ? '.graphml' : null; }
    function siteWhy(t) { return isSb(t) ? 'an SBGN-ML file from another editor cannot go to the site yet, only one made here with New map' : 'not a yEd GraphML or CellDesigner file'; }
    function onSite(r, s, title) { r.site = s.id; r.path = s.path; r.sha = s.sha; r.saved = s.text; r.siteTitle = title; return r; }
    // readers' maps put on the site (ext from siteExt: only what the build takes, any other file would stop it): each
    // file as maps/<id><ext> and its maps/<id>.md (title, group, order), all in one commit on main (the files' text in
    // the tree: three writes and one build for any number), so the build makes them maps of the site; ids from the
    // titles, made unique among maps/ and the ids sent before in the same call, read again on each try (a commit of
    // another page or tab meanwhile: done again on the newest main, three tries). More than BULK of text, or a tree
    // GitHub refuses (too large), is sent as two halves, one after the other. Gives per map the id, the file's path, its
    // blob sha (the build's src once it has drawn this very file) and the text, or { err } for a part not sent
    var BULK;
    function __run17() {   // run at start, in order (__start)
    BULK = 20e6;
    }
    function toSiteMany(items) {
      if (!(repo() && token())) return Promise.reject(new Error('not connected to GitHub'));
      var j = ghJson, post = ghPost, used = {};
      var slugOf = function (base) { return (base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map').replace(/-(sbgn|sbgnml)$|^external-/, function (x) { return x === 'external-' ? 'map-external-' : x + '-map'; }); };   // the build's own ids end or start so
      var mdOf = function (base, it) { return '---\ntitle: ' + JSON.stringify(base) + '\ntopic: ' + JSON.stringify(base) + '\ngroup: ' + JSON.stringify(it.group || '') + '\norder: ' + (it.order | 0) + '\n---\n'; };
      var halves = function (part) {
        var h = Math.ceil(part.length / 2);
        return send(part.slice(0, h)).then(function (a) { return send(part.slice(h)).then(function (b) { return a.concat(b); }); });
      };
      var send = function (part) {
        if (part.length > 1 && part.reduce(function (n, it) { return n + it.text.length; }, 0) > BULK) return halves(part);
        var tries = 0;
        var go = function () {
          var ids;
          return api('/contents/maps?ref=main').then(j).then(function (d) {
            var taken = Object.assign({}, used); d.forEach(function (f) { taken[f.name.replace(/\.[^.]+$/, '')] = 1; });
            ids = part.map(function (it) { var s = slugOf(it.title), id = s; for (var k = 2; taken[id]; k++) id = s + '-' + k; taken[id] = 1; return id; });
            return api('/git/ref/heads/main').then(j);
          }).then(function (ref) {
            return api('/git/commits/' + ref.object.sha).then(j).then(function (c) {
              var t = [];
              part.forEach(function (it, i) {
                var base = it.title.replace(/["\\]/g, '');   // the build reads the front matter's quotes plainly
                t.push({ path: 'maps/' + ids[i] + it.ext, mode: '100644', type: 'blob', content: it.text }, { path: 'maps/' + ids[i] + '.md', mode: '100644', type: 'blob', content: mdOf(base, it) });
              });
              return post('/git/trees', { base_tree: c.tree.sha, tree: t }).catch(function (e) { e.tree = true; throw e; });
            }).then(function (t) { return post('/git/commits', { message: part.length === 1 ? 'Map added in the viewer: ' + ids[0] + part[0].ext : part.length + ' maps added in the viewer', tree: t.sha, parents: [ref.object.sha] }); })
              .then(function (c) { return post('/git/refs/heads/main', { sha: c.sha }, 'PATCH'); });
          }).then(function () { return ids; }).catch(function (e) {
            if (e.tree && part.length > 1 && e.status !== 401 && e.status !== 403) throw Object.assign(e, { split: true });
            if (e.status === 422 && ++tries < 3) return go();
            throw e;
          });
        };
        return Promise.all(part.map(function (it) { return blobSha(it.text); })).then(function (shas) {
          return go().then(function (ids) {
            shared.ghDir = null;
            return ids.map(function (id, i) { used[id] = 1; delete hiddenGone[id]; binClear(id); return { id: id, path: 'maps/' + id + part[i].ext, sha: shas[i], text: part[i].text }; });   // the listing read again next time; an id deleted forever before, taken again: a map of its own
          }, function (e) { return e.split ? halves(part) : part.map(function () { return { err: e }; }); });
        });
      };
      return send(items);
    }
    function toSite(title, ext, text, group, order) { return toSiteMany([{ title: title, ext: ext, text: text, group: group, order: order }]).then(function (a) { if (a[0].err) throw a[0].err; return a[0]; }); }
    // one map of the reader's to GitHub; its record then, or null (gone or hidden). One send per map at a time, and one
    // at a time across this site's tabs (the record read again inside the lock: another tab may have sent it)
    var upping;
    function __run18() {   // run at start, in order (__start)
    upping = {};
    }
    function oneAtATime(f) { return navigator.locks && navigator.locks.request ? navigator.locks.request('atlas-own-to-site', f) : f(); }
    function upOne(id) {
      if (upping[id]) return upping[id];
      var p = upping[id] = oneAtATime(function () {
        return V.draftDo('readonly', function (st) { return st.get(id); }, 'mine').then(function (stored) {
          if (stored && stored.site && mine[id] && !mine[id].site) mine[id] = Object.assign({}, mine[id], ['site', 'path', 'sha', 'saved', 'siteTitle'].reduce(function (o, k) { o[k] = stored[k]; return o; }, {}));
          var r = mine[id];
          if (!r || r.hidden) return null;
          if (r.site) return r;
          var ext = siteExt(r.text), title = r.title.replace(/\.(graphml|xml|sbgn)$/i, '');
          if (!ext) throw new Error(siteWhy(r.text));
          return toSite(title, ext, r.text, r.group || '', siteOrder(r.group || '')).then(function (s) {
            if (!mine[id]) return null;
            var n = onSite(Object.assign({}, mine[id]), s, title);
            if (n.hidden) siteBin(s.id, true).catch(function () {});   // deleted while it was sent: its page there too
            if (n.title !== title) {   // renamed while it was sent: its page there too
              renamed[s.id] = { was: title, to: n.title };
              toSiteName(s.id, title, n.title).catch(function () { delete renamed[s.id]; });
            }
            return minePut(n).then(function () { return n; });
          });
        });
      });
      p.then(function () { delete upping[id]; }, function () { delete upping[id]; });
      return p;
    }
    function savedMine(s, t) {   // a save on GitHub of a reader's map on its way to the site: its sha and text learnt
      var r = mine[s.id];
      if (r && r.site) minePut(Object.assign({}, r, { sha: s.sha, saved: t })).catch(function () {});
    }
    function toGh(s) {   // the reader's map edited, not saving on GitHub yet: sent (or its place there taken up), then saved there
      if (!mine[s.id]) return Promise.resolve();
      return upOne(s.id).then(function (n) {
        if (!n || !n.path) return;   // gone, or sent by an older version (its file's sha not known)
        if (site !== s || !on || !(repo() && token())) { if (n.text !== n.saved) upAll(); return; }   // left meanwhile: its last changes sent all the same
        s.pending = false; s.path = n.path; s.sha = n.sha; s.saved = n.saved;
        localBox(); V.refreshMine();
        if (src() !== n.saved) { shared.dirty = true; changed(); }
      }, function (e) {
        if (site === s) warn('Not on GitHub: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '. This map is kept in this browser only; it is sent again after the next change.');
      });
    }
    // every map of the reader's not on GitHub, or with changes GitHub does not have (a save that failed, a disconnect,
    // a file changed in the folder meanwhile), sent one after another once the site's list is in (a map's order is
    // after its group's last); what went said in grey, what did not in red
    var upRun;
    function __run19() {   // run at start, in order (__start)
    upRun = null;
    }
    function upAll() {
      if (!(repo() && token())) return Promise.resolve();
      if (upRun) return upRun;
      var went = [], failed = [], fail = function (r) { return function (e) { failed.push(r.title + ' (' + (e && e.message ? e.message : e) + ')'); }; };
      var listIn = function (n) { return V.siteList || !n ? Promise.resolve() : new Promise(function (res) { setTimeout(res, 500); }).then(function () { return listIn(n - 1); }); };
      return (upRun = mineIn.then(function () { return listIn(60); }).then(function () {
        return Object.keys(mine).reduce(function (q, id) {
          return q.then(function () {
            var r = mine[id];
            if (!r || r.hidden || (on && site && site.id === id)) return;   // the map edited: its own way (toGh, push)
            if (!r.site) return upOne(id).then(function (n) { if (n) went.push(n.title); }, fail(r));
            if (r.path && r.saved != null && r.text !== r.saved) return putMine(r).then(function () { went.push(r.title); }, fail(r));
          });
        }, Promise.resolve());
      }).then(function () {
        upRun = null;
        if (went.length || failed.length) V.refreshMine();
        if (failed.length) warn('Not on GitHub, kept in this browser only: ' + failed.join(', ') + '.');
        else if (went.length) note();
      }));
    }
    // a reader's map's changes GitHub does not have, saved on the sha last known; refused as older (its last save
    // learnt by no record, a tab closed meanwhile): GitHub's file read, and if it is already this text only its sha is
    // learnt, else a file changed there since is left and said
    function putMine(r) {
      var t = r.text, learn = function (sha) { var n = mine[r.id]; if (n) return minePut(Object.assign({}, n, { sha: sha, saved: t })); };
      return api('/contents/' + r.path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Moved in the viewer: ' + r.path.split('/').pop(), content: b64(t), sha: r.sha || undefined, branch: 'main' }) })
        .then(function (q) {
          if (q.ok) return q.json().then(function (d) { return learn(d.content.sha); });
          if (q.status !== 409 && q.status !== 422) throw new Error('GitHub ' + q.status);
          return Promise.all([api('/contents/' + r.path + '?ref=main').then(function (x) { return x.json(); }),
            api('/contents/' + r.path + '?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (x) { return x.text(); })])
            .then(function (f) { if (f[1] !== t) throw new Error('changed on GitHub since'); return learn(f[0].sha); });
        });
    }
    // ---------- Delete map, Deleted, Restore, Delete forever ----------
    // (as a mailbox's or the Mac's Bin). Delete map, the last line of the list's
    // menu on a reader's map or, with a token, on any site map (one with no page of its own: maps/deleted.json), puts the map in Deleted: a group of
    // its own at the end of the list, closed on every page load, seen only by a reader with a token (site maps) or in
    // their own browser (their maps). A deleted map keeps its name and group, gives up its name (a new map may take it:
    // nameTaken leaves Deleted out) and is not edited. Restore puts it back into its group, as "<name> (1)" when its group
    // has that name in its format by then (as Finder);
    // Delete forever takes it out for good: a reader's record and its folder file, a site map's files in one commit (git
    // history still has them). A site map's state is its page's front matter (deleted: <date>, ISO in UTC), kept here
    // meanwhile (atlas-bin-pending: id -> [the date, '' for restored; when]) until the build has it, at most an hour
    // (another device or tab may have changed it since)
    var BIN_KEY;
    function __run20() {   // run at start, in order (__start)
    BIN_KEY = 'atlas-bin-pending';
    }
    function binPending() { try { var o = JSON.parse(localStorage.getItem(BIN_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
    function binPendingSet(o) { try { if (Object.keys(o).length) localStorage.setItem(BIN_KEY, JSON.stringify(o)); else localStorage.removeItem(BIN_KEY); } catch (e) {} }
    function binState(m, pend) {   // a site map's date in Deleted, '' if not; what this page did wins until the build has it (then let go)
      var p = pend[m.id];
      var since = Array.isArray(p) && m.written && m.written >= new Date(p[1]).toISOString();   // a build of this write or a later one (another tab's, another device's): the build's word
      if (!Array.isArray(p) || since || ((m.deleted || '') === p[0] && !V.pageBehind(m)) || Date.now() - p[1] > 3600000) { delete pend[m.id]; return m.deleted || ''; }   // an earlier build that agrees settles nothing
      return p[0];
    }
    function binClear(id) { var p = binPending(); if (id in p) { delete p[id]; binPendingSet(p); } }
    function textOf(b64) { return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); })); }   // GitHub's base64 content as text
    function ghPost(path, body, method) { return api(path, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(ghJson); }
    function ghJson(r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (d) { var e = new Error(d && d.message || 'GitHub ' + r.status); e.status = r.status; throw e; }); }
    // maps/<id>.md's front matter changed by edit({ get, set, drop }) in one commit, the closing line and the body as they were
    // One page write at a time from this page: two at once on main refuse each other (409, the branch moved), as several
    // maps restored together did; a write still refused (another tab, an editor save) is read and tried up to three times
    // more; a write that never answers holds the next ones 30 s at most from its start
    var siteQ;
    function __run21() {   // run at start, in order (__start)
    siteQ = Promise.resolve();
    }
    function siteFront(id, edit, message) {
      V.pageSent(id, '');   // held from the moment it is asked for, also while it waits behind other writes
      var prev = siteQ, p = prev.then(function () { return frontWrite(id, edit, message, 0); })
        .then(function (at) { V.pageSent(id, at); }, function (e) { V.pageSent(id, null); throw e; });   // held until a build of this write
      siteQ = queueNext(prev, p);
      return p;
    }
    function queueNext(prev, p) {   // the next write waits for this one, at most 30 s counted from when this one starts
      return prev.then(function () { return Promise.race([p.catch(function () {}), new Promise(function (ok) { setTimeout(ok, 30000); })]); });
    }
    function frontWrite(id, edit, message, tries) {
      var path = '/contents/maps/' + encodeURIComponent(id) + '.md', at = new Date().toISOString();   // written: when this page last wrote it (the viewer waits for a build that new, V.pageBehind)
      return api(path + '?ref=main').then(function (r) { if (!r.ok) { var e = new Error(r.status === 404 ? 'it has no page of its own' : 'GitHub ' + r.status); e.noPage = r.status === 404; throw e; } return r.json(); })
        .then(function (d) {
          var md = textOf(d.content);
          var fm = /^---(\r?\n)([\s\S]*?)\r?\n---/.exec(md);   // the front matter only, in the file's line ends
          if (!fm) throw new Error('its page has no front matter');
          var nl = fm[1], head = fm[2];
          edit({
            get: function (k) { var x = head.match(new RegExp('^' + k + ':[ \\t]*([^\\r\\n]*)', 'm')); return x ? x[1].replace(/^"(.*)"$/, '$1') : null; },
            set: function (k, v) { var re = new RegExp('^' + k + ':[^\\r\\n]*', 'm'); head = re.test(head) ? head.replace(re, function () { return k + ': ' + v; }) : head + nl + k + ': ' + v; },
            drop: function (k) { head = head.replace(new RegExp('^' + k + ':.*(\\r?\\n|$)', 'm'), '').replace(/\r?\n$/, ''); }
          });
          head = /^written:/m.test(head) ? head.replace(/^written:[^\r\n]*/m, function () { return 'written: ' + JSON.stringify(at); }) : head + nl + 'written: ' + JSON.stringify(at);
          md = '---' + nl + head + fm[0].slice(3 + nl.length + fm[2].length) + md.slice(fm[0].length);
          return api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message + ': ' + id, content: b64(md), sha: d.sha, branch: 'main' }) });
        }).then(function (r) {
          if ((r.status === 409 || r.status === 422) && tries < 3) return new Promise(function (ok) { setTimeout(ok, 500 * (tries + 1)); }).then(function () { return frontWrite(id, edit, message, tries + 1); });   // read again: another write came first
          if (!r.ok) throw new Error('GitHub ' + r.status);
          return at;
        });
    }
    function siteBin(id, on, topic) {   // a site map into Deleted (on) or out of it (its new name, when its own was taken)
      if (pageless((V.siteList || []).filter(function (x) { return x.id === id; })[0])) return pagelessBin(id, on);   // its line in maps/deleted.json
      var pend = binPending(), was = pend[id], date = new Date().toISOString().slice(0, 19) + 'Z';
      pend[id] = [on ? date : '', Date.now()]; binPendingSet(pend);
      return siteFront(id, function (f) {
        if (on) f.set('deleted', JSON.stringify(date));
        else {
          f.drop('deleted');
          if (topic) { var q = JSON.stringify(topic.replace(/["\\]/g, '')); if (f.get('title') === f.get('topic')) f.set('title', q); f.set('topic', q); }
        }
      }, on ? 'Map deleted in the viewer' : 'Map restored in the viewer').catch(function (e) {
        var p = binPending(); if (was === undefined) delete p[id]; else p[id] = was; binPendingSet(p);
        V.refreshMine(); throw e;
      });
    }
    // A map the build makes with no page of its own (an SBGN-ML twin, an external example, an SBML group's map: its entry
    // says pageless) keeps its Deleted state in maps/deleted.json (id -> { deleted: <date> or "forever", written: <when> }),
    // which build.py reads; a restored map's line goes. Written one write at a time, as the pages, read again when GitHub
    // refuses it; the maps asked for in one go (Delete group, its undo) in one write
    var BIN_FILE;
    function __run22() {   // run at start, in order (__start)
    BIN_FILE = 'maps/deleted.json';
    }
    function pageless(m) { return !!m && !m.mine && !!m.pageless; }
    function binFileRead(d) { try { var o = d && d.content ? JSON.parse(textOf(d.content)) : {}; return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
    function binFileText(o) { return JSON.stringify(o, null, 1) + '\n'; }
    function binFileGet(ref) { return api('/contents/' + BIN_FILE + '?ref=' + (ref || 'main')).then(function (r) { return r.status === 404 ? {} : ghJson(r); }); }
    function binFileWrite(edit, message, tries) {
      return binFileGet().then(function (d) {
        var o = binFileRead(d); edit(o);
        return api('/contents/' + BIN_FILE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message, content: b64(binFileText(o)), sha: d.sha || undefined, branch: 'main' }) });
      }).then(function (r) {
        if ((r.status === 409 || r.status === 422) && tries < 3) return new Promise(function (ok) { setTimeout(ok, 500 * (tries + 1)); }).then(function () { return binFileWrite(edit, message, tries + 1); });
        if (!r.ok) throw new Error('GitHub ' + r.status);
      });
    }
    var pbWait;
    function __run23() {   // run at start, in order (__start)
    pbWait = {};
    }   // 'on' and 'off': the maps asked for in this turn of the page, written together
    function pagelessBin(id, on) {
      var k = on ? 'on' : 'off', w = pbWait[k], pend = binPending();
      if (!w) {
        w = pbWait[k] = { ids: [], was: {}, date: new Date().toISOString().slice(0, 19) + 'Z' };
        w.p = new Promise(function (ok) { setTimeout(ok, 0); }).then(function () { delete pbWait[k]; return pagelessWrite(w, on); });
      }
      if (w.ids.indexOf(id) < 0) { w.ids.push(id); w.was[id] = pend[id]; }
      pend[id] = [on ? w.date : '', Date.now()]; binPendingSet(pend);   // shown at once; the build's word once it has the write
      V.pageSent(id, '');
      return w.p;
    }
    function pagelessWrite(w, on) {
      var ids = w.ids, prev = siteQ, p = prev.then(function () {
        var at = new Date().toISOString();   // written: the viewer waits for a build that new
        return binFileWrite(function (o) { ids.forEach(function (id) { if (on) o[id] = { deleted: w.date, written: at }; else delete o[id]; }); },
          (on ? 'Deleted in the viewer: ' : 'Restored in the viewer: ') + ids.join(', '), 0).then(function () { return at; });
      }).then(function (at) { ids.forEach(function (id) { V.pageSent(id, on ? at : null); }); return at; }, function (e) {   // restored: no line left to wait for
        ids.forEach(function (id) { V.pageSent(id, null); });
        var q = binPending(); ids.forEach(function (id) { if (w.was[id] === undefined) delete q[id]; else q[id] = w.was[id]; }); binPendingSet(q);
        V.refreshMine(); throw e;
      });
      siteQ = queueNext(prev, p);
      return p;
    }
    // Delete group (any group in sight): its maps into Deleted, as Delete map; Deleted shows maps only, and each keeps its
    // group, so Restore puts it back there. A group of the reader's goes from the list once its maps are in Deleted (its
    // place kept in atlas-groups-gone) and comes back with the first map restored into it, or with an undo; a site group
    // is its maps' and comes back with them. A map being edited stays, and with it the group. While searching, the
    // group's maps in sight only (the selection is what is seen)
    var GONE_KEY;
    function __run24() {   // run at start, in order (__start)
    GONE_KEY = 'atlas-groups-gone';
    }
    function goneRead() { try { var o = JSON.parse(localStorage.getItem(GONE_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
    function goneSet(name, at) { var o = goneRead(); if (at === null) delete o[name]; else o[name] = at; try { if (Object.keys(o).length) localStorage.setItem(GONE_KEY, JSON.stringify(o)); else localStorage.removeItem(GONE_KEY); } catch (e) {} }
    function goneBack(name) {   // a group of the reader's deleted with its maps: back in its place (Restore of one of them)
      var o = goneRead();
      if (!name || !(name in o)) return;
      goneSet(name, null);
      if (mineGroups().indexOf(name) < 0) groupBack(name, o[name]);
    }
    function groupGo(name) {   // a group of the reader's out of the list, its place kept
      var at = mineGroups().indexOf(name);
      if (at < 0) return;
      goneSet(name, at); mineGroupsSet(mineGroups().filter(function (g) { return g !== name; }));
      if (V.closed[name]) { delete V.closed[name]; V.saveClosed(); }
      V.refreshMine();
    }
    function inGroup(name) { return V.maps.filter(function (m) { return !m.binned && (m.group || '') === name; }); }
    function groupMaps(name, gh) {
      var editing = V.grid.classList.contains('m2-editing') && V.chosen, q = (document.getElementById('m2-search') || {}).value;
      var seen = q ? Array.prototype.map.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)'), function (b) { return b.dataset.id; }) : null;
      return inGroup(name).filter(function (m) { return canDelete(m, gh) && !(editing && V.chosen.id === m.id) && (!seen || seen.indexOf(m.id) >= 0); });
    }
    function deleteGroupU(name, ms) {
      var own = ownGroup(name), at = mineGroups().indexOf(name), shut = !!V.closed[name], ks = ms.map(listKey);
      var empty = function () { return own && !inGroup(name).length; };
      var go = function () { return Promise.resolve(ms.length ? binMany(ms) : null).then(function () { if (empty()) { if (ms.length) groupGo(name); else removeGroup(name); } }); };   // the group goes once nothing is left in it (a map refused stays, with its group)
      var fwd = go();
      listDid(function () {
        return fwd.then(function () {
          if (own && mineGroups().indexOf(name) < 0) { goneSet(name, null); groupBack(name, at); if (shut) { V.closed[name] = true; V.saveClosed(); } }
          return restoreKeys(ks);
        });
      }, function () { fwd = Promise.resolve(ks.length ? binKeys(ks) : null).then(function () { if (empty()) { if (ks.length) groupGo(name); else removeGroup(name); } }); return fwd; });
      return fwd;
    }
    // Cmd+Delete (Ctrl+Delete elsewhere; Delete or Backspace, the Mac's delete key) on the map shown, outside edit mode, with the
    // list in sight: Delete map, as the list's menu offers it (on a group selected by its heading Delete group, on maps selected
    // Delete N maps); the next map in the list shown first (the one before at the list's end), as a mailbox goes on to the next
    // message. The key alone does nothing here, as in Finder: in edit mode it removes what is selected, so one key never
    // means both an object and the whole map. Not in a field, a menu, a name being given, or on a map in Deleted
    var DEL_KEY;
    function __run25() {   // run at start, in order (__start)
    DEL_KEY = /mac|iphone|ipad|ipod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent) ? '\u2318\u232B' : 'Ctrl+Del';
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.defaultPrevented || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey)) return;
      if (naming || document.querySelector('.m2-cx') || V.grid.classList.contains('m2-editing')) return;
      if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
      var list = document.getElementById('m2-list'), m = V.chosen && V.byId[V.chosen.id], sel = V.picked(), pg = V.pickedGroup();
      if (pg !== null && list && list.offsetParent) {   // a group selected by its heading: Delete group, as its menu offers it
        var gm = groupMaps(pg, !!(repo() && token()));
        V.pickSet([]);   // a group renamed or removed since: nothing to delete there, the map shown as before
        if (gm.length || (ownGroup(pg) && !inGroup(pg).length)) { e.preventDefault(); deleteGroupU(pg, gm); return; }
      }
      if ((sel.length > 1 || (sel.length === 1 && (!m || sel[0] !== m.id))) && list && list.offsetParent) {   // maps selected in the list (not the one shown alone): those that can be deleted
        var ms = sel.map(function (id) { return V.byId[id]; }).filter(function (x) { return x && !x.binned && canDelete(x, !!(repo() && token())); });
        if (ms.length) { e.preventDefault(); binU(ms, true); }
        return;
      }
      if (!list || !list.offsetParent || !m || m.binned || !canDelete(m, !!(repo() && token()))) return;
      if (V.mapSelected && V.mapSelected()) return;   // something selected on the map: the key is not for the whole map (Esc first)
      e.preventDefault();
      var items = Array.prototype.slice.call(list.querySelectorAll('.m2-map:not(.m2-binned)')), i = items.findIndex(function (b) { return b.dataset.id === m.id; });
      var next = i < 0 ? null : items[i + 1] || items[i - 1];
      if (next) V.go(next.dataset.id);
      binU([m]);
    });
    }
    function bin(m, quiet) {   // quiet: the list drawn again by the caller, once for several
      var say = function (e) { alert((m.mine ? m.title : m.topic) + ' was not deleted: ' + (e && e.message ? e.message : e)); }, sent = null;
      if (m.mine) {
        var r = mine[m.id]; if (!r) return;
        r.hidden = true; r.deleted = Date.now(); minePut(r).catch(function () {});
        folderMove(m.id, true);
        sent = r.site && repo() && token() ? siteBin(r.site, true).catch(say) : null;   // on the site already: its page there too
      } else sent = siteBin(m.id, true).catch(say);
      if (!quiet) V.refreshMine();
      return Promise.resolve(sent);
    }
    function binMany(ms) {   // several maps into Deleted, all shown there at once; with a token their commits follow one at a time (siteFront's queue); the map after them shown
      var ids = ms.map(function (m) { return m.id; }), rows = Array.prototype.slice.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)')).map(function (b) { return b.dataset.id; });
      var lastAt = Math.max.apply(null, ids.map(function (id) { return rows.indexOf(id); })), next = rows.slice(lastAt + 1).concat(rows.slice(0, lastAt).reverse()).filter(function (id) { return ids.indexOf(id) < 0; })[0];
      V.pickSet([]);
      if (next && V.chosen && ids.indexOf(V.chosen.id) >= 0) V.go(next);
      ms = ms.filter(function (m) { var b = twinBase(m); return !b || !ms.some(function (x) { return x.id === b + '-graphml' || x.id === b; }); });   // a twin goes with its GraphML map
      var all = Promise.all(ms.map(function (m) { return bin(m, true); }));   // the build's own maps (pageless) in one write
      V.refreshMine();
      return all;
    }
    function restore(m) {   // back into its group under its own name, or "<name> (1)" where the group has it in the same format
      m = parentOf(m);
      goneBack(m.mine ? (mine[m.id] || {}).group : V.movedOf(m.id) || m.group);   // its group of the reader's, deleted with it (the record keeps it, the list shows none while it is gone): back first, so the name is looked up there
      var name = mapName(m), to = nameTaken(name, m.group, fmtOf(m), m.id, m.tab) ? freeTitle(name, m.group, fmtOf(m), null, m.id, m.tab) : null;
      var say = function (e) { alert((m.mine ? m.title : m.topic) + ' was not restored: ' + (e && e.message ? e.message : e)); };
      if (m.mine) {
        var r = mine[m.id]; if (!r) return;
        r.hidden = false; delete r.deleted; if (to) r.title = to;
        minePut(r).catch(function () {});
        folderMove(m.id, false);
        var sent = r.site && repo() && token() ? siteBin(r.site, false, to).catch(say) : null;
      } else {
        var before = renamed[m.id];
        if (pageless(m)) to = null;   // no page to hold another name: back under its own
        if (to) renamed[m.id] = { was: before ? before.was : name, to: to };
        sent = siteBin(m.id, false, to).catch(function (e) { if (before) renamed[m.id] = before; else delete renamed[m.id]; say(e); });
      }
      V.refreshMine();
      return Promise.resolve(sent);   // the list's undo waits for it
    }
    // the group SBGN-ML's maps (build.py sbgn_map: <name>-sbgn, edited at maps/sbgn-ml/<name>-sbgn.sbgn) are their GraphML
    // map's twins, with no page of their own: in Deleted with it, restored and deleted forever with it; a twin deleted on
    // its own goes alone (maps/deleted.json)
    function twinOf(id) { return id.replace(/-graphml$/, '') + '-sbgn'; }   // a GraphML map's SBGN-ML twin (build.py sbgn_map)
    function twinBase(m) { return m && !m.mine && /^maps\/sbgn-ml\/[^/]+-sbgn\.sbgn$/.test(m.editPath || '') ? m.id.replace(/-sbgn$/, '') : null; }
    function parentOf(m) {
      var b = twinBase(m), l = V.siteList || [];
      if (!b) return m;
      var p = l.filter(function (x) { return x.id === b + '-graphml'; })[0] || l.filter(function (x) { return x.id === b; })[0];
      var pm = p && V.byId[p.id];
      return pm && pm.binned ? Object.assign({}, pm, { binned: m.binned }) : m;   // in Deleted with its GraphML map: restored and deleted forever with it; deleted alone: alone
    }
    // Original's record (create.js colsPick) kept with the map on GitHub too, while the page is connected and the map is
    // there: maps/colours/<its GitHub id>.json in the data repository (the site's build reads no such folder; written with
    // gh, so no build is started), found by another computer; a reader's own map by the id it has on GitHub, none while
    // it waits to be sent. siteErase takes it with the map
    function origGhId() {
      if (!site || site.pending || !(repo() && token())) return null;
      if (site.mine) { var r = mine[site.id]; return r && r.site || null; }
      return site.id || null;
    }
    function origPut(rec, sent) {   // sent(): called once GitHub has it
      var gid = origGhId(), body = JSON.stringify(Object.assign({}, rec, { sent: undefined }));
      if (!gid) return;
      var p = repo() + '/contents/maps/colours/' + encodeURIComponent(gid) + '.json';
      var put = function (again) {
        return gh(p + '?ref=main').then(function (q) { return q.ok ? q.json() : {}; }).then(function (d) {
          return gh(p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Colours kept in the viewer: ' + gid, content: b64(body), sha: d.sha || undefined, branch: 'main' }) });
        }).then(function (q) { if (q.ok) return sent(); if ((q.status === 409 || q.status === 422) && !again) return put(true); throw q.status; });   // a write meanwhile: once more on the new sha
      };
      put(false).catch(function (e) { warn('The map\u2019s own colours were kept in this browser only (GitHub ' + (e && e.message || e) + ').'); });
    }
    function origGh() {   // the record on GitHub, or null (none, not connected, offline)
      var gid = origGhId();
      return gid ? gh(repo() + '/contents/maps/colours/' + encodeURIComponent(gid) + '.json?ref=main', { headers: { Accept: 'application/vnd.github.raw' } }).then(function (q) { return q.ok ? q.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    }
    function siteErase(ids, gone) {   // every file of these site maps (maps/<id>.*, maps/extra/<id>/, maps/colours/<id>.json) in one commit on main, three tries;
      // gone: those with no page of their own ({ id, path: its edit_path }), their edited copies out and maps/deleted.json saying forever
      var tries = 0, post = ghPost; gone = gone || [];
      var go = function () {
        return api('/contents/maps?ref=main').then(ghJson).then(function (d) {
          var paths = d.filter(function (f) { return f.type === 'file' && ids.indexOf(f.name.replace(/\.[^.]+$/, '')) >= 0; }).map(function (f) { return f.path; });
          var twins = d.some(function (f) { return f.type === 'dir' && f.name === 'sbgn-ml'; }) ? api('/contents/maps/sbgn-ml?ref=main').then(ghJson).then(function (x) {   // a GraphML map's SBGN-ML twin, edited (build.py sbgn_map)
            x.forEach(function (f) { if (f.type === 'file' && ids.some(function (id) { return f.name === id.replace(/-graphml$/, '') + '-sbgn.sbgn'; })) paths.push(f.path); });
          }) : Promise.resolve();
          var extras = d.some(function (f) { return f.type === 'dir' && f.name === 'extra'; }) ? api('/contents/maps/extra?ref=main').then(ghJson) : Promise.resolve([]);
          var kept = d.some(function (f) { return f.type === 'dir' && f.name === 'colours'; }) ? api('/contents/maps/colours?ref=main').then(ghJson).then(function (x) {   // a map's own colours kept (create.js origPut)
            x.forEach(function (f) { if (f.type === 'file' && ids.indexOf(f.name.replace(/\.json$/, '')) >= 0) paths.push(f.path); });
          }) : Promise.resolve();
          return twins.then(function () { return kept; }).then(function () { return extras; }).then(function (x) {
            return Promise.all(x.filter(function (f) { return f.type === 'dir' && ids.indexOf(f.name) >= 0; }).map(function (f) { return api('/contents/' + f.path + '?ref=main').then(ghJson); }));
          }).then(function (ds) { ds.forEach(function (fs) { fs.forEach(function (f) { if (f.type === 'file') paths.push(f.path); }); }); return paths; });
        }).then(function (paths) {
          var tree = paths.map(function (p) { return { path: p, mode: '100644', type: 'blob', sha: null }; });
          if (!gone.length) return tree;
          var dirs = {}; gone.forEach(function (g) { var d = g.path.replace(/\/[^/]*$/, ''); (dirs[d] = dirs[d] || []).push(g.path); });
          return Promise.all(Object.keys(dirs).map(function (d) {   // an edited copy only where there is one
            return api('/contents/' + d + '?ref=main').then(function (r) { return r.ok ? r.json() : []; }).then(function (fs) {
              (Array.isArray(fs) ? fs : []).forEach(function (f) { if (f.type === 'file' && dirs[d].indexOf(f.path) >= 0) tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); });
            });
          })).then(function () { return tree; });
        }).then(function (tree) {
          return api('/git/ref/heads/main').then(ghJson).then(function (ref) {
            // maps/deleted.json as this commit has it (a write meanwhile refuses the commit, which is then made again):
            // forever for the build's own maps, no line left for a map erased with a page (nor for its twin)
            return binFileGet(ref.object.sha).then(function (d) {
              var o = binFileRead(d), was = binFileText(o), at = new Date().toISOString();
              ids.forEach(function (id) { delete o[id]; if (/-graphml$/.test(id)) delete o[twinOf(id)]; });
              gone.forEach(function (g) { o[g.id] = { deleted: 'forever', written: at }; });
              if (binFileText(o) !== was) tree.push({ path: BIN_FILE, mode: '100644', type: 'blob', content: binFileText(o) });
              return ref;
            });
          }).then(function (ref) {
            if (!tree.length) return;
            return api('/git/commits/' + ref.object.sha).then(ghJson).then(function (c) {
              return post('/git/trees', { base_tree: c.tree.sha, tree: tree });
            }).then(function (t) { return post('/git/commits', { message: 'Deleted forever in the viewer: ' + ids.join(', '), tree: t.sha, parents: [ref.object.sha] }); })
              .then(function (c) { return post('/git/refs/heads/main', { sha: c.sha }, 'PATCH'); });
          });
        }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
      };
      return go().then(function () { shared.ghDir = null; });
    }
    // A reader without a token who keeps their maps in a folder: a map deleted moves its file into the folder's Deleted/, Restore moves it back (beside a file
    // of the same name: -2, ...), Delete forever removes it there. The folder's scan reads the folder's own files only,
    // so nothing in Deleted/ comes back as a map. Connected, the folder is not used (GitHub is where the maps are)
    var BIN_DIR;
    function __run26() {   // run at start, in order (__start)
    BIN_DIR = 'Deleted';
    }
    function folderMove(id, toBin) {
      if (repo() && token()) return Promise.resolve();
      return folder().then(function (f) {
        if (!f || !f.files[id]) return;
        var w = f.files[id], inBin = w.name.indexOf(BIN_DIR + '/') === 0, nm = inBin ? w.name.slice(BIN_DIR.length + 1) : w.name;
        if (inBin === toBin) return;
        return f.dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
          if (p !== 'granted') return;
          return f.dir.getDirectoryHandle(BIN_DIR, { create: true }).then(function (bd) {
            var from = toBin ? f.dir : bd, to = toBin ? bd : f.dir, h2;
            return from.getFileHandle(nm).then(function (h) { return h.getFile(); }).then(function (fl) {
              return to.getFileHandle(nm).then(function () { return freeName(to, nm, 2); }, function () { return nm; }).then(function (nm2) {
                return to.getFileHandle(nm2, { create: true }).then(function (x) { h2 = x; return x.createWritable(); })
                  .then(function (wr) { return wr.write(fl).then(function () { return wr.close(); }); })
                  .then(function () { return h2.getFile(); })
                  .then(function (nf) { return from.removeEntry(nm).then(function () { return folderFile(id, { name: (toBin ? BIN_DIR + '/' : '') + nm2, mod: nf.lastModified, size: nf.size }); }); })
                  .then(function () {   // back from Deleted/ under another name: Original's record follows (core.js origRead); one under the new name taken out
                    if (toBin || nm2 === nm) return;
                    return origRead(f, nm).then(function (r) { return origFolderDrop(f, nm2).then(function () { return r && origWrite(f, nm2, r).then(function () { return origFolderDrop(f, nm); }); }); });
                  });
              });
            });
          });
        });
      }).catch(function (e) { warn('Not moved in the folder: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '.'); });
    }
    function folderErase(id) {   // a reader's map's file in their folder (or its Deleted/); its entry kept if the file stays (the folder's scan then leaves it)
      return folder().then(function (f) {
        if (!f || !f.files[id]) return;
        var nm = f.files[id].name, inBin = nm.indexOf(BIN_DIR + '/') === 0;
        return f.dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
          if (p !== 'granted') return;
          return (inBin ? f.dir.getDirectoryHandle(BIN_DIR) : Promise.resolve(f.dir)).then(function (d) { return d.removeEntry(inBin ? nm.slice(BIN_DIR.length + 1) : nm); })
            .catch(function (e) { if (!e || e.name !== 'NotFoundError') throw e; }).then(function () {
            return origFolderDrop(f, inBin ? nm.slice(BIN_DIR.length + 1) : nm);   // Original's record with it (core.js)
          }).then(function () {
            return V.draftDo('readwrite', function (st) { var q = st.get('files'); q.onsuccess = function () { var r = q.result || {}; delete r[id]; st.put(r, 'files'); }; return q; }, 'folder');
          });
        });
      }).catch(function () {});
    }
    var hiddenGone;
    function __run27() {   // run at start, in order (__start)
    hiddenGone = {};
    }   // site maps let go here (the build still lists them until it runs again)
    function erase(ms) {
      ms = ms.filter(Boolean).map(parentOf).filter(function (m, i, a) { return a.findIndex(function (x) { return x.id === m.id; }) === i; }); if (!ms.length) return;
      var n = ms.length, what = n === 1 ? (ms[0].mine ? ms[0].title : ms[0].topic) : n + ' maps';
      if (!confirm('Delete ' + what + ' forever? This cannot be undone.')) return;
      var site = [], gone = [], gh = !!(repo() && token());
      ms.forEach(function (m) {
        if (m.mine) {
          var r = mine[m.id]; if (!r) return;
          if (r.site && gh) site.push(r.site);   // on the site already (Delete map is offered on it only with a token)
          var u = mineURLs[m.id]; if (u) { letGo(u.svg); letGo(u.text); }
          delete mine[m.id]; delete mineURLs[m.id]; mineFlag();
          V.draftDo('readwrite', function (st) { return st.delete(m.id); }, 'mine').catch(function () {});
          folderErase(m.id);
        } else { site.push(m.id); if (pageless(m)) gone.push({ id: m.id, path: m.editPath }); }
      });
      if (!site.length) return V.refreshMine();
      site.forEach(function (id) { hiddenGone[id] = 1; binClear(id); delete renamed[id]; draftDrop(id); });
      namedSave();
      V.refreshMine();
      siteErase(site, gone).then(function () {
        hiddenSet(siteHidden().filter(function (id) { return site.indexOf(id) < 0; }));
      }, function (e) {
        site.forEach(function (id) { delete hiddenGone[id]; });
        V.refreshMine();
        alert('Not deleted forever on GitHub: ' + (e && e.message ? e.message : e) + '. The map stays in Deleted.');
      });
    }
    // the site's maps an older version hid in this browser (Remove map) moved into Deleted once, with a token
    function binMigrate() {
      var hid = siteHidden();
      if (!hid.length || !(repo() && token()) || !V.siteList) return;
      var ids = {}; V.siteList.forEach(function (m) { ids[m.id] = m; });
      var left = [];   // not moved (GitHub refused): kept hidden, tried again next time
      return hid.reduce(function (q, id) {
        return q.then(function () {
          var m = ids[id];
          if (!m || m.deleted || !canDelete(m, true)) return;
          return siteBin(id, true).catch(function () { left.push(id); });
        });
      }, Promise.resolve()).then(function () {
        hiddenSet(left);
        V.refreshMine();
      });
    }
    // Undo in the list (Cmd or Ctrl with Z, Shift with it or Y redoes), as Finder's Edit > Undo: every change the list
    // makes, each by the same functions taken back (a move, Delete and Restore, a name, a group made, renamed or removed,
    // a new map, a copy or files added, put in Deleted), the order dragged as it was. The keys go to the list while it is
    // where the last press was (or the last change came from), else to the map being edited (core.js); outside editing
    // always to the list. Delete forever is not undone (as emptying the Bin). One step at a time, after the change before
    var listPast, listLast, listStepping;
    function __run28() {   // run at start, in order (__start)
    listPast = [], listLast = false, listStepping = Promise.resolve();
    }
    function listDid(undo, redo, e) { e = e || { undo: undo, redo: redo }; e.at = V.tick(true); listPast.push(e); if (listPast.length > 100) listPast.shift(); shared.listAhead = []; listLast = true; }
    function listTop(back) { var s = back ? listPast : shared.listAhead; return s.length ? s[s.length - 1].at || 0 : 0; }   // when the list's next undo (or redo) was taken (V.tick)
    function listFirst(back) { var lt = listTop(back); if (!lt || lt <= mapTop(back)) return false; listStep(back); return true; }   // the Edit window's Undo and Redo: the list's step when it is newer than the map's
    function listStep(back) {
      var s = (back ? listPast : shared.listAhead).pop();   // taken at the press, so the next press (and a setting's) sees the step after it
      if (!s) return;
      s.at = V.tick(); (back ? shared.listAhead : listPast).push(s);
      listStepping = listStepping.then(function () {
        return new Promise(function (ok) { ok(back ? s.undo() : s.redo()); }).catch(function () {}).then(function () { V.refreshMine(); });   // a throw never stops the steps after it
      });
    }
    function listCur(id, site) { return V.byId[id] || (site && V.byId[site]) || null; }   // a reader's map once the site's build took its place
    function listKey(m) { return { id: m.id, site: mine[m.id] ? mine[m.id].site || null : null }; }
    function leaveIf(ks) {   // the map being edited is not deleted: editing ends first (the Maps tab)
      if (!V.grid.classList.contains('m2-editing') || !V.chosen || !ks.some(function (k) { var c = listCur(k.id, k.site); return c && c.id === V.chosen.id; })) return;
      V.win = 'list'; V.railMark(); if (V.chosen) V.put(V.chosen); else stop();   // as the Edit window's stop, also with the Edit panel on the right
    }
    function binKeys(ks) { leaveIf(ks); var ms = ks.map(function (k) { return listCur(k.id, k.site); }).filter(function (m) { return m && !m.binned; }); return ms.length ? binMany(ms) : null; }
    function restoreKeys(ks) { return Promise.all(ks.map(function (k) { var m = listCur(k.id, k.site); return m && m.binned ? restore(m) : null; })); }
    function binU(ms, many) {
      var ks = ms.map(listKey), fwd = Promise.resolve(many ? binMany(ms) : bin(ms[0]));
      listDid(function () { return fwd.then(function () { return restoreKeys(ks); }); }, function () { return binKeys(ks); });
      return fwd;
    }
    function restoreU(m) {   // a twin by its GraphML map, as restore; a group of the reader's it brought back goes again with its undo
      var ks = [listKey(parentOf(m))], had = mineGroups().slice(), fwd = restore(m), made = mineGroups().filter(function (g) { return had.indexOf(g) < 0; })[0];
      listDid(function () { return fwd.then(function () { return binKeys(ks); }).then(function () { if (made && !inGroup(made).length) groupGo(made); }); }, function () { return restoreKeys(ks); });
    }
    function listMade(run) {   // a new map, a copy or files added: undone into Deleted, as Finder's undo of a copy
      var ks = [], at = location.hash.slice(1);   // at: the map shown before, shown again when the undo takes the one made away
      var e = { undo: function () { return fwd.then(function () { var on1 = ks.some(function (k) { var c = listCur(k.id, k.site); return c && c.id === location.hash.slice(1); }); return Promise.resolve(binKeys(ks)).then(function () { if (on1 && at && V.byId[at] && !V.byId[at].binned) V.go(at); }); }); },
        redo: function () { return Promise.resolve(restoreKeys(ks)).then(function () { var c = ks.length === 1 && listCur(ks[0].id, ks[0].site); if (c) V.go(c.id); }); } };   // the copy shown again, as when it was made
      var fwd = mineIn.then(function () {
        var had = {}; Object.keys(mine).forEach(function (id) { had[id] = !mine[id].hidden; });   // a deleted map brought back by its file counts as made
        return Promise.resolve(run()).then(function () {
          Object.keys(mine).forEach(function (id) { if (!had[id] && !mine[id].hidden) ks.push(listKey(mine[id])); });
          if (!ks.length) listPast.splice(listPast.indexOf(e) >>> 0, 1);   // nothing made: no step left behind
        });
      });
      listDid(e.undo, e.redo, e);   // in the steps at once, so an undo meanwhile waits for it
      return fwd;
    }
    function moveU(ids, g, before) {   // a move by Move to or by dragging: each map back to its group, its page as it was, its name, the order
      var o = V.orderNow(), o2 = null, gh = !!(repo() && token());
      var was = ids.map(function (id) {
        var m = V.byId[id], s = (V.siteList || []).filter(function (x) { return x.id === id; })[0];
        return { id: id, g: m ? m.group || '' : '', name: m ? mapName(m) : '', mv: V.movedOf(id), s: !mine[id] && s, page: !mine[id] && !!m && gh && canRename(m, true) && !ownGroup(g || '') };
      });
      var fwd = (ids.length > 1 ? moveMany(ids, g, before) : moveTo(ids[0], g, before)).then(function () { was.forEach(function (w) { w.pw = pageWas[w.id]; delete pageWas[w.id]; }); o2 = V.orderNow(); });
      listDid(function () {
        return fwd.then(function () {
          return was.reduce(function (p, w) {
            return p.then(function () {
              var m = V.byId[w.id]; if (!m) return;
              if (!w.s) return moveTo(w.id, w.g);
              V.setMoved(w.id, w.page ? w.g : w.mv);   // a site map: where this browser had it (its page written back: there until a build of that write)
              if (w.page && (m.group || '') !== w.g) return siteFront(w.id, function (f) {   // its page as before: the group it was in (the site's own where that was the reader's), order, example
                f.set('group', JSON.stringify((ownGroup(w.g) ? w.s.group || '' : w.g).replace(/["\\]/g, ''))); var o = w.pw && w.pw.order != null ? w.pw.order : w.s.order; if (o != null) f.set('order', String(o)); if (w.s.example) f.set('example', 'true');
              }, 'Map moved back in the viewer').catch(function () {});
            }).then(function () {   // its name back, where the move gave it one: in this browser if that one is kept here
              var m = V.byId[w.id], n = renamed[w.id];
              if (m && mapName(m) !== w.name) return nameTo(m, w.name, !mine[w.id] && (n ? !!n.local : !gh));
            });
          }, Promise.resolve()).then(function () { V.orderPut(o); });
        });
      }, function () { return moveMany(ids, g, before).then(function () { if (o2) V.orderPut(o2); }); });
      return fwd;
    }
    function removeU(name) {   // Remove group: back with its maps, the site maps moved into it, its place and order
      var gs = mineGroups().slice(), at = gs.indexOf(name), o = V.orderNow(), shut = !!V.closed[name];
      var recs = Object.keys(mine).filter(function (id) { return mine[id].group === name; });
      var moved = (V.siteList || []).filter(function (m) { return V.movedOf(m.id) === name; }).map(function (m) { return m.id; });
      removeGroup(name);
      listDid(function () {
        recs.forEach(function (id) { var r = mine[id]; if (r) { r.group = name; minePut(r).catch(function () {}); } });
        moved.forEach(function (id) { V.setMoved(id, name); });
        if (shut) { V.closed[name] = true; V.saveClosed(); }
        groupBack(name, at); V.orderPut(o);
      }, function () { removeGroup(name); });
    }
    var own;
    function __run29() {   // run at start, in order (__start)
    window.addEventListener('pointerdown', function (e) {   // where the last press was: the list, else elsewhere (a menu keeps it as it was)
      var t = e.target.closest ? e.target : e.target.parentElement;
      if (t && t.closest('.m2-cx')) return;
      listLast = !!(t && t.closest('#m2-list')) && !(V.grid.classList.contains('m2-editing') && t.closest('.m2-map'));   // a map chosen while editing: the keys to that map's undo, until the list itself changes (listDid)
    }, true);
    window.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = V.letter(e);
      if (k !== 'z' && k !== 'y') return;
      if (naming || V.typing()) return;   // a field's own undo
      var list = document.getElementById('m2-list'), bk = k === 'z' && !e.shiftKey;
      var toList = !!(list && list.offsetParent) && !(V.grid.classList.contains('m2-editing') && !listLast);
      if (V.setFirst(bk, toList ? listTop(bk) : mapTop(bk))) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // a setting changed after the list's or the map's step: undone first (V.setDid)
      if (!toList) return;   // the map's undo (core.js)
      e.preventDefault(); e.stopImmediatePropagation();
      listStep(bk);
    }, true);
    // what the viewer asks of this part (the list's entries and groups, a map's record)
    own = {
      read: function () { return mineIn; },
      here: function () { return (groupsHere = mineGroupsHere()); }, groups: function () { return groupsHere; }, order: mineGroups,   // order: every group the reader made, on the site or not, in their order
      withMine: withMine, addPaint: addPaint, isGroup: ownGroup, movable: movable, moveTo: function (id, g, before) { return moveU([id], g, before); }, moveMany: moveU, did: listDid, rename: renameGroup, canRenameGroup: canRenameGroup, renameMap: renameMap, canRename: canRename, newMap: function (g, f) { return listMade(function () { return newMap(g, f); }); }, shown: mineShown, listItems: listItems,
      rec: function (id) { return mine[id] || null; }, naming: function () { return !!naming; },
      tool: { kind: function (id) { return fmtOf(V.byId[id] || {}); }, name: function (id) { var m = V.byId[id]; return m ? mapName(m) : ''; }, text: function (id) { var m = V.byId[id]; return m ? textNow(m) : Promise.reject(new Error('the map is no longer in the list')); }, add: fromTool }   // what a tool's run is handed (tools.js)
    };
    mineIn.then(upAll).then(binMigrate);
    }   // connected: the reader's maps kept in this browser go to GitHub

    export function __start() { __run1(); __run2(); __run3(); __run4(); __run5(); __run6(); __run7(); __run8(); __run9(); __run10(); __run11(); __run12(); __run13(); __run14(); __run15(); __run16(); __run17(); __run18(); __run19(); __run20(); __run21(); __run22(); __run23(); __run24(); __run25(); __run26(); __run27(); __run28(); __run29(); }   // the part's statements, in their order
    export { draftDrop, draftPut, folder, folderFile, folderForget, folderSet, keepBeside, keptNow, listFirst, listTop, mine, mineAdd, mineIn, mineMatch, minePut, origGh, origPut, own, savedMine, toGh, upAll, upRun };
