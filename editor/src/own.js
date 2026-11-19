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
    var dirP = null;
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
    var MINE_KEY = 'atlas-mine', mine = {}, mineURLs = {};
    function mineFlag() { try { if (Object.keys(mine).length) localStorage.setItem(MINE_KEY, '1'); else localStorage.removeItem(MINE_KEY); } catch (e) {} }
    var mineIn = (function () {
      var has; try { has = localStorage.getItem(MINE_KEY); } catch (e) {}
      if (!has || !window.indexedDB) return Promise.resolve();
      return V.draftDo('readonly', function (st) { return st.getAll(); }, 'mine').then(function (all) {
        (all || []).forEach(function (r) { if (r && r.id && !mine[r.id]) mine[r.id] = r; });
        var legacy = null; try { legacy = localStorage.getItem('atlas-mine-group'); localStorage.removeItem('atlas-mine-group'); } catch (e) {}
        if (legacy && mineGroups().indexOf(legacy) < 0) mineGroupsSet(mineGroups().concat([legacy]));   // the single group of an older version, named by the reader
        Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === undefined) { r.group = legacy || ''; minePut(r).catch(function () {}); } });
      }).catch(function () {});
    })();
    function minePut(r) {
      mine[r.id] = r; mineFlag();
      return V.draftDo('readwrite', function (st) { return st.put(r, r.id); }, 'mine');
    }
    function mineShown() { return Object.keys(mine).map(function (k) { return mine[k]; }).filter(function (r) { return !r.hidden; }); }
    // the reader's groups (each named at once when added, no predefined name): as many as they
    // like, each named when made, kept in their browser in the order made (atlas-mine-groups); a map in no group stands
    // at the top of the list. Never a name of the site's groups or another of theirs (the two would merge)
    var GROUPS_KEY = 'atlas-mine-groups';
    function mineGroups() {
      try { var a = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (g) { return typeof g === 'string' && g; }) : []; } catch (e) { return []; }
    }
    function mineGroupsSet(a) { try { if (a.length) localStorage.setItem(GROUPS_KEY, JSON.stringify(a)); else localStorage.removeItem(GROUPS_KEY); } catch (e) {} }
    // kept for every atlas page of this address; on a page whose site has a group of the same name, that group of the
    // reader's is not shown (its maps stand at the top), so the two never merge
    var groupsHere = [];
    function mineGroupsHere() {
      var site = (V.siteList || []).map(function (m) { return m.group; });
      return mineGroups().filter(function (g) { return site.indexOf(g) < 0; });
    }
    function ownGroup(name) { return !!name && groupsHere.indexOf(name) >= 0; }
    function mineValid(v, was) {
      return v === was || !((V.siteList || []).some(function (m) { return m.group === v; }) || mineGroups().indexOf(v) >= 0);
    }
    // a name typed in place in the list, one way for groups and maps (inPlace): the field where the line was; Enter or a click elsewhere keeps it, Esc leaves it; o.bad(v) gives why a name is
    // refused (the field red, kept open). The list is not built again while it is open (V.naming, the viewer's
    // buildList), so a save or a folder scan meanwhile never drops what is being typed
    var naming = null;
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
    function renameGroup(was) {
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
          if (!v || v === was || !mineValid(v, was)) return;
          var gs = mineGroups();
          if (was && gs.indexOf(was) >= 0) {
            gs[gs.indexOf(was)] = v;
            Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === was) { r.group = v; minePut(r).catch(function () {}); } });
            V.regroupRename(was, v);   // site maps moved into it follow
            if (V.closed[was]) { V.closed[v] = true; delete V.closed[was]; V.saveClosed(); }
          }
          mineGroupsSet(gs);
        } });
    }
    var pressed = false;
    document.addEventListener('pointerdown', function () { pressed = true; }, true);
    document.addEventListener('pointerup', function () { setTimeout(function () { pressed = false; }, 0); }, true);
    function removeGroup(name) {   // the group goes, its maps stay, at the top of the list
      mineGroupsSet(mineGroups().filter(function (g) { return g !== name; }));
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === name) { r.group = ''; minePut(r).catch(function () {}); } });
      V.regroupRename(name, null);   // site maps moved into it back to their own groups
      if (V.closed[name]) { delete V.closed[name]; V.saveClosed(); }
      V.refreshMine();
    }
    // the right-click menu over the list, where the Edit tab is: on a map Rename map, Make a copy, Move to, or on a group
    // of theirs Rename group, first; then New SBGN-ML map, New CellDesigner map, Add map from file (into the group
    // clicked, if it is the reader's or with a token the site's, else at the top), Add group; Delete map or Remove group
    // last of all (items.last). The viewer asks for them (listItems) and shows the menu, its own entries (Open all groups, ...) between
    var addTo = '';
    function listItems(e) {
      var t = e.target.closest('.m2-map, .m2-group, .m2-empty'), m = t && t.classList.contains('m2-map') ? V.byId[t.dataset.id] : null;
      var gh = !!(repo() && token()), tg = t && !t.classList.contains('m2-link-group') && t.dataset.group;   // with a token a site group takes maps too
      var g = m ? (m.mine || gh ? m.group || '' : '') : tg && (ownGroup(tg) || gh) ? tg : '', onGroup = t && !m && ownGroup(g);
      var into = m ? m.group || '' : tg && (ownGroup(tg) || V.siteGroupOf(tg) || t.classList.contains('m2-empty')) ? tg : '';   // a new map: into the group clicked, whoever's it is
      var items = [['New SBGN-ML map', function () { newMap(into); }], ['New CellDesigner map', function () { newMap(into, 'cd'); }], ['Add map from file', function () { addTo = g; picker.click(); }], ['Add group', function () { renameGroup(null); }]];
      if (canRestoreExamples()) items.push(['Restore example maps', restoreExamples]);   // maps back into the list, rarely: the group's end
      var editing = V.grid.classList.contains('m2-editing') && V.chosen && V.chosen.id === (m && m.id);   // while editing, current is the editor's own
      // Deleted (as a mailbox's or the Mac's Bin): on a map in it Restore, then Delete forever last; on its heading
      // Delete all forever. Nothing else there (a deleted map is not renamed, copied, moved or edited)
      if (m && m.binned) { var bi = [['Restore', function () { restore(m); }]]; bi.last = [['Delete forever', function () { erase([m]); }]]; return bi; }
      if (t && t.dataset.bin) { var bh = []; bh.last = [['Delete all forever', function () { erase(V.maps.filter(function (x) { return x.binned; })); }]]; return bh; }
      // on a map: Rename map, Make a copy, Move to, at the top; Delete map last of all, under a line of its own, away
      // from the others (as the map's menu: not while it is edited)
      var mapItems = [], x = e.clientX, y = e.clientY;
      if (m && canRename(m, gh)) mapItems.push(['Rename map', function () { renameMap(m.id); }]);
      if (m && canCopy(m)) mapItems.push(['Make a copy', function () { copyMap(m.id); }]);
      if (m && movable(m) && V.listGroups().length) mapItems.push(['Move to...', function () { moveMenu(m, x, y); }]);
      // the clicked map's or group's own items first, as file lists keep them; the new maps and groups under a line
      if (mapItems.length) items = mapItems.concat([null], items);
      if (onGroup) items = [['Rename group', function () { renameGroup(g); }], null].concat(items);
      // items.last: put by the viewer under its own entries too, so Delete map is the menu's last line
      if (onGroup) items.last = [['Remove group', function () { removeGroup(g); }]];   // a removal: last, as Delete map
      if (m && !editing && canRename(m, gh)) items.last = [['Delete map', function () { bin(m); }]];   // one on the site already: with a token, its page there too
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
    function moveTo(id, g, before) {
      g = g || '';
      var m = V.byId[id], r = mine[id];
      if (r) { r.group = g; minePut(r).catch(function () {}); }
      else if (m) {
        if (g !== (m.group || '')) {   // a reorder in its own group is the reader's order alone
          // to the site with a token, the move kept in this browser too until the build has it; a reader's group stays theirs
          // (its name never written to the site, where it would merge with theirs); the build's own maps (no page) here only
          if (repo() && token() && canRename(m, true) && !ownGroup(g)) g = g.replace(/["\\]/g, '');
          V.setMoved(id, g);
          if (repo() && token() && canRename(m, true) && !ownGroup(g)) toSiteGroup(id, g).catch(function (e) {
            if (!e || !e.noPage) alert((m.topic || m.title) + ' was not moved on the site: ' + (e && e.message ? e.message : e) + '. The move is kept in this browser only.');
          });
        }
      } else return;
      put(id, g, before);
    }
    function toSiteGroup(id, g) {   // maps/<id>.md: its group and its order (after the group's last); one commit
      return siteFront(id, function (f) { f.set('group', JSON.stringify(g.replace(/["\\]/g, ''))); f.set('order', String(siteOrder(g))); }, 'Map moved in the viewer');
    }
    function put(id, g, before) {   // a map into the reader's order of group g, the group opened so the map stays in sight
      if (g && V.closed[g]) { delete V.closed[g]; V.saveClosed(); }
      V.placeMap(id, g, before); V.refreshMine();
    }
    function moveMenu(m, x, y) {   // the groups the map can go to, in the list's order; its own greyed
      var site = (V.siteList || []).map(function (s) { return s.group; });
      var gs = V.listGroups().filter(function (n) { return n && (ownGroup(n) || site.indexOf(n) >= 0); });
      V.listMenu(x, y, [['No group', function () { moveTo(m.id, ''); }, !m.group], null].concat(gs.map(function (n) {
        return [n, function () { moveTo(m.id, n); }, n === m.group];
      })));
    }
    // Make a copy, in the list's menu: a new map named Copy of <name> (as in Google Docs), in the same group right under
    // the original, opened at once with its name field open to rename it. Of a reader's own map, or of the site's
    // GraphML or CellDesigner map as it is now (the edits this page holds, else GitHub's version, else the site's);
    // with a token every copy goes to the site, as Add map does (an SBGN-ML one only made here)
    function canCopy(m) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] : !!graphmlOf(m) && (!sbMap(m) || /^maps\/[^/]+\.sbgn$/.test(m.editPath || ''))); }   // an SBGN-ML map of the site's own, not one of its groups'
    function freeTitle(t, also) {   // a name no map in the list has (nor one of also): (1), (2), ... after it, whatever the format (a file's format is not its name)
      var titles = liveTitles().concat(also || []), f = t;
      for (var k = 1; titles.indexOf(f) >= 0; k++) f = t + ' (' + k + ')';
      return f;
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
      var r0 = m.mine ? mine[id] : null, title = freeTitle('Copy of ' + (r0 ? r0.title : m.topic || m.title)), group = m.group || '', next = after(id);   // next: read before the copy is in the list
      var ext = r0 ? (r0.file.match(/\.[^.]+$/) || ['.xml'])[0] : cdMap(m) ? '.xml' : sbMap(m) ? '.sbgn' : '.graphml';
      var file = freeFile(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + ext);
      var gh = !!(repo() && token());
      return mineIn.then(function () { return textNow(m); }).then(function (t) {
        if (gh) { ext = siteExt(t); if (!ext) throw new Error(siteWhy(t)); }
        var made = r0 && t === r0.text ? Promise.resolve({ svg: r0.svg, width: r0.width, height: r0.height }) : drawText(t);
        return made.then(function (d) {
          var r = { id: newId(), title: title, file: file, text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(t), hidden: false, group: group };
          if (!gh) return minePut(r).then(function () { toFolder(r.id, r.file, r.text); return r; });
          return toSite(title, ext, t, group, siteOrder(group)).then(function (s) { return minePut(onSite(r, s, title)).then(function () { return r; }); });
        });
      }).then(function (r) {
        put(r.id, group, next);
        V.go(r.id);
        if (!naming) setTimeout(function () { renameMap(r.id); }, 0);   // its name field open, the text selected (a copy on its way to the site is named by its file)
      }).catch(function (e) { alert('No copy was made: ' + (e && e.message ? e.message : e)); });
    }
    function siteOrder(group) { return (V.siteList || []).reduce(function (a, s) { return (!group || s.group === group) ? Math.max(a, s.order || 0) : a; }, 0) + 1; }   // after the group's last on the site
    function after(id) {   // the map after id in its group, so a copy lands right under the original
      var ms = V.maps, i = ms.findIndex(function (x) { return x.id === id; });
      return i >= 0 && ms[i + 1] && (ms[i + 1].group || '') === (ms[i].group || '') ? ms[i + 1].id : null;
    }
    function examplesHidden() { try { return localStorage.getItem('atlas-examples') === 'hidden'; } catch (e) { return false; } }
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
      var cdm = /<sbml[\s>]/.test(r.text.slice(0, 3000)) && r.text.indexOf('celldesigner') >= 0, sbm = !cdm && isSb(r.text);
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
    var HIDDEN_KEY = 'atlas-hidden-maps';
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
        var d = binState(twinBase(m) ? parentOf(m) : m, pend);   // a twin as its GraphML map
        if (!d && hid.indexOf(m.id) < 0) return true;
        if (gh) binned.push(Object.assign({}, m, { binned: d ? Date.parse(d) || Date.now() : Date.now() }));   // deleted: seen in Deleted with a token, else not at all
        return false;
      });
      if (Object.keys(pend).length !== n0) binPendingSet(pend);   // entries the build has now let go
      var own = mineShown().sort(function (a, b) { return a.title.localeCompare(b.title); }).map(mineEntry);
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.hidden) binned.push(Object.assign(mineEntry(r), { binned: r.deleted || r.at })); });
      var shown = own.concat(list);
      if (examplesHidden() && shown.some(function (m) { return !m.example; })) shown = shown.filter(function (m) { return !m.example; });
      return shown.concat(binned);
    }
    // Example maps: the site's maps whose pages say example: true (and the SBGN-ML twins of those in the group GraphML);
    // every other map is the reader's, whoever or whatever made it. Hide example maps (the list's menu, Settings' List)
    // leaves them out while the list has others to show (examplesMixed). Restore example maps puts them back as the
    // site's backup keeps them: the data repository's examples/, the same paths as in maps/. With a token one commit
    // copies it over maps/ (an example deleted, even forever, comes back) and drops their edited SBGN-ML copies
    // (maps/sbgn-ml/<name>-sbgn.sbgn), so the build writes those again from the GraphML maps; in this browser, with or
    // without a token, their drafts, Deleted marks, moves to other groups and names given meanwhile are let go
    var exBackup = null;   // with a token: whether the data repository has examples/, asked once
    function backupKnown() {
      if (exBackup !== null || !(repo() && token())) return;
      exBackup = false;
      api('/contents/examples?ref=main').then(function (r) { exBackup = r.ok; }, function () { exBackup = null; });
    }
    function exampleIds() { return (V.siteList || []).filter(function (m) { return m.example; }).map(function (m) { return m.id; }); }
    function examplesMixed() {   // the list has examples and other maps shown (as withMine leaves them)
      var l = V.siteList || [], pend = binPending(), hid = siteHidden();
      return l.some(function (m) { return m.example; }) && (mineShown().length > 0 || l.some(function (m) { return !m.example && !hiddenGone[m.id] && !binState(m, pend) && hid.indexOf(m.id) < 0; }));
    }
    function canRestoreExamples() {
      if (V.grid.classList.contains('m2-editing') && V.chosen && V.chosen.example) return false;   // its moves would be saved over the restored file (while editing, current is the editor's own)
      backupKnown();
      return exampleIds().length > 0 || (exBackup === true && !!(repo() && token()));
    }
    function restoreExamples() {
      var gh = !!(repo() && token());   // nothing asked: the examples' earlier versions stay in the data repository's history
      // shown restored at once; with a token GitHub's commit follows, and if it fails the list goes back as it was
      var was = { pend: binPending(), hidden: siteHidden(), moved: {}, renamed: {}, gone: {} };
      var ids = exampleIds();
      ids.forEach(function (id) { was.moved[id] = V.movedOf(id); was.renamed[id] = renamed[id]; was.gone[id] = hiddenGone[id]; });
      examplesHere(ids, gh);
      if (!gh) return;
      examplesToSite().then(function (all) {
        examplesHere(all.filter(function (id) { return ids.indexOf(id) < 0; }), gh);   // deleted forever before: shown once the build has them
      }).catch(function (e) {
        binPendingSet(was.pend); hiddenSet(was.hidden);
        ids.forEach(function (id) {
          if (was.moved[id] !== null) V.setMoved(id, was.moved[id]);
          if (was.renamed[id]) renamed[id] = was.renamed[id];
          if (was.gone[id]) hiddenGone[id] = was.gone[id];
        });
        V.refreshMine();
        alert('The example maps were not restored: ' + (e && e.message ? e.message : e));
      });
    }
    function examplesHere(ids, gh) {   // this browser's changes to these examples (and their SBGN-ML twins) let go, the list drawn again
      var all = ids.concat(ids.filter(function (id) { return /-graphml$/.test(id); }).map(function (id) { return id.replace(/-graphml$/, '') + '-sbgn'; }));
      var pend = binPending(), deleted = {};
      (V.siteList || []).forEach(function (m) { deleted[m.id] = m.deleted; });
      all.forEach(function (id) {
        if (gh && deleted[id]) pend[id] = ['', Date.now()]; else delete pend[id];   // in Deleted on the build still: out of it until the build has the restore
        unkeep(id).catch(function () {}); delete hiddenGone[id]; delete renamed[id]; V.setMoved(id, null);
      });
      binPendingSet(pend);
      if (V.kept && all.indexOf(V.kept.id) >= 0) V.dropKept();
      var m = V.current && V.byId[V.current.id];
      if (m && all.indexOf(m.id) >= 0 && !V.grid.classList.contains('m2-editing')) V.put(m, true);   // shown: as the site has it
      hiddenSet(siteHidden().filter(function (id) { return all.indexOf(id) < 0; }));   // an older version's hiding
      V.refreshMine();
    }
    function examplesToSite() {   // examples/ over maps/ in one commit on main, three tries; the ids restored
      var tries = 0, post = ghPost;
      var go = function () {
        return api('/git/ref/heads/main').then(ghJson).then(function (ref) {
          return api('/git/commits/' + ref.object.sha).then(ghJson).then(function (c) {
            return api('/git/trees/' + c.tree.sha).then(ghJson).then(function (root) {
              var ex = root.tree.filter(function (f) { return f.path === 'examples' && f.type === 'tree'; })[0];
              if (!ex) throw new Error('this site keeps no example maps to restore');
              return Promise.all([api('/git/trees/' + ex.sha + '?recursive=1').then(ghJson), api('/contents/maps/sbgn-ml?ref=main').then(function (r) { return r.ok ? r.json() : []; })]);
            }).then(function (x) {
              if (x[0].truncated) throw new Error('the saved set is too large to read at once');
              var blobs = x[0].tree.filter(function (f) { return f.type === 'blob' && /^maps\//.test(f.path); });
              var ids = blobs.filter(function (f) { return /^maps\/[^/]+\.md$/.test(f.path); }).map(function (f) { return f.path.slice(5, -3); });
              if (!ids.length) throw new Error('the saved set is empty');
              var twins = ids.map(function (id) { return id.replace(/-graphml$/, '') + '-sbgn.sbgn'; });
              var gone = (Array.isArray(x[1]) ? x[1] : []).filter(function (f) { return f.type === 'file' && twins.indexOf(f.name) >= 0; });
              var tree = blobs.map(function (f) { return { path: f.path, mode: f.mode, type: 'blob', sha: f.sha }; })
                .concat(gone.map(function (f) { return { path: f.path, mode: '100644', type: 'blob', sha: null }; }));
              return post('/git/trees', { base_tree: c.tree.sha, tree: tree })
                .then(function (t) { return post('/git/commits', { message: 'Example maps restored in the viewer', tree: t.sha, parents: [ref.object.sha] }); })
                .then(function (n) { return post('/git/refs/heads/main', { sha: n.sha }, 'PATCH'); })
                .then(function () { ghDir = null; return ids; });
            });
          });
        }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
      };
      return go();
    }
    function examplesHide(hide) {   // Hide example maps or Show example maps, in the list's right-click menu
      try { if (hide) localStorage.setItem('atlas-examples', 'hidden'); else localStorage.removeItem('atlas-examples'); } catch (e) {}
      V.refreshMine();
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
    var making = false;
    function newMap(group, fmt) {
      if (making) return Promise.resolve();   // one at a time: a second click meanwhile would take the same name
      making = true;
      var titles = liveTitles();
      var files = mineShown().map(function (r) { return r.file; });   // a deleted map's file name free too (in a folder its file is in Deleted/)
      var title = 'Unnamed map', file;
      var ext = fmt === 'cd' ? '.xml' : '.sbgn', text;
      for (var k = 2; titles.indexOf(title) >= 0 || files.indexOf(file = title.toLowerCase().replace(/ /g, '-') + ext) >= 0; k++) title = 'Unnamed map ' + k;
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
    var renamed = {};   // site map id -> { was, to }: the list's name before and the one given here
    function canRename(m, gh) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && (!mine[m.id].site || !!gh) : !!gh && !/^maps\/sbgn-ml\//.test(m.editPath || '')); }   // one on its way to the site: in its page there too
    function siteNamed(list) {   // the names given here over the site's list (copies: the site's own entries untouched)
      return list.map(function (m) {
        var n = renamed[m.id];
        if (!n) return m;
        if (m.topic === n.to) { delete renamed[m.id]; return m; }   // the build has it
        return m.topic === n.was ? Object.assign({}, m, { topic: n.to }) : m;
      });
    }
    function renameMap(id) {
      if (naming) naming(true);
      var m = V.byId[id], b = document.querySelector('#m2-list .m2-map[data-id="' + CSS.escape(id) + '"]');
      if (!m || !b || !canRename(m, repo() && token())) return;
      var shown = m.mine ? m.title : m.topic;
      inPlace(b, { cls: 'm2-group-edit m2-map-edit' + (b.classList.contains('m2-sub') ? ' m2-sub' : ''), max: 120, value: shown, label: 'Name of the map',
        end: function (v) {
          if (!v || v === shown) return;
          if (m.mine) {
            var r = mine[id]; r.title = v; minePut(r).catch(function () {});
            if (r.site) {   // its page on the site too, the list's name over the site's until the build has it
              var sid = r.site, was0 = renamed[sid] ? renamed[sid].was : r.siteTitle || shown;
              renamed[sid] = { was: was0, to: v };
              toSiteName(sid, shown, v).catch(function (e) { delete renamed[sid]; alert(shown + ' was not renamed on the site: ' + (e && e.message ? e.message : e)); });
            }
          }
          else {
            var was = renamed[id] ? renamed[id].was : shown;
            renamed[id] = { was: was, to: v };
            toSiteName(id, shown, v).catch(function (e) { delete renamed[id]; V.refreshMine(); alert(shown + ' was not renamed: ' + (e && e.message ? e.message : e)); });
          }
          if (m.mine && V.current && V.current.id === id) {   // the map on screen, and the editor's own name of it
            document.getElementById('m2-title').textContent = v;
            if (map && map.id === id) map.title = v;
          }
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
      var r = { id: old ? old.id : newId(), title: old ? old.title : freeTitle(name.replace(/\.(graphml|xml|sbgn)$/i, '')),
        file: old ? old.file : name, text: back ? old.text : text, svg: back ? old.svg : d.svg, width: back ? old.width : d.width, height: back ? old.height : d.height,
        at: back ? old.at : Date.now(), src: old ? old.src || (id ? undefined : h) : h, hidden: false, group: group !== undefined ? group : old && old.group || '' };
      if (old && old.site) ['site', 'path', 'sha', 'saved', 'siteTitle'].forEach(function (k) { r[k] = old[k]; });   // on GitHub already: its file there, its new text sent once connected
      return minePut(r).then(function () { return old && old.hidden ? folderMove(r.id, false) : null; }).then(function () { return r; });   // out of Deleted: its folder file too
    }
    function addFiles(list, group) {   // a reader's files, drawn and kept; group: Add map or a drop on a group of theirs
      list = Array.prototype.slice.call(list);   // the picker's list empties when it is reset
      var picked = list.filter(function (f) { return /\.(graphml|xml|sbgn)$/i.test(f.name); });
      var gh = repo() && token(), last = null, failed = [], out = [];   // with a token: all drawn first, then sent in one commit
      var why = function (f) { return function (e) { failed.push(f.name + ': ' + (e && e.message ? e.message : e)); }; };
      return picked.reduce(function (p, f) {
        return p.then(function () { return f.text(); }).then(function (t) {
          if (isSb(t) && !madeHere(t)) throw new Error('an SBGN-ML file from another editor cannot be added yet, only one made here with New map');
          if (gh) return drawText(t).then(function (d) {   // with a token: to the site, shown from here until built
            var ext = siteExt(t), title = freeTitle(f.name.replace(/\.(graphml|xml|sbgn)$/i, ''), out.map(function (o) { return o.title; }));
            if (!ext) throw new Error(siteWhy(t));
            out.push({ f: f, d: d, t: t, ext: ext, title: title });
          });
          return drawText(t).then(function (d) { return mineAdd(f.name, t, d, null, group || undefined); }).then(function (r) { last = r.id; return toFolder(r.id, r.file, r.text); });
        }).catch(why(f));
      }, Promise.resolve()).then(function () {
        if (!out.length) return;
        var order = siteOrder(group);
        return toSiteMany(out.map(function (o) { return { title: o.title, ext: o.ext, text: o.t, group: group, order: order++ }; })).then(function (ss) {
          return out.reduce(function (p, o, i) {   // a part GitHub refused said, the parts sent kept
            if (ss[i].err) { why(o.f)(ss[i].err); return p; }
            var r = { id: newId(), title: o.title, file: o.f.name, text: o.t, svg: o.d.svg, width: o.d.width, height: o.d.height, at: Date.now(), hidden: false, group: group || '' };
            return p.then(function () { return minePut(onSite(r, ss[i], o.title)); }).then(function () { last = r.id; });
          }, Promise.resolve());
        });
      }).then(function () {
        V.refreshMine(); if (last) V.go(last);
        if (failed.length) alert((failed.length === 1 ? 'Not added, ' : failed.length + ' files not added:\n') + failed.join('\n'));
      });
    }
    var picker = document.createElement('input');
    picker.type = 'file'; picker.multiple = true; picker.accept = '.graphml,.xml,.sbgn'; picker.hidden = true;
    picker.addEventListener('change', function () { addFiles(picker.files, addTo); picker.value = ''; });
    document.body.appendChild(picker);
    document.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault(); });
    document.addEventListener('drop', function (e) {   // a file dropped on a group of the reader's goes into it, elsewhere to the top
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var t = e.target.closest && e.target.closest('#m2-list [data-group]'), g = t && t.dataset.group;
      addFiles(e.dataTransfer.files, ownGroup(g) ? g : '');
    });
    // With a token GitHub is where the reader's maps are kept: a map made or added goes there at once (toSite), and a
    // map of theirs still only in this browser (made before connecting, or its sending failed) is sent when the page
    // opens connected, when a token is connected, and when it is edited. Its record keeps the site's id, the file's
    // path and sha, and the text GitHub has (saved), so editing saves there (core.js push) and withMine knows when the
    // build has it. The file kinds the site's build takes: a yEd GraphML, a CellDesigner file, an SBGN-ML map made here
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
    var BULK = 20e6;
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
            ghDir = null;
            return ids.map(function (id, i) { used[id] = 1; delete hiddenGone[id]; binClear(id); return { id: id, path: 'maps/' + id + part[i].ext, sha: shas[i], text: part[i].text }; });   // the listing read again next time; an id deleted forever before, taken again: a map of its own
          }, function (e) { return e.split ? halves(part) : part.map(function () { return { err: e }; }); });
        });
      };
      return send(items);
    }
    function toSite(title, ext, text, group, order) { return toSiteMany([{ title: title, ext: ext, text: text, group: group, order: order }]).then(function (a) { if (a[0].err) throw a[0].err; return a[0]; }); }
    // one map of the reader's to GitHub; its record then, or null (gone or hidden). One send per map at a time, and one
    // at a time across this site's tabs (the record read again inside the lock: another tab may have sent it)
    var upping = {};
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
        if (src() !== n.saved) { dirty = true; changed(); }
      }, function (e) {
        if (site === s) warn('Not on GitHub: ' + String(e && e.message ? e.message : e).replace(/\.$/, '') + '. This map is kept in this browser only; it is sent again after the next change.');
      });
    }
    // every map of the reader's not on GitHub, or with changes GitHub does not have (a save that failed, a disconnect,
    // a file changed in the folder meanwhile), sent one after another once the site's list is in (a map's order is
    // after its group's last); what went said in grey, what did not in red
    var upRun = null;
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
        else if (went.length) note('Saved on GitHub: ' + went.join(', ') + '.');
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
    // menu on a reader's map or, with a token, on a site map with a page of its own, puts the map in Deleted: a group of
    // its own at the end of the list, closed on every page load, seen only by a reader with a token (site maps) or in
    // their own browser (their maps). A deleted map keeps its name and group, gives up its name (a new map may take it:
    // liveTitles) and is not edited. Restore puts it back into its group, as "<name> (1)" when its name is taken by then;
    // Delete forever takes it out for good: a reader's record and its folder file, a site map's files in one commit (git
    // history still has them). A site map's state is its page's front matter (deleted: <date>, ISO in UTC), kept here
    // meanwhile (atlas-bin-pending: id -> [the date, '' for restored; when]) until the build has it, at most an hour
    // (another device or tab may have changed it since)
    var BIN_KEY = 'atlas-bin-pending';
    function binPending() { try { var o = JSON.parse(localStorage.getItem(BIN_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
    function binPendingSet(o) { try { if (Object.keys(o).length) localStorage.setItem(BIN_KEY, JSON.stringify(o)); else localStorage.removeItem(BIN_KEY); } catch (e) {} }
    function binState(m, pend) {   // a site map's date in Deleted, '' if not; what this page did wins until the build has it (then let go)
      var p = pend[m.id];
      if (!Array.isArray(p) || (m.deleted || '') === p[0] || Date.now() - p[1] > 3600000) { delete pend[m.id]; return m.deleted || ''; }
      return p[0];
    }
    function binClear(id) { var p = binPending(); if (id in p) { delete p[id]; binPendingSet(p); } }
    function liveTitles() {   // the names taken: maps not in Deleted
      var pend = binPending(), hid = siteHidden();
      return mineShown().map(function (r) { return r.title; }).concat((V.siteList || []).filter(function (m) { return !binState(m, pend) && hid.indexOf(m.id) < 0; })
        .map(function (m) { var n = renamed[m.id]; return n && m.topic === n.was ? n.to : m.topic || m.title; }));
    }
    function ghPost(path, body, method) { return api(path, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(ghJson); }
    function ghJson(r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (d) { var e = new Error(d && d.message || 'GitHub ' + r.status); e.status = r.status; throw e; }); }
    // maps/<id>.md's front matter changed by edit({ get, set, drop }) in one commit, the closing line and the body as they were
    function siteFront(id, edit, message) {
      var path = '/contents/maps/' + encodeURIComponent(id) + '.md';
      return api(path + '?ref=main').then(function (r) { if (!r.ok) { var e = new Error(r.status === 404 ? 'it has no page of its own' : 'GitHub ' + r.status); e.noPage = r.status === 404; throw e; } return r.json(); })
        .then(function (d) {
          var md = new TextDecoder().decode(Uint8Array.from(atob(d.content.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); }));
          var fm = /^---(\r?\n)([\s\S]*?)\r?\n---/.exec(md);   // the front matter only, in the file's line ends
          if (!fm) throw new Error('its page has no front matter');
          var nl = fm[1], head = fm[2];
          edit({
            get: function (k) { var x = head.match(new RegExp('^' + k + ':[ \\t]*([^\\r\\n]*)', 'm')); return x ? x[1].replace(/^"(.*)"$/, '$1') : null; },
            set: function (k, v) { var re = new RegExp('^' + k + ':[^\\r\\n]*', 'm'); head = re.test(head) ? head.replace(re, function () { return k + ': ' + v; }) : head + nl + k + ': ' + v; },
            drop: function (k) { head = head.replace(new RegExp('^' + k + ':.*(\\r?\\n|$)', 'm'), '').replace(/\r?\n$/, ''); }
          });
          md = '---' + nl + head + fm[0].slice(3 + nl.length + fm[2].length) + md.slice(fm[0].length);
          return api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message + ': ' + id, content: b64(md), sha: d.sha, branch: 'main' }) });
        }).then(function (r) { if (!r.ok) throw new Error('GitHub ' + r.status); });
    }
    function siteBin(id, on, topic) {   // a site map into Deleted (on) or out of it (its new name, when its own was taken)
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
    // The Delete key (on a Mac the delete key, Backspace) on the map shown, outside edit mode, with the list in sight: Delete map,
    // as the list's menu offers it; the next map in the list shown first (the one before at the list's end), as a
    // mailbox goes on to the next message. Not in a field, a menu, a name being given, or on a map in Deleted
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (naming || document.querySelector('.m2-cx') || V.grid.classList.contains('m2-editing')) return;
      if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
      var list = document.getElementById('m2-list'), m = V.chosen && V.byId[V.chosen.id];
      if (!list || !list.offsetParent || !m || m.binned || !canRename(m, !!(repo() && token()))) return;
      e.preventDefault();
      var items = Array.prototype.slice.call(list.querySelectorAll('.m2-map:not(.m2-binned)')), i = items.findIndex(function (b) { return b.dataset.id === m.id; });
      var next = i < 0 ? null : items[i + 1] || items[i - 1];
      if (next) V.go(next.dataset.id);
      bin(m);
    });
    function bin(m) {
      var say = function (e) { alert((m.mine ? m.title : m.topic) + ' was not deleted: ' + (e && e.message ? e.message : e)); };
      if (m.mine) {
        var r = mine[m.id]; if (!r) return;
        r.hidden = true; r.deleted = Date.now(); minePut(r).catch(function () {});
        folderMove(m.id, true);
        if (r.site && repo() && token()) siteBin(r.site, true).catch(say);   // on the site already: its page there too
      } else siteBin(m.id, true).catch(say);
      V.refreshMine();
    }
    function restore(m) {   // back into its group under its own name, whatever other maps are called
      m = parentOf(m);
      var say = function (e) { alert((m.mine ? m.title : m.topic) + ' was not restored: ' + (e && e.message ? e.message : e)); };
      if (m.mine) {
        var r = mine[m.id]; if (!r) return;
        r.hidden = false; delete r.deleted;
        minePut(r).catch(function () {});
        folderMove(m.id, false);
        if (r.site && repo() && token()) siteBin(r.site, false).catch(say);
      } else siteBin(m.id, false).catch(say);
      V.refreshMine();
    }
    // the group SBGN-ML's maps (build.py sbgn_map: <name>-sbgn, edited at maps/sbgn-ml/<name>-sbgn.sbgn) are their GraphML
    // map's twins, with no page of their own: in Deleted with it, restored and deleted forever with it
    function twinBase(m) { return m && !m.mine && /^maps\/sbgn-ml\/[^/]+-sbgn\.sbgn$/.test(m.editPath || '') ? m.id.replace(/-sbgn$/, '') : null; }
    function parentOf(m) {
      var b = twinBase(m), l = V.siteList || [];
      if (!b) return m;
      var p = l.filter(function (x) { return x.id === b + '-graphml'; })[0] || l.filter(function (x) { return x.id === b; })[0];
      return p ? Object.assign({}, p, { binned: m.binned }) : m;
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
    function siteErase(ids) {   // every file of these site maps (maps/<id>.*, maps/extra/<id>/, maps/colours/<id>.json) in one commit on main, three tries
      var tries = 0, post = ghPost;
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
          if (!paths.length) return;
          return api('/git/ref/heads/main').then(ghJson).then(function (ref) {
            return api('/git/commits/' + ref.object.sha).then(ghJson).then(function (c) {
              return post('/git/trees', { base_tree: c.tree.sha, tree: paths.map(function (p) { return { path: p, mode: '100644', type: 'blob', sha: null }; }) });
            }).then(function (t) { return post('/git/commits', { message: 'Deleted forever in the viewer: ' + ids.join(', '), tree: t.sha, parents: [ref.object.sha] }); })
              .then(function (c) { return post('/git/refs/heads/main', { sha: c.sha }, 'PATCH'); });
          });
        }).catch(function (e) { if (e.status === 422 && ++tries < 3) return go(); throw e; });
      };
      return go().then(function () { ghDir = null; });
    }
    // A reader without a token who keeps their maps in a folder: a map deleted moves its file into the folder's Deleted/, Restore moves it back (beside a file
    // of the same name: -2, ...), Delete forever removes it there. The folder's scan reads the folder's own files only,
    // so nothing in Deleted/ comes back as a map. Connected, the folder is not used (GitHub is where the maps are)
    var BIN_DIR = 'Deleted';
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
    var hiddenGone = {};   // site maps let go here (the build still lists them until it runs again)
    function erase(ms) {
      ms = ms.filter(Boolean).map(parentOf).filter(function (m, i, a) { return a.findIndex(function (x) { return x.id === m.id; }) === i; }); if (!ms.length) return;
      var n = ms.length, what = n === 1 ? (ms[0].mine ? ms[0].title : ms[0].topic) : n + ' maps';
      if (!confirm('Delete ' + what + ' forever? This cannot be undone.')) return;
      var site = [], gh = !!(repo() && token());
      ms.forEach(function (m) {
        if (m.mine) {
          var r = mine[m.id]; if (!r) return;
          if (r.site && gh) site.push(r.site);   // on the site already (Delete map is offered on it only with a token)
          var u = mineURLs[m.id]; if (u) { letGo(u.svg); letGo(u.text); }
          delete mine[m.id]; delete mineURLs[m.id]; mineFlag();
          V.draftDo('readwrite', function (st) { return st.delete(m.id); }, 'mine').catch(function () {});
          folderErase(m.id);
        } else site.push(m.id);
      });
      if (!site.length) return V.refreshMine();
      site.forEach(function (id) { hiddenGone[id] = 1; binClear(id); delete renamed[id]; draftDrop(id); });
      V.refreshMine();
      siteErase(site).then(function () {
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
      var left = [];   // not moved (GitHub refused): kept hidden, tried again next time; a map with no page of its own comes back to the list
      return hid.reduce(function (q, id) {
        return q.then(function () {
          var m = ids[id];
          if (!m || m.deleted || !canRename(m, true)) return;
          return siteBin(id, true).catch(function () { left.push(id); });
        });
      }, Promise.resolve()).then(function () {
        hiddenSet(left);
        V.refreshMine();
      });
    }
    // what the viewer asks of this part (the list's entries and groups, a map's record)
    var own = {
      read: function () { return mineIn; },
      here: function () { return (groupsHere = mineGroupsHere()); }, groups: function () { return groupsHere; },
      withMine: withMine, isGroup: ownGroup, movable: movable, moveTo: moveTo, rename: renameGroup, renameMap: renameMap, canRename: canRename, newMap: newMap, shown: mineShown, examplesHidden: examplesHidden, examplesHide: examplesHide, examplesMixed: examplesMixed, listItems: listItems,
      rec: function (id) { return mine[id] || null; }, naming: function () { return !!naming; }
    };
    mineIn.then(upAll).then(binMigrate);   // connected: the reader's maps kept in this browser go to GitHub
