// sbgnml_read: an SBGN-ML file (any tool's: Newt and its .nwt, the SBGN website, libsbgn 0.1 to 0.3, MINERVA) read into
// the GraphML the editor edits it as, in the browser and under Node, with no other program.
// A copy, in JavaScript, of the converter's sbgnml.read followed by graphml.write (mapconv/sbgnml.py, graphml.py and what
// they use from layout.py, annotation.py, style.py; master: the converter's repository, VERSION below): the same
// GraphML byte for byte, as Python's lxml prints it. The converter stays the master: a change to how it reads SBGN-ML
// or writes GraphML is made there first and copied here; tests/sbgnml-read.js compares the two on every SBGN-ML file
// of the site's data and fails when they differ.
//   graphml(sbgnText, opt) -> { text: the GraphML, messages: [[kind, text], ...] }   opt.DOMParser under Node
// The yEd template (mapconv/yed.graphml) is kept below as TEMPLATE.
(function (root) {
  'use strict';
  var VERSION = '2651cb9';   // the converter's commit this copy was taken from
  var NS = 'http://sbgn.org/libsbgn/0.3', RENDER = 'http://www.sbml.org/sbml/level3/version1/render/version1';
  var OLD_RENDER = 'http://projects.eml.org/bcb/sbml/render';
  var RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  var GNS = 'http://graphml.graphdrawing.org/xmlns', YNS = 'http://www.yworks.com/xml/graphml', YED = 'http://www.yworks.com/xml/yed/3';
  var EQUIV = '\u2261', DELAY = '\u03c4';
  var CLASS = { Macromolecule: 'macromolecule', SimpleChemical: 'simple chemical', NucleicAcidFeature: 'nucleic acid feature',
    UnspecifiedEntity: 'unspecified entity', Complex: 'complex', Phenotype: 'phenotype', SourceAndSink: 'source and sink',
    EmptySet: 'source and sink', Submap: 'submap', Compartment: 'compartment', Process: 'process', OmittedProcess: 'omitted process',
    UncertainProcess: 'uncertain process', Tag: 'tag' };
  var PROCESSES = ['Process', 'OmittedProcess', 'UncertainProcess'];
  var OPERATORS = { and: 'AND', or: 'OR', not: 'NOT', equivalence: EQUIV, delay: DELAY };
  var DB = { 'obo.chebi': 'CHEBI', hgnc: 'hgnc', 'hgnc.symbol': 'hgnc.symbol', uniprot: 'uniprot', pubmed: 'pubmed', doi: 'doi', reactome: 'reactome' };
  var URN = {}; Object.keys(DB).forEach(function (k) { URN[DB[k]] = k; });
  var KIND = {}; Object.keys(CLASS).forEach(function (k) { if (k !== 'SourceAndSink') KIND[CLASS[k]] = k; });
  KIND.association = 'Process'; KIND.dissociation = 'Process'; KIND['perturbing agent'] = 'Phenotype'; KIND.perturbation = 'Phenotype';
  var DRAWN_AS = { association: 1, dissociation: 1, 'perturbing agent': 1, perturbation: 1 };
  var HEAD = { consumption: null, 'logic arc': null, production: 'production', catalysis: 'catalysis', inhibition: 'inhibition',
    modulation: 'modulation', stimulation: 'stimulation', 'necessary stimulation': 'trigger',
    'positive influence': 'stimulation', 'negative influence': 'inhibition', 'unknown influence': 'modulation' };
  var ACTIVITY = { macromolecule: 'Macromolecule', 'nucleic acid feature': 'NucleicAcidFeature', 'simple chemical': 'SimpleChemical',
    'unspecified entity': 'UnspecifiedEntity', complex: 'Complex', perturbation: 'Phenotype' };
  var UNKNOWN = 'Unknown (a dashed arc)';
  var ARROW = { catalysis: 'white_circle', inhibition: 't_shape', modulation: 'white_diamond', stimulation: 'white_delta', trigger: 'white_delta_bar', production: 'delta' };
  var PROCESS_SIGN = { OmittedProcess: '\\\\', UncertainProcess: '?' };
  var LINE = 16.5, CHAR = 9.5, ICON_CHAR = 5.4, COUNT_H = 11.0, PROTEIN_H = 40.0, NOTICED = 1.2;
  var CARD = /^\s*(\d+(\.\d+)?|\?)\s*$/;

  // ---------- Python's ways with numbers and text
  function repr(v) {   // Python's repr of a float
    if (v === 0) return 1 / v < 0 ? '-0.0' : '0.0';
    if (!isFinite(v)) return v !== v ? 'nan' : v > 0 ? 'inf' : '-inf';
    var a = Math.abs(v);
    if (a >= 1e16 || a < 1e-4) {
      var e = v.toExponential(), m = e.match(/^(-?[\d.]+)e([+-])(\d+)$/);
      return m[1] + 'e' + m[2] + (m[3].length < 2 ? '0' : '') + m[3];
    }
    var s = String(v);
    return /[.e]/.test(s) ? s : s + '.0';
  }
  function pctg(v) {   // Python's '%g': six significant digits, an exact tie rounded to even (JavaScript rounds it up)
    if (v === 0) return '0';
    if (!isFinite(v)) return v !== v ? 'nan' : v > 0 ? 'inf' : '-inf';
    var ex = Math.abs(v).toExponential(60).split('e'), d = ex[0].replace('.', ''), e = Number(ex[1]);
    var tie = d[6] === '5' && /^0*$/.test(d.slice(7)), keep = d.slice(0, 6);
    if (!(tie && Number(d[5]) % 2 === 0)) { var r = Math.abs(v).toExponential(5).split('e'); keep = r[0].replace('.', ''); e = Number(r[1]); }
    var sign = v < 0 ? '-' : '';
    if (e < -4 || e >= 6) {
      var x = (keep[0] + '.' + keep.slice(1)).replace(/\.?0+$/, '');
      return sign + x + 'e' + (e < 0 ? '-' : '+') + (Math.abs(e) < 10 ? '0' : '') + Math.abs(e);
    }
    var digits = e >= 0 ? keep.slice(0, e + 1) + '.' + keep.slice(e + 1) : '0.' + '0'.repeat(-e - 1) + keep;
    return sign + digits.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  function pyRound(x) {   // Python's round() to an integer: halves to even
    var f = Math.floor(x), d = x - f;
    return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1);
  }
  function pyFloat(s) {   // Python's float() of a text: a number or an error
    if (s == null) throw new TypeError('float() argument must be a string or a real number, not NoneType');
    var t = String(s).trim().replace(/(\d)_(?=\d)/g, '$1'), v = /^[+-]?(\d+\.?\d*(e[+-]?\d+)?|\.\d+(e[+-]?\d+)?|inf(inity)?|nan)$/i.test(t) ? Number(t.replace(/^([+-]?)inf(inity)?$/i, '$1Infinity')) : NaN;
    if (v !== v && !/nan/i.test(t)) throw new Error('could not convert string to float: ' + JSON.stringify(String(s)));
    return v;
  }
  function has(o, k) { return k !== null && Object.prototype.hasOwnProperty.call(o, k); }
  function plen(s) { return Array.from(s).length; }   // Python's len of a str: code points
  function words(s) { return s.split(/\s+/).filter(Boolean).join(' '); }   // ' '.join(s.split())
  function median(v) { v = v.slice().sort(function (a, b) { return a - b; }); var n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; }
  function pyJson(v) {   // json.dumps(v, ensure_ascii=False)
    if (Array.isArray(v)) return '[' + v.map(pyJson).join(', ') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).map(function (k) { return JSON.stringify(k) + ': ' + pyJson(v[k]); }).join(', ') + '}';
    return JSON.stringify(v);
  }
  function unquote(s) {   // urllib.parse.unquote
    return s.replace(/(%[0-9A-Fa-f]{2})+/g, function (m) { try { return decodeURIComponent(m); } catch (e) { return new TextDecoder().decode(new Uint8Array(m.slice(1).split('%').map(function (h) { return parseInt(h, 16); }))); } });
  }

  // ---------- reading the file's elements (libsbgn's earlier namespaces and the render extension's taken as the current)
  function isS(el, name) { return el.nodeType === 1 && el.localName === name && !!el.namespaceURI && el.namespaceURI.indexOf('http://sbgn.org/libsbgn/') === 0; }
  function isR(el, name) { return el.nodeType === 1 && el.localName === name && (el.namespaceURI === RENDER || (el.namespaceURI || '').indexOf(OLD_RENDER) === 0); }
  function kids(el) { var out = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c); return out; }
  function sKids(el, name) { return kids(el).filter(function (c) { return isS(c, name); }); }
  function sKid(el, name) { return sKids(el, name)[0] || null; }
  function below(el, test) { var out = []; (function walk(e) { for (var c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) { if (test(c)) out.push(c); walk(c); } })(el); return out; }
  function get(el, k) { return el.hasAttribute(k) ? el.getAttribute(k) : null; }
  function rget(el, k) {   // a render attribute, also when written with the namespace's prefix
    var as = el.attributes, v = null;
    for (var i = 0; i < as.length; i++) { var a = as[i], ns = a.namespaceURI || ''; if (a.localName === k && (ns === RENDER || ns.indexOf(OLD_RENDER) === 0)) v = a.value; }
    return v !== null ? v : el.hasAttribute(k) ? el.getAttribute(k) : null;
  }
  function textOf(el) { var nt = sKid(el, 'notes'); return nt ? nt.textContent : ''; }
  function urn(uri) {
    if (uri.indexOf('urn:miriam:') === 0) return uri;
    var m = uri.match(/^https?:\/\/identifiers\.org\/(?:([\w.]+)\/|([\w.]+):)?(.+)$/i);
    if (!m) return null;
    var db = m[1] || m[2], x = m[3];
    if (db == null || db.toUpperCase() === 'CHEBI') return (db || x).toUpperCase().indexOf('CHEBI') === 0 ? 'urn:miriam:obo.chebi:CHEBI%3A' + x.split(':').pop() : null;
    return 'urn:miriam:' + (URN[db] !== undefined ? URN[db] : db.toLowerCase()) + ':' + x;
  }
  function colour(c, defs) {
    var v = defs.has(c) ? defs.get(c) : c;
    if (!v || v[0] !== '#') return null;
    v = v.toUpperCase();
    return v.length === 9 && /FF$/.test(v) ? v.slice(0, 7) : v;
  }
  // annotation.py
  function toProperties(family, uris) {
    var members = [];
    uris.forEach(function (u) {
      var i = u.lastIndexOf(':'), db = i < 0 ? '' : u.slice(0, i), x = i < 0 ? u : u.slice(i + 1);
      if (db === 'urn:miriam:hgnc.symbol' || db === 'urn:miriam:obo.chebi' || !members.length) members.push({});
      var k = { 'urn:miriam:hgnc.symbol': 'HGNC symbol', 'urn:miriam:hgnc': 'HGNC', 'urn:miriam:uniprot': 'UniProt', 'urn:miriam:obo.chebi': 'ChEBI' }[db];
      if (k) members[members.length - 1][k] = k === 'HGNC' ? 'HGNC:' + x : x.split('%3A').join(':');
    });
    var out = {};
    if (!family) { members.slice().reverse().forEach(function (m) { Object.keys(m).forEach(function (k) { out[k] = m[k]; }); }); return out; }
    var order = ['HGNC', 'HGNC symbol', 'UniProt', 'ChEBI'];
    out.Members = members.map(function (m) { return m['HGNC symbol'] !== undefined ? m['HGNC symbol'] : m.ChEBI !== undefined ? m.ChEBI : ''; }).join('; ');
    out['Member annotation'] = pyJson(members.map(function (m) { return { symbol: m['HGNC symbol'] !== undefined ? m['HGNC symbol'] : '', props: order.filter(function (k) { return k in m; }).map(function (k) { return [k, m[k]]; }) }; }));
    return out;
  }
  function unitsOf(p) { return (p['Unit of information'] || '').split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/).filter(function (x) { return x.trim(); }).map(words); }
  function fromNotes(text, p) {
    var members = JSON.parse(p['Member annotation'] || '[]'), out = Object.assign({}, p);
    (text || '').split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/).forEach(function (line, n, all) {
      if (n === all.length - 1 && line === '' && n) return;
      line = line.trim();
      var j = line.indexOf(': '), k = j < 0 ? line : line.slice(0, j), v = j < 0 ? '' : line.slice(j + 2);
      if (k === 'Family' && v) out.Family = v;
      if (k === 'PTM' && v && v.split(/\s+/).filter(Boolean).every(function (x) { return /^[^@\s]*@\S+$/.test(x); })) {
        var seen = [], all2 = (out.PTM || '').split(/\s+/).filter(Boolean).concat(v.split(/\s+/).filter(Boolean));
        all2.forEach(function (x) { if (seen.indexOf(x) < 0) seen.push(x); });
        out.PTM = seen.join('\n');
      }
      if (k === 'Unit of information' && v) out['Unit of information'] = unitsOf(out).concat(v.split('; ').map(function (u) { return u.trim(); }).filter(Boolean)).join('\n');
      members.forEach(function (m) {
        if (m.symbol === k && v) {
          m.props = m.props.filter(function (x) { return x[0] !== 'PTM'; }).concat([['PTM', v]]);
          out['Member annotation'] = pyJson(members);
        }
      });
    });
    return out;
  }
  function fromReferences(urns) {
    return urns.filter(function (u) { return u.indexOf('urn:miriam:') === 0; }).map(function (u) {
      var r = u.slice('urn:miriam:'.length), i = r.indexOf(':');
      return i < 0 ? r + ':' : r.slice(0, i) + ':' + unquote(r.slice(i + 1));
    }).join(' ');
  }

  // ---------- layout.py
  function centre(d) { return [d.box[0] + d.box[2] / 2, d.box[1] + d.box[3] / 2]; }
  function border(d, p) {
    var c = centre(d), w = d.box[2], h = d.box[3], dx = p[0] - c[0], dy = p[1] - c[1];
    if (!dx && !dy) return c;
    var t = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
    return [c[0] + t * dx, c[1] + t * dy];
  }
  function lens(line) { var out = []; for (var k = 0; k + 1 < line.length; k++) { var p = line[k], q = line[k + 1]; out.push(Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]))); } return out; }
  function sum(v) { var t = 0.0; v.forEach(function (x) { t += x; }); return t; }
  function any(p) { return !!(p[0] || p[1]); }
  function countLine(N, a) {
    var first = PROCESSES.indexOf(N.get(a.source).kind) < 0;
    var ent = first ? a.source : a.target, hub = first ? a.target : a.source;
    var at = first ? a.source_at : a.target_at, pts = first ? a.points.slice() : a.points.slice().reverse();
    var hubAt = first ? a.target_at : a.source_at;
    var E = N.get(ent), Hb = N.get(hub), Hc = centre(Hb);
    var nxt = pts.length ? pts[0] : [Hc[0] + hubAt[0], Hc[1] + hubAt[1]];
    var p0 = any(at) ? [centre(E)[0] + at[0], centre(E)[1] + at[1]] : border(E, nxt);
    var p1 = any(hubAt) ? [Hc[0] + hubAt[0], Hc[1] + hubAt[1]] : border(Hb, pts.length ? pts[pts.length - 1] : p0);
    return [p0].concat(pts, [p1]);
  }
  function countOn(line, text, pos) {
    var L0 = lens(line), half = sum(L0) * (pos ? pos[0] : 0.5), k = 0;
    while (k < L0.length - 1 && half > L0[k]) { half -= L0[k]; k++; }
    var L = L0[k] || 1.0, ux = (line[k + 1][0] - line[k][0]) / L, uy = (line[k + 1][1] - line[k][1]) / L;
    if (!L0[k]) { ux = 1.0; uy = 0.0; }
    var mx = line[k][0] + ux * half, my = line[k][1] + uy * half, nx = -uy, ny = ux;
    if (pos ? pos[1] < 0 : (Math.abs(ny) < 0.2 ? nx < 0 : ny > 0)) { nx = -nx; ny = -ny; }
    var w = 5.0 * plen(text) + 6, h = COUNT_H, side = 1 + Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2;
    var cx = mx + nx * side, cy = my + ny * side;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function countPlace(line, box) {
    var L0 = lens(line), P = [box[0] + box[2] / 2, box[1] + box[3] / 2], tot = sum(L0), acc = 0.0, best = null;
    if (!tot) return null;
    L0.forEach(function (L, k) {
      if (!L) return;
      var a = line[k], ux = (line[k + 1][0] - a[0]) / L, uy = (line[k + 1][1] - a[1]) / L;
      var t = Math.max(0.0, Math.min(L, (P[0] - a[0]) * ux + (P[1] - a[1]) * uy)), qx = a[0] + ux * t, qy = a[1] + uy * t;
      var d = Math.sqrt((P[0] - qx) * (P[0] - qx) + (P[1] - qy) * (P[1] - qy));
      if (best === null || d < best[0]) best = [d, (acc + t) / tot, (P[0] - qx) * -uy + (P[1] - qy) * ux >= 0 ? 1 : -1];
      acc += L;
    });
    var r = Math.floor(best[1] * 10000 + 0.5) / 10000, s = best[2];
    if (Math.abs(r - 0.5) < 0.005) {
      var d0 = countOn(line, 'x'), u = countOn(line, 'x', [0.5, s]);
      if (Math.abs(d0[0] - u[0]) < 0.01 && Math.abs(d0[1] - u[1]) < 0.01) return null;
      r = 0.5;
    }
    return [r, s];
  }
  function countText(v) {
    var m = CARD.exec(v || '');
    if (!m) return null;
    if (m[1] === '?') return '?';
    var f = pyFloat(m[1]);
    return f === Math.trunc(f) ? String(Math.trunc(f)) : repr(f);
  }
  function flux(N, a) {
    var s = PROCESSES.indexOf(N.get(a.source).kind) >= 0, t = PROCESSES.indexOf(N.get(a.target).kind) >= 0;
    return (a.head === null && s !== t) || (a.head === 'production' && s && !t);
  }
  function unitPlaces(d, own) {
    own = own === undefined ? d.unit_at : own;
    var units = d.units.concat(d.count > 2 && !d.units.some(function (u) { return /^N:\d+$/.test(u); }) ? ['N:' + d.count] : []);
    return units.map(function (u, k) { var p = (k < own.length ? own[k] : null) || [(k + 1) / (units.length + 1) - 0.5, -0.5]; return [u, p[0], p[1]]; });
  }
  function ownPlaces(d) {
    var slot = unitPlaces(d, []).map(function (x) { return [x[1], x[2]]; });
    var out = d.unit_at.map(function (p, k) { return p && k < slot.length && (Math.abs(p[0] - slot[k][0]) > 1e-6 || Math.abs(p[1] - slot[k][1]) > 1e-6) ? p : null; });
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }

  // ---------- sbgnml.read
  function at(d, ref, p, q, port) {
    if (ref !== d.id) {
      if (!port) return [0.0, 0.0];
      var c0 = centre(d);
      return [port[0] - c0[0], port[1] - c0[1]];
    }
    if (p == null || q == null) return [0.0, 0.0];
    var c = centre(d), ux = q[0] - c[0], uy = q[1] - c[1], vx = p[0] - c[0], vy = p[1] - c[1], n = Math.hypot(ux, uy);
    if (!n || (Math.abs(ux * vy - uy * vx) / n <= 1.5 && ux * vx + uy * vy >= 0)) return [0.0, 0.0];
    return [vx, vy];
  }
  function uniqueIds(m) {
    var els = below(m, function (e) { return isS(e, 'glyph'); }), taken = new Set(), seen = new Map(), out = new Map();
    [m].concat(below(m, function () { return true; })).forEach(function (e) { var i = get(e, 'id'); if (i) taken.add(i); });
    els.forEach(function (g) {
      var i = get(g, 'id');
      if (seen.has(i)) {
        var k = seen.get(i) + 1;
        while (taken.has(i + '_' + k)) k++;
        seen.set(i, k); out.set(g, i + '_' + k); taken.add(i + '_' + k);
      } else seen.set(i, 1);
    });
    return out;
  }
  function round3(x) { return Math.round(x * 1000) / 1000; }
  function nearest(boxes, p, hub) {
    function far(b) {
      var x = b[0], y = b[1], w = b[2], h = b[3], dx = Math.max(x - p[0], 0, p[0] - x - w), dy = Math.max(y - p[1], 0, p[1] - y - h);
      return dx || dy ? Math.hypot(dx, dy) : -Math.min(p[0] - x, x + w - p[0], p[1] - y, y + h - p[1]);
    }
    var best = null, bk = null;
    boxes.forEach(function (c) {
      var k = [p ? round3(Math.abs(far(c[1]))) : 0, c[2] !== hub ? 1 : 0];
      if (bk === null || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = c; bk = k; }
    });
    return best[0];
  }
  function read(text, opt) {
    var doc = new ((opt && opt.DOMParser) || root.DOMParser)().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml'), msgs = [];
    var rootEl = doc.documentElement;
    if (!rootEl || doc.getElementsByTagName('parsererror').length) throw new Error('not an XML file');
    var say = function (kind, t) { msgs.push([kind, t]); };
    var m = sKid(rootEl, 'map');
    if (!m) throw new Error('no SBGN-ML map in the file');
    var defs = new Map();
    below(m, function (e) { return isR(e, 'colorDefinition'); }).forEach(function (c) { defs.set(get(c, 'id'), rget(c, 'value')); });
    ['linearGradient', 'radialGradient'].forEach(function (k) {
      below(m, function (e) { return isR(e, k); }).forEach(function (gr) {
        var cs = kids(gr).filter(function (s) { return isR(s, 'stop'); }).map(function (s) { var sc = rget(s, 'stop-color'); return (defs.has(sc) ? defs.get(sc) : sc) || ''; });
        cs = cs.filter(function (c) { return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(c); }).map(function (c) { return c.slice(1, 9); });
        if (cs.length) {
          var ab = [cs[0], cs[cs.length - 1]].map(function (c) { return c.length === 8 ? c : c + 'ff'; }), v = '#';
          for (var j = 0; j < 8; j += 2) { var n = pyRound((parseInt(ab[0].slice(j, j + 2), 16) + parseInt(ab[1].slice(j, j + 2), 16)) / 2); v += (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
          defs.set(get(gr, 'id'), v);
        }
      });
    });
    function style(a, f) {
      var out = new Map();
      below(m, function (e) { return isR(e, 'style'); }).forEach(function (st) {
        var g = kids(st).filter(function (c) { return isR(c, 'g'); })[0];
        if (!g || !rget(g, a)) return;
        (rget(st, 'idList') || '').split(/\s+/).filter(Boolean).forEach(function (i) { out.set(i, f ? f(rget(g, a)) : rget(g, a)); });
      });
      return out;
    }
    var fill = style('fill'), line = style('stroke'), weight = style('stroke-width', pyFloat), font = style('font-size', pyFloat);
    line.forEach(function (c, i) { if (colour(c, defs) === '#000000') line.delete(i); });
    var port = new Map(), atPort = new Map(), nodes = new Map(), skipped = new Map(), activities = new Set(), renamed = [];
    var skip = function (k, i) { if (!skipped.has(k)) skipped.set(k, []); skipped.get(k).push(i); };
    var label = function (g) { var l = sKid(g, 'label'); return l ? (get(l, 'text') !== null ? get(l, 'text') : '') : ''; };
    var newId = uniqueIds(m), shared = new Set(), same = new Map();
    newId.forEach(function (v, g) { shared.add(get(g, 'id')); });
    var opt2 = function (mp, k) { return mp.has(k) ? mp.get(k) : null; };
    function glyph(g, parent) {
      var cls = get(g, 'class'), oid = get(g, 'id'), i = newId.has(g) ? newId.get(g) : oid;
      if (cls === null) throw new TypeError("'NoneType' object has no attribute 'endswith'");
      var bb = sKid(g, 'bbox'), x = pyFloat(get(bb, 'x')), y = pyFloat(get(bb, 'y')), w = pyFloat(get(bb, 'w')), h = pyFloat(get(bb, 'h'));
      var base = / multimer$/.test(cls) ? cls.slice(0, -' multimer'.length) : cls;
      var kind = has(OPERATORS, cls) ? 'Operator' : has(KIND, base) ? KIND[base] : null, unit = null;
      if (cls === 'biological activity') {
        var uc = sKids(g, 'glyph').filter(function (c) { return get(c, 'class') === 'unit of information'; })[0], u = uc ? sKid(uc, 'entity') : null;
        unit = u ? (get(u, 'name') || '') : '';
        kind = has(ACTIVITY, unit.replace(' multimer', '')) ? ACTIVITY[unit.replace(' multimer', '')] : 'Macromolecule';
        activities.add(i);
        if (/\sactivity\s*$/i.test(label(g))) { sKid(g, 'label').setAttribute('text', label(g).replace(/\s+activity\s*$/i, '')); renamed.push(i); }
      }
      if (cls === 'terminal') kind = 'Tag';
      if (kind === null) { skip(cls, i); return; }
      sKids(g, 'port').forEach(function (p) { port.set(get(p, 'id'), i); atPort.set(get(p, 'id'), [pyFloat(get(p, 'x')), pyFloat(get(p, 'y'))]); });
      var states = [], units = [], unitAt = [];
      sKids(g, 'glyph').forEach(function (c) {
        var cb = sKid(c, 'bbox');
        if (get(c, 'class') === 'state variable') {
          var st = sKid(c, 'state'), v = st ? get(st, 'value') || '' : '', vr = st ? get(st, 'variable') || '' : '';
          var cx = pyFloat(get(cb, 'x')) + pyFloat(get(cb, 'w')) / 2, cy = pyFloat(get(cb, 'y')) + pyFloat(get(cb, 'h')) / 2;
          states.push([v + (vr ? '@' + vr : ''), (cx - x - w / 2) / w, (cy - y - h / 2) / h]);
        } else if (get(c, 'class') === 'unit of information' && (label(c) || cls !== 'biological activity')) {
          units.push(label(c));
          unitAt.push(cb && w && h ? [(pyFloat(get(cb, 'x')) + pyFloat(get(cb, 'w')) / 2 - x - w / 2) / w, (pyFloat(get(cb, 'y')) + pyFloat(get(cb, 'h')) / 2 - y - h / 2) / h] : null);
        }
      });
      var nn = units.filter(function (u) { return /^N:\d+$/.test(u); }).map(function (u) { return parseInt(u.slice(2), 10); });
      var lab = sKid(g, 'label'), lb = lab ? sKid(lab, 'bbox') : null, data = {}, refs = [];
      var own = kids(g).filter(function (c) { return c.localName === 'extension' || c.localName === 'annotation'; });
      var desc = null;
      own.some(function (c) { var d = below(c, function (e) { return e.localName === 'Description' && e.namespaceURI === RDF; })[0]; if (d) desc = d; return !!d; });
      if (desc) kids(desc).forEach(function (q) {
        var urns = below(q, function (e) { return e.localName === 'li' && e.namespaceURI === RDF; }).map(function (li) { return urn(li.getAttributeNS(RDF, 'resource') || ''); }).filter(Boolean);
        if (urns.length && (q.localName === 'is' || q.localName === 'hasVersion')) Object.assign(data, toProperties(q.localName === 'hasVersion', urns));
        if (q.localName === 'isDescribedBy') refs = refs.concat(urns);
      });
      if (refs.length) data.References = fromReferences(refs);
      data = fromNotes(textOf(g), data);
      if (has(DRAWN_AS, cls)) data['SBGN class'] = cls;
      if (unit !== null) { data['SBGN class'] = cls; if (unit) data['SBGN unit'] = unit; }
      if (shared.has(oid)) { if (!same.has(oid)) same.set(oid, []); same.get(oid).push(i); }
      var small = null;
      sKids(g, 'glyph').some(function (c) { if (font.has(get(c, 'id')) && (get(c, 'class') === 'state variable' || get(c, 'class') === 'unit of information')) { small = font.get(get(c, 'id')); return true; } return false; });
      var d = { id: i, kind: kind, box: [x, y, w, h], parent: parent, labels: kind === 'Operator' ? [OPERATORS[cls]] : [label(g)],
        fill: colour(opt2(fill, oid), defs), line: colour(opt2(line, oid), defs), weight: opt2(weight, oid), states: states, units: units,
        unit_at: unitAt, count: / multimer$/.test(cls) ? (nn.length ? nn[0] : 2) : 1,
        label_at: kind === 'Compartment' && lb ? [pyFloat(get(lb, 'x')) - x, pyFloat(get(lb, 'y')) - y] : null,
        data: data, font: opt2(font, oid), small: small, way: null };
      nodes.set(i, d);
      if (kind === 'Tag') {
        d.way = ['left', 'right', 'up', 'down'].indexOf(get(g, 'orientation')) >= 0 ? get(g, 'orientation') : 'right';
        if (cls === 'terminal') data['SBGN class'] = 'terminal';
      }
      if (sKid(g, 'clone')) skip('clone marker', i);
      sKids(g, 'glyph').forEach(function (c) { if (get(c, 'class') !== 'state variable' && get(c, 'class') !== 'unit of information') glyph(c, kind === 'Complex' ? i : parent); });
    }
    sKids(m, 'glyph').forEach(function (g) { glyph(g, get(g, 'compartmentRef')); });
    var arcs = [], performers = new Map(), head = Object.assign({}, HEAD, { 'equivalence arc': null });
    sKids(m, 'arc').forEach(function (a) {
      var cls = get(a, 'class'), e0 = sKid(a, 'start'), e1 = sKid(a, 'end');
      if (cls === null) throw new TypeError('unsupported operand type(s) for +: \'NoneType\' and \'str\'');
      function end(k, e, hub) {
        var r = get(a, k);
        if (port.has(r) || !same.has(r)) return port.has(r) ? port.get(r) : r;
        var ids = same.get(r);
        return ids.length === 1 ? ids[0] : nearest(ids.map(function (c) { return [c, nodes.get(c).box, PROCESSES.concat(['Operator']).indexOf(nodes.get(c).kind) >= 0]; }),
          e ? [pyFloat(get(e, 'x')), pyFloat(get(e, 'y'))] : null, hub);
      }
      var s = end('source', e0, cls === 'production'), t = end('target', e1, cls !== 'production' && cls !== 'equivalence arc');
      if (cls === 'performance arc' && activities.has(t) && nodes.has(s) && !activities.has(s)) {
        if (!performers.has(t)) performers.set(t, []);
        performers.get(t).push([s, get(a, 'id')]); return;
      }
      if (!has(head, cls) || !nodes.has(s) || !nodes.has(t)) { skip(!has(head, cls) ? cls + ' arc' : 'arc to a glyph left out', get(a, 'id')); return; }
      var pts = sKids(a, 'next').map(function (p) { return [pyFloat(get(p, 'x')), pyFloat(get(p, 'y'))]; });
      var isFlux = cls === 'consumption' || cls === 'logic arc';
      var ends = [e0, e1].map(function (e) { return e ? [pyFloat(get(e, 'x')), pyFloat(get(e, 'y'))] : null; });
      var cg = sKids(a, 'glyph').filter(function (g) { return get(g, 'class') === 'cardinality'; })[0];
      var card = cg ? sKid(cg, 'label') : null, cb = cg ? sKid(cg, 'bbox') : null, aid = get(a, 'id');
      var wv = weight.has(aid) ? weight.get(aid) : 1;
      var arc = { id: aid, source: s, target: t, head: head[cls], tail: false, dashed: textOf(a).indexOf(UNKNOWN) >= 0, points: pts,
        count: card && (cls === 'consumption' || cls === 'production') ? countText(get(card, 'text')) : null,
        line: colour(opt2(line, aid), defs), weight: wv !== 1 ? opt2(weight, aid) : null,
        source_at: at(nodes.get(s), get(a, 'source'), ends[0], (pts.length ? pts : ends.slice(1))[0], opt2(atPort, get(a, 'source'))),
        target_at: at(nodes.get(t), get(a, 'target'), ends[1], (pts.length ? pts.slice(-1) : ends.slice(0, 1))[0], isFlux && opt2(atPort, get(a, 'target'))),
        count_at: null };
      arcs.push(arc);
      if (arc.count && cb) arc.count_at = countPlace(countLine(nodes, arc), ['x', 'y', 'w', 'h'].map(function (k) { return cb.hasAttribute(k) ? pyFloat(get(cb, k)) : 0; }));
    });
    performers.forEach(function (ps, t) {
      if (ps.length > 1) { ps.forEach(function (p) { skip('performance arc', p[1]); }); return; }
      var s = ps[0][0];
      arcs.forEach(function (a) {
        if (a.source === t || a.target === t) {
          a.source = a.source === t ? s : a.source; a.target = a.target === t ? s : a.target; a.points = [];
          a.source_at = [0.0, 0.0]; a.target_at = [0.0, 0.0];
        }
      });
      say('changed', 'activity of ' + (words(nodes.get(t).labels[0]) || t) + ': drawn as ' + (words(nodes.get(s).labels[0]) || s) + ', its entity (performance arc)');
      nodes.delete(t);
    });
    var kept = renamed.filter(function (i) { return nodes.has(i); }).map(function (i) { return words(nodes.get(i).labels[0]); });
    if (kept.length) say('changed', '"activity" cut from the label of: ' + kept.join(', '));
    skipped.forEach(function (ids, what) {
      if (ids.slice(0, 5).some(function (i) { return i === null; })) throw new TypeError('sequence item 0: expected str instance, NoneType found');   // as the converter: an element left out with no id stops the reading
      say('left out', what + ': ' + ids.length + ' left out (' + ids.slice(0, 5).join(', ') + (ids.length > 5 ? ' ...' : '') + ')'); });
    nodes.forEach(function (d) { d.unit_at = ownPlaces(d); });
    return { nodes: nodes, arcs: arcs, messages: msgs };
  }

  // ---------- an XML tree as lxml keeps it: an element's tail (the text after it) goes with it when copied
  var T = null;   // the template: { doc, tpl, icon, arc, card, res }
  function tmpl(opt) {
    if (T) return T;
    var doc = new ((opt && opt.DOMParser) || root.DOMParser)().parseFromString(TEMPLATE, 'application/xml'), tpl = {}, res = {};
    var all = doc.getElementsByTagNameNS(GNS, 'node');
    for (var i = 0; i < all.length; i++) tpl[all[i].getAttribute('id')] = all[i];
    var edges = doc.getElementsByTagNameNS(GNS, 'edge'), card = null;
    for (i = 0; i < edges.length; i++) if (edges[i].getAttribute('id') === 'Cardinality') card = edges[i].getElementsByTagNameNS(YNS, 'EdgeLabel')[0];
    var rs = doc.getElementsByTagNameNS(YNS, 'Resource');
    for (i = 0; i < rs.length; i++) res[rs[i].getAttribute('id')] = rs[i];
    T = { doc: doc, tpl: tpl, icon: tpl.IconLabel.getElementsByTagNameNS(YNS, 'NodeLabel')[0], arc: edges[0], card: card, res: res };
    return T;
  }
  function copy(el) {   // deepcopy: the element and its tail
    var tail = '';
    for (var s = el.nextSibling; s && (s.nodeType === 3 || s.nodeType === 4); s = s.nextSibling) tail += s.data;
    return { el: el.cloneNode(true), tail: tail };
  }
  function putTail(c) { if (c.tail) c.el.parentNode.insertBefore(c.el.ownerDocument.createTextNode(c.tail), c.el.nextSibling); }
  function append(parent, c) { parent.appendChild(c.el); putTail(c); return c.el; }
  function addnext(ref, c) {   // after ref's tail, as lxml's addnext
    var at = ref.nextSibling; while (at && (at.nodeType === 3 || at.nodeType === 4)) at = at.nextSibling;
    ref.parentNode.insertBefore(c.el, at); putTail(c); return c.el;
  }
  function insertAt(parent, k, c) { var ks = kids(parent); if (k >= ks.length) return append(parent, c); parent.insertBefore(c.el, ks[k]); putTail(c); return c.el; }
  function sub(parent, ns, q, attrs) {
    var e = parent.ownerDocument.createElementNS(ns, q);
    (attrs || []).forEach(function (a) { e.setAttribute(a[0], a[1]); });
    parent.appendChild(e); return e;
  }
  function yk(el, name) { return kids(el).filter(function (c) { return c.localName === name && c.namespaceURI === YNS; })[0] || null; }
  function yks(el, name) { return kids(el).filter(function (c) { return c.localName === name && c.namespaceURI === YNS; }); }
  function gk(el, name) { return kids(el).filter(function (c) { return c.localName === name && c.namespaceURI === GNS; })[0] || null; }
  function ydown(el, name) { return el.getElementsByTagNameNS(YNS, name)[0] || null; }
  function setText(el, t) {   // lxml's .text: the text before the first child element
    while (el.firstChild && el.firstChild.nodeType !== 1) el.removeChild(el.firstChild);
    if (t) el.insertBefore(el.ownerDocument.createTextNode(t), el.firstChild);
  }
  function getText(el) { var t = null; for (var c = el.firstChild; c && c.nodeType !== 1; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) t = (t || '') + c.data; return t; }
  // printed as lxml prints with pretty_print (libxml2's format): an element whose children are all elements gets them
  // on lines of their own, two spaces deeper; one holding any text, and everything inside it, is printed as it is
  function escText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;'); }
  function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;'); }
  function print(el, level, fmt, out, head) {
    out.push('<' + el.nodeName + (head || ''));
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (!/^xmlns(:|$)/.test(a.name)) out.push(' ' + a.name + '="' + escAttr(a.value) + '"'); }
    if (!el.firstChild) { out.push('/>'); return; }
    out.push('>');
    var f = fmt;
    for (var c = el.firstChild; c && f; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) f = false;
    if (f) out.push('\n');
    for (c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) { if (f) out.push('  '.repeat(level + 1)); print(c, level + 1, f, out); if (f) out.push('\n'); }
      else if (c.nodeType === 3 || c.nodeType === 4) out.push(escText(c.data));
    }
    if (f) out.push('  '.repeat(level));
    out.push('</' + el.nodeName + '>');
  }
  function usesYed(el) { if (el.namespaceURI === YED) return true; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && usesYed(c)) return true; return false; }

  // ---------- graphml.write
  function label(l, text, w, h, k) {
    var lines = text ? text.split('\n') : [];
    var lw = Math.max.apply(null, lines.map(plen).concat([0])) * CHAR * k, lh = lines.length * LINE * k + 4;
    setText(l, text || null);
    l.setAttribute('hasText', text ? 'true' : 'false');
    [['width', lw], ['height', lh], ['x', (w - lw) / 2], ['y', (h - lh) / 2]].forEach(function (p) { l.setAttribute(p[0], repr(p[1])); });
  }
  function scaleOf(N) {
    var hs = []; N.forEach(function (d) { if (d.kind === 'Macromolecule' && d.count === 1) hs.push(d.box[3]); });
    var s = hs.length ? median(hs) / PROTEIN_H : 1.0;
    return s > NOTICED || s < 1 / NOTICED ? s : 1.0;
  }
  function write(M, opt) {
    var t = tmpl(opt), doc = t.doc, N = M.nodes, msgs = M.messages;
    var font = pyRound(14 * scaleOf(N) + 0.01);
    var rootEl = doc.createElementNS(GNS, 'graphml'), names = [];
    N.forEach(function (d) { Object.keys(d.data).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); }); });
    names.forEach(function (name, k) { sub(rootEl, GNS, 'key', [['attr.name', name], ['attr.type', 'string'], ['for', 'node'], ['id', 'd' + k]]); });
    [['ng', 'node', 'nodegraphics'], ['res', 'graphml', 'resources'], ['eg', 'edge', 'edgegraphics']].forEach(function (x) { sub(rootEl, GNS, 'key', [['for', x[1]], ['id', x[0]], ['yfiles.type', x[2]]]); });
    var resources = [], rid = new Map(), size = {};
    function resource(kind, text, small) {
      var key = kind + '\u0000' + text + '\u0000' + small;
      if (!rid.has(key)) {
        var c = copy(t.res[kind]), r = c.el; rid.set(key, String(rid.size + 1)); r.setAttribute('id', rid.get(key));
        var gn = ydown(r, 'GenericNode'), k = (small || 10) / 10, w, h;
        if (kind === 'StateVariable') { if (plen(text) <= 2) { w = 18.0 * k; h = 18.0 * k; } else { w = Math.ceil(plen(text) * ICON_CHAR * k + 12 * k); h = 18.0 * k; } }
        else { w = Math.ceil(Math.max(plen(text), 3) * ICON_CHAR * k + 8 * k); h = 16.0 * k; }
        yk(gn, 'Geometry').setAttribute('width', repr(w)); yk(gn, 'Geometry').setAttribute('height', repr(h));
        if (small) yk(gn, 'NodeLabel').setAttribute('fontSize', pctg(small));
        label(yk(gn, 'NodeLabel'), text, w, h, k * 10 / 14);
        size[rid.get(key)] = [w, h];
        resources.push(c);
      }
      return rid.get(key);
    }
    var children = new Map();
    N.forEach(function (d, i) { var p = d.parent !== null && N.has(d.parent) ? d.parent : null; if (!children.has(p)) children.set(p, []); children.get(p).push(i); });
    var missing = new Map();
    function realizer(n) {
      var ds = kids(n).filter(function (c) { return c.localName === 'data' && c.namespaceURI === GNS; });
      for (var j = 0; j < ds.length; j++) { var x = kids(ds[j]).filter(function (c) { return !!yk(c, 'Geometry'); })[0]; if (x) return x; }
      for (j = 0; j < ds.length; j++) { var pa = yk(ds[j], 'ProxyAutoBoundsNode'), rz = pa && yk(pa, 'Realizers'); if (rz && kids(rz).length) return kids(rz)[0]; }
      return null;
    }
    function node(parent, i) {
      var d = N.get(i), group = !!(children.get(i) || []).length || d.kind === 'Compartment';
      var name = group && d.kind === 'Complex' ? 'ComplexGroup' : has(PROCESS_SIGN, d.kind) ? 'Process' : d.kind;
      if (!has(t.tpl, name)) { if (!missing.has(d.kind)) missing.set(d.kind, []); missing.get(d.kind).push(i); return; }
      if (d.kind === 'Phenotype' && d.data['SBGN class'] === 'submap') name = 'Submap';
      var n = append(parent, copy(t.tpl[name]));
      n.setAttribute('id', i);
      if (d.kind === 'Phenotype' && (d.data['SBGN class'] === 'perturbing agent' || d.data['SBGN class'] === 'perturbation')) realizer(n).setAttribute('configuration', 'com.yworks.sbgn.PerturbingAgent');
      names.forEach(function (nm, k) {
        if (d.data[nm]) { var x = doc.createElementNS(GNS, 'data'); x.setAttribute('key', 'd' + k); x.appendChild(doc.createTextNode(d.data[nm])); insertAt(n, k, { el: x, tail: '' }); }
      });
      var gn = realizer(n), w = d.box[2], h = d.box[3], geo = yk(gn, 'Geometry');
      ['x', 'y', 'width', 'height'].forEach(function (k, j) { geo.setAttribute(k, repr(d.box[j])); });
      var fl = yk(gn, 'Fill');
      if (d.fill) fl.setAttribute('color', d.fill); else { fl.removeAttribute('color'); fl.setAttribute('hasColor', 'false'); }
      var bs = yk(gn, 'BorderStyle');
      if (d.line) bs.setAttribute('color', d.line);
      if (d.weight) bs.setAttribute('width', repr(d.weight));
      var l = yk(gn, 'NodeLabel'), sign = has(PROCESS_SIGN, d.kind) ? PROCESS_SIGN[d.kind] : null, fs = d.font || font;
      if (!sign && (d.font || font !== 14)) l.setAttribute('fontSize', pctg(fs));
      var lt = sign || d.labels.filter(function (x) { return x; })[0] || '';
      label(l, lt, w, h, fs / 14);
      if (d.kind === 'Operator' && (lt === EQUIV || lt === DELAY)) { l.setAttribute('fontFamily', 'Monospaced'); l.setAttribute('fontSize', '18'); }
      if (d.kind === 'Compartment') {
        var lx = d.label_at ? d.label_at[0] : pyFloat(l.getAttribute('x')), ly = d.label_at ? d.label_at[1] : 0.0;
        l.setAttribute('x', repr(lx)); l.setAttribute('y', repr(ly));
        if (d.label_at) {
          var lw = pyFloat(l.getAttribute('width')), lh = pyFloat(l.getAttribute('height')), low = ly + lh / 2 > h / 2;
          var bd = Math.max(0.0, low ? h - ly - lh : ly), mid = (lx + lw / 2) / w, v = low ? 'b' : 't';
          l.setAttribute('modelPosition', lw + 2 * bd > w ? v : mid < 1 / 3 ? v + 'l' : mid > 2 / 3 ? v + 'r' : v);
          l.setAttribute('borderDistance', repr(bd));
        }
      }
      kids(n).filter(function (c) { return c.localName === 'data' && c.namespaceURI === GNS; }).forEach(function (dt) {
        var pa = yk(dt, 'ProxyAutoBoundsNode'), rz = pa && yk(pa, 'Realizers');
        if (rz) kids(rz).slice(1).forEach(function (c) { var cl = yk(c, 'NodeLabel'); setText(cl, getText(l)); cl.setAttribute('fontSize', l.getAttribute('fontSize')); });
      });
      if (group && d.kind === 'Complex') { l.setAttribute('modelPosition', 'b'); l.setAttribute('borderDistance', '0.0'); l.setAttribute('y', repr(h - pyFloat(l.getAttribute('height')))); }
      if (d.count > 1) {
        var sp = yk(gn, 'StyleProperties') || sub(gn, YNS, 'y:StyleProperties');
        sub(sp, YNS, 'y:Property', [['class', 'java.lang.Integer'], ['name', 'com.yworks.sbgn.style.mcount'], ['value', '2']]);
      }
      if (d.kind === 'Tag' && (d.way === 'left' || d.way === 'up' || d.way === 'down')) {
        sub(sub(gn, YNS, 'y:StyleProperties'), YNS, 'y:Property', d.way === 'left' ? [['class', 'java.lang.Boolean'], ['name', 'com.yworks.sbgn.style.inverse'], ['value', 'true']]
          : [['class', 'java.lang.String'], ['name', 'com.yworks.sbgn.style.orientation'], ['value', d.way]]);
      }
      var icons = d.states.map(function (s) { return ['StateVariable', s[0], s[1], s[2]]; }).concat(unitPlaces(d).map(function (u) { return ['UnitOfInformation', u[0], u[1], u[2]]; }));
      icons.forEach(function (ic) {
        var c = copy(t.icon), il = c.el;
        il.setAttribute('iconData', resource(ic[0], ic[1], d.small));
        var p = ydown(il, 'SmartNodeLabelModelParameter');
        p.setAttribute('nodeRatioX', repr(ic[2])); p.setAttribute('nodeRatioY', repr(ic[3]));
        var sz = size[il.getAttribute('iconData')], iw = sz[0], ih = sz[1];
        [['width', iw], ['height', ih], ['x', (0.5 + ic[2]) * w - iw / 2], ['y', (0.5 + ic[3]) * h - ih / 2]].forEach(function (q) { il.setAttribute(q[0], repr(q[1])); });
        var labs = yks(gn, 'NodeLabel');
        addnext(labs[labs.length - 1], c);
      });
      if (group) {
        var sg = gk(n, 'graph'); sg.setAttribute('id', i + ':');
        (children.get(i) || []).forEach(function (j) { node(sg, j); });
      }
    }
    var g = sub(rootEl, GNS, 'graph', [['edgedefault', 'directed'], ['id', 'G']]);
    (children.get(null) || []).forEach(function (i) { node(g, i); });
    var gone = new Set();
    missing.forEach(function (ids, k) {
      msgs.push(['left out', 'no yEd template for ' + k + ': ' + ids.length + ' nodes left out (' + ids.map(function (i) { return N.get(i).labels[0] || i; }).join(', ') + ')']);
      ids.forEach(function (i) { gone.add(i); });
    });
    M.arcs.forEach(function (a) {
      if (gone.has(a.source) || gone.has(a.target)) return;
      var c = copy(t.arc), e = c.el;
      e.setAttribute('id', a.id); e.setAttribute('source', a.source); e.setAttribute('target', a.target);
      var pl = ydown(e, 'PolyLineEdge'), yp = yk(pl, 'Path');
      ['sx', 'sy', 'tx', 'ty'].forEach(function (k, j) { yp.setAttribute(k, repr(a.source_at.concat(a.target_at)[j])); });
      a.points.forEach(function (q) { sub(yp, YNS, 'y:Point', [['x', repr(q[0])], ['y', repr(q[1])]]); });
      if (a.dashed) yk(pl, 'LineStyle').setAttribute('type', 'dashed');
      if (a.line) yk(pl, 'LineStyle').setAttribute('color', a.line.toUpperCase());
      if (a.weight) yk(pl, 'LineStyle').setAttribute('width', repr(a.weight));
      yk(pl, 'Arrows').setAttribute('target', a.head ? ARROW[a.head] : 'none');
      yk(pl, 'Arrows').setAttribute('source', a.tail ? 'delta' : 'none');
      if (a.count && flux(N, a)) {
        var bx = countOn(countLine(N, a), a.count, a.count_at), S = N.get(a.source);
        var s0 = !any(a.source_at) ? border(S, a.points.length ? a.points[0] : centre(N.get(a.target))) : [centre(S)[0] + a.source_at[0], centre(S)[1] + a.source_at[1]];
        var lc = copy(t.card), lb = lc.el;
        setText(lb, a.count);
        if (a.count_at) { lb.setAttribute('ratio', repr(a.count_at[0])); lb.setAttribute('modelPosition', a.count_at[1] > 0 ? 'scentr' : 'tcentr'); }
        [['x', bx[0] - s0[0]], ['y', bx[1] - s0[1]], ['width', bx[2]], ['height', bx[3]]].forEach(function (q) { lb.setAttribute(q[0], repr(q[1])); });
        insertAt(pl, kids(pl).indexOf(yk(pl, 'BendStyle')) + 1, lc);
      }
      append(g, c);
    });
    var rs = sub(sub(rootEl, GNS, 'data', [['key', 'res']]), YNS, 'y:Resources');
    resources.forEach(function (c) { append(rs, c); });
    var out = ["<?xml version='1.0' encoding='UTF-8'?>\n"];
    print(rootEl, 0, true, out, ' xmlns="' + GNS + '" xmlns:y="' + YNS + '"' + (usesYed(rootEl) ? ' xmlns:yed="' + YED + '"' : ''));
    out.push('\n');
    return out.join('');
  }

  function graphml(text, opt) {
    var M = read(text, opt);
    return { text: write(M, opt), messages: M.messages };
  }

  var TEMPLATE = "<?xml version='1.0' encoding='UTF-8'?>\n<graphml xmlns=\"http://graphml.graphdrawing.org/xmlns\" xmlns:y=\"http://www.yworks.com/xml/graphml\" xmlns:yed=\"http://www.yworks.com/xml/yed/3\">\n<key for=\"node\" id=\"ng\" yfiles.type=\"nodegraphics\"/><key for=\"graphml\" id=\"res\" yfiles.type=\"resources\"/><key for=\"edge\" id=\"eg\" yfiles.type=\"edgegraphics\"/>\n<graph edgedefault=\"directed\" id=\"G\"><node id=\"Macromolecule\"><data key=\"ng\">\n            <y:GenericNode configuration=\"com.yworks.sbgn.Macromolecule\">\n              <y:Geometry height=\"40.0\" width=\"80.0\" x=\"-3.389945794503319\" y=\"-1009.2463575468996\"/>\n              <y:Fill color=\"#C2D4ED\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"20.48828125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"66.75390625\" x=\"6.623046875\" xml:space=\"preserve\" y=\"9.755859375\">PRKAR2A<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n              <y:StyleProperties>\n                <y:Property class=\"java.lang.Integer\" name=\"com.yworks.sbgn.style.radius\" value=\"10\"/>\n                </y:StyleProperties>\n            </y:GenericNode>\n          </data>\n        </node><node id=\"SimpleChemical\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.SimpleChemical\">\n          <y:Geometry height=\"32.0\" width=\"60.0\" x=\"-236.38994579450332\" y=\"-1293.5286796905107\"/>\n          <y:Fill color=\"#DBEBDB\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"20.48828125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"40.626953125\" x=\"9.6865234375\" xml:space=\"preserve\" y=\"5.755859375\">cAMP<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"NucleicAcidFeature\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.NucleicAcidFeature\">\n          <y:Geometry height=\"40.0\" width=\"80.0\" x=\"-758.1053993470131\" y=\"222.21424375000015\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"20.48828125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"39.533203125\" x=\"20.2333984375\" xml:space=\"preserve\" y=\"9.755859375\">ACLY<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n          <y:StyleProperties>\n            <y:Property class=\"java.lang.Integer\" name=\"com.yworks.sbgn.style.radius\" value=\"10\"/>\n          </y:StyleProperties>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"EmptySet\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.EmptySet\">\n          <y:Geometry height=\"36.0\" width=\"36.0\" x=\"-519.4234568972432\" y=\"294.78362942377265\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" hasText=\"false\" height=\"4.0\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"4.0\" x=\"16.0\" y=\"16.0\">\n            <y:LabelModel>\n              <y:SmartNodeLabelModel distance=\"4.0\"/>\n            </y:LabelModel>\n            <y:ModelParameter>\n              <y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/>\n            </y:ModelParameter>\n          </y:NodeLabel>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"Phenotype\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.Phenotype\">\n          <y:Geometry height=\"52.80896498781118\" width=\"131.58053892154615\" x=\"-209.8865559373529\" y=\"391.8409981737723\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"36.9765625\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"77.6025390625\" x=\"26.98899992952306\" xml:space=\"preserve\" y=\"7.916201243905562\">Histone \nacetylation<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"Submap\"><data key=\"ng\">\n            <y:GenericNode configuration=\"com.yworks.sbgn.Submap\">\n              <y:Geometry height=\"59.1015428675409\" width=\"130.20681290958444\" x=\"119.6332845277892\" y=\"803.360851925766\"/>\n              <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"36.9765625\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"107.22265625\" x=\"11.492078329792221\" xml:space=\"preserve\" y=\"11.062490183770478\">Transcription \nof target genes<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n            </y:GenericNode>\n          </data>\n        </node><node id=\"Tag\"><data key=\"ng\">\n            <y:GenericNode configuration=\"com.yworks.sbgn.Tag\">\n              <y:Geometry height=\"30.0\" width=\"60.0\" x=\"0.0\" y=\"0.0\"/>\n              <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"20.296875\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"4.0\" x=\"28.0\" xml:space=\"preserve\" y=\"4.8515625\"><y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n            </y:GenericNode>\n          </data>\n        </node><node id=\"Process\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.Process\">\n          <y:Geometry height=\"18.0\" width=\"18.0\" x=\"-96.04870136708445\" y=\"-1257.5907758659534\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" bottomInset=\"0\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" hasText=\"false\" height=\"0.0\" horizontalTextPosition=\"center\" iconTextGap=\"4\" leftInset=\"0\" modelName=\"custom\" rightInset=\"0\" textColor=\"#000000\" topInset=\"0\" verticalTextPosition=\"center\" visible=\"true\" width=\"0.0\" x=\"9.0\" y=\"9.0\">\n            <y:LabelModel>\n              <y:SmartNodeLabelModel distance=\"4.0\"/>\n            </y:LabelModel>\n            <y:ModelParameter>\n              <y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/>\n            </y:ModelParameter>\n          </y:NodeLabel>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"Operator\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.Operator\">\n          <y:Geometry height=\"30.0\" width=\"30.0\" x=\"-304.4904132222805\" y=\"-1346.5286796905107\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" bottomInset=\"0\" fontFamily=\"Dialog\" fontSize=\"12\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"14.1328125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" leftInset=\"0\" modelName=\"custom\" rightInset=\"0\" textColor=\"#000000\" topInset=\"0\" verticalTextPosition=\"center\" visible=\"true\" width=\"16.91015625\" x=\"6.544921875\" xml:space=\"preserve\" y=\"7.93359375\">OR<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"Complex\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.Complex\">\n          <y:Geometry height=\"60.0\" width=\"140.0\" x=\"-290.0\" y=\"85.0\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"20.48828125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"internal\" modelPosition=\"c\" textColor=\"#000000\" verticalTextPosition=\"bottom\" visible=\"true\" width=\"114.1884765625\" x=\"12.90576171875\" xml:space=\"preserve\" y=\"19.755859375\">26S proteasome</y:NodeLabel>\n        </y:GenericNode>\n      </data>\n    </node><node id=\"ComplexGroup\" yfiles.foldertype=\"group\"><data key=\"ng\">\n        <y:ProxyAutoBoundsNode>\n          <y:Realizers active=\"0\">\n            <y:GenericGroupNode configuration=\"com.yworks.sbgn.Complex\">\n              <y:Geometry height=\"73.0577864671402\" width=\"174.51236042159843\" x=\"-13.38994579450332\" y=\"-1025.370275261926\"/>\n              <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" borderDistance=\"8.0\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" hasText=\"false\" height=\"4.0\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"internal\" modelPosition=\"t\" textColor=\"#000000\" verticalTextPosition=\"bottom\" visible=\"true\" width=\"4.0\" x=\"85.25618021079922\" y=\"8.0\"/>\n              <y:StyleProperties>\n                <y:Property class=\"java.lang.Integer\" name=\"com.yworks.sbgn.style.radiusY\" value=\"12\"/>\n                <y:Property class=\"java.lang.Integer\" name=\"com.yworks.sbgn.style.radiusX\" value=\"12\"/>\n              </y:StyleProperties>\n              <y:State autoResize=\"false\" closed=\"false\" closedHeight=\"80.0\" closedWidth=\"80.0\"/>\n              <y:Insets bottom=\"15\" bottomF=\"15.0\" left=\"10\" leftF=\"10.0\" right=\"10\" rightF=\"10.0\" top=\"10\" topF=\"10.0\"/>\n              <y:BorderInsets bottom=\"0\" bottomF=\"0.0\" left=\"0\" leftF=\"0.0\" right=\"0\" rightF=\"0.0\" top=\"0\" topF=\"0.0\"/>\n            </y:GenericGroupNode>\n            <y:GenericGroupNode configuration=\"com.yworks.sbgn.Complex\">\n              <y:Geometry height=\"80.0\" width=\"80.0\" x=\"553.2728174603176\" y=\"-237.95622840696382\"/>\n              <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" borderDistance=\"8.0\" fontFamily=\"Dialog\" fontSize=\"12\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"18.1328125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"internal\" modelPosition=\"t\" textColor=\"#000000\" verticalTextPosition=\"bottom\" visible=\"true\" width=\"38.482421875\" x=\"20.7587890625\" xml:space=\"preserve\" y=\"8.0\">LABEL</y:NodeLabel>\n              <y:StyleProperties>\n                <y:Property class=\"java.lang.Integer\" name=\"com.yworks.sbgn.style.radiusY\" value=\"12\"/>\n                <y:Property class=\"java.lang.Integer\" name=\"com.yworks.sbgn.style.radiusX\" value=\"12\"/>\n              </y:StyleProperties>\n              <y:State autoResize=\"true\" closed=\"true\" closedHeight=\"80.0\" closedWidth=\"80.0\"/>\n              <y:Insets bottom=\"15\" bottomF=\"15.0\" left=\"10\" leftF=\"10.0\" right=\"10\" rightF=\"10.0\" top=\"10\" topF=\"10.0\"/>\n              <y:BorderInsets bottom=\"0\" bottomF=\"0.0\" left=\"0\" leftF=\"0.0\" right=\"0\" rightF=\"0.0\" top=\"0\" topF=\"0.0\"/>\n            </y:GenericGroupNode>\n          </y:Realizers>\n        </y:ProxyAutoBoundsNode>\n      </data>\n      <graph edgedefault=\"directed\" id=\"ComplexGroup:\"/></node><node id=\"Compartment\" yfiles.foldertype=\"group\"><data key=\"ng\">\n        <y:ProxyAutoBoundsNode>\n          <y:Realizers active=\"0\">\n            <y:GroupNode>\n              <y:Geometry height=\"740.9091341579448\" width=\"1048.4367269267366\" x=\"-180.39866793529967\" y=\"187.09086584205528\"/>\n              <y:Fill color=\"#EDEBE472\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"2.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" borderDistance=\"0.0\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"20.48828125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"internal\" modelPosition=\"t\" textColor=\"#000000\" verticalTextPosition=\"bottom\" visible=\"true\" width=\"125.6044921875\" x=\"461.4161173696183\" xml:space=\"preserve\" y=\"0.0\">MITOCHONDRION</y:NodeLabel>\n              <y:Shape type=\"roundrectangle\"/>\n              <y:State autoResize=\"false\" closed=\"false\" closedHeight=\"80.0\" closedWidth=\"80.0\" innerGraphDisplayEnabled=\"false\"/>\n              <y:Insets bottom=\"15\" bottomF=\"15.0\" left=\"15\" leftF=\"15.0\" right=\"15\" rightF=\"15.0\" top=\"15\" topF=\"15.0\"/>\n              <y:BorderInsets bottom=\"38\" bottomF=\"38.0\" left=\"1\" leftF=\"0.9657469077069152\" right=\"129\" rightF=\"129.03805899143686\" top=\"0\" topF=\"0.0\"/>\n            </y:GroupNode>\n            <y:GroupNode>\n              <y:Geometry height=\"740.0\" width=\"1280.0\" x=\"75.0\" y=\"515.0\"/>\n              <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n              <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n              <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" borderDistance=\"0.0\" fontFamily=\"Dialog\" fontSize=\"10\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"15.77734375\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"internal\" modelPosition=\"t\" textColor=\"#000000\" verticalTextPosition=\"bottom\" visible=\"true\" width=\"49.7275390625\" x=\"615.13623046875\" xml:space=\"preserve\" y=\"0.0\">CYTOSOL</y:NodeLabel>\n              <y:Shape type=\"roundrectangle\"/>\n              <y:State closed=\"true\" closedHeight=\"740.0\" closedWidth=\"1280.0\" innerGraphDisplayEnabled=\"false\"/>\n              <y:Insets bottom=\"15\" bottomF=\"15.0\" left=\"15\" leftF=\"15.0\" right=\"15\" rightF=\"15.0\" top=\"15\" topF=\"15.0\"/>\n              <y:BorderInsets bottom=\"0\" bottomF=\"0.0\" left=\"0\" leftF=\"0.0\" right=\"0\" rightF=\"0.0\" top=\"0\" topF=\"0.0\"/>\n            </y:GroupNode>\n          </y:Realizers>\n        </y:ProxyAutoBoundsNode>\n      </data>\n      <graph edgedefault=\"directed\" id=\"Compartment:\"/></node><node id=\"IconLabel\"><data key=\"ng\"><y:GenericNode configuration=\"com.yworks.sbgn.Macromolecule\"><y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" borderDistance=\"0.0\" bottomInset=\"0\" fontFamily=\"Dialog\" fontSize=\"12\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" hasText=\"false\" height=\"16.0\" horizontalTextPosition=\"center\" iconData=\"1\" iconTextGap=\"0\" leftInset=\"0\" modelName=\"custom\" rightInset=\"0\" textColor=\"#000000\" topInset=\"0\" verticalTextPosition=\"center\" visible=\"true\" width=\"25.0\" x=\"27.5\" y=\"-8.0\">\n                <y:LabelModel>\n                  <y:SmartNodeLabelModel distance=\"4.0\"/>\n                </y:LabelModel>\n                <y:ModelParameter>\n                  <y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"-0.5\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/>\n                </y:ModelParameter>\n              </y:NodeLabel>\n              </y:GenericNode></data></node><edge id=\"Arc\" source=\"Process\" target=\"Process\">\n      <data key=\"eg\">\n        <y:PolyLineEdge>\n          <y:Path sx=\"0.0\" sy=\"0.0\" tx=\"0.0\" ty=\"0.0\"/>\n          <y:LineStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:Arrows source=\"none\" target=\"none\"/>\n          <y:BendStyle smoothed=\"false\"/>\n        </y:PolyLineEdge>\n      </data>\n    </edge>\n    <edge id=\"Cardinality\" source=\"Process\" target=\"Process\"><data key=\"eg\"><y:PolyLineEdge><y:EdgeLabel alignment=\"center\" backgroundColor=\"#FFFFFF\" configuration=\"AutoFlippingLabel\" distance=\"2.0\" fontFamily=\"Dialog\" fontSize=\"9\" fontStyle=\"plain\" height=\"18.1328125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" lineColor=\"#9AA0A6\" modelName=\"six_pos\" modelPosition=\"center\" preferredPlacement=\"anywhere\" ratio=\"0.5\" textColor=\"#9AA0A6\" verticalTextPosition=\"bottom\" visible=\"true\" width=\"11.587890625\" x=\"-14.597963825767152\" xml:space=\"preserve\" y=\"42.184831929275674\">4<y:PreferredPlacementDescriptor angle=\"0.0\" angleOffsetOnRightSide=\"0\" angleReference=\"absolute\" angleRotationOnRightSide=\"co\" distance=\"-1.0\" frozen=\"true\" placement=\"anywhere\" side=\"anywhere\" sideReference=\"relative_to_edge_flow\"/></y:EdgeLabel></y:PolyLineEdge></data></edge>\n    <node id=\"UnspecifiedEntity\"><data key=\"ng\">\n        <y:GenericNode configuration=\"com.yworks.sbgn.UnspecifiedEntity\">\n          <y:Geometry height=\"40.0\" width=\"80.0\" x=\"671.0\" y=\"168.0\"/>\n          <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n          <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n          <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"14\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"18.1328125\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"70.984375\" x=\"4.5078125\" xml:space=\"preserve\" y=\"10.93359375\">unspecified<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n        </y:GenericNode>\n      </data></node></graph><data key=\"res\"><y:Resources><y:Resource id=\"StateVariable\">\n        <yed:NodeRealizerIcon>\n          <y:GenericNode configuration=\"com.yworks.sbgn.StateVariable\">\n            <y:Geometry height=\"18.0\" width=\"18.0\" x=\"0.0\" y=\"0.0\"/>\n            <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n            <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n            <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"10\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"15.77734375\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"9.52734375\" x=\"2.736328125\" xml:space=\"preserve\" y=\"-0.388671875\">P<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n          </y:GenericNode>\n        </yed:NodeRealizerIcon>\n      </y:Resource>\n      <y:Resource id=\"UnitOfInformation\">\n        <yed:NodeRealizerIcon>\n          <y:GenericNode configuration=\"com.yworks.sbgn.UnitOfInformation\">\n            <y:Geometry height=\"16.0\" width=\"45.0\" x=\"0.0\" y=\"0.0\"/>\n            <y:Fill color=\"#FFFFFF\" transparent=\"false\"/>\n            <y:BorderStyle color=\"#000000\" type=\"line\" width=\"1.0\"/>\n            <y:NodeLabel alignment=\"center\" autoSizePolicy=\"content\" fontFamily=\"Dialog\" fontSize=\"10\" fontStyle=\"plain\" hasBackgroundColor=\"false\" hasLineColor=\"false\" height=\"15.77734375\" horizontalTextPosition=\"center\" iconTextGap=\"4\" modelName=\"custom\" textColor=\"#000000\" verticalTextPosition=\"center\" visible=\"true\" width=\"39.6103515625\" x=\"2.69482421875\" xml:space=\"preserve\" y=\"-0.388671875\">ct:gene<y:LabelModel><y:SmartNodeLabelModel distance=\"4.0\"/></y:LabelModel><y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX=\"0.0\" labelRatioY=\"0.0\" nodeRatioX=\"0.0\" nodeRatioY=\"0.0\" offsetX=\"0.0\" offsetY=\"0.0\" upX=\"0.0\" upY=\"-1.0\"/></y:ModelParameter></y:NodeLabel>\n          </y:GenericNode>\n        </yed:NodeRealizerIcon>\n      </y:Resource>\n      </y:Resources></data></graphml>";
  var api = { graphml: graphml, VERSION: VERSION };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.sbgnml_read = api;
})(typeof self !== 'undefined' ? self : this);
