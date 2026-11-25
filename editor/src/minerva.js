    // ---------- MINERVA projects (editor/src/minerva.js) ----------
    // A MINERVA project zip read in the browser, with no library and no other module: the zip's central directory read
    // by hand, each entry inflated by the browser's own DecompressionStream (stored and deflated entries, the two kinds
    // the projects use), then checked as a project: one CellDesigner map at the root (the top level), any others in
    // submaps/, every picture a map's notes name ("Glyph: glyphs/x.png") present. Anything else refuses the whole zip
    // with the reason, so nothing half is added. The rest of the zip (submaps/mapping.xml, config.json, images/, any
    // other file) is kept as it came, to go back into the zip it is packed into.

    function u16(b, i) { return b[i] | (b[i + 1] << 8); }
    function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
    function hiddenPath(n) { return /^__MACOSX\//.test(n) || n.split('/').some(function (p) { return p.charAt(0) === '.'; }); }
    function inflate(data) {
      var s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(s).arrayBuffer().then(function (a) { return new Uint8Array(a); });
    }
    // every file entry of a zip: [{ name, data }] in the zip's order, folders, Mac and hidden files left out
    function unzip(buf) {
      var b = new Uint8Array(buf), e = -1;
      for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
      if (e < 0) return Promise.reject(new Error('not a zip file'));
      var count = u16(b, e + 10), at = u32(b, e + 16);
      if (count === 0xffff || at === 0xffffffff) return Promise.reject(new Error('a zip in the large format (ZIP64), not read here'));
      var list = [], total = 0, utf8 = new TextDecoder('utf-8');
      for (var k = 0; k < count; k++) {
        if (at + 46 > b.length || u32(b, at) !== 0x02014b50) return Promise.reject(new Error('a damaged zip file'));
        var flags = u16(b, at + 8), method = u16(b, at + 10), csize = u32(b, at + 20), size = u32(b, at + 24);
        var nl = u16(b, at + 28), xl = u16(b, at + 30), cl = u16(b, at + 32), off = u32(b, at + 42);
        var name = utf8.decode(b.subarray(at + 46, at + 46 + nl)).replace(/\\/g, '/');
        at += 46 + nl + xl + cl;
        if (name.charAt(0) === '/' || name.split('/').indexOf('..') >= 0) return Promise.reject(new Error('a path outside the zip: ' + name));
        if (/\/$/.test(name) || hiddenPath(name)) continue;
        if (flags & 1) return Promise.reject(new Error('a zip with a password'));
        if (method !== 0 && method !== 8) return Promise.reject(new Error(name + ' is packed in a way not read here'));
        if (off + 30 > b.length || u32(b, off) !== 0x04034b50) return Promise.reject(new Error('a damaged zip file'));
        total += size;   // a zip that would unpack to more than 500 MB refused before anything is inflated
        if (total > 500 * 1048576) return Promise.reject(new Error('the zip unpacks to more than 500 MB'));
        var start = off + 30 + u16(b, off + 26) + u16(b, off + 28);
        list.push({ name: name, method: method, raw: b.subarray(start, start + csize), size: size });
      }
      return list.reduce(function (p, x) {   // one at a time: a large project never inflates all at once
        return p.then(function (out) {
          return (x.method === 0 ? Promise.resolve(x.raw) : inflate(x.raw)).then(function (d) {
            if (d.length !== x.size) throw new Error(x.name + ' is damaged in the zip');
            out.push({ name: x.name, data: d });
            return out;
          });
        });
      }, Promise.resolve([]));
    }
    // the pictures a map's notes name, as MINERVA reads them (a name may hold spaces; notes may be XHTML)
    function glyphsNamed(text) {
      var re = /Glyph:[ \t]*([^\r\n<]+?\.(?:png|svg))[ \t\r]*(?:\n|<|$)/gi, out = [], m;   // a file saved with Windows line ends: \r before \n
      while ((m = re.exec(text))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
      return out;
    }
    function formatName(t) {   // what a map file is, in the person's words
      var h = t.slice(0, 3000);
      if (/<sbml[\s>]/.test(h)) return t.indexOf('celldesigner') >= 0 ? 'CellDesigner' : 'SBML';
      if (/<sbgn[\s>]/.test(h)) return 'SBGN-ML';
      if (/<Pathway[\s>]/.test(h)) return 'GPML';
      return null;
    }
    function stem(path) { return path.split('/').pop().replace(/\.xml$/i, ''); }
    // a zip's entries as a MINERVA project in CellDesigner: { maps: [{ path, text }] (the top level first, then the
    // submaps by name), glyphs: { path: bytes } (only those a map or mapping.xml names), kept: { path: bytes }, unused: n },
    // or an Error whose message says why it is not one
    function minervaProject(entries) {
      var dec = new TextDecoder('utf-8'), tops = [], subs = [], files = {};
      entries.forEach(function (e) {
        files[e.name] = e.data;
        if (/^[^/]+\.xml$/i.test(e.name)) tops.push(e.name);
        else if (/^submaps\/[^/]+\.xml$/i.test(e.name) && !/^submaps\/mapping\.xml$/i.test(e.name)) subs.push(e.name);
      });
      if (!tops.length) throw new Error('not a MINERVA project: no map at its top');
      if (tops.length > 1) throw new Error('not a MINERVA project: ' + tops.length + ' maps at its top (' + tops.join(', ') + '), where MINERVA takes one');
      subs.sort(function (a, b) { return a.localeCompare(b); });
      var maps = tops.concat(subs).map(function (p) {
        var text = dec.decode(files[p]), f = formatName(text);
        if (f !== 'CellDesigner') throw new Error(f ? 'the map ' + stem(p) + ' is ' + f + ': only CellDesigner projects open here' : stem(p) + ' is not a map');
        return { path: p, text: text };
      });
      var used = [], glyphs = {}, kept = {};
      maps.forEach(function (m) {
        glyphsNamed(m.text).forEach(function (g) {
          if (!/\.png$/i.test(g)) throw new Error(g + ' is named in ' + stem(m.path) + ': MINERVA takes PNG pictures only');
          if (!/^glyphs\/[^/]+$/.test(g)) throw new Error(g + ' is named in ' + stem(m.path) + ': only pictures directly in glyphs/ are read here');   // the stores keep glyphs/ as one folder
          if (!files[g]) throw new Error(g + ' is named in ' + stem(m.path) + ' but missing from the zip');
          if (used.indexOf(g) < 0) used.push(g);
        });
      });
      var mapping = Object.keys(files).filter(function (n) { return /^submaps\/mapping\.xml$/i.test(n); })[0];
      if (mapping) glyphsNamed(dec.decode(files[mapping])).forEach(function (g) { if (files[g] && used.indexOf(g) < 0) used.push(g); });   // its pictures are link records: kept when there
      var unused = 0;
      Object.keys(files).forEach(function (n) {
        if (tops.indexOf(n) >= 0 || subs.indexOf(n) >= 0) return;
        if (/^glyphs\//.test(n)) { if (used.indexOf(n) >= 0) glyphs[n] = files[n]; else unused++; return; }
        kept[n] = files[n];
      });
      return { maps: maps, glyphs: glyphs, kept: kept, unused: unused };
    }
    // a picture name in a map's notes changed (another picture of that name is kept already): every Glyph line of it
    function renameGlyph(text, from, to) {
      var esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp('(Glyph:[ \\t]*)' + esc + '(?=[ \\t\\r]*(?:\\n|<|$))', 'g'), function (m, a) { return a + to; });
    }
    // the git blob sha of bytes, so a picture already kept under its name is known to be the same file
    function bytesSha(data) {
      var head = new TextEncoder().encode('blob ' + data.length + '\0'), all = new Uint8Array(head.length + data.length);
      all.set(head); all.set(data, head.length);
      return crypto.subtle.digest('SHA-1', all).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); });
    }
    // the project's pictures against those kept already under the same names (taken: name -> sha, or a function giving
    // the sha or null): the same file shared, another one numbered (x-2.png, ...) and the maps' notes changed to it.
    // Gives the renames made, [[from, to]]
    function settleGlyphs(p, taken) {
      var look = typeof taken === 'function' ? taken : function (n) { return Promise.resolve(taken[n] || null); };
      var renames = [], names = Object.keys(p.glyphs), out = {}, mine = {};
      return names.reduce(function (q, g) {
        return q.then(function () { return bytesSha(p.glyphs[g]); }).then(function (sha) {
          var free = function (n, k) {
            var cand = k < 2 ? n : n.replace(/(\.[^./]+)$/, '-' + k + '$1');
            if (mine[cand]) return Promise.resolve(free(n, k < 2 ? 2 : k + 1));
            return look(cand).then(function (s) { return !s || s === sha ? cand : free(n, k < 2 ? 2 : k + 1); });
          };
          return free(g, 1).then(function (to) {
            mine[to] = 1; out[to] = p.glyphs[g];
            if (to !== g) renames.push([g, to]);
          });
        });
      }, Promise.resolve()).then(function () {
        p.glyphs = out;
        if (renames.length) p.maps.forEach(function (m) { renames.forEach(function (r) { m.text = renameGlyph(m.text, r[0], r[1]); }); });
        return renames;
      });
    }
    export { bytesSha, glyphsNamed, minervaProject, renameGlyph, settleGlyphs, unzip };
