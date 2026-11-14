// cdrender in JavaScript (2026-11-13): the same drawing as cdrender.py byte for byte (tests/cd-compare.js), for the
// editor in the browser and the viewer's build (renderers/render.js), the master since 2026-11-13 (user: JavaScript the master for the viewer's own build and the editor).
// cdrender.py beside it is its twin for the Python tools elsewhere; a change is made in both in the same commit. With it the four helpers it takes from the converter (cd_layout's ANCHOR, ANGLE,
// SQUARE, anchor_point, from_frame, to_frame and celldesigner's plain_name), and Python's number writing (py below),
// shared with cd_edit.js. The rules and their reasons are in cdrender.py under the same names; comments here are short.
//   browser: cdrender.render(text, { classes, groups }) -> svg;  cdrender.renderHits(text, opt) -> [svg, hits]
//   node:    node renderers/converter/cdrender.js map.xml out.svg   (needs @xmldom/xmldom)
(function (root) {
  'use strict';
  // ---- Python's numbers where JavaScript's differ ----
  var buf = new DataView(new ArrayBuffer(8));
  function exactRound(v, nd) {   // the exact value of the double rounded to nd places, an exact half to even, as text
    var a = Math.abs(v);
    buf.setFloat64(0, a);
    var hi = buf.getUint32(0), lo = buf.getUint32(4), e = (hi >>> 20) & 0x7ff;
    var m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), ex;
    if (e === 0) ex = -1074; else { m |= 1n << 52n; ex = e - 1075; }
    var n = m * 10n ** BigInt(nd), d = 1n;
    if (ex >= 0) n <<= BigInt(ex); else d <<= BigInt(-ex);
    var q = n / d, r = n - q * d;
    if (r * 2n > d || (r * 2n === d && (q & 1n))) q += 1n;
    var s = q.toString();
    while (s.length < nd + 1) s = '0' + s;
    s = nd ? s.slice(0, s.length - nd) + '.' + s.slice(s.length - nd) : s;
    return (v < 0 || Object.is(v, -0) ? '-' : '') + s;
  }
  function fixed(v, nd) {   // '%.<nd>f' % v: toFixed is the same except at an exact half
    var q = Math.abs(v) * Math.pow(10, nd), f = q - Math.floor(q);
    if (Math.abs(f - 0.5) < 1e-6 || !isFinite(q)) return exactRound(v, nd);
    var s = v.toFixed(nd);
    return Object.is(v, -0) || (v < 0 && s[0] !== '-') ? '-' + s : s;
  }
  function round(v, nd) {   // round(v, nd) of Python, a float
    var r = Number(fixed(v, nd || 0));
    return r === 0 && (v < 0 || Object.is(v, -0)) ? -0 : r;
  }
  function repr(v) {   // repr(float) of Python: the shortest digits, fixed between 1e-4 and 1e16, else with an exponent
    if (v === Infinity) return 'inf';
    if (v === -Infinity) return '-inf';
    if (v !== v) return 'nan';
    if (v === 0) return Object.is(v, -0) ? '-0.0' : '0.0';
    var m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(v.toExponential()), sign = m[1], dg = m[2] + (m[3] || ''), ex = +m[4];
    if (ex < -4 || ex >= 16) return sign + dg[0] + (dg.length > 1 ? '.' + dg.slice(1) : '') + 'e' + (ex < 0 ? '-' : '+') + (Math.abs(ex) < 10 ? '0' : '') + Math.abs(ex);
    if (ex >= 0) return sign + (dg.length <= ex + 1 ? dg + '0'.repeat(ex + 1 - dg.length) + '.0' : dg.slice(0, ex + 1) + '.' + dg.slice(ex + 1));
    return sign + '0.' + '0'.repeat(-ex - 1) + dg;
  }
  // math.hypot of CPython 3.12 (vector_norm): the squares exact (fma there, Dekker's split here: the same exact error
  // term), summed with their errors kept, one correction step; Math.hypot can differ in the last bit
  function dlMul(x, y) {
    var z = x * y, t1 = x * 134217729.0, xh = t1 - (t1 - x), xl = x - xh, t2 = y * 134217729.0, yh = t2 - (t2 - y), yl = y - yh;
    return [z, xh * yh - z + (xh * yl + xl * yh) + xl * yl];
  }
  function hypot(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    var max = a > b ? a : b;
    if (max === Infinity) return max;
    if (a !== a || b !== b) return NaN;
    if (max === 0) return max;
    buf.setFloat64(0, max);
    var e = (buf.getUint32(0) >>> 20) & 0x7ff;
    if (e === 0) return 2.2250738585072014e-308 * hypot(a / 2.2250738585072014e-308, b / 2.2250738585072014e-308);   // subnormal
    var scale = Math.pow(2, -(e - 1022)), csum = 1.0, frac1 = 0.0, frac2 = 0.0, pr, s, x;
    [a, b].forEach(function (v) {
      x = v * scale; pr = dlMul(x, x);
      s = csum + pr[0]; frac2 += (csum - s) + pr[0]; csum = s; frac1 += pr[1];
    });
    var h = Math.sqrt(csum - 1.0 + (frac1 + frac2));
    pr = dlMul(-h, h);
    s = csum + pr[0]; frac2 += (csum - s) + pr[0]; csum = s; frac1 += pr[1];
    x = csum - 1.0 + (frac1 + frac2);
    h += x / (2.0 * h);
    return h / scale;
  }
  function pmod(a, b) { var m = a % b; if (m && ((b < 0) !== (m < 0))) m += b; return m; }   // a % b of Python
  function F(s) {   // float(s)
    if (s === null || s === undefined) throw new Error('TypeError: float() argument must be a string or a real number, not NoneType');
    if (typeof s === 'number') return s;
    var t = String(s).trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
      if (/^[+-]?(inf|infinity)$/i.test(t)) return t[0] === '-' ? -Infinity : Infinity;
      if (/^[+-]?nan$/i.test(t)) return NaN;
      throw new Error('ValueError: could not convert string to float: ' + s);
    }
    return Number(t);
  }
  function I(s) {   // int(s)
    var t = String(s === null || s === undefined ? '' : s).trim();
    if (!/^[+-]?\d+$/.test(t)) throw new Error('ValueError: invalid literal for int(): ' + s);
    return parseInt(t, 10);
  }
  function escape(s) { return String(s).replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;'); }
  var py = { fixed: fixed, round: round, repr: repr, pmod: pmod, F: F, I: I, escape: escape, hypot: hypot };

  // ---- the XML, as the lxml calls of the Python read it ----
  var NS = { cd: 'http://www.sbml.org/2001/ns/celldesigner', s: 'http://www.sbml.org/sbml/level2/version4' };
  function steps(path) { return path.split('/').map(function (p) { var q = p.split(':'); return [NS[q[0]], q[1]]; }); }
  function kids(el, ns, name) { var o = []; if (!el) return o; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.namespaceURI === ns && c.localName === name) o.push(c); return o; }
  function findall(el, path) {   // el.findall(path) / iterfind
    if (!el) throw new Error("AttributeError: 'NoneType' object has no attribute 'find'");
    var cur = [el];
    steps(path).forEach(function (s) { var nx = []; cur.forEach(function (c) { kids(c, s[0], s[1]).forEach(function (k) { nx.push(k); }); }); cur = nx; });
    return cur;
  }
  function find(el, path) { return findall(el, path)[0] || null; }
  function text(el) {   // el.text: the text before its first child element, None when there is none
    if (!el) throw new Error("AttributeError: 'NoneType' object has no attribute 'text'");
    var s = null;
    for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 || c.nodeType === 4) s = (s || '') + c.nodeValue; else if (c.nodeType === 1) break; }
    return s;
  }
  function findtext(el, path, dflt) { var e = find(el, path); return e ? (text(e) || '') : dflt; }
  function get(el, a, dflt) {
    if (!el) throw new Error("AttributeError: 'NoneType' object has no attribute 'get'");
    return el.hasAttribute(a) ? el.getAttribute(a) : (dflt === undefined ? null : dflt);
  }
  var xml = { NS: NS, find: find, findall: findall, text: text, findtext: findtext, get: get, kids: kids };

  // ---- the converter's helpers (cd_layout, celldesigner) ----
  var SQUARE = { 2: [0, -1], 3: [0, 1], 4: [-1, -1], 5: [1, -1], 6: [-1, 1], 7: [1, 1] };
  var ANCHOR = { NNE: [.75, 0], ENE: [1, .25], ESE: [1, .75], SSE: [.75, 1], SSW: [.25, 1], WSW: [0, .75], WNW: [0, .25], NNW: [.25, 0],
    N: [.5, 0], NE: [1, 0], E: [1, .5], SE: [1, 1], S: [.5, 1], SW: [0, 1], W: [0, .5], NW: [0, 0] };
  var ANGLE = {};
  ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'].forEach(function (k, i) { ANGLE[k] = 22.5 * i; });
  var DEG = Math.PI / 180.0;   // math.radians: x times pi/180 computed once, as CPython does
  function radians(d) { return d * DEG; }
  function anchorPoint(box, side, circle, hexagon) {
    var x = box[0], y = box[1], w = box[2], h = box[3];
    if (!side) return [x + w / 2, y + h / 2];
    if (circle) { var a = radians(ANGLE[side]); return [x + w / 2 * (1 + Math.cos(a)), y + h / 2 * (1 - Math.sin(a))]; }
    var f = ANCHOR[side];
    if (hexagon) {
      var i = Math.min(h / 2, w / 2), fx = f[0], fy = f[1];
      if (fy === 0 || fy === 1) {
        var u = fx === 0 ? i : fx === .25 ? (w / 2 + i) / 2 : fx === .5 ? w / 2 : fx === .75 ? (w * 1.5 - i) / 2 : w - i;
        return [x + u, y + fy * h];
      }
      var dd = i * (1 - 2 * Math.min(fy, 1 - fy));
      return [x + fx * w + (fx === 0 ? dd : -dd), y + fy * h];
    }
    return [x + f[0] * w, y + f[1] * h];
  }
  function toFrame(a, b, p) {
    var ex = [b[0] - a[0], b[1] - a[1]], ey = [-ex[1], ex[0]], det = ex[0] * ey[1] - ex[1] * ey[0], q = [p[0] - a[0], p[1] - a[1]];
    if (det === 0) throw new Error('ZeroDivisionError: float division by zero');
    return [(q[0] * ey[1] - q[1] * ey[0]) / det, (ex[0] * q[1] - ex[1] * q[0]) / det];
  }
  function fromFrame(a, b, p) {
    var ex = [b[0] - a[0], b[1] - a[1]], ey = [-ex[1], ex[0]];
    return [a[0] + p[0] * ex[0] + p[1] * ey[0], a[1] + p[0] * ex[1] + p[1] * ey[1]];
  }
  var NAME = [[' ', '_space_'], ['-', '_minus_'], ['/', '_slash_'], ['+', '_plus_'], ['α', '_alpha_'], ['β', '_beta_'], ['γ', '_gamma_'],
    ['δ', '_delta_'], ['ε', '_epsilon_'], ['ζ', '_zeta_'], ['η', '_eta_'], ['θ', '_theta_'], ['ι', '_iota_'], ['κ', '_kappa_'], ['λ', '_lambda_'],
    ['μ', '_mu_'], ['ν', '_nu_'], ['ξ', '_xi_'], ['π', '_pi_'], ['ρ', '_rho_'], ['σ', '_sigma_'], ['τ', '_tau_'], ['φ', '_phi_'],
    ['χ', '_chi_'], ['ψ', '_psi_'], ['ω', '_omega_']];
  function plainName(s) { NAME.forEach(function (q) { s = s.split(q[1]).join(q[0]); }); return s; }

  // ---- cdrender ----
  var FONT = "'Dialog', 'Liberation Sans', Arial, sans-serif";
  var SYMBOL = { phosphorylated: 'P', acetylated: 'Ac', ubiquitinated: 'Ub', methylated: 'Me', hydroxylated: 'OH', glycosylated: 'G',
    myristoylated: 'My', palmytoylated: 'Pa', prenylated: 'Pr', sulfated: 'S', protonated: 'H', "don't care": '*', unknown: '?', empty: '' };
  var GATE = { AND: '&amp;', OR: '|', NOT: '!', UNKNOWN: '?' };
  var ROUND = ['SIMPLE_MOLECULE', 'ION', 'DRUG', 'UNKNOWN', 'DEGRADED'];
  var ROLE = { PROTEIN: 'protein', RECEPTOR: 'protein', ION_CHANNEL: 'protein', TRUNCATED: 'protein', COMPLEX: 'complex', SIMPLE_MOLECULE: 'metabolite',
    ION: 'metabolite', DRUG: 'metabolite', GENE: 'gene', RNA: 'gene', ANTISENSE_RNA: 'gene' };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var WIDTHS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778,
    722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
    278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  function width(s, size) {
    var t = 0;
    for (var ch of s) { var c = ch.codePointAt(0); t += c >= 32 && c < 127 ? WIDTHS[c - 32] : 556; }
    return t * size / 1000;
  }
  function colour(c, dflt) { return c ? ['#' + c.slice(2), parseInt(c.slice(0, 2), 16) / 255] : [dflt || '#000000', 1.0]; }
  function fmt(v) { return fixed(v, 2).replace(/0+$/, '').replace(/\.$/, ''); }
  function pts(p) { return p.map(function (q) { return fmt(q[0]) + ',' + fmt(q[1]); }).join(' '); }
  function editPoints(s) { return (s || '').split(/\s+/).filter(function (q) { return q; }).map(function (q) { return q.split(',').map(F); }); }
  function unit(dx, dy) { var L = hypot(dx, dy) || 1; return [dx / L, dy / L]; }
  function ellipse(x, y, w, h, n) {
    n = n || 48; var o = [];
    for (var i = 0; i < n; i++) o.push([x + w / 2 * (1 + Math.cos(2 * Math.PI * i / n)), y + h / 2 * (1 + Math.sin(2 * Math.PI * i / n))]);
    return o;
  }
  function octagon(x, y, w, h, c) { return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]; }
  function hexagon(x, y, w, h) { var c = h / 2; return [[x + c, y], [x + w - c, y], [x + w, y + h / 2], [x + w - c, y + h], [x + c, y + h], [x, y + h / 2]]; }
  function parallelogram(x, y, w, h, s) { return [[x + s, y], [x + w, y], [x + w - s, y + h], [x, y + h]]; }
  function outline(cls, b) {
    var x = b[0], y = b[1], w = b[2], h = b[3];
    if (cls === 'DEGRADED') return ellipse(x + w / 8, y + h / 8, w * 3 / 4, h * 3 / 4);
    if (ROUND.indexOf(cls) >= 0) return ellipse(x, y, w, h);
    if (cls === 'COMPLEX') return octagon(x, y, w, h, 5);
    if (cls === 'PHENOTYPE') return hexagon(x, y, w, h);
    if (cls === 'RNA') return parallelogram(x, y, w, h, h);
    if (cls === 'RECEPTOR') return [[x, y], [x + w / 2, y + h / 5], [x + w, y], [x + w, y + h * 4 / 5], [x + w / 2, y + h], [x, y + h * 4 / 5]];
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }
  function enter(shapes, Q, P) {   // cdrender.py's enter: the first state variable or unit of information on the way in
    var dx = P[0] - Q[0], dy = P[1] - Q[1], best = null;
    shapes.forEach(function (s) {
      var t;
      if (s[0] === 'e') {
        var ux = (Q[0] - s[1]) / s[3], uy = (Q[1] - s[2]) / s[4], vx = dx / s[3], vy = dy / s[4];
        var a = vx * vx + vy * vy, b = ux * vx + uy * vy, c = ux * ux + uy * uy - 1;
        if (a === 0 || c <= 0 || b * b - a * c < 0) return;
        t = (-b - Math.sqrt(b * b - a * c)) / a;
      } else {
        var lo = 0.0, hi = 1.0;
        [[Q[0], dx, s[1], s[1] + s[3]], [Q[1], dy, s[2], s[2] + s[4]]].forEach(function (z) {
          var q = z[0], d = z[1], mn = z[2], mx = z[3];
          if (d === 0) { if (q < mn || q > mx) { lo = 1.0; hi = 0.0; } return; }
          var t1 = (mn - q) / d, t2 = (mx - q) / d;
          lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
        });
        if (lo > hi || lo <= 0) return;
        t = lo;
      }
      if (t > 0 && t <= 1 && (best === null || t < best)) best = t;
    });
    return best === null ? P : [Q[0] + best * dx, Q[1] + best * dy];
  }
  function leave(poly, P, Q) {
    var best = null;
    for (var i = 0; i < poly.length; i++) {
      var A = poly[i], B = poly[(i + 1) % poly.length], dx = Q[0] - P[0], dy = Q[1] - P[1], ex = B[0] - A[0], ey = B[1] - A[1], d = dx * ey - dy * ex;
      if (Math.abs(d) < 1e-9) continue;
      var t = ((A[0] - P[0]) * ey - (A[1] - P[1]) * ex) / d, u = ((A[0] - P[0]) * dy - (A[1] - P[1]) * dx) / d;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t > best)) best = t;
    }
    return best === null ? P : [P[0] + best * (Q[0] - P[0]), P[1] + best * (Q[1] - P[1])];
  }
  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    var v = [x + r, y, x + w - r, r, r, x + w, y + r, y + h - r, r, r, x + w - r, y + h, x + r, r, r, x, y + h - r, y + r, r, r, x + r, y].map(fmt);
    return 'M' + v[0] + ' ' + v[1] + ' H' + v[2] + ' A' + v[3] + ' ' + v[4] + ' 0 0 1 ' + v[5] + ' ' + v[6] + ' V' + v[7] + ' A' + v[8] + ' ' + v[9] + ' 0 0 1 ' + v[10] + ' ' + v[11] +
      ' H' + v[12] + ' A' + v[13] + ' ' + v[14] + ' 0 0 1 ' + v[15] + ' ' + v[16] + ' V' + v[17] + ' A' + v[18] + ' ' + v[19] + ' 0 0 1 ' + v[20] + ' ' + v[21] + ' Z';
  }
  function onBorder(b, a) {
    var x = b[0], y = b[1], w = b[2], h = b[3], q = Math.PI / 4, fx, fy;
    a = pmod(a + q, 2 * Math.PI) - q;
    if (a < q) { fx = 0.5; fy = -0.5 * a / q; }
    else if (a < 3 * q) { fx = 0.5 * (Math.PI / 2 - a) / q; fy = -0.5; }
    else if (a < 5 * q) { fx = -0.5; fy = -0.5 * (Math.PI - a) / q; }
    else { fx = 0.5 * (a - 3 * Math.PI / 2) / q; fy = 0.5; }
    return [x + w / 2 + fx * w, y + h / 2 + fy * h];
  }
  function isdigit(s) { return /^[0-9]+$/.test(s); }

  function Drawing(src, opt) {
    opt = opt || {};
    this.CLASSES = !!opt.classes; this.GROUPS = !!opt.groups; this.log = opt.log || function () {};
    var doc = typeof src === 'string' ? new (opt.DOMParser || root.DOMParser)().parseFromString(src, 'application/xml') : src;
    var r = doc.documentElement, self = this;
    var model = find(r, 's:model'), ext = find(model, 's:annotation/cd:extension'), md = find(ext, 'cd:modelDisplay');
    this.W = F(get(md, 'sizeX')); this.H = F(get(md, 'sizeY'));
    this.out = []; this.halo = []; this.lines = [];
    var species = new Map();
    findall(model, 's:listOfSpecies/s:species').forEach(function (s) { species.set(get(s, 'id'), [get(s, 'name'), find(s, 's:annotation/cd:extension/cd:speciesIdentity')]); });
    findall(ext, 'cd:listOfIncludedSpecies/cd:species').forEach(function (s) { species.set(get(s, 'id'), [get(s, 'name'), find(s, 'cd:annotation/cd:speciesIdentity')]); });
    this.extra = new Map();   // extras(): per alias, what does not depend on its box
    this.residues = new Map();
    findall(ext, 'cd:listOfProteins/cd:protein').forEach(function (p) {
      findall(p, 'cd:listOfModificationResidues/cd:modificationResidue').forEach(function (m) {
        self.residues.set(get(p, 'id') + '\u0001' + get(m, 'id'), [F(get(m, 'angle', 0)), get(m, 'name'), get(p, 'id'), get(m, 'id')]);
      });
    });
    this.cnames = {};
    findall(model, 's:listOfCompartments/s:compartment').forEach(function (c) { self.cnames[get(c, 'id')] = get(c, 'name') || get(c, 'id'); });
    this.alias = new Map();
    findall(ext, 'cd:listOfComplexSpeciesAliases/cd:complexSpeciesAlias').concat(findall(ext, 'cd:listOfSpeciesAliases/cd:speciesAlias')).forEach(function (a) {
      if (!species.has(get(a, 'species'))) throw new Error('KeyError: ' + get(a, 'species'));
      var sp = species.get(get(a, 'species')), b = find(a, 'cd:bounds');
      self.alias.set(get(a, 'id'), [text(find(sp[1], 'cd:class')), ['x', 'y', 'w', 'h'].map(function (k) { return F(get(b, k)); }), a, sp[0], sp[1]]);
    });
    this.ext = ext; this.model = model;
    this.hitReactions = new Map(); this.cur = null;
  }
  var D = Drawing.prototype;
  D.al = function (i) { if (!this.alias.has(i)) throw new Error('KeyError: ' + i); return this.alias.get(i); };
  D.compartments = function () {
    var self = this, cs = findall(this.ext, 'cd:listOfCompartmentAliases/cd:compartmentAlias');
    var key = function (a) { var b = find(a, 'cd:bounds'); return -F(get(b, 'w')) * F(get(b, 'h')); };
    cs = cs.map(function (a) { return [a, key(a)]; }).sort(function (p, q) { return p[1] - q[1]; }).map(function (p) { return p[0]; });
    cs.forEach(function (a) {
      var b = find(a, 'cd:bounds');
      if (!b) return;
      if (self.GROUPS) self.out.push('<g data-n="' + escape(get(a, 'id')) + '">');
      var x = F(get(b, 'x')), y = F(get(b, 'y')), w = F(get(b, 'w')), h = F(get(b, 'h'));
      var dl = find(a, 'cd:doubleLine');
      var t = dl ? F(get(dl, 'thickness', 12)) : 12, ow = dl ? F(get(dl, 'outerWidth', 2)) : 2, iw = dl ? F(get(dl, 'innerWidth', 1)) : 1;
      var fill = colour(get(find(a, 'cd:paint'), 'color'))[0];
      var rgb = [1, 3, 5].map(function (k) { return parseInt(fill.slice(k, k + 2), 16); }), ink = Math.min.apply(null, rgb) > 230 ? '#000' : fill;
      if (text(find(a, 'cd:class')) === 'OVAL') {
        self.out.push('<ellipse cx="' + fmt(x + w / 2) + '" cy="' + fmt(y + h / 2) + '" rx="' + fmt(w / 2 - t / 2) + '" ry="' + fmt(h / 2 - t / 2) + '" fill="none" stroke="' + fill + '" stroke-opacity="0.25" stroke-width="' + fmt(t) + '"/>');
        self.out.push('<ellipse cx="' + fmt(x + w / 2) + '" cy="' + fmt(y + h / 2) + '" rx="' + fmt(w / 2) + '" ry="' + fmt(h / 2) + '" fill="none" stroke="' + ink + '" stroke-width="' + fmt(ow) + '"/>');
        self.out.push('<ellipse cx="' + fmt(x + w / 2) + '" cy="' + fmt(y + h / 2) + '" rx="' + fmt(w / 2 - t) + '" ry="' + fmt(h / 2 - t) + '" fill="none" stroke="' + ink + '" stroke-width="' + fmt(iw) + '"/>');
      } else {
        self.out.push('<path d="' + rrect(x, y, w, h, 20) + ' ' + rrect(x + t, y + t, w - 2 * t, h - 2 * t, 14) + '" fill="' + fill + '" fill-opacity="0.25" fill-rule="evenodd"/>');
        self.out.push('<rect x="' + fmt(x) + '" y="' + fmt(y) + '" width="' + fmt(w) + '" height="' + fmt(h) + '" rx="20" fill="none" stroke="' + ink + '" stroke-width="' + fmt(ow) + '"/>');
        self.out.push('<rect x="' + fmt(x + t) + '" y="' + fmt(y + t) + '" width="' + fmt(w - 2 * t) + '" height="' + fmt(h - 2 * t) + '" rx="14" fill="none" stroke="' + ink + '" stroke-width="' + fmt(iw) + '"/>');
      }
      var np = find(a, 'cd:namePoint');
      if (np) self.nameLines(has(self.cnames, get(a, 'compartment')) ? self.cnames[get(a, 'compartment')] : '').forEach(function (line, k) {
        self.text(line, F(get(np, 'x')), F(get(np, 'y')) + 15.5 + 14 * k, 12, 'start');
      });
      if (self.GROUPS) self.out.push('</g>');
    });
  };
  D.text = function (s, x, y, size, anchor, family, extra) {
    if (size === undefined) size = 12;
    this.out.push('<text x="' + fmt(x) + '" y="' + fmt(y) + '" font-family="' + (family || FONT) + '" font-size="' + fmt(size) + '" text-anchor="' + (anchor || 'middle') + '"' + (extra || '') + '>' + escape(s) + '</text>');
  };
  D.nameLines = function (name) { return plainName(name || '').split('_br_').join('\n').split('\n'); };
  D.species = function () {
    var self = this, depth = new Map();
    var d = function (i) {
      if (!depth.has(i)) { var p = get(self.alias.get(i)[2], 'complexSpeciesAlias'); depth.set(i, !p || !self.alias.has(p) ? 0 : d(p) + 1); }
      return depth.get(i);
    };
    var order = Array.from(this.alias.keys()).map(function (i) { return [i, self.alias.get(i)[0] !== 'COMPLEX' ? 1 : 0, d(i)]; })
      .sort(function (p, q) { return p[1] - q[1] || p[2] - q[2]; }).map(function (p) { return p[0]; });
    order.forEach(function (i) {
      if (self.GROUPS) self.out.push('<g data-n="' + escape(i) + '">');
      self.node(i);
      if (self.GROUPS) self.out.push('</g>');
    });
  };
  D.node = function (i) {
    var A = this.alias.get(i), cls = A[0], x = A[1][0], y = A[1][1], w = A[1][2], h = A[1][3], a = A[2], name = A[3], si = A[4], self = this;
    var hd = find(si, 'cd:state/cd:homodimer'), n = hd ? I(text(hd)) : 1;
    var paint = find(a, 'cd:usualView/cd:paint'), c = colour(paint ? get(paint, 'color') : 'ffffffff'), fill = c[0], alpha = c[1];
    var hyp = find(si, 'cd:hypothetical');
    var dash = hyp && text(hyp) === 'true' ? ' stroke-dasharray="5,3"' : '';
    var sl = find(a, 'cd:usualView/cd:singleLine');
    if (sl && get(sl, 'width') && F(get(sl, 'width')) !== 1) dash += ' stroke-width="' + fmt(F(get(sl, 'width'))) + '"';
    var act = find(a, 'cd:activity');
    this.open_ = cls === 'ION_CHANNEL' && !!act && text(act) === 'active';
    if (act && text(act) === 'active' && !this.open_) this.shape(cls, [x - 4, y - 4, w + 8, h + 8], 'none', 1.0, ' stroke-dasharray="4,2"');
    var s = 6 * (n - 1), fw = w - s, fh = h - s;
    for (var k = n - 1; k >= 0; k--) {
      this.shape(cls, [x + 6 * k, y + 6 * k, fw, fh], fill, alpha, dash);
      this.states(cls, [x + 6 * k, y + 6 * k, fw, fh], a, si, k === 0);
    }
    var fe = find(a, 'cd:font'), z = fe && get(fe, 'size') ? F(get(fe, 'size')) : 12.0;
    if (cls !== 'COMPLEX') {
      var lines = cls !== 'DEGRADED' ? this.nameLines(name) : [];
      var cy = y + fh / 2 - z * 7 / 12 * (lines.length - 1), mid = cls === 'ION_CHANNEL' ? x + (fw - 20) / 2 : x + fw / 2;
      lines.forEach(function (line, k2) { self.text(line, mid, cy + z / 3 + z * 7 / 6 * k2, z, 'middle', null, self.CLASSES ? ' class="t-' + (ROLE[cls] || 'white') + '"' : ''); });
    } else this.text(this.nameLines(name).join(' '), x + fw / 2, y + fh - z * 7 / 12, z, 'middle', null, this.CLASSES ? ' class="t-complex"' : '');
  };
  D.shape = function (cls, b, fill, alpha, dash) {
    var x = b[0], y = b[1], w = b[2], h = b[3], self = this;
    var style = 'fill="' + fill + '"' + (alpha < 1 ? ' fill-opacity="' + fmt(alpha) + '"' : '') + ' stroke="' + (cls === 'UNKNOWN' ? 'none' : '#000') + '"' + dash;
    if (this.CLASSES && fill !== 'none') style += ' class="c-' + (ROLE[cls] || 'white') + '"';
    if (cls === 'ION_CHANNEL' && fill !== 'none') {
      var gap = this.open_ ? 6 : 0;
      [[x, w - 20 - gap], [x + w - 20, 20]].forEach(function (q) { self.out.push('<rect x="' + fmt(q[0]) + '" y="' + fmt(y) + '" width="' + fmt(q[1]) + '" height="' + fmt(h) + '" rx="5" ' + style + '/>'); });
    } else if (cls === 'PROTEIN' || cls === 'ION_CHANNEL') this.out.push('<rect x="' + fmt(x) + '" y="' + fmt(y) + '" width="' + fmt(w) + '" height="' + fmt(h) + '" rx="' + (fill === 'none' ? '9' : '5') + '" ' + style + '/>');
    else if (cls === 'TRUNCATED') {
      var v = [x + 5, y, x + w, y + h * 0.6, x + w - 8, y + h * 0.4, y + h, x + 5, x, y + h - 5, y + 5, x + 5, y].map(fmt);
      this.out.push('<path d="M' + v[0] + ' ' + v[1] + ' H' + v[2] + ' V' + v[3] + ' L' + v[4] + ' ' + v[5] + ' V' + v[6] + ' H' + v[7] + ' A5 5 0 0 1 ' + v[8] + ' ' + v[9] + ' V' + v[10] + ' A5 5 0 0 1 ' + v[11] + ' ' + v[12] + ' Z" ' + style + '/>');
    } else if (cls === 'DRUG') {
      this.out.push('<rect x="' + fmt(x) + '" y="' + fmt(y) + '" width="' + fmt(w) + '" height="' + fmt(h) + '" rx="' + fmt(h / 2) + '" ' + style + '/>');
      this.out.push('<rect x="' + fmt(x + 4) + '" y="' + fmt(y + 4) + '" width="' + fmt(w - 8) + '" height="' + fmt(h - 8) + '" rx="' + fmt(h / 2 - 4) + '" fill="none" stroke="#000"/>');
    } else if (cls === 'GENE') this.out.push('<rect x="' + fmt(x) + '" y="' + fmt(y) + '" width="' + fmt(w) + '" height="' + fmt(h) + '" ' + style + '/>');
    else if (cls === 'DEGRADED') {
      var cx = x + w / 2, cy = y + h / 2;
      this.out.push('<circle cx="' + fmt(cx) + '" cy="' + fmt(cy) + '" r="' + fmt(w * 3 / 8) + '" ' + style + '/>');
      this.out.push('<line x1="' + fmt(cx + w / 5) + '" y1="' + fmt(cy - h / 2) + '" x2="' + fmt(cx - w / 5) + '" y2="' + fmt(cy + h / 2) + '" stroke="#000"/>');
    } else if (ROUND.indexOf(cls) >= 0) this.out.push('<ellipse cx="' + fmt(x + w / 2) + '" cy="' + fmt(y + h / 2) + '" rx="' + fmt(w / 2) + '" ry="' + fmt(h / 2) + '" ' + style + '/>');
    else this.out.push('<polygon points="' + pts(outline(cls, b)) + '" ' + style + '/>');
  };
  D.states = function (cls, b, a, si, front) {
    if (front === undefined) front = true;
    var x = b[0], y = b[1], w = b[2], h = b[3], self = this;
    var pref = find(si, 'cd:proteinReference'), mods = new Map();
    findall(si, 'cd:state/cd:listOfModifications/cd:modification').forEach(function (m) { mods.set(get(m, 'residue'), m); });
    var pid = pref ? text(pref) : null;
    var siteName = function (site, px, py) {
      if (!site || !front) return;
      var tw = width(site, 10), tx = px + (px <= x + 1 ? 11 : px >= x + w - 1 ? -11 : 0), ty = py + (py < y + h / 2 ? 11 : -11);
      tx = Math.min(Math.max(tx, x + 2 + tw / 2), x + w - 2 - tw / 2);
      self.text(site, tx, ty + 3.5, 10);
    };
    this.residues.forEach(function (r) {
      if (r[2] === pid && !mods.has(r[3])) {
        var p = onBorder(b, r[0]);
        self.out.push('<circle cx="' + fmt(p[0]) + '" cy="' + fmt(p[1]) + '" r="8" fill="#fff" stroke="#000"/>');
        siteName(r[1], p[0], p[1]);
      }
    });
    mods.forEach(function (m) {
      var r = self.residues.get(pid + '\u0001' + get(m, 'residue')) || [0.0, null], p = onBorder(b, r[0]);
      siteName(r[1], p[0], p[1]);
      self.out.push('<circle cx="' + fmt(p[0]) + '" cy="' + fmt(p[1]) + '" r="8" fill="#fff" stroke="#000"/>');
      var sym = has(SYMBOL, get(m, 'state')) ? SYMBOL[get(m, 'state')] : get(m, 'state');
      if (sym) self.text(sym, p[0], p[1] + 3.5, 9, 'middle', 'sans-serif');
    });
    findall(si, 'cd:state/cd:listOfStructuralStates/cd:structuralState').forEach(function (st) {
      var sa = find(a, 'cd:structuralState'), ang = sa ? F(get(sa, 'angle')) : -Math.PI / 2, p = onBorder(b, ang), label = get(st, 'structuralState');
      self.out.push('<ellipse cx="' + fmt(p[0]) + '" cy="' + fmt(p[1]) + '" rx="' + Math.trunc(width(label, 10) / 2 + 12) + '" ry="8" fill="#fff" stroke="#000"/>');
      self.text(label, p[0], p[1] + 3, 10);
    });
    var info = find(a, 'cd:info');
    if (front && info && get(info, 'state') === 'open') {
      var label = get(info, 'prefix') !== 'free input' ? ' ' + get(info, 'prefix') + ':' + get(info, 'label') + ' ' : ' ' + get(info, 'label') + ' ';
      if (Array.from(label).length > 11) label = Array.from(label).slice(0, 8).join('') + '... ';
      var ux = x + w / 2 - 35, uy = y - 8;
      this.out.push('<rect x="' + fmt(ux) + '" y="' + fmt(uy) + '" width="70" height="16" fill="#fff" stroke="#000"/>');
      this.text(label.trim(), x + w / 2, uy + 12, 12);  // centred in its box, as CellDesigner (AsthmaMap mast cell PDF)
    }
  };
  D.centre = function (i) { var b = this.box(i); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
  D.box = function (i) { return this.al(i)[1]; };
  D.front = function (i) {
    var A = this.al(i), b = A[1], si = A[4], hd = si ? find(si, 'cd:state/cd:homodimer') : null, t = hd ? text(hd) : null;
    var s = t && isdigit(t) ? 6 * (I(t) - 1) : 0;
    return [b[0], b[1], b[2] - s, b[3] - s];
  };
  D.end = function (e, i) {
    var b = e ? find(e, 'cd:linkAnchor') : null, bx = this.box(i), x = bx[0], y = bx[1], w = bx[2], h = bx[3];
    var side = b ? get(b, 'position') : null;
    if (!side || !has(ANCHOR, side)) return [[x + w / 2, y + h / 2], false];
    var f = this.front(i); x = f[0]; y = f[1]; w = f[2]; h = f[3];
    var cls = this.al(i)[0];
    if (cls === 'RNA') {
      var fx = ANCHOR[side][0], fy = ANCHOR[side][1];
      if (fy === 0 || fy === 1) return [[x + (fy === 0 ? h : 0) + fx * (w - h), y + fy * h], true];
      return [[fx === 0 ? x + h * (1 - fy) : x + w - h * fy, y + fy * h], true];
    }
    if (cls === 'DEGRADED') { x += w / 8; y += h / 8; w *= 3 / 4; h *= 3 / 4; }  // on its drawn circle, 3/4 of the box (AsthmaMap mast cell PDF: no gap)
    return [anchorPoint([x, y, w, h], side, ROUND.indexOf(cls) >= 0, cls === 'PHENOTYPE'), true];
  };
  D.clip = function (i, P, anchored, Q, shapeOnly) {   // the visual end (cdrender.py's clip)
    if (!anchored) P = leave(outline(this.al(i)[0], this.box(i)), P, Q);
    return shapeOnly ? P : enter(this.extras(i), Q, P);
  };
  D.ends = function (line, ra, pa) {   // cdrender.py's ends
    var L = line.length, A = line[0], B = line[L - 1], A1 = line[1], B1 = line[L - 2];
    line[0] = enter(this.extras(ra), A1, A);
    line[L - 1] = enter(this.extras(pa), B1, B);
  };
  D.extras = function (i) {   // cdrender.py's extras
    var A = this.al(i), x = A[1][0], y = A[1][1], w = A[1][2], h = A[1][3], self = this;
    if (!this.extra.has(i)) {
      var a = A[2], si = A[4], hd = find(si, 'cd:state/cd:homodimer'), pref = find(si, 'cd:proteinReference'), pid = pref ? text(pref) : null;
      var mods = findall(si, 'cd:state/cd:listOfModifications/cd:modification').map(function (m) { return get(m, 'residue'); });
      var angs = [];
      this.residues.forEach(function (r) { if (r[2] === pid && mods.indexOf(r[3]) < 0) angs.push(r[0]); });
      mods.forEach(function (r) { var q = self.residues.get(pid + '\u0001' + r); angs.push(q ? q[0] : 0.0); });
      var rxs = findall(si, 'cd:state/cd:listOfStructuralStates/cd:structuralState').map(function (st) { return Math.trunc(width(get(st, 'structuralState'), 10) / 2 + 12); });
      var sa = find(a, 'cd:structuralState'), info = find(a, 'cd:info');
      this.extra.set(i, [hd ? I(text(hd)) : 1, angs, rxs, sa ? F(get(sa, 'angle')) : -Math.PI / 2, !!info && get(info, 'state') === 'open']);
    }
    var E = this.extra.get(i), n = E[0], s6 = 6 * (n - 1), out = [];
    for (var k = n - 1; k >= 0; k--) {
      var b = [x + 6 * k, y + 6 * k, w - s6, h - s6];
      E[1].forEach(function (ang) { var p = onBorder(b, ang); out.push(['e', p[0], p[1], 8, 8]); });
      E[2].forEach(function (rx) { var p = onBorder(b, E[3]); out.push(['e', p[0], p[1], rx, 8]); });
      if (k === 0 && E[4]) out.push(['r', b[0] + b[2] / 2 - 35, b[1] - 8, 70, 16]);
    }
    return out;
  };
  D.open = function (e) { if (this.GROUPS) { this.lines.push('<g data-e="' + escape(e) + '">'); this.halo.push('<g data-e="' + escape(e) + '">'); } };
  D.close = function () { if (this.GROUPS) { this.lines.push('</g>'); this.halo.push('</g>'); } };
  D.path = function (p, col, wd, dash, startNode, endNode) {
    col = col || '#000'; if (wd === undefined) wd = 1.0; if (startNode === undefined) startNode = true; if (endNode === undefined) endNode = true;
    var h = p.slice(), u;
    if (h.length > 1) {
      if (startNode) { u = unit(h[1][0] - h[0][0], h[1][1] - h[0][1]); h[0] = [h[0][0] + 8 * u[0], h[0][1] + 8 * u[1]]; }
      if (endNode) { var L = h.length; u = unit(h[L - 1][0] - h[L - 2][0], h[L - 1][1] - h[L - 2][1]); h[L - 1] = [h[L - 1][0] - 8 * u[0], h[L - 1][1] - 8 * u[1]]; }
    }
    this.halo.push('<polyline points="' + pts(h) + '"/>');
    if (this.cur) this.hit(this.cur).lines.push(p.map(function (q) { return [round(q[0], 1), round(q[1], 1)]; }));
    this.lines.push('<polyline points="' + pts(p) + '" fill="none" stroke="' + col + '" stroke-width="' + fmt(wd) + '"' + (dash ? ' stroke-dasharray="' + (typeof dash === 'string' ? dash : '6,4') + '"' : '') + '/>');
  };
  D.hit = function (id) { if (!this.hitReactions.has(id)) this.hitReactions.set(id, { lines: [], at: null }); return this.hitReactions.get(id); };
  D.head = function (kind, T, u) {
    var n = [-u[1], u[0]], at = function (a, c) { return [T[0] - a * u[0] + c * n[0], T[1] - a * u[1] + c * n[1]]; }, L = this.lines;
    var line = function (p, q) { return '<line x1="' + fmt(p[0]) + '" y1="' + fmt(p[1]) + '" x2="' + fmt(q[0]) + '" y2="' + fmt(q[1]) + '" stroke="#000"/>'; };
    if (kind === 'production') { L.push('<polygon points="' + pts([T, at(15, 5), at(15, -5)]) + '" fill="#000"/>'); return at(14, 0); }
    if (kind === 'stimulation') { L.push('<polygon points="' + pts([T, at(8, 4), at(8, -4)]) + '" fill="#fff" stroke="#000"/>'); return at(8, 0); }
    if (kind === 'stimulation-reduced') {
      L.push('<polygon points="' + pts([T, at(15, 5), at(15, -5)]) + '" fill="#000"/>');
      L.push('<polygon points="' + pts([at(4.8, 0), at(12, 2), at(12, -2)]) + '" fill="#fff"/>');
      return at(15, 0);
    }
    if (kind === 'trigger') {
      L.push('<polygon points="' + pts([T, at(15, 5), at(15, -5)]) + '" fill="#fff" stroke="#000"/>');
      L.push(line(at(20, 4.5), at(20, -4.5)));
      return at(15, 0);
    }
    if (kind === 'catalysis') { var c = at(6, 0); L.push('<circle cx="' + fmt(c[0]) + '" cy="' + fmt(c[1]) + '" r="3" fill="#fff" stroke="#000"/>'); return at(9, 0); }   // 2 px of white before the outline (user, 2026-11-14; CellDesigner's 4.5 left 0.5 px, 1 px not enough), as yrender
    if (kind === 'inhibition') { L.push(line(at(3, 6), at(3, -6))); return at(3, 0); }
    if (kind === 'modulation') { L.push('<polygon points="' + pts([T, at(5, 4), at(10, 0), at(5, -4)]) + '" fill="#fff" stroke="#000"/>'); return at(10, 0); }
    return T;
  };
  D.reactions = function () {
    var self = this;
    findall(this.model, 's:listOfReactions/s:reaction').forEach(function (rx) {
      self.cur = get(rx, 'id');
      try { self.reaction(rx); }
      catch (e) { self.log(get(rx, 'id') + ': ' + e.message); }
    });
  };
  var REDUCED_HEAD = { PHYSICAL_STIMULATION: 'stimulation-reduced', REDUCED_PHYSICAL_STIMULATION: 'stimulation-reduced', NEGATIVE_INFLUENCE: 'inhibition',
    REDUCED_MODULATION: 'modulation', REDUCED_TRIGGER: 'trigger', POSITIVE_INFLUENCE: 'production', CATALYSIS: 'catalysis', INHIBITION: 'inhibition' };
  D.reaction = function (rx) {
    var x = find(rx, 's:annotation/cd:extension'), typ = text(find(x, 'cd:reactionType'));
    var br = findall(x, 'cd:baseReactants/cd:baseReactant'), bp = findall(x, 'cd:baseProducts/cd:baseProduct');
    var ln = find(x, 'cd:line'), col = colour(ln ? get(ln, 'color') : null)[0], wd = ln ? F(get(ln, 'width', 1)) : 1.0;
    var ep = find(x, 'cd:editPoints'), q = editPoints(ep ? text(ep) || '' : '');
    if (typ === 'BOOLEAN_LOGIC_GATE' && bp.length === 1) return this.gateReaction(x, bp[0], col, wd);
    var sz = [br.length, bp.length].sort();
    var branched = ['HETERODIMER_ASSOCIATION', 'DISSOCIATION', 'TRUNCATION'].indexOf(typ) >= 0 && sz[0] === 1 && sz[1] === 2;
    if (!branched && (br.length !== 1 || bp.length !== 1)) throw new Error(br.length + ' base reactants and ' + bp.length + ' base products, not drawn');
    if (branched) return this.branched(rx, x, typ, br, bp, ep, q, col, wd);
    var ra = get(br[0], 'alias'), pa = get(bp[0], 'alias');
    var EA = this.end(br[0], ra), A = EA[0], ancA = EA[1], EB = this.end(bp[0], pa), B = EB[0], ancB = EB[1];
    if (typ === 'BOOLEAN_LOGIC_GATE') throw new Error('a logic gate between entities, not drawn');
    var line = [A].concat(q.map(function (p) { return fromFrame(A, B, p); }), [B]), L = line.length;
    line[0] = this.clip(ra, A, ancA, line[1], true);   // the shape alone: the square's place (ends below)
    line[L - 1] = this.clip(pa, B, ancB, line[L - 2], true);
    var reduced = ['STATE_TRANSITION', 'KNOWN_TRANSITION_OMITTED', 'UNKNOWN_TRANSITION', 'TRANSPORT', 'TRANSCRIPTION', 'TRANSLATION',
      'HETERODIMER_ASSOCIATION', 'DISSOCIATION', 'TRUNCATION'].indexOf(typ) < 0;
    var dash = reduced && typ.indexOf('UNKNOWN') === 0;
    dash = { TRANSCRIPTION: '10,4,2,4,2,4', TRANSLATION: '10,3,2,3' }[typ] || dash;
    var u;
    if (reduced) {
      this.ends(line, ra, pa);
      var kind = REDUCED_HEAD[typ.split('UNKNOWN_').join('')] || 'production';
      u = unit(line[L - 1][0] - line[L - 2][0], line[L - 1][1] - line[L - 2][1]);
      this.open(this.cur + '|a');
      var stop = this.head(kind, line[L - 1], u);
      this.path(line.slice(0, -1).concat([stop]), col, wd, dash);
      this.close();
      return;
    }
    var cs = find(x, 'cd:connectScheme'), k = cs ? I(get(cs, 'rectangleIndex', 0)) : 0;
    k = Math.min(k, L - 2);
    var P = line[k], Q = line[k + 1], sq = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], fl = unit(Q[0] - P[0], Q[1] - P[1]);
    this.ends(line, ra, pa);
    var reversible = get(rx, 'reversible') !== 'false';
    u = unit(line[L - 1][0] - line[L - 2][0], line[L - 1][1] - line[L - 2][1]);
    if (this.GROUPS) {
      this.open(this.cur + '|a');
      var half = line.slice(0, k + 1).concat([sq]);
      if (reversible) half[0] = this.head('production', line[0], unit(line[0][0] - line[1][0], line[0][1] - line[1][1]));
      this.path(half, col, wd, dash, true, false);
      this.close();
      this.open(this.cur + '|b');
      half = [sq].concat(line.slice(k + 1));
      half[half.length - 1] = this.head('production', line[L - 1], u);
      this.path(half, col, wd, dash, false, true);
      this.close();
      this.linksAndModifiers(x, P, Q, sq, fl, col, wd, dash, typ);
      return;
    }
    var main = line.slice();
    main[L - 1] = this.head('production', line[L - 1], u);
    if (reversible) main[0] = this.head('production', line[0], unit(line[0][0] - line[1][0], line[0][1] - line[1][1]));
    this.path(main, col, wd, dash);
    this.linksAndModifiers(x, P, Q, sq, fl, col, wd, dash, typ);
  };
  D.branched = function (rx, x, typ, br, bp, ep, q, col, wd) {
    var self = this, ends = br.concat(bp);
    var C = ends.map(function (e) { return self.centre(get(e, 'alias')); });
    var ab = q.length ? q[q.length - 1] : [0.5, 0.5], a = ab[0], b = ab[1];
    var J = [C[0][0] + a * (C[1][0] - C[0][0]) + b * (C[2][0] - C[0][0]), C[0][1] + a * (C[1][1] - C[0][1]) + b * (C[2][1] - C[0][1])];
    var n = [0, 1, 2].map(function (k) { return ep ? I(get(ep, 'num' + k, 0)) : 0; });
    var armPts = [q.slice(0, n[0]), q.slice(n[0], n[0] + n[1]), q.slice(n[0] + n[1], n[0] + n[1] + n[2])];
    var assoc = typ === 'HETERODIMER_ASSOCIATION', reversible = get(rx, 'reversible') !== 'false', arms = [];
    ends.forEach(function (e, k) {
      var Ea = self.end(e, get(e, 'alias')), E = Ea[0], anc = Ea[1], inward = assoc ? k < 2 : k === 0;
      var out = [J].concat(armPts[k].map(function (p) { return fromFrame(J, E, p); }), [E]);
      var seq = inward ? out.slice().reverse() : out;
      if (inward) seq[0] = self.clip(get(e, 'alias'), E, anc, seq[1], true);   // the shape alone: the square's place, the visual end below
      else seq[seq.length - 1] = self.clip(get(e, 'alias'), E, anc, seq[seq.length - 2], true);
      arms.push([seq, inward, get(e, 'alias')]);
    });
    var seq = assoc ? arms[2][0] : arms[0][0];
    var k = Math.min(ep ? I(get(ep, 'tShapeIndex', 0)) : 0, seq.length - 2);
    var P = seq[k], Q = seq[k + 1], sq = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], fl = unit(Q[0] - P[0], Q[1] - P[1]);
    arms.forEach(function (arm) {   // the visual ends, once the square is placed
      var s = arm[0], L = s.length;
      if (arm[1]) s[0] = enter(self.extras(arm[2]), s[1], s[0]);
      else s[L - 1] = enter(self.extras(arm[2]), s[L - 2], s[L - 1]);
    });
    arms.forEach(function (arm) {
      var p = arm[0].slice(), inward = arm[1], headHere = !inward || reversible;
      if (inward && headHere) p[0] = self.head('production', p[0], unit(p[0][0] - p[1][0], p[0][1] - p[1][1]));
      if (!inward) { var L = p.length; p[L - 1] = self.head('production', p[L - 1], unit(p[L - 1][0] - p[L - 2][0], p[L - 1][1] - p[L - 2][1])); }
      self.path(p, col, wd, false, inward, !inward);
    });
    if (assoc) this.lines.push('<circle cx="' + fmt(J[0]) + '" cy="' + fmt(J[1]) + '" r="3.5" fill="#000"/>');
    else [5.5, 3].forEach(function (r) { self.lines.push('<circle cx="' + fmt(J[0]) + '" cy="' + fmt(J[1]) + '" r="' + fmt(r) + '" fill="#fff" stroke="#000"/>'); });
    this.linksAndModifiers(x, P, Q, sq, fl, col, wd, false, typ);
  };
  var GATE_HEAD = { CATALYSIS: 'catalysis', INHIBITION: 'inhibition', TRIGGER: 'trigger', MODULATION: 'modulation', PHYSICAL_STIMULATION: 'stimulation' };
  D.gateReaction = function (x, prod, col, wd) {
    var self = this, gm = findall(x, 'cd:listOfGateMember/cd:GateMember');
    var top = gm.filter(function (g) { return (get(g, 'type') || '').indexOf('BOOLEAN_LOGIC_GATE') === 0; });
    if (!top.length) throw new Error('a logic gate without its gate, not drawn');
    var gp = editPoints(get(top[0], 'editPoints')), G = gp[gp.length - 1], gbend = gp.slice(0, -1);
    if (!G) throw new Error('IndexError: list index out of range');
    gm.forEach(function (g) {
      if (top.indexOf(g) >= 0 || !self.alias.has(get(g, 'aliases'))) return;
      var i = get(g, 'aliases'), Mm = self.end(find(g, 'cd:linkTarget'), i), M = Mm[0];
      var seq = [M].concat(editPoints(get(g, 'editPoints')).map(function (p) { return fromFrame(M, G, p); }), [G]);
      seq[0] = self.clip(i, M, Mm[1], seq[1]);
      var L = seq.length, u = unit(seq[L - 1][0] - seq[L - 2][0], seq[L - 1][1] - seq[L - 2][1]);
      seq[L - 1] = [G[0] - 6.5 * u[0], G[1] - 6.5 * u[1]];
      self.path(seq, col, wd, false, true, false);
    });
    var pa = get(prod, 'alias'), Bb = this.end(prod, pa), B = Bb[0];
    var seq = [G].concat(gbend.map(function (p) { return fromFrame(G, B, p); }), [B]), L = seq.length;
    seq[L - 1] = B = this.clip(pa, B, Bb[1], seq[L - 2]);
    var u = unit(B[0] - seq[L - 2][0], B[1] - seq[L - 2][1]);
    var stop = this.head(GATE_HEAD[get(top[0], 'modificationType')] || 'stimulation', B, u);
    var u0 = unit(seq[1][0] - G[0], seq[1][1] - G[1]);
    this.path([[G[0] + 6 * u0[0], G[1] + 6 * u0[1]]].concat(seq.slice(1, -1), [stop]), col, wd, false, false, true);
    var t = get(top[0], 'type');
    this.lines.push('<circle cx="' + fmt(G[0]) + '" cy="' + fmt(G[1]) + '" r="6" fill="#fff" stroke="#000"/>');
    this.hit(this.cur).at = [round(G[0], 1), round(G[1], 1)];
    this.lines.push('<text x="' + fmt(G[0]) + '" y="' + fmt(G[1] + 4) + '" font-family="sans-serif" font-size="11" text-anchor="middle">' + (GATE[t.slice(t.lastIndexOf('_') + 1)] || '?') + '</text>');
  };
  var HEADS = { CATALYSIS: 'catalysis', UNKNOWN_CATALYSIS: 'catalysis', INHIBITION: 'inhibition', UNKNOWN_INHIBITION: 'inhibition',
    PHYSICAL_STIMULATION: 'stimulation', TRIGGER: 'trigger', MODULATION: 'modulation', TRANSCRIPTIONAL_ACTIVATION: 'stimulation',
    TRANSCRIPTIONAL_INHIBITION: 'inhibition', TRANSLATIONAL_ACTIVATION: 'stimulation', TRANSLATIONAL_INHIBITION: 'inhibition' };
  function target(m, sq, fl) {
    var tli = (get(m, 'targetLineIndex') || '-1,2').split(',')[1], k = I(tli), spot = has(SQUARE, k) ? SQUARE[k] : SQUARE[3];
    return [sq[0] + 5 * (spot[0] * fl[0] - spot[1] * fl[1]), sq[1] + 5 * (spot[0] * fl[1] + spot[1] * fl[0])];
  }
  D.linksAndModifiers = function (x, P, Q, sq, fl, col, wd, dash, typ) {
    var self = this;
    var joins = [0.375, 0.625].map(function (t) { return [P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]; });
    [['cd:listOfReactantLinks/cd:reactantLink', true], ['cd:listOfProductLinks/cd:productLink', false]].forEach(function (tg) {
      var into = tg[1];
      findall(x, tg[0]).forEach(function (l, n) {
        var i = get(l, 'alias');
        if (!self.alias.has(i)) return;
        self.open(self.cur + '|' + (into ? 'r' : 'p') + n);
        var Oo = self.end(l, i), O = Oo[0], J = joins[into ? 0 : 1];
        var bends = editPoints(get(l, 'editPoints') || findtext(l, 'cd:editPoints', '')).map(function (p) { return into ? fromFrame(O, J, p) : fromFrame(J, O, p); });
        var seq = [O].concat(into ? bends : bends.slice().reverse(), [J]);
        seq[0] = self.clip(i, O, Oo[1], seq[1]);
        var lc = find(l, 'cd:line'), lcol = lc ? colour(get(lc, 'color'))[0] : col;
        if (into) self.path(seq, lcol, wd, dash, true, false);
        else {
          seq = seq.reverse();
          var L = seq.length, w_ = unit(seq[L - 1][0] - seq[L - 2][0], seq[L - 1][1] - seq[L - 2][1]);
          var stop = self.head('production', seq[L - 1], w_);
          self.path(seq.slice(0, -1).concat([stop]), lcol, wd, dash, false, true);
        }
        self.close();
      });
    });
    var gateInputs = new Set(), mods = findall(x, 'cd:listOfModification/cd:modification');
    mods.forEach(function (m) {
      if ((get(m, 'type') || '').indexOf('BOOLEAN_LOGIC_GATE') === 0) get(m, 'aliases').split(',').forEach(function (a) { gateInputs.add(a + '\u0001' + get(m, 'modificationType')); });
    });
    var squares = [];
    mods.forEach(function (m, n) {
      var t = get(m, 'type'), a = get(m, 'aliases'), T = target(m, sq, fl), seq, u, stop;
      if (t.indexOf('BOOLEAN_LOGIC_GATE') === 0) {
        var gp = editPoints(get(m, 'editPoints')), G = gp[gp.length - 1], gbend = gp.slice(0, -1);
        if (!G) throw new Error('IndexError: list index out of range');
        a.split(',').forEach(function (i) {
          if (!self.alias.has(i)) return;
          var own = mods.find(function (o) { return get(o, 'aliases') === i && get(o, 'type') === get(m, 'modificationType'); }) || null;
          var Cc = self.end(own ? find(own, 'cd:linkTarget') : null, i), c = Cc[0];
          var s2 = [c].concat((own ? editPoints(get(own, 'editPoints')) : []).map(function (p) { return fromFrame(c, G, p); }), [G]);
          s2[0] = self.clip(i, c, Cc[1], s2[1]);
          var L2 = s2.length, u2 = unit(G[0] - s2[L2 - 2][0], G[1] - s2[L2 - 2][1]);
          s2[L2 - 1] = [G[0] - 6.5 * u2[0], G[1] - 6.5 * u2[1]];
          self.path(s2, col, wd, false, true, false);
        });
        seq = [G].concat(gbend.map(function (p) { return fromFrame(G, T, p); }), [T]);
        u = unit(seq[seq.length - 1][0] - seq[seq.length - 2][0], seq[seq.length - 1][1] - seq[seq.length - 2][1]);
        stop = self.head(HEADS[get(m, 'modificationType')] || 'stimulation', T, u);
        self.path(seq.slice(0, -1).concat([stop]), col, wd, false, false, false);
        squares.push('<circle cx="' + fmt(G[0]) + '" cy="' + fmt(G[1]) + '" r="6" fill="#fff" stroke="#000"/>');
        squares.push('<text x="' + fmt(G[0]) + '" y="' + fmt(G[1] + 4) + '" font-family="sans-serif" font-size="11" text-anchor="middle">' + (GATE[t.slice(t.lastIndexOf('_') + 1)] || '?') + '</text>');
        return;
      }
      if (gateInputs.has(a + '\u0001' + t) || !self.alias.has(a)) return;
      var Mm = self.end(find(m, 'cd:linkTarget'), a), M = Mm[0];
      self.open(self.cur + '|m' + n);
      seq = [M].concat(editPoints(get(m, 'editPoints')).map(function (p) { return fromFrame(M, T, p); }), [T]);
      seq[0] = self.clip(a, M, Mm[1], seq[1]);
      u = unit(seq[seq.length - 1][0] - seq[seq.length - 2][0], seq[seq.length - 1][1] - seq[seq.length - 2][1]);
      stop = self.head(HEADS[t] || 'stimulation', T, u);
      var mc = find(m, 'cd:line');
      self.path(seq.slice(0, -1).concat([stop]), mc ? colour(get(mc, 'color'))[0] : col, wd, t.indexOf('UNKNOWN') === 0, true, false);
      self.close();
    });
    var ang = Math.atan2(fl[1], fl[0]) * 180 / Math.PI;
    var glyph = '<rect x="-5" y="-5" width="10" height="10" fill="#fff" stroke="#000" transform="translate(' + fmt(sq[0]) + ',' + fmt(sq[1]) + ') rotate(' + fmt(ang) + ')"/>';
    var mark = { UNKNOWN_TRANSITION: '?', KNOWN_TRANSITION_OMITTED: '//' }[typ];
    if (mark) glyph += '<text x="' + fmt(sq[0]) + '" y="' + fmt(sq[1] + 3) + '" font-family="\'Times New Roman\', serif" font-weight="bold" font-size="10" text-anchor="middle">' + mark + '</text>';
    this.lines.push(this.GROUPS ? '<g data-n="' + escape(this.cur) + '|proc">' + glyph + '</g>' : glyph);
    if (this.cur) this.hit(this.cur).at = [round(sq[0], 1), round(sq[1], 1)];
    squares.forEach(function (s) { self.lines.push(s); });
  };
  D.texts = function () {
    var self = this;
    findall(this.ext, 'cd:listOfLayers/cd:layer').forEach(function (layer) {
      if (get(layer, 'visible') === 'false') return;
      findall(layer, 'cd:listOfTexts/cd:layerSpeciesAlias').forEach(function (t) {
        var b = find(t, 'cd:bounds'), fe = find(t, 'cd:font'), x = F(get(b, 'x')), y = F(get(b, 'y')), h = F(get(b, 'h'));
        var z = fe && get(fe, 'size') ? F(get(fe, 'size')) : 11.0;
        var lines = (text(find(t, 'cd:layerNotes')) || '').trim().split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && l.indexOf('=') < 0; });
        var top = y + h / 2 - z * 7 / 12 * (lines.length - 1) + z / 3;
        lines.forEach(function (line, k) { self.text(line, x, top + z * 7 / 6 * k, z, 'start'); });
      });
    });
  };
  D.svg = function () {
    this.compartments(); this.species(); this.texts(); this.reactions();
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + fmt(this.W) + '" height="' + fmt(this.H) + '" viewBox="0 0 ' + fmt(this.W) + ' ' + fmt(this.H) + '">\n' +
      '<rect width="100%" height="100%" fill="#fff"/>\n' + (this.GROUPS ? '<g transform="translate(0,0)">\n' : '') + this.out.join('\n') + '\n' +
      '<g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">\n' + this.halo.join('\n') + '\n</g>\n' + this.lines.join('\n') + '\n' + (this.GROUPS ? '</g>\n' : '') + '</svg>\n';
  };

  function render(src, opt) { return new Drawing(src, opt).svg(); }
  function renderHits(src, opt) {
    var d = new Drawing(src, opt), svg = d.svg(), aliases = [];
    d.alias.forEach(function (a, i) { aliases.push({ id: i, species: get(a[2], 'species'), 'class': a[0], box: a[1].map(function (v) { return round(v, 1); }) }); });
    var reactions = {}; d.hitReactions.forEach(function (v, k) { reactions[k] = v; });
    return [svg, { aliases: aliases, reactions: reactions }];
  }
  var api = { render: render, renderHits: renderHits, Drawing: Drawing, py: py, xml: xml, SQUARE: SQUARE, ANCHOR: ANCHOR, fromFrame: fromFrame, toFrame: toFrame,
    editPoints: editPoints, unit: unit, onBorder: onBorder, width: width, target: target, plainName: plainName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.cdrender = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {   // node cdrender.js map.xml out.svg
    var fs = require('fs'), DP = require('@xmldom/xmldom').DOMParser;
    fs.writeFileSync(process.argv[3], render(fs.readFileSync(process.argv[2], 'utf8'), { DOMParser: DP, log: function (s) { process.stderr.write(s + '\n'); } }));
  }
})(typeof window !== 'undefined' ? window : globalThis);
