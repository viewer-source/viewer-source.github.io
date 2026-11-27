// Three versions of a map's file joined element by element: base (the version both edits started from), mine (this
// browser's) and theirs (the file as GitHub has it now). Any XML format: an element with an id attribute is one item
// (a GraphML node or edge, an SBGN-ML glyph, arc or port, a CellDesigner species, alias or reaction); an element without
// one belongs to the item that holds it, named by its place there (tag, key attribute, rank), so a node's label, its
// geometry and its data are the node's. Per item: changed on one side only, that side's; changed on both, mine (a
// clash), unless the two differ only in where things are drawn (x, y, sizes, a group's insets: mine, said as no clash). An item's parent is part of it
// (a node moved into a group is a change of the node); the order of an element's items is the side's whose element it
// is, an item added on the other side placed after the item before it there.
// A version may hold the whole map shifted (the editor writes positions from the map's top left corner, so a node moved
// past the edge moves every other one in the file): the shift is found per version against another (frame: the
// offset most x or y values of one kind of place share, a kind being the element's tags from its item down), positions are compared with it taken out, and what comes from theirs is
// brought into mine's frame. Otherwise the text is cut, never rewritten: every piece of the result is a piece of one of
// the three files, byte for byte.
// Gives { text, clashes, moved, broken }: clashes, the items both changed (mine kept); moved, those whose positions
// alone differed; broken, why the versions could not be joined (text is then mine): a file that does not read as XML,
// an id used twice, an item left with no place, or a reference (an attribute or a text naming an id) to an item no
// longer there. Imports nothing; core.js joins with it (outbox sends, the open editor's save).
export function merge3(base, ours, theirs) {
  if (ours === theirs || theirs === base) return { text: ours, clashes: 0, moved: 0, broken: null };
  if (ours === base) return { text: theirs, clashes: 0, moved: 0, broken: null };
  try { return join(read(base), read(ours), read(theirs)); }
  catch (e) { return { text: ours, clashes: 0, moved: 0, broken: String(e && e.message ? e.message : e) }; }
}

