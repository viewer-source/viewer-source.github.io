    function draftPut(id, rec) { rec.id = id; V.drafts[id] = rec; V.draftIds(); return V.draftDo('readwrite', function (st) { return st.put(rec, id); }); }
    function draftDrop(id) {
      if (V.kept && V.kept.id === id && V.kept.draft) V.dropKept();
      if (!V.drafts[id]) return Promise.resolve();
      delete V.drafts[id]; V.draftIds();
      return V.draftDo('readwrite', function (st) { return st.delete(id); }).catch(function () {});
    }
    var dirP = null;
    function folder() {
      if (!V.folderName() || !window.indexedDB) return Promise.resolve(null);
      if (!dirP) dirP = V.draftDo('readonly', function (st) { return st.get('dir'); }, 'folder');
      dirP.catch(function () { dirP = null; });
      return Promise.all([dirP, V.draftDo('readonly', function (st) { return st.get('files'); }, 'folder')])    
        .then(function (r) { return r[0] ? { dir: r[0], files: r[1] || {} } : null; });
    }
    function folderSet(dir) {    
      return V.draftDo('readwrite', function (st) { st.put({}, 'files'); return st.put(dir, 'dir'); }, 'folder')
        .then(function () { dirP = Promise.resolve(dir); try { localStorage.setItem(V.folderKey, dir.name); } catch (e) {} });
    }
    function folderFile(id, w) {    
      return V.draftDo('readwrite', function (st) {
        var q = st.get('files');
        q.onsuccess = function () { var r = q.result || {}; r[id] = w; st.put(r, 'files'); };
        return q;
      }, 'folder');
    }
    function folderForget() {    
      try { localStorage.removeItem(V.folderKey); } catch (e) {}
      dirP = null;
      return V.draftDo('readwrite', function (st) { st.delete('files'); return st.delete('dir'); }, 'folder').catch(function () {});
    }
    var MINE_KEY = 'atlas-mine', mine = {}, mineURLs = {};
    function mineFlag() { try { if (Object.keys(mine).length) localStorage.setItem(MINE_KEY, '1'); else localStorage.removeItem(MINE_KEY); } catch (e) {} }
    var mineIn = (function () {
      var has; try { has = localStorage.getItem(MINE_KEY); } catch (e) {}
      if (!has || !window.indexedDB) return Promise.resolve();
      return V.draftDo('readonly', function (st) { return st.getAll(); }, 'mine').then(function (all) {
        (all || []).forEach(function (r) { if (r && r.id && !mine[r.id]) mine[r.id] = r; });
        var legacy = null; try { legacy = localStorage.getItem('atlas-mine-group'); localStorage.removeItem('atlas-mine-group'); } catch (e) {}
        if (legacy && mineGroups().indexOf(legacy) < 0) mineGroupsSet(mineGroups().concat([legacy]));    
        Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === undefined) { r.group = legacy || ''; minePut(r).catch(function () {}); } });
      }).catch(function () {});
    })();
    function minePut(r) {
      mine[r.id] = r; mineFlag();
      return V.draftDo('readwrite', function (st) { return st.put(r, r.id); }, 'mine');
    }
    function mineShown() { return Object.keys(mine).map(function (k) { return mine[k]; }).filter(function (r) { return !r.hidden; }); }
    var GROUPS_KEY = 'atlas-mine-groups';
    function mineGroups() {
      try { var a = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (g) { return typeof g === 'string' && g; }) : []; } catch (e) { return []; }
    }
    function mineGroupsSet(a) { try { if (a.length) localStorage.setItem(GROUPS_KEY, JSON.stringify(a)); else localStorage.removeItem(GROUPS_KEY); } catch (e) {} }
    var groupsHere = [];
    function mineGroupsHere() {
      var site = (V.siteList || []).map(function (m) { return m.group; });
      return mineGroups().filter(function (g) { return site.indexOf(g) < 0; });
    }
    function ownGroup(name) { return !!name && groupsHere.indexOf(name) >= 0; }
    function mineValid(v, was) {
      return v === was || !((V.siteList || []).some(function (m) { return m.group === v; }) || mineGroups().indexOf(v) >= 0);
    }
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
        if (!document.hasFocus()) return;    
        if (pressed) document.addEventListener('click', function () { setTimeout(function () { end(true); }, 0); }, { once: true, capture: true });
        else end(true);    
      });
    }
    function renameGroup(was) {
      if (naming) naming(true);    
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
    function removeGroup(name) {    
      mineGroupsSet(mineGroups().filter(function (g) { return g !== name; }));
      Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === name) { r.group = ''; minePut(r).catch(function () {}); } });
      if (V.closed[name]) { delete V.closed[name]; V.saveClosed(); }
      V.refreshMine();
    }
    var addTo = '';
    function listItems(e) {
      var t = e.target.closest('.m2-map, .m2-group, .m2-empty'), m = t && t.classList.contains('m2-map') ? V.byId[t.dataset.id] : null;
      var gh = !!(repo() && token()), tg = t && !t.classList.contains('m2-link-group') && t.dataset.group;    
      var g = m ? (m.mine || gh ? m.group || '' : '') : tg && (ownGroup(tg) || gh) ? tg : '', onGroup = t && !m && ownGroup(g);
      var into = m ? m.group || '' : tg && (ownGroup(tg) || V.siteGroupOf(tg) || t.classList.contains('m2-empty')) ? tg : '';    
      var items = [['New map', function () { newMap(into); }], ['Add map from file', function () { addTo = g; picker.click(); }], ['Add group', function () { renameGroup(null); }]];
      var editing = V.grid.classList.contains('m2-editing') && V.current && V.current.id === (m && m.id);
      var mapItems = [];    
      if (m && canRename(m, gh)) mapItems.push(['Rename map', function () { renameMap(m.id); }]);
      if (m && m.mine && !editing) mapItems.push(['Remove map', function () { mineHide(m.id); }]);
      else if (m && gh && !editing) mapItems.push(['Remove map', function () { siteHide(siteHidden().concat([m.id])); }]);
      if (mapItems.length) items = items.concat([null], mapItems);
      if (onGroup) items.push(null, ['Rename group', function () { renameGroup(g); }], ['Remove group', function () { removeGroup(g); }]);
      if (siteHidden().length) items.push(null, ['Show removed maps', function () { siteHide([]); }]);
      return items;
    }
    function examplesHidden() { try { return localStorage.getItem('atlas-examples') === 'hidden'; } catch (e) { return false; } }
    function letGo(url) {    
      setTimeout(function () {
        var used = (V.current && (V.current.image === url || (V.current.downloads || []).some(function (d) { return d.url === url; }))) ||
          Array.prototype.some.call(document.querySelectorAll('a[href], img[src]'), function (e) { return e.getAttribute('href') === url || e.getAttribute('src') === url; });
        if (used) letGo(url); else URL.revokeObjectURL(url);
      }, 10000);
    }
    function mineEntry(r) {
      var u = mineURLs[r.id];
      if (!u || u.at !== r.at) {    
        if (u) { letGo(u.svg); letGo(u.text); }
        u = mineURLs[r.id] = { at: r.at, svg: URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' })), text: URL.createObjectURL(new Blob([r.text], { type: 'application/xml' })) };
      }
      var cdm = /<sbml[\s>]/.test(r.text.slice(0, 3000)) && r.text.indexOf('celldesigner') >= 0, sbm = !cdm && isSb(r.text);
      var e = { id: r.id, title: r.title, group: r.group && (groupsHere.indexOf(r.group) >= 0 || V.siteGroupOf(r.group)) ? r.group : '', topic: r.id, mine: true, file: r.file, width: r.width, height: r.height, v: String(r.at),
        image: u.svg, colours: true, legend: cdm ? 'celldesigner' : 'sbgn', downloads: [{ label: cdm ? 'CellDesigner' : sbm ? 'SBGN-ML' : 'GraphML', url: u.text }] };
      if (sbm) { e.editBase = emptyBase(); e.editPath = r.file; }    
      return e;
    }
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
    function examplesHide(hide) {    
      try { if (hide) localStorage.setItem('atlas-examples', 'hidden'); else localStorage.removeItem('atlas-examples'); } catch (e) {}
      V.refreshMine();
    }
    function newId() { return 'mine-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function newMap(group) {
      var titles = mineShown().map(function (r) { return r.title; }).concat((V.siteList || []).map(function (m) { return m.topic || m.title; }));
      var files = Object.keys(mine).map(function (k) { return mine[k].file; });
      var title = 'Unnamed map', file;
      for (var k = 2; titles.indexOf(title) >= 0 || files.indexOf(file = title.toLowerCase().replace(/ /g, '-') + '.sbgn') >= 0; k++) title = 'Unnamed map ' + k;
      var text = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="' + NEW_ID + '" language="process description">\n  </map>\n</sbgn>\n';
      return mineIn.then(function () { return drawText(text); }).then(function (d) {
        var r = { id: newId(), title: title, file: file, text: text, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(text), hidden: false, group: group || '' };
        return minePut(r).then(function () {
          toFolder(r.id, r.file, r.text);
          V.refreshMine(); V.go(r.id);
          var tries = 0;
          (function edit() {    
            var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
            if (eb && eb.offsetParent && V.current && V.current.id === r.id) { if (V.win !== 'edit') eb.click(); return; }
            if (++tries < 100 && location.hash === '#' + r.id) setTimeout(edit, 50);    
          })();
        });
      }).catch(function (e) { alert('The new map was not made: ' + (e && e.message ? e.message : e)); });
    }
    var renamed = {};    
    function canRename(m, gh) { return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && !mine[m.id].site : !!gh && !/-sbgn(ml)?$|^external-/.test(m.id)); }
    function siteNamed(list) {    
      return list.map(function (m) {
        var n = renamed[m.id];
        if (!n) return m;
        if (m.topic === n.to) { delete renamed[m.id]; return m; }    
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
          if (m.mine && V.current && V.current.id === id) {    
            document.getElementById('m2-title').textContent = v;
            if (map && map.id === id) map.title = v;
          }
        } });
    }
    function toSiteName(id, was, v) {    
      var path = '/contents/maps/' + encodeURIComponent(id) + '.md', q = JSON.stringify(v.replace(/["\\]/g, ''));    
      return api(path + '?ref=main').then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? 'its name does not come from a page of its own' : 'GitHub ' + r.status); return r.json(); })
        .then(function (d) {
          var md = new TextDecoder().decode(Uint8Array.from(atob(d.content.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); }));
          var line = function (k) { var x = md.match(new RegExp('^' + k + ': (.*)$', 'm')); return x ? x[1].replace(/^"(.*)"$/, '$1') : null; };
          if (line('topic') === null) throw new Error('its page has no topic line');
          if (line('title') === line('topic')) md = md.replace(/^title: .*$/m, function () { return 'title: ' + q; });    
          md = md.replace(/^topic: .*$/m, function () { return 'topic: ' + q; });
          return api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Map renamed in the viewer: ' + id, content: b64(md), sha: d.sha, branch: 'main' }) });
        }).then(function (r) { if (!r.ok) throw new Error('GitHub ' + r.status); });
    }
    function mineHide(id) {    
      var r = mine[id]; if (!r) return;
      r.hidden = true; minePut(r).catch(function () {});
      if (r.site) try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(siteHidden().concat([r.site]))); } catch (e) {}    
      V.refreshMine();
    }
    function textHash(t) {    
      var h = 2166136261;
      for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36) + '.' + t.length;
    }
    function mineMatch(name, text, h) {
      h = h || textHash(text);
      return Object.keys(mine).map(function (k) { return mine[k]; })
        .filter(function (r) { return !r.site && r.file === name && (r.text === text || (r.src ? r.src === h : true)); })[0] || null;
    }
    function mineAdd(name, text, d, id, group) {    
      var h = textHash(text), old = id ? mine[id] : mineMatch(name, text, h);
      var back = !id && old && old.text !== text && old.src === h;    
      var r = { id: old ? old.id : newId(), title: old ? old.title : name.replace(/\.(graphml|xml|sbgn)$/i, ''),
        file: old ? old.file : name, text: back ? old.text : text, svg: back ? old.svg : d.svg, width: back ? old.width : d.width, height: back ? old.height : d.height,
        at: back ? old.at : Date.now(), src: old ? old.src || (id ? undefined : h) : h, hidden: false, group: group !== undefined ? group : old && old.group || '' };
      return minePut(r).then(function () { return r; });
    }
    function addFiles(list, group) {    
      list = Array.prototype.slice.call(list);    
      var picked = Array.prototype.filter.call(list, function (f) { return /\.(graphml|xml|sbgn)$/i.test(f.name); }).slice(0, 1);    
      var last = null;
      return picked.reduce(function (p, f) {
        return p.then(function () { return f.text(); }).then(function (t) {
          if (isSb(t) && !madeHere(t)) throw new Error('an SBGN-ML file from another editor cannot be added yet, only one made here with New map');
          if (repo() && token() && !isSb(t)) return drawText(t).then(function (d) {    
            var ord = (V.siteList || []).reduce(function (a, m) { return (!group || m.group === group) ? Math.max(a, m.order || 0) : a; }, 0) + 1;
            return toSite(f.name, t, group, ord).then(function (s) {
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
    document.addEventListener('drop', function (e) {    
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var t = e.target.closest && e.target.closest('#m2-list [data-group]'), g = t && t.dataset.group;
      addFiles(e.dataTransfer.files, ownGroup(g) ? g : '');
    });
    var own = {
      read: function () { return mineIn; },
      here: function () { return (groupsHere = mineGroupsHere()); }, groups: function () { return groupsHere; },
      withMine: withMine, isGroup: ownGroup, rename: renameGroup, renameMap: renameMap, canRename: canRename, newMap: newMap, shown: mineShown, examplesHidden: examplesHidden, examplesHide: examplesHide, listItems: listItems,
      rec: function (id) { return mine[id] || null; }, naming: function () { return !!naming; }
    };
