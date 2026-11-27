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
          if (!/\.png$/i.test(g)) throw new Error(g + ' is named in ' + stem(m.path) + ': MINERVA takes PNG images only');
          if (!/^glyphs\/[^/]+$/.test(g)) throw new Error(g + ' is named in ' + stem(m.path) + ': only images directly in glyphs/ are read here');   // the stores keep glyphs/ as one folder
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
    // ---------- packing a MINERVA project (Download as MINERVA zip) ----------
    // The maps (the top level first), their pictures and the project's other files into one zip as MINERVA takes it: the
    // top level at the root, the others in submaps/, the pictures in glyphs/. No library: entries deflated by the
    // browser's CompressionStream, CRC-32 by a table, one date on every file (1 January 2026), so the same project always
    // packs into the same bytes.
    var CRC;   // the CRC-32 table, made at the first use
    function crc32(d) {
      if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
      var x = 0xffffffff; for (var i = 0; i < d.length; i++) x = CRC[(x ^ d[i]) & 255] ^ (x >>> 8);
      return (x ^ 0xffffffff) >>> 0;
    }
    function deflate(data) {
      var s = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Response(s).arrayBuffer().then(function (a) { return new Uint8Array(a); });
    }
    function dosDate() { return ((2026 - 1980) << 9) | (1 << 5) | 1; }   // 1 January 2026, midnight
    function asBytes(d) { return typeof d === 'string' ? new TextEncoder().encode(d) : d; }
    // entries [{ name, data (bytes or text) }] into a zip's bytes, in that order
    function zip(entries) {
      return entries.reduce(function (q, e) {
        return q.then(function (out) { var d = asBytes(e.data); return deflate(d).then(function (c) { out.push({ name: new TextEncoder().encode(e.name), utf: /[^\x20-\x7e]/.test(e.name), d: d, c: c, crc: crc32(d) }); return out; }); });
      }, Promise.resolve([])).then(function (list) {
        var parts = [], cd = [], off = 0, size = 0;
        var head = function (n, sig) { var b = new Uint8Array(n), v = new DataView(b.buffer); v.setUint32(0, sig, true); return { b: b, v: v }; };
        list.forEach(function (x) {
          var flag = x.utf ? 0x800 : 0, h = head(30, 0x04034b50), c = head(46, 0x02014b50);
          h.v.setUint16(4, 20, true); c.v.setUint16(4, 20, true); c.v.setUint16(6, 20, true);   // version made by and needed: 2.0
          var at = function (v, i) { v.setUint16(i, flag, true); v.setUint16(i + 2, 8, true); v.setUint16(i + 4, 0, true); v.setUint16(i + 6, dosDate(), true); v.setUint32(i + 8, x.crc, true); v.setUint32(i + 12, x.c.length, true); v.setUint32(i + 16, x.d.length, true); v.setUint16(i + 20, x.name.length, true); };
          at(h.v, 6); at(c.v, 8); c.v.setUint32(42, off, true);
          parts.push(h.b, x.name, x.c); cd.push(c.b, x.name);
          off += 30 + x.name.length + x.c.length;
        });
        cd.forEach(function (b) { size += b.length; });
        var end = head(22, 0x06054b50);
        end.v.setUint16(8, list.length, true); end.v.setUint16(10, list.length, true); end.v.setUint32(12, size, true); end.v.setUint32(16, off, true);
        var all = parts.concat(cd, [end.b]), n = 0; all.forEach(function (b) { n += b.length; });
        var out = new Uint8Array(n), k = 0; all.forEach(function (b) { out.set(b, k); k += b.length; });
        return out;
      });
    }
    function unesc(s) { return s.replace(/&(lt|gt|quot|apos|amp);/g, function (m, e) { return { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e]; }); }
    function attrOf(tag, a) { var m = new RegExp('\\s' + a + '="([^"]*)"').exec(tag); return m ? m[1] : null; }
    function boundsIn(seg) { var b = /<celldesigner:bounds\s[^>]*>/.exec(seg); return b ? ['x', 'y', 'w', 'h'].map(function (k) { return +attrOf(b[0], k); }) : null; }
    function glyphOf(s) { var m = /Glyph:[ \t]*([^\r\n<]+?\.(?:png|svg))[ \t\r]*(?:\n|<|$)/i.exec(unesc(s || '')); return m ? m[1] : null; }
    // a CellDesigner map's pictures and boxes: compartments and top-level species whose notes name one (with the box of
    // each alias), the layer texts that do (backgrounds), and every compartment's first box (what holds what)
    function picturesOn(text) {
      var out = [], comps = {}, spBox = {}, cBox = {}, m;
      var aRe = /<celldesigner:(speciesAlias|complexSpeciesAlias|compartmentAlias)\b([^>]*)>([\s\S]*?)<\/celldesigner:\1>/g;
      while ((m = aRe.exec(text))) {
        var b = boundsIn(m[3]); if (!b) continue;
        if (m[1] === 'compartmentAlias') { var c = attrOf(m[2], 'compartment'); if (c && !cBox[c]) cBox[c] = b; }
        else { var s = attrOf(m[2], 'species'); (spBox[s] = spBox[s] || []).push(b); }
      }
      var eRe = /<(compartment|species)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
      while ((m = eRe.exec(text))) {
        var id = attrOf(m[2], 'id'), n = m[4] && /<notes\b[\s\S]*?<\/notes>/.exec(m[4]), g = n && glyphOf(n[0]);
        if (m[1] === 'compartment') comps[id] = { at: m.index, end: m.index + m[0].length };
        if (!g) continue;
        out.push({ kind: m[1], id: id, glyph: g, boxes: m[1] === 'compartment' ? (cBox[id] ? [cBox[id]] : []) : spBox[id] || [], at: m.index, end: m.index + m[0].length });
      }
      var lRe = /<celldesigner:layerSpeciesAlias\b[^>]*>([\s\S]*?)<\/celldesigner:layerSpeciesAlias>/g;
      while ((m = lRe.exec(text))) {
        var ln = /<celldesigner:layerNotes>([\s\S]*?)<\/celldesigner:layerNotes>/.exec(m[1]), lg = ln && glyphOf(ln[1]), lb = boundsIn(m[1]);
        if (lg) out.push({ kind: 'layer', glyph: lg, boxes: lb ? [lb] : [], at: m.index, end: m.index + m[0].length });
      }
      return { pics: out, cBox: cBox };
    }
    // a line of notes, raw or escaped (<p>Glyph: ...</p> written as &lt;p&gt;Glyph: ...&lt;/p&gt;): what may stand
    // before it and after it
    function lineAt() { return '(^|\\n|>|&gt;)[ \\t]*'; }
    function lineEnd() { return '[ \\t]*(\\r?\\n|(?=<)|(?=&lt;)|$)'; }
    function zOf(seg) { var m = new RegExp(lineAt() + 'Z-Index:[ \\t]*(-?\\d+)' + lineEnd()).exec(seg); return m ? +m[2] : null; }
    function inside(a, b) { return a !== b && a[0] >= b[0] - 0.5 && a[1] >= b[1] - 0.5 && a[0] + a[2] <= b[0] + b[2] + 0.5 && a[1] + a[3] <= b[1] + b[3] + 0.5 && (a[2] < b[2] || a[3] < b[3]); }
    // the element's segment with its Z-Index set to z: every Z-Index line of its notes taken out, one put after the Glyph line
    function zSet(seg, z) {
      var noZ = seg.replace(new RegExp(lineAt() + 'Z-Index:[^\\r\\n<&]*' + lineEnd(), 'g'), function (m, a) { return a; });
      var g = new RegExp('Glyph:[ \\t]*[^\\r\\n<]+?\\.(?:png|svg)' + lineEnd(), 'i').exec(noZ);
      if (!g) return seg;
      var at = g.index + g[0].length;
      return noZ.slice(0, at) + (g[1] ? 'Z-Index: ' + z + g[1] : '\nZ-Index: ' + z) + noZ.slice(at);   // after a line end, else on a line of its own before the tag that ends it
    }
    // the Z-Index of a map's pictured compartments reckoned from what holds what as drawn (an outer one lower; the
    // innermost -2, the Forge's rule), unless every one has a Z-Index already in that order; a background with a Z-Index
    // not under them set one below the lowest. Gives { text, changed: n }
    function reckonZ(text) {
      var on = picturesOn(text), cs = on.pics.filter(function (p) { return p.kind === 'compartment' && p.boxes.length; });
      if (!cs.length) return { text: text, changed: 0 };
      var all = Object.keys(on.cBox).map(function (k) { return on.cBox[k]; });
      cs.forEach(function (p) { p.depth = all.filter(function (b) { return inside(p.boxes[0], b); }).length; p.z = zOf(text.slice(p.at, p.end)); });
      var holds = cs.every(function (a) { return a.z != null && cs.every(function (b) { return !inside(b.boxes[0], a.boxes[0]) || (b.z != null && a.z < b.z); }); });
      var edits = [], deep = Math.max.apply(null, cs.map(function (p) { return p.depth; }));
      if (!holds) cs.forEach(function (p) { var z = -2 - (deep - p.depth); if (p.z !== z) edits.push({ at: p.at, end: p.end, z: z }); });
      var low = Math.min.apply(null, cs.map(function (p) { var e = edits.filter(function (x) { return x.at === p.at; })[0]; return e ? e.z : p.z != null ? p.z : 0; }));
      on.pics.forEach(function (p) {
        if (p.kind !== 'layer') return;
        var z = zOf(text.slice(p.at, p.end));
        if (z != null && z >= low) edits.push({ at: p.at, end: p.end, z: low - 1, layer: true });
      });
      var changed = 0;
      edits.sort(function (a, b) { return b.at - a.at; }).forEach(function (e) {
        var seg = text.slice(e.at, e.end), now = zSet(seg, e.z);
        if (now !== seg) { changed++; text = text.slice(0, e.at) + now + text.slice(e.end); }
      });
      return { text: text, changed: changed };
    }
    function bareName(p) { return p.split('/').pop().replace(/\.xml$/i, ''); }
    function mapStem(s) { return s.replace(/_underscore_/g, '_'); }
    // a kept file's links to maps no longer in the project left out: config.json's entries naming them, mapping.xml's
    // reactions to their complexes. Gives { data, gone: [names] }
    function pruneLinks(path, data, missing) {
      if (!missing.length) return { data: data, gone: [] };
      var miss = missing.map(function (m) { return bareName(m); }), gone = [];
      if (/^config\.json$/i.test(path)) {
        try {
          var cfg = JSON.parse(new TextDecoder().decode(data)), touched = false;
          (cfg.maps || []).forEach(function (mp) {
            var keep = (mp.custom_elements || []).filter(function (e) { var out = miss.indexOf(e.submap) >= 0; if (out && gone.indexOf(e.submap) < 0) gone.push(e.submap); return !out; });
            if (mp.custom_elements && keep.length !== mp.custom_elements.length) { mp.custom_elements = keep; touched = true; }
          });
          var maps0 = (cfg.maps || []).length; cfg.maps = (cfg.maps || []).filter(function (mp) { var out = miss.indexOf(mp.name) >= 0; if (out && gone.indexOf(mp.name) < 0) gone.push(mp.name); return !out; });
          if (cfg.maps.length !== maps0) touched = true;
          return { data: touched ? new TextEncoder().encode(JSON.stringify(cfg, null, 1)) : data, gone: gone };
        } catch (e) { return { data: data, gone: [] }; }
      }
      if (/^submaps\/mapping\.xml$/i.test(path)) {
        var t = new TextDecoder().decode(data), cx = {}, m, sRe = /<species\b([^>]*)>/g;
        while ((m = sRe.exec(t))) { var nm = mapStem(unesc(attrOf(m[1], 'name') || '')); if (miss.indexOf(nm) >= 0) cx[attrOf(m[1], 'id')] = nm; }
        var inRe = /<celldesigner:species\b([^>]*)>([\s\S]*?)<\/celldesigner:species>/g, k;   // a link from a map starts at a species inside its complex
        while ((m = inRe.exec(t))) if ((k = /<celldesigner:complexSpecies>([^<]+)</.exec(m[2])) && cx[k[1].trim()]) cx[attrOf(m[1], 'id')] = cx[k[1].trim()];
        var t2 = t.replace(/[ \t]*<reaction\b[\s\S]*?<\/reaction>[ \t]*\r?\n?/g, function (r) {
          var hit = null, a = /<celldesigner:base(?:Reactant|Product)\s[^>]*species="([^"]+)"/g, x;
          while ((x = a.exec(r))) if (cx[x[1]]) hit = cx[x[1]];
          if (hit && gone.indexOf(hit) < 0) gone.push(hit);
          return hit ? '' : r;
        });
        return { data: t2 === t ? data : new TextEncoder().encode(t2), gone: gone };
      }
      return { data: data, gone: [] };
    }
    // a project's maps checked and planned for a zip: maps [{ path, text, title }], the top level first. Refused (an
    // Error, in the person's words) for a map not CellDesigner, two maps of one path, a picture named not as MINERVA
    // reads it. Gives the pictures to fetch, each with the first box that names it and whether others differ: [{ name,
    // box: [w, h] | null, mixed, maps: [titles] }]
    function packPlan(maps) {
      var paths = {}, need = {}, order = [];
      maps.forEach(function (m) {
        var f = formatName(m.text);
        if (f !== 'CellDesigner') throw new Error('the map ' + m.title + ' is ' + (f || /<graphml[\s>]/.test(m.text.slice(0, 3000)) && 'GraphML' || 'not CellDesigner') + ': only CellDesigner maps go into a MINERVA zip');
        var key = m.path.toLowerCase();
        if (paths[key]) throw new Error('two maps would be ' + m.path + ' in the zip (' + paths[key] + ', ' + m.title + '): rename one file first');
        paths[key] = m.title;
        picturesOn(m.text).pics.forEach(function (p) {
          var g = p.glyph;
          if (!/^glyphs\/[^/]+\.png$/i.test(g)) throw new Error(g + ' is named in ' + m.title + ': MINERVA reads images as glyphs/<name>.png');
          var n = need[g];
          if (!n) { n = need[g] = { name: g, box: null, mixed: false, maps: [] }; order.push(n); }
          if (n.maps.indexOf(m.title) < 0) n.maps.push(m.title);
          p.boxes.forEach(function (b) {
            if (!(b[2] > 0 && b[3] > 0)) return;
            if (!n.box) n.box = [b[2], b[3]];
            else if (Math.abs((b[2] / b[3]) / (n.box[0] / n.box[1]) - 1) > 0.05) n.mixed = true;
          });
        });
      });
      return order;
    }
    // the size of a PNG, from its header
    function pngSize(d) { return d.length > 24 && d[0] === 0x89 && d[1] === 0x50 ? [(d[16] << 24 | d[17] << 16 | d[18] << 8 | d[19]) >>> 0, (d[20] << 24 | d[21] << 16 | d[22] << 8 | d[23]) >>> 0] : null; }
    // the pictures a kept mapping.xml names (link records, packed with it when there)
    function keptGlyphs(kept) {
      var k = Object.keys(kept || {}).filter(function (n) { return /^submaps\/mapping\.xml$/i.test(n); })[0];
      return k ? glyphsNamed(new TextDecoder().decode(kept[k])).filter(function (g) { return /^glyphs\/[^/]+\.png$/i.test(g); }) : [];
    }
    // the pixels an SVG picture is drawn at: 2 a map unit of its box, at most 8000 on a side (both sides scaled together)
    function svgPixels(box) {
      var w = Math.max(1, box[0] * 2), h = Math.max(1, box[1] * 2), k = Math.min(1, 8000 / Math.max(w, h));
      return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
    }
    // the pixels a PNG of size [w, h] is resampled to for a box of other proportions (more than 5% apart): the box's
    // proportions, no side made smaller, at most 8000 on a side; null when it goes as it is
    function fitPixels(size, box) {
      var r = box[0] / box[1];
      if (Math.abs((size[0] / size[1]) / r - 1) <= 0.05) return null;
      var w = Math.max(size[0], size[1] * r), h = w / r, k = Math.min(1, 8000 / Math.max(w, h));
      return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
    }
    // the zip's entries: maps [{ path, text }] (top level first), pictures { name: bytes } (PNG), kept { path: bytes } and
    // the project's maps no longer in it (missing: their zip paths); Z-Index reckoned and the background layer made
    // visible in the maps' copies. Gives
    // { entries, z: maps whose Z-Index was written, gone: links left out }
    // the editor's own background layer (Background images, earlier Background pictures) marked visible in the zip's copy:
    // MINERVA hides a layer marked not visible and every picture on it; maps made before the writer marked it visible
    function bgVisible(text) {
      return text.replace(/<celldesigner:layer\b[^>]*\sname="Background (?:images|pictures)"[^>]*>/g, function (h) { return h.replace(/\svisible="false"/, ' visible="true"'); });
    }
    function packEntries(maps, pics, kept, missing) {
      var z = [], gone = [], entries = [];
      maps.forEach(function (m) {
        var r = reckonZ(bgVisible(m.text));
        if (r.changed) z.push(bareName(m.path));
        entries.push({ name: m.path, data: r.text });
      });
      Object.keys(pics).sort().forEach(function (g) { entries.push({ name: g, data: pics[g] }); });
      Object.keys(kept || {}).sort().forEach(function (k) {
        var p = pruneLinks(k, kept[k], missing || []);
        p.gone.forEach(function (g) { if (gone.indexOf(g) < 0) gone.push(g); });
        entries.push({ name: k, data: p.data });
      });
      return { entries: entries, z: z, gone: gone };
    }
    export { bytesSha, crc32, fitPixels, glyphsNamed, keptGlyphs, minervaProject, packEntries, packPlan, picturesOn, pngSize, reckonZ, renameGlyph, settleGlyphs, svgPixels, unzip, zip };