// The file as a tree of elements over its text: each { tag, at (attributes), s, oe, cs, e (start, end of the start tag,
// start of the end tag, end), kids, up, path, key (an item's own path), unit (the item it belongs to; '' the document) }
function read(text) {
  if (typeof text !== 'string' || !text) throw new Error('an empty version');
  var doc = { path: '', kids: [], s: 0, e: text.length, unit: '' }, stack = [doc], i = 0, n = text.length, byPath = {};
  while (i < n) {
    var lt = text.indexOf('<', i);
    if (lt < 0) break;
    if (text.startsWith('<!--', lt)) { i = upTo(text, '-->', lt); continue; }
    if (text.startsWith('<![CDATA[', lt)) { i = upTo(text, ']]>', lt); continue; }
    if (text.startsWith('<?', lt)) { i = upTo(text, '?>', lt); continue; }
    if (text.startsWith('<!', lt)) { var sb = text.indexOf('[', lt), gt0 = text.indexOf('>', lt); i = sb >= 0 && sb < gt0 ? upTo(text, ']>', lt) : gt0 + 1; if (i <= 0) throw new Error('a declaration not closed'); continue; }
    var gt = tagEnd(text, lt);
    if (text[lt + 1] === '/') {
      var top = stack.pop(), nm = text.slice(lt + 2, gt).trim();
      if (!top || top === doc || top.tag !== nm) throw new Error('an end tag ' + nm + ' that closes nothing open');
      top.cs = lt; top.e = gt + 1; i = gt + 1; continue;
    }
    var raw = text.slice(lt + 1, gt), self = raw[raw.length - 1] === '/', tag = (/^[^\s/>]+/.exec(raw) || [''])[0];
    if (!tag) throw new Error('a tag with no name');
    var el = { tag: tag, at: attrs(raw), s: lt, oe: gt + 1, cs: gt + 1, e: gt + 1, kids: [], up: stack[stack.length - 1] };
    el.up.kids.push(el);
    if (!self) stack.push(el);
    i = gt + 1;
  }
  if (stack.length !== 1) throw new Error('an element not closed: ' + stack[stack.length - 1].tag);
  var roots = doc.kids;
  if (roots.length !== 1) throw new Error('not one root element');
  var many = {};   // an id a file gives in several places (CellDesigner's residues rs1, rs2 in every protein): named within the item holding it
  (function count(p) { p.kids.forEach(function (c) { if (c.at.id != null) { var k = c.tag + '#' + c.at.id; many[k] = (many[k] || 0) + 1; } count(c); }); })(doc);
  (function name(p) {
    var rank = {};
    p.kids.forEach(function (c) {
      var id = c.at.id != null ? c.at.id : null;
      if (id != null) { c.path = c.key = (many[c.tag + '#' + id] > 1 ? p.unit + '>' : '') + c.tag + '#' + id; c.unit = c.key; c.ctx = c.tag; }
      else { var sig = c.tag + (c.at.key != null ? '[' + c.at.key + ']' : ''); rank[sig] = (rank[sig] || 0) + 1; c.path = p.path + '/' + sig + '#' + rank[sig]; c.unit = p.unit; c.ctx = (p.ctx ? p.ctx + '/' : '') + c.tag; }   // ctx: its tags from its item down, the kind of place its x and y are
      if (byPath[c.path] && id != null) { for (var r2 = 2; byPath[c.path + '~' + r2]; r2++); c.path = c.key = c.unit = c.path + '~' + r2; }   // an id given twice in one place (a file's own slip): told apart by rank
      if (byPath[c.path]) throw new Error('the element ' + c.path + ' found twice');
      byPath[c.path] = c;
      name(c);
    });
  })(doc);
  return { text: text, doc: doc, root: roots[0], byPath: byPath, items: items(text, doc) };
}
function upTo(t, end, from) { var k = t.indexOf(end, from); if (k < 0) throw new Error('a ' + end + ' missing'); return k + end.length; }
function tagEnd(t, lt) {   // the > closing the tag at lt, quotes skipped
  for (var k = lt + 1, q = ''; k < t.length; k++) { var c = t[k]; if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '>') return k; }
  throw new Error('a tag not closed');
}
function attrs(raw) {
  var o = {}, re = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g, m;
  while ((m = re.exec(raw))) o[m[1]] = m[3] != null ? m[3] : m[4];
  return o;
}
function lead(t, at) { var k = at; while (k > 0 && /\s/.test(t[k - 1])) k--; return k; }   // where the white space before at starts
// each item's own text: the item and what it holds, its items cut out (with the white space before them), and its parent
function items(t, doc) {
  var out = {};
  var own = function (el) {
    var s = '', pos = el.s;
    el.kids.forEach(function (c) {
      if (c.key) { s += t.slice(pos, lead(t, c.s)); pos = c.e; }
      else { s += t.slice(pos, c.s) + own(c); pos = c.e; }
    });
    return s + t.slice(pos, el.e);
  };
  var it = function (el, sig) {   // pos: [kind, axis, value] of the item's x and y, element by element (its items left out)
    var pos = [];
    (function each(e) { if (e.at) ['x', 'y'].forEach(function (ax) { var v = e.at[ax] != null ? parseFloat(e.at[ax]) : null; if (v != null && v === v) pos.push([e.ctx + ' ' + ax, ax, v]); }); e.kids.forEach(function (c) { if (!c.key) each(c); }); })(el);
    return { el: el, sig: sig, blank: null, pos: pos };   // blank: the text with x and y left empty, made when asked (blank())
  };
  (function walk(el) {
    el.kids.forEach(function (c) { if (c.key) out[c.key] = it(c, 'in ' + (c.up.path || '/') + '\n' + own(c)); walk(c); });
  })(doc);
  out[''] = it(doc, own(doc));
  return out;
}
// the patterns read here, made at each call (a module's top level holds functions only): TAG a start tag; XY an x or y
// attribute; GEO where a thing is drawn and how large, a layout's and not a change of the map's meaning (names of the
// formats read: sizes, yEd's group insets, CellDesigner's sizeX and sizeY of the map)
function rx() { return { TAG: /<([^\s/>!?]+)([^>]*)>/g, XY: /(\s)(x|y)(\s*=\s*)(["'])(-?[\d.]+(?:[eE][-+]?\d+)?)\4/g, GEO: /(\s(?:x|y|w|h|width|height|sizeX|sizeY|left|right|top|bottom|leftF|rightF|topF|bottomF)\s*=\s*)("[^"]*"|'[^']*')/g }; }
// the shift of version A against B: per tag and axis, the offset most of its values share when the item is the same but
// for positions; a tag moved by the shift found for its axis is one whose x and y are on the map (a GraphML geometry, a
// CellDesigner alias's bounds), the others relative (a label's place in its node, a CellDesigner inner position)
function blank(i) {
  if (i.blank == null) { var R = rx(); i.blank = i.sig.replace(R.TAG, function (m, tag, rest) { return '<' + tag + rest.replace(R.XY, function (mm, sp, ax, eq, q) { return sp + ax + eq + q + q; }) + '>'; }); }
  return i.blank;
}
function alike(a, b) { return a.sig === b.sig || (a.pos.length === b.pos.length && blank(a) === blank(b)); }   // the same but for x and y
function frame(A, B) {
  var by = {}, F = { x: 0, y: 0, on: {} }, both = [];
  Object.keys(A.items).forEach(function (k) {
    var a = A.items[k], b = B.items[k];
    if (!b || !a.pos.length || !alike(a, b)) return;
    both.push([a, b]);
    a.pos.forEach(function (p, i) { var d = Math.round((p[2] - b.pos[i][2]) * 100) / 100, g = by[p[0]] || (by[p[0]] = { ax: p[1], n: 0, c: {} }); g.n++; g.c[d] = (g.c[d] || 0) + 1; });
  });
  var best = { x: null, y: null };
  Object.keys(by).forEach(function (t) {
    var g = by[t], m = null;
    Object.keys(g.c).forEach(function (d) { if (m == null || g.c[d] > g.c[m] || (g.c[d] === g.c[m] && Math.abs(+d) < Math.abs(+m))) m = d; });
    g.m = +m;
    if (g.m !== 0 && g.c[m] * 2 >= g.n && (!best[g.ax] || g.n > best[g.ax].n)) best[g.ax] = g;
  });
  ['x', 'y'].forEach(function (ax) {
    if (!best[ax]) return;
    var m = best[ax].m, on = {};
    Object.keys(by).forEach(function (t) { var g = by[t]; if (g.ax === ax && Math.abs(g.m - m) < 0.01) on[t] = true; });
    // a shift of the whole map, not a few items moved together: most items with a position carry it
    var moved = both.filter(function (ab) { return ab[0].pos.some(function (p, i) { return on[p[0]] && Math.abs(p[2] - ab[1].pos[i][2] - m) < 0.01; }); }).length;
    if (moved * 2 < both.length) return;
    F[ax] = m; Object.keys(on).forEach(function (t) { F.on[t] = true; });
  });
  return F;
}
function same(a, b, F) {   // item a is item b but for the shift F
  if (!a || !b) return !a && !b;
  if (a.sig === b.sig && !F.x && !F.y) return true;
  if (!alike(a, b)) return false;
  for (var i = 0; i < a.pos.length; i++) { var p = a.pos[i]; if (Math.abs(p[2] - b.pos[i][2] - (F.on[p[0]] ? F[p[1]] : 0)) > 0.01) return false; }
  return true;
}
function shifter(F) {   // the start tag of el at the head of s, of theirs, brought into mine's frame
  if (!F.x && !F.y) return function (s) { return s; };
  return function (s, el) {
    if (!el || !el.ctx) return s;
    var gt = s.indexOf('>');
    return s.slice(0, gt).replace(rx().XY, function (mm, sp, ax, eq, q, v) { return F.on[el.ctx + ' ' + ax] && F[ax] ? sp + ax + eq + q + String(+(parseFloat(v) + F[ax]).toFixed(3)) + q : mm; }) + s.slice(gt);
  };
}

function join(B, O, T) {
  var Fo = frame(O, B), Ft = frame(T, B), Fot = frame(O, T), V = { o: O, t: T, shift: shifter(Fot) }, keys = {}, side = {}, clashes = 0, moved = 0;
  [B, O, T].forEach(function (v) { Object.keys(v.items).forEach(function (k) { keys[k] = 1; }); });
  Object.keys(keys).forEach(function (k) {
    var b = B.items[k], o = O.items[k], t = T.items[k];
    if (same(t, b, Ft)) side[k] = o ? 'o' : null;   // unchanged there (but for its frame)
    else if (same(o, b, Fo)) side[k] = t ? 't' : null;   // unchanged here
    else {   // changed on both sides: mine
      side[k] = o ? 'o' : null;
      if (same(o, t, Fot)) return;   // the same change on both
      if (o && t && o.sig.replace(rx().GEO, '$1""') === t.sig.replace(rx().GEO, '$1""')) moved++; else clashes++;
    }
  });
  if (side[''] == null) throw new Error('no document');
  // the items under each element of the result: by the parent path of the side each item is taken from
  var under = {}, placed = {};
  Object.keys(side).forEach(function (k) {
    if (!k || !side[k]) return;
    var el = V[side[k]].items[k].el, p = el.up.path;
    (under[p] = under[p] || []).push(k);
  });
  var text = cut(V, side, under, placed, V[side['']].doc, side['']);
  Object.keys(side).forEach(function (k) { if (k && side[k] && !placed[k]) throw new Error('the item ' + k + ' has no place left'); });
  refs(text, [B, O, T]);
  return { text: text, clashes: clashes, moved: moved, broken: null };
}
// el of side w written out: its own pieces from w, its items as the result has them
function cut(V, side, under, placed, el, w) {
  var v = V[w], t = v.text, here = (under[el.path] || []).slice(), slots = [], pieces = [], pos = el.s;
  var sh = function (x, at) { return w === 't' && at === el.s ? V.shift(x, el) : x; };   // el's own start tag, of theirs: into mine's frame
  el.kids.forEach(function (c) {
    if (c.key) { pieces.push(sh(t.slice(pos, lead(t, c.s)), pos)); slots.push(c.key); pieces.push({ slot: slots.length - 1 }); pos = c.e; }
    else { pieces.push(sh(t.slice(pos, c.s), pos)); pieces.push({ done: cut(V, side, under, placed, c, w) }); pos = c.e; }
  });
  var tail = t.slice(pos, el.e), str = function (p) { return typeof p === 'string' ? p : p.done != null ? p.done : null; };
  if (!here.length) return pieces.map(function (p) { var x = str(p); return x == null ? '' : x; }).join('') + sh(tail, pos);
  // the order: this side's items still here, in its order; the others after the item before them on their side
  var isHere = {}, slotOf = {};
  here.forEach(function (k) { isHere[k] = true; });
  slots.forEach(function (k, i) { slotOf[k] = i; });
  var R = slots.filter(function (k) { return isHere[k]; }), inR = {};
  R.forEach(function (k) { inR[k] = true; });
  here.filter(function (k) { return !inR[k]; }).forEach(function (k) {   // few: what the other side added or moved here
    var kv = V[side[k]], ke = kv.items[k].el, sib = ke.up.kids.filter(function (c) { return c.key; }), j = sib.indexOf(ke), at = -1;
    for (var a = j - 1; a >= 0 && at < 0; a--) { var ia = R.indexOf(sib[a].key); if (ia >= 0) at = ia + 1; }
    for (var z = j + 1; z < sib.length && at < 0; z++) { var iz = R.indexOf(sib[z].key); if (iz >= 0) at = iz; }
    if (at < 0) at = R.length;
    R.splice(at, 0, k);
  });
  var group = {}, g = slots.length ? 0 : 'end';
  R.forEach(function (k) { var si = slotOf[k]; if (si != null) g = si; (group[g] = group[g] || []).push(k); });
  var item = function (k) {
    var kv = V[side[k]], ke = kv.items[k].el;
    if (placed[k]) throw new Error('the item ' + k + ' placed twice');
    placed[k] = true;
    return kv.text.slice(lead(kv.text, ke.s), ke.s) + cut(V, side, under, placed, ke, side[k]);
  };
  var out = pieces.map(function (p) { var x = str(p); return x != null ? x : (group[p.slot] || []).map(item).join(''); }).join('');
  if (group.end) {
    if (el.path && el.cs === el.e) throw new Error('items to place in an element written empty: ' + el.tag);
    var cs = el.path ? el.cs : t.length, ws = lead(t, cs);   // before the white space that ends the element
    var rel = ws - pos;
    out += sh(tail.slice(0, rel), pos) + group.end.map(item).join('') + tail.slice(rel);
  } else out += sh(tail, pos);
  return out;
}
// every attribute value and every text that names an id of one of the versions names one still there
function refs(text, vs) {
  var R = read(text), ids = {}, now = {};
  vs.forEach(function (v) { Object.keys(v.byPath).forEach(function (p) { var e = v.byPath[p]; if (e.at.id != null) ids[e.at.id] = 1; }); });
  Object.keys(R.byPath).forEach(function (p) { var e = R.byPath[p]; if (e.at.id != null) now[e.at.id] = 1; });
  Object.keys(R.byPath).forEach(function (p) {
    var e = R.byPath[p];
    var check = function (v) { String(v).split(/[\s,]+/).forEach(function (x) { if (x && ids[x] && !now[x]) throw new Error('a reference to ' + x + ', which is no longer there'); }); };   // a value may list ids (a CellDesigner gate's modifiers)
    Object.keys(e.at).forEach(function (a) { if (a !== 'id') check(e.at[a]); });
    if (!e.kids.length) check(text.slice(e.oe, e.cs));
  });
}
