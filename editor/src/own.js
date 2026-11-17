    // ---------- the reader's own storage (editor/src/own.js) ----------
    // What a reader without a GitHub token keeps (three layers: this browser, a folder on the computer,
    // GitHub): the drafts' writes, the folder's record, and the reader's own maps with their groups, the list's right-click
    // menu, Add map (to the site with a token), the drop and the site's maps hidden in this browser. Moved out of the
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
    // svg, width, height, at, hidden, group }) and, with a folder, as their files in it. Taken off the list = hidden only:
    // the record and the file stay, the same file added again brings it back. Example maps (the site's)
    // hidden by a setting while the reader has maps of their own
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
    // a name typed in place in the list, one way for groups and maps (inPlace): the field where the line was (a new
    // group's under the reader's last); Enter or a click elsewhere keeps it, Esc leaves it; o.bad(v) gives why a name is
    // refused (the field red, kept open). The list is not built again while it is open (V.naming, the viewer's
    // buildList), so a save or a folder scan meanwhile never drops what is being typed
    var naming = null;
    function inPlace(at, o) {
      if (naming) naming(true);
      var f = document.createElement('input'), done = false;
      f.type = 'text'; f.className = o.cls; f.maxLength = o.max; f.value = o.value; f.placeholder = o.label;
      f.setAttribute('aria-label', o.label);
      if (at) at.replaceWith(f); else o.put(f);
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
    // a group's name: Rename group, a double-click on its name, or a new group (Add group), under the reader's last group;
    // a new group left empty or with Esc is not made; a name already taken is refused
    function renameGroup(was) {
      if (naming) naming(true);   // the open field ends first: it rebuilds the list, so the line is looked up after it
      var box = document.getElementById('m2-list'), at = null;
      if (was && !(at = box.querySelector('.m2-group.m2-mine[data-group="' + CSS.escape(was) + '"]'))) return;
      inPlace(at, { cls: 'm2-group-edit', max: 60, value: was || '', label: 'Name of the group',
        put: function (f) { var own = box.querySelectorAll('.m2-mine'), last = own[own.length - 1]; if (last) last.after(f); else box.insertBefore(f, box.firstChild); },
        bad: function (v) { return v && !mineValid(v, was) ? 'A group of this name is in the list already' : ''; },
        end: function (v) {
          if (!v || v === was || !mineValid(v, was)) return;
          var gs = mineGroups();
          if (was && gs.indexOf(was) >= 0) {
            gs[gs.indexOf(was)] = v;
            Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === was) { r.group = v; minePut(r).catch(function () {}); } });
            if (V.closed[was]) { V.closed[v] = true; delete V.closed[was]; V.saveClosed(); }
          } else if (!was) gs.push(v);
          mineGroupsSet(gs);
        } });
    }
    var pressed = false;
    document.addEventListener('pointerdown', function () { pressed = true; }, true);
    document.addEventListener('pointerup', function () { setTimeout(function () { pressed = false; }, 0); }, true);
    function removeGroup(name) {   // the group goes, its maps stay, at the top of the list
      mineGroupsSet(mineGroups().filter(function (g) { return g !== name; }));
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === name) { r.group = ''; minePut(r).catch(function () {}); } });
      if (V.closed[name]) { delete V.closed[name]; V.saveClosed(); }
      V.refreshMine();
    }
    // the right-click menu over the list, where the Edit tab is: New SBGN-ML map, New CellDesigner map, Add map from file
    // (into the group clicked, if it is the reader's or with a token the site's, else at the top), Add group; on a map
    // Rename map, Make a copy, Move to; on a group of theirs Rename group and Remove group; Remove map last of all
    // (items.last). The viewer asks for them (listItems) and shows the menu, its own entries (Open all groups, ...) between
    var addTo = '';
    function listItems(e) {
      var t = e.target.closest('.m2-map, .m2-group, .m2-empty'), m = t && t.classList.contains('m2-map') ? V.byId[t.dataset.id] : null;
      var gh = !!(repo() && token()), tg = t && !t.classList.contains('m2-link-group') && t.dataset.group;   // with a token a site group takes maps too
      var g = m ? (m.mine || gh ? m.group || '' : '') : tg && (ownGroup(tg) || gh) ? tg : '', onGroup = t && !m && ownGroup(g);
      var into = m ? m.group || '' : tg && (ownGroup(tg) || V.siteGroupOf(tg) || t.classList.contains('m2-empty')) ? tg : '';   // a new map: into the group clicked, whoever's it is
      var items = [['New SBGN-ML map', function () { newMap(into); }], ['New CellDesigner map', function () { newMap(into, 'cd'); }], ['Add map from file', function () { addTo = g; picker.click(); }], ['Add group', function () { renameGroup(null); }]];
      var editing = V.grid.classList.contains('m2-editing') && V.current && V.current.id === (m && m.id);
      // on a map, under one line: Rename map, Make a copy, Move to; Remove map last of all, under a line of its own, away
      // from the others (as the map's menu: not while it is edited)
      var mapItems = [], x = e.clientX, y = e.clientY;
      if (m && canRename(m, gh)) mapItems.push(['Rename map', function () { renameMap(m.id); }]);
      if (m && canCopy(m)) mapItems.push(['Make a copy', function () { copyMap(m.id); }]);
      if (m && movable(m) && V.listGroups().length) mapItems.push(['Move to...', function () { moveMenu(m, x, y); }]);
      if (mapItems.length) items = items.concat([null], mapItems);
      if (onGroup) items.push(null, ['Rename group', function () { renameGroup(g); }], ['Remove group', function () { removeGroup(g); }]);
      if (siteHidden().length) items.push(null, ['Show removed maps', function () { siteHide([]); }]);
      // items.last: put by the viewer under its own entries too, so Remove map is the menu's last line
      if (m && m.mine && !editing) items.last = [['Remove map', function () { mineHide(m.id); }]];
      else if (m && gh && !editing) items.last = [['Remove map', function () { siteHide(siteHidden().concat([m.id])); }]];
      return items;
    }
    // a reader's own map moved to another group, theirs or the site's ('': no group, at the top of the list): by Move to
    // in the list's menu or by dragging it there (the viewer's dropPlace); put before the map `before`, else at the
    // group's end. A map on its way to the site goes where the site puts it, so it is not moved
    function movable(m) { var r = m && m.mine && mine[m.id]; return !!r && !r.site; }
    function moveTo(id, g, before) {
      var r = mine[id]; if (!r) return;
      r.group = g || ''; minePut(r).catch(function () {});
      put(id, r.group, before);
    }
    function put(id, g, before) {   // a map into the reader's order of group g, the group opened so the map stays in sight
      if (g && V.closed[g]) { delete V.closed[g]; V.saveClosed(); }
      V.placeMap(id, g, before); V.refreshMine();
    }
    function moveMenu(m, x, y) {   // the groups the map can go to, in the list's order; its own greyed
      var site = (V.siteList || []).map(function (s) { return s.group; });
      var gs = V.listGroups().filter(function (n) { return ownGroup(n) || site.indexOf(n) >= 0; });
      V.listMenu(x, y, [['No group', function () { moveTo(m.id, ''); }, !m.group], null].concat(gs.map(function (n) {
        return [n, function () { moveTo(m.id, n); }, n === m.group];
      })));
    }
    // Make a copy, in the list's menu: a new map named Copy of <name> (as in Google Docs), in the same group right under
    // the original, opened at once with its name field open to rename it. Of a reader's own map, or of the site's
    // GraphML or CellDesigner map as it is now (the edits this page holds, else GitHub's version, else the site's);
    // with a token a copy of a site map goes to the site, as Add map does (named there by its file; renamed once built)
    function canCopy(m) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && !mine[m.id].site : !!graphmlOf(m) && !sbMap(m)); }
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
      var r0 = m.mine ? mine[id] : null, title = 'Copy of ' + (r0 ? r0.title : m.topic || m.title), group = m.group || '', next = after(id);   // next: read before the copy is in the list
      var ext = r0 ? (r0.file.match(/\.[^.]+$/) || ['.xml'])[0] : cdMap(m) ? '.xml' : '.graphml';
      var file = freeFile(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + ext);
      var gh = !!(repo() && token()) && !m.mine;
      return mineIn.then(function () { return textNow(m); }).then(function (t) {
        var made = r0 && t === r0.text ? Promise.resolve({ svg: r0.svg, width: r0.width, height: r0.height }) : drawText(t);
        return made.then(function (d) {
          var r = { id: newId(), title: title, file: file, text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(t), hidden: false, group: group };
          if (!gh) return minePut(r).then(function () { toFolder(r.id, r.file, r.text); return r; });
          return toSite(title + ext, t, group, siteOrder(group)).then(function (s) { r.site = s.id; return minePut(r).then(function () { return r; }); });
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
    // with a token a map added goes to the site (toSite, core.js): until the site's build has it, it is shown from this
    // browser as a reader's map with `site` (its id there), dropped once the site lists that id (arrived: the old id to
    // the site's, so the map shown follows). Remove map on a site map (with a token) hides it in this browser only, its
    // file staying on GitHub (deleting it there is not handled here); Show removed maps brings them back
    var HIDDEN_KEY = 'atlas-hidden-maps';
    function siteHidden() { try { var a = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function siteHide(ids) { try { if (ids.length) localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids)); else localStorage.removeItem(HIDDEN_KEY); } catch (e) {} V.refreshMine(); }
    function withMine(list) {
      var ids = {}; list.forEach(function (m) { ids[m.id] = 1; });
      Object.keys(mine).forEach(function (k) {
        var r = mine[k];
        if (!r.site || !ids[r.site]) return;
        V.arrived[k] = r.site; delete mine[k]; delete mineURLs[k]; mineFlag();
        V.draftDo('readwrite', function (st) { return st.delete(k); }, 'mine').catch(function () {});
      });
      list = siteNamed(list);
      var hid = siteHidden();
      if (hid.length) list = list.filter(function (m) { return hid.indexOf(m.id) < 0; });
      var own = mineShown().sort(function (a, b) { return a.title.localeCompare(b.title); }).map(mineEntry);
      return own.concat(own.length && examplesHidden() ? [] : list);
    }
    function examplesHide(hide) {   // Hide example maps or Show example maps, in the list's right-click menu
      try { if (hide) localStorage.setItem('atlas-examples', 'hidden'); else localStorage.removeItem('atlas-examples'); } catch (e) {}
      V.refreshMine();
    }
    // New map, made in place: an empty SBGN-ML map of the reader's, Process Description, named Unnamed map (2, 3, ... while taken), in
    // the group right-clicked or at the top, opened at once in the Edit window with the palette, nothing asked (no name
    // needed to start, as in Google Docs; a double-click names it).
    // Kept as any map of theirs (this browser, their folder), also with a token: the site's build takes no SBGN-ML map of
    // its own. Its map id (NEW_ID, sbgn.js) marks the file as made here (madeHere, sbgn.js), so the folder and Add map from file
    // take it back; an SBGN-ML file of another editor is not taken (it may hold what the empty base cannot draw)
    function newId() { return 'mine-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    // A CellDesigner map too: the reader picks the
    // format in the menu, New SBGN-ML map or New CellDesigner map; an empty CellDesigner file as cd_make writes one, edited
    // with the CellDesigner palette (cdcreate.js)
    function newMap(group, fmt) {
      var titles = mineShown().map(function (r) { return r.title; }).concat((V.siteList || []).map(function (m) { return m.topic || m.title; }));
      var files = Object.keys(mine).map(function (k) { return mine[k].file; });
      var title = 'Unnamed map', file;
      var ext = fmt === 'cd' ? '.xml' : '.sbgn', text;
      for (var k = 2; titles.indexOf(title) >= 0 || files.indexOf(file = title.toLowerCase().replace(/ /g, '-') + ext) >= 0; k++) title = 'Unnamed map ' + k;
      if (fmt !== 'cd') text = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="' + NEW_ID + '" language="process description">\n  </map>\n</sbgn>\n';
      return mineIn.then(function () { return fmt === 'cd' ? cdpy().then(function () { text = cdMk.empty({ id: 'untitled' }); }) : null; })
        .then(function () { return drawText(text); }).then(function (d) {
        var r = { id: newId(), title: title, file: file, text: text, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(text), hidden: false, group: group || '' };
        return minePut(r).then(function () {
          toFolder(r.id, r.file, r.text);
          V.refreshMine(); V.go(r.id);
          var tries = 0;
          (function edit() {   // the Edit tab shows once the editor has taken the map shown
            var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
            if (eb && eb.offsetParent && V.current && V.current.id === r.id) { if (V.win !== 'edit') eb.click(); return; }
            if (++tries < 100 && location.hash === '#' + r.id) setTimeout(edit, 50);   // not once another map is chosen
          })();
        });
      }).catch(function (e) { alert('The new map was not made: ' + (e && e.message ? e.message : e)); });
    }
    // a map's name typed in place (any map):
    // a double-click on it or Rename map in the list's menu; the reader's maps in their record (title), the site's with a
    // token in their maps/<id>.md (topic, the name the list shows; the title too where it was the same), shown at once
    // while the site's list still has the old name. Maps whose name the build takes from elsewhere (the SBGN-ML groups) are
    // not renamed
    var renamed = {};   // site map id -> { was, to }: the list's name before and the one given here
    function canRename(m, gh) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && !mine[m.id].site : !!gh && !/-sbgn(ml)?$|^external-/.test(m.id)); }
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
          if (m.mine) { var r = mine[id]; r.title = v; minePut(r).catch(function () {}); }
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
      var path = '/contents/maps/' + encodeURIComponent(id) + '.md', q = JSON.stringify(v.replace(/["\\]/g, ''));   // the build reads the front matter's quotes plainly
      return api(path + '?ref=main').then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? 'its name does not come from a page of its own' : 'GitHub ' + r.status); return r.json(); })
        .then(function (d) {
          var md = new TextDecoder().decode(Uint8Array.from(atob(d.content.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); }));
          var line = function (k) { var x = md.match(new RegExp('^' + k + ': (.*)$', 'm')); return x ? x[1].replace(/^"(.*)"$/, '$1') : null; };
          if (line('topic') === null) throw new Error('its page has no topic line');
          if (line('title') === line('topic')) md = md.replace(/^title: .*$/m, function () { return 'title: ' + q; });   // a function: $' or $& in a name stay text
          md = md.replace(/^topic: .*$/m, function () { return 'topic: ' + q; });
          return api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Map renamed in the viewer: ' + id, content: b64(md), sha: d.sha, branch: 'main' }) });
        }).then(function (r) { if (!r.ok) throw new Error('GitHub ' + r.status); });
    }
    function mineHide(id) {   // off the list, kept
      var r = mine[id]; if (!r) return;
      r.hidden = true; minePut(r).catch(function () {});
      if (r.site) try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(siteHidden().concat([r.site]))); } catch (e) {}   // the site's map, once built, hidden too
      V.refreshMine();
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
      var r = { id: old ? old.id : newId(), title: old ? old.title : name.replace(/\.(graphml|xml|sbgn)$/i, ''),
        file: old ? old.file : name, text: back ? old.text : text, svg: back ? old.svg : d.svg, width: back ? old.width : d.width, height: back ? old.height : d.height,
        at: back ? old.at : Date.now(), src: old ? old.src || (id ? undefined : h) : h, hidden: false, group: group !== undefined ? group : old && old.group || '' };
      return minePut(r).then(function () { return r; });
    }
    function addFiles(list, group) {   // a reader's files, drawn and kept; group: Add map or a drop on a group of theirs
      list = Array.prototype.slice.call(list);   // the picker's list empties when it is reset
      var picked = Array.prototype.filter.call(list, function (f) { return /\.(graphml|xml|sbgn)$/i.test(f.name); }).slice(0, 1);   // one map at a time (no bulk additions)
      var last = null;
      return picked.reduce(function (p, f) {
        return p.then(function () { return f.text(); }).then(function (t) {
          if (isSb(t) && !madeHere(t)) throw new Error('an SBGN-ML file from another editor cannot be added yet, only one made here with New map');
          if (repo() && token() && !isSb(t)) return drawText(t).then(function (d) {   // with a token: to the site, shown from here until built (a map made here stays the reader's: the build takes no SBGN-ML map of its own)
            return toSite(f.name, t, group, siteOrder(group)).then(function (s) {
              var r = { id: newId(), title: f.name.replace(/\.(graphml|xml)$/i, ''), file: f.name,
                text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now(), hidden: false, group: group || '', site: s.id };
              return minePut(r).then(function () { last = r.id; });
            });
          });
          return drawText(t).then(function (d) { return mineAdd(f.name, t, d, null, group || undefined); }).then(function (r) { last = r.id; return toFolder(r.id, r.file, r.text); });
        }).catch(function (e) { alert(f.name + ' was not added: ' + (e && e.message ? e.message : e)); });
      }, Promise.resolve()).then(function () { V.refreshMine(); if (last) V.go(last); });
    }
    var picker = document.createElement('input');
    picker.type = 'file'; picker.multiple = false; picker.accept = '.graphml,.xml,.sbgn'; picker.hidden = true;
    picker.addEventListener('change', function () { addFiles(picker.files, addTo); picker.value = ''; });
    document.body.appendChild(picker);
    document.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault(); });
    document.addEventListener('drop', function (e) {   // a file dropped on a group of the reader's goes into it, elsewhere to the top
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var t = e.target.closest && e.target.closest('#m2-list [data-group]'), g = t && t.dataset.group;
      addFiles(e.dataTransfer.files, ownGroup(g) ? g : '');
    });
    // what the viewer asks of this part (the list's entries and groups, a map's record)
    var own = {
      read: function () { return mineIn; },
      here: function () { return (groupsHere = mineGroupsHere()); }, groups: function () { return groupsHere; },
      withMine: withMine, isGroup: ownGroup, movable: movable, moveTo: moveTo, rename: renameGroup, renameMap: renameMap, canRename: canRename, newMap: newMap, shown: mineShown, examplesHidden: examplesHidden, examplesHide: examplesHide, listItems: listItems,
      rec: function (id) { return mine[id] || null; }, naming: function () { return !!naming; }
    };
