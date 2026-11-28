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
    function renameGroup(was) {
      var box = document.getElementById('m2-list'), f = document.createElement('input'), done = false;
      f.type = 'text'; f.className = 'm2-group-edit'; f.maxLength = 60; f.value = was || ''; f.placeholder = 'Name of the group';
      f.setAttribute('aria-label', 'Name of the group');
      if (was) {
        var g = box.querySelector('.m2-group.m2-mine[data-group="' + CSS.escape(was) + '"]');
        if (!g) return;
        g.replaceWith(f);
      } else {
        var own = box.querySelectorAll('.m2-mine'), last = own[own.length - 1];
        if (last) last.after(f); else box.insertBefore(f, box.firstChild);
        f.scrollIntoView({ block: 'nearest' });
      }
      f.focus(); f.select();
      var end = function (keep) {
        if (done) return; done = true;
        var v = f.value.trim();
        if (keep && v && v !== was && mineValid(v, was)) {
          var gs = mineGroups();
          if (was && gs.indexOf(was) >= 0) {
            gs[gs.indexOf(was)] = v;
            Object.keys(mine).forEach(function (k) { var r = mine[k]; if (r.group === was) { r.group = v; minePut(r).catch(function () {}); } });
            if (V.closed[was]) { V.closed[v] = true; delete V.closed[was]; V.saveClosed(); }
          } else if (!was) gs.push(v);
          mineGroupsSet(gs);
        }
        V.refreshMine();
      };
      f.addEventListener('input', function () { f.classList.remove('m2-bad'); f.title = ''; });
      f.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') return end(false);
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var v = f.value.trim();
        if (v && !mineValid(v, was)) { f.classList.add('m2-bad'); f.title = 'A group of this name is in the list already'; return; }
        end(true);
      });
      f.addEventListener('blur', function () {
        if (!document.hasFocus()) return;    
        if (pressed) document.addEventListener('click', function () { setTimeout(function () { end(true); }, 0); }, { once: true, capture: true });
        else end(true);    
      });
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
    document.getElementById('m2-list').addEventListener('contextmenu', function (e) {
      if (e.shiftKey || e.target.closest('input')) return;
      e.preventDefault();
      var t = e.target.closest('.m2-map, .m2-group, .m2-empty'), m = t && t.classList.contains('m2-map') ? V.byId[t.dataset.id] : null;
      var gh = !!(repo() && token()), tg = t && t.dataset.group;    
      var g = m ? (m.mine || gh ? m.group || '' : '') : tg && (ownGroup(tg) || gh) ? tg : '', onGroup = t && !m && ownGroup(g);
      var items = [['Add map', function () { addTo = g; picker.click(); }], ['Add group', function () { renameGroup(null); }]];
      var editing = V.grid.classList.contains('m2-editing') && V.current && V.current.id === (m && m.id);
      if (m && m.mine && !editing) items.push(null, ['Remove map', function () { mineHide(m.id); }]);    
      else if (m && gh && !editing) items.push(null, ['Remove map', function () { siteHide(siteHidden().concat([m.id])); }]);
      if (onGroup) items.push(null, ['Rename group', function () { renameGroup(g); }], ['Remove group', function () { removeGroup(g); }]);
      if (siteHidden().length) items.push(null, ['Show removed maps', function () { siteHide([]); }]);
      listMenu(e.clientX, e.clientY, items);
    });
    function listMenu(x, y, items) {
      var box = V.el('div', 'm2-cx');
      box.setAttribute('role', 'menu');
      var close = function () { box.remove(); document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', key, true); };
      var out = function (ev) { if (!box.contains(ev.target)) close(); };
      var key = function (ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); return close(); }
        if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
        ev.preventDefault(); ev.stopPropagation();
        var bs = Array.prototype.slice.call(box.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
        bs[(i + (ev.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
      };
      items.forEach(function (it) {
        if (!it) return box.appendChild(V.el('div', 'm2-sep'));
        var b = V.el('button', null, it[0]); b.type = 'button';
        b.addEventListener('click', function () { close(); it[1](); });
        box.appendChild(b);
      });
      document.body.appendChild(box);
      box.style.left = Math.max(4, Math.min(x, innerWidth - box.offsetWidth - 4)) + 'px';
      box.style.top = Math.max(4, Math.min(y, innerHeight - box.offsetHeight - 4)) + 'px';
      document.addEventListener('pointerdown', out, true); document.addEventListener('keydown', key, true);
      box.querySelector('button').focus();
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
      var cdm = /<sbml[\s>]/.test(r.text.slice(0, 3000)) && r.text.indexOf('celldesigner') >= 0;
      return { id: r.id, title: r.title, group: r.group && (groupsHere.indexOf(r.group) >= 0 || V.siteGroupOf(r.group)) ? r.group : '', topic: r.id, mine: true, file: r.file, width: r.width, height: r.height, v: String(r.at),
        image: u.svg, legend: cdm ? 'celldesigner' : 'sbgn', downloads: [{ label: cdm ? 'CellDesigner' : 'GraphML', url: u.text }] };
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
      var hid = siteHidden();
      if (hid.length) list = list.filter(function (m) { return hid.indexOf(m.id) < 0; });
      var own = mineShown().sort(function (a, b) { return a.title.localeCompare(b.title); }).map(mineEntry);
      return own.concat(own.length && examplesHidden() ? [] : list);
    }
    document.querySelectorAll('#m2-set-examples button').forEach(function (b) {
      b.addEventListener('click', function () {
        try { if (b.dataset.examples === 'hidden') localStorage.setItem('atlas-examples', 'hidden'); else localStorage.removeItem('atlas-examples'); } catch (e) {}
        V.refreshMine();
      });
    });
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
      var r = { id: old ? old.id : 'mine-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: old ? old.title : name.replace(/\.(graphml|xml)$/i, ''),
        file: old ? old.file : name, text: back ? old.text : text, svg: back ? old.svg : d.svg, width: back ? old.width : d.width, height: back ? old.height : d.height,
        at: back ? old.at : Date.now(), src: old ? old.src || (id ? undefined : h) : h, hidden: false, group: group !== undefined ? group : old && old.group || '' };
      return minePut(r).then(function () { return r; });
    }
    function addFiles(list, group) {    
      list = Array.prototype.slice.call(list);    
      var picked = Array.prototype.filter.call(list, function (f) { return /\.(graphml|xml)$/i.test(f.name); }).slice(0, 1);    
      var last = null;
      return picked.reduce(function (p, f) {
        return p.then(function () { return f.text(); }).then(function (t) {
          if (repo() && token()) return drawText(t).then(function (d) {    
            var ord = (V.siteList || []).reduce(function (a, m) { return (!group || m.group === group) ? Math.max(a, m.order || 0) : a; }, 0) + 1;
            return toSite(f.name, t, group, ord).then(function (s) {
              var r = { id: 'mine-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: f.name.replace(/\.(graphml|xml)$/i, ''), file: f.name,
                text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now(), hidden: false, group: group || '', site: s.id };
              return minePut(r).then(function () { last = r.id; });
            });
          });
          return drawText(t).then(function (d) { return mineAdd(f.name, t, d, null, group || undefined); }).then(function (r) { last = r.id; return toFolder(r.id, r.file, r.text); });
        }).catch(function (e) { alert(f.name + ' was not added: ' + (e && e.message ? e.message : e)); });
      }, Promise.resolve()).then(function () { V.refreshMine(); if (last) V.go(last); });
    }
    var picker = document.createElement('input');
    picker.type = 'file'; picker.multiple = false; picker.accept = '.graphml,.xml'; picker.hidden = true;
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
      withMine: withMine, isGroup: ownGroup, rename: renameGroup, shown: mineShown, examplesHidden: examplesHidden,
      rec: function (id) { return mine[id] || null; }
    };
