// yrender in JavaScript (2026-11-13), the master since 2026-11-13 (user: JavaScript the master for the viewer's own build and the editor): the viewer's build (through
// renderers/render.js) and the editor draw with it. yrender.py beside it is its twin for the Python tools elsewhere (its
// copies in the workbench and the official site are taken from it): a change is made here and in yrender.py in the same
// commit, and tests/yrender-compare.js (the workflow Compare renderers) checks both give the same SVG on every map.
// Comments here are short: the rules and their reasons are in yrender.py, function by function, under the same names.
//   browser: yrender.render(text or XML document, { classes, roles, groups }) -> { svg, errors }
//   node:    node renderers/yrender/yrender.js map.graphml map.svg [--roles] [--classes]   (needs @xmldom/xmldom)
(function (root) {
  'use strict';
  var G = 'http://graphml.graphdrawing.org/xmlns', Y = 'http://www.yworks.com/xml/graphml';
  var MARGIN = 15, SBGN = 'com.yworks.sbgn.';
  var NODE_STYLES = new Set(['Macromolecule', 'SimpleChemical', 'Complex', 'Process', 'EmptySet', 'Operator', 'Phenotype', 'Submap',
    'NucleicAcidFeature', 'StateVariable', 'UnitOfInformation', 'UnspecifiedEntity', 'PerturbingAgent']);
  var SHAPES = new Set(['rectangle', 'roundrectangle']);
  var HUBS = new Set(['Process', 'Operator']), ANTENNA = 0.5, ANTENNA_MIN = 9, EQUIV = '\u2261';   // ports: yrender.py's header
  var STYLE_PROPS = new Set(['radius', 'radiusX', 'radiusY', 'mcount']);
  var ARROWS = new Set(['none', 'delta', 'white_delta', 'white_circle', 'white_delta_bar', 't_shape', 'white_diamond']);
  var AIR = { white_circle: 1, t_shape: 2 }, AIR_MAX = 16;   // px of white each head keeps off the outline: yrender.py's header
  var FONTS = {
    Dialog: [0.9668, 1.1777, "'Dialog', Arial, Helvetica, sans-serif"],
    Arial: [0.905, 1.1172, 'Arial, Helvetica, sans-serif'],
    Monospaced: [0.9282, 1.1641, 'monospace']
  };
  var FONT_STYLES = { plain: '', bold: ' font-weight="bold"', italic: ' font-style="italic"', bolditalic: ' font-weight="bold" font-style="italic"' };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  var errors = [], ROLES = false, CLASSES = false;

  // ---- numbers as Python writes them ----
  // '%.4f' % v: the exact value of the double rounded to 4 places, an exact half to even (toFixed rounds it up), then
  // the zeros and the point dropped, -0 as 0
  var buf = new DataView(new ArrayBuffer(8));
  function fixed4(v) {
    if (!isFinite(v)) return String(v);
    var neg = v < 0 || Object.is(v, -0), a = Math.abs(v);
    buf.setFloat64(0, a);
    var hi = buf.getUint32(0), lo = buf.getUint32(4), e = (hi >>> 20) & 0x7ff;
    var m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), ex;
    if (e === 0) ex = -1074; else { m |= 1n << 52n; ex = e - 1075; }
    // a = m * 2^ex; q = a * 10^4 as n / d
    var n = m * 10000n, d = 1n;
    if (ex >= 0) n <<= BigInt(ex); else d <<= BigInt(-ex);
    var q = n / d, r = n - q * d;
    if (r * 2n > d || (r * 2n === d && (q & 1n))) q += 1n;
    var s = q.toString();
    while (s.length < 5) s = '0' + s;
    var out = s.slice(0, -4) + '.' + s.slice(-4);
    return (neg && q !== 0n ? '-' : neg ? '-' : '') + out;
  }
  // toFixed(4) is the exact value correctly rounded too, except an exact half (it goes up): only a value next to a half
  // takes the exact way
  function fixed(v) {
    var q = Math.abs(v) * 10000, f = q - Math.floor(q);
    return Math.abs(f - 0.5) < 1e-6 ? fixed4(v) : v.toFixed(4);
  }
  function num(v) {
    var s = fixed(v).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }
  // math.dist and math.hypot of CPython 3.12 (vector_norm): the squares exact (fma there, Dekker's split here: the same exact error
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
  function dist(a, b) { return hypot(a[0] - b[0], a[1] - b[1]); }
  function pyFloat(s) {   // float(s) of Python for the numbers a GraphML holds
    if (s === null || s === undefined) throw new Error('TypeError: float() argument must be a string or a real number, not NoneType');
    var t = String(s).trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) && !/^[+-]?(inf|infinity|nan)$/i.test(t)) throw new Error('ValueError: could not convert string to float: ' + s);
    return /inf/i.test(t) ? (t[0] === '-' ? -Infinity : Infinity) : /nan/i.test(t) ? NaN : Number(t);
  }
  function esc(s) {   // html.escape(s), quote=True
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }
  // str.strip() of Python: its whitespace (JavaScript's \s without \ufeff, with \x1c-\x1f and \x85)
  var STRIP = /^[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;
  function pyStrip(s) { return s.replace(STRIP, ''); }

  // ---- the XML, as lxml's calls of yrender.py read it ----
  function get(el, a) { return el.hasAttribute(a) ? el.getAttribute(a) : null; }
  function kids(el, ns, name) {   // el.findall(ns + name): element children
    var out = [];
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.namespaceURI === ns && c.localName === name) out.push(c);
    return out;
  }
  function kid(el, ns, name) { return kids(el, ns, name)[0] || null; }
  function elems(el) { var out = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c); return out; }
  function iter(el, ns, names) {   // el.iter(...): itself and its descendants in document order
    var out = [], walk = function (e) {
      if (e.namespaceURI === ns && names.indexOf(e.localName) >= 0) out.push(e);
      for (var c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) walk(c);
    };
    walk(el); return out;
  }
  function itertext(el) {   // ''.join(el.itertext()): every text inside, comments and processing instructions left out
    var s = '';
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 || c.nodeType === 4) s += c.nodeValue;
      else if (c.nodeType === 1) s += itertext(c);
    }
    return s;
  }
  function leadText(el) {   // el.text: the text before its first child element (or comment)
    var s = '';
    for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 || c.nodeType === 4) s += c.nodeValue; else break; }
    return s;
  }
  function tagOf(el) { return el.namespaceURI === Y ? el.localName : null; }

  function role(tag, kind, fill) {
    fill = (fill || '').toUpperCase();
    if (tag === 'GroupNode') return 'compartment';
    if (tag === 'ShapeNode') return 'white';
    if (tag === 'GenericGroupNode') return kind === 'Compartment' || fill.indexOf('#EDEBE4') === 0 ? 'compartment' : 'complex';
    if (kind === 'Complex') return 'complex';
    if (kind === 'Macromolecule') return fill === '#E2ACA3' ? 'hlProtein' : 'protein';
    return { SimpleChemical: 'metabolite', NucleicAcidFeature: 'gene' }[kind] || 'white';
  }
  function refuse(where, what) { errors.push(where + ': ' + what); }
  function color(c) {
    c = c.replace(/^#+/, '');
    return ['#' + c.slice(0, 6), c.length === 8 ? parseInt(c.slice(6, 8), 16) / 255 : 1];
  }
  function paint(attr, c) {
    var r = color(c);
    return ' ' + attr + '="' + r[0] + '"' + (r[1] < 1 ? ' ' + attr + '-opacity="' + num(r[1]) + '"' : '');
  }
  function ink(attr, c) { return ROLES ? '' : paint(attr, c); }
  function area(c, rl, opaque) {
    if (opaque === undefined) opaque = true;
    if (!ROLES) return paint('fill', c) + (CLASSES ? ' class="c-' + rl + '"' : '');
    var a = color(c)[1];
    return ' class="c-' + rl + '"' + (a < 1 && !opaque ? ' fill-opacity="' + num(a) + '"' : '');
  }
  function white() { return ROLES ? area('#FFFFFF', 'white') : ' fill="white"' + (CLASSES ? ' class="c-white"' : ''); }

  // ---- outlines ----
  var K = 0.5523;
  function rect(x, y, w, h) { return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']]; }
  function roundRect(x, y, w, h, r, quad) {
    if (quad === undefined) quad = true;
    r = Math.min(r, w / 2, h / 2);
    var out = [['M', x, y + r]];
    [[x, y, x + r, y, x + w - r, y], [x + w, y, x + w, y + r, x + w, y + h - r],
     [x + w, y + h, x + w - r, y + h, x + r, y + h], [x, y + h, x, y + h - r, x, y + r]].forEach(function (q) {
      var cx = q[0], cy = q[1], ex = q[2], ey = q[3], last = out[out.length - 1], sx = last[last.length - 2], sy = last[last.length - 1];
      out.push(quad ? ['Q', cx, cy, ex, ey] : ['C', sx + (cx - sx) * K, sy + (cy - sy) * K, ex + (cx - ex) * K, ey + (cy - ey) * K, ex, ey]);
      out.push(['L', q[4], q[5]]);
    });
    return out.slice(0, -1).concat([['Z']]);
  }
  function ellipse(x, y, w, h) { return roundRect(x, y, w, h, Math.max(w, h), false); }
  function oval(x, y, w, h) {
    var a = w / 2, b = h / 2, cx = x + w / 2, cy = y + h / 2;
    return [['M', cx, y], ['C', cx + a * K, y, x + w, cy - b * K, x + w, cy], ['C', x + w, cy + b * K, cx + a * K, y + h, cx, y + h],
      ['C', cx - a * K, y + h, x, cy + b * K, x, cy], ['C', x, cy - b * K, cx - a * K, y, cx, y], ['Z']];
  }
  function pathOf(pts) { return [['M', pts[0][0], pts[0][1]]].concat(pts.slice(1).map(function (p) { return ['L', p[0], p[1]]; }), [['Z']]); }
  function octagon(x, y, w, h, rx, ry) {
    rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    return pathOf([[x + rx, y], [x + w - rx, y], [x + w, y + ry], [x + w, y + h - ry], [x + w - rx, y + h], [x + rx, y + h], [x, y + h - ry], [x, y + ry]]);
  }
  function nucleic(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h - r], ['Q', x + w, y + h, x + w - r, y + h], ['L', x + r, y + h], ['Q', x, y + h, x, y + h - r], ['Z']];
  }
  function hexagon(x, y, w, h, inward) {
    var i = h / 4;
    return pathOf(inward ? [[x, y], [x + w, y], [x + w - i, y + h / 2], [x + w, y + h], [x, y + h], [x + i, y + h / 2]]
      : [[x + i, y], [x + w - i, y], [x + w, y + h / 2], [x + w - i, y + h], [x + i, y + h], [x, y + h / 2]]);
  }
  function d(cmds) { return cmds.map(function (c) { return c[0] + c.slice(1).map(num).join(' '); }).join(' '); }
  function polygon(cmds, steps) {
    steps = steps || 8;
    var pts = [], cur = null, i, t, ts = [];
    for (i = 1; i <= steps; i++) ts.push(i / steps);
    cmds.forEach(function (c) {
      if (c[0] === 'M' || c[0] === 'L') { cur = [c[1], c[2]]; pts.push(cur); }
      else if (c[0] === 'Q') {
        var x0 = cur[0], y0 = cur[1], cx = c[1], cy = c[2], x = c[3], y = c[4];
        ts.forEach(function (t) { pts.push([Math.pow(1 - t, 2) * x0 + 2 * (1 - t) * t * cx + t * t * x, Math.pow(1 - t, 2) * y0 + 2 * (1 - t) * t * cy + t * t * y]); });
        cur = [x, y];
      } else if (c[0] === 'C') {
        var X0 = cur[0], Y0 = cur[1], ax = c[1], ay = c[2], bx = c[3], by = c[4], X = c[5], Yy = c[6];
        ts.forEach(function (t) {
          pts.push([Math.pow(1 - t, 3) * X0 + 3 * Math.pow(1 - t, 2) * t * ax + 3 * (1 - t) * t * t * bx + Math.pow(t, 3) * X,
                    Math.pow(1 - t, 3) * Y0 + 3 * Math.pow(1 - t, 2) * t * ay + 3 * (1 - t) * t * t * by + Math.pow(t, 3) * Yy]);
        });
        cur = [X, Yy];
      }
    });
    void t;
    return pts;
  }
  function inside(p, poly) {
    var x = p[0], y = p[1], n = poly.length, c = false;
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i - 1 + n) % n];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function clip(outer, port, polys, crossed) {   // crossed: any outline the segment crosses counts (yrender.py's clip)
    var px = outer[0], py = outer[1], qx = port[0], qy = port[1], best = null;
    polys.forEach(function (poly) {
      if (!crossed && !inside(port, poly)) return;
      var n = poly.length;
      for (var i = 0; i < n; i++) {
        var A = poly[(i - 1 + n) % n], B = poly[i], ax = A[0], ay = A[1], bx = B[0], by = B[1];
        var den = (qx - px) * (by - ay) - (qy - py) * (bx - ax);
        if (Math.abs(den) < 1e-12) continue;
        var t = ((ax - px) * (by - ay) - (ay - py) * (bx - ax)) / den, u = ((ax - px) * (qy - py) - (ay - py) * (qx - px)) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
      }
    });
    return best === null ? port : [px + (qx - px) * best, py + (qy - py) * best];
  }
  function within(p, polys) { return polys.some(function (poly) { return inside(p, poly); }); }
  function behind(pts, n) {   // yrender.py's behind: the leading points inside the node dropped; null when all are
    var k = 0;
    while (k < pts.length && within(pts[k], n.polys)) k++;
    if (k === pts.length) return null;
    if (k === 0) return [visualEnd(pts[1], pts[0], n)].concat(pts.slice(1));   // the end outside the shape: as visualEnd gives it
    return [visualEnd(pts[k], pts[k - 1], n)].concat(pts.slice(k));
  }

  // ---- reading the GraphML ----
  function styleProps(r) {   // insertion order as Python's dict
    var p = new Map();
    iter(r, Y, ['Property']).forEach(function (e) { p.set(get(e, 'name').replace(SBGN + 'style.', ''), get(e, 'value')); });
    return p;
  }
  function pget(p, k, dflt) { return p.has(k) ? p.get(k) : dflt; }
  function outline(kind, x, y, w, h, props) {
    if (kind === 'Macromolecule') return roundRect(x, y, w, h, pyFloat(pget(props, 'radius', 12)));
    if (kind === 'SimpleChemical' || kind === 'StateVariable') return roundRect(x, y, w, h, Math.min(w, h) / 2, false);
    if (kind === 'Complex') return octagon(x, y, w, h, pyFloat(pget(props, 'radiusX', 15)), pyFloat(pget(props, 'radiusY', 15)));
    if (kind === 'NucleicAcidFeature') return nucleic(x, y, w, h, pyFloat(pget(props, 'radius', 12)));
    if (kind === 'EmptySet' || kind === 'Operator') return ellipse(x, y, w, h);
    if (kind === 'UnspecifiedEntity') return oval(x, y, w, h);
    if (kind === 'Phenotype') return hexagon(x, y, w, h);
    if (kind === 'PerturbingAgent') return hexagon(x, y, w, h, true);
    if (kind === 'roundrectangle') return roundRect(x, y, w, h, 4, false);
    return rect(x, y, w, h);
  }
  function realizer(node) {
    var data = [];
    kids(node, G, 'data').forEach(function (dd) { elems(dd).forEach(function (c) { if (c.namespaceURI === Y) data.push(c); }); });
    for (var i = 0; i < data.length; i++) {
      var r = data[i], tag = r.localName;
      if (tag === 'ProxyAutoBoundsNode') {
        var rs = kid(r, Y, 'Realizers');
        return elems(rs)[parseInt(get(rs, 'active'), 10)];
      }
      if (tag === 'GenericNode' || tag === 'ShapeNode' || tag === 'GroupNode' || tag === 'GenericGroupNode') return r;
      refuse('node ' + get(node, 'id'), 'unknown node type ' + tag);
    }
    return null;
  }
  function kindOf(r, where) {
    var tag = r.localName, k;
    if (tag === 'GenericNode' || tag === 'GenericGroupNode') {
      k = (get(r, 'configuration') || '').split(SBGN).join('');
      if (!NODE_STYLES.has(k)) refuse(where, 'unknown node style ' + get(r, 'configuration'));
      return k;
    }
    k = get(kid(r, Y, 'Shape'), 'type');
    if (!SHAPES.has(k)) refuse(where, 'unknown shape ' + k);
    return k;
  }
  function checkFillBorder(r, where) {
    var f = kid(r, Y, 'Fill'), b = kid(r, Y, 'BorderStyle');
    if (f && get(f, 'color2')) refuse(where, 'gradient fill');
    if (b && get(b, 'type') !== 'line') refuse(where, 'border type ' + get(b, 'type'));
    var fill = !f || get(f, 'transparent') === 'true' || !get(f, 'color') ? null : get(f, 'color');
    var stroke = !b || get(b, 'hasColor') === 'false' ? null : [get(b, 'color'), pyFloat(get(b, 'width'))];
    return [fill, stroke];
  }
  function shapeSvg(cmds, fill, stroke, rl) {
    var s = '';
    if (fill) s += '<path d="' + d(cmds) + '"' + area(fill, rl || 'white') + ' stroke="none"/>';
    if (stroke) s += '<path d="' + d(cmds) + '" fill="none"' + ink('stroke', stroke[0]) + (stroke[1] !== 1 ? ' stroke-width="' + num(stroke[1]) + '"' : '') + '/>';
    return s;
  }
  function inset(lab, a) { var v = get(lab, a + 'Inset'); return pyFloat(v || 2); }
  function textLines(lab, x, y, w, h, where, rl, align) {
    rl = rl || 'page';
    var fam = get(lab, 'fontFamily'), size = pyFloat(get(lab, 'fontSize'));
    if (!has(FONTS, fam)) { refuse(where, 'unknown font ' + fam); return ''; }
    if (!has(FONT_STYLES, get(lab, 'fontStyle'))) { refuse(where, 'font style ' + get(lab, 'fontStyle')); return ''; }
    if (get(lab, 'underlinedText') === 'true' || pyFloat(get(lab, 'rotationAngle') || 0)) { refuse(where, 'underlined or rotated label'); return ''; }
    align = align || get(lab, 'alignment') || 'center';
    if (align !== 'center' && align !== 'left' && align !== 'right') { refuse(where, 'label alignment ' + align); return ''; }
    var lines = leadText(lab) ? itertext(lab).split('\n') : [];
    while (lines.length && !pyStrip(lines[lines.length - 1]) && lines.length > 1) lines.pop();
    if (!lines.length || !lines.join('')) return '';
    var F = FONTS[fam], asc = F[0] * size, lh = F[1] * size, family = F[2];
    var top = inset(lab, 'top'), bottom = inset(lab, 'bottom'), left = inset(lab, 'left'), right = inset(lab, 'right');
    var y0 = y + top + (h - top - bottom - lines.length * lh) / 2;
    var at = { center: [x + w / 2, 'middle'], left: [x + left, 'start'], right: [x + w - right, 'end'] }[align];
    var c = color(get(lab, 'textColor') || '#000000');
    var paintText = ROLES ? ' class="t-' + rl + '"' : ' fill="' + c[0] + '"' + (c[1] < 1 ? ' fill-opacity="' + num(c[1]) + '"' : '') + (CLASSES ? ' class="t-' + rl + '"' : '');
    return lines.map(function (line, i) {
      return '<text x="' + num(at[0]) + '" y="' + num(y0 + asc + i * lh) + '" text-anchor="' + at[1] + '" font-family="' + family + '" font-size="' + num(size) + '"' +
        FONT_STYLES[get(lab, 'fontStyle')] + paintText + ' stroke="none" xml:space="preserve">' + esc(line) + '</text>';
    }).join('');
  }
  function labelPlace(lab, x, y, w, h) {
    var mp = kid(lab, Y, 'ModelParameter'), p = mp ? kid(mp, Y, 'SmartNodeLabelModelParameter') : null;
    if (!p) {
      if (get(lab, 'x') === null) return null;
      var lw0 = pyFloat(get(lab, 'width')), lh0 = pyFloat(get(lab, 'height'));
      if (get(lab, 'modelName') !== 'internal') return [x + pyFloat(get(lab, 'x')), y + pyFloat(get(lab, 'y')), lw0, lh0];
      var pos = get(lab, 'modelPosition') || 'c', bd = pyFloat(get(lab, 'borderDistance') || 0);
      var hz = 'lr'.indexOf(pos[pos.length - 1]) >= 0 ? pos[pos.length - 1] : 'c', vt = 'tb'.indexOf(pos[0]) >= 0 ? pos[0] : 'c';
      return [x + { l: bd, r: w - lw0 - bd, c: (w - lw0) / 2 }[hz], y + { t: bd, b: h - lh0 - bd, c: (h - lh0) / 2 }[vt], lw0, lh0];
    }
    if (!has(FONTS, get(lab, 'fontFamily'))) return null;
    var f = function (a) { return pyFloat(get(p, a)); };
    var n = itertext(lab).replace(/\n+$/, '').split('\n').length;
    var top = inset(lab, 'top'), bottom = inset(lab, 'bottom');
    var lw = pyFloat(get(lab, 'width') || 0);
    var lh = get(lab, 'height') ? pyFloat(get(lab, 'height')) : n * FONTS[get(lab, 'fontFamily')][1] * pyFloat(get(lab, 'fontSize')) + top + bottom;
    if (!lw && f('labelRatioX')) return null;
    var cx = x + w / 2 + f('nodeRatioX') * w - f('labelRatioX') * lw + f('offsetX');
    var cy = y + h / 2 + f('nodeRatioY') * h - f('labelRatioY') * lh + f('offsetY');
    return [cx - lw / 2, cy - lh / 2, lw, lh];
  }
  function labelBox(lab, x, y, w, h) {
    var s = '';
    if (get(lab, 'hasBackgroundColor') !== 'false' && get(lab, 'backgroundColor'))
      s += '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + num(h) + '"' + area(get(lab, 'backgroundColor'), 'white', false) + ' stroke="none"/>';
    if (get(lab, 'hasLineColor') !== 'false' && get(lab, 'lineColor'))
      s += '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + num(h) + '" fill="none"' + ink('stroke', get(lab, 'lineColor')) + '/>';
    return s;
  }
  function visualEnd(outer, port, n) {   // the visual end on the node's shape outline, state variables included (yrender.py's visual_end)
    var q = clip(outer, port, n.polys);
    return n.aux.length ? clip(outer, q, n.aux, true) : q;
  }
  function iconSvg(res, lab, x, y, w, h, where, aux) {
    var gn = res ? iter(res, Y, ['GenericNode', 'ShapeNode'])[0] || null : null;
    if (!gn) { refuse(where, 'label icon is not a node'); return ''; }
    var k = kindOf(gn, where);
    if (k !== 'StateVariable' && k !== 'UnitOfInformation' && !SHAPES.has(k)) { refuse(where, 'label icon ' + k); return ''; }
    var g = kid(gn, Y, 'Geometry'), iw = pyFloat(get(g, 'width')), ih = pyFloat(get(g, 'height'));
    var ix = x + (w - iw) / 2, iy = y + (h - ih) / 2, fs = checkFillBorder(gn, where);
    var c = outline(k, ix, iy, iw, ih, new Map());
    if (aux && (k === 'StateVariable' || k === 'UnitOfInformation')) aux.push(polygon(c));
    var s = shapeSvg(c, fs[0], fs[1]);
    kids(gn, Y, 'NodeLabel').forEach(function (il) {
      if (get(il, 'visible') === 'false' || get(il, 'hasText') === 'false') return;
      s += textLines(il, ix, iy, iw, ih, where, 'white', 'center');
    });
    return s;
  }

  function YMap(doc, opt) {
    this.groups = !!(opt && opt.groups);   // each node and arc in a group of its own (data-n, data-e), for the editor
    this.root = doc.documentElement;
    var self = this;
    this.res = {};
    iter(this.root, Y, ['Resource']).forEach(function (r) { self.res[get(r, 'id')] = r; });
    var keys = {};
    kids(this.root, G, 'key').forEach(function (k) { keys[get(k, 'id')] = [get(k, 'for'), get(k, 'attr.name')]; });
    this.url = new Set(Object.keys(keys).filter(function (k) { return keys[k][1] === 'url'; }));
    this.cls = new Set(Object.keys(keys).filter(function (k) { return keys[k][1] === 'SBGN class'; }));
    this.nodes = {}; this.order = []; this.boxes = [];
    this.readGraph(kid(this.root, G, 'graph'), true, 'page');
    this.ports = {};
    this.hubPorts();
  }
  function polyline(e) {
    var pl = null;
    kids(e, G, 'data').forEach(function (dd) { elems(dd).forEach(function (c) { if (c.namespaceURI === Y && (c.localName === 'PolyLineEdge' || c.localName === 'QuadCurveEdge')) pl = c; }); });
    return pl;
  }
  YMap.prototype.mid = function (nid) { var g = this.nodes[nid].geo; return [g[0] + g[2] / 2, g[1] + g[3] / 2]; };
  YMap.prototype.ends = function (e, ar) {   // 'in', 'out' or null at the source and the target (yrender.py's ends)
    var hs = HUBS.has(this.nodes[get(e, 'source')].kind), ht = HUBS.has(this.nodes[get(e, 'target')].kind);
    var bare = get(ar, 'target') === 'none';
    return [hs ? (!ht && bare && get(ar, 'source') === 'none' && !this.nodes[get(e, 'source')].eq ? 'in' : 'out') : null, ht && bare ? 'in' : null];
  };
  YMap.prototype.hubPorts = function () {
    var self = this, ins = Object.create(null), outs = Object.create(null), given = Object.create(null), near = Object.create(null);
    var add = function (m, k, p) { (m[k] = m[k] || []).push(p); };
    this.order.forEach(function (item) {
      if (item[0] !== 'e') return;
      var e = item[1][0], pl = polyline(e), s = get(e, 'source'), t = get(e, 'target');
      if (!pl || !has(self.nodes, s) || !has(self.nodes, t)) return;
      var path = kid(pl, Y, 'Path');
      var bends = kids(path, Y, 'Point').map(function (q) { return [pyFloat(get(q, 'x')), pyFloat(get(q, 'y'))]; });
      var at = self.ends(e, kid(pl, Y, 'Arrows'));
      if (at[1] === 'in') { add(ins, t, bends.length ? bends[bends.length - 1] : self.mid(s)); self.given(given, t, 'in', path, 'tx', 'ty'); add(near, t + '\u0000in', s); }
      if (at[0]) { add(at[0] === 'in' ? ins : outs, s, bends.length ? bends[0] : self.mid(t)); self.given(given, s, at[0], path, 'sx', 'sy'); add(near, s + '\u0000' + at[0], t); }
    });
    var mean = function (q) {
      var sx = 0, sy = 0;
      q.forEach(function (p) { sx += p[0]; sy += p[1]; });
      return [sx / q.length, sy / q.length];
    };
    var spread = function (q, i) { return Math.max.apply(null, q.map(function (p) { return p[i]; })) - Math.min.apply(null, q.map(function (p) { return p[i]; })); };
    Object.keys(this.nodes).forEach(function (nid) {
      var n = self.nodes[nid];
      if (!HUBS.has(n.kind)) return;
      var x = n.geo[0], y = n.geo[1], w = n.geo[2], h = n.geo[3], cx = x + w / 2, cy = y + h / 2;
      var I = ins[nid] || [], O = outs[nid] || [], vx, vy;
      if (n.kind === 'Operator' && O.length) { var go = mean(O); vx = go[0] - cx; vy = go[1] - cy; }   // a gate faces what it controls
      else if (I.length) { var a = mean(I), b = O.length ? mean(O) : [cx, cy]; vx = b[0] - a[0]; vy = b[1] - a[1]; }
      else if (O.length > 1) { vx = spread(O, 0); vy = spread(O, 1); }
      else if (O.length) { vx = O[0][0] - cx; vy = O[0][1] - cy; }
      else { vx = 1; vy = 0; }
      var gin = given[nid + '\u0000in'], gout = given[nid + '\u0000out'], one, two;
      if (gin && gout && dist(gin, gout) < 2) gin = gout = undefined;   // both in one place: computed instead
      if (gin || gout) {   // the file's own ports, a missing one mirrored
        one = gin || [2 * cx - gout[0], 2 * cy - gout[1]];
        two = gout || [2 * cx - gin[0], 2 * cy - gin[1]];
      } else {
        var hz = Math.abs(vx) >= Math.abs(vy);
        var k = (hz ? vx : vy) >= 0 ? 1 : -1, side = hz ? w : h;
        var r = side / 2 + Math.max(ANTENNA * side, ANTENNA_MIN);
        one = hz ? [cx - k * r, cy] : [cx, cy - k * r]; two = hz ? [cx + k * r, cy] : [cx, cy + k * r];
      }
      self.ports[nid] = [one, two, nid in ins];
      var st = n.stroke, col = st ? st[0] : '#000000', wa = st && st[1] !== 1 ? ' stroke-width="' + num(st[1]) + '"' : '';
      var e1 = clip(one, [cx, cy], n.polys), e2 = clip(two, [cx, cy], n.polys);
      var nIn = near[nid + '\u0000in'] || [], nOut = near[nid + '\u0000out'] || [];
      var d1 = self.stickEnd(nid, e1, one, I.length ? nIn : nIn.concat(nOut)), d2 = self.stickEnd(nid, e2, two, nOut);   // reversible: either
      var ant = '<path d="M' + num(d1[0]) + ' ' + num(d1[1]) + ' L' + num(e1[0]) + ' ' + num(e1[1]) + ' M' + num(e2[0]) + ' ' + num(e2[1]) +
        ' L' + num(d2[0]) + ' ' + num(d2[1]) + '" fill="none"' + ink('stroke', col) + wa + '/>';
      n.svg = self.groups ? n.svg.replace(/^(<g data-n="[^"]*">)/, function (m) { return m + ant; }) : ant + n.svg;
      self.boxes.push([one[0], one[1], 0, 0], [two[0], two[1], 0, 0]);
    });
  };
  YMap.prototype.stickEnd = function (nid, base, tip, near) {   // yrender.py's stick_end
    var c = this.mid(nid), end = tip, self = this;
    near.forEach(function (m) {
      var N = self.nodes[m], P = N.polys;
      if (m !== nid && within(tip, P) && !within(c, P)) {
        var q = visualEnd(base, tip, N);
        if (dist(base, q) < dist(base, end)) end = q;
      }
    });
    return end;
  };
  YMap.prototype.given = function (given, nid, side, path, ax, ay) {   // yrender.py's given
    var g = this.nodes[nid].geo, ox = pyFloat(get(path, ax)), oy = pyFloat(get(path, ay));
    if (!(nid + '\u0000' + side in given) && (Math.abs(ox) > g[2] / 2 + 0.5 || Math.abs(oy) > g[3] / 2 + 0.5)) given[nid + '\u0000' + side] = [g[0] + g[2] / 2 + ox, g[1] + g[3] / 2 + oy];
  };
  YMap.prototype.onStick = function (nid, p) {   // yrender.py's on_stick
    var c = this.mid(nid), P = this.ports[nid];
    for (var i = 0; i < 2; i++) {
      var dx = P[i][0] - c[0], dy = P[i][1] - c[1];
      if (dx === 0 && dy === 0) continue;
      var t = Math.min(1, Math.max(0, ((p[0] - c[0]) * dx + (p[1] - c[1]) * dy) / (dx * dx + dy * dy)));
      if (dist(p, [c[0] + t * dx, c[1] + t * dy]) <= 1.5) return true;
    }
    return false;
  };
  YMap.prototype.link = function (el) {
    var dds = kids(el, G, 'data');
    for (var i = 0; i < dds.length; i++) {
      var t = leadText(dds[i]);
      if (this.url.has(get(dds[i], 'key')) && pyStrip(t)) return pyStrip(t);
    }
    return null;
  };
  YMap.prototype.sbgnClass = function (el) {
    var dds = kids(el, G, 'data');
    for (var i = 0; i < dds.length; i++) if (this.cls.has(get(dds[i], 'key'))) return pyStrip(leadText(dds[i]));
    return '';
  };
  YMap.prototype.readGraph = function (graph, top, parent) {
    var self = this;
    elems(graph).forEach(function (el) {
      if (el.namespaceURI !== G) return;
      if (el.localName === 'node') { self.readNode(el, parent); if (top) self.order.push(['block']); }
      else if (el.localName === 'edge') {
        self.order.push(['e', [el, parent]]);
        iter(el, Y, ['Point']).forEach(function (q) { self.boxes.push([pyFloat(get(q, 'x')), pyFloat(get(q, 'y')), 0, 0]); });
      }
    });
  };
  YMap.prototype.readNode = function (node, parent) {
    var nid = get(node, 'id'), where = 'node ' + nid, r = realizer(node), self = this;
    if (!r) return;
    var k = kindOf(r, where), g = kid(r, Y, 'Geometry');
    var x = pyFloat(get(g, 'x')), y = pyFloat(get(g, 'y')), w = pyFloat(get(g, 'width')), h = pyFloat(get(g, 'height'));
    var props = styleProps(r);
    props.forEach(function (v, p) { if (!STYLE_PROPS.has(p)) refuse(where, 'style option ' + p); });
    if (['1', '2'].indexOf(pget(props, 'mcount', '1')) < 0) refuse(where, 'multimer count ' + props.get('mcount'));
    var fs = checkFillBorder(r, where), fill = fs[0], stroke = fs[1];
    var rl = role(r.localName, k, fill);
    if (ROLES && !fill) fill = '#FFFFFF';
    var outlines = [outline(k, x, y, w, h, props)];
    if (props.get('mcount') === '2') { outlines.unshift(outline(k, x + 6, y + 6, w, h, props)); this.boxes.push([x + 6, y + 6, w, h]); }
    var s = outlines.map(function (c) { return shapeSvg(c, fill, stroke, rl); }).join('');
    if (k === 'EmptySet' && stroke) s += '<path d="M' + num(x) + ' ' + num(y + h) + ' L' + num(x + w) + ' ' + num(y) + '" fill="none"' + ink('stroke', stroke[0]) + '/>';
    var sc = k === 'Process' ? this.sbgnClass(node) : '';
    if (sc === 'association' || sc === 'dissociation') {   // SBGN's circles, the generic square kept hidden (yrender.py's header)
      var c = shapeSvg(ellipse(x, y, w, h), sc === 'dissociation' ? fill : null, stroke, rl);
      if (sc === 'association') c = '<path d="' + d(ellipse(x, y, w, h)) + '"' + ink('fill', stroke ? stroke[0] : '#000000') + ' stroke="none"/>' + c;
      else c += shapeSvg(ellipse(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6), null, stroke, rl);
      // the generic square white as every process (user, 2026-11-14: Newt fills an association dark grey)
      s = '<g class="sbgn-' + sc + '">' + c + '</g><g class="sbgn-generic" display="none">' + outlines.map(function (o) { return shapeSvg(o, '#FFFFFF', stroke, rl); }).join('') + '</g>';
    }
    var aux = [];   // the outlines of its state variables and units of information (visualEnd)
    kids(r, Y, 'NodeLabel').forEach(function (lab) {
      if (get(lab, 'visible') === 'false') return;
      var box = labelPlace(lab, x, y, w, h);
      if (!box) { if (get(lab, 'iconData') || pyStrip(itertext(lab))) refuse(where, 'label without a position'); return; }
      var ax = box[0], ay = box[1], lw = box[2], lh = box[3];
      self.boxes.push([ax, ay, lw, lh]);
      s += labelBox(lab, ax, ay, lw, lh);
      if (get(lab, 'iconData')) s += iconSvg(has(self.res, get(lab, 'iconData')) ? self.res[get(lab, 'iconData')] : null, lab, ax, ay, lw, lh, where, aux);
      if (get(lab, 'hasText') !== 'false') {
        var on = get(lab, 'hasBackgroundColor') !== 'false' && get(lab, 'backgroundColor') ? 'white'
          : fill && x <= ax + 2 && ax + 2 <= x + w && y <= ay + lh / 2 && ay + lh / 2 <= y + h ? rl : parent;
        s += textLines(lab, ax, ay, lw, lh, where, on);
      }
    });
    var url = this.link(node);
    if (url) s = '<a xlink:href="' + esc(url) + '" target="_blank">' + s + '</a>';
    if (this.groups) s = '<g data-n="' + esc(nid) + '">' + s + '</g>';
    var eq = k === 'Operator' && kids(r, Y, 'NodeLabel').some(function (lb) { return pyStrip(itertext(lb)) === EQUIV; });
    this.nodes[nid] = { geo: [x, y, w, h], polys: outlines.map(function (c) { return polygon(c); }), aux: aux, svg: s, kind: k, stroke: stroke, eq: eq };
    this.boxes.push([x, y, w, h]);
    this.order.push(['n', nid]);
    var sub = kid(node, G, 'graph');
    if (sub) {
      var st = kid(r, Y, 'State');
      if (st && get(st, 'closed') === 'true') refuse(where, 'closed group');
      else this.readGraph(sub, false, fill ? rl : parent);
    }
  };
  YMap.prototype.edgeSvg = function (e, parent) {
    var where = 'edge ' + get(e, 'id'), pl = null, self = this;
    kids(e, G, 'data').forEach(function (dd) {
      elems(dd).forEach(function (c) {
        if (c.namespaceURI !== Y) return;
        if (c.localName === 'PolyLineEdge' || c.localName === 'QuadCurveEdge') pl = c;
        else refuse(where, 'unknown edge type ' + c.localName);
      });
    });
    if (!pl) return '';
    var S = this.nodes[get(e, 'source')], T = this.nodes[get(e, 'target')];
    if (!S || !T) throw new Error('KeyError: ' + (S ? get(e, 'target') : get(e, 'source')));
    var p = kid(pl, Y, 'Path');
    var centre = function (n, dx, dy) { var g = n.geo; return [g[0] + g[2] / 2 + pyFloat(get(p, dx)), g[1] + g[3] / 2 + pyFloat(get(p, dy))]; };
    var pts = [centre(S, 'sx', 'sy')].concat(kids(p, Y, 'Point').map(function (q) { return [pyFloat(get(q, 'x')), pyFloat(get(q, 'y'))]; }), [centre(T, 'tx', 'ty')]);
    var sId = get(e, 'source'), tId = get(e, 'target');
    var ar = kid(pl, Y, 'Arrows'), at = this.ends(e, ar);
    var labelAt = clip(pts[1], pts[0], S.polys);   // the arc's labels keep the point yEd placed them from
    if (at[1] === 'in') {   // a consumption or a gate's input: ends on port one
      while (pts.length > 2 && this.onStick(tId, pts[pts.length - 2])) pts.splice(pts.length - 2, 1);
      pts[pts.length - 1] = this.ports[tId][0];
    }
    if (at[0]) {   // a consumption drawn from the process: port one; leaving: port two (nothing coming in: the nearer)
      while (pts.length > 2 && this.onStick(sId, pts[1])) pts.splice(1, 1);
      var P = this.ports[sId];
      pts[0] = at[0] === 'in' ? P[0] : P[2] || dist(P[1], pts[1]) <= dist(P[0], pts[1]) ? P[1] : P[0];
    }
    var b, g;   // behind its own nodes, or along the stick from a port inside the other node (yrender.py's edge_svg)
    if (!at[0]) {
      b = behind(pts, S);
      if (b !== null) pts = b;
      else if (at[1] === 'in' && !within(this.mid(tId), S.polys)) { g = visualEnd(pts[pts.length - 1], this.mid(tId), T); pts = [visualEnd(g, pts[pts.length - 1], S), g]; }
      else pts[0] = visualEnd(pts[1], pts[0], S);
    }
    if (at[1] !== 'in') {
      b = behind(pts.slice().reverse(), T);
      if (b !== null) pts = b.reverse();
      else if (at[0] && !within(this.mid(sId), T.polys)) { g = visualEnd(pts[0], this.mid(sId), S); pts = [g, visualEnd(g, pts[0], T)]; }
      else pts[pts.length - 1] = visualEnd(pts[pts.length - 2], pts[pts.length - 1], T);
    }
    var ls = kid(pl, Y, 'LineStyle');
    if (get(ls, 'type') !== 'line' && get(ls, 'type') !== 'dashed') refuse(where, 'line type ' + get(ls, 'type'));
    var col = get(ls, 'color'), width = pyFloat(get(ls, 'width'));
    var dash = get(ls, 'type') === 'dashed' ? ' stroke-dasharray="' + num(6 * width) + ' ' + num(2 * width) + '"' : '';
    var heads = '', line = pts.slice(), orig = pts.slice();
    [['target', get(ar, 'target')], ['source', get(ar, 'source')]].forEach(function (q) {
      var end = q[0], kind = q[1];
      if (!ARROWS.has(kind)) { refuse(where, 'unknown arrow ' + kind); return; }
      if (kind === 'none') return;
      var i = end === 'target' ? pts.length - 1 : 0, j = end === 'target' ? pts.length - 2 : 1;
      if (has(AIR, kind) && !(end === 'target' ? at[1] === 'in' : at[0])) {   // cut at the outline, or a port on it: moved off
        var N = end === 'target' ? T : S, raw = end === 'target' ? centre(T, 'tx', 'ty') : centre(S, 'sx', 'sy');
        var both = pts.length === 2 && get(ar, end === 'target' ? 'source' : 'target') !== 'none';   // the other head keeps its half
        if (dist(pts[i], raw) > 0 || clearance(null, raw, null, N.polys.concat(N.aux), 0) < 1) pts[i] = air(kind, pts[i], orig[j], N, width, both);
      }
      var a = arrow(kind, pts[i], pts[j], col, width);
      heads += a[0];
      var tx = pts[i][0], ty = pts[i][1], px = pts[j][0], py = pts[j][1], L = dist(pts[i], pts[j]);
      if (L > 0) line[i] = [tx + (px - tx) * Math.min(a[1], L) / L, ty + (py - ty) * Math.min(a[1], L) / L];   // never past the other end
    });
    var bs = kid(pl, Y, 'BendStyle');
    var smooth = pl.localName === 'QuadCurveEdge' || (bs !== null && get(bs, 'smoothed') === 'true');
    var dd = 'M' + num(line[0][0]) + ' ' + num(line[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var b = pts[i];
      if (smooth) {
        var a = pts[i - 1], c = pts[i + 1], la = dist(a, b), lc = dist(b, c);
        if (la > 0 && lc > 0) {
          var da = Math.min(10, la / 2), dc = Math.min(10, lc / 2);
          var p1 = [b[0] + (a[0] - b[0]) * da / la, b[1] + (a[1] - b[1]) * da / la], p2 = [b[0] + (c[0] - b[0]) * dc / lc, b[1] + (c[1] - b[1]) * dc / lc];
          dd += ' L' + num(p1[0]) + ' ' + num(p1[1]) + ' Q' + num(b[0]) + ' ' + num(b[1]) + ' ' + num(p2[0]) + ' ' + num(p2[1]);
          continue;
        }
      }
      dd += ' L' + num(b[0]) + ' ' + num(b[1]);
    }
    dd += ' L' + num(line[line.length - 1][0]) + ' ' + num(line[line.length - 1][1]);
    var wa = width !== 1 ? ' stroke-width="' + num(width) + '"' : '';
    var s = '<path d="' + dd + '" fill="none"' + ink('stroke', col) + wa + dash + '/>' + heads;
    kids(pl, Y, 'EdgeLabel').forEach(function (lab) {
      if (get(lab, 'visible') === 'false' || !pyStrip(leadText(lab))) return;
      s += self.edgeLabel(lab, labelAt, where, parent);
    });
    var url = this.link(e);
    s = url ? '<a xlink:href="' + esc(url) + '" target="_blank">' + s + '</a>' : s;
    return s && this.groups ? '<g data-e="' + esc(get(e, 'id') || '') + '">' + s + '</g>' : s;
  };
  YMap.prototype.edgeLabel = function (lab, start, where, parent) {
    var w = pyFloat(get(lab, 'width')), h = pyFloat(get(lab, 'height')), m;
    var on = get(lab, 'hasBackgroundColor') !== 'false' && get(lab, 'backgroundColor') ? 'white' : parent;
    var inner = labelBox(lab, 0, 0, w, h) + textLines(lab, 0, 0, w, h, where, on);
    if (get(lab, 'anchorX') !== null) {
      var ux = pyFloat(get(lab, 'upX')), uy = pyFloat(get(lab, 'upY'));
      var ax = start[0] + pyFloat(get(lab, 'anchorX')), ay = start[1] + pyFloat(get(lab, 'anchorY'));
      if (get(lab, 'configuration') === 'AutoFlippingLabel' && uy > 0) {
        var nax = ax - w * uy + h * ux, nay = ay + w * ux + h * uy; ax = nax; ay = nay; ux = -ux; uy = -uy;
      }
      var tlx = ax + h * ux, tly = ay + h * uy;
      m = 'matrix(' + num(-uy) + ',' + num(ux) + ',' + num(-ux) + ',' + num(-uy) + ',' + num(tlx) + ',' + num(tly) + ')';
    } else m = 'translate(' + num(start[0] + pyFloat(get(lab, 'x'))) + ',' + num(start[1] + pyFloat(get(lab, 'y'))) + ')';
    return '<g transform="' + m + '">' + inner + '</g>';
  };
  YMap.prototype.svg = function () {
    var xs = this.boxes, self = this;
    if (!xs.length) throw new Error('ValueError: min() arg is an empty sequence');
    var mn = function (f) { return xs.reduce(function (a, g) { return Math.min(a, f(g)); }, Infinity); };
    var mx = function (f) { return xs.reduce(function (a, g) { return Math.max(a, f(g)); }, -Infinity); };
    var x0 = Math.floor(mn(function (g) { return g[0]; })) - MARGIN, y0 = Math.floor(mn(function (g) { return g[1]; })) - MARGIN;
    var x1 = Math.ceil(mx(function (g) { return g[0] + g[2]; })) + MARGIN, y1 = Math.ceil(mx(function (g) { return g[1] + g[3]; })) + MARGIN;
    var W = x1 - x0, H = y1 - y0, body = [], pending = [], painted = new Set();
    this.order.forEach(function (item) {
      if (item[0] === 'n') { body.push(self.nodes[item[1]].svg); painted.add(item[1]); }
      else if (item[0] === 'e') pending.push(item[1]);
      else pending.slice().forEach(function (e) {
        if (painted.has(get(e[0], 'source')) && painted.has(get(e[0], 'target'))) { body.push(self.edgeSvg(e[0], e[1])); pending.splice(pending.indexOf(e), 1); }
      });
    });
    pending.forEach(function (e) { body.push(self.edgeSvg(e[0], e[1])); });
    var int = function (v) { return String(v === 0 ? 0 : v); };
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + int(W) + '" height="' + int(H) +
      '" viewBox="0 0 ' + int(W) + ' ' + int(H) + '" stroke-linecap="butt" stroke-miterlimit="10">\n<g transform="translate(' + int(-x0) + ',' + int(-y0) + ')">\n' +
      body.filter(function (b) { return b; }).join('\n') + '\n</g>\n</svg>\n';
  };
  function segDist(p, a, b) {   // from a point to a segment
    var dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy, t = q > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q : 0;
    t = Math.max(0, Math.min(1, t));
    return dist(p, [a[0] + t * dx, a[1] + t * dy]);
  }
  function crosses(a, b, c, d) {   // two segments meet
    var o = function (p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); };
    return o(a, b, c) * o(a, b, d) <= 0 && o(c, d, a) * o(c, d, b) <= 0;
  }
  // the least distance from a head at tip (kind null: the point tip itself) to the outline's line; a bar across it 0
  function clearance(kind, tip, prev, polys, ink) {
    var best = Infinity, c, b1, b2;
    if (kind) {
      var L = dist(tip, prev), ux = (tip[0] - prev[0]) / L, uy = (tip[1] - prev[1]) / L;
      c = [tip[0] - ux * 4, tip[1] - uy * 4]; b1 = [tip[0] - uy * 5, tip[1] + ux * 5]; b2 = [tip[0] + uy * 5, tip[1] - ux * 5];
    }
    polys.forEach(function (poly) {
      for (var i = 0; i < poly.length; i++) {
        var A = poly[(i - 1 + poly.length) % poly.length], B = poly[i], d;
        if (!kind) d = segDist(tip, A, B);
        else if (kind === 'white_circle') d = segDist(c, A, B) - 4;
        else d = crosses(b1, b2, A, B) ? 0 : Math.min(segDist(b1, A, B), segDist(b2, A, B), segDist(A, b1, b2), segDist(B, b1, b2));
        best = Math.min(best, d - ink);
      }
    });
    return best;
  }
  // the head moved back along its line until AIR[kind] px of white part its ink from the outline's (the node's line width, the
  // circle's 1 px, the bar's the arc's), at most AIR_MAX and never into the line's other point (or the other head's half)
  function air(kind, tip, prev, n, width, both) {
    var L = dist(tip, prev), room = both ? L / 2 - 8 : L - 8;
    if (!(L > 0) || room <= 0) return tip;
    var ink = (n.stroke ? n.stroke[1] : 1) / 2 + (kind === 'white_circle' ? 0.5 : width / 2);
    var at = function (d) { return [tip[0] + (prev[0] - tip[0]) * d / L, tip[1] + (prev[1] - tip[1]) * d / L]; };
    for (var d = 1; d < room && d <= AIR_MAX; d += 0.5) if (clearance(kind, at(d), prev, n.polys.concat(n.aux), ink) >= AIR[kind]) return at(d);
    return at(Math.min(room, AIR_MAX));
  }
  function arrow(kind, tip, prev, col, width) {
    var L = dist(tip, prev) || 1, ux = (tip[0] - prev[0]) / L, uy = (tip[1] - prev[1]) / L, nx = -uy, ny = ux;
    var at = function (back, side) { return [tip[0] - ux * back + nx * side, tip[1] - uy * back + ny * side]; };
    var poly = function (pts, fill) {
      var dd = 'M' + pts.map(function (q) { return num(q[0]) + ' ' + num(q[1]); }).join(' L') + ' Z';
      return fill === 'line' ? '<path d="' + dd + '"' + ink('fill', col) + ' stroke="none"/>' : '<path d="' + dd + '"' + white() + ink('stroke', col) + '/>';
    };
    var bar = function (back, half) {
      var a = at(back, -half), b = at(back, half);
      return '<path d="M' + num(a[0]) + ' ' + num(a[1]) + ' L' + num(b[0]) + ' ' + num(b[1]) + '" fill="none"' + ink('stroke', col) +
        (width !== 1 ? ' stroke-width="' + num(width) + '"' : '') + ' stroke-linecap="square"/>';
    };
    if (kind === 'delta') return [poly([tip, at(12, 6), at(12, -6)], 'line'), 11];
    if (kind === 'white_delta') return [poly([tip, at(16, 6), at(16, -6)], 'white'), 15];
    if (kind === 'white_circle') { var c = at(4, 0); return ['<circle cx="' + num(c[0]) + '" cy="' + num(c[1]) + '" r="4"' + white() + ink('stroke', col) + '/>', 8]; }
    if (kind === 'white_diamond') return [poly([tip, at(8, 6), at(16, 0), at(8, -6)], 'white'), 15];
    if (kind === 'white_delta_bar') return [poly([tip, at(16, 6), at(16, -6)], 'white') + bar(21, 8), 21];
    return [bar(0, 5), 0];
  }

  // the drawing of a GraphML (its text, or a parsed document): { svg, errors, ports }; nothing thrown for what it cannot draw
  function render(src, opt) {
    opt = opt || {};
    errors = []; ROLES = !!opt.roles; CLASSES = !!opt.classes;
    var doc = typeof src === 'string' ? new (root.DOMParser || opt.DOMParser)().parseFromString(src, 'application/xml') : src;
    var m = new YMap(doc, opt), svg = m.svg();
    return { svg: svg, errors: errors.slice(), ports: m.ports };   // ports: each process's and gate's two, for the editor (JavaScript only)
  }
  var api = { render: render, num: num, dist: dist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.yrender = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {   // node yrender.js map.graphml map.svg [--roles] [--classes]
    var fs = require('fs'), args = process.argv.slice(2).filter(function (a) { return a.slice(0, 2) !== '--'; });
    var DP = require('@xmldom/xmldom').DOMParser;
    var r = render(fs.readFileSync(args[0], 'utf8'), { roles: process.argv.indexOf('--roles') >= 0, classes: process.argv.indexOf('--classes') >= 0, DOMParser: DP });
    if (r.errors.length) { console.error(args[0] + ': cannot draw, nothing written\n  ' + r.errors.join('\n  ')); process.exit(1); }
    fs.writeFileSync(args[1], r.svg);
  }
})(typeof window !== 'undefined' ? window : globalThis);
