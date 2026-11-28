// Built by editor/build.js from editor/src/ (entry src/main.js); edit the sources, then run the build.
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // renderers/converter/graphml_edit.js
  var require_graphml_edit = __commonJS({
    "renderers/converter/graphml_edit.js"(exports, module) {
      (function(root) {
        "use strict";
        var G2 = "http://graphml.graphdrawing.org/xmlns", Y2 = "http://www.yworks.com/xml/graphml";
        function els(el) {
          return el.children ? Array.prototype.slice.call(el.children) : Array.prototype.filter.call(el.childNodes, function(c) {
            return c.nodeType === 1;
          });
        }
        function num2(el, a) {
          return parseFloat(el.getAttribute(a));
        }
        function fmt2(v) {
          v = Math.round(v * 1e3) / 1e3;
          return v % 1 ? String(v) : v.toFixed(1);
        }
        function realizerOf2(el) {
          var cs = els(el);
          for (var i = 0; i < cs.length; i++) {
            var dd = cs[i];
            if (dd.localName !== "data") continue;
            var rs0 = els(dd);
            for (var j = 0; j < rs0.length; j++) {
              var r = rs0[j];
              if (r.namespaceURI !== Y2) continue;
              if (r.localName === "ProxyAutoBoundsNode") {
                var rs = r.getElementsByTagNameNS(Y2, "Realizers")[0];
                return rs ? els(rs)[parseInt(rs.getAttribute("active") || "0", 10)] || null : null;
              }
              return r;
            }
          }
          return null;
        }
        function shapeOf(r) {
          var props2 = {}, kind;
          Array.prototype.forEach.call(r.getElementsByTagNameNS(Y2, "Property"), function(p) {
            props2[(p.getAttribute("name") || "").replace("com.yworks.sbgn.style.", "")] = p.getAttribute("value");
          });
          if (/^Generic/.test(r.localName)) kind = (r.getAttribute("configuration") || "").replace("com.yworks.sbgn.", "");
          else {
            var sh = r.getElementsByTagNameNS(Y2, "Shape")[0];
            kind = sh ? sh.getAttribute("type") : "rectangle";
          }
          return { kind, props: props2 };
        }
        function read2(t, opt) {
          opt = opt || {};
          var doc2 = opt.doc;
          if (!doc2) {
            var DP = opt.DOMParser || root.DOMParser, bad = false;
            if (!DP) throw "no DOMParser (under Node: opt.DOMParser)";
            try {
              doc2 = new DP({ onError: function(l) {
                if (l !== "warning") bad = true;
              } }).parseFromString(t, "application/xml");
            } catch (e) {
              bad = true;
            }
            if (bad || !doc2 || !doc2.documentElement) throw "not a readable XML file";
          }
          if (doc2.getElementsByTagName("parsererror").length) throw "not a readable XML file";
          var geos2 = Array.prototype.slice.call(doc2.getElementsByTagNameNS(Y2, "Geometry"));
          var points2 = Array.prototype.slice.call(doc2.getElementsByTagNameNS(Y2, "Point"));
          if ((t.match(/<y:Geometry\s/g) || []).length !== geos2.length || (t.match(/<y:Point\s/g) || []).length !== points2.length)
            throw "the file is not written as yEd writes it";
          var owner2 = function(e, tag) {
            for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === tag && p.namespaceURI === G2) return p;
            return null;
          };
          var gi = /* @__PURE__ */ new Map(), byEl = /* @__PURE__ */ new Map();
          geos2.forEach(function(g, i) {
            gi.set(g, i);
          });
          var nodes = Array.prototype.slice.call(doc2.getElementsByTagNameNS(G2, "node")).map(function(n, i) {
            byEl.set(n, i);
            return { el: n, id: n.getAttribute("id"), geo: [] };
          });
          geos2.forEach(function(g, i) {
            var n = owner2(g, "node");
            if (n && byEl.has(n)) nodes[byEl.get(n)].geo.push(i);
          });
          nodes = nodes.filter(function(n) {
            return n.geo.length;
          });
          byEl = /* @__PURE__ */ new Map();
          nodes.forEach(function(n, i) {
            byEl.set(n.el, i);
          });
          nodes.forEach(function(n) {
            n.inside = Array.prototype.slice.call(n.el.getElementsByTagNameNS(G2, "node")).map(function(c) {
              return byEl.get(c);
            }).filter(function(c) {
              return c != null;
            });
            n.kids = n.inside.filter(function(c) {
              return owner2(nodes[c].el, "node") === n.el;
            });
            var r = realizerOf2(n.el), g = r && r.getElementsByTagNameNS(Y2, "Geometry")[0];
            n.ag = g && gi.has(g) ? gi.get(g) : n.geo[0];
            n.shape = r ? shapeOf(r) : { kind: "rectangle", props: {} };
            n.hub = !opt.cd && /sbgn\.(Process|Operator)$/.test(r ? r.getAttribute("configuration") || "" : "");
            n.eq = n.hub && n.shape.kind === "Operator" && Array.prototype.some.call(r.getElementsByTagNameNS(Y2, "NodeLabel"), function(l) {
              return l.textContent.trim() === "\u2261";
            });
            n.up = null;
            n.comp = n.el.getAttribute("yfiles.foldertype") === "group" && !/omplex/.test(r ? r.getAttribute("configuration") || "" : "");
            var ins = r && r.getElementsByTagNameNS(Y2, "Insets")[0], iv = function(k) {
              return ins ? parseFloat(ins.getAttribute(k + "F") || ins.getAttribute(k)) || 0 : 0;
            };
            n.ins = [iv("left"), iv("top"), iv("right"), iv("bottom")];
            n.lab = { t: 0, b: 0 };
            if (r) els(r).forEach(function(l) {
              if (l.localName !== "NodeLabel" || l.getAttribute("modelName") !== "internal" || l.getAttribute("visible") === "false") return;
              var side = (l.getAttribute("modelPosition") || "").charAt(0);
              if (side === "t" || side === "b") n.lab[side] = Math.max(n.lab[side], parseFloat(l.getAttribute("height")) || 0);
              if (!n.labPos) n.labPos = l.getAttribute("modelPosition") || "c";
            });
          });
          nodes.forEach(function(n, i) {
            n.kids.forEach(function(c) {
              nodes[c].up = i;
            });
          });
          var byId = {};
          nodes.forEach(function(n, i) {
            byId[n.id] = i;
          });
          var pi = /* @__PURE__ */ new Map();
          points2.forEach(function(p, i) {
            pi.set(p, i);
          });
          var edges = Array.prototype.slice.call(doc2.getElementsByTagNameNS(G2, "edge")).map(function(e) {
            var ar = e.getElementsByTagNameNS(Y2, "Arrows")[0];
            return {
              id: e.getAttribute("id"),
              s: byId[e.getAttribute("source")],
              t: byId[e.getAttribute("target")],
              path: e.getElementsByTagNameNS(Y2, "Path")[0] || null,
              arr: ar ? [ar.getAttribute("source") || "none", ar.getAttribute("target") || "none"] : ["none", "none"],
              pts: Array.prototype.slice.call(e.getElementsByTagNameNS(Y2, "Point")).map(function(p) {
                return pi.get(p);
              }),
              smooth: e.getElementsByTagNameNS(Y2, "QuadCurveEdge").length > 0 || Array.prototype.some.call(e.getElementsByTagNameNS(Y2, "BendStyle"), function(b) {
                return b.getAttribute("smoothed") === "true";
              })
            };
          });
          var byE = {};
          edges.forEach(function(e, k) {
            byE[e.id] = k;
          });
          var procs = [];
          nodes.forEach(function(n, i) {
            var m = n.id.match(/^(.*)\|proc$/);
            if (m && byE[m[1] + "|a"] != null && byE[m[1] + "|b"] != null) procs.push({ g: i, a: byE[m[1] + "|a"], b: byE[m[1] + "|b"] });
          });
          return { doc: doc2, geos: geos2, points: points2, nodes, edges, procs };
        }
        function place(t, g, p) {
          var k = { "Geometry": -1, "Point": -1 };
          return t.replace(/<y:(Geometry|Point)\s[^>]*>/g, function(tag, kind) {
            var i = ++k[kind], v = (kind === "Geometry" ? g : p)[i];
            if (!v) return tag;
            return tag.replace(/(\sx=")[^"]*"/, "$1" + v[0] + '"').replace(/(\sy=")[^"]*"/, "$1" + v[1] + '"');
          });
        }
        function boxes(t, at2) {
          var i = -1;
          return t.replace(/<y:Geometry\s[^>]*>/g, function(tag) {
            var v = at2[++i];
            if (v) ["x", "y", "width", "height"].forEach(function(a, j) {
              tag = tag.replace(new RegExp("(\\s" + a + '=")[^"]*"'), "$1" + v[j] + '"');
            });
            return tag;
          });
        }
        function insets(t, id, ins, bins) {
          var q = id.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
          var m = new RegExp('<node(?=[\\s>/])[^>]*?\\sid="' + q + '"').exec(t);
          if (!m) return t;
          var rest = t.slice(m.index), own2 = rest.slice(0, Math.min.apply(null, [rest.search(/<graph(?=[\s>\/])/), rest.indexOf("</node>")].filter(function(k2) {
            return k2 >= 0;
          }).concat([rest.length])));
          var act = /<y:Realizers\s[^>]*active="(\d+)"/.exec(own2), k = act ? +act[1] : 0, put2 = [];
          [["Insets", ins], ["BorderInsets", bins]].forEach(function(q2) {
            var re = new RegExp("<y:" + q2[0] + "\\s[^>]*>", "g"), x;
            for (var j = 0; (x = re.exec(own2)) && j < k; j++) ;
            if (!x) return;
            var tag = x[0];
            ["left", "top", "right", "bottom"].forEach(function(sd, j2) {
              var v = q2[1][j2];
              if (v == null) return;
              v = Math.round(v * 1e3) / 1e3;
              tag = tag.replace(new RegExp("(\\s" + sd + '=")[^"]*"'), "$1" + Math.trunc(v) + '"').replace(new RegExp("(\\s" + sd + 'F=")[^"]*"'), "$1" + (v % 1 ? String(v) : v + ".0") + '"');
            });
            if (tag !== x[0]) put2.push([m.index + x.index, x[0].length, tag]);
          });
          put2.sort(function(a, b) {
            return b[0] - a[0];
          }).forEach(function(q2) {
            t = t.slice(0, q2[0]) + q2[2] + t.slice(q2[0] + q2[1]);
          });
          return t;
        }
        function ends(t, by, re) {
          var c = -1, ce = -1;
          if (re) t = t.replace(/<edge\b[^>]*>/g, function(tag) {
            return ++ce !== re.k ? tag : tag.replace(new RegExp("(\\s" + re.att + `\\s*=\\s*)("[^"]*"|'[^']*')`), function(m, p1) {
              return p1 + '"' + re.id + '"';
            });
          });
          return t.replace(/<y:Path\b[^>]*>/g, function(tag) {
            var kv = by.get(++c);
            if (!kv) return tag;
            kv.forEach(function(q) {
              var r = new RegExp("(\\s" + q[0] + '=")[^"]*"');
              tag = r.test(tag) ? tag.replace(r, "$1" + q[1] + '"') : tag.replace(/(\/?>)$/, " " + q[0] + '="' + q[1] + '"$1');
            });
            return tag;
          });
        }
        function pathOf(t, id, kv) {
          var xid = id.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return t.replace(new RegExp('(<edge id="' + xid + '"(?:(?!</edge>)[\\s\\S])*?<y:Path)([^>]*?)(/?>)'), function(m, a, at2, close) {
            kv.forEach(function(k) {
              var v = " " + k[0] + '="' + k[1] + '"', re = new RegExp("\\s" + k[0] + '="[^"]*"');
              at2 = re.test(at2) ? at2.replace(re, v) : at2 + v;
            });
            return a + at2 + close;
          });
        }
        function bend2(t, at2, x, y) {
          var tag = '<y:Point x="' + fmt2(x) + '" y="' + fmt2(y) + '"/>';
          var nth = function(re, n) {
            var m2, c = -1;
            re.lastIndex = 0;
            while (m2 = re.exec(t)) if (++c === n) return m2;
            return null;
          };
          var indent = function(pos) {
            var s0 = t.lastIndexOf("\n", pos - 1) + 1;
            return t.slice(s0, pos).match(/^[ \t]*/)[0];
          };
          var m;
          if (at2.before != null) {
            m = nth(/<y:Point\s[^>]*>/g, at2.before);
            if (!m) return null;
            return t.slice(0, m.index) + tag + "\n" + indent(m.index) + t.slice(m.index);
          }
          if (at2.after != null) {
            m = nth(/<y:Point\s[^>]*>/g, at2.after);
            if (!m) return null;
            var end = m.index + m[0].length;
            return t.slice(0, end) + "\n" + indent(m.index) + tag + t.slice(end);
          }
          m = nth(/<y:Path[\s>\/][^>]*>/g, at2.path);
          if (!m) return null;
          var w = indent(m.index), end2 = m.index + m[0].length;
          return /\/>$/.test(m[0]) ? t.slice(0, m.index) + m[0].replace(/\s*\/>$/, ">") + "\n" + w + "  " + tag + "\n" + w + "</y:Path>" + t.slice(end2) : t.slice(0, end2) + "\n" + w + "  " + tag + t.slice(end2);
        }
        function unbend2(t, list2) {
          list2 = list2.slice().sort(function(a, b) {
            return b - a;
          });
          list2.forEach(function(pi) {
            var re = /<y:Point\s[^>]*>/g, m, c = -1;
            while (m = re.exec(t)) if (++c === pi) break;
            if (!m) return;
            var a = m.index, b = m.index + m[0].length;
            var s0 = t.lastIndexOf("\n", a - 1) + 1;
            if (/^[ \t]*$/.test(t.slice(s0, a)) && t[b] === "\n") {
              a = s0;
              b += 1;
            }
            t = t.slice(0, a) + t.slice(b);
          });
          return t;
        }
        function shiftTag(tag, sx2, sy2) {
          if (sx2) tag = tag.replace(/(\sx=")([^"]*)"/, function(a, k, v) {
            return k + fmt2(parseFloat(v) + sx2) + '"';
          });
          if (sy2) tag = tag.replace(/(\sy=")([^"]*)"/, function(a, k, v) {
            return k + fmt2(parseFloat(v) + sy2) + '"';
          });
          return tag;
        }
        function shift2(t, sx2, sy2) {
          return !sx2 && !sy2 ? t : t.replace(/<y:(?:Geometry|Point)\s[^>]*>/g, function(tag) {
            return shiftTag(tag, sx2, sy2);
          });
        }
        function shiftOf(bs, ps, block) {
          var mx = Infinity, my = Infinity;
          bs.concat(ps).forEach(function(b) {
            mx = Math.min(mx, b[0]);
            my = Math.min(my, b[1]);
          });
          var by = function(m) {
            return m < 0 ? Math.ceil((40 - m) / block) * block : 0;
          }, sx2 = by(mx), sy2 = by(my);
          return sx2 || sy2 ? [sx2, sy2] : null;
        }
        var api2 = {
          G: G2,
          Y: Y2,
          read: read2,
          realizerOf: realizerOf2,
          place,
          boxes,
          insets,
          ends,
          pathOf,
          bend: bend2,
          unbend: unbend2,
          shift: shift2,
          shiftOf,
          fmt: fmt2,
          num: num2
        };
        if (typeof module !== "undefined" && module.exports) module.exports = api2;
        else root.graphml_edit = api2;
      })(typeof self !== "undefined" ? self : exports);
    }
  });

  // renderers/layout/holding.js
  var require_holding = __commonJS({
    "renderers/layout/holding.js"(exports, module) {
      (function(root) {
        "use strict";
        function inBox2(b, c) {
          return c[0] <= b[0] && c[1] <= b[1] && b[0] + b[2] <= c[0] + c[2] && b[1] + b[3] <= c[1] + c[3];
        }
        function overlap2(b, c) {
          return b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3];
        }
        function make(M) {
          var nodes = M.nodes, boxOf2 = M.box;
          var extOf2 = function(k, b) {
            return M.ext ? M.ext(k, b) : [b[0], b[1], b[0] + b[2], b[1] + b[3]];
          };
          function under2(i, a) {
            for (var u = nodes[i].up; u != null; u = nodes[u].up) if (u === a) return true;
            return false;
          }
          function notIn(i) {
            return function(k) {
              return k === i || under2(k, i);
            };
          }
          function inComplex2(i) {
            for (var u = nodes[i].up; u != null; u = nodes[u].up) if (nodes[u].shape.kind === "Complex") return true;
            return false;
          }
          function cdOwn(i) {
            return !!M.cd && nodes[i].id.indexOf("|") >= 0;
          }
          function holder2(b, not, B) {
            var best = null, area = Infinity;
            B = B || boxOf2;
            nodes.forEach(function(n, k) {
              if (!n.comp || not(k)) return;
              var c = B(k);
              if (inBox2(b, c) && c[2] * c[3] < area) {
                area = c[2] * c[3];
                best = k;
              }
            });
            return best;
          }
          function tops2(set, alone) {
            return Array.from(set).filter(function(i) {
              return !cdOwn(i) && (alone ? nodes[i].comp : !(nodes[i].up != null && set.has(nodes[i].up)));
            });
          }
          function cxRoom(n) {
            var p = M.cx, R = M.room;
            if (p === "repack" && R) return [R.left, R.top + n.lab.t, R.right, n.lab.b ? R.named + n.lab.b : R.bottom];
            if (p === "repack") p = 12;
            return [p, p + n.lab.t, p, p + n.lab.b];
          }
          function grown2(ks, B, B0, moving2, away2) {
            var nb = {}, box3 = function(k) {
              return nb[k] || B(k);
            }, PAD = M.pad;
            var hold = function(k) {
              var p = nodes[k].up;
              if (p == null || moving2(p)) return;
              var n = nodes[p], c = box3(p), b = box3(k), w, e = extOf2(k, b);
              var s0 = B0(k), c0 = B0(p), e0 = extOf2(k, s0);
              var far = away2 && moving2(k) ? [away2.x1, away2.y1, -away2.x0, -away2.y0] : [0, 0, 0, 0];
              if (n.shape.kind === "Complex") {
                var g0 = [e0[0] - c0[0], e0[1] - c0[1], c0[0] + c0[2] - e0[2], c0[1] + c0[3] - e0[3]];
                var rm = cxRoom(n).map(function(v, j) {
                  return g0[j] + far[j] >= v ? v : Math.min(v, Math.max(g0[j], 0));
                });
                w = [e[0] - rm[0], e[1] - rm[1], e[2] + rm[2], e[3] + rm[3]];
              } else if (inBox2(s0, c0)) {
                var io = [M.cd ? n.ins[0] : 0, (M.cd ? n.ins[1] : 0) + n.lab.t, M.cd ? n.ins[2] : 0, (M.cd ? n.ins[3] : 0) + n.lab.b];
                var pad = [e0[0] - c0[0], e0[1] - c0[1], c0[0] + c0[2] - e0[2], c0[1] + c0[3] - e0[3]].map(function(v, j) {
                  return (v - io[j] + far[j] >= PAD ? PAD : Math.min(PAD, v - io[j])) + io[j];
                });
                w = [e[0] - pad[0], e[1] - pad[1], e[2] + pad[2], e[3] + pad[3]];
              } else if (overlap2(s0, c0) && moving2(k) && !nodes[k].comp && drawnOut(k, p, s0, c0, B0)) {
                var m0 = [s0[0] + s0[2] / 2 - c0[0], s0[1] + s0[3] / 2 - c0[1], c0[0] + c0[2] - s0[0] - s0[2] / 2, c0[1] + c0[3] - s0[1] - s0[3] / 2].map(function(v, j) {
                  return v + far[j] >= 1 ? 1 : v;
                });
                var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
                w = [cx - m0[0], cy - m0[1], cx + m0[2], cy + m0[3]];
              } else if (overlap2(s0, c0)) w = [b[0] + b[2] - 1, b[1] + b[3] - 1, b[0] + 1, b[1] + 1];
              else return;
              var x02 = Math.min(c[0], w[0]), y02 = Math.min(c[1], w[1]), x1 = Math.max(c[0] + c[2], w[2]), y1 = Math.max(c[1] + c[3], w[3]);
              if (Math.abs(x02 - c[0]) < 0.01 && Math.abs(y02 - c[1]) < 0.01 && Math.abs(x1 - c[0] - c[2]) < 0.01 && Math.abs(y1 - c[1] - c[3]) < 0.01) return;
              nb[p] = [x02, y02, x1 - x02, y1 - y02];
              hold(p);
            };
            ks.forEach(hold);
            return nb;
          }
          function drawnOut(k, p, s0, c0, B0) {
            return nodes.some(function(q, j) {
              if (!q.comp || j === p || j === k || under2(j, p) || under2(j, k)) return false;
              var d = B0(j), x02 = Math.max(s0[0], d[0]), y02 = Math.max(s0[1], d[1]), x1 = Math.min(s0[0] + s0[2], d[0] + d[2]), y1 = Math.min(s0[1] + s0[3], d[1] + d[3]);
              return x1 > x02 && y1 > y02 && !inBox2([x02, y02, x1 - x02, y1 - y02], c0);
            });
          }
          function regroup2(how, set, B, B0) {
            B = B || boxOf2;
            B0 = B0 || boxOf2;
            var out = /* @__PURE__ */ new Map(), fixed = function(k) {
              return nodes[k].hub || cdOwn(k);
            }, changed2 = [];
            var away2 = function(k, b, not) {
              if (!fixed(k)) return holder2(b, not, B);
              for (var u = nodes[k].up; u != null; u = nodes[u].up) if (nodes[u].comp && !not(u) && inBox2(b, B(u))) return u;
              return null;
            };
            set.forEach(function(i) {
              var n = nodes[i], p = n.up, b = B(i);
              if (cdOwn(i) || how === "plain" && (p != null && set.has(p) || inComplex2(i))) return;
              if (n.comp || how === "alone" && n.kids.length) changed2.push(i);
              var not = how === "plain" ? function(k) {
                return set.has(k);
              } : notIn(i), t;
              if (p != null && how === "alone" && nodes[p].shape.kind === "Complex") {
                if (!inBox2(b, B(p))) out.set(i, away2(i, b, not));
                return;
              }
              if (p != null && (how === "plain" ? true : how === "alone" ? overlap2(b, B(p)) : inBox2(b, B(p)))) {
                t = holder2(b, not, B);
                if (t == null || t === p || !under2(t, p) || fixed(i) || inBox2(B0(i), B0(t))) return;
              } else if (p == null) {
                t = holder2(b, not, B);
                if (t == null || fixed(i) || how === "box" && inBox2(B0(i), B0(t))) return;
              } else t = away2(i, b, not);
              if (t !== p) out.set(i, t);
            });
            changed2.forEach(function(i) {
              var n = nodes[i], b = B(i), b0 = B0(i);
              if (how !== "plain") n.kids.forEach(function(k) {
                if (set.has(k) || out.has(k)) return;
                var kb = B(k);
                if (n.comp ? !overlap2(kb, b) && overlap2(kb, b0) : !inBox2(kb, b) && inBox2(kb, b0)) out.set(k, away2(k, kb, notIn(k)));
              });
              if (!n.comp) return;
              var nu = out.has(i) ? out.get(i) : n.up;
              nodes.forEach(function(m, j) {
                if (j === i || set.has(j) || out.has(j) || fixed(j) || inComplex2(j) || under2(j, i) || j === nu || nu != null && under2(nu, j)) return;
                var jb = B(j);
                if (!inBox2(jb, b) || inBox2(jb, b0)) return;
                var t = holder2(jb, function(k) {
                  return k !== i && (k === j || under2(k, j));
                }, B);
                if (t !== m.up && (t === i || t != null && under2(t, i))) out.set(j, t);
              });
            });
            return out;
          }
          function roomy2(i, b, s, b0) {
            var n = nodes[i], x02 = Infinity, y02 = Infinity, x1 = -Infinity, y1 = -Infinity;
            var rm = cxRoom(n);
            n.kids.forEach(function(k) {
              var e = extOf2(k, boxOf2(k));
              x02 = Math.min(x02, e[0] - rm[0]);
              y02 = Math.min(y02, e[1] - rm[1]);
              x1 = Math.max(x1, e[2] + rm[2]);
              y1 = Math.max(y1, e[3] + rm[3]);
            });
            if (x02 === Infinity) return b;
            var L = b[0], T = b[1], R = b[0] + b[2], B = b[1] + b[3];
            if (/l/.test(s)) L = Math.min(L, Math.max(x02, b0[0]));
            if (/r/.test(s)) R = Math.max(R, Math.min(x1, b0[0] + b0[2]));
            if (/t/.test(s)) T = Math.min(T, Math.max(y02, b0[1]));
            if (/b/.test(s)) B = Math.max(B, Math.min(y1, b0[1] + b0[3]));
            return [L, T, R - L, B - T];
          }
          function keepMembers(i, b0, e) {
            var x02 = e[0], y02 = e[1], x1 = e[2], y1 = e[3];
            nodes[i].kids.forEach(function(k) {
              var q = boxOf2(k);
              if (!overlap2(q, b0)) return;
              x02 = Math.min(x02, q[0] + q[2] - 1);
              y02 = Math.min(y02, q[1] + q[3] - 1);
              x1 = Math.max(x1, q[0] + 1);
              y1 = Math.max(y1, q[1] + 1);
            });
            return [x02, y02, x1, y1];
          }
          return {
            placed: cdOwn,
            keepMembers,
            inBox: inBox2,
            overlap: overlap2,
            under: under2,
            notIn,
            inComplex: inComplex2,
            holder: holder2,
            tops: tops2,
            regroup: regroup2,
            grown: grown2,
            drawnOut,
            cxRoom,
            roomy: roomy2
          };
        }
        function moved(M, moves) {
          var up = M.nodes.map(function(n) {
            return n.up;
          });
          moves.forEach(function(m) {
            up[m[0]] = m[1];
          });
          var kids = M.nodes.map(function() {
            return [];
          });
          M.nodes.forEach(function(n, k) {
            var keep = n.kids.filter(function(c) {
              return up[c] === k;
            });
            kids[k] = keep;
          });
          moves.forEach(function(m) {
            if (m[1] != null && kids[m[1]].indexOf(m[0]) < 0) kids[m[1]].push(m[0]);
          });
          var nodes = M.nodes.map(function(n, k) {
            var o = Object.create(n);
            o.up = up[k];
            o.kids = kids[k];
            return o;
          });
          var M2 = {};
          Object.keys(M).forEach(function(key) {
            M2[key] = M[key];
          });
          M2.nodes = nodes;
          return M2;
        }
        function settle2(M, change) {
          var at2 = {};
          M.nodes.forEach(function(n, k) {
            at2[n.id] = k;
          });
          var set = new Set(change.ids.map(function(id) {
            return at2[id];
          }).filter(function(k) {
            return k != null;
          }));
          var B0 = function(k) {
            return change.before && change.before[M.nodes[k].id] || M.box(k);
          };
          var box3 = change.how === "box", regroups = !change.layout && (!box3 || Array.from(set).every(function(k) {
            return M.nodes[k].comp;
          }));
          var H2 = make(M), out = regroups ? H2.regroup(change.how, set, M.box, B0) : /* @__PURE__ */ new Map(), mv2 = [];
          out.forEach(function(t, i) {
            mv2.push([i, t]);
          });
          var M2 = moved(M, mv2), H22 = make(M2), boxes = {};
          var nb = box3 ? regroups ? {} : H22.grown(Array.from(set), M.box, B0, function() {
            return false;
          }) : H22.grown(H22.tops(set, change.how === "alone"), M.box, B0, function(k) {
            return set.has(k);
          }, change.away);
          Object.keys(nb).forEach(function(k) {
            boxes[M.nodes[+k].id] = nb[k];
          });
          return { moves: mv2.map(function(m) {
            return [M.nodes[m[0]].id, m[1] == null ? null : M.nodes[m[1]].id];
          }), boxes };
        }
        var api2 = { inBox: inBox2, overlap: overlap2, make, moved, settle: settle2 };
        if (typeof module !== "undefined" && module.exports) module.exports = api2;
        else root.holding = api2;
      })(typeof self !== "undefined" ? self : exports);
    }
  });

  // renderers/converter/notation.js
  var require_notation = __commonJS({
    "renderers/converter/notation.js"(exports, module) {
      (function(root) {
        "use strict";
        var ARCS2 = [
          "consumption",
          "production",
          "catalysis",
          "modulation",
          "stimulation",
          "inhibition",
          "necessary stimulation",
          "logic arc",
          "equivalence arc"
        ];
        var MODS2 = ["catalysis", "modulation", "stimulation", "inhibition", "necessary stimulation"];
        var INFL2 = ["modulation", "stimulation", "inhibition", "necessary stimulation"];
        var ENT = function(c) {
          return { kind: "entity", cls: c };
        }, GATE = function(c) {
          return { kind: "gate", cls: c };
        };
        var PROC = function(c) {
          return { kind: "process", cls: c };
        };
        var GRAPHML = {
          Macromolecule: ENT("macromolecule"),
          SimpleChemical: ENT("simple chemical"),
          NucleicAcidFeature: ENT("nucleic acid feature"),
          UnspecifiedEntity: ENT("unspecified entity"),
          Complex: ENT("complex"),
          EmptySet: ENT("empty set"),
          SourceAndSink: ENT("empty set"),
          PerturbingAgent: ENT("perturbing agent"),
          Phenotype: { kind: "phenotype", cls: "phenotype" },
          Submap: { kind: "submap", cls: "submap" },
          Tag: { kind: "tag", cls: "tag" },
          Compartment: { kind: "compartment", cls: "compartment" },
          Process: PROC("process"),
          OmittedProcess: PROC("omitted process"),
          UncertainProcess: PROC("uncertain process"),
          Association: PROC("association"),
          Dissociation: PROC("dissociation")
        };
        var WORD = { AND: "and", OR: "or", NOT: "not", "\u03C4": "delay", "\u2261": "equivalence" };
        var SBGNML = {
          macromolecule: ENT("macromolecule"),
          "simple chemical": ENT("simple chemical"),
          "nucleic acid feature": ENT("nucleic acid feature"),
          "unspecified entity": ENT("unspecified entity"),
          complex: ENT("complex"),
          "empty set": ENT("empty set"),
          "source and sink": ENT("empty set"),
          "perturbing agent": ENT("perturbing agent"),
          "biological activity": ENT("biological activity"),
          perturbation: ENT("perturbing agent"),
          phenotype: { kind: "phenotype", cls: "phenotype" },
          submap: { kind: "submap", cls: "submap" },
          tag: { kind: "tag", cls: "tag" },
          terminal: { kind: "tag", cls: "terminal" },
          compartment: { kind: "compartment", cls: "compartment" },
          process: PROC("process"),
          "omitted process": PROC("omitted process"),
          "uncertain process": PROC("uncertain process"),
          association: PROC("association"),
          dissociation: PROC("dissociation"),
          and: GATE("and"),
          or: GATE("or"),
          not: GATE("not"),
          delay: GATE("delay"),
          equivalence: GATE("equivalence")
        };
        var CELLDESIGNER = {
          PROTEIN: ENT("macromolecule"),
          RECEPTOR: ENT("macromolecule"),
          ION_CHANNEL: ENT("macromolecule"),
          TRUNCATED: ENT("macromolecule"),
          GENE: ENT("nucleic acid feature"),
          RNA: ENT("nucleic acid feature"),
          ANTISENSE_RNA: ENT("nucleic acid feature"),
          SIMPLE_MOLECULE: ENT("simple chemical"),
          ION: ENT("simple chemical"),
          DRUG: ENT("simple chemical"),
          UNKNOWN: ENT("unspecified entity"),
          COMPLEX: ENT("complex"),
          DEGRADED: ENT("empty set"),
          PHENOTYPE: { kind: "phenotype", cls: "phenotype" },
          COMPARTMENT: { kind: "compartment", cls: "compartment" },
          STATE_TRANSITION: PROC("process"),
          KNOWN_TRANSITION_OMITTED: PROC("omitted process"),
          UNKNOWN_TRANSITION: PROC("uncertain process"),
          HETERODIMER_ASSOCIATION: PROC("association"),
          DISSOCIATION: PROC("dissociation"),
          TRANSPORT: PROC("process"),
          TRANSCRIPTION: PROC("process"),
          TRANSLATION: PROC("process"),
          TRUNCATION: PROC("process"),
          BOOLEAN_LOGIC_GATE_AND: GATE("and"),
          BOOLEAN_LOGIC_GATE_OR: GATE("or"),
          BOOLEAN_LOGIC_GATE_NOT: GATE("not"),
          BOOLEAN_LOGIC_GATE_UNKNOWN: GATE("equivalence")
        };
        var GENE = { kind: "entity", cls: "nucleic acid feature", sub: "gene" }, GENE_UNIT = /(^|\s)ct:gene(\s|$)/i;
        function nodeKind(format, cls, word) {
          if (format === "graphml") {
            if (cls === "Operator") {
              var g = WORD[String(word || "").trim().toUpperCase()] || WORD[String(word || "").trim()];
              return g ? GATE(g) : null;
            }
            return cls === "NucleicAcidFeature" && GENE_UNIT.test(word || "") ? GENE : GRAPHML[cls] || null;
          }
          if (format === "sbgnml") {
            var c = String(cls || "").replace(/ multimer$/, "");
            return c === "nucleic acid feature" && GENE_UNIT.test(word || "") ? GENE : SBGNML[c] || null;
          }
          if (format === "celldesigner") return cls === "GENE" ? GENE : CELLDESIGNER[cls] || null;
          return null;
        }
        var HEAD = {
          delta: "production",
          white_circle: "catalysis",
          t_shape: "inhibition",
          white_diamond: "modulation",
          white_delta: "stimulation",
          white_delta_bar: "necessary stimulation",
          crows_foot_one: "inhibition"
        };
        function arcHead(format, cls) {
          if (format !== "graphml") return null;
          if (cls === "inhibition") return "t_shape";
          for (var h in HEAD) if (HEAD[h] === cls) return h;
          return ARCS2.indexOf(cls) >= 0 ? "none" : null;
        }
        var SBGN_ARC = { "positive influence": "stimulation", "negative influence": "inhibition", "unknown influence": "modulation" };
        var CD_ARC = {
          CATALYSIS: "catalysis",
          UNKNOWN_CATALYSIS: "catalysis",
          INHIBITION: "inhibition",
          UNKNOWN_INHIBITION: "inhibition",
          PHYSICAL_STIMULATION: "stimulation",
          MODULATION: "modulation",
          TRIGGER: "necessary stimulation",
          REDUCED_PHYSICAL_STIMULATION: "stimulation",
          UNKNOWN_REDUCED_PHYSICAL_STIMULATION: "stimulation",
          POSITIVE_INFLUENCE: "stimulation",
          UNKNOWN_POSITIVE_INFLUENCE: "stimulation",
          NEGATIVE_INFLUENCE: "inhibition",
          UNKNOWN_NEGATIVE_INFLUENCE: "inhibition",
          REDUCED_MODULATION: "modulation",
          UNKNOWN_REDUCED_MODULATION: "modulation",
          REDUCED_TRIGGER: "necessary stimulation",
          UNKNOWN_REDUCED_TRIGGER: "necessary stimulation",
          REACTANT: "consumption",
          PRODUCT: "production"
        };
        function arcKind(format, cls, head) {
          if (format === "graphml") {
            if (cls === "none") return head === "process" ? "consumption" : head === "gate" ? "logic arc" : head === "tag" ? "equivalence arc" : head === "entity" ? "logic arc" : null;
            return HEAD[cls] || null;
          }
          if (format === "sbgnml") return ARCS2.indexOf(cls) >= 0 ? cls : SBGN_ARC[cls] || null;
          if (format === "celldesigner") return CD_ARC[cls] || null;
          return null;
        }
        var CD_REDUCED = /\btype="(?:UNKNOWN_)?(?:REDUCED_PHYSICAL_STIMULATION|REDUCED_MODULATION|REDUCED_TRIGGER|NEGATIVE_INFLUENCE|POSITIVE_INFLUENCE)"/;
        function reducedType(format, type) {
          return format === "celldesigner" && CD_REDUCED.test('type="' + (type || "") + '"');
        }
        function mapKind(format, text, engines) {
          if (format === "sbgnml") {
            var se = engines && engines.sbgn_edit;
            return se && se.mapKind ? se.mapKind(text) : null;
          }
          if (format === "celldesigner") return /<celldesigner:(?:speciesAlias|complexSpeciesAlias)\b/.test(text || "") ? CD_REDUCED.test(text) ? "hybrid" : "pd" : "empty";
          return null;
        }
        var RULES = {
          need: {
            consumption: "A consumption goes from an entity into a process.",
            production: "A production goes from a process to an entity.",
            catalysis: "A catalysis goes from an entity to a process.",
            modulation: "A modulation goes from an entity or a logic gate to a process or a phenotype.",
            stimulation: "A stimulation goes from an entity or a logic gate to a process or a phenotype.",
            inhibition: "An inhibition goes from an entity or a logic gate to a process or a phenotype.",
            "necessary stimulation": "A necessary stimulation goes from an entity or a logic gate to a process or a phenotype.",
            "logic arc": "A logic arc goes into a logic gate.",
            "equivalence arc": "A tag is joined to an entity by an equivalence arc."
          },
          allow: [
            { id: "consumption", sets: ["house"], arc: ["consumption"], from: ["entity"], to: ["process"], spec: "3.4.1" },
            { id: "production", sets: ["house"], arc: ["production"], from: ["process"], to: ["entity"], spec: "3.4.1" },
            { id: "modulation", sets: ["house"], arc: MODS2, from: ["entity", "gate"], to: ["process", "phenotype"], spec: "3.4.1" },
            { id: "logic-in", sets: ["house"], arc: ["logic arc"], from: ["entity", "gate"], to: ["gate"], spec: "3.4.1" },
            { id: "equivalence-out", sets: ["house"], arc: ["logic arc"], from: ["gate:equivalence"], to: ["entity"], spec: "2.9.4" },
            { id: "tag", sets: ["house"], arc: ["equivalence arc"], from: ["tag"], to: ["entity"], check: "tagRoom", spec: "3.4.1" },
            { id: "tag-in", sets: ["house"], arc: ["equivalence arc"], from: ["entity"], to: ["tag"], check: "tagRoom", spec: "3.4.1" },
            {
              id: "reduced-direct",
              sets: ["reduced"],
              arc: INFL2,
              from: ["entity", "gate"],
              to: ["entity"],
              why: "Reduced notation (CellDesigner\u2019s): a modulation may end on an entity."
            },
            {
              id: "reduced-phenotype",
              sets: ["reduced"],
              arc: INFL2,
              from: ["phenotype", "submap"],
              to: ["process", "entity", "phenotype", "submap"],
              why: "CellDesigner has one glyph for phenotype, submap and perturbing agent, with lines both ways."
            },
            {
              id: "reduced-submap",
              sets: ["reduced"],
              arc: INFL2,
              from: ["entity", "gate"],
              to: ["submap"],
              why: "A submap takes a modulation as a phenotype does (CellDesigner\u2019s one glyph)."
            },
            {
              id: "phenotype-species",
              sets: ["house"],
              unless: ["strict"],
              arc: ["consumption"].concat(MODS2),
              from: ["phenotype"],
              to: ["process"],
              why: "CellDesigner\u2019s phenotype is a species: a reaction\u2019s reactant or modifier."
            },
            {
              id: "phenotype-product",
              sets: ["house"],
              unless: ["strict"],
              arc: ["production"],
              from: ["process"],
              to: ["phenotype"],
              why: "CellDesigner\u2019s phenotype is a species: a reaction\u2019s product."
            },
            { id: "af-influence", sets: ["af"], arc: INFL2, from: ["entity", "gate"], to: ["entity", "phenotype"], spec: "AF 3.3" },
            {
              id: "reduced-held",
              sets: ["house"],
              arc: INFL2,
              from: ["entity", "gate", "phenotype", "submap"],
              to: ["entity"],
              held: true,
              why: "A line the map already has in reduced notation may be moved; a new one is drawn only with Reduced notation ticked."
            }
          ],
          refuse: [
            { id: "gate-one-out", sets: ["house"], arc: ["*"], from: ["gate:not", "gate:delay", "gate:equivalence"], to: ["*"], check: "gateOneOut", spec: "3.4.1" },
            {
              id: "gate-one-out-and-or",
              sets: ["house"],
              unless: ["fanout"],
              arc: ["*"],
              from: ["gate:and", "gate:or"],
              to: ["*"],
              check: "gateOneOut",
              spec: "3.4.1",
              why: "With the proposed set fanout on, an AND or OR gate may have several lines out (demerging links, not yet in SBGN)."
            },
            { id: "one-input", sets: ["house"], arc: ["*"], from: ["*"], to: ["gate:not", "gate:delay"], check: "oneInput" },
            { id: "already", sets: ["house"], arc: ["*"], from: ["*"], to: ["*"], check: "already" },
            { id: "reversible", sets: ["pd"], arc: ["consumption"], from: ["*"], to: ["process"], check: "reversible", spec: "3.5.2.5" },
            {
              id: "empty-set-from",
              sets: ["pd"],
              arc: ["production", "logic arc", "equivalence arc"].concat(MODS2),
              from: ["entity:empty set"],
              to: ["*"],
              no: "An empty set is only consumed or produced.",
              spec: "3.4.1",
              why: "Kept in the default set though CellDesigner takes a degraded species as a modifier: it carries no information there."
            },
            {
              id: "empty-set-to",
              sets: ["pd"],
              arc: ["consumption", "catalysis", "modulation", "stimulation", "inhibition", "necessary stimulation", "logic arc", "equivalence arc"],
              from: ["*"],
              to: ["entity:empty set"],
              no: "An empty set is only consumed or produced.",
              spec: "3.4.1"
            },
            {
              id: "agent-from",
              sets: ["pd"],
              arc: ["consumption", "production", "catalysis", "logic arc"],
              from: ["entity:perturbing agent"],
              to: ["*"],
              no: "A perturbing agent only starts a modulation, stimulation, inhibition or necessary stimulation.",
              spec: "3.4.1"
            },
            {
              id: "agent-to",
              sets: ["pd"],
              arc: ["*"],
              from: ["*"],
              to: ["entity:perturbing agent"],
              no: "A perturbing agent only starts a modulation, stimulation, inhibition or necessary stimulation.",
              spec: "3.4.1"
            },
            {
              id: "gene-catalyst",
              sets: ["pd"],
              arc: ["catalysis"],
              from: ["entity:gene"],
              to: ["*"],
              no: "A gene is no catalyst.",
              spec: "3.4.1",
              why: "An RNA may catalyse (ribozymes) and CellDesigner holds both; a gene never does."
            },
            { id: "nucleic-catalyst", sets: ["strict"], arc: ["catalysis"], from: ["entity:nucleic acid feature"], to: ["*"], no: "A nucleic acid feature is no catalyst.", spec: "3.4.1" },
            { id: "catalysis-ends", sets: ["pd"], arc: ["catalysis"], from: ["submap"], to: ["*"], no: "A catalysis goes from an entity to a process.", spec: "3.4.1" },
            {
              id: "phenotype-catalyst",
              sets: ["strict"],
              arc: ["catalysis"],
              from: ["phenotype"],
              to: ["*"],
              no: "A catalysis goes from an entity to a process.",
              spec: "3.4.1",
              why: "CellDesigner takes a phenotype as a catalysis."
            },
            { id: "catalysis-submap", sets: ["pd"], arc: ["catalysis"], from: ["*"], to: ["submap"], no: "A catalysis goes from an entity to a process.", spec: "3.4.1" },
            { id: "one-catalysis", sets: ["strict"], arc: ["catalysis"], from: ["*"], to: ["process"], check: "oneCatalysis", spec: "3.5.2.4" },
            { id: "one-necessary", sets: ["strict"], arc: ["necessary stimulation"], from: ["*"], to: ["process"], check: "oneNecessary", spec: "3.5.2.4" },
            { id: "empty-set-one-out", sets: ["strict"], arc: ["consumption"], from: ["entity:empty set"], to: ["*"], check: "emptyOne", spec: "3.4.1" },
            { id: "empty-set-one-in", sets: ["strict"], arc: ["production"], from: ["*"], to: ["entity:empty set"], check: "emptyOne", spec: "3.4.1" },
            { id: "equivalence-entities", sets: ["house"], arc: ["logic arc"], from: ["gate:equivalence"], to: ["gate"], no: "An equivalence joins entities only.", spec: "2.9.4" },
            { id: "into-equivalence", sets: ["house"], arc: ["logic arc"], from: ["gate"], to: ["gate:equivalence"], no: "An equivalence joins entities only.", spec: "2.9.4" },
            { id: "equivalence-line", sets: ["house"], arc: MODS2, from: ["gate:equivalence"], to: ["*"], no: "An equivalence\u2019s line goes to an entity.", spec: "2.9.4" }
          ],
          palette: [
            { sign: "tag", sets: ["cd"], no: "CellDesigner has no tag or submap terminal." },
            { sign: "delay", sets: ["cd"], no: "CellDesigner has no delay; the converter joins its input to its target." }
          ]
        };
        function side(list2, k) {
          if (!k) return false;
          for (var i = 0; i < list2.length; i++) {
            var w = list2[i];
            if (w === "*" || w === k.kind || w === k.kind + ":" + k.cls || k.sub && w === k.kind + ":" + k.sub) return true;
          }
          return false;
        }
        function on2(row, sets) {
          return !(row.unless || []).some(function(s) {
            return sets.indexOf(s) >= 0;
          }) && row.sets.some(function(s) {
            return s === "house" || sets.indexOf(s) >= 0;
          });
        }
        function fits(row, arc, from, to) {
          return (row.arc.indexOf("*") >= 0 || row.arc.indexOf(arc) >= 0) && side(row.from, from) && side(row.to, to);
        }
        function allowed(arc, from, to, ctx) {
          ctx = ctx || {};
          var sets = ctx.sets || ["pd"], check = ctx.check || function() {
            return null;
          }, i, r, why;
          if (ARCS2.indexOf(arc) < 0) return "Not a line of the notation.";
          if (sets.indexOf("strict") >= 0) sets = sets.filter(function(x) {
            return x !== "reduced" && x !== "fanout";
          });
          for (i = 0; i < RULES.refuse.length; i++) {
            r = RULES.refuse[i];
            if (!on2(r, sets) || !fits(r, arc, from, to)) continue;
            why = r.check ? check(r.check) : r.no;
            if (why) return why;
          }
          for (i = 0; i < RULES.allow.length; i++) {
            r = RULES.allow[i];
            if (!on2(r, sets) || r.held && !ctx.held || !fits(r, arc, from, to)) continue;
            return r.check ? check(r.check) : null;
          }
          return RULES.need[arc];
        }
        function paletteOff(sets) {
          var o = {};
          RULES.palette.forEach(function(r) {
            if (r.sets.some(function(s) {
              return (sets || []).indexOf(s) >= 0;
            })) o[r.sign] = r.no;
          });
          return o;
        }
        var api2 = { ARCS: ARCS2, MODS: MODS2, RULES, nodeKind, arcKind, arcHead, reducedType, mapKind, allowed, paletteOff };
        if (typeof module !== "undefined" && module.exports) module.exports = api2;
        else root.notation = api2;
      })(typeof self !== "undefined" ? self : exports);
    }
  });

  // editor/src/state.js
  var V;
  var shared = {};
  var formats = {};
  function addFormats(o) {
    Object.keys(o).forEach(function(k) {
      formats[k] = o[k];
    });
  }
  function inOrder() {
    return [formats.sb, formats.cd, formats.graphml].filter(Boolean);
  }
  function formatOfText(t) {
    return inOrder().find(function(f) {
      return f.reads(t);
    }) || null;
  }
  function formatOfMap(m) {
    return inOrder().find(function(f) {
      return f.entry(m);
    }) || null;
  }
  function setV(v) {
    V = v;
    Object.keys(LIFETIMES).forEach(reset);
  }
  function none() {
    return null;
  }
  function no() {
    return false;
  }
  function list() {
    return [];
  }
  var LIFETIMES = {
    page: {
      palShown: none,
      // the palette's set as last shown (create.js palShow)
      listAhead: list,
      // the list's maps read ahead (own.js)
      ghDir: none,
      // when the data repository's folder was last listed (core.js, own.js)
      switching: no,
      // editing ends because another map was chosen
      afSbgn: no
      // AF's SBGN view: follows the palette's look (create.js palLook); stop() draws the map plainly
    },
    map: {
      text: function() {
        return "";
      },
      // the GraphML edited (a CellDesigner or SBGN-ML map's working copy)
      F: function() {
        return formats.graphml || null;
      },
      // the map's format object (formats), set by core.js begin
      cd: none,
      // a CellDesigner map: { base, now }
      sb: none,
      // an SBGN-ML map: { base, g0 }
      sbLast: none,
      // an SBGN-ML map's [GraphML, its SBGN-ML text, sb]: the moves written once per text (sbgn.js)
      dirty: no,
      // moves not saved
      redo: list,
      // the redo steps (undo is core.js's own)
      selN: list,
      selE: list,
      selP: list,
      // selected nodes, arcs, bend points (indices in nodes2, edges2, points)
      svSel: none,
      // a selected state variable or unit of information { id, j }
      part: none,
      // a selected part of a line (a port or a bend point)
      procs: list,
      // the process glyphs with their two main arcs (parse)
      cdBase: none,
      // the drawing the CellDesigner live session starts from { now, text }
      cdGate: none,
      // a CellDesigner logic gate being made: { kind, inputs: [node ids] } (cdcreate.js)
      lastChange: none
      // what the last whole action changed: { name, ids } (core.js commit); the shift out of negative places { name: 'shift', shift: [dx, dy], after: the action's name }
    },
    gesture: {
      tap: none,
      // a press waiting to become a click
      typing: none,
      // a name being typed on the map (create.js typeIn)
      cdPend: none
      // a CellDesigner structural state or unit of information shown before it is in the file, written once it has a value: { id, kind, angle } (cdcreate.js)
    },
    drawing: {
      live: none,
      liveC: none,
      liveOrig: none,
      liveG: none,
      // a move drawn live: arcs hidden, boxes, holders' groups, glyphs' shifts
      sizeRec: none,
      // the node drawn live while it is resized: its parts and how they were
      keyed: none,
      // what the arrow keys moved since the map was last drawn
      poseNow: none,
      poseText: none,
      // a dragged tag's or terminal's pose
      sizePosed: no,
      // the terminals of a submap being resized posed on its new border (live.js poseSize)
      copies: list,
      // the live copies of lines drawn over the picture
      frozen: no
      // the copies kept until the map is drawn again
    },
    cache: {
      hpMemo: none,
      // the ports of the GraphML drawing, by its text
      cdStrictMemo: function() {
        return [null, false];
      }
      // the CellDesigner set's tick box, read from this browser once per map, not on every paint
    }
  };
  function reset(kind) {
    var L = LIFETIMES[kind];
    Object.keys(L).forEach(function(k) {
      shared[k] = L[k]();
    });
  }
  function resetMap() {
    cleared().forEach(reset);
  }
  function resetDrawing() {
    reset("drawing");
  }
  function cleared() {
    return ["map", "gesture", "drawing", "cache"];
  }
  function takeMap() {
    var o = {};
    cleared().forEach(function(kind) {
      Object.keys(LIFETIMES[kind]).forEach(function(k) {
        o[k] = shared[k];
      });
    });
    return o;
  }
  function putMap(o) {
    Object.keys(o).forEach(function(k) {
      shared[k] = o[k];
    });
  }
  function plant(o) {
    var ok = {};
    cleared().forEach(function(kind) {
      Object.keys(LIFETIMES[kind]).forEach(function(k) {
        ok[k] = 1;
      });
    });
    Object.keys(o).forEach(function(k) {
      if (ok[k]) shared[k] = o[k];
    });
  }
  function stateNow() {
    var out = {};
    Object.keys(LIFETIMES).forEach(function(kind) {
      out[kind] = {};
      Object.keys(LIFETIMES[kind]).forEach(function(k) {
        out[kind][k] = shared[k];
      });
    });
    return out;
  }

  // editor/src/core.js
  var import_graphml_edit = __toESM(require_graphml_edit());
  var import_holding = __toESM(require_holding());

  // editor/src/engines.js
  var sbp;
  var sbJs;
  function __run1() {
    sbp = null, sbJs = null;
  }
  function sbScript(name2) {
    return new Promise(function(res, rej) {
      if (window[name2]) return res();
      var s = document.createElement("script");
      s.src = V.renderers + "converter/" + name2 + ".js" + V.build;
      s.onload = res;
      s.onerror = function() {
        rej(name2 + " not found");
      };
      document.head.appendChild(s);
    });
  }
  function sbpy() {
    if (sbp) return sbp;
    sbp = sbScript("sbgn_edit").then(function() {
      return sbScript("sbml_edit").catch(function() {
      });
    }).then(yr).then(function() {
      sbJs = window.sbgn_edit;
      return sbJs;
    });
    sbp.catch(function(e) {
      sbp = null;
      warn("The SBGN-ML side did not load: " + e);
    });
    return sbp;
  }
  function __start() {
    __run1();
  }

  // editor/src/drawing.js
  var yrp;
  function __run12() {
    yrp = null;
  }
  function yr() {
    if (yrp) return yrp;
    yrp = new Promise(function(res, rej) {
      if (window.yrender) return res(window.yrender);
      var s = document.createElement("script");
      s.src = V.renderers + "yrender/yrender.js" + V.build;
      s.onload = function() {
        res(window.yrender);
      };
      s.onerror = function() {
        rej("renderer not found");
      };
      document.head.appendChild(s);
    });
    yrp.catch(function(e) {
      yrp = null;
      warn("The renderer did not load: " + e);
    });
    return yrp;
  }
  function drawGraphml(t) {
    var A = shared.afSbgn ? afGraphml(t === docText && doc ? doc.cloneNode(true) : new DOMParser().parseFromString(t, "application/xml")) : null;
    var r = window.yrender.render(A ? A.doc : t === docText && doc ? doc : t, { classes: true, groups: true, sbgn: !!shared.F.sbgnLook });
    if (!A) shared.hpMemo = [t, r.ports];
    if (!A && on) yAhead(t);
    return [A ? afUnits(r.svg, A.units) : r.svg, r.errors];
  }
  var AF_KINDS;
  function __run2() {
    AF_KINDS = /^(Macromolecule|SimpleChemical|NucleicAcidFeature|UnspecifiedEntity|Complex)$/;
  }
  function afGraphml(d) {
    var units = [], up = {}, keys = {};
    Array.prototype.forEach.call(d.getElementsByTagNameNS(G, "key"), function(k) {
      if (k.getAttribute("for") === "node") keys[k.getAttribute("id")] = k.getAttribute("attr.name");
    });
    var prop = function(n, name2) {
      var x = Array.prototype.filter.call(n.childNodes, function(c) {
        return c.localName === "data" && keys[c.getAttribute("key")] === name2;
      })[0];
      return x ? x.textContent.trim() : null;
    };
    var uText = {};
    Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, "Resource"), function(q) {
      var gn = q.getElementsByTagNameNS(Y, "GenericNode")[0], l = gn && /UnitOfInformation$/.test(gn.getAttribute("configuration") || "") && gn.getElementsByTagNameNS(Y, "NodeLabel")[0];
      if (l) uText[q.getAttribute("id")] = l.textContent;
    });
    var ownNode = function(e) {
      for (var q = e.parentNode; q; q = q.parentNode) if (q.localName === "node" && q.namespaceURI === G) return q;
      return null;
    };
    Array.prototype.slice.call(d.getElementsByTagNameNS(G, "node")).forEach(function(n) {
      if (up[n.getAttribute("id")]) return;
      var rs = ["GenericNode", "GenericGroupNode"].reduce(function(a, k) {
        return a.concat(Array.prototype.slice.call(n.getElementsByTagNameNS(Y, k)));
      }, []).filter(function(r) {
        return ownNode(r) === n;
      });
      var kind = null, txt = "";
      rs.forEach(function(r) {
        var k = (r.getAttribute("configuration") || "").replace("com.yworks.sbgn.", "");
        if (!AF_KINDS.test(k)) return;
        kind = kind || k;
        r.setAttribute("configuration", "com.yworks.sbgn.Macromolecule");
        Array.prototype.slice.call(r.getElementsByTagNameNS(Y, "StyleProperties")).forEach(function(x) {
          x.parentNode.removeChild(x);
        });
        var sp = d.createElementNS(Y, "y:StyleProperties"), pr = d.createElementNS(Y, "y:Property");
        pr.setAttribute("class", "java.lang.Integer");
        pr.setAttribute("name", "com.yworks.sbgn.style.radius");
        pr.setAttribute("value", "0");
        sp.appendChild(pr);
        r.appendChild(sp);
        Array.prototype.slice.call(r.getElementsByTagNameNS(Y, "NodeLabel")).forEach(function(l) {
          var q = l.getAttribute("iconData");
          if (!q) return;
          if (!txt && uText[q]) txt = uText[q];
          l.parentNode.removeChild(l);
        });
      });
      if (!kind) return;
      var r0 = realizerOf(n) || rs[0], g = r0.getElementsByTagNameNS(Y, "Geometry")[0];
      var act = prop(n, "SBGN class") === "biological activity";
      units.push([n.getAttribute("id"), act ? prop(n, "SBGN unit") || "" : sbJs.unitFor(kind) || "", +g.getAttribute("x"), +g.getAttribute("y"), +g.getAttribute("width"), +g.getAttribute("height"), act ? txt.trim() : ""]);
      Array.prototype.slice.call(n.childNodes).forEach(function(c) {
        if (c.localName !== "graph") return;
        var names = [];
        Array.prototype.forEach.call(c.getElementsByTagNameNS(G, "node"), function(m) {
          up[m.getAttribute("id")] = n.getAttribute("id");
          var ml = Array.prototype.filter.call(m.getElementsByTagNameNS(Y, "NodeLabel"), function(l) {
            return !l.getAttribute("iconData") && l.textContent.trim();
          })[0];
          if (ml && !m.getElementsByTagNameNS(G, "graph").length) names.push(ml.textContent.trim());
        });
        n.removeChild(c);
        rs.forEach(function(r) {
          var l = Array.prototype.filter.call(r.getElementsByTagNameNS(Y, "NodeLabel"), function(x) {
            return !x.getAttribute("iconData");
          })[0];
          if (!l) return;
          if (!l.textContent.trim() && names.length) {
            while (l.firstChild) l.removeChild(l.firstChild);
            l.appendChild(d.createTextNode(names.join(":")));
            l.setAttribute("hasText", "true");
          }
          l.setAttribute("modelName", "internal");
          l.setAttribute("modelPosition", "c");
        });
      });
    });
    Array.prototype.slice.call(d.getElementsByTagNameNS(G, "edge")).forEach(function(e) {
      var p = e.getElementsByTagNameNS(Y, "Path")[0];
      if (up[e.getAttribute("source")] && up[e.getAttribute("source")] === up[e.getAttribute("target")]) {
        e.parentNode.removeChild(e);
        return;
      }
      [["source", "sx", "sy"], ["target", "tx", "ty"]].forEach(function(q) {
        var to = up[e.getAttribute(q[0])];
        if (!to) return;
        e.setAttribute(q[0], to);
        if (p) {
          p.setAttribute(q[1], "0.0");
          p.setAttribute(q[2], "0.0");
        }
      });
    });
    return { doc: d, units };
  }
  function afUnits(svg, units) {
    var esc = function(x) {
      return x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    };
    var byId = {};
    units.forEach(function(u) {
      var B = sbJs.afUnitBox(u.slice(2, 6), u[1], u[6]);
      if (!B) return;
      var x = B[0], y = B[1], w = B[2], h = B[3], c = h * 0.3, m = y + h / 2, f = function(v) {
        return Math.round(v * 100) / 100;
      }, k = sbJs.unitClass(u[1]), D;
      if (k === "macromolecule") D = "M" + f(x + c) + " " + f(y) + "H" + f(x + w - c) + "Q" + f(x + w) + " " + f(y) + " " + f(x + w) + " " + f(y + c) + "V" + f(y + h - c) + "Q" + f(x + w) + " " + f(y + h) + " " + f(x + w - c) + " " + f(y + h) + "H" + f(x + c) + "Q" + f(x) + " " + f(y + h) + " " + f(x) + " " + f(y + h - c) + "V" + f(y + c) + "Q" + f(x) + " " + f(y) + " " + f(x + c) + " " + f(y) + "Z";
      else if (k === "nucleic acid feature") D = "M" + f(x) + " " + f(y) + "H" + f(x + w) + "V" + f(y + h - c) + "Q" + f(x + w) + " " + f(y + h) + " " + f(x + w - c) + " " + f(y + h) + "H" + f(x + c) + "Q" + f(x) + " " + f(y + h) + " " + f(x) + " " + f(y + h - c) + "Z";
      else if (k === "complex") D = "M" + f(x + c) + " " + f(y) + "H" + f(x + w - c) + "L" + f(x + w) + " " + f(y + c) + "V" + f(y + h - c) + "L" + f(x + w - c) + " " + f(y + h) + "H" + f(x + c) + "L" + f(x) + " " + f(y + h - c) + "V" + f(y + c) + "Z";
      else if (k === "phenotype") D = "M" + f(x) + " " + f(y) + "H" + f(x + w) + "L" + f(x + w - c) + " " + f(m) + "L" + f(x + w) + " " + f(y + h) + "H" + f(x) + "L" + f(x + c) + " " + f(m) + "Z";
      else D = "M" + f(x) + " " + f(m) + "A" + f(w / 2) + " " + f(h / 2) + " 0 1 0 " + f(x + w) + " " + f(m) + "A" + f(w / 2) + " " + f(h / 2) + " 0 1 0 " + f(x) + " " + f(m) + "Z";
      var fs = sbJs.afUnitFont(h), T = u[6] ? '<text class="m2-af-ut" x="' + f(x + w / 2) + '" y="' + f(m) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + f(fs) + '" text-anchor="middle" dominant-baseline="central" fill="#000000">' + esc(u[6].replace(/\s*\n\s*/g, " ")) + "</text>" : "";
      byId[esc(u[0])] = '<path d="' + D + '" fill="white" class="c-white" stroke="#000000"/>' + T;
    });
    var out = [], at2 = 0, stack = [], re = /<g data-n="([^"]*)">|<g[\s>]|<\/g>/g, mt;
    while (mt = re.exec(svg)) {
      if (mt[0] === "</g>") {
        var id = stack.pop();
        if (id && byId[id]) {
          out.push(svg.slice(at2, mt.index), byId[id]);
          at2 = mt.index;
        }
      } else stack.push(mt[1] || null);
    }
    out.push(svg.slice(at2));
    return out.join("");
  }
  var yLive;
  var liveY;
  function __run3() {
    yLive = null;
    liveY = { glyphs: function() {
    }, lines: yLines, holders: null };
  }
  function svgEl(svg) {
    var g = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' + svg + "</svg>", "image/svg+xml").documentElement.firstElementChild;
    if (!g) return null;
    g = document.importNode(g, true);
    g.removeAttribute("data-e");
    g.removeAttribute("data-n");
    g.classList.add("m2-ed-copy");
    return g;
  }
  function ySession(t) {
    if (yLive && yLive.t === t) return yLive;
    var ix = {};
    edges2.forEach(function(e, k) {
      ix[e.id] = k;
    });
    yLive = { t, ix, s: window.yrender.live(t === docText && doc ? doc : t, { classes: true, sbgn: !!shared.F.sbgnLook }) };
    return yLive;
  }
  function yAhead(t) {
    var go = function() {
      try {
        if (on && !mv && !shared.keyed && window.yrender && window.yrender.live && t === shared.text) ySession(t);
      } catch (x) {
      }
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2e3 });
    else setTimeout(go, 300);
  }
  function yLines(ks, pp) {
    if (!gE || shared.afSbgn || !lastFor || lastFor[3] || !window.yrender || !window.yrender.live || pp && pp.n2 != null) return false;
    var t = lastFor[0], out;
    try {
      if (!ySession(t).s) return false;
      var boxes = {}, paths = {}, ways = {}, moved = /* @__PURE__ */ new Set();
      nodes2.forEach(function(n, i) {
        var p = shared.poseNow && shared.poseNow[i], a = bx(i), b = restBox(i);
        if (p && p.way) ways[n.id] = p.way;
        if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) {
          boxes[n.id] = a;
          moved.add(i);
        }
      });
      edges2.forEach(function(e, k) {
        var pts = e.pts.map(pt), mine2 = pp && pp.to && pp.k === k;
        if (!mine2 && !ks.has(k)) {
          if (!moved.has(e.s) && !moved.has(e.t) && !e.pts.some(function(pi, j2) {
            var r = restPt(pi);
            return r[0] !== pts[j2][0] || r[1] !== pts[j2][1];
          })) return;
        }
        var q = ["sx", "sy", "tx", "ty"].map(function(a) {
          return e.path ? parseFloat(e.path.getAttribute(a)) || 0 : 0;
        });
        q = posePort(e.s, q.slice(0, 2), k).concat(posePort(e.t, q.slice(2), k));
        if (mine2) {
          var j = pp.end ? 2 : 0;
          q[j] = pp.to[0];
          q[j + 1] = pp.to[1];
        }
        paths[e.id] = { pts, port: q };
      });
      out = yLive.s.draw(boxes, paths, Array.from(ks, function(k) {
        return edges2[k].id;
      }), ways);
    } catch (x) {
      out = null;
    }
    if (!out) return false;
    dropCopies();
    Object.keys(out.n).forEach(function(id) {
      var g = gN[id], c = svgEl(out.n[id]), tr = g && (g.getAttribute("transform") || "").match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
      if (!g || !c) return;
      if (!tr) {
        g.style.display = "none";
        g.parentNode.insertBefore(c, g.nextSibling);
        shared.copies.push([c, g, null]);
        return;
      }
      c.setAttribute("transform", "translate(" + -tr[1] + " " + -tr[2] + ")");
      Array.prototype.forEach.call(g.children, function(x) {
        x.style.display = "none";
        shared.copies.push([document.createComment(""), x, null]);
      });
      g.insertBefore(c, g.firstChild);
      shared.copies.push([c, null, null]);
    });
    Object.keys(out.e).forEach(function(id) {
      var gs = gE[id], c = svgEl(out.e[id]);
      if (!gs || !c) return;
      gs.forEach(function(g, j) {
        g.style.display = "none";
        if (j) shared.copies.push([document.createComment(""), g, yLive.ix[id]]);
      });
      gs[0].parentNode.insertBefore(c, gs[0].nextSibling);
      shared.copies.push([c, gs[0], yLive.ix[id]]);
    });
    return true;
  }
  function shiftedAhead(t, d) {
    var sh = shiftAhead(t, d);
    return sh ? import_graphml_edit.default.shift(t, sh[0], sh[1]) : t;
  }
  function shiftAhead(t, d) {
    if (!/<y:(Geometry|Point)\b[^>]*\s[xy]="-/.test(t)) return null;
    var R;
    try {
      R = import_graphml_edit.default.read(t, d ? { doc: d } : {});
    } catch (e) {
      return null;
    }
    return import_graphml_edit.default.shiftOf(R.nodes.map(function(n) {
      var g = R.geos[n.ag];
      return [num(g, "x"), num(g, "y")];
    }), R.points.map(function(p) {
      return [num(p, "x"), num(p, "y")];
    }), gridBlock());
  }
  function noNegative() {
    var sh = import_graphml_edit.default.shiftOf(nodes2.map(function(n, i) {
      return boxOf(i);
    }), points.map(function(p) {
      return [num(p, "x"), num(p, "y")];
    }), gridBlock());
    if (!sh) return null;
    setText(import_graphml_edit.default.shift(shared.text, sh[0], sh[1]));
    return sh;
  }
  function __start2() {
    __run12();
    __run2();
    __run3();
  }

  // editor/src/sbgn.js
  var EMPTY_BASE;
  var baseURL;
  function __run13() {
    EMPTY_BASE = `<?xml version='1.0' encoding='UTF-8'?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">
  <key for="node" id="ng" yfiles.type="nodegraphics"/>
  <key for="graphml" id="res" yfiles.type="resources"/>
  <key for="edge" id="eg" yfiles.type="edgegraphics"/>
  <graph edgedefault="directed" id="G"/>
  <data key="res">
    <y:Resources/>
  </data>
</graphml>
`;
    baseURL = null;
  }
  function emptyBase() {
    return baseURL || (baseURL = URL.createObjectURL(new Blob([EMPTY_BASE], { type: "application/xml" })));
  }
  var NEW_ID;
  function __run22() {
    NEW_ID = "viewer-new-map";
  }
  function madeHere(t) {
    return new RegExp('<map\\s[^>]*id="' + NEW_ID + '"').test(t.slice(0, 3e3));
  }
  function isSb(t) {
    return /<([\w.-]+:)?sbgn[\s>]/.test(t.slice(0, 3e3));
  }
  function isSbml(t) {
    t = t || "";
    return /<sbml[\s>]/.test(t.slice(0, 3e3)) && t.indexOf("listOfLayouts") >= 0 && t.slice(0, 2e5).indexOf("celldesigner") < 0;
  }
  function viaGraphml(t) {
    return isSb(t) || isSbml(t);
  }
  function edOf(t) {
    return isSbml(t) && window.sbml_edit ? window.sbml_edit : sbJs;
  }
  function sbMap(m) {
    return !!(m && !m.shownAs && (m.site || m).editBase);
  }
  function sbBase(m, low) {
    var e = m.site || m;
    if (e.ownText) return sbpy().then(function() {
      return sbReader(e.ownText());
    }).then(function() {
      return sbOwn(e.ownText());
    });
    return fetch(e.editBase + V.ver(e), { priority: low ? "low" : "auto" }).then(function(r) {
      if (!r.ok) throw r.status;
      return r.text();
    });
  }
  var ownMemo;
  var readerP;
  function sbReader(t) {
    if (madeHere(t) || window.sbgnml_read) return Promise.resolve();
    readerP = readerP || sbScript("sbgnml_read");
    readerP.catch(function() {
      readerP = null;
    });
    return readerP;
  }
  function sbOwn(t) {
    if (madeHere(t)) return EMPTY_BASE;
    if (!window.sbgnml_read) throw new Error("the SBGN-ML reader did not load");
    if (!ownMemo || ownMemo[0] !== t) {
      var r = window.sbgnml_read.graphml(t);
      if (r.text.indexOf("<node ") < 0 && r.messages.some(function(x) {
        return x[0] === "left out";
      })) {
        if (/<([\w.-]+:)?map\s[^>]*language\s*=\s*["']entity relationship/.test(t.slice(0, 5e3))) throw new Error("an Entity Relationship map, which this editor does not read yet");
        var gone = r.messages.filter(function(x) {
          return x[0] === "left out";
        }).map(function(x) {
          return x[1].replace(/: (\d+) left out \(.*$/, " ($1)");
        });
        throw new Error("nothing in it can be drawn" + (gone.length ? " (left out: " + gone.join(", ") + ")" : ""));
      }
      ownMemo = [t, r.text];
    }
    return ownMemo[1];
  }
  var sbMemo;
  function __run32() {
    sbMemo = [];
    ownMemo = null;
    outMemo = null;
  }
  function sbGraphml(t, base) {
    for (var i = 0; i < sbMemo.length; i++) if (sbMemo[i][0] === t && sbMemo[i][1] === base) return sbMemo[i][2];
    var ed = edOf(t), g = ed.graphml(ed.unique ? ed.unique(t, base) : t, base);
    sbRemember(t, g, base);
    return g;
  }
  function sbRemember(t, g, base) {
    sbMemo.unshift([t, base, g]);
    sbMemo.length = Math.min(sbMemo.length, 3);
  }
  function sbNow() {
    if (!shared.sbLast || shared.sbLast[0] !== shared.text || shared.sbLast[2] !== shared.sb) {
      try {
        shared.sbLast = [shared.text, edOf(shared.sb.base).write(shared.sb.base, shared.text), shared.sb];
      } catch (e) {
        warn("The moves could not be written into the SBGN-ML file: " + (e && e.message || e) + ". The last version written is kept.");
        return sbOut(shared.sbLast && shared.sbLast[2] === shared.sb ? shared.sbLast[1] : shared.sb.base);
      }
    }
    return sbOut(shared.sbLast[1]);
  }
  var outMemo;
  function sbOut(w) {
    if (V.sites || !sbJs || !sbJs.sitesOut || !isSb(w)) return w;
    if (!outMemo || outMemo[0] !== w) {
      var o = w;
      try {
        o = sbJs.sitesOut(w);
      } catch (e) {
      }
      outMemo = [w, o];
    }
    return outMemo[1];
  }
  function sbIn(t) {
    try {
      return sbJs && sbJs.sitesIn && isSb(t) ? sbJs.sitesIn(t) : t;
    } catch (e) {
      return t;
    }
  }
  var sbPlaced;
  function __run5() {
    sbPlaced = null;
  }
  function sbPlace() {
    if (!sbJs.countsPlace || shared.text === sbPlaced || shared.text.indexOf("<y:EdgeLabel") < 0) return false;
    var t2 = sbJs.countsPlace(shared.text), was = shared.text !== t2;
    setText(sbPlaced = t2);
    return was;
  }
  var sbK;
  var GEO;
  function __run6() {
    sbK = { sb: null };
    GEO = /\s(?:x|y|width|height|sx|sy|tx|ty|ratio|modelPosition|nodeRatioX|nodeRatioY|labelRatioX|labelRatioY|offsetX|offsetY|borderDistance)="[^"]*"/g;
  }
  function sbRead() {
    var s = src();
    sbK.text = shared.text;
    sbK.key = shared.text.replace(GEO, "");
    sbK.bad = !(shared.sbLast && shared.sbLast[0] === shared.text && shared.sbLast[2] === shared.sb);
    if (!sbK.bad) {
      sbK.kind = edOf(s).mapKind(s);
      sbK.af = edOf(s).isAf(s);
    }
  }
  function sbKind(how) {
    if (!shared.sb || !sbJs) return "empty";
    if (how) sbPlace();
    if (sbK.sb !== shared.sb) sbK = { sb: shared.sb, text: null, key: null, kind: "empty", af: false, g: null, bad: false };
    if (sbK.text !== shared.text) {
      if (sbK.bad || sbK.key !== shared.text.replace(GEO, "")) sbRead();
      else sbK.text = shared.text;
    }
    if (sbK.bad) return sbK.kind;
    if (sbK.g == null || how === "back") sbK.g = sbK.af;
    else if (how === "follow" && sbK.g !== sbK.af) {
      var g, key = shared.text.replace(GEO, "");
      if (sbK.failed === key) return sbK.kind;
      try {
        g = edOf(src()).graphml(src(), shared.text);
      } catch (e) {
        sbK.failed = key;
        warn("The map could not be read again after it turned " + (sbK.af ? "Activity Flow" : "Process Description") + ": " + (e && e.message || e) + ".");
        return sbK.kind;
      }
      setText(g);
      sbRead();
      if (!sbK.bad) sbK.g = sbK.af;
    }
    return sbK.kind;
  }
  function sbFollow() {
    if (!shared.sb || !sbJs || drag || sbK.sb !== shared.sb) return;
    if (sbPlace()) {
      parse();
      shared.dirty = true;
      render();
      paint();
    }
    sbKind();
    if (sbK.bad || sbK.g == null || sbK.g === sbK.af || sbK.failed === shared.text.replace(GEO, "")) return;
    parse();
    shared.selP = [];
    shared.selE = [];
    shared.dirty = true;
    render();
    paint();
  }
  var sbClsMemo;
  function __run7() {
    sbClsMemo = [null, {}];
  }
  function sbClasses() {
    if (sbClsMemo[0] !== shared.text) {
      var m = {}, d = new DOMParser().parseFromString(src(), "application/xml");
      Array.prototype.forEach.call(d.getElementsByTagNameNS("*", "glyph"), function(g) {
        if (g.getAttribute("id")) m[g.getAttribute("id")] = g.getAttribute("class") || "";
      });
      sbClsMemo = [shared.text, m];
    }
    return sbClsMemo[1];
  }
  function sbJoin() {
    return {
      ok: function() {
        return !!sbJs && !!sbJs.join && sbKind() !== "af" && !shared.afSbgn;
      },
      joinable: function(id, cid) {
        return sbJs.joinable(shared.text, id, cid);
      },
      write: function(joins) {
        var done = [];
        joins.forEach(function(q) {
          try {
            setText(sbJs.join(shared.text, q[0], q[1], { checked: true }));
            done.push(q[1]);
          } catch (err) {
            warn("A glyph could not be put into the complex.");
          }
        });
        return done;
      }
    };
  }
  function __start3() {
    __run13();
    __run22();
    __run32();
    __run5();
    __run6();
    __run7();
  }
  function sbWhy(e) {
    var m = String(e && e.message || e), q = /^could not convert string to float: (.*)$/.exec(m);
    if (typeof console !== "undefined") console.warn("SBGN-ML reading: " + m);
    if (q) return "a position or size in the file is not a number (" + q[1] + "): the tool that wrote it left a value out";
    if (/NoneType|^(TypeError|AttributeError|KeyError|IndexError|ValueError)\b/.test(m)) return "a glyph or arc in the file lacks a part SBGN-ML requires (its class, id or box)";
    return m;
  }
  function sbFormat() {
    return {
      name: "sb",
      load: yr,
      engineCd: false,
      now: sbNow,
      ownFrame: false,
      live: function() {
        return liveY;
      },
      mainLines: false,
      afView: true,
      sbgnLook: true,
      stacks: true,
      insets: true,
      sitesOut: function() {
        return !!shared.sbLast && !!sbJs && !!sbJs.sitesOut && isSb(shared.sbLast[1]);
      },
      fileType: { description: "SBGN-ML", accept: { "application/xml": [".sbgn", ".nwt"] } },
      stackComp: function(t, id) {
        return sbJs && sbJs.stack ? sbJs.stack(t, id) : t;
      },
      square: function() {
        return null;
      },
      beside: function() {
        return null;
      },
      reads: viaGraphml,
      entry: sbMap,
      // an SBML file with a layout too, edited the same way
      base: { keep: function() {
        return shared.sb ? shared.sb.base : null;
      }, put: function(b) {
        if (shared.sb) shared.sb.base = b;
      } },
      // the SBGN-ML file the GraphML was read from (sbKind may read it again)
      asRead: true,
      // the history and the picture on screen are of the file as read, before the opening put its sites back
      // opening: the GraphML of its text, from the build's (g0) where the text matches it, else the reader's (sbOwn); its
      // sites kept in the notes put back on their circles (sbIn, written as Show sites says, sbOut); the moves written back
      // at once, so a file whose moves cannot be is said now, not at the first save
      open: function(t, g0, still) {
        var t0 = t, members = [];
        return sbpy().then(function() {
          var mo = { text: t, said: [] };
          try {
            if (sbJs && sbJs.membersOut) mo = sbJs.membersOut(t);
          } catch (e) {
          }
          members = mo.said;
          var tin = sbIn(mo.text), sited = function(x) {
            return (x.match(/<([\w.-]+:)?state [^>]*variable="[^"]/g) || []).length;
          };
          if (tin === t) return g0;
          if (g0 && !members.length && sited(tin) === sited(t)) {
            t = tin;
            return g0;
          }
          t = tin;
          return sbReader(t).then(function() {
            return sbOwn(t);
          });
        }).then(function(g1) {
          if (!still()) return null;
          if (!g1) throw "its GraphML did not load";
          var ed0 = edOf(t);
          if (ed0.unique) t = ed0.unique(t, g1);
          var g = sbGraphml(t, g1), sb1 = { base: t, g0: g1 };
          var n = !V.sites && sbJs && sbJs.sitesOut && isSb(t0) ? (t0.match(/<([\w.-]+:)?state [^>]*variable="[^"]/g) || []).length : 0;
          var said = [members.length ? sbJs.membersSaid(members) : "", n ? n + (n > 1 ? " sites" : " site") + " kept as links on " + (n > 1 ? "their glyphs" : "its glyph") + " and drawn as the value alone, as Show sites (Settings, Display) is off." : ""].filter(Boolean).join(" ") || null;
          return { g, t, t0, said, redraw: !!members.length, own: { sb: sb1, sbLast: [g, edOf(t).write(t, g), sb1] } };
        });
      },
      // a reader's own map drawn for the list (core.js drawText): SBGN-ML only (not SBML), from the empty base if made here,
      // else read by sbgnml_read; g0: a site map's build GraphML
      drawOwn: function(t, g0) {
        if (!isSb(t)) return null;
        return sbpy().then(function() {
          if (!g0) t = sbIn(t);
          return g0 ? null : sbReader(t);
        }).then(function() {
          return window.yrender.render(sbGraphml(t, g0 || sbOwn(t)), { classes: true, groups: true, sbgn: true }).svg;
        }).catch(function(e) {
          throw new Error(sbWhy(e));
        });
      },
      asGraphml: function(t) {
        return shared.sb ? sbGraphml(t, shared.sb.g0) : t;
      },
      // the site's file as the editor's GraphML, from the open map's base
      // the read-ahead: its edited copy (maps/sbgn-ml/...), the converter's GraphML it is edited from, drawn as SBGN; on
      // leaving, the text kept with its GraphML, so it is reopened on the very GraphML it was left with (keeper)
      ahead: {
        load: sbpy,
        path: function(m) {
          return m.editPath;
        },
        base: sbBase,
        graphml: sbGraphml,
        sbgn: true,
        keeper: function() {
          var g0 = shared.sb && shared.sb.g0;
          return function(t, g) {
            sbRemember(t, g, g0);
            return null;
          };
        }
      },
      kind: function(n) {
        var c = sbClasses()[n.id];
        return c ? c.replace(/ multimer$/, "") : null;
      },
      // a glyph's class, a multimer with its plain kind
      nameable: function(id) {
        var t = src();
        return !!sbJs && edOf(t).nameable(t, id);
      },
      // a glyph whose class takes a name
      join: sbJoin(),
      moved: sbFollow,
      // after a move: a file the move turned followed
      parsing: function(how) {
        sbKind(how);
      },
      // before the GraphML is read: a change that turned the file followed
      g0: function() {
        return shared.sb ? shared.sb.g0 : null;
      }
    };
  }

  // editor/src/sbcreate.js
  var TAGS;
  var sbRxSeen;
  var sbCountMemo;
  var antMemo;
  var cardMemo;
  var PF_SB;
  function __run14() {
    TAGS = /^(tag|terminal)$/;
    sbRxSeen = [null, null];
    sbCountMemo = [null, null, null];
    antMemo = [null, {}];
    cardMemo = [null, null];
    PF_SB = {
      sizable: sbSizable,
      size: sbSetSize,
      node: sbNode,
      set: sbSet,
      def: sbDef,
      ends: sbEnds,
      hub: function(i) {
        return !!hubGroup(i);
      },
      rx: { of: sbRxOf, set: function(pid, on2) {
        return sbReversible(pid, on2, true);
      }, withNode: true },
      refs: { of: sbRefsOf, set: sbRefsSet },
      // a process's references (Properties, References)
      ids: { of: sbIdsOf, set: sbIdsSet },
      // an entity's or a compartment's identifiers (Properties, Identifiers)
      line: {
        colour: sbLineColour,
        set: sbLineSet,
        width: function(k) {
          return sbJs.widthOf(sbEdgeEl(k));
        },
        setWidth: sbLineWidth,
        ports: true,
        // a line's colour, width and its ports' rows (edgeShow, edgeSet)
        count: sbCount,
        setCount: function(k, v) {
          return sbLineTo(k, sbJs.recount(shared.text, edges2[k].id, v));
        }
      },
      // a consumption's or production's cardinality
      off: sbOff,
      look: function(i) {
        var r = realizerOf(nodes2[i].el), o = sbJs.lookOf(r), wf = field("way");
        if (wf) {
          wf.disabled = nodes2[i].sub != null;
          wf.title = wf.disabled ? "A terminal points into its submap, set by the side it sits on" : "";
        }
        var an = hubGroup(i) ? sbAnts()[nodes2[i].id] : null;
        return { label: nameOf(i), font: o.font, fill: o.fill ? o.fill.slice(0, 7).toLowerCase() : "", line: (o.line || "#000000").slice(0, 7).toLowerCase(), width: o.width, multimer: o.multimer, way: sbJs.wayOfR && sbJs.wayOfR(r) || "right", ant: an == null ? "" : an };
      }
    };
  }
  function palOn() {
    return on && V.current === map && !!shared.sb && !!sbJs && V.level === "full";
  }
  function palKind() {
    return sbKind();
  }
  function afKind() {
    return !!shared.sb && palKind() === "af";
  }
  function hybridActs() {
    return shared.sb && palKind() === "hybrid" ? sbJs.activities(shared.text) : null;
  }
  function svDeleteSb(i) {
    var q = svList(i)[shared.svSel.j];
    var share = q[3] === SV ? svShareMove(i, q, svR(i, q), null) : null;
    var sid = shared.svSel.id;
    if (!commit((q[3] === UI ? sbJs.unitDelete : sbJs.stateDelete)(shared.text, sid, q[4], { sbgn: shared.sb.base }), { name: "state variable deleted", ids: [sid], then: function() {
      shared.svSel = null;
      if (share) share();
    } })) {
      shared.svSel = null;
      render();
      paint();
    }
    return true;
  }
  function sbFileAf() {
    return !!shared.sb && sbJs.isAf(shared.sb.base);
  }
  function sbSizable(i) {
    var n = nodes2[i];
    return !!n.comp || isMade(n);
  }
  function sbSetSize(pairs) {
    var ids = [], was = {}, t2 = shared.text, tids = [];
    pairs.forEach(function(q) {
      var b0 = boxOf(q[0]), b1 = q[1];
      nodes2.forEach(function(n, k) {
        if (n.sub !== q[0]) return;
        t2 = sbJs.resize(t2, n.id, termScaled(boxOf(k), b0, b1));
        tids.push(n.id);
      });
    });
    try {
      pairs.forEach(function(q) {
        var id = nodes2[q[0]].id;
        ids.push(id);
        was[id] = boxOf(q[0]);
        t2 = sbJs.resize(t2, id, q[1]);
      });
    } catch (err) {
      warn("Not resized: " + (err && err.message || err) + ".");
      liveOff();
      sizeOff();
      paint();
      return;
    }
    if (t2 === shared.text) {
      liveOff();
      sizeOff();
      paint();
      return;
    }
    commit(t2, { name: "resized", ids, then: function() {
      nodes2.forEach(function(n) {
        if (n.sub != null && ids.indexOf(n.id) >= 0) tids.push(n.id);
      });
      if (tids.length) termsFix(nodes2.map(function(n, k) {
        return tids.indexOf(n.id) >= 0 ? k : -1;
      }).filter(function(k) {
        return k >= 0;
      }), true);
      shared.selN = [];
      nodes2.forEach(function(n, k) {
        if (ids.indexOf(n.id) >= 0) shared.selN.push(k);
      });
      var ks = shared.selN.slice();
      if (ks.length) setBoxes(grown(ks, boxOf, function(k) {
        return was[nodes2[k].id] || boxOf(k);
      }, function() {
        return false;
      }));
      refit(ids);
      shared.sizeRec = null;
    } });
  }
  function sbNode(i) {
    return sbJs.LOOKS.test(sbClasses()[nodes2[i].id] || "") ? i : -1;
  }
  function sbOff(k, i) {
    var c = sbClasses()[nodes2[i].id] || "";
    if (k === "way") return !TAGS.test(c);
    if (TAGS.test(c)) return !/^(label|font|w|h|fill|line|width)$/.test(k);
    if (k === "label" || k === "font") return !sbJs.NAMED.test(c);
    if (k === "multimer") return !hasMulti(c.replace(/ multimer$/, ""));
    if (k === "ant") return !hubGroup(i) || sbAnts()[nodes2[i].id] == null;
    if (EXTRA.indexOf(k) >= 0) return true;
    if (k === "def") return !/^(macromolecule|simple chemical)( multimer)?$|^biological activity$/.test(c) && !hubGroup(i);
    return false;
  }
  function kindOf(i) {
    var c = (sbClasses()[nodes2[i].id] || "").replace(/ multimer$/, "");
    if (c === "biological activity") return lookKey(c, sbJs.activities(shared.text)[nodes2[i].id]);
    return c || (nodes2[i].shape.kind === "SimpleChemical" ? "simple chemical" : "macromolecule");
  }
  function sbSet(k, v, is) {
    var ids = is.map(function(i) {
      return nodes2[i].id;
    }), t2 = shared.text;
    if (k === "ant") {
      var L = parseFloat(v);
      return isFinite(L) && fitHubs(is.filter(function(i) {
        return hubGroup(i);
      }).map(function(i) {
        return { id: nodes2[i].id, ant: Math.min(Math.max(L, 1), 200) };
      }));
    }
    ids.forEach(function(id) {
      if (k === "label") t2 = sbJs.label(t2, id, v.replace(/[\r\n]+/g, " "));
      else if (k === "multimer") t2 = sbJs.multimer(t2, id, v);
      else if (k === "width") {
        var x = parseFloat(v);
        if (isFinite(x)) t2 = sbJs.restyle(t2, id, { width: Math.min(Math.max(x, 0.25), 20) });
      } else if (k === "font") {
        var z = parseFloat(v);
        if (isFinite(z)) t2 = sbJs.restyle(t2, id, { font: Math.min(Math.max(Math.round(z * 2) / 2, 1), 200) });
      } else if (k === "way") {
        var ti = is.filter(function(i) {
          return nodes2[i].id === id;
        })[0];
        if (ti != null && nodes2[ti].sub == null) t2 = tagTurnT(t2, ti, v);
      } else {
        var c = hex(v), o = {};
        if (c !== null && !(c === "" && k === "line")) {
          o[k] = c === "#000000" && k === "line" ? null : c || null;
          t2 = sbJs.restyle(t2, id, o);
        }
      }
    });
    if (t2 === shared.text) return false;
    commit(t2, { name: "properties", sel: ids, quiet: true });
    return true;
  }
  function sbEnds(id, o, box3) {
    var t2 = sbJs.scaleEnds(shared.text, id, o, box3);
    if (t2 !== shared.text) {
      setText(t2);
      parse();
    }
  }
  function sbReversible(pid, on2, keepNode) {
    var rv = sbJs.reversibility(shared.text, pid, { sbgn: src() }), n = rv ? on2 ? rv.can : rv.rev : 0, ids = [];
    if (!n) return false;
    for (var j = 0; j < n; j++) ids.push(freeId("arc_", ids));
    var t2 = sbJs.reversible(shared.text, pid, on2, ids, { sbgn: src() });
    return commit(t2, { name: "reversible", ids: [pid], sel: keepNode ? [pid] : [], selE: keepNode ? [] : ids, quiet: true });
  }
  function sbRxOf() {
    if (shared.selN.length !== 1 || shared.selE.length || shared.selP.length || shared.svSel) return null;
    var id = nodes2[shared.selN[0]] && nodes2[shared.selN[0]].id;
    if (!id || sbJs.PROCESSES.indexOf(sbClasses()[id] || "") < 0) return null;
    var key = id + "\0" + shared.text;
    if (sbRxSeen[0] !== key) {
      var rv = null;
      try {
        rv = sbJs.reversibility(shared.text, id, { sbgn: src() });
      } catch (e) {
        rv = null;
      }
      sbRxSeen = [key, rv && (rv.can || rv.rev) ? { rid: id, on: rv.rev > 0 } : null];
    }
    return sbRxSeen[1];
  }
  var sbRefsMemo;
  function __run62() {
    sbRefsMemo = [null, null, null, null, null];
  }
  function sbIsProc(i) {
    return i != null && !!nodes2[i] && sbJs.PROCESSES.indexOf(sbClasses()[nodes2[i].id] || "") >= 0;
  }
  function sbRefsOf() {
    if (!sbJs || !sbJs.refsOf || shared.selP.length || shared.svSel) return null;
    var pid = null, line2 = false;
    if (shared.selN.length === 1 && !shared.selE.length && sbIsProc(shared.selN[0])) pid = nodes2[shared.selN[0]].id;
    else if (shared.selE.length === 1 && !shared.selN.length && edges2[shared.selE[0]]) {
      var e = edges2[shared.selE[0]], n = sbIsProc(e.t) ? e.t : sbIsProc(e.s) ? e.s : null;
      if (n != null) {
        pid = nodes2[n].id;
        line2 = true;
      }
    }
    if (!pid) return null;
    var base = shared.sb && shared.sb.base;
    if (sbRefsMemo[0] !== pid || sbRefsMemo[1] !== shared.text || sbRefsMemo[2] !== base) {
      var keys = [], about = [];
      var sameBase = sbRefsMemo[0] === pid && sbRefsMemo[2] === base;
      try {
        keys = sbJs.refsOf(shared.text, pid).split(" ").filter(Boolean);
        about = sameBase ? sbRefsMemo[4] : base ? sbJs.refsAbout(base, pid) : [];
      } catch (e2) {
        keys = null;
      }
      sbRefsMemo = [pid, shared.text, base, keys, about];
    }
    if (!sbRefsMemo[3]) return null;
    var ab = sbRefsMemo[4];
    return { id: pid, title: line2 ? "References of its process" : "References", items: sbRefsMemo[3].map(function(k) {
      var c = k.indexOf(":"), db2 = k.slice(0, c);
      return { key: k, db: db2, val: k.slice(c + 1), q: ab.indexOf(k) >= 0 ? "bqmodel:isDescribedBy" : "bqbiol:isDescribedBy", own: ab.indexOf(k) < 0 && /^(pubmed|doi)$/.test(db2), about: ab.indexOf(k) >= 0 };
    }) };
  }
  function sbRefsSet(pid, add, del) {
    var now = sbJs.refsOf(shared.text, pid).split(" ").filter(function(k) {
      return k && del.indexOf(k) < 0;
    });
    var t2 = sbJs.setRefs(shared.text, pid, now.concat(add.filter(function(k) {
      return now.indexOf(k) < 0;
    })).join(" "));
    return commit(t2, { name: "references changed", ids: [pid], sel: shared.selN.map(function(i) {
      return nodes2[i].id;
    }), selE: shared.selE.map(function(k) {
      return edges2[k].id;
    }) });
  }
  var sbIdsMemo;
  var SB_ID_KIND;
  function __run72() {
    sbIdsMemo = [null, null, null, null];
    SB_ID_KIND = { "macromolecule": "protein", "macromolecule multimer": "protein", "nucleic acid feature": "gene", "nucleic acid feature multimer": "gene", "simple chemical": "molecule", "simple chemical multimer": "molecule", "phenotype": "phenotype", "compartment": "compartment" };
  }
  function sbIdsOf() {
    var base = shared.sb && shared.sb.base;
    if (!sbJs || !sbJs.idsOf || !base || !/<([\w.-]+:)?sbgn[\s>]/.test(base.slice(0, 3e3)) || shared.selP.length || shared.svSel || shared.selE.length || shared.selN.length !== 1 || !nodes2[shared.selN[0]]) return null;
    var id = nodes2[shared.selN[0]].id, kind = SB_ID_KIND[sbClasses()[id] || ""];
    if (!kind) return null;
    if (sbIdsMemo[0] !== id || sbIdsMemo[1] !== shared.text || sbIdsMemo[2] !== base) {
      var L;
      try {
        L = sbJs.idsOf(shared.text, base, id);
      } catch (e) {
        L = null;
      }
      sbIdsMemo = [id, shared.text, base, L];
    }
    if (!sbIdsMemo[3]) return null;
    return { id, kind, title: "Identifiers", items: sbIdsMemo[3].map(annItem) };
  }
  function sbIdsSet(id, add, del, name2) {
    var L = sbJs.idsOf(shared.text, shared.sb.base, id), t2 = shared.text;
    var hv = L.some(function(x) {
      return x.q === "bqbiol:hasVersion" && idOwn(x.q, x.key);
    }) ? "hasVersion" : "is";
    ["is", "hasVersion"].forEach(function(l) {
      var mine2 = L.filter(function(x) {
        return x.q === "bqbiol:" + l && idOwn(x.q, x.key);
      }).map(function(x) {
        return x.key;
      });
      var keep = mine2.filter(function(k) {
        return del.indexOf(k) < 0;
      }), more = l === hv ? add.filter(function(k) {
        return keep.indexOf(k) < 0;
      }) : [];
      if (keep.length !== mine2.length || more.length) t2 = sbJs.setIds(t2, id, keep.concat(more), void 0, l);
    });
    if (name2) t2 = sbJs.label(t2, id, name2);
    return commit(t2, { name: "identifiers changed", ids: [id], sel: [id], selE: [] });
  }
  function sbCount(k) {
    var id = edges2[k].id;
    if (sbCountMemo[0] !== id || sbCountMemo[1] !== shared.text) {
      var c;
      try {
        c = sbJs.countOf(shared.text, id);
      } catch (e) {
        c = void 0;
      }
      sbCountMemo = [id, shared.text, c];
    }
    return sbCountMemo[2];
  }
  function sbEdgeEl(k) {
    var el = edges2[k].path.parentNode;
    while (el && el.localName !== "edge") el = el.parentNode;
    return el;
  }
  function sbLineColour(k) {
    return sbJs.lineOf(sbEdgeEl(k)) || "#000000";
  }
  function sbLineSet(k, c) {
    return sbLineTo(k, sbJs.recolour(shared.text, edges2[k].id, c));
  }
  function sbLineWidth(k, w) {
    return sbLineTo(k, sbJs.rewidth(shared.text, edges2[k].id, w));
  }
  function sbLineTo(k, t2) {
    var id = edges2[k].id;
    return commit(t2, { name: "line look", ids: [id], then: function() {
      shared.selE = [];
      edges2.forEach(function(q, j) {
        if (q.id === id) shared.selE = [j];
      });
    } });
  }
  function sbDef(i) {
    var o = sbJs.lookOf(realizerOf(nodes2[i].el)), b = boxOf(i), all = defsKept(), g = hubGroup(i);
    if (g) HUB_KINDS[g].forEach(function(c) {
      all[c] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, ant: sbAnts()[nodes2[i].id] };
    });
    else all[kindOf(i)] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, multimer: o.multimer, font: o.font };
    if (!keepLook(DEF_KEY, all)) return;
    keepMapChoice("style", "custom");
    keepMapChoice("cols", "custom");
    styleRow();
    sbColsRow();
  }
  function hubGroup(i) {
    var c = i != null && nodes2[i] ? sbClasses()[nodes2[i].id] || "" : "";
    return HUB_KINDS.process.indexOf(c) >= 0 ? "process" : HUB_KINDS.gate.indexOf(c) >= 0 ? "gate" : null;
  }
  function sbAnts() {
    if (antMemo[0] !== shared.text) antMemo = [shared.text, sbJs.antennas(shared.text, { sbgn: src() })];
    return antMemo[1];
  }
  function __run23() {
    props.querySelector(".m2-ed-pall").addEventListener("click", function() {
      var i = propNode(), g = i >= 0 ? hubGroup(i) : null;
      if (!g) return;
      var b = boxOf(i), ant = sbAnts()[nodes2[i].id], lt = sbJs.GLT.test(sbClasses()[nodes2[i].id] || "") ? sbJs.lookOf(realizerOf(nodes2[i].el)).font : null;
      var items2 = nodes2.map(function(n, k) {
        if (k === i || hubGroup(k) !== g) return null;
        var o = boxOf(k);
        return { id: n.id, box: [+fmt(o[0] + o[2] / 2 - b[2] / 2), +fmt(o[1] + o[3] / 2 - b[3] / 2), b[2], b[3]], ant, letters: lt };
      }).filter(Boolean);
      if (!keepSel(function() {
        return fitHubs(items2);
      })) warn("Every one of this kind already has this size and antenna.");
    });
    props.querySelector(".m2-ed-pstd").addEventListener("click", function() {
      var ns = propNodes().filter(function(i) {
        return hubGroup(i);
      });
      if (!ns.length) return;
      var s = stdScale(), lt = stdLetters();
      var items2 = ns.map(function(i) {
        var gate = hubGroup(i) === "gate", S = sbJs.SIZE[gate ? "and" : "process"], o = boxOf(i), w = S[0] * s, h = S[1] * s;
        return { id: nodes2[i].id, box: [+fmt(o[0] + o[2] / 2 - w / 2), +fmt(o[1] + o[3] / 2 - h / 2), w, h], ant: sbJs.ANT * s, letters: gate ? lt : null };
      });
      if (!keepSel(function() {
        return fitHubs(items2);
      })) warn("Already at the standard size and antenna.");
    });
  }
  function sbCols() {
    return mapCols(["file", "none", "default", "confetti", "custom"], sbIs);
  }
  function sbSquares(mode) {
    if (mode === "confetti") return confettiSquares();
    var seen = {}, h = "", kept = mode === "custom" ? defsKept() : {};
    SB_SQ.forEach(function(c) {
      var k = kept[c], x = mode === "none" ? "#FFFFFF" : mode === "default" ? sbJs.fillFor(c) : k && k.fill ? k.fill : sbJs.defaults(src(), null, c).fill || "#FFFFFF";
      x = String(x).toUpperCase();
      if (seen[x]) return;
      seen[x] = 1;
      h += '<i style="background:' + x + '" title="' + c + ", " + x + '"></i>';
    });
    return '<span class="m2-cs-sw">' + h + "</span>";
  }
  function sbColsRow() {
    return palDrop({ key: "cols", label: "Colours", title: "Colours of the map and of new glyphs", list: SB_COLS, get: sbCols, set: function(v) {
      colsPick(v, sbCols(), function() {
        return sbJs.colours(shared.text);
      }, sbOriginal, sbRecolour);
    }, sq: sbSquares });
  }
  function sbOriginal(r) {
    var now = sbJs.colours(shared.text), M = {}, added = 0;
    Object.keys(now.node).forEach(function(id) {
      var o = r.node && r.node[id], a = now.node[id];
      if (!o) added++;
      else if (o.fill !== a.fill || o.line !== a.line) M[id] = { fill: o.fill, line: o.line };
    });
    Object.keys(now.edge).forEach(function(id) {
      if (!r.edge || !(id in r.edge)) added++;
    });
    var t2 = sbJs.restyleAll(shared.text, M, null, function(id) {
      return r.edge && id in r.edge && r.edge[id] !== now.edge[id] ? r.edge[id] : void 0;
    });
    commit(t2, { name: "colours from a file", sel: [], quiet: true });
    return added;
  }
  function sbPlan(mode, pick) {
    if (sbActMemo[0] !== shared.text) sbActMemo = [shared.text, sbJs.activities(shared.text)];
    var cls = sbClasses(), acts = sbActMemo[1], kept = mode === "custom" ? defsKept() : {}, hues = [], P = [];
    nodes2.forEach(function(n, i) {
      var c = cls[n.id] || "";
      if (!SB_FILLED.test(c)) {
        if (sbJs.LOOKS.test(c) && mode !== "custom") P.push([i, { line: null }]);
        return;
      }
      var base = c.replace(/ multimer$/, ""), u = acts[n.id], o;
      var ff = sbJs.fillFor(u != null ? "biological activity" : base === "terminal" ? "tag" : base, u);
      if (mode === "default") o = { fill: ff, line: null };
      else if (mode === "none") o = { fill: null, line: null };
      else if (mode === "custom") {
        var k = kept[lookKey(base, u)];
        if (!k || !(k.w > 0)) return;
        o = {};
        ["fill", "line", "width"].forEach(function(q) {
          if (q in k) o[q] = k[q];
        });
      } else {
        if (!ff || base === "compartment") return;
        o = { fill: pick ? confettiPick(hues).toUpperCase() : true, line: null };
      }
      P.push([i, o]);
    });
    return P;
  }
  function sbIs(mode) {
    if (!palOn()) return false;
    if (mode === "file") {
      var r = origAll()[palId()];
      if (!r) return null;
      var now = sbJs.colours(shared.text);
      return Object.keys(r.node || {}).every(function(id) {
        var a = now.node[id], o = r.node[id];
        return !a || a.fill === o.fill && a.line === o.line;
      }) && Object.keys(r.edge || {}).every(function(id) {
        return !(id in now.edge) || now.edge[id] === r.edge[id];
      });
    }
    var P = sbPlan(mode, false).filter(function(q) {
      return "fill" in q[1];
    });
    if (!P.length) return null;
    return P.every(function(q) {
      var f = sbJs.lookOf(realizerOf(nodes2[q[0]].el)).fill;
      return mode === "confetti" ? confettiOne(f) : (f ? f.slice(0, 7).toUpperCase() : null) === (q[1].fill ? q[1].fill.toUpperCase() : null);
    });
  }
  function sbRecolour(mode) {
    if (mode === "file" || !palOn()) return;
    var M = {};
    sbPlan(mode, true).forEach(function(q) {
      M[nodes2[q[0]].id] = q[1];
    });
    var lh = [], t2 = sbJs.restyleAll(shared.text, M, null, mode === "custom" ? null : function() {
      return mode === "confetti" ? confettiLine(lh).toUpperCase() : null;
    });
    commit(t2, { name: "colours", sel: [], quiet: true });
  }
  function svBase(i) {
    var c = (sbClasses()[nodes2[i].id] || "").replace(/ multimer$/, "") || "macromolecule", b = boxOf(i);
    try {
      var D = defOf(c);
      if (D && D.w && D.h) return [D.w, D.h];
    } catch (e) {
    }
    return [b[2], b[3]];
  }
  function svCopies(id) {
    var i = svIdx(id);
    if (!shared.sb || shared.afSbgn || afKind() || i < 0 || nodes2[i].shape.kind !== "Macromolecule" || !svNm(i)) return [];
    var nm = svNm(i);
    return nodes2.filter(function(n, k) {
      return k !== i && n.shape.kind === "Macromolecule" && svNm(k) === nm;
    }).map(function(n) {
      return n.id;
    });
  }
  function svShareText(id, was, r0, n, now) {
    var ov = svVar(was), nv = svVar(now), i = svIdx(id), q = i >= 0 ? svOnly(i)[n] : null, r = q ? svR(i, q) : r0;
    if (!ov && !nv) return;
    svCopies(id).forEach(function(c) {
      var m = svTwin(c, was, r0), has = nv ? svTwin(c, now, r) : -1;
      if (m >= 0 && ov !== nv) {
        var k = svIdx(c), wb = boxOf(k), cur = svOnly(k)[m][0];
        if (has >= 0 && has !== m) {
          if (!cur) {
            setText(sbJs.stateDelete(shared.text, c, m, { sbgn: shared.sb.base }));
            parse();
          }
          return;
        }
        setText(sbJs.stateValue(shared.text, c, m, svVal(cur) + (nv ? "@" + nv : "")));
        parse();
        if (svSettle(c, m)) svHold(c, wb);
      } else if (m < 0 && nv && has < 0) svAddTo(c, r, "@" + nv);
    });
  }
  function svShareMove(i, q, r0, r) {
    var ws = svCopies(nodes2[i].id).map(function(c) {
      return [c, svTwin(c, q[0], r0)];
    }).filter(function(w) {
      return w[1] >= 0;
    });
    return function() {
      ws.forEach(function(w) {
        var k = svIdx(w[0]);
        if (k < 0) return;
        if (!r) {
          setText(sbJs.stateDelete(shared.text, w[0], w[1], { sbgn: shared.sb.base }));
          return;
        }
        var b = boxOf(k), ic = svIconsOn(k), me = ic.filter(function(o) {
          return o.k === SV && o.n === w[1];
        })[0];
        if (me && !svClash(svPt(b, r), me.s, b, ic.filter(function(o) {
          return o !== me;
        }))) setText(sbJs.stateMove(shared.text, w[0], w[1], r[0], r[1]));
      });
      parse();
    };
  }
  function cardAll() {
    if (cardMemo[0] !== shared.text) cardMemo = [shared.text, shared.sb && sbJs && sbJs.countsAt ? sbJs.countsAt(shared.text) : {}];
    return cardMemo[1];
  }
  function cardAt(P) {
    if (!shared.sb || !sbJs || !sbJs.countsAt || shared.text.indexOf("<y:EdgeLabel") < 0) return null;
    var o = cardAll(), pad = 2 / V.z, got = null;
    Object.keys(o).forEach(function(id) {
      var b = o[id].box;
      if (P[0] >= b[0] - pad && P[0] <= b[0] + b[2] + pad && P[1] >= b[1] - pad && P[1] <= b[1] + b[3] + pad) got = id;
    });
    return got;
  }
  var SB_COLS;
  function __run33() {
    SB_COLS = [["file", "Original", "The map\u2019s own colours, as they were before another choice; new glyphs in the colour most glyphs of their kind have on it"], ["default", "Mist and sage", "The whole map and new glyphs in the viewer\u2019s starting colours: a pale blue for proteins, a pale green for small molecules"], ["none", "No colours", "The whole map and new glyphs unfilled"], ["custom", "Custom default", "The whole map and new glyphs in the colours kept by Set as default; a kind with none as it is"], ["confetti", "Confetti", "Every glyph of the map, and every new one, a pastel of its own"]];
  }
  var SB_SQ;
  function __run4() {
    SB_SQ = ["macromolecule", "simple chemical", "nucleic acid feature", "phenotype", "compartment"];
  }
  var SB_FILLED;
  var sbActMemo;
  function __run52() {
    SB_FILLED = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|perturbing agent|phenotype|complex|compartment|submap|biological activity|perturbation|tag|terminal)( multimer)?$/;
    sbActMemo = [null, {}];
  }
  function svVal(s) {
    var a = (s || "").indexOf("@");
    return a < 0 ? s || "" : s.slice(0, a);
  }
  function svNm(i) {
    return nameOf(i).replace(/\s+/g, " ").trim();
  }
  function fitHubs(items2) {
    if (!items2.length) return false;
    var was = {};
    items2.forEach(function(it) {
      var i = nodes2.findIndex(function(n) {
        return n.id === it.id;
      });
      was[it.id] = boxOf(i);
    });
    var t2;
    try {
      t2 = sbJs.fit(shared.text, items2, { sbgn: src() });
    } catch (err) {
      warn("Not changed: " + (err && err.message || err) + ".");
      return false;
    }
    if (t2 === shared.text) return false;
    var sel = shared.selN.map(function(i) {
      return nodes2[i].id;
    });
    commit(t2, { name: "size", ids: Object.keys(was), then: function() {
      shared.selN = [];
      nodes2.forEach(function(n, k) {
        if (sel.indexOf(n.id) >= 0) shared.selN.push(k);
      });
      var ks = nodes2.map(function(n, k) {
        return was[n.id] ? k : -1;
      }).filter(function(k) {
        return k >= 0;
      });
      if (ks.length) setBoxes(grown(ks, boxOf, function(k) {
        return was[nodes2[k].id] || boxOf(k);
      }, function() {
        return false;
      }));
      refit(Object.keys(was));
    } });
    return true;
  }
  function __start4() {
    __run14();
    __run23();
    __run33();
    __run4();
    __run52();
    __run62();
    __run72();
  }

  // editor/src/geometry.js
  function nodeCentre(n, P) {
    var b = bx(n);
    return Math.max(Math.abs(P[0] - b[0] - b[2] / 2) / (b[2] / 2 || 1), Math.abs(P[1] - b[1] - b[3] / 2) / (b[3] / 2 || 1)) < 0.5;
  }
  function glyphMid(q, B, P, pp) {
    var ea = edges2[q.a], eb = edges2[q.b], o = function(e, a2) {
      if (pp && pp.to && edges2[pp.k] === e && (pp.end ? "t" : "s") === a2[0]) return pp.to[a2[1] === "x" ? 0 : 1];
      return e.path ? parseFloat(e.path.getAttribute(a2)) || 0 : 0;
    };
    var S = B(pp && pp.n2 != null && edges2[pp.k] === ea && !pp.end ? pp.n2 : ea.s), T = B(pp && pp.n2 != null && edges2[pp.k] === eb && pp.end ? pp.n2 : eb.t);
    var all = [[S[0] + S[2] / 2 + o(ea, "sx"), S[1] + S[3] / 2 + o(ea, "sy")]].concat(
      ea.pts.map(P),
      eb.pts.map(P),
      [[T[0] + T[2] / 2 + o(eb, "tx"), T[1] + T[3] / 2 + o(eb, "ty")]]
    );
    var k = ea.pts.length, n = all.length - 1, a = all[k], b = all[k + 1];
    if (k === 0) a = cut(all[0], all[1], S);
    if (k + 1 === n) b = cut(all[n], all[n - 1], T);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], b[0] - a[0]), Math.hypot(b[0] - a[0], b[1] - a[1])];
  }
  function glyphPort(i, off, eid) {
    var L = shared.liveG && shared.liveG[i];
    if (!L || !L[2] && L[3] === 1) return off;
    var c = Math.cos(L[2]), s2 = Math.sin(L[2]), f = /\|[rp]\d+$/.test(eid) ? L[3] : 1;
    return [f * (c * off[0] - s2 * off[1]), f * (s2 * off[0] + c * off[1])];
  }
  function beyond(k, i, all) {
    var e = edges2[k], last = all.length - 1;
    if (i > 0 && i < last) return [all[i], e.pts[i - 1]];
    var q = shared.procs.find(function(r) {
      return i === last && r.a === k || i === 0 && r.b === k;
    });
    if (!q) return [all[i], null];
    if (i === last) {
      var eb = edges2[q.b];
      if (eb.t == null) return [all[i], null];
      return eb.pts.length ? [pt(eb.pts[0]), eb.pts[0]] : [ports(q.b)[eb.pts.length + 1], null];
    }
    var ea = edges2[q.a];
    if (ea.s == null) return [all[i], null];
    return ea.pts.length ? [pt(ea.pts[ea.pts.length - 1]), ea.pts[ea.pts.length - 1]] : [ports(q.a)[0], null];
  }
  function glyphArcs(bp) {
    var out = [];
    shared.procs.forEach(function(q) {
      var ea = edges2[q.a], eb = edges2[q.b];
      if (ea.s == null || eb.t == null || ea.pts.indexOf(bp) < 0 && eb.pts.indexOf(bp) < 0) return;
      edges2.forEach(function(e, k) {
        if (k !== q.a && k !== q.b && e.s != null && e.t != null && (e.s === q.g || e.t === q.g)) out.push({ q, k });
      });
    });
    return out;
  }
  function joinAt(o, bp, B) {
    var q = o.q, e = edges2[o.k], st = e.s === q.g, P2 = function(pi) {
      return pi === bp ? B : pt(pi);
    };
    var at2 = function(a) {
      return e.path ? parseFloat(e.path.getAttribute(a)) || 0 : 0;
    };
    var r = glyphMid(q, boxOf, restPt), m = glyphMid(q, bx, P2), off = st ? [at2("sx"), at2("sy")] : [at2("tx"), at2("ty")];
    var f = /\|[rp]\d+$/.test(e.id) && r[3] ? m[3] / r[3] : 1, t = m[2] - r[2], c = Math.cos(t), s2 = Math.sin(t), G2 = boxOf(q.g);
    var J = [G2[0] + G2[2] / 2 + m[0] - r[0] + f * (c * off[0] - s2 * off[1]), G2[1] + G2[3] / 2 + m[1] - r[1] + f * (s2 * off[0] + c * off[1])];
    var N;
    if (st) {
      if (e.pts.length) N = pt(e.pts[0]);
      else {
        var T = bx(e.t);
        N = [T[0] + T[2] / 2 + at2("tx"), T[1] + T[3] / 2 + at2("ty")];
      }
    } else {
      if (e.pts.length) N = pt(e.pts[e.pts.length - 1]);
      else {
        var S = bx(e.s);
        N = [S[0] + S[2] / 2 + at2("sx"), S[1] + S[3] / 2 + at2("sy")];
      }
    }
    return [J, N];
  }
  function joinSolve(o, bp, B, ax, cm) {
    var c = 0;
    for (var it = 0; it < 4; it++) {
      var P0 = B.slice(), P1 = B.slice();
      P0[ax] += c;
      P1[ax] += c + 1;
      var a = joinAt(o, bp, P0), b = joinAt(o, bp, P1), res = a[0][cm] - a[1][cm], dv = b[0][cm] - b[1][cm] - res;
      if (Math.abs(dv) < 0.05) return null;
      c -= res / dv;
      if (Math.abs(res) < 1e-4) break;
    }
    return c;
  }
  function joinGuides(bp, B) {
    var out = [];
    glyphArcs(bp).forEach(function(o) {
      var J = joinAt(o, bp, B);
      if (Math.abs(J[0][0] - J[1][0]) < 0.05 || Math.abs(J[0][1] - J[1][1]) < 0.05) out.push(J);
    });
    return out;
  }

  // editor/src/celldesigner.js
  var cdp;
  var cdJs;
  var cdMk;
  function __run15() {
    cdp = null, cdJs = null, cdMk = null;
  }
  function isCd(t) {
    return /<sbml[\s>]/.test(t.slice(0, 3e3)) && t.indexOf("celldesigner") >= 0;
  }
  function nodePlaces(n) {
    var R = window.cdrender, cl = shared.cd && R && R.anchorAt && cdRole(n) === "epn" ? cdClsOf(nodes2[n].id) : null;
    if (!cl) return null;
    var b = bx(n), C = [b[0] + b[2] / 2, b[1] + b[3] / 2], f = R.frontBox(b, cl[1]);
    return Object.keys(R.ANCHOR).map(function(k) {
      var A = R.anchorAt(cl[0], f, k);
      return [A[0] - C[0], A[1] - C[1], k];
    });
  }
  function cdpy() {
    if (cdp) return cdp;
    var script = function(f) {
      return new Promise(function(res, rej) {
        var s = document.createElement("script");
        s.src = V.renderers + "converter/" + f + ".js" + V.build;
        s.onload = res;
        s.onerror = function() {
          rej(f + " not found");
        };
        document.head.appendChild(s);
      });
    };
    cdp = (window.cdrender ? Promise.resolve() : script("cdrender")).then(function() {
      return window.cd_edit ? null : script("cd_edit");
    }).then(function() {
      return window.cd_make ? null : script("cd_make").catch(function() {
      });
    }).then(function() {
      cdJs = window.cd_edit;
      cdMk = window.cd_make || null;
      if (cdMk) cdCheck();
      return cdJs;
    });
    cdp.catch(function(e) {
      cdp = null;
      warn("The CellDesigner renderer did not load: " + e);
    });
    return cdp;
  }
  var cdPics;
  var cdPicRead;
  var cdPicNames;
  var cdPicMiss;
  var cdPicKeeper;
  function __run8() {
    cdPics = {};
    cdPicRead = null;
    cdPicNames = null;
    cdPicMiss = false;
    cdPicKeeper = null;
  }
  function cdPicSource(read2, names, keep) {
    cdPicRead = read2;
    cdPicNames = names;
    cdPicKeeper = keep;
  }
  function cdPicKeep(f) {
    if (!cdPicKeeper) return Promise.reject(new Error("images cannot be kept on this page"));
    return cdPicKeeper(f).then(function(r) {
      return new Promise(function(res) {
        var fr = new FileReader();
        fr.onload = function() {
          res(fr.result);
        };
        fr.onerror = function() {
          res(null);
        };
        fr.readAsDataURL(new Blob([r.bytes], { type: r.type }));
      }).then(function(u) {
        if (u) cdPics[r.note] = u;
        return r;
      });
    });
  }
  function cdPicUrl(note2) {
    return note2 && Object.prototype.hasOwnProperty.call(cdPics, note2) ? cdPics[note2] : null;
  }
  function cdGlyph(p) {
    if (Object.prototype.hasOwnProperty.call(cdPics, p)) return cdPics[p];
    cdPicMiss = true;
    return null;
  }
  function cdPicsFor(t) {
    if (!cdPicRead) return Promise.resolve();
    var want = cdPicNames(t).filter(function(p) {
      return !Object.prototype.hasOwnProperty.call(cdPics, p);
    });
    if (!want.length) return Promise.resolve();
    return Promise.all(want.map(function(p) {
      return cdPicRead(p).then(function(b) {
        return b && new Promise(function(res) {
          var r = new FileReader();
          r.onload = function() {
            res(r.result);
          };
          r.onerror = function() {
            res(null);
          };
          r.readAsDataURL(b);
        });
      }).catch(function() {
        return null;
      }).then(function(u) {
        if (u) cdPics[p] = u;
      });
    }));
  }
  var cdMemo;
  function __run34() {
    cdMemo = [];
  }
  function cdDraw(t, g, fit) {
    return cdJs.draw(t, g, { fit: fit == null ? undo.length > 0 : fit, block: gridBlock(), glyph: cdGlyph, parsed: on ? function(c, d) {
      cdDocKeep(c, d, shownId());
    } : null });
  }
  var cdDocNow;
  function shownId() {
    return V.chosen ? V.chosen.id : null;
  }
  function cdDoc(t, id) {
    if (cdDocNow && cdDocNow.t === t) return cdDocNow.doc;
    var doc2 = new DOMParser().parseFromString(t, "application/xml");
    if (id !== false) cdDocKeep(t, doc2, id === void 0 ? shownId() : id);
    return doc2;
  }
  function cdDocKeep(t, doc2, id) {
    cdDocNow = { t, doc: doc2, id };
  }
  function cdKept() {
    return cdDocNow ? cdDocNow.id : null;
  }
  function cdShown(id) {
    if (!cdDocNow) return;
    if (cdDocNow.id === "adding") cdDocNow.id = id;
    else if (cdDocNow.id !== id) {
      cdDocNow = null;
      cdLive = null;
    }
  }
  function cdShift(svg) {
    var m = /<g transform="translate\(([-\d.]+),([-\d.]+)\)">/.exec(svg || "");
    return m ? [+m[1], +m[2]] : [0, 0];
  }
  function cdNow() {
    if (lastFor && lastFor[0] === shared.text && lastFor[1] === shared.cd.now) return { t: shared.cd.now, sh: cdShift(lastSvg) };
    var q = cdDraw(shared.cd.base, shared.text);
    return { t: q[1], sh: cdShift(q[0]) };
  }
  function cdRebuild(t, sh) {
    shared.cd.base = t;
    setText(cdGraphml(t));
    rebase(sh[0], sh[1]);
  }
  function cdGraphml(t) {
    var g = cdKnown(t);
    if (g) return g;
    g = cdJs.graphml(t, null, { doc: cdDoc(t) });
    cdRemember(t, g);
    return g;
  }
  function cdKnown(t) {
    for (var i = 0; i < cdMemo.length; i++) if (cdMemo[i][0] === t) return cdMemo[i][1];
    return null;
  }
  function cdRemember(t, g) {
    cdMemo.unshift([t, g]);
    cdMemo.length = Math.min(cdMemo.length, 3);
  }
  function glyphFollow(ns, ps, back2, pp) {
    if (!shared.procs.length || !gN) return;
    var old = shared.liveG;
    shared.liveG = null;
    var rest = function(i) {
      var b = boxOf(i);
      return back2 && ns.has(i) ? [b[0] - back2[0], b[1] - back2[1], b[2], b[3]] : b;
    };
    var restP = function(pi) {
      var p = points[pi], o = back2 && ps.has(pi);
      return [num(p, "x") - (o ? back2[0] : 0), num(p, "y") - (o ? back2[1] : 0)];
    };
    var out = {}, any = false;
    shared.procs.forEach(function(q) {
      var ea = edges2[q.a], eb = edges2[q.b];
      if (ns.has(q.g) || ea.s == null || eb.t == null) return;
      var port = pp && pp.to && (pp.k === q.a || pp.k === q.b);
      if (!(port || ns.has(ea.s) || ns.has(eb.t) || ea.pts.concat(eb.pts).some(function(p) {
        return ps.has(p);
      }))) return;
      var a = glyphMid(q, bx, pt, pp), b = glyphMid(q, rest, restP);
      out[q.g] = [a[0] - b[0], a[1] - b[1], isFinite(a[2] - b[2]) && b[3] ? a[2] - b[2] : 0, b[3] ? a[3] / b[3] : 1, b];
      any = true;
    });
    if (old) Object.keys(old).forEach(function(i) {
      if (!out[i]) {
        var g = gN[nodes2[i].id];
        if (g) g.removeAttribute("transform");
      }
    });
    if (!any) return;
    shared.liveG = out;
    shared.live = shared.live || /* @__PURE__ */ new Set();
    Object.keys(out).forEach(function(i) {
      var o2 = out[i], c0 = toPic(o2[4]), g = gN[nodes2[i].id];
      if (g) g.setAttribute("transform", "translate(" + f1(c0[0] + o2[0]) + " " + f1(c0[1] + o2[1]) + ") rotate(" + f1(o2[2] * 180 / Math.PI) + ") translate(" + f1(-c0[0]) + " " + f1(-c0[1]) + ")");
      edges2.forEach(function(e, k) {
        if (e.s !== +i && e.t !== +i) return;
        var gs = gE[e.id];
        if (gs) gs.forEach(function(x) {
          x.style.display = "none";
        });
        shared.live.add(k);
      });
    });
  }
  var cdLive;
  function __run42() {
    cdLive = null;
  }
  function cdSession() {
    if (!shared.cd || !cdJs || !cdJs.live || !shared.cdBase) return null;
    if (cdLive && cdLive.base === shared.cdBase) return cdLive.s;
    try {
      cdLive = { base: shared.cdBase, s: cdJs.live(shared.cdBase.now, shared.cdBase.text, { doc: cdDoc(shared.cdBase.now), glyph: cdGlyph }) };
    } catch (e) {
      cdLive = null;
    }
    return cdLive ? cdLive.s : null;
  }
  function cdSessionSoon() {
    if (!shared.cdBase && shared.cd) shared.cdBase = { now: shared.cd.now, text: shared.text };
    (window.requestIdleCallback || function(f) {
      setTimeout(f, 0);
    })(function() {
      if (on) cdSession();
    });
  }
  function cdHolders(ks) {
    var S = cdSession();
    if (!S || !S.holder) return;
    var todo = ks.filter(function(i) {
      var R = shared.liveOrig[i], b = shared.liveC[i];
      return !(R && R.at && R.at.every(function(v, j) {
        return v === b[j];
      }));
    }).map(function(i) {
      return [i, S.holder(nodes2[i].id, toPic(shared.liveC[i]))];
    }).filter(function(q) {
      return q[1] != null;
    });
    if (!todo.length) return;
    var doc2 = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + todo.map(function(q) {
      return "<g>" + q[1] + "</g>";
    }).join("") + "</svg>", "image/svg+xml").documentElement;
    var parts = Array.prototype.filter.call(doc2.childNodes, function(c) {
      return c.nodeType === 1;
    });
    todo.forEach(function(q, k) {
      var i = q[0], g = gN[nodes2[i].id];
      if (!shared.liveOrig[i]) {
        var kids = Array.prototype.slice.call(g.childNodes);
        shared.liveOrig[i] = { back: function() {
          g.replaceChildren.apply(g, kids);
        } };
      }
      shared.liveOrig[i].at = shared.liveC[i].slice();
      g.replaceChildren.apply(g, Array.prototype.map.call(parts[k].childNodes, function(c) {
        return document.importNode(c, true);
      }));
    });
  }
  function cdSizeLive(i, nb, R) {
    var S = cdSession(), g = gN && gN[nodes2[i].id];
    if (!S || !S.holder || !g) return R;
    if (!R) {
      var kids = Array.prototype.slice.call(g.childNodes);
      return { i, back: function() {
        g.replaceChildren.apply(g, kids);
      } };
    }
    if (!nb || R.at && R.at.every(function(v, j) {
      return v === nb[j];
    })) return R;
    var svg = S.holder(nodes2[i].id, toPic(nb));
    if (svg == null) return R;
    var doc2 = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g>' + svg + "</g></svg>", "image/svg+xml").documentElement.firstElementChild;
    g.replaceChildren.apply(g, Array.prototype.map.call(doc2.childNodes, function(c) {
      return document.importNode(c, true);
    }));
    R.at = nb.slice();
    return R;
  }
  var liveCd;
  var RXE;
  function __run53() {
    liveCd = { glyphs: glyphFollow, lines: cdLines, holders: cdHolders, size: cdSizeLive };
    RXE = /^(.*)\|(a|b|[rpmi]\d+)$/;
  }
  function cdLines(ks, pp) {
    if (!shared.cd || !gE) return false;
    var rids = /* @__PURE__ */ new Set();
    ks.forEach(function(k) {
      var m = edges2[k].id.match(RXE);
      if (m) rids.add(m[1]);
    });
    if (!rids.size) return false;
    var S = cdSession();
    if (!S) return false;
    var bends = /* @__PURE__ */ new Map(), paths = /* @__PURE__ */ new Map(), boxes = /* @__PURE__ */ new Map(), byE = {};
    edges2.forEach(function(e, k) {
      byE[e.id] = k;
      var m = e.id.match(RXE);
      if (!m || !rids.has(m[1])) return;
      bends.set(e.id, e.pts.map(function(pi) {
        return toPic(pt(pi));
      }));
      if (!e.path) return;
      var q = ["sx", "sy", "tx", "ty"].map(function(a) {
        return parseFloat(e.path.getAttribute(a)) || 0;
      });
      var no2 = e.path.getAttribute("spot");
      if (no2) q.push(parseInt(no2, 10));
      if (pp && pp.to && pp.k === k) {
        var j = pp.end ? 2 : 0;
        q[j] = pp.to[0];
        q[j + 1] = pp.to[1];
        no2 = spotNo(pp, pp.to);
        if (no2) q[4] = no2;
      }
      paths.set(e.id, q);
    });
    edges2.forEach(function(e) {
      var m = e.id.match(RXE);
      if (!m || !rids.has(m[1])) return;
      [e.s, e.t].forEach(function(i) {
        if (i != null && !/\|proc$/.test(nodes2[i].id)) boxes.set(nodes2[i].id, toPic(bx(i)));
      });
    });
    var ends = null;
    if (pp && pp.to && pp.n2 != null && rids.has((edges2[pp.k].id.match(RXE) || [])[1])) {
      var ep = edges2[pp.k];
      ends = /* @__PURE__ */ new Map([[ep.id, [nodes2[pp.end ? ep.s : pp.n2].id, nodes2[pp.end ? pp.n2 : ep.t].id]]]);
      boxes.set(nodes2[pp.n2].id, toPic(bx(pp.n2)));
    }
    var list2 = Array.from(rids), out = S.frame(boxes, bends, paths, list2, ends);
    if (list2.some(function(r) {
      return !out[r];
    })) return false;
    dropCopies();
    list2.forEach(function(rid) {
      var f = out[rid], ids = Object.keys(gE).filter(function(id) {
        return id.indexOf(rid + "|") === 0;
      });
      if (!ids.length) return;
      var ref = gE[ids[0]], hRef = ref[0], lRef = ref[ref.length - 1], pg = gN[rid + "|proc"];
      ids.forEach(function(id) {
        gE[id].forEach(function(g) {
          g.style.display = "none";
        });
      });
      if (pg) pg.style.display = "none";
      var doc2 = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g>' + f.halo + "</g><g>" + f.lines + "</g></svg>", "image/svg+xml").documentElement;
      var parts = Array.prototype.filter.call(doc2.childNodes, function(c) {
        return c.nodeType === 1;
      });
      [[parts[0], hRef, 0], [parts[1], lRef, 1]].forEach(function(q) {
        Array.prototype.filter.call(q[0].childNodes, function(c) {
          return c.nodeType === 1;
        }).forEach(function(c) {
          var el = document.importNode(c, true), id = el.getAttribute("data-e"), pn = el.getAttribute("data-n");
          var orig = id && gE[id] ? gE[id][q[2] ? gE[id].length - 1 : 0] : pn ? gN[pn] : null;
          el.removeAttribute("data-e");
          el.removeAttribute("data-n");
          el.classList.add("m2-ed-copy");
          q[1].parentNode.insertBefore(el, q[1]);
          shared.copies.push([el, orig, id && byE[id] != null ? byE[id] : null]);
        });
      });
      var gi = nodes2.findIndex(function(n) {
        return n.id === rid + "|proc";
      }), r0 = S.rest(rid);
      if (gi >= 0 && r0 && f.sq) {
        shared.liveG = shared.liveG || {};
        shared.liveG[gi] = [f.sq[0] - r0[0][0], f.sq[1] - r0[0][1], f.ang - r0[1], r0[2] ? f.len / r0[2] : 1, [r0[0][0] + picOff()[0], r0[0][1] + picOff()[1], r0[1], r0[2]]];
      }
    });
    return true;
  }
  function plainCanvas() {
    var el = V.img;
    if (!el || el.tagName !== "IMG" || !el.src) return;
    fetch(el.src).then(function(r) {
      return r.text();
    }).then(function(t) {
      var u = t.replace(/<rect width="100%" height="100%" fill="#fff"\/>\n?/, "");
      if (u === t || !on || V.img !== el) return;
      var url = URL.createObjectURL(new Blob([u], { type: "image/svg+xml" })), i = new Image();
      i.onload = function() {
        if (!on || V.img !== el) {
          URL.revokeObjectURL(url);
          return;
        }
        var old = el.src;
        el.src = url;
        if (old.indexOf("blob:") === 0) setTimeout(function() {
          URL.revokeObjectURL(old);
        }, 1e3);
      };
      i.src = url;
    }).catch(function() {
    });
  }
  function cdMap(m) {
    var d = m && m.downloads && m.downloads[0];
    return !!(d && d.label === "CellDesigner");
  }
  var warm;
  function __run63() {
    warm = null;
  }
  function warmUp() {
    clearTimeout(warm);
    warm = setTimeout(function() {
      var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
      if (cdp || !eb || !eb.offsetParent || !cdMap(V.current)) return;
      (window.requestIdleCallback || function(f) {
        setTimeout(f, 0);
      })(function() {
        if (cdp || !cdMap(V.current)) return;
        var s0 = status.textContent, w0 = status.classList.contains("m2-ed-warn");
        var back2 = function() {
          if (!on) {
            status.textContent = s0;
            status.classList.toggle("m2-ed-warn", w0);
          }
        };
        cdpy().then(back2, function() {
        });
        back2();
      });
    }, 2500);
  }
  function __run73() {
    warmUp();
  }
  function cdJoin() {
    return {
      ok: function() {
        return !!cdMk && !!cdMk.join;
      },
      own: placed,
      joinable: function(id, cid) {
        return cdMk.joinable(shared.cd.now, id, cid);
      },
      write: function(joins) {
        var N = cdNow(), t = N.t, done = [];
        joins.forEach(function(q) {
          try {
            t = cdMk.join(t, q[0], q[1]);
            done.push(q[1]);
          } catch (err) {
            warn(String(err && err.message || err));
          }
        });
        if (done.length) cdRebuild(t, N.sh);
        return done;
      }
    };
  }
  function __start5() {
    __run15();
    __run34();
    __run42();
    __run53();
    __run63();
    __run73();
    __run8();
  }
  function cdLine() {
    return { role: cdRole, lineAt: cdLineAt, onLine: cdOnLine, startOk: cdStartOk, how: cdHow, moveSays: cdMoveSays, make: cdLink, liveEnds: cdLiveEnds, marks: cdLinkMarks };
  }
  function cdSv() {
    return { list: cdSvList, box: function(i) {
      return cdFront(i, cdFeat(nodes2[i].id));
    }, open: cdSvOpen, move: cdSvMove, del: cdSvDelete, unitStays: true, on: cdPal, far: cdSvFar, typed: cdSsTyped };
  }
  function cdLit(hlE, glyphs) {
    var rx2 = /* @__PURE__ */ new Set();
    var F = shared.F, of = function(id) {
      return id.slice(0, id.lastIndexOf("|"));
    };
    shared.selE.forEach(function(k) {
      if (/\|[ab]$/.test(edges2[k].id)) rx2.add(of(edges2[k].id));
    });
    shared.selN.forEach(function(i) {
      var r = F.square(nodes2[i].id);
      if (r != null) rx2.add(r);
    });
    if (!rx2.size) return;
    edges2.forEach(function(e, k) {
      if (F.ownLine(e.id) && rx2.has(of(e.id))) hlE.add(k);
    });
    nodes2.forEach(function(n, i) {
      var r = F.square(n.id);
      if (r != null && rx2.has(r)) glyphs.add(i);
    });
  }
  function cdEndTo(k, end, i) {
    var e = edges2[k], nd = nodes2[i], here2 = end ? e.t : e.s, proc = function(x) {
      return /\|(proc|g\d*)$/.test(nodes2[x].id);
    }, rid = e.id.slice(0, e.id.lastIndexOf("|") + 1);
    if (edges2.some(function(f) {
      return f.id.indexOf(rid) === 0 && (f.s === i || f.t === i);
    })) return false;
    return !proc(here2) && !/\|g\d*$/.test(nodes2[end ? e.s : e.t].id) && !proc(i) && !nd.comp && !(nd.up != null && !nodes2[nd.up].comp);
  }
  function cdLeave(moves) {
    if (!cdMk || !moves.some(function(m) {
      try {
        return !!cdMk.aliasInfo(shared.cd.now, m[0]).complex;
      } catch (err) {
        return false;
      }
    })) return false;
    var N = cdNow(), t = N.t, t0 = t;
    moves.forEach(function(m) {
      try {
        if (cdMk.aliasInfo(t, m[0]).complex) t = cdMk.leave(t, m[0], m[1]);
      } catch (err) {
        warn(String(err && err.message || err));
      }
    });
    if (t === t0) return false;
    cdRebuild(t, N.sh);
    return true;
  }
  function cdRedraw(memo) {
    var dm = memo && memo.cd && memo.base === shared.cd.base && memo.text === shared.text && memo.block === gridBlock() && !undo.length && !memo.miss ? memo : null;
    var q = dm ? dm.q : cdDraw(shared.cd.base, shared.text);
    shared.cd.now = q[1];
    shared.cdBase = { now: q[1], text: q[2] };
    if (q[2] !== shared.text && !drag) {
      var ids = shared.selN.map(function(i) {
        return nodes2[i].id;
      }), np = points.length;
      setText(q[2]);
      parse();
      shared.selN = ids.map(function(id) {
        return nodes2.findIndex(function(n) {
          return n.id === id;
        });
      }).filter(function(i) {
        return i >= 0;
      });
      if (points.length !== np) {
        shared.selP = [];
        shared.selE = [];
      }
    }
    return [q[0], []];
  }
  function cdWhy(t, e) {
    var m = String(e && e.message || e), head = t.slice(0, 3e3);
    if (typeof console !== "undefined") console.warn("CellDesigner reading: " + m);
    if (!/^(AttributeError|KeyError|TypeError|ValueError|IndexError|Error)\b/.test(m) && !/NoneType|not subscriptable|index out of range/.test(m)) return m;
    var by = /metaid="COPASI/.test(head) ? "COPASI" : "another tool";
    if (/<sbml\b[^>]*\blevel="3"/.test(head)) return "an SBML Level 3 file holding CellDesigner\u2019s notes from an earlier version (CellDesigner writes Level 2): " + by + " wrote it after CellDesigner, and SBML files are not opened here yet";
    if (/^KeyError/.test(m)) return "its CellDesigner drawing names species its model no longer has: " + by + " changed the model after CellDesigner saved it, so the drawing cannot be matched to it";
    return "its CellDesigner drawing could not be read: a part CellDesigner writes is missing or written another way";
  }
  function cdFormat() {
    return {
      name: "cd",
      load: cdpy,
      engineCd: true,
      now: function() {
        return shared.cd.now;
      },
      ownFrame: true,
      live: function() {
        return liveCd;
      },
      cardDown: cdCardDown,
      mainLines: true,
      afView: false,
      stacks: false,
      insets: false,
      magenta: true,
      opened: plainCanvas,
      drawn: cdSessionSoon,
      redraw: cdRedraw,
      lit: cdLit,
      endTo: cdEndTo,
      undoKeep: function() {
        return { g: shared.text, b: shared.cd.base };
      },
      undoPut: function(t) {
        shared.cd.base = t.b;
        return t.g;
      },
      leave: cdLeave,
      nestReady: function() {
        return !!cdJs && !!cdJs.nestCheck;
      },
      nestWhy: function(moves) {
        return cdJs && cdJs.nestCheck ? cdJs.nestCheck(shared.cd.now, moves, { doc: cdDoc(shared.cd.now) }) : null;
      },
      modLine: function(id) {
        return /\|m\d+$/.test(id);
      },
      ownLine: function(id) {
        return /\|(a|b|r\d+|p\d+)$/.test(id);
      },
      fileType: { description: "CellDesigner", accept: { "application/xml": [".xml"] } },
      join: cdJoin(),
      line: cdLine(),
      sv: cdSv(),
      square: function(id) {
        var m = /^(.*)\|proc$/.exec(id);
        return m ? m[1] : null;
      },
      beside: function() {
        return shared.cd.now;
      },
      // a line's end at one of a node's places only, as a CellDesigner file keeps a species' line: places that follow each
      // node's size and so meet no line grid, its bend points lined up by the guides alone (state.js fixedEnds)
      fixedEnds: true,
      places: nodePlaces,
      reads: isCd,
      entry: cdMap,
      // opening: the file as it is (a positive influence drawn as the open triangle by cdrender, kept in the file)
      open: function(t, g0, still) {
        return cdpy().then(function() {
          return cdPicsFor(t);
        }).then(function() {
          if (!still()) return null;
          return { g: cdGraphml(t), t, own: { cd: { base: t, now: t } } };
        });
      },
      // a reader's own map drawn for the list (core.js drawText) by cdrender; keep: 'adding' when the map is shown next
      // (its document kept for it, cdDoc)
      drawOwn: function(t, g0, keep) {
        return cdpy().then(function() {
          return cdPicsFor(t);
        }).then(function() {
          return window.cdrender.render(cdDoc(t, keep || false), { classes: true, groups: true, glyph: cdGlyph });
        }).catch(function(e) {
          throw new Error(cdWhy(t, e));
        });
      },
      asGraphml: function(t) {
        return cdJs ? cdGraphml(t) : t;
      },
      // the site's file as the editor's GraphML (the reference of the site's drawing)
      // the read-ahead: the GraphML of its file (its document kept for the map shown), drawn by cdrender; that GraphML
      // handed to the opening (took); the drawing kept on leaving, with the file it was made from (keeper)
      ahead: {
        load: cdpy,
        graphml: function(t, b, keep) {
          return cdKnown(t) || cdJs.graphml(t, null, { doc: cdDoc(t, keep) });
        },
        took: cdRemember,
        draw: function(t, g) {
          cdPicMiss = false;
          var q = cdDraw(t, g, false);
          return { cd: true, base: t, text: g, q, block: gridBlock(), miss: cdPicMiss };
        },
        // miss: drawn before its pictures were read
        keeper: function() {
          return function(t, g, svg) {
            cdRemember(t, g);
            return { cd: true, base: t, text: g, q: [svg, t, g] };
          };
        }
      },
      kind: function(n) {
        var c = cdClsOf(n.id);
        return c ? c[0] : n.comp ? "compartment" : null;
      },
      // its species class, or compartment
      ownName: cdNameOf,
      rename: cdRename,
      nameable: function() {
        return !!cdMk;
      },
      // names read from and written into its file
      mapItems: cdBgItems
    };
  }

  // editor/src/cdcreate.js
  var import_notation = __toESM(require_notation());
  var CD_SP;
  function __run16() {
    CD_SP = [
      ["PROTEIN", "Protein", '<rect x="1.5" y="5" width="21" height="14" rx="3.5"/>'],
      ["GENE", "Gene", '<rect x="1.5" y="6" width="21" height="12"/>'],
      ["RNA", "RNA", '<path d="M11.5 7h11l-10 10h-11z"/>'],
      ["SIMPLE_MOLECULE", "Simple molecule", '<circle cx="12" cy="12" r="7"/>'],
      ["UNKNOWN", "Unknown", '<ellipse cx="12" cy="12" rx="10.5" ry="6" fill="currentColor" fill-opacity=".35" stroke="none"/>'],
      ["PHENOTYPE", "Phenotype", '<path d="M6 5h12l4.5 7-4.5 7h-12l-4.5-7z"/>'],
      ["DEGRADED", "Degraded", '<circle cx="12" cy="12" r="8"/><path d="M4 20l16-16"/>'],
      // the complex: its box with cut corners holding three overlapping members, each opaque over the one behind it
      ["COMPLEX", "Complex", '<path d="M6 2.5h12l3.5 3.5v12l-3.5 3.5h-12l-3.5-3.5v-12z"/><g class="thin" fill="#fff"><rect x="8.5" y="5.5" width="7.5" height="6.5" rx="1"/><rect x="5" y="10" width="6.5" height="4.5" rx="1"/><ellipse cx="14.3" cy="14.8" rx="4.6" ry="3.6"/></g>'],
      ["COMPARTMENT", "Compartment", '<rect x="1.5" y="3.5" width="21" height="17" rx="6"/><rect class="thin" x="4.5" y="6.5" width="15" height="11" rx="3.5"/>'],
      // CellDesigner's oval compartment (class OVAL), its two lines as the square one's
      ["OVAL", "Oval compartment", '<ellipse cx="12" cy="12" rx="10.5" ry="8.5"/><ellipse class="thin" cx="12" cy="12" rx="7.5" ry="5.5"/>']
    ];
  }
  function cdComp(cls) {
    return cls === "COMPARTMENT" || cls === "OVAL";
  }
  var CD_Q;
  var CD_GATES;
  var CD_LINE;
  var CD_HEAD;
  var CD_RX;
  var CD_DOTS;
  var CD_ADD;
  var CD_MOD;
  var CD_RED;
  var RED_OF;
  var CD_NAME;
  var cdK;
  function __run24() {
    CD_Q = '<path d="M9.8 10.2a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.6" class="in"/><circle class="dot" cx="12" cy="16.4" r=".8"/>';
    CD_GATES = [
      ["AND", "AND gate", '<text x="12" y="16.2" text-anchor="middle" font-size="9">&amp;</text>', "&amp;"],
      ["OR", "OR gate", '<path d="M12 9.5v7" class="in"/>', "|"],
      ["NOT", "NOT gate", '<path d="M12 9.6v4.6" class="in"/><circle class="dot" cx="12" cy="16.6" r=".8"/>', "!"],
      ["UNKNOWN", "Unknown gate", '<g transform="translate(0 .7)">' + CD_Q + "</g>", "?"]
    ].map(function(q) {
      var ins = q[0] === "NOT" ? "M12 1v5.5" : "M3 4l4.4 4.4M21 4l-4.4 4.4";
      return [q[0], q[1], '<circle cx="12" cy="13" r="6.5"/><path d="' + ins + 'M12 19.5V23"/>' + q[2], q[3]];
    });
    CD_LINE = '<path d="M1.5 12h15"/>', CD_HEAD = '<path d="M16 8.5l6.5 3.5-6.5 3.5z" fill="currentColor"/>';
    CD_RX = [
      ["STATE_TRANSITION", "State transition", CD_LINE + CD_HEAD],
      ["KNOWN_TRANSITION_OMITTED", "Known transition omitted", CD_LINE + '<path d="M6.5 16l2.5-8M10 16l2.5-8" class="in"/>' + CD_HEAD],
      ["UNKNOWN_TRANSITION", "Unknown transition", CD_LINE + '<g transform="translate(-2.5 -1.5)">' + CD_Q + "</g>" + CD_HEAD]
    ];
    CD_DOTS = '<path d="M1.5 18h21" class="in" stroke-dasharray="1.4 3.5"/>';
    CD_ADD = [
      ["ADD_REACTANT", "Add reactant (from a species onto a reaction; onto a logic gate, a new input)", CD_DOTS + '<path d="M3.5 4.5L11 18"/>'],
      ["ADD_PRODUCT", "Add product (from a reaction to a species)", CD_DOTS + '<path d="M11 18l6-9"/><path d="M20.5 4l-.6 6.6-5.2-3.4z" fill="currentColor"/>']
    ];
    CD_MOD = [
      ["CATALYSIS", "Catalysis", '<path d="M12 1.5v14"/><circle cx="12" cy="18.5" r="3"/>'],
      ["INHIBITION", "Inhibition", '<path d="M12 1.5v19M7 20.5h10"/>'],
      ["PHYSICAL_STIMULATION", "Physical stimulation", '<path d="M12 1.5v12.5M7.5 14h9l-4.5 7.5z"/>'],
      ["MODULATION", "Modulation", '<path d="M12 1.5v11M12 12.5l3.5 4.5-3.5 4.5-3.5-4.5z"/>'],
      ["TRIGGER", "Trigger", '<path d="M12 1.5v13.5M7 11.5h10M7.5 15h9l-4.5 7z"/>']
    ].map(function(q) {
      return [q[0], q[1] + (q[0] === "CATALYSIS" ? " (onto a reaction)" : " (onto a reaction, or between species with Reduced notation ticked)"), q[2]];
    });
    CD_RED = [["NEGATIVE_INFLUENCE", "INHIBITION"], ["REDUCED_PHYSICAL_STIMULATION", "PHYSICAL_STIMULATION"], ["REDUCED_MODULATION", "MODULATION"], ["REDUCED_TRIGGER", "TRIGGER"]];
    RED_OF = {};
    CD_RED.forEach(function(q) {
      RED_OF[q[1]] = q[0];
    });
    CD_NAME = {};
    CD_SP.concat(CD_RX, CD_ADD, CD_MOD).forEach(function(q) {
      CD_NAME[q[0]] = q[1].replace(/ \(.*\)$/, "");
    });
    CD_RED.forEach(function(q) {
      CD_NAME[q[0]] = CD_NAME[q[1]];
    });
    CD_NAME.POSITIVE_INFLUENCE = CD_NAME.PHYSICAL_STIMULATION;
    CD_GATES.forEach(function(q) {
      CD_NAME["G_" + q[0]] = q[1];
    });
    cdK = function(q) {
      return ["cd:" + q[0], q[1], q[2]];
    };
  }
  function palCd() {
    return [["Species", CD_SP.map(cdK)], ["Logic gates", CD_GATES.map(function(q) {
      return ["cd:G_" + q[0], q[1], q[2]];
    }), true], ["Reactions", CD_RX.concat(CD_ADD).map(cdK), true], ["Modifiers", CD_MOD.map(cdK)]];
  }
  var CD_GATE;
  function __run35() {
    CD_RX.concat(CD_ADD, CD_MOD).forEach(function(q) {
      ARCS["cd:" + q[0]] = 1;
    });
    CD_GATE = {};
    CD_GATES.forEach(function(q) {
      CD_GATE["cd:G_" + q[0]] = q[0];
    });
  }
  function cdKind(k) {
    return k && k.indexOf("cd:") === 0 ? k.slice(3) : null;
  }
  function cdPal() {
    return on && V.current === map && !!shared.cd && !!cdJs && !!cdMk && V.level === "full";
  }
  function cdStrict() {
    var id = palId();
    if (shared.cdStrictMemo[0] !== id) {
      var k = palStore()[id];
      shared.cdStrictMemo = [id, !!(k && k.strict === true)];
    }
    return shared.cdStrictMemo[1];
  }
  function cdFill() {
    [".m2-ed-pnot", ".m2-ed-plook", ".m2-ed-pprot", ".m2-ed-pcdc", ".m2-ed-psbgn"].forEach(function(c) {
      pal.querySelector(c).hidden = true;
    });
    var ps = pal.querySelector(".m2-ed-psites input");
    if (ps && ps.checked !== !!V.sites) ps.checked = !!V.sites;
    pal.querySelector(".m2-ed-pnot").style.display = "none";
    var hy = pal.querySelector(".m2-ed-pstrict"), hyc = hy.querySelector("input"), strict = cdStrict();
    hy.hidden = false;
    if (hyc.checked !== !strict) hyc.checked = !strict;
    cdInfo(hy, true);
    styleRow();
    cdColsRow();
    cdBgRows();
    var k = "cd" + (strict ? "S" : "");
    if (shared.palShown === k) return;
    shared.palShown = k;
    palSignsEl.innerHTML = palSigns(palCd());
    palBlocks();
  }
  var CD_INFO;
  function __run54() {
    CD_INFO = "Lets the modifiers\u2019 signs (inhibition, physical stimulation, modulation, trigger) join two species directly, written as CellDesigner\u2019s reduced notation, and allows a logic gate between species. Unticked: reactions and their modifiers only. CellDesigner\u2019s positive influence (an open arrowhead, not an SBGN sign) is made a physical stimulation when a map is opened.";
  }
  function cdInfo(hy, on_) {
    var lab = hy.querySelector("label"), ti = hy.querySelector(".m2-ed-ptip");
    if (!lab.dataset.sbgn) {
      lab.dataset.sbgn = lab.title;
      ti.dataset.sbgn = ti.dataset.info;
    }
    var v = on_ ? CD_INFO : ti.dataset.sbgn;
    if (ti.dataset.info !== v) {
      lab.title = on_ ? "Ticked (the default): the reduced notation signs shown" : lab.dataset.sbgn;
      ti.dataset.info = v;
    }
  }
  function cdCheck() {
    var g = window.cdrender && window.cdrender.GATE, miss = CD_SP.filter(function(q) {
      return !cdComp(q[0]) && !cdMk.LOOK[q[0]];
    }).map(function(q) {
      return q[0];
    }).concat(
      CD_RX.filter(function(q) {
        return cdMk.PROCESS.indexOf(q[0]) < 0;
      }).map(function(q) {
        return q[0];
      }),
      CD_MOD.filter(function(q) {
        return cdMk.MODS.indexOf(q[0]) < 0;
      }).map(function(q) {
        return q[0];
      }),
      CD_RED.filter(function(q) {
        return cdMk.REDUCED.indexOf(q[0]) < 0;
      }).map(function(q) {
        return q[0];
      }),
      CD_GATES.filter(function(q) {
        return !cdMk.NEED[q[0]];
      }).map(function(q) {
        return q[0];
      })
    );
    if (miss.length) console.error("The CellDesigner palette offers kinds cd_make lacks: " + miss.join(", "));
    if (g) CD_GATES.forEach(function(q) {
      var v = g[q[0]];
      if (v && q[3] !== v) console.error("The palette\u2019s " + q[1] + " sign differs from cdrender\u2019s " + v);
    });
  }
  function __run64() {
    pal.querySelector(".m2-ed-pstrict input").addEventListener("change", function(e) {
      if (!cdPal()) return;
      palDid([PAL_KEY], function() {
        var all = palStore(), id = palId();
        shared.cdStrictMemo = [id, !e.target.checked];
        if (id) {
          all[id] = { lang: "pd", look: "rn", strict: !e.target.checked };
          try {
            localStorage.setItem(PAL_KEY, JSON.stringify(all));
          } catch (er) {
          }
        }
      });
      shared.palShown = null;
      palShow();
    });
  }
  function cdApply(fn, sel, selLines) {
    keyFlush();
    var N = cdNow(), now = N.t;
    var t2;
    cdGrew = {};
    try {
      t2 = fn(now, N.sh);
    } catch (err) {
      cdGrew = null;
      if (!(err && err.refused)) warn(String(err && err.message || err).replace(/\.?$/, "."));
      return false;
    }
    if (t2 && t2.text != null) t2 = t2.text;
    var grew = cdGrew;
    cdGrew = null;
    if (!t2 || t2 === now) return false;
    return commit(null, { name: "CellDesigner change", ids: [].concat(typeof sel === "function" ? [] : sel || []), quiet: true, write: function() {
      cdRebuild(t2, N.sh);
    }, then: function() {
      var gk = nodes2.map(function(n, k) {
        return grew[n.id] ? k : -1;
      }).filter(function(k) {
        return k >= 0;
      });
      if (gk.length) setBoxes(grown(gk, boxOf, function(k) {
        return grew[nodes2[k].id] || boxOf(k);
      }, function() {
        return false;
      }));
      shared.selN = [];
      shared.selP = [];
      shared.selE = [];
      shared.part = null;
      if (typeof sel === "function") sel = sel();
      if (typeof selLines === "function") selLines = selLines();
      (sel || []).forEach(function(id) {
        nodes2.forEach(function(n, i) {
          if (n.id === id) shared.selN.push(i);
        });
      });
      (selLines || []).forEach(function(id) {
        edges2.forEach(function(q, k) {
          if (q.id === id || q.id === id + "|a" || q.id === id + "|b") shared.selE.push(k);
        });
      });
    } });
  }
  function cdRole(i) {
    var n = nodes2[i];
    if (/\|proc$/.test(n.id)) return "proc";
    if (/\|g\d*$/.test(n.id)) return "gate";
    if (n.comp || n.up != null && !nodes2[n.up].comp) return null;
    return "epn";
  }
  function cdRid(i) {
    return nodes2[i].id.replace(/\|(proc|g\d*)$/, "");
  }
  function cdGateRef(i) {
    var m = nodes2[i].id.match(/^(.*)\|g(\d*)$/);
    return m[2] ? m[1] + "|m" + m[2] : m[1];
  }
  function cdComplexAt(P) {
    var i = innermost(P, function(n) {
      return n.shape.kind === "Complex";
    });
    return i >= 0 ? nodes2[i].id : null;
  }
  var CD_COLS;
  var CD_COMP_DEFAULT;
  function __run74() {
    CD_COLS = [["file", "Original", "The map\u2019s own colours, as they were before another choice; new species and compartments in the colour most of their class have on it, Default for a class it has none of"], ["cd", "CellDesigner", "The whole map and new species and compartments in CellDesigner\u2019s own colours"], ["default", "Mist and sage", "The whole map and new species and compartments in the viewer\u2019s starting colours: a pale blue for proteins, a pale green for small molecules"], ["none", "No colours", "The whole map and new species and compartments white"], ["custom", "Custom default", "The whole map and new species in the colours kept by Set as default; a class with none as it is"], ["confetti", "Confetti", "Every species of the map, and every new one, a pastel of its own; compartments as they are"]];
    CD_COMP_DEFAULT = "ffdfdbce";
  }
  function cdCols() {
    return mapCols(["file", "none", "cd", "default", "confetti", "custom"], cdIs);
  }
  function cdIs(mode) {
    var t = shared.cd && shared.cd.now;
    if (!t || !cdMk) return false;
    if (mode === "file") {
      var r = origAll()[palId()];
      if (!r) return null;
      var now = cdMk.colours(t), same2 = function(a, b2) {
        return a == null || b2 == null || String(a).toLowerCase() === String(b2).toLowerCase();
      };
      return Object.keys(r.fill || {}).every(function(id) {
        return same2(now.fill[id], r.fill[id]);
      }) && Object.keys(r.line || {}).every(function(id) {
        var a = now.line[id] || {};
        return Object.keys(r.line[id]).every(function(q) {
          return same2(a[q], r.line[id][q]);
        });
      });
    }
    var n = cdMk.classColours(t), cols = [];
    Object.keys(n).forEach(function(cls) {
      if (cls !== "DEGRADED") cols = cols.concat(Object.keys(n[cls]));
    });
    if (!cols.length) return null;
    if (mode === "confetti") return cols.every(function(c) {
      return confettiOne("#" + c.slice(2));
    });
    var fn = cdFills(mode, t), read2 = 0;
    var all = Object.keys(n).every(function(cls) {
      var x = cls === "DEGRADED" ? null : fn(cls);
      if (x) read2++;
      return !x || Object.keys(n[cls]).every(function(c) {
        return c.slice(2) === x.slice(1).toLowerCase();
      });
    });
    return read2 ? all : null;
  }
  var CD_UNKNOWN;
  function __run82() {
    CD_UNKNOWN = "ffdddddd";
  }
  function cdColour(t, cls) {
    return cdColourIn(cdCols(), t, cls);
  }
  function cdColourIn(m, t, cls) {
    var comp = cdComp(cls);
    if (m === "none") return cls === "UNKNOWN" ? CD_UNKNOWN : "ffffffff";
    if (m === "confetti") {
      if (cls !== "DEGRADED" && !comp) return "ff" + confettiFill(t).slice(1);
      m = "file";
    }
    if (m === "custom") {
      var k = !comp && cdKept2()[cls];
      if (k && k.fill) return "ff" + k.fill.slice(1).toLowerCase();
      m = "file";
    }
    if (m === "file") {
      var f = t ? comp ? cdMk.compartmentColour(t) : cdMk.classColour(t, cls) : null;
      if (f) return f;
      m = "default";
    }
    if (m === "cd") return comp ? cdMk.COMP.colour : null;
    if (comp) return CD_COMP_DEFAULT;
    if (cls === "UNKNOWN") return CD_UNKNOWN;
    var c = V.schemeFill && window.cdrender ? V.schemeFill("default", window.cdrender.ROLE[cls] || "white") : null;
    return c ? "ff" + c.toLowerCase() : null;
  }
  var CD_SQ;
  function __run9() {
    CD_SQ = [["PROTEIN", "protein"], ["SIMPLE_MOLECULE", "simple molecule"], ["PHENOTYPE", "phenotype"], ["GENE", "gene"], ["RNA", "RNA"]];
  }
  function cdSquares(mode) {
    var sq2 = function(x, t) {
      return '<i style="background:#' + x.slice(2) + '" title="' + t + '"></i>';
    }, h;
    if (mode === "confetti") return confettiSquares();
    if (mode === "none") h = sq2("ffffffff", "every species, #FFFFFF; Unknown, drawn with no outline, #DDDDDD");
    else if (mode !== "file") {
      var seen = {};
      h = CD_SQ.map(function(q) {
        var x = (mode === "cd" ? null : cdColourIn(mode, mode === "custom" && shared.cd ? shared.cd.now : null, q[0])) || cdMk.LOOK[q[0]][2];
        if (seen[x]) {
          seen[x].push(q[1]);
          return null;
        }
        seen[x] = [q[1]];
        return x;
      }).filter(Boolean).map(function(x) {
        return sq2(x, seen[x].join(", ") + ", #" + x.slice(2).toUpperCase());
      }).join("");
    } else {
      var n = shared.cd && shared.cd.now ? cdMk.classColours(shared.cd.now) : {}, w = {}, order = [];
      Object.keys(n).forEach(function(cls) {
        Object.keys(n[cls]).forEach(function(col) {
          if (!(col in w)) {
            w[col] = 0;
            order.push(col);
          }
          w[col] += n[cls][col];
        });
      });
      h = order.slice().sort(function(a, b) {
        return w[b] - w[a] || order.indexOf(a) - order.indexOf(b);
      }).slice(0, 5).map(function(x) {
        return sq2(x, "#" + x.slice(2).toUpperCase() + ", " + w[x] + " species");
      }).join("");
    }
    return '<span class="m2-cs-sw">' + h + "</span>";
  }
  function cdColsRow() {
    return palDrop({ key: "cols", label: "Colours", title: "Colours of the map and of new species and compartments", list: CD_COLS, get: cdCols, set: function(v) {
      colsPick(v, cdCols(), function() {
        return cdMk.colours(cdNow().t);
      }, cdOriginal, cdRecolour);
    }, sq: cdSquares });
  }
  function cdOriginal(r) {
    var added = 0, F = r.fill || {}, L = r.line || {};
    cdApply(function(t0) {
      var now = cdMk.colours(t0);
      added = Object.keys(now.fill).filter(function(id) {
        return !(id in F);
      }).length;
      Object.keys(now.line).forEach(function(rid) {
        Object.keys(now.line[rid]).forEach(function(q) {
          if (!(L[rid] && q in L[rid])) added++;
        });
      });
      return cdMk.recolourAll(
        t0,
        function(cls, id) {
          return id in F && F[id] !== now.fill[id] ? F[id] : null;
        },
        function(k, rid, q) {
          var a = L[rid];
          return a && q in a && a[q] !== (now.line[rid] || {})[q] ? a[q] : null;
        }
      );
    }, []);
    return added;
  }
  function cdRecolour(mode) {
    if (mode === "file" || !shared.cd) return;
    cdApply(function(t0) {
      var lh = [];
      return cdMk.recolourAll(t0, cdFills(mode, t0), mode === "custom" ? null : function() {
        return mode === "confetti" ? confettiLine(lh) : "#000000";
      });
    }, []);
  }
  function cdFills(mode, t0) {
    var hues = [], kept = mode === "custom" ? cdKept2() : null;
    return function(cls) {
      var comp = cdComp(cls);
      if (mode === "confetti") return comp ? null : confettiPick(hues);
      if (mode === "custom") {
        var k = !comp && kept[cls];
        return k && k.fill || null;
      }
      var x = cdColourIn(mode, t0, cls) || (cdMk.LOOK[cls] || [])[2];
      return x ? "#" + x.slice(2) : null;
    };
  }
  function cdSize(cls) {
    if (cdComp(cls)) return cdMk.COMP.size.slice();
    var st = palStyle(), k = st === "custom" ? cdKept2()[cls] : null;
    if (k && k.w > 0 && k.h > 0) return [k.w, k.h];
    return st !== "default" && cls !== "COMPLEX" && shared.cd && cdMk.classSize(shared.cd.now, cls) || cdMk.LOOK[cls].slice(0, 2);
  }
  var CD_DEF_KEY;
  function __run10() {
    CD_DEF_KEY = "atlas-edit-cd-defaults";
  }
  function cdKept2() {
    return looksKept(CD_DEF_KEY);
  }
  function cdDef(i) {
    var id = nodes2[i].id, L, n, all = cdKept2();
    try {
      L = cdMk.look(shared.cd.now, id);
      n = cdMk.aliasInfo(shared.cd.now, id).homodimer || 1;
    } catch (e) {
      return;
    }
    var b = boxOf(i);
    all[L.cls] = { w: b[2], h: b[3], width: L.width, multimer: n > 1, copies: n, font: L.font };
    if (L.fill && L.cls !== "DEGRADED") all[L.cls].fill = L.fill;
    if (!keepLook(CD_DEF_KEY, all)) return;
    keepMapChoice("style", "custom");
    keepMapChoice("cols", "custom");
    styleRow();
    cdColsRow();
  }
  function cdCopies(cls) {
    var k = palStyle() === "custom" && cls !== "DEGRADED" ? cdKept2()[cls] : null;
    return k && k.multimer && k.w > 0 ? Math.max(2, k.copies || 2) : 1;
  }
  function cdKeptLook(t, alias, cls) {
    var k = cdKept2()[cls], n = cdCopies(cls);
    if (!k || cls === "DEGRADED") return t;
    if (cdCols() === "custom" && k.width > 0 && k.width !== 1) t = cdMk.restyle(t, alias, { width: k.width });
    if (n > 1) t = cdMk.homodimer(t, alias, n);
    if (palStyle() === "custom" && k.font > 0 && k.font !== 12) t = cdMk.restyle(t, alias, { font: k.font });
    return t;
  }
  function cdMake(P, kind) {
    var cls = cdKind(kind);
    if (!cls || CD_GATE[kind]) return;
    var s = cdSize(cls), e = cdComp(cls) ? 0 : 6 * (cdCopies(cls) - 1);
    var boxAt = function(sh) {
      var X = P[0] + sh[0] - s[0] / 2, Y2 = P[1] + sh[1] - s[1] / 2;
      if (gridSet.snap) {
        X += toGrid(X + s[0] / 2, gridSet.step);
        Y2 += toGrid(Y2 + s[1] / 2, gridSet.step);
      }
      return [+fmt(X), +fmt(Y2), s[0] - e, s[1] - e];
    };
    var cx = !cdComp(cls) && !/^(PHENOTYPE|DEGRADED)$/.test(cls) ? cdComplexAt(P) : null, made2 = null;
    var ok = cdApply(function(t, sh) {
      var b = boxAt(sh), r = cdComp(cls) ? cdMk.compartment(t, { name: "", box: b, oval: cls === "OVAL", colour: cdColour(t, cls) }) : cdMk.species(t, { cls, name: "", box: b, complex: cx, colour: cdColour(t, cls) });
      made2 = r.alias;
      return cdComp(cls) ? r.text : cdKeptLook(r.text, r.alias, cls);
    }, function() {
      return [made2];
    });
    if (ok && cx) joinPack([cx]);
  }
  function cdGateClick(P) {
    var kind = CD_GATE[tool.kind], i = linkEnd(P, -1), r = i >= 0 ? cdRole(i) : null;
    if (!shared.cdGate || shared.cdGate.kind !== kind) shared.cdGate = { kind, inputs: [] };
    var need = cdMk.NEED[kind];
    if (shared.cdGate.inputs.length < need) {
      if (r !== "epn" || shared.cdGate.inputs.indexOf(nodes2[i].id) >= 0) return;
      shared.cdGate.inputs.push(nodes2[i].id);
      paint();
      return;
    }
    if (r !== "proc" && (r !== "epn" || cdStrict())) return;
    var g = shared.cdGate, target = r === "proc" ? cdRid(i) : nodes2[i].id, out = null, L = cdGateLand(i, P) || {};
    if (!cdApply(
      function(t) {
        var q = cdMk.gate(t, { kind: g.kind, inputs: g.inputs, target, spot: L.spot, toAt: L.at });
        out = q.gate;
        return q.text;
      },
      function() {
        return [/\|m\d+$/.test(out) ? out.replace(/\|m(\d+)$/, "|g$1") : out + "|g"];
      }
    )) return;
    shared.cdGate = null;
    if (tool && !tool.sticky) palTake(null);
  }
  var cdHover;
  function __run122() {
    cdHover = null;
  }
  function cdHandles(i, cls) {
    return handleMarks(bx(i), cls);
  }
  function cdDot(Q, cls) {
    var d = Math.max(3, 4 * V.z);
    return '<rect class="' + cls + '" x="' + f1(sx(Q[0]) - d / 2) + '" y="' + f1(sy(Q[1]) - d / 2) + '" width="' + f1(d) + '" height="' + f1(d) + '"/>';
  }
  function cdCentre(i) {
    var b = bx(i);
    return [b[0] + b[2] / 2, b[1] + b[3] / 2];
  }
  function cdPicked(out, i) {
    out.push('<g transform="translate(' + f1(V.tx - x0 * V.z) + "," + f1(V.ty - y0 * V.z) + ") scale(" + V.z + ')"><path class="m2-ed-pick" stroke-width="' + f1(1 / Math.max(V.z, 0.01)) + '" d="' + shapeD(i) + '"/></g>');
    out.push(cdHandles(i, "m2-ed-pickh") + cdDot(cdCentre(i), "m2-ed-pickh"));
  }
  function cdLand(out, i, L) {
    var b = bx(i), off = 3.3 * V.z;
    out.push('<rect class="m2-ed-landbox" x="' + f1(sx(b[0]) - off) + '" y="' + f1(sy(b[1]) - off) + '" width="' + f1(b[2] * V.z + 2 * off) + '" height="' + f1(b[3] * V.z + 2 * off) + '"/>');
    out.push(cdHandles(i, "m2-ed-landh") + landMarks(L && L.all || [], L && L.Q || cdCentre(i)));
  }
  function cdGateOk(i) {
    if (i < 0) return false;
    var r = cdRole(i), need = cdMk.NEED[CD_GATE[tool.kind]], got = shared.cdGate && shared.cdGate.kind === CD_GATE[tool.kind] ? shared.cdGate.inputs : [];
    if (got.length < need) return r === "epn" && got.indexOf(nodes2[i].id) < 0;
    return r === "proc" || r === "epn" && !cdStrict();
  }
  function cdGateLand(i, P) {
    var r = cdRole(i);
    return r === "proc" ? cdPort(i, P, { mod: true }) : r === "epn" ? cdPort(i, P, { red: true }) : null;
  }
  function __run132() {
    V.view.addEventListener("pointermove", function(e) {
      var on_ = cdPal() && tool && CD_GATE[tool.kind] && !e.buttons, P = on_ ? at(e) : null, i = on_ ? linkEnd(P, -1) : -1;
      if (on_ && !cdGateOk(i)) i = -1;
      var h = i >= 0 ? { id: nodes2[i].id, P } : null, was = cdHover;
      cdHover = h;
      var q = function(x) {
        if (!x) return "";
        var k = nodes2.findIndex(function(n) {
          return n.id === x.id;
        }), L = k >= 0 && cdGateLand0(k, x.P);
        return x.id + (L ? (L.at || "") + (L.spot || "") : "");
      };
      if (q(was) !== q(h)) paint();
    });
  }
  function cdGateLand0(k, P) {
    var need = cdMk.NEED[CD_GATE[tool.kind]], got = shared.cdGate && shared.cdGate.kind === CD_GATE[tool.kind] ? shared.cdGate.inputs.length : 0;
    return got >= need ? cdGateLand(k, P) : null;
  }
  function __run142() {
    V.view.addEventListener("pointerleave", function() {
      if (cdHover) {
        cdHover = null;
        paint();
      }
    });
  }
  function cdGateMarks(out) {
    if (!tool || !CD_GATE[tool.kind] || !cdPal()) {
      shared.cdGate = null;
      cdHover = null;
      return;
    }
    if (shared.cdGate && CD_GATE[tool.kind] !== shared.cdGate.kind) shared.cdGate = null;
    if (shared.cdGate) shared.cdGate.inputs.forEach(function(id) {
      var i = nodes2.findIndex(function(n) {
        return n.id === id;
      });
      if (i >= 0) cdPicked(out, i);
    });
    var k = cdHover ? nodes2.findIndex(function(n) {
      return n.id === cdHover.id;
    }) : -1;
    if (k >= 0 && cdGateOk(k)) cdLand(out, k, cdGateLand0(k, cdHover.P));
  }
  function cdLinkMarks(out) {
    var add = cdAdd(), no2 = link.how && link.how.no, part = !no2 && link.how && link.how.part;
    var rx2 = !(add || part) || no2 ? -1 : cdRole(link.from) === "proc" ? link.from : link.to >= 0 && cdRole(link.to) === "proc" ? link.to : -1;
    if (rx2 >= 0) cdMainLine(out, rx2);
    if (cdFromJoin()) {
      var J = cdJoin2(link.from, false);
      out.push(cdDot(J || cdCentre(link.from), "m2-ed-pickh"));
    } else cdPicked(out, link.from);
    if (link.to < 0 || !link.how || no2) return;
    if (rx2 === link.to) out.push(landMarks([], link.how.land && link.how.land.Q || cdCentre(link.to)));
    else cdLand(out, link.to, link.how.land);
  }
  var cdOver;
  function __run152() {
    cdOver = null;
    V.view.addEventListener("pointermove", function(e) {
      var on_ = cdPal() && cdAdd() === "p" && !e.buttons && !link, i = on_ ? linkEnd(at(e), -1) : -1, id = i >= 0 && cdRole(i) === "proc" ? nodes2[i].id : null;
      if (id !== cdOver) {
        cdOver = id;
        paint();
      }
    });
    V.view.addEventListener("pointerleave", function() {
      if (cdOver) {
        cdOver = null;
        paint();
      }
    });
  }
  function cdOverMarks(out) {
    cdBgMarks(out);
    var i = cdOver && cdPal() && !link && cdAdd() === "p" ? nodes2.findIndex(function(n) {
      return n.id === cdOver;
    }) : -1;
    if (i < 0) {
      cdOver = null;
      return;
    }
    cdMainLine(out, i);
    var J = cdJoin2(i, false);
    if (J) out.push(cdDot(J, "m2-ed-pickh"));
  }
  function cdAdd() {
    var k = tool && cdKind(tool.kind);
    return k === "ADD_REACTANT" ? "r" : k === "ADD_PRODUCT" ? "p" : null;
  }
  function cdFree() {
    return !!tool && !!ARCS[tool.kind] && tool.sticky;
  }
  function cdFromJoin() {
    return cdAdd() === "p" || cdFree() && cdRole(link.from) === "proc";
  }
  function cdOnLine() {
    return !!cdAdd() || cdFree();
  }
  function cdStartOk(i) {
    var r = cdRole(i), add = cdAdd();
    return r !== "gate" && (cdFree() || (add === "r" ? r === "epn" : add === "p" ? r === "proc" : true));
  }
  function cdMain(i) {
    return edges2.map(function(e, k) {
      return e.t === i && /\|a$/.test(e.id) || e.s === i && /\|b$/.test(e.id) ? k : -1;
    }).filter(function(k) {
      return k >= 0;
    });
  }
  function cdJoin2(i, into) {
    var ka = edges2.findIndex(function(e) {
      return e.t === i && /\|a$/.test(e.id);
    });
    if (ka < 0) return null;
    var p = ports(ka), A = p[p.length - 2], C = p[p.length - 1];
    if (p.length === 2 && edges2[ka].s != null) A = cutShape(edges2[ka].s, A, C, bx(edges2[ka].s));
    var t = into ? 0.75 : 1.25;
    return [A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1])];
  }
  function cdMainLine(out, i) {
    cdMain(i).forEach(function(k) {
      var p = line(k);
      if (p) out.push('<path class="m2-ed-rxline" stroke-width="' + f1(Math.max(1.5, 1.5 * V.z)) + '" d="M' + p.map(function(q) {
        return f1(sx(q[0])) + " " + f1(sy(q[1]));
      }).join("L") + '"/>');
    });
  }
  function cdLineAt(P, not) {
    if (!cdOnLine()) return -1;
    var R = 5 / V.z, best = -1, bd = Infinity;
    edges2.forEach(function(e, k) {
      var i = /\|a$/.test(e.id) ? e.t : /\|b$/.test(e.id) ? e.s : null;
      if (i == null || i === not || cdRole(i) !== "proc") return;
      var p = line(k);
      for (var j = 1; p && j < p.length; j++) {
        var d = near(P, p[j - 1], p[j]);
        if (d <= R && d < bd) {
          bd = d;
          best = i;
        }
      }
    });
    return best;
  }
  function cdLiveEnds(S, P, C) {
    var h = link.how, ok = h && !h.no, J;
    if (ok && h.part === "reactant" && h.land && h.land.Q) {
      J = h.land.Q;
      return [cutShape(link.from, C, J, bx(link.from)), J];
    }
    if ((ok ? h.part === "product" : !h && cdFromJoin()) && (J = cdJoin2(link.from, false))) return [J, ok && h.land && h.land.Q ? cutShape(link.to, h.land.Q, J, bx(link.to)) : P];
    return [S, P];
  }
  function cdClick(P) {
    if (CD_GATE[tool.kind]) cdGateClick(P);
    else cdMake(P, tool.kind);
  }
  function cdHow(a, b, P) {
    var h = cdHow0(a, b, P);
    if (h && !h.no && P) h.land = cdPort(b, P, h);
    return h;
  }
  var cdClsMemo;
  function __run162() {
    cdClsMemo = { t: null, cls: {}, about: {} };
  }
  function cdMemo2() {
    var t = shared.cd.now;
    if (cdClsMemo.t !== t) cdClsMemo = { t, cls: {}, about: {} };
    return cdClsMemo;
  }
  function cdClsOf(id) {
    var M = cdMemo2();
    if (!(id in M.cls)) {
      try {
        var A = cdMk.aliasInfo(M.t, id);
        M.cls[id] = A.cls && [A.cls, A.homodimer || 1];
      } catch (e) {
        M.cls[id] = null;
      }
    }
    return M.cls[id];
  }
  function cdPort(i, P, how) {
    var b = bx(i), C = [b[0] + b[2] / 2, b[1] + b[3] / 2], best = null, bd = Infinity, all = [];
    var near2 = function(Q, o) {
      all.push(Q);
      var d = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      if (d < bd) {
        bd = d;
        best = o;
        o.Q = Q;
      }
    };
    if (how.mod && cdRole(i) === "proc") {
      var S = procPlaces(i);
      if (!S) return { Q: C };
      S.forEach(function(o, k) {
        near2([C[0] + o[0], C[1] + o[1]], { spot: k + 2 });
      });
      best.all = all;
      return best;
    }
    if (how.part === "reactant" && cdRole(i) === "proc") {
      var J = cdJoin2(i, true);
      return J ? { Q: J, all: [J] } : { Q: C };
    }
    var N = how.rx || how.red || how.part === "product" ? nodePlaces(i) : null;
    if (!N) return { Q: C };
    N.forEach(function(o) {
      near2([C[0] + o[0], C[1] + o[1]], { at: o[2] });
    });
    all.push(C);
    if (nodeCentre(i, P)) return { Q: C, all };
    best.all = all;
    return best;
  }
  function cdHow0(a, b, P) {
    var want = tool && ARCS[tool.kind] ? cdKind(tool.kind) : null, h = cdKindOk(a, b, P, want), g;
    if (h && h.no && want && tool.sticky && (g = cdKindOk(a, b, P, null)) && !g.no && !(g.rx && cdMk.MODS.indexOf(want) >= 0)) return g;
    if (h && h.no && want === "CATALYSIS" && tool.sticky && (g = cdKindOk(a, b, P, "PHYSICAL_STIMULATION")) && !g.no) return g;
    return h;
  }
  function cdKindOk(a, b, P, want) {
    var h = cdKind0(a, b, P, want), m = h && !h.no && cdSays(h, a, b);
    return m ? { no: m } : h;
  }
  function cdAbout(rid) {
    var M = cdMemo2();
    if (!(rid in M.about)) {
      try {
        M.about[rid] = cdMk.about(M.t, rid);
      } catch (e) {
        M.about[rid] = null;
      }
    }
    return M.about[rid];
  }
  function cdGateOf(i) {
    var m = nodes2[i].id.match(/^(.*)\|g(\d*)$/), A = m && cdAbout(m[1]);
    return !A ? null : m[2] ? A.gates[+m[2]] : A.gate && { kind: A.gate.kind, inputs: A.inputs || [] };
  }
  function cdNt(i) {
    var r = i < 0 ? "proc" : cdRole(i), c;
    if (r === "proc") return { kind: "process", cls: "process" };
    if (r === "gate") {
      var g = cdGateOf(i);
      return g ? import_notation.default.nodeKind("celldesigner", "BOOLEAN_LOGIC_GATE_" + g.kind) : null;
    }
    return r === "epn" && (c = cdClsOf(nodes2[i].id)) ? import_notation.default.nodeKind("celldesigner", c[0]) : null;
  }
  function cdAsk(cls, s, t, held2) {
    var ks = cdNt(s), kt = cdNt(t);
    if (!ks || !kt) return null;
    return import_notation.default.allowed(cls, ks, kt, { sets: ["pd"].concat(cdStrict() ? [] : ["reduced"]), held: !!held2, check: function(c) {
      if (c === "oneInput") {
        var g = cdGateOf(t);
        return g && g.inputs && g.inputs.length ? "A NOT gate has one input, and this one has it." : null;
      }
      if (c === "already" && t >= 0 && cdRole(t) === "proc" && import_notation.default.MODS.indexOf(cls) >= 0) {
        var A = cdAbout(cdRid(t)), al = nodes2[s].id;
        return A && A.mods.some(function(type, j) {
          return import_notation.default.arcKind("celldesigner", type) === cls && A.modAliases[j] === al;
        }) ? "This " + cls + " is there already." : null;
      }
      return null;
    } });
  }
  function cdSays(h, a, b) {
    if (h.rx) return cdAsk("consumption", a, -1) || cdAsk("production", -1, b);
    if (h.red) return cdAsk(import_notation.default.arcKind("celldesigner", h.red), a, b);
    if (h.gate) return cdAsk("logic arc", a, b);
    if (h.mod) return cdAsk(import_notation.default.arcKind("celldesigner", h.mod), a, b);
    if (h.part) return h.part === "reactant" ? cdAsk("consumption", a, b) : cdAsk("production", a, b);
    return null;
  }
  function cdMoveSays(k, end, i) {
    var e = edges2[k], m = e.id.match(/^(.*)\|(a|b|[rpm])(\d*)$/), A = m && cdAbout(m[1]);
    if (!A) return null;
    var sq2 = nodes2.some(function(n) {
      return n.id === m[1] + "|proc";
    });
    if (!sq2) {
      if (!import_notation.default.reducedType("celldesigner", A.type)) return null;
      var ea = edges2.filter(function(q) {
        return q.id === m[1] + "|a";
      })[0], eb = edges2.filter(function(q) {
        return q.id === m[1] + "|b";
      })[0];
      var was = end ? e.t : e.s, ends = [ea ? ea.s : null, eb ? eb.t : ea ? ea.t : null].map(function(x) {
        return x === was ? i : x;
      });
      if (ends[0] == null || ends[1] == null) return null;
      var pic = function(x) {
        var q = cdNt(x);
        return !!q && q.kind === "phenotype";
      };
      return cdAsk(import_notation.default.arcKind("celldesigner", A.type), ends[0], ends[1], !ea || pic(ea.s) === pic(ends[0]));
    }
    var cls = m[2] === "m" ? import_notation.default.arcKind("celldesigner", A.mods[+m[3]]) : /^[ar]$/.test(m[2]) ? "consumption" : "production";
    return cls ? cdAsk(cls, end ? e.s : i, end ? i : e.t) : null;
  }
  function cdKind0(a, b, P, want) {
    if (b < 0) return null;
    var ra = cdRole(a), rb = cdRole(b), line2 = !want;
    var isRx = want && CD_RX.some(function(q) {
      return q[0] === want;
    }), isMod = want && cdMk.MODS.indexOf(want) >= 0;
    var add = want === "ADD_REACTANT" ? "r" : want === "ADD_PRODUCT" ? "p" : null;
    if (!rb) return { no: "A line joins species, a reaction\u2019s square or a logic gate: never a compartment or a complex\u2019s member." };
    if (ra === "gate") return { no: "A logic gate has one line out, made with the gate." };
    if (rb === "gate") {
      if (ra !== "epn") return { no: "A logic gate\u2019s inputs are species." };
      return add === "r" || line2 ? { gate: true } : { no: "A new input of a logic gate is drawn with Add reactant." };
    }
    if (ra === "proc" && rb === "proc") return { no: "A line does not join two reactions." };
    if (add === "r") return ra === "epn" && rb === "proc" ? { part: "reactant" } : { no: "Add reactant goes from a species onto a reaction (its square or its main line) or onto a logic gate." };
    if (add === "p") return ra === "proc" && rb === "epn" ? { part: "product" } : { no: "Add product goes from a reaction (its square or its main line) to a species." };
    if (line2 && ra === "proc") return { part: "product" };
    if (line2 && rb === "proc") return onSquare(b, P) ? { mod: cdUsual(b) } : { part: "reactant" };
    if (ra === "proc") return isMod ? { no: "A " + CD_NAME[want].toLowerCase() + " goes from a species." } : { no: "A product added to a reaction is drawn with Add product." };
    if (rb === "proc") {
      return isRx ? { no: "A reactant added to a reaction is drawn with Add reactant; a reaction\u2019s sign makes a new reaction between two species." } : { mod: want || "CATALYSIS" };
    }
    if (isMod) {
      if (!RED_OF[want]) return { no: "CellDesigner has no catalysis between species: it ends on a reaction\u2019s square (between species, physical stimulation)." };
      return cdStrict() ? { no: "A " + CD_NAME[want].toLowerCase() + " between species is reduced notation, unticked in the palette; it ends on a reaction\u2019s square." } : { red: redIn(RED_OF[want]) };
    }
    return { rx: want || "STATE_TRANSITION" };
  }
  function onSquare(i, P) {
    var b = bx(i), R = 4 / V.z;
    return !P || P[0] >= b[0] - R && P[0] <= b[0] + b[2] + R && P[1] >= b[1] - R && P[1] <= b[1] + b[3] + R;
  }
  var cdUsualMemo;
  function __run17() {
    cdUsualMemo = [null, null, {}];
  }
  function cdUsual(i) {
    if (cdUsualMemo[0] !== shared.cd.now) {
      var n = {}, best = null, most = 0, m, re = /<celldesigner:modification\b[^>]*?\btype="([A-Z_]+)"/g;
      while (m = re.exec(shared.cd.now)) n[m[1]] = (n[m[1]] || 0) + 1;
      CD_MOD.forEach(function(q) {
        if (n[q[0]] > most) {
          most = n[q[0]];
          best = q[0];
        }
      });
      cdUsualMemo = [shared.cd.now, best, {}];
    }
    var rid = cdRid(i), met = cdUsualMemo[2];
    if (!(rid in met)) met[rid] = cdMetabolic(rid);
    return cdUsualMemo[1] || (met[rid] ? "CATALYSIS" : "PHYSICAL_STIMULATION");
  }
  function cdMetabolic(rid) {
    var esc = function(x) {
      return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };
    var r = shared.cd.now.match(new RegExp('<reaction\\b[^>]*\\bid="' + esc(rid) + '"[\\s\\S]*?</reaction>'));
    if (!r) return false;
    var ids = [], m, re = /<celldesigner:(?:baseReactant\b[^>]*?\bspecies|reactantLink\b[^>]*?\breactant)="([^"]+)"/g;
    while (m = re.exec(r[0])) ids.push(m[1]);
    return ids.some(function(s) {
      var sp = shared.cd.now.match(new RegExp('<species\\b[^>]*\\bid="' + esc(s) + '"[\\s\\S]*?</species>'));
      return sp && /<celldesigner:class>(SIMPLE_MOLECULE|ION)</.test(sp[0]);
    });
  }
  function cdLink(a, b, how) {
    var ia = nodes2[a].id, ib = nodes2[b].id, line2 = null;
    cdApply(function(t) {
      var q;
      var L = how.land || {};
      if (how.rx) {
        q = cdMk.reaction(t, { type: how.rx, from: ia, to: ib, toAt: L.at });
        line2 = q.reaction;
      } else if (how.red) {
        q = cdMk.reduced(t, { type: how.red, from: ia, to: ib, toAt: L.at });
        line2 = q.reaction;
      } else if (how.gate) q = cdMk.gateInput(t, cdGateRef(b), ia);
      else if (how.mod) {
        q = cdMk.modifier(t, cdRid(b), ia, how.mod, L.spot);
        line2 = cdRid(b) + "|" + q.part;
      } else {
        q = how.part === "reactant" ? cdMk.reactant(t, cdRid(b), ia) : cdMk.product(t, cdRid(a), ib, L.at);
        line2 = cdRid(how.part === "reactant" ? b : a) + "|" + q.part;
      }
      if (line2 && cdCols() === "confetti") {
        try {
          return cdMk.recolourLine(q.text, /\|/.test(line2) ? line2 : line2 + "|a", confettiLine(confettiHues(q.text)));
        } catch (e) {
          if (!(e && e.refused)) throw e;
        }
      }
      return q.text;
    }, [], function() {
      return line2 ? [line2] : [];
    });
  }
  function cdDelete(nodes, lines) {
    var al = [], jobs = [], ab = function(t, rid) {
      try {
        return cdMk.about(t, rid);
      } catch (e) {
        return null;
      }
    };
    var seen = {}, job = function(j) {
      var k = JSON.stringify(j);
      if (!seen[k]) {
        seen[k] = 1;
        jobs.push(j);
      }
    };
    var t0 = shared.cd.now;
    nodes.forEach(function(i) {
      var r = cdRole(i), rid = r ? cdRid(i) : null;
      if (r === "proc") job({ rid });
      else if (r === "gate") {
        var m = nodes2[i].id.match(/\|g(\d+)$/), A = ab(t0, rid);
        if (!m) job({ rid });
        else if (A) job({ rid, mod: A.mods[+m[1]], al: A.modAliases[+m[1]] });
      } else al.push(nodes2[i].id);
    });
    lines.forEach(function(k) {
      var e = edges2[k], m = e.id.match(/^(.*)\|(a|b|[rpmi])(\d*)$/);
      if (!m) return;
      var rid = m[1], A = ab(t0, rid);
      if (m[2] === "a" || m[2] === "b") job({ rid });
      else if (m[2] === "i") job({ rid, input: nodes2[e.s].id });
      else if (m[2] === "m" && A) job({ rid, mod: A.mods[+m[3]], al: A.modAliases[+m[3]] });
      else if (A) job({ rid, link: m[2], al: (m[2] === "r" ? A.rl : A.pl)[+m[3]] });
    });
    if (!al.length && !jobs.length) return false;
    cdApply(function(t) {
      jobs.forEach(function(j) {
        var A = ab(t, j.rid);
        if (!A) return;
        if (j.input) {
          if (A.inputs && A.inputs.indexOf(j.input) >= 0) t = cdMk.gateInputRemove(t, j.rid, j.input);
          return;
        }
        if (j.mod) {
          var n = A.mods.findIndex(function(x, q) {
            return x === j.mod && A.modAliases[q] === j.al;
          });
          if (n >= 0) t = cdMk.removeLine(t, j.rid, "m" + n);
          return;
        }
        if (j.link) {
          var l = (j.link === "r" ? A.rl : A.pl).indexOf(j.al);
          if (l >= 0) t = cdMk.removeLine(t, j.rid, j.link + l);
          return;
        }
        t = cdMk.removeLine(t, j.rid);
      });
      if (al.length) t = cdMk.remove(t, al);
      return t;
    });
    return true;
  }
  function __run18() {
    document.addEventListener("keydown", function(e) {
      if (e.key !== "Delete" && e.key !== "Backspace" || !cdPal() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if ((shared.selN.length || shared.selE.length && !shared.selP.length) && cdDelete(shared.selN, shared.selE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }
  function cdDeleteItem() {
    if (!rclick) return null;
    if (cdBgOwn(rclick)) return function() {
      cdBgDelete();
    };
    var sq2 = svAt(rclick);
    if (sq2) return function() {
      shared.svSel = { id: nodes2[sq2[0]].id, j: sq2[1] };
      svDelete();
    };
    var h = hit(rclick);
    if (h && h.n != null && asSpace(h.n)) return null;
    if (h && h.n != null) {
      var i = h.n;
      return function() {
        cdDelete(shared.selN.indexOf(i) >= 0 ? shared.selN : [i], shared.selN.indexOf(i) >= 0 ? shared.selE : []);
      };
    }
    if (h && h.e != null && h.p == null) {
      var k = h.e;
      return function() {
        var all = shared.selE.indexOf(k) >= 0;
        cdDelete(all ? shared.selN : [], all ? shared.selE : [k]);
      };
    }
    return null;
  }
  function cdItems() {
    if (!rclick) return null;
    if (cdBgOwn(rclick)) return cdBgOwnItems();
    var sq2 = svAt(rclick);
    if (sq2) return cdSvOwnItems(sq2);
    var h = hit(rclick), out = [];
    if (h && h.n != null) {
      var i = h.n, r = cdRole(i), id = nodes2[i].id;
      if (r === "gate") {
        var g = cdMk.about(shared.cd.now, cdRid(i)), m = id.match(/\|g(\d+)$/), now = m ? g.gates[+m[1]] : g.gate;
        if (!now) return null;
        var nin = m ? now.inputs.length : (g.inputs || []).length;
        CD_GATES.forEach(function(q) {
          if (q[0] !== now.kind && !(q[0] === "NOT" && nin > 1) && nin >= cdMk.NEED[q[0]]) out.push(["Make " + q[1], function() {
            cdApply(function(t) {
              return cdMk.gateType(t, cdGateRef(i), { kind: q[0] });
            }, [id]);
          }]);
        });
        return out;
      }
      if (r === "proc") return cdRxItems(cdRid(i));
      var A = cdMk.aliasInfo(shared.cd.now, id);
      if (!A.cls) {
        var cp = cdPicItems(i);
        cp.late = true;
        return cp.length ? cp : null;
      }
      out = cdSvItems(id, A);
      if (A.cls === "COMPLEX") {
        out = out.concat(cdPicItems(i));
        return out.length ? out : null;
      }
      out.push(["Change identity", subItem(function(r2, done) {
        return cdIdentity(id, r2, done);
      })]);
      if (A.cls !== "DEGRADED") out.push([A.homodimer > 1 ? "Make monomer" : "Make multimer", function() {
        cdApply(function(t) {
          return A.homodimer > 1 ? cdMk.homodimer(t, id, 1) : cdTopClear(cdMk.homodimer(t, id, 2), id, true);
        }, [id]);
      }]);
      out = out.concat(cdPicItems(i));
      out.late = true;
      return out;
    }
    if (h && h.e != null && h.p == null) {
      var ln = edges2[h.e], mm = ln.id.match(/^(.*)\|(a|b|m\d+)$/);
      if (!mm || ln.t != null && cdRole(ln.t) === "gate") return null;
      if (ln.s != null && cdRole(ln.s) === "gate") {
        var gs = ln.s, gref = cdGateRef(gs), ga = cdMk.about(shared.cd.now, cdRid(gs)), gm = nodes2[gs].id.match(/\|g(\d+)$/), gw2 = gm ? ga.gates[+gm[1]] : ga.gate;
        if (!gw2) return null;
        return cdModIdentity(gm ? CD_MODS : CD_RED, gw2.out, function(k) {
          cdApply(function(t) {
            return cdMk.gateType(t, gref, { output: k });
          }, [nodes2[gs].id]);
        });
      }
      if (mm[2][0] !== "m") return cdRxItems(mm[1]);
      var n = +mm[2].slice(1), ab = cdMk.about(shared.cd.now, mm[1]), was = ab.mods[n];
      if (cdMk.MODS.indexOf(was) < 0) return null;
      return cdModIdentity(CD_MODS, was, function(k) {
        cdApply(function(t) {
          return cdMk.modifierType(t, mm[1], n, k);
        }, [], [mm[1] + "|m" + n]);
      });
    }
    return null;
  }
  function cdIdentity(id, r, done) {
    var A = cdMk.aliasInfo(shared.cd.now, id);
    if (!A.cls) return null;
    return kindWindow(r, CD_SP.filter(function(q) {
      return q[0] !== "COMPLEX" && !cdComp(q[0]) && !(A.complex && /^(PHENOTYPE|DEGRADED)$/.test(q[0]));
    }).map(function(q) {
      return { name: q[1], own: q[0] === A.cls, go: function() {
        cdApply(function(t) {
          return cdMk.retype(t, id, q[0], { from: cdColour(t, A.cls), to: cdColour(t, q[0]) });
        }, [id]);
      } };
    }), done);
  }
  function cdModIdentity(set, was, go) {
    var same2 = function(k) {
      return k === was || k === "REDUCED_PHYSICAL_STIMULATION" && was === "POSITIVE_INFLUENCE";
    };
    return lateItem(["Change identity", subItem(function(r, done) {
      return kindWindow(r, set.map(function(q) {
        return { name: CD_NAME[q[1]], own: same2(q[0]), go: function() {
          go(redIn(q[0]));
        } };
      }), done);
    })]);
  }
  var redSeen;
  function redIn(k) {
    if (k !== "REDUCED_PHYSICAL_STIMULATION") return k;
    if (!redSeen || redSeen[0] !== shared.cd.now) redSeen = [shared.cd.now, cdMk.stimStyle(shared.cd.now)];
    return redSeen[1];
  }
  var CD_MODS;
  function __run19() {
    CD_MODS = CD_MOD.map(function(q) {
      return [q[0], q[0]];
    });
  }
  function cdRxItems(rid) {
    var ab = cdMk.about(shared.cd.now, rid), set = cdMk.PROCESS.indexOf(ab.type) >= 0 ? CD_RX : null;
    if (cdMk.REDUCED.indexOf(ab.type) >= 0) return cdModIdentity(CD_RED, ab.type, function(k) {
      cdApply(function(t) {
        return cdMk.reactionType(t, rid, k);
      }, [], [rid]);
    });
    if (ab.reversible === null) return null;
    var out = set ? [["Change identity", subItem(function(r, done) {
      return kindWindow(r, set.map(function(q) {
        return { name: q[1], own: q[0] === ab.type, go: function() {
          cdApply(function(t) {
            return cdMk.reactionType(t, rid, q[0]);
          }, [], [rid]);
        } };
      }), done);
    })]] : [];
    out.push([ab.reversible ? "Make irreversible" : "Make reversible", function() {
      cdReversible(rid, !ab.reversible);
    }]);
    out.late = true;
    return out;
  }
  function cdReversible(rid, on2) {
    return cdApply(function(t) {
      return cdMk.reversible(t, rid, on2);
    }, [], [rid]);
  }
  var cdRxSeen;
  function __run20() {
    cdRxSeen = [null, null];
  }
  function cdRxOf() {
    if (!shared.cd || shared.selP.length || shared.svSel || !shared.selE.length && !shared.selN.length) return null;
    if (shared.selE.length === 1 && !shared.selN.length && edges2[shared.selE[0]] && /\|[rp]\d+$/.test(edges2[shared.selE[0]].id)) return null;
    var rid = null, ok = true;
    shared.selE.forEach(function(k) {
      var m = edges2[k] && edges2[k].id.match(/^(.*)\|(a|b|r\d+|p\d+)$/);
      if (!m || rid && rid !== m[1]) ok = false;
      else rid = m[1];
    });
    shared.selN.forEach(function(i) {
      var m = nodes2[i] && nodes2[i].id.match(/^(.*)\|proc$/);
      if (!m || rid && rid !== m[1]) ok = false;
      else rid = m[1];
    });
    if (!ok || !rid) return null;
    var key = rid + "\0" + shared.cd.now;
    if (cdRxSeen[0] !== key) {
      var ab = null;
      try {
        ab = cdMk.about(shared.cd.now, rid);
      } catch (e) {
        ab = null;
      }
      cdRxSeen = [key, ab ? ab.reversible : null];
    }
    return cdRxSeen[1] === null ? null : { rid, on: cdRxSeen[1] };
  }
  var cdNm;
  var cdCardDrag;
  var cdCard;
  function __run21() {
    cdNm = null;
    cdCardDrag = null, cdCard = null;
  }
  function cdCardAt(e) {
    var hit2 = null;
    Array.prototype.forEach.call(V.img.querySelectorAll('[data-e] rect[height="11"]'), function(r) {
      if ((r.getAttribute("stroke") || "").toLowerCase() !== "#9aa0a6") return;
      var b = r.getBoundingClientRect();
      if (e.clientX >= b.left - 2 && e.clientX <= b.right + 2 && e.clientY >= b.top - 2 && e.clientY <= b.bottom + 2) hit2 = r.closest("[data-e]").getAttribute("data-e");
    });
    if (hit2 == null) return -1;
    var k = edges2.findIndex(function(q) {
      return q.id === hit2;
    });
    return k >= 0 ? k : edges2.findIndex(function(q) {
      return q.id.indexOf(hit2 + "|") === 0;
    });
  }
  function cdCardDown(e) {
    var k = cdCardAt(e);
    if (k < 0) return false;
    V.view.focus({ preventScroll: true });
    if (shared.selE.length === 1 && shared.selE[0] === k) {
      e.stopImmediatePropagation();
      e.preventDefault();
      cdCardDrag = { x: e.clientX, y: e.clientY };
      return true;
    }
    cdCardDrag = { pick: k, x: e.clientX, y: e.clientY };
    return true;
  }
  function __run222() {
    window.addEventListener("pointermove", function(e) {
      var d = cdCardDrag;
      if (!d) return;
      var far = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (d.pick != null) {
        if (!e.buttons || far >= 5) cdCardDrag = null;
        return;
      }
      if (far >= 4 && !d.said) {
        d.said = true;
        warn("CellDesigner keeps no place for a cardinality: it stays in the middle of its line.");
      }
    }, true);
    window.addEventListener("pointerup", function(e) {
      var d = cdCardDrag;
      cdCardDrag = null;
      if (!d || d.pick == null) return;
      e.stopImmediatePropagation();
      shared.selN = [];
      shared.selP = [];
      shared.selE = [d.pick];
      shared.part = null;
      cdCard = d.pick;
      paint();
    }, true);
    window.addEventListener("keydown", function(e) {
      if (cdCard == null || e.key !== "Delete" && e.key !== "Backspace" || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      var k = cdCard;
      if (!shared.cd || shared.selE.length !== 1 || shared.selE[0] !== k || shared.selN.length || shared.selP.length || !edges2[k]) {
        cdCard = null;
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (/\|[rp]\d+$/.test(edges2[k].id)) {
        cdCard = null;
        PF_CD.line.setCount(k, "");
      } else warn("A reaction's own reactant and product: their numbers are cleared in Properties, Cardinality.");
    }, true);
  }
  function cdNameDown(e, P, h) {
    if (!cdPal() || tool || e.shiftKey || e.pointerType !== "mouse" || edgeAt(P) || h && (h.p != null || h.e != null || h.n != null && !nodes2[h.n].comp)) return false;
    var k = -1, area = Infinity, info = null, pad = 3, res = null;
    nodes2.forEach(function(n, i) {
      var b = boxOf(i);
      if (!n.comp || b[2] * b[3] >= area || P[0] < b[0] || P[1] < b[1] || P[0] > b[0] + b[2] || P[1] > b[1] + b[3]) return;
      if (textsOf(i, null, res = res || svIcons()).some(function(el) {
        var r = el.getBoundingClientRect();
        return e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
      })) {
        k = i;
        area = b[2] * b[3];
      }
    });
    if (k < 0 || shared.selN.indexOf(k) < 0) return false;
    try {
      info = cdMk.nameInfo(cdNow().t, nodes2[k].id);
    } catch (err) {
      info = null;
    }
    if (!info) return false;
    e.stopImmediatePropagation();
    e.preventDefault();
    V.view.setPointerCapture(e.pointerId);
    V.view.focus({ preventScroll: true });
    cdNm = { k, id: nodes2[k].id, info, P, x: e.clientX, y: e.clientY, p: null, parts: null, pid: e.pointerId };
    return true;
  }
  function __run232() {
    window.addEventListener("pointermove", function(e) {
      var d = cdNm;
      if (!d || e.pointerId !== d.pid) return;
      if (!e.buttons) {
        cdNameUp();
        return;
      }
      if (!d.p && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      var Q = at(e), I = d.info, want = [I.np[0] + Q[0] - d.P[0], I.np[1] + Q[1] - d.P[1]], best = null, bd = Infinity;
      window.cdrender.NAME_PLACES.forEach(function(p) {
        var q = window.cdrender.namePoint(I.box, I.name, I.th, p, I.oval), dd = Math.hypot(q[0] - want[0], q[1] - want[1]);
        if (dd < bd) {
          bd = dd;
          best = [p, q];
        }
      });
      if (!d.parts) d.parts = textsOf(d.k, null);
      d.p = best[0];
      var dx = best[1][0] - I.np[0], dy = best[1][1] - I.np[1];
      d.parts.forEach(function(el) {
        if (dx || dy) el.setAttribute("transform", "translate(" + f1(dx) + " " + f1(dy) + ")");
        else el.removeAttribute("transform");
      });
    }, true);
    window.addEventListener("pointerup", function(e) {
      if (cdNm && e.pointerId === cdNm.pid) cdNameUp();
    }, true);
    window.addEventListener("pointercancel", function(e) {
      if (cdNm && e.pointerId === cdNm.pid) cdNameUp(true);
    }, true);
  }
  function cdNameUp(cancel) {
    var d = cdNm;
    cdNm = null;
    if (!d) return;
    if (cancel) {
      (d.parts || []).forEach(function(el) {
        el.removeAttribute("transform");
      });
      return;
    }
    if (d.p && cdApply(function(t) {
      return cdMk.nameAt(t, d.id, d.p);
    }, [d.id])) return;
    (d.parts || []).forEach(function(el) {
      el.removeAttribute("transform");
    });
    var k = nodes2.findIndex(function(n) {
      return n.id === d.id;
    });
    shared.selN = k >= 0 ? [k] : [];
    shared.selP = [];
    shared.selE = [];
    shared.part = null;
    paint();
  }
  function __run242() {
    V.view.addEventListener("dblclick", function(e) {
      if (!cdPal() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) {
        e.stopImmediatePropagation();
        return;
      }
      var named = function(n, k) {
        return cdRole(k) === "epn" || n.comp || n.up != null && nodes2[n.up].shape.kind === "Complex";
      };
      var P = at(e), sq2 = svAt(P);
      if (sq2) {
        e.stopImmediatePropagation();
        cdSvOpen(nodes2[sq2[0]].id, sq2[1]);
        return;
      }
      var i = nameAt(P, named);
      if (i < 0) return;
      var A = cdMk.aliasInfo(shared.cd.now, nodes2[i].id);
      if (A.cls === "DEGRADED") return;
      e.stopImmediatePropagation();
      typeIn(nodes2[i].id, null);
    }, true);
  }
  function cdNameOf(id, shown2) {
    var A = cdMk.aliasInfo(shared.cd.now, id), s = A.name || "";
    if (s === A.id && !shown2) return "";
    s = s.replace(/&#x([0-9a-f]+);/gi, function(m, h) {
      return String.fromCodePoint(parseInt(h, 16));
    }).replace(/&#(\d+);/g, function(m, d) {
      return String.fromCodePoint(+d);
    }).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    return window.cdrender.plainName(s, true).replace(/_br_/g, " ");
  }
  function cdRename(id, v) {
    cdApply(function(t) {
      return cdMk.rename(t, id, v);
    }, [id]);
  }
  var cdFeatMemo;
  function __run25() {
    cdFeatMemo = {};
  }
  function cdFeat(id) {
    var t = shared.cd.base;
    if (cdFeatMemo.t !== t) cdFeatMemo = { t };
    if (!(id in cdFeatMemo)) {
      try {
        cdFeatMemo[id] = cdMk.features(t, id);
      } catch (e) {
        cdFeatMemo[id] = null;
      }
    }
    return cdFeatMemo[id];
  }
  function cdFront(i, f) {
    var b = boxOf(i), s = 6 * ((f && f.homodimer || 1) - 1);
    return [b[0], b[1], b[2] - s, b[3] - s];
  }
  function cdSvList(i) {
    var n = nodes2[i];
    var role = n && cdRole(i);
    if (!n || n.comp || !cdMk || !window.cdrender || role !== "epn" && role !== null) return [];
    var f = cdFeat(n.id);
    if (!f) return [];
    var b = cdFront(i, f), on2 = window.cdrender.onBorder, out = [];
    f.residues.forEach(function(r, k) {
      out.push([r.name, on2(b, r.angle), [16, 16], SV, k]);
    });
    var st = f.structural || (shared.cdPend && shared.cdPend.id === n.id && shared.cdPend.kind === SS ? { text: "", angle: shared.cdPend.angle } : null);
    if (st) out.push([st.text, on2(b, st.angle), [2 * cdRx(st.text), 16], SS, 0]);
    if (f.info || shared.cdPend && shared.cdPend.id === n.id && shared.cdPend.kind === UI) out.push([f.info ? f.info.text : "", [b[0] + b[2] / 2, b[1]], [70, 16], UI, 0]);
    return out;
  }
  var cdTop;
  function __run27() {
    cdTop = Math.PI / 2;
  }
  function cdRx(txt) {
    return Math.trunc(window.cdrender.width(txt || "", 10) / 2 + 12);
  }
  function cdFrontOf(t, a, box3) {
    var I = cdMk.aliasInfo(t, a), b = box3 || I.box, s = 6 * ((I.homodimer || 1) - 1);
    return [b[0], b[1], b[2] - s, b[3] - s];
  }
  function cdAngleOn(p, F) {
    return cdMk.ratioAngle([(p[0] - F[0]) / F[2] - 0.5, (p[1] - F[1]) / F[3] - 0.5]);
  }
  function cdIcons0(t, a) {
    var f = cdMk.features(t, a), out = [];
    f.residues.forEach(function(r, k) {
      out.push({ ang: r.angle, s: [16, 16], k: SV, n: k });
    });
    if (f.structural) out.push({ ang: f.structural.angle, s: [2 * cdRx(f.structural.text), 16], k: SS, n: 0 });
    if (f.info || cdMultiTop(t, a)) out.push({ ang: null, s: [70, 16], k: UI, n: 0 });
    return out;
  }
  function cdOn(ic, F, F0) {
    var on2 = window.cdrender.onBorder, top = function(B) {
      return [B[0] + B[2] / 2, B[1]];
    };
    if (!F0) return ic.map(function(q) {
      return { c: q.ang == null ? top(F) : on2(F, q.ang), s: q.s, k: q.k, n: q.n };
    });
    var rel = function(B, p) {
      return [p[0] - B[0] - B[2] / 2, p[1] - B[1] - B[3] / 2];
    }, abs = function(p) {
      return [p[0] + F[0] + F[2] / 2, p[1] + F[1] + F[3] / 2];
    };
    var rs = ic.filter(function(q) {
      return q.k === SV;
    }), os = ic.filter(function(q) {
      return q.k !== SV;
    });
    var oP = os.map(function(q) {
      return q.ang == null ? rel(F, top(F)) : iconKeep(rel(F0, on2(F0, q.ang)), F0[2], F0[3], F[2], F[3]);
    });
    var rP = iconSpread(rs.map(function(q) {
      return { p: rel(F0, on2(F0, q.ang)), s: q.s };
    }), os.map(function(q, k) {
      return { p: oP[k], s: q.s };
    }), F0[2], F0[3], F[2], F[3], 20);
    return ic.map(function(q) {
      var k = rs.indexOf(q);
      return { c: abs(k < 0 ? oP[os.indexOf(q)] : rP[k]), s: q.s, k: q.k, n: q.n };
    });
  }
  function cdIcons(t, a, F) {
    return cdOn(cdIcons0(t, a), F || cdFrontOf(t, a));
  }
  function cdClash(c, s, icons) {
    return icons.some(function(q) {
      return Math.abs(c[0] - q.c[0]) < (s[0] + q.s[0]) / 2 + 2 - 1e-6 && Math.abs(c[1] - q.c[1]) < (s[1] + q.s[1]) / 2 + 2 - 1e-6;
    });
  }
  function cdPairs(ic) {
    var n = 0;
    ic.forEach(function(q, k) {
      ic.slice(k + 1).forEach(function(o) {
        if (cdClash(q.c, q.s, [o])) n++;
      });
    });
    return n;
  }
  function cdGrowStep(b, base) {
    var w = b[2] + 20, h = b[3] + 20 * base[1] / base[0];
    return [b[0] - (w - b[2]) / 2, b[1] - (h - b[3]) / 2, w, h];
  }
  function cdKindSize(t, a) {
    var I = cdMk.aliasInfo(t, a), L = cdMk.LOOK[I.cls];
    return L ? [L[0], L[1]] : [I.box[2], I.box[3]];
  }
  function cdRoom(t, a, s, first, skip, also) {
    var b0 = cdMk.aliasInfo(t, a).box, b = b0, base = cdKindSize(t, a), on2 = window.cdrender.onBorder, F0 = cdFrontOf(t, a), F = F0;
    var ic0 = cdIcons0(t, a).filter(function(q) {
      return !skip || !skip(q);
    });
    for (var g = 0; g < 80; g++) {
      F = cdFrontOf(t, a, b);
      var ic = cdOn(ic0, F, F0), cands = (first ? first(F) : []).concat(cdMk.placesFor(F[2], F[3], Math.max(20, s[1] + 4)));
      for (var j = 0; j < cands.length; j++) if (!cdClash(on2(F, cands[j]), s, ic) && !(also && also(cands[j]))) return { box: b === b0 ? null : b, angle: cands[j] };
      b = cdGrowStep(b, base);
    }
    return { box: b === b0 ? null : b, angle: cdMk.placesFor(F[2], F[3])[0] };
  }
  var cdGrew;
  function __run28() {
    cdGrew = null;
  }
  function cdGrowBounds(t, a, box3) {
    if (cdGrew && !cdGrew[a]) {
      var i = nodes2.findIndex(function(n) {
        return n.id === a;
      });
      if (i >= 0) cdGrew[a] = boxOf(i);
    }
    return cdMk.bounds(t, a, box3);
  }
  function cdGrow(t, a, box3, skip) {
    if (!box3) return t;
    var t0 = t, F0 = cdFrontOf(t, a), F = cdFrontOf(t, a, box3), ic = cdOn(cdIcons0(t, a).filter(function(q) {
      return !skip || !skip(q);
    }), F, F0), any = false;
    ic.forEach(function(q) {
      if (q.k === SV) {
        t = cdMk.residueMove(t, a, q.n, cdAngleOn(q.c, F));
        any = true;
      } else if (q.k === SS) t = cdMk.structuralMove(t, a, cdAngleOn(q.c, F));
    });
    t = cdGrowBounds(t, a, box3);
    return any ? cdFitOthers(t0, t, a) : t;
  }
  function cdFitOthers(t0, t, id) {
    cdMk.proteinAliases(t, id).forEach(function(a) {
      if (a === id) return;
      var was = cdPairs(cdIcons(t0, a)), ic = cdIcons0(t, a), b0 = cdMk.aliasInfo(t, a).box, b = b0, base = cdKindSize(t, a);
      if (cdPairs(cdOn(ic, cdFrontOf(t, a))) <= was) return;
      for (var g = 0; g < 30; g++) {
        b = cdGrowStep(b, base);
        if (cdPairs(cdOn(ic, cdFrontOf(t, a, b))) <= was) {
          t = cdGrowBounds(t, a, b);
          return;
        }
      }
    });
    return t;
  }
  function cdOthersTop(t, id) {
    var on2 = window.cdrender.onBorder, cs = cdMk.proteinAliases(t, id).filter(function(a) {
      return a !== id;
    }).map(function(a) {
      var F = cdFrontOf(t, a);
      return [F, cdIcons(t, a, F).filter(function(q) {
        return q.k !== SV;
      })];
    });
    return function(ang) {
      return cs.some(function(c) {
        return cdClash(on2(c[0], ang), [16, 16], c[1]);
      });
    };
  }
  function cdResidueNew(t, id) {
    t = cdMk.joinKin(t, id);
    var r = cdRoom(t, id, [16, 16], null, null, cdOthersTop(t, id));
    t = cdGrow(t, id, r.box);
    var o = cdMk.residue(t, id, { state: "empty", angle: r.angle });
    return { text: cdFitOthers(t, o.text, id), residue: o.residue };
  }
  function cdResidueRoom(t, id, k) {
    var sk = function(q) {
      return q.k === SV && q.n === k;
    }, r = cdRoom(t, id, [16, 16], null, sk, cdOthersTop(t, id));
    t = cdGrow(t, id, r.box, sk);
    return cdFitOthers(t, cdMk.residueMove(t, id, k, r.angle), id);
  }
  function cdSsFirst(txt, keep) {
    return function(F) {
      if (keep != null) return [keep];
      var rx2 = cdRx(txt), H2 = Math.PI / 2, c = [cdTop];
      [37 + rx2, -(37 + rx2)].forEach(function(dx) {
        if (Math.abs(dx) + rx2 <= F[2] / 2) c.push(H2 - dx / F[2] * H2);
      });
      return c;
    };
  }
  function cdSsAngle(t, id, txt) {
    return cdRoom(t, id, [2 * cdRx(txt), 16], cdSsFirst(txt), function(q) {
      return q.k === SS;
    }).angle;
  }
  function cdSsSet(t, id, v, keep) {
    var was = {};
    cdCopiesOf(t, id).forEach(function(a) {
      var s = cdMk.features(t, a).structural;
      was[a] = a === id && keep != null ? keep : s ? s.angle : null;
    });
    t = cdMk.structural(t, id, v, true);
    Object.keys(was).forEach(function(a) {
      var s = [2 * cdRx(v), 16], skip = function(q) {
        return q.k === SS;
      }, r = null;
      if (was[a] != null) r = cdRoom(t, a, s, function() {
        return [was[a]];
      }, skip);
      if (!r || r.box || r.angle !== was[a]) r = cdRoom(t, a, s, cdSsFirst(v), skip);
      t = cdMk.structuralMove(cdGrow(t, a, r.box, skip), a, r.angle);
    });
    return t;
  }
  var cdMultiMemo;
  function __run29() {
    cdMultiMemo = [null, null];
  }
  function cdKindKey(sp) {
    var cl = /<celldesigner:class>([^<]*)</.exec(sp), nm = / name="([^"]*)"/.exec(sp);
    return cl && nm ? cl[1] + "" + nm[1] : null;
  }
  function cdMultis(t) {
    if (cdMultiMemo[0] !== t) {
      var out = {}, re = /<species [^>]*>[\s\S]*?<\/species>/g, m;
      while (m = re.exec(t)) {
        var hd = /<celldesigner:homodimer>(\d+)</.exec(m[0]), key = hd && +hd[1] > 1 && cdKindKey(m[0]);
        if (key) out[key] = true;
      }
      cdMultiMemo = [t, out];
    }
    return cdMultiMemo[1];
  }
  function cdMultiTop(t, id) {
    var sp = new RegExp('<species [^>]*id="' + cdMk.aliasInfo(t, id).id + '"[^>]*>[\\s\\S]*?</species>').exec(t), key = sp && cdKindKey(sp[0]);
    return !!(key && cdMultis(t)[key]);
  }
  function cdCopiesOf(t, id) {
    var out = [id];
    cdAliasesOf(t, cdMk.aliasInfo(t, id).id).forEach(function(a) {
      if (a !== id) out.push(a);
    });
    return out;
  }
  function cdAliasesOf(t, sid) {
    var out = [], re = /<celldesigner:(?:complexS|s)peciesAlias\s[^>]*>/g, m, a, s;
    while (m = re.exec(t)) {
      a = /\sid="([^"]*)"/.exec(m[0]);
      s = /\sspecies="([^"]*)"/.exec(m[0]);
      if (a && s && s[1] === sid) out.push(a[1]);
    }
    return out;
  }
  function cdKindAliases(t, id) {
    var sp = new RegExp('<species [^>]*id="' + cdMk.aliasInfo(t, id).id + '"[^>]*>[\\s\\S]*?</species>').exec(t), key = sp && cdKindKey(sp[0]), out = [];
    if (!key) return cdCopiesOf(t, id);
    var re = /<species [^>]*>[\s\S]*?<\/species>/g, m;
    while (m = re.exec(t)) if (cdKindKey(m[0]) === key) {
      var sid = / id="([^"]*)"/.exec(m[0]);
      if (sid) cdCopiesOf(t, cdFirstAlias(t, sid[1]) || id).forEach(function(a) {
        if (out.indexOf(a) < 0) out.push(a);
      });
    }
    return out.length ? out : [id];
  }
  function cdFirstAlias(t, sid) {
    return cdAliasesOf(t, sid)[0] || null;
  }
  function cdTopClear(t, id, all) {
    (all ? cdKindAliases(t, id) : [id]).forEach(function(a) {
      for (var g = 0; g < 40; g++) {
        var ic = cdIcons(t, a), u = ic.filter(function(q) {
          return q.k === UI;
        });
        var hit2 = ic.filter(function(q) {
          return q.k !== UI && cdClash(q.c, q.s, u);
        })[0];
        if (!hit2) break;
        if (hit2.k === SS) {
          var s = cdMk.features(t, a).structural, r = cdRoom(t, a, hit2.s, cdSsFirst(s.text), function(q) {
            return q.k === SS;
          });
          t = cdMk.structuralMove(cdGrow(t, a, r.box, function(q) {
            return q.k === SS;
          }), a, r.angle);
        } else t = cdResidueRoom(t, a, hit2.n);
      }
    });
    return t;
  }
  function cdAngle(i, r) {
    return cdMk.ratioAngle(r);
  }
  function cdSvFar(P, k) {
    var b = boxOf(k);
    return P[0] < b[0] - 80 || P[0] > b[0] + b[2] + 80 || P[1] < b[1] - 12 || P[1] > b[1] + b[3] + 12;
  }
  function cdSvMove(i, j, r) {
    var q = cdSvList(i)[j], id = nodes2[i].id;
    if (!q || q[3] === UI) return false;
    var a = cdAngle(i, r), ok = cdApply(function(t) {
      return q[3] === SV ? cdMk.residueMove(cdMk.joinKin(t, id), id, q[4], a) : cdMk.structuralMove(t, id, a);
    }, []);
    shared.svSel = { id, j };
    paint();
    return ok;
  }
  function cdSvDelete(i, j) {
    var q = cdSvList(i)[j], id = nodes2[i].id;
    if (!q) return false;
    return cdApply(function(t) {
      return q[3] === SV ? cdMk.residueRemove(cdMk.joinKin(t, id), id, q[4]) : q[3] === SS ? cdMk.structural(t, id, null) : cdMk.info(t, id, null);
    }, [id]);
  }
  function cdSvOpen(id, j) {
    var i = nodes2.findIndex(function(n) {
      return n.id === id;
    }), q = i < 0 ? null : cdSvList(i)[j];
    if (!q) return;
    cdSvWin(id, q[3], q[4]);
  }
  function cdSsTyped(id, v, keep) {
    if (!keep) {
      if (shared.cdPend) {
        shared.cdPend = null;
        paint();
      }
      return;
    }
    v = v.trim();
    var pend = shared.cdPend && shared.cdPend.id === id && shared.cdPend.kind === SS ? shared.cdPend : null;
    shared.cdPend = null;
    if (pend && v) cdApply(function(t) {
      return cdSsSet(t, id, v, pend.angle);
    }, []);
    paint();
  }
  function cdSvWin(id, kind, k) {
    if (shared.typing) shared.typing.done(true);
    var m0 = map, res = kind === SV, ui = kind === UI;
    var feat = function() {
      try {
        return cdMk.features(shared.cd.base, id);
      } catch (e) {
        return null;
      }
    };
    var f = feat();
    if (!f || res && !f.residues[k]) return;
    var box3 = document.createElement("div");
    box3.className = "m2-cx m2-cdsv";
    box3.setAttribute("role", "dialog");
    box3.setAttribute("aria-label", res ? "Residue" : ui ? "Unit of information" : "Structural state");
    box3.innerHTML = ui ? '<label><span>Prefix</span><select></select></label><label class="m2-cdsv-list"><span>Label</span><select></select></label><label class="m2-cdsv-text"><span>Label</span><input type="text" spellcheck="false"></label><button type="button">Remove</button>' : res ? '<label><span>Site</span><input type="text" spellcheck="false"></label><label><span>Modification</span><select></select></label>' : '<label><span>State</span><select><option value="open">Open</option><option value="closed">Closed</option><option value="">Text</option></select></label><label class="m2-cdsv-text"><span>Text</span><input type="text" spellcheck="false"></label><button type="button">Remove</button>';
    var inp = box3.querySelector("input"), sel = box3.querySelector("select"), row = box3.querySelector(".m2-cdsv-text");
    var lrow = box3.querySelector(".m2-cdsv-list"), lab = lrow && lrow.querySelector("select");
    var fixed = function() {
      return !!cdMk.INFO[sel.value];
    };
    var labels = function() {
      lab.textContent = "";
      (cdMk.INFO[sel.value] || []).forEach(function(l) {
        lab.appendChild(new Option(l, l));
      });
      lrow.hidden = !fixed();
      row.hidden = fixed();
    };
    if (res) cdMk.STATES.forEach(function(s) {
      sel.appendChild(new Option(s, s));
    });
    var rid = res ? f.residues[k].id : null;
    var pendOf = function() {
      return shared.cdPend && shared.cdPend.id === id && shared.cdPend.kind === kind ? shared.cdPend : null;
    };
    if (ui) {
      Object.keys(cdMk.INFO).concat(["N", "free input"]).forEach(function(p) {
        sel.appendChild(new Option(p, p));
      });
      sel.value = f.info ? f.info.prefix : "pc";
      labels();
      if (fixed()) lab.value = f.info ? f.info.label : lab.options[0].value;
      else inp.value = f.info ? f.info.label : "";
    } else if (res) {
      inp.value = f.residues[k].name || "";
      sel.value = f.residues[k].state || "empty";
    } else {
      var now = f.structural ? f.structural.text : "";
      sel.value = /^(open|closed)$/.test(now) ? now : "";
      inp.value = sel.value ? "" : now;
      row.hidden = !!sel.value;
    }
    var T;
    var live = function() {
      return shared.typing === T && on && map === m0;
    };
    var kNow = function() {
      var g = feat();
      return g ? g.residues.findIndex(function(r) {
        return r.id === rid;
      }) : -1;
    };
    var jOf = function() {
      var g = feat();
      return !g ? -1 : res ? kNow() : ui ? g.info || pendOf() ? g.residues.length + (g.structural ? 1 : 0) : -1 : g.structural || pendOf() ? g.residues.length : -1;
    };
    var write2 = function(fn) {
      if (!live()) return;
      if (res && (k = kNow()) < 0) {
        T.done(false);
        return;
      }
      cdApply(fn, []);
      var j = jOf();
      if (j < 0 && !pendOf()) {
        T.done(false);
        return;
      }
      shared.svSel = j < 0 ? null : { id, j };
      paint();
    };
    var site2 = function() {
      var kk = kNow(), r = kk < 0 ? null : feat().residues[kk], v = inp.value.trim();
      if (r && v !== (r.name || "")) write2(function(t) {
        return cdMk.residueName(cdMk.joinKin(t, id), id, k, v);
      });
    };
    var put2 = function(v) {
      var pend = pendOf();
      if (v) {
        write2(function(t) {
          return cdSsSet(t, id, v, pend ? pend.angle : null);
        });
        if (pend && shared.cdPend === pend) shared.cdPend = null;
      } else if (!pend) write2(function(t) {
        return cdMk.structural(t, id, null);
      });
    };
    var unit = function(q) {
      var pend = pendOf();
      if (!q) {
        if (!pend) write2(function(t) {
          return cdMk.info(t, id, null);
        });
        return;
      }
      write2(function(t) {
        return cdTopClear(cdMk.info(t, id, q, true), id, false);
      });
      if (pend && shared.cdPend === pend) shared.cdPend = null;
    };
    var chosen = function() {
      return [sel.value, fixed() ? lab.value : inp.value.trim()];
    };
    var typed = function() {
      if (ui) {
        var g = (feat() || {}).info, q = chosen();
        if (q[1] && (pendOf() || !g || g.prefix !== q[0] || g.label !== q[1])) unit(q);
        return;
      }
      if (res) site2();
      else if (!sel.value) {
        var v = inp.value.trim(), st = (feat() || {}).structural;
        if (v !== (st ? st.text : "") || v && pendOf()) put2(v);
      }
    };
    var place = function() {
      var i = nodes2.findIndex(function(n) {
        return n.id === id;
      }), j = jOf(), q = i < 0 || j < 0 ? null : cdSvList(i)[j];
      if (i < 0 || !box3.isConnected) return;
      if (!q || q[3] !== kind) {
        var b = boxOf(i);
        q = [0, [b[0] + b[2] / 2, b[1] + b[3] / 2], [b[2], 0]];
      }
      var vr = V.view.getBoundingClientRect(), z = box3.getBoundingClientRect().width / box3.offsetWidth || 1, w = box3.offsetWidth * z, ht = box3.offsetHeight * z;
      var nb = boxOf(i), X0 = Math.min(nb[0], q[1][0] - q[2][0] / 2), X1 = Math.max(nb[0] + nb[2], q[1][0] + q[2][0] / 2), Y0 = Math.min(nb[1], q[1][1] - q[2][1] / 2), Y1 = Math.max(nb[1] + nb[3], q[1][1] + q[2][1] / 2);
      var L = vr.left + sx(X0) * z, R = vr.left + sx(X1) * z, T0 = vr.top + sy(Y0) * z, B = vr.top + sy(Y1) * z, g = 10 * z, W = V.winW(), H2 = V.winH();
      var cx = Math.max(4, Math.min((L + R) / 2 - w / 2, W - 4 - w)), cy = Math.max(4, Math.min((T0 + B) / 2 - ht / 2, H2 - 4 - ht));
      var at2 = B + g + ht <= H2 - 4 ? [cx, B + g] : T0 - g - ht >= 4 ? [cx, T0 - g - ht] : R + g + w <= W - 4 ? [R + g, cy] : L - g - w >= 4 ? [L - g - w, cy] : [cx, Math.max(4, H2 - 4 - ht)];
      box3.style.left = at2[0] / z + "px";
      box3.style.top = at2[1] / z + "px";
    };
    var outside = function(e) {
      if (!box3.contains(e.target)) T.done(true);
    };
    T = shared.typing = { inp, place, done: function(keep) {
      if (shared.typing !== T) return;
      if (keep) typed();
      shared.typing = null;
      box3.remove();
      document.removeEventListener("pointerdown", outside, true);
      if (pendOf()) shared.cdPend = null;
      paint();
    } };
    sel.addEventListener("change", function() {
      if (ui) {
        var g = (feat() || {}).info, typed2 = inp.value.trim(), was = typed2 || (g && !cdMk.INFO[g.prefix] ? g.label : "");
        labels();
        if (g && g.prefix === sel.value) {
          if (fixed()) lab.value = g.label;
          else inp.value = g.label;
          return;
        }
        if (fixed()) unit(chosen());
        else {
          inp.value = was;
          inp.focus();
          if (was) unit(chosen());
        }
        return;
      }
      if (res) {
        var s = sel.value;
        write2(function(t) {
          return cdMk.residueState(cdMk.joinKin(t, id), id, k, s);
        });
        return;
      }
      row.hidden = !!sel.value;
      if (sel.value) put2(sel.value);
      else {
        var g = feat();
        inp.value = g && g.structural ? g.structural.text : "";
        inp.focus();
      }
    });
    inp.addEventListener("change", typed);
    if (ui) lab.addEventListener("change", function() {
      unit(chosen());
    });
    if (!res) box3.querySelector("button").addEventListener("click", function() {
      if (pendOf()) T.done(false);
      else if (ui) unit(null);
      else put2(null);
    });
    box3.addEventListener("keydown", function(e) {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        T.done(false);
        V.view.focus({ preventScroll: true });
      } else if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        T.done(true);
        V.view.focus({ preventScroll: true });
      } else if ((e.ctrlKey || e.metaKey) && V.letter(e) === "a" && !/input/i.test(e.target.tagName)) e.preventDefault();
    });
    box3.addEventListener("pointerdown", function(e) {
      e.stopPropagation();
    });
    box3.addEventListener("keydown", function(e) {
      if (e.key !== "Tab") return;
      var fs = Array.prototype.filter.call(box3.querySelectorAll("input, select, button"), function(x) {
        return !x.closest("[hidden]");
      }), at2 = fs.indexOf(document.activeElement);
      e.preventDefault();
      fs[(at2 + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus();
    });
    document.body.appendChild(box3);
    document.addEventListener("pointerdown", outside, true);
    var j0 = jOf();
    shared.svSel = j0 < 0 ? null : { id, j: j0 };
    paint();
    place();
    box3.tabIndex = -1;
    box3.setAttribute("data-keys-own", "");
    setTimeout(function() {
      if (shared.typing === T) box3.focus({ preventScroll: true });
    }, 0);
  }
  function cdSvAdd(id, kind) {
    var i = nodes2.findIndex(function(n) {
      return n.id === id;
    });
    if (i < 0) return;
    if (shared.typing) shared.typing.done(true);
    if (kind === SV) {
      var k = null;
      if (!cdApply(function(t) {
        var o = cdResidueNew(t, id);
        k = o.residue;
        return o.text;
      }, [])) return;
      shared.svSel = { id, j: k };
      paint();
      return;
    }
    shared.cdPend = kind === SS ? { id, kind: SS, angle: cdSsAngle(shared.cd.base, id, "") } : { id, kind: UI };
    if (kind === UI) {
      cdSvWin(id, UI, 0);
      return;
    }
    var j = cdSvList(i).map(function(q) {
      return q[3];
    }).indexOf(SS);
    if (j < 0) {
      shared.cdPend = null;
      return;
    }
    typeIn(id, j);
  }
  function cdSvItems(id, A) {
    var f = cdFeat(id), out = [];
    if (!f || A.cls === "DEGRADED") return out;
    if (f.protein) out.push(["Add state variable", function() {
      cdSvAdd(id, SV);
    }]);
    if (!f.structural) out.push(["Add structural state", function() {
      cdSvAdd(id, SS);
    }]);
    if (!f.info) out.push(["Add unit of information", function() {
      cdSvAdd(id, UI);
    }]);
    return out;
  }
  function cdSvOwnItems(q) {
    var i = q[0], it = cdSvList(i)[q[1]], id = nodes2[i].id;
    if (!it) return null;
    var out = [["Edit", function() {
      cdSvOpen(id, q[1]);
    }]];
    if (it[3] === UI) return out.concat(cdUnitItems(id, q[1]));
    if (it[3] !== SV) return out;
    var now = cdFeat(id).residues[it[4]].state || "empty";
    out.push(["Change state", subItem(function(r, done) {
      return kindWindow(r, cdMk.STATES.map(function(s) {
        return {
          name: s,
          own: s === now,
          go: function() {
            cdApply(function(t) {
              return cdMk.residueState(cdMk.joinKin(t, id), id, it[4], s);
            }, []);
            shared.svSel = { id, j: q[1] };
            paint();
          }
        };
      }), done);
    })]);
    return out;
  }
  function cdUnitItems(id, j) {
    var f = cdFeat(id), now = f && f.info ? f.info.prefix + ":" + f.info.label : "", list2 = [];
    Object.keys(cdMk.INFO).forEach(function(p) {
      cdMk.INFO[p].forEach(function(l) {
        list2.push([p, l]);
      });
    });
    return [["Change unit", subItem(function(r, done) {
      return kindWindow(r, list2.map(function(u) {
        return { name: u.join(":"), own: u.join(":") === now, go: function() {
          cdApply(function(t) {
            return cdMk.info(t, id, u, true);
          }, []);
          shared.svSel = { id, j };
          paint();
        } };
      }), done);
    })]];
  }
  function cdSpecies(i) {
    return cdRole(i) === "epn" && nodes2[i].el.getAttribute("yfiles.foldertype") !== "group";
  }
  function cdSetSize(pairs) {
    var ids = [], was = {}, one = {};
    pairs.forEach(function(q) {
      var b = boxOf(q[0]);
      if (q[1].some(function(v, j) {
        return Math.abs(v - b[j]) >= 5e-3;
      })) {
        ids.push(nodes2[q[0]].id);
        was[nodes2[q[0]].id] = b;
        one[q[0]] = q[1];
      }
    });
    if (!ids.length) {
      liveOff();
      sizeOff();
      paint();
      return;
    }
    commit(null, { name: "size", ids, write: function() {
      setBoxes(one);
    }, parsed: true, then: function() {
      var ks = nodes2.map(function(n, k) {
        return ids.indexOf(n.id) >= 0 ? k : -1;
      }).filter(function(k) {
        return k >= 0;
      });
      setBoxes(grown(ks, boxOf, function(k) {
        return was[nodes2[k].id] || boxOf(k);
      }, function() {
        return false;
      }));
      shared.selN = [];
      nodes2.forEach(function(n, k) {
        if (ids.indexOf(n.id) >= 0) shared.selN.push(k);
      });
      shared.sizeRec = null;
    } });
  }
  var cdLook;
  var cdLineMemo;
  function __run30() {
    cdLook = [], cdLineMemo = [null, null, null, null];
  }
  function cdLineRead(k) {
    var id = edges2[k].id;
    if (cdLineMemo[0] !== id || cdLineMemo[1] !== shared.cd.now) {
      var c = null, w = null;
      try {
        c = cdMk.lineColour(shared.cd.now, id);
        w = cdMk.lineWidth(shared.cd.now, id);
      } catch (e) {
        c = w = null;
      }
      cdLineMemo = [id, shared.cd.now, c, w];
    }
    return cdLineMemo;
  }
  function cdLineColour(k) {
    return cdLineRead(k)[2];
  }
  var cdPartsMemo;
  function __run31() {
    cdPartsMemo = [null, null, null];
  }
  function cdParts(rid) {
    if (cdPartsMemo[0] !== rid || cdPartsMemo[1] !== shared.cd.now) {
      var p;
      try {
        p = cdMk.participants(shared.cd.now, rid);
      } catch (e) {
        p = [];
      }
      cdPartsMemo = [rid, shared.cd.now, p];
    }
    return cdPartsMemo[2];
  }
  var cdCountMemo;
  function __run322() {
    cdCountMemo = {};
  }
  function cdCount(id) {
    if (cdCountMemo.now !== shared.cd.now) cdCountMemo = { now: shared.cd.now };
    if (!(id in cdCountMemo)) {
      var c;
      try {
        c = cdMk.stoichiometry(shared.cd.now, id);
      } catch (e) {
        c = void 0;
      }
      cdCountMemo[id] = c;
    }
    return cdCountMemo[id];
  }
  function cdMember(i) {
    var n = nodes2[i];
    return n.up != null && nodes2[n.up].shape.kind === "Complex";
  }
  function cdProp(i) {
    return cdSpecies(i) || cdMember(i) || nodes2[i].comp || cdRole(i) === "epn" && nodes2[i].shape.kind === "Complex";
  }
  function cdLineTo(k, f) {
    var id = edges2[k].id, keep = /\|[mrp]\d+$/.test(id) ? id : id.replace(/\|[^|]*$/, "");
    return cdApply(function(t) {
      return f(t, id);
    }, [], [keep]);
  }
  var cdRefsMemo;
  function __run632() {
    cdRefsMemo = [null, null, null];
  }
  function cdRefRid() {
    if (!shared.cd || shared.selP.length || shared.svSel || shared.selN.length + shared.selE.length < 1) return null;
    var rid = null, ok = true;
    shared.selE.forEach(function(k) {
      var m = edges2[k] && edges2[k].id.match(/^(.*)\|(a|b|[mrp]\d+)$/);
      if (!m || rid && rid !== m[1]) ok = false;
      else rid = m[1];
    });
    shared.selN.forEach(function(i) {
      var m = nodes2[i] && nodes2[i].id.match(/^(.*)\|proc$/);
      if (!m || rid && rid !== m[1]) ok = false;
      else rid = m[1];
    });
    return ok ? rid : null;
  }
  function cdRefsOf() {
    var rid = cdRefRid();
    if (!rid) return null;
    if (cdRefsMemo[0] !== rid || cdRefsMemo[1] !== shared.cd.now) {
      var L;
      try {
        L = cdMk.refs(shared.cd.now, rid);
      } catch (e) {
        L = null;
      }
      cdRefsMemo = [rid, shared.cd.now, L];
    }
    if (!cdRefsMemo[2]) return null;
    var line2 = shared.selE.length === 1 && !shared.selN.length && /\|m\d+$/.test(edges2[shared.selE[0]].id);
    return { id: rid, title: line2 ? "References of its reaction" : "References", items: cdRefsMemo[2].map(function(r) {
      var c = r.key ? r.key.indexOf(":") : -1, db2 = c > 0 ? r.key.slice(0, c) : "", v = c > 0 ? r.key.slice(c + 1) : r.link;
      return { key: r.key || r.link, db: db2, val: v, q: r.q, own: r.q === "bqbiol:isDescribedBy" && /^(pubmed|doi)$/.test(db2), about: /^bqmodel:/.test(r.q) };
    }) };
  }
  function cdRefsSet(rid, add, del) {
    var keep = shared.selE.length === 1 && !shared.selN.length && /\|[mrp]\d+$/.test(edges2[shared.selE[0]].id) ? edges2[shared.selE[0]].id : rid;
    return cdApply(function(t) {
      return cdMk.setRefs(t, rid, add, del);
    }, [], [keep]);
  }
  var cdIdsMemo;
  var CD_ID_KIND;
  function __run642() {
    cdIdsMemo = [null, null, null];
    CD_ID_KIND = { PROTEIN: "protein", GENE: "gene", RNA: "gene", ANTISENSE_RNA: "gene", SIMPLE_MOLECULE: "molecule", ION: "molecule", DRUG: "molecule", PHENOTYPE: "phenotype", COMPARTMENT: "compartment" };
  }
  function cdIdsOf() {
    if (!shared.cd || shared.selP.length || shared.svSel || shared.selE.length || shared.selN.length !== 1 || !nodes2[shared.selN[0]]) return null;
    var id = nodes2[shared.selN[0]].id;
    if (cdIdsMemo[0] !== id || cdIdsMemo[1] !== shared.cd.now) {
      var I;
      try {
        I = cdMk.idsOf(shared.cd.now, id);
      } catch (e) {
        I = null;
      }
      cdIdsMemo = [id, shared.cd.now, I];
    }
    var I2 = cdIdsMemo[2], kind = I2 && CD_ID_KIND[I2.cls];
    if (!kind) return null;
    return { id, kind, title: "Identifiers", items: I2.links.map(annItem) };
  }
  function cdIdsSet(id, add, del, name2) {
    return cdApply(function(t) {
      t = cdMk.setIds(t, id, add, del);
      return name2 ? cdMk.rename(t, id, name2) : t;
    }, [id], []);
  }
  var PF_CD;
  function __run332() {
    PF_CD = {
      sizable: cdProp,
      size: cdSetSize,
      def: cdDef,
      refs: { of: cdRefsOf, set: cdRefsSet },
      ids: { of: cdIdsOf, set: cdIdsSet },
      rx: {
        of: cdRxOf,
        set: cdReversible,
        // a reaction's Reversible (propRx, create.js)
        counts: cdParts,
        // its reactants' and products' numbers by name (rxCounts)
        setCount: function(rid, line2, v) {
          return cdApply(function(t) {
            return cdMk.restoich(t, line2, v);
          }, [], [rid]);
        }
      },
      // a line's colour and width (edgeShow, edgeSet): a modifier's, an added reactant's or product's own, else its
      // reaction's (a reduced notation's line, a main line); a gate's lines none (cd_make.lineColour null), no ports as offsets
      line: {
        colour: cdLineColour,
        set: function(k, c) {
          return cdLineTo(k, function(t, id) {
            return cdMk.recolourLine(t, id, c || "#000000");
          });
        },
        width: function(k) {
          return cdLineRead(k)[3];
        },
        setWidth: function(k, w) {
          return cdLineTo(k, function(t, id) {
            return cdMk.rewidthLine(t, id, w);
          });
        },
        ports: false,
        count: function(k) {
          return /\|[rp]\d+$/.test(edges2[k].id) ? cdCount(edges2[k].id) : void 0;
        },
        // an added reactant's or product's own number (the main ones are the reaction's rows)
        setCount: function(k, v) {
          return cdLineTo(k, function(t, id) {
            return cdMk.restoich(t, id, v);
          });
        }
      },
      node: function(i) {
        return cdProp(i) ? i : -1;
      },
      off: function(k, i) {
        if (k === "pic") return !cdPicAble(i);
        return k === "line" || k === "ant" || k === "way" || k === "ss" && /^(COMPARTMENT|DEGRADED)$/.test(pNow.cls) || /^(mem|outer|inner)$/.test(k) && pNow.cls !== "COMPARTMENT" || /^(label|font|fill|multimer)$/.test(k) && pNow.cls === "DEGRADED" || /^(width|multimer|def|font)$/.test(k) && pNow.cls === "COMPARTMENT" || /^(multimer|def)$/.test(k) && pNow.cls === "COMPLEX" || k === "width" && pNow.cls === "UNKNOWN";
      },
      look: function(i) {
        var id = nodes2[i].id;
        if (cdLook[0] !== id || cdLook[1] !== shared.cd.now) {
          var L = null;
          try {
            L = cdMk.look(shared.cd.now, id);
            var ss = cdMk.features(shared.cd.now, id).structural;
            var pn = cdPicOf(id);
            L = { pic: pn ? { name: pn, src: cdPicUrl(pn) } : null, ss: ss ? ss.text : "", label: cdNameOf(id, true), font: L.font, fill: L.fill, line: "#000000", width: L.width, multimer: L.multimer, cls: L.cls, mem: L.mem, outer: L.outer, inner: L.inner };
          } catch (e) {
            L = null;
          }
          cdLook = [id, shared.cd.now, L];
        }
        var L2 = cdLook[2] && Object.assign({}, cdLook[2]);
        if (L2 && L2.pic) L2.pic = { name: L2.pic.name, src: cdPicUrl(L2.pic.name) };
        return L2;
      },
      set: function(k, v, is) {
        var ids = is.map(function(i) {
          return nodes2[i].id;
        }), all = function(f) {
          return cdApply(function(t) {
            ids.forEach(function(id) {
              t = f(t, id);
            });
            return t;
          }, ids);
        };
        if (k === "label") return all(function(t, id) {
          return cdMk.rename(t, id, v.replace(/[\r\n]+/g, " "));
        });
        if (k === "multimer") return all(function(t, id) {
          return !v ? cdMk.homodimer(t, id, 1) : cdMk.aliasInfo(t, id).homodimer > 1 ? t : cdTopClear(cdMk.homodimer(t, id, 2), id, true);
        });
        if (k === "width") {
          var x = parseFloat(v);
          return isFinite(x) && all(function(t, id) {
            return cdMk.restyle(t, id, { width: Math.min(Math.max(x, 0.25), 20) });
          });
        }
        if (k === "font") {
          var z = parseFloat(v);
          return isFinite(z) && all(function(t, id) {
            return cdMk.restyle(t, id, { font: Math.min(Math.max(Math.round(z), 1), 200) });
          });
        }
        if (k === "fill") {
          var c = hex(v);
          return !!c && all(function(t, id) {
            return cdMk.restyle(t, id, { fill: c });
          });
        }
        if (/^(mem|outer|inner)$/.test(k)) return cdDouble(k, parseFloat(v), ids);
        if (k === "ss") {
          var tx2 = v.replace(/[\r\n]+/g, " ").trim();
          return all(function(t, id) {
            if (/^(COMPARTMENT|DEGRADED)$/.test(cdMk.aliasInfo(t, id).cls || "COMPARTMENT")) return t;
            var s0 = cdMk.features(t, id).structural;
            return tx2 ? s0 && s0.text === tx2 ? t : cdSsSet(t, id, tx2, null) : s0 ? cdMk.structural(t, id, null) : t;
          });
        }
        return false;
      }
    };
    propRows([
      ["mem", "Membrane", "num", ' min="2" max="100"', "Membrane thickness: the band between the two lines, 2 at least"],
      ["outer", "Outer line", "num", ' min="2" max="20"', "Outer line width, at least the inner line + 1"],
      ["inner", "Inner line", "num", ' min="1" max="19"', "Inner line width, 1 at least"]
    ]);
    propRows([["ss", "Structural state", "text", "", "The species\u2019 structural state, free text; emptied, it is removed"]]);
    propRows([["pic", "Image", "pic", "", "MINERVA\u2019s image, drawn stretched to the box as MINERVA draws it (PNG or SVG)"]]);
    field("pic").addEventListener("click", function() {
      var ids = cdPicIds();
      if (ids.length) cdPicChoose(function(f) {
        cdPicSet(ids, f);
      });
    });
    field("pic").parentNode.querySelector(".m2-ed-ppicoff").addEventListener("click", function() {
      var ids = cdPicIds();
      if (ids.length) cdPicSet(ids, null);
    });
    cdPicker = document.createElement("input");
    cdPicker.type = "file";
    cdPicker.accept = ".png,.svg,image/png,image/svg+xml";
    cdPicker.hidden = true;
    cdPicker.addEventListener("change", function() {
      var f = cdPicker.files[0], go = cdPickFor;
      cdPickFor = null;
      cdPicker.value = "";
      if (f && go) go(f);
    });
    document.body.appendChild(cdPicker);
    document.addEventListener("drop", function(e) {
      var fs = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files || []) : [];
      if (!fs.length || !cdPal() || !on || V.current !== map || !V.view.contains(e.target)) return;
      if (!fs.every(function(f) {
        return /\.(png|svg)$/i.test(f.name) || /^image\/(png|svg\+xml)$/.test(f.type);
      })) return;
      e.preventDefault();
      e.stopPropagation();
      var h = hit(at(e)), i = h && h.n != null && h.p == null ? h.n : -1;
      if (fs.length > 1) {
        warn("One image at a time: drop a single PNG or SVG on a compartment or a species.");
        return;
      }
      if (!h && !edgeAt(at(e), true)) {
        cdBgAdd(fs[0]);
        return;
      }
      if (i < 0 || !cdPicAble(i)) {
        warn("An image goes on a compartment or a species (a complex\u2019s member takes none), or under the whole map when dropped on empty map space.");
        return;
      }
      cdPicSet([nodes2[i].id], fs[0]);
    }, true);
    window.addEventListener("pointerdown", cdBgDown, true);
    window.addEventListener("pointerup", cdBgUp, true);
    window.addEventListener("keydown", function(e) {
      if (!cdBg || shared.selN.length || shared.selE.length || shared.selP.length || shared.svSel || !cdPal() || !on || V.current !== map || V.typing() || /input|textarea|select/i.test(document.activeElement.tagName) || document.querySelector(".m2-cx")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        cdBgDelete();
      }
    }, true);
    var cdEscFor;
    window.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        var hb = document.getElementById("m2-ed-help-box");
        cdEscFor = !!document.querySelector(".m2-cx") || !!(hb && !hb.hidden) || !!tool || !!link;
      }
    }, true);
    document.addEventListener("keydown", function(e) {
      if (cdBg && e.key === "Escape" && !e.defaultPrevented && !cdEscFor) {
        cdBg = null;
        paint();
      }
    });
    ownMenus.push(cdBgOwn);
    ownCursors.push(cdBgCursor);
  }
  var cdPicker;
  var cdPickFor;
  var cdBg;
  function cdStill(m0) {
    if (on && V.current === m0 && cdPal()) return true;
    warn("The map was left while its image was being kept; nothing was put on.");
    return false;
  }
  function cdPicAble(i) {
    var n = nodes2[i];
    return !!n && (!!n.comp || cdRole(i) === "epn");
  }
  function cdPicOf(id) {
    try {
      return cdMk.pictureOf(shared.cd.now, id);
    } catch (e) {
      return null;
    }
  }
  function cdPicIds() {
    return shared.selN.filter(cdPicAble).map(function(i) {
      return nodes2[i].id;
    });
  }
  function cdPicChoose(go) {
    cdPickFor = go;
    cdPicker.value = "";
    cdPicker.click();
  }
  function cdPicSet(ids, f) {
    if (!f) return cdApply(function(t) {
      ids.forEach(function(id) {
        t = cdMk.picture(t, id, null);
      });
      return t;
    }, ids);
    var m0 = map;
    return cdPicKeep(f).then(function(r) {
      if (!cdStill(m0)) return;
      cdApply(function(t) {
        ids.forEach(function(id) {
          t = cdMk.picture(t, id, r.note);
        });
        return t;
      }, ids);
    }, function(e) {
      warn("Image not put on: " + String(e && e.message ? e.message : e).replace(/\.?$/, "."));
    });
  }
  function cdPicDims(src2) {
    var m = /^data:image\/svg\+xml;base64,(.*)$/.exec(src2 || "");
    if (m) {
      try {
        var tx2 = new TextDecoder().decode(Uint8Array.from(atob(m[1]), function(c) {
          return c.charCodeAt(0);
        })), a = (/<svg\b[^>]*>/i.exec(tx2) || [""])[0];
        var w = /\swidth="([\d.]+)(?:px)?"/.exec(a), h = /\sheight="([\d.]+)(?:px)?"/.exec(a), vb = /\sviewBox="\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(a);
        if (w && h && +w[1] > 0 && +h[1] > 0) return Promise.resolve([+w[1], +h[1]]);
        if (vb && +vb[1] > 0 && +vb[2] > 0) return Promise.resolve([+vb[1], +vb[2]]);
      } catch (e) {
      }
    }
    return new Promise(function(res) {
      var im = new Image();
      im.onload = function() {
        res(im.naturalWidth > 0 && im.naturalHeight > 0 ? [im.naturalWidth, im.naturalHeight] : null);
      };
      im.onerror = function() {
        res(null);
      };
      im.src = src2;
    });
  }
  function cdFitBox(b, d) {
    var h = b[2] * d[1] / d[0];
    return [b[0], b[1] + b[3] / 2 - h / 2, b[2], h];
  }
  function cdPicFit(id) {
    var src2 = cdPicUrl(cdPicOf(id)), m0 = map;
    if (!src2) {
      warn("The image is not read yet; try again once it is drawn.");
      return;
    }
    cdPicDims(src2).then(function(d) {
      var i = nodes2.findIndex(function(n) {
        return n.id === id;
      });
      if (!d || i < 0 || !on || V.current !== m0) return;
      var b = boxOf(i), nb = cdFitBox(b, d);
      if (holds(i) && !nodes2[i].comp) nb = roomy(i, nb, "tb", b);
      cdSetSize([[i, nb]]);
    });
  }
  function cdPicItems(i) {
    var id = nodes2[i].id, has = !!cdPicOf(id);
    if (!cdPicAble(i)) return [];
    var out = [[has ? "Replace image\u2026" : "Set image\u2026", function() {
      cdPicChoose(function(f) {
        cdPicSet([id], f);
      });
    }]];
    if (has) out.push(["Fit box to image", function() {
      cdPicFit(id);
    }], ["Remove image", function() {
      cdPicSet([id], null);
    }]);
    return out;
  }
  var cdBgMemo;
  function cdBgs() {
    if (!cdBgMemo || cdBgMemo[0] !== shared.cd.now) {
      var bs;
      try {
        bs = cdMk.backgrounds(shared.cd.now);
      } catch (e) {
        bs = [];
      }
      cdBgMemo = [shared.cd.now, bs];
    }
    return cdBgMemo[1];
  }
  function cdBgFind(ref) {
    var same2 = cdBgs().filter(function(g) {
      return g.name === ref.name;
    });
    return same2.filter(function(g) {
      return g.box && g.box.every(function(v, k) {
        return Math.abs(v - ref.box[k]) < 5e-3;
      });
    })[0] || same2.filter(function(g) {
      return ref.n != null && g.n === ref.n;
    })[0] || (same2.length === 1 ? same2[0] : null);
  }
  function cdBgDo(ref, f) {
    return cdApply(function(t) {
      var g = cdBgFind(ref);
      return g ? f(t, g.n) : t;
    }, []);
  }
  function cdBgSh() {
    if (lastFor && lastFor[0] === shared.text && lastFor[1] === shared.cd.now) return cdNow().sh;
    var m = /<g transform="translate\(([-\d.]+),([-\d.]+)\)">/.exec(lastSvg || "");
    return m ? [+m[1], +m[2]] : [0, 0];
  }
  function cdBgP(P) {
    var sh = cdBgSh();
    return P && [P[0] + sh[0], P[1] + sh[1]];
  }
  function cdBgIn(b, P) {
    return !!b && P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3];
  }
  function cdBgFree(P) {
    return !hit(P) && !edgeAt(P, true) && !svAt(P);
  }
  function cdBgAt(P) {
    var F = cdBgP(P), bs = cdBgs().filter(function(g2) {
      return cdBgIn(g2.box, F);
    }), g = bs[bs.length - 1];
    return g ? { name: g.name, box: g.box.slice(), n: g.n } : null;
  }
  function cdBgSelect(ref) {
    shared.selN = [];
    shared.selE = [];
    shared.selP = [];
    shared.part = null;
    shared.svSel = null;
    cdBg = ref ? { ref, box: ref.box.slice(), at: shared.cd && shared.cd.now } : null;
    paint();
  }
  function cdBgOwn(P) {
    return !!(cdBg && cdPal() && on && V.current === map && P && cdBgIn(cdBg.box, cdBgP(P)) && cdBgFree(P));
  }
  function cdBgIs(ref) {
    return !!cdBg && cdBg.ref.name === ref.name && cdBg.ref.box.join() === ref.box.join();
  }
  function cdBgDelete() {
    var ref = cdBg && cdBg.ref;
    cdBg = null;
    if (ref) cdBgDo(ref, cdMk.backgroundRemove);
    else paint();
  }
  function cdBgOwnItems() {
    var ref = cdBg.ref;
    return [["Replace image\u2026", function() {
      cdPicChoose(function(f) {
        cdBgReplace(ref, f);
      });
    }], ["Fit box to image", function() {
      cdBgFit(ref);
    }]];
  }
  function cdBgItems() {
    return cdPal() ? [["Add background image\u2026", function() {
      cdPicChoose(cdBgAdd);
    }]] : null;
  }
  function cdBgAdd(f) {
    var m0 = map;
    var round_ = function() {
      var bs = nodes2.map(function(n, i) {
        return boxOf(i);
      }).filter(Boolean);
      return bs.length ? bs.reduce(function(a, b) {
        var x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
        return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y];
      }) : [0, 0, 800, 600];
    };
    return cdPicKeep(f).then(function(r) {
      if (!cdStill(m0)) return;
      var fb;
      if (cdApply(function(t, sh) {
        var box3 = round_();
        fb = [box3[0] + sh[0], box3[1] + sh[1], box3[2], box3[3]].map(function(v) {
          return Math.round(v * 100) / 100;
        });
        return cdMk.background(t, r.note, fb).text;
      }, []) !== false) cdBgSelect({ name: r.note, box: fb });
    }, function(e) {
      warn("Background image not added: " + String(e && e.message ? e.message : e).replace(/\.?$/, "."));
    });
  }
  function cdBgReplace(ref, f) {
    var m0 = map;
    return cdPicKeep(f).then(function(r) {
      if (!cdStill(m0)) return;
      cdBgDo(ref, function(t, n) {
        return cdMk.backgroundSet(t, n, { name: r.note });
      });
      if (cdBgIs(ref)) cdBg.ref = { name: r.note, box: ref.box.slice() };
      paint();
    }, function(e) {
      warn("Background image not replaced: " + String(e && e.message ? e.message : e).replace(/\.?$/, "."));
    });
  }
  function cdBgFit(ref) {
    var g = cdBgFind(ref), src2 = g && cdPicUrl(g.name), m0 = map;
    if (!src2) {
      warn("The image is not read yet; try again once it is drawn.");
      return;
    }
    cdPicDims(src2).then(function(d) {
      var g2 = cdBgFind(ref);
      if (!d || !g2 || !on || V.current !== m0) return;
      var nb = cdFitBox(g2.box, d).map(function(v) {
        return Math.round(v * 100) / 100;
      });
      cdBgDo(ref, function(t, n) {
        return cdMk.backgroundSet(t, n, { box: nb });
      });
      if (cdBgIs(ref)) {
        cdBg.ref = { name: ref.name, box: nb };
        cdBg.box = nb.slice();
      }
      paint();
    });
  }
  function cdBgMarks(out) {
    if (!cdBg) return;
    if (shared.selN.length || shared.selE.length || shared.selP.length || shared.svSel) {
      cdBg = null;
      return;
    }
    if (!cdBg.drag) {
      var g = cdPal() && on && V.current === map ? cdBgFind(cdBg.ref) : null;
      if (!g && cdBg.at === (shared.cd && shared.cd.now) && cdPal() && on && V.current === map) g = cdBg.ref;
      else if (g) cdBg.at = null;
      if (!g) {
        cdBg = null;
        return;
      }
      cdBg.ref = { name: g.name, box: g.box.slice(), n: g.n };
      cdBg.box = g.box.slice();
    }
    var sh = cdBgSh(), b = [cdBg.box[0] - sh[0], cdBg.box[1] - sh[1], cdBg.box[2], cdBg.box[3]];
    out.push('<rect class="m2-ed-ghost" x="' + sx(b[0]) + '" y="' + sy(b[1]) + '" width="' + b[2] * V.z + '" height="' + b[3] * V.z + '"/>' + handleMarks(b, "m2-ed-handle"));
  }
  function cdBgHandle(Pf) {
    var b = cdBg.box, tol = Math.max(5, 8 / V.z), o = 3.3, hx = -1, hy = -1;
    [b[0] - o, b[0] + b[2] / 2, b[0] + b[2] + o].forEach(function(x, k) {
      if (Math.abs(Pf[0] - x) <= tol) hx = k;
    });
    [b[1] - o, b[1] + b[3] / 2, b[1] + b[3] + o].forEach(function(y, k) {
      if (Math.abs(Pf[1] - y) <= tol) hy = k;
    });
    return hx >= 0 && hy >= 0 && !(hx === 1 && hy === 1) ? [hx, hy] : null;
  }
  function cdBgCursor(P, free) {
    if (!cdBg || cdBg.drag || !cdPal() || !on || V.current !== map || tool || link) return null;
    var Pf = cdBgP(P), hd = cdBgHandle(Pf);
    if (hd) return hd[0] === 1 ? "ns-resize" : hd[1] === 1 ? "ew-resize" : hd[0] === hd[1] ? "nwse-resize" : "nesw-resize";
    return free && !svAt(P) && cdBgIn(cdBg.box, Pf) ? "move" : null;
  }
  var cdTap;
  function cdBgDown(e) {
    cdTap = null;
    if (e.button !== 0 || !cdPal() || !V.view.contains(e.target) || !editing(e) || tool || link) return;
    var P = at(e);
    if (!cdBg) {
      if (!e.shiftKey && !shared.selN.length && !shared.selE.length && !shared.selP.length && !shared.svSel && cdBgAt(P) && cdBgFree(P)) cdTap = { x: e.clientX, y: e.clientY, P };
      return;
    }
    var b = cdBg.box, Pf = cdBgP(P), hd = cdBgHandle(Pf), hx = hd ? hd[0] : -1, hy = hd ? hd[1] : -1;
    var onHandle = !!hd, inside2 = cdBgIn(b, Pf) && cdBgFree(P);
    if (!onHandle && !inside2) {
      cdBg = null;
      paint();
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    var b0 = b.slice(), ref = cdBg.ref, el = V.view, corner = onHandle && hx !== 1 && hy !== 1;
    cdBg.drag = true;
    var pic = Array.prototype.filter.call(document.querySelectorAll('#m2-img image[pointer-events="none"], #m2-img use[pointer-events="none"]'), function(q) {
      return ["x", "y", "width", "height"].every(function(k, j) {
        return Math.abs(+q.getAttribute(k) - b0[j]) < 0.01;
      });
    })[0];
    try {
      el.setPointerCapture(e.pointerId);
    } catch (er) {
    }
    var move2 = function(ev) {
      var Q = at(ev), dx = Q[0] - P[0], dy = Q[1] - P[1], nb = b0.slice();
      if (!onHandle) {
        nb[0] += dx;
        nb[1] += dy;
      } else {
        if (hx === 0) {
          nb[0] = Math.min(b0[0] + dx, b0[0] + b0[2] - 1);
          nb[2] = b0[0] + b0[2] - nb[0];
        } else if (hx === 2) nb[2] = Math.max(1, b0[2] + dx);
        if (hy === 0) {
          nb[1] = Math.min(b0[1] + dy, b0[1] + b0[3] - 1);
          nb[3] = b0[1] + b0[3] - nb[1];
        } else if (hy === 2) nb[3] = Math.max(1, b0[3] + dy);
        if (corner && ev.shiftKey) {
          var kw = nb[2] / b0[2], kh = nb[3] / b0[3], k = Math.abs(kw - 1) >= Math.abs(kh - 1) ? kw : kh;
          nb[2] = b0[2] * k;
          nb[3] = b0[3] * k;
          if (hx === 0) nb[0] = b0[0] + b0[2] - nb[2];
          if (hy === 0) nb[1] = b0[1] + b0[3] - nb[3];
        }
      }
      if (cdBg) {
        cdBg.box = nb;
        if (pic) ["x", "y", "width", "height"].forEach(function(k2, j) {
          pic.setAttribute(k2, nb[j]);
        });
        paint();
      }
    };
    var up = function() {
      el.removeEventListener("pointermove", move2);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (!cdBg) {
        if (pic) ["x", "y", "width", "height"].forEach(function(k, j) {
          pic.setAttribute(k, b0[j]);
        });
        return;
      }
      cdBg.drag = false;
      var nb = cdBg.box.map(function(v) {
        return Math.round(v * 100) / 100;
      });
      if (nb.some(function(v, k) {
        return Math.abs(v - b0[k]) >= 5e-3;
      })) {
        cdBg.ref = { name: ref.name, box: nb, n: ref.n };
        cdBgDo(ref, function(t, n) {
          return cdMk.backgroundSet(t, n, { box: nb });
        });
      } else paint();
    };
    el.addEventListener("pointermove", move2);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }
  function cdBgUp(e) {
    var t = cdTap;
    cdTap = null;
    if (!t || e.button !== 0 || Math.hypot(e.clientX - t.x, e.clientY - t.y) >= 5 || !cdPal() || !on || V.current !== map) return;
    var ref = cdBgAt(t.P);
    if (ref) setTimeout(function() {
      cdBgSelect(ref);
    }, 0);
  }
  var cdBgRowsAt;
  function cdBgRows() {
    var tb = pmap.firstChild, bs = cdBgs().slice().reverse(), sel = cdBg && cdBgFind(cdBg.ref);
    var key = [shared.cd && shared.cd.now, sel ? sel.n : -1].concat(bs.map(function(g) {
      return g.n + ":" + g.name + ":" + !!cdPicUrl(g.name);
    })).join("|");
    if (cdBgRowsAt && cdBgRowsAt.key === key && cdBgRowsAt.tb === tb && tb.querySelector("tr.m2-ed-pbg")) return;
    cdBgRowsAt = { key, tb };
    Array.prototype.forEach.call(tb.querySelectorAll("tr.m2-ed-pbg"), function(r) {
      r.remove();
    });
    var row = function(head, inner) {
      var r = document.createElement("tr");
      r.className = "m2-ed-pbg";
      r.innerHTML = "<th>" + head + '</th><td><span class="m2-ed-ppic">' + inner + "</span></td>";
      tb.appendChild(r);
      return r;
    };
    bs.forEach(function(g, j) {
      var ref = { name: g.name, box: g.box.slice() }, src2 = cdPicUrl(g.name), nm = g.name.replace(/^glyphs\//, "");
      var r = row(j ? "" : "Background", '<img alt=""' + (src2 ? "" : " hidden") + '><span class="m2-ed-ppicname"></span><button type="button" class="m2-ed-ppicoff">Remove</button>');
      r.dataset.k = "bg" + g.n;
      r.title = "A background image under the whole map; a click selects it on the map";
      if (src2) r.querySelector("img").setAttribute("src", src2);
      var ns = r.querySelector(".m2-ed-ppicname");
      ns.textContent = nm;
      ns.title = g.name;
      if (sel && sel.n === g.n) r.classList.add("m2-ed-pbgsel");
      r.addEventListener("click", function(e) {
        if (!e.target.closest("button")) cdBgSelect(ref);
      });
      r.querySelector("button").addEventListener("click", function(e) {
        e.currentTarget.blur();
        if (cdBgIs(ref)) cdBg = null;
        cdBgDo(ref, cdMk.backgroundRemove);
      });
    });
    var a = row(bs.length ? "" : "Background", '<button type="button" class="m2-ed-pbgadd">Upload</button>');
    a.dataset.k = "bgadd";
    a.title = "A PNG or SVG under the whole map, as MINERVA draws its backgrounds";
    a.querySelector("button").addEventListener("click", function(e) {
      e.currentTarget.blur();
      cdPicChoose(cdBgAdd);
    });
  }
  function cdDouble(k, x, ids) {
    if (!isFinite(x)) return false;
    var clamp = function(v, a, b) {
      return Math.min(Math.max(v, a), b);
    };
    return cdApply(function(t) {
      ids.forEach(function(id) {
        var L = cdMk.look(t, id), b = cdMk.aliasInfo(t, id).box, o = { mem: L.mem, outer: L.outer, inner: L.inner };
        o[k] = x;
        o.mem = clamp(o.mem, 2, b ? Math.max(2, Math.min(b[2], b[3]) / 2 - 3) : 100);
        o.outer = clamp(o.outer, 2, 20);
        o.inner = clamp(o.inner, 1, o.outer - 1);
        t = cdMk.restyle(t, id, o);
      });
      return t;
    }, ids);
  }
  function cdCompGhost(w, h, oval) {
    var C = cdMk.COMP;
    return window.cdrender.compartmentShape(0, 0, w, h, C.thickness, C.outer, C.inner, "#" + (cdColour(shared.cd && shared.cd.now, "COMPARTMENT") || C.colour).slice(2), oval);
  }
  function cdGhost(kind) {
    var cls = cdKind(kind), s = cdSize(cls), n = cdComp(cls) ? 1 : cdCopies(cls), e = 6 * (n - 1), w = s[0] - e, h = s[1] - e, k = cdCols() === "custom" && cdKept2()[cls], col = cdComp(cls) ? "none" : "#" + (cdColour(shared.cd && shared.cd.now, cls) || cdMk.LOOK[cls][2]).slice(2), ink = ' fill="' + col + '" stroke="#000" stroke-width="' + (k && k.width > 0 && cls !== "DEGRADED" ? k.width : 1) + '"';
    var shape = {
      PROTEIN: '<rect width="' + w + '" height="' + h + '" rx="5"' + ink + "/>",
      GENE: '<rect width="' + w + '" height="' + h + '"' + ink + "/>",
      RNA: '<path d="M' + h + " 0H" + w + "L" + (w - h) + " " + h + 'H0z"' + ink + "/>",
      SIMPLE_MOLECULE: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '"' + ink + "/>",
      UNKNOWN: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '" fill="' + col + '"/>',
      PHENOTYPE: '<path d="M' + h / 2 + " 0H" + (w - h / 2) + "L" + w + " " + h / 2 + "L" + (w - h / 2) + " " + h + "H" + h / 2 + "L0 " + h / 2 + 'z"' + ink + "/>",
      DEGRADED: '<circle cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + w * 3 / 8 + '"' + ink + '/><path d="M' + w * 0.7 + " 0L" + w * 0.3 + " " + h + '" stroke="#000"/>',
      COMPLEX: '<path d="M5 0H' + (w - 5) + "L" + w + " 5V" + (h - 5) + "L" + (w - 5) + " " + h + "H5L0 " + (h - 5) + 'V5z"' + ink + ' stroke-width="2"/>',
      COMPARTMENT: cdCompGhost(w, h, false),
      OVAL: cdCompGhost(w, h, true)
    }[cls];
    for (var j = n - 1, back2 = ""; j > 0; j--) back2 += '<g transform="translate(' + 6 * j + " " + 6 * j + ')">' + shape + "</g>";
    return { w: s[0], h: s[1], svg: '<svg width="100%" height="100%" viewBox="0 0 ' + s[0] + " " + s[1] + '" overflow="visible">' + (back2 || "") + shape + "</svg>" };
  }
  function __start6() {
    __run16();
    __run24();
    __run35();
    __run54();
    __run64();
    __run74();
    __run82();
    __run9();
    __run10();
    __run122();
    __run132();
    __run142();
    __run152();
    __run162();
    __run17();
    __run18();
    __run19();
    __run20();
    __run21();
    __run222();
    __run232();
    __run242();
    __run25();
    __run27();
    __run28();
    __run29();
    __run30();
    __run31();
    __run322();
    __run632();
    __run642();
    __run332();
  }

  // editor/src/graphml.js
  function noLayout(t) {
    return /<graphml[\s>]/.test(t.slice(0, 3e3)) && !/yworks\.com/.test(t.slice(0, 5e3)) ? "a GraphML file with no yEd layout (as Cytoscape, Gephi or NetworkX write it): nothing in it says where to draw. Open it in yEd, lay it out and save it there, then add it again" : null;
  }
  function graphmlFormat() {
    return {
      name: "graphml",
      load: yr,
      engineCd: false,
      now: function() {
        return shared.text;
      },
      ownFrame: false,
      live: function() {
        return liveY;
      },
      mainLines: false,
      afView: true,
      stacks: true,
      insets: true,
      fileType: { description: "yEd GraphML", accept: { "application/xml": [".graphml"] } },
      stackComp: function(t, id) {
        return sbJs && sbJs.stack ? sbJs.stack(t, id) : t;
      },
      square: function() {
        return null;
      },
      beside: function() {
        return null;
      },
      // edited as it is, but for lines at complex members put right (sbgn_edit.membersOut), said once the map is drawn and
      // written at the next save; at once when the engine is loaded, else once it is
      open: function(t, g0, still) {
        var fix = function() {
          try {
            var mo = sbJs && sbJs.membersOut ? sbJs.membersOut(t) : null;
          } catch (e) {
            mo = null;
          }
          return mo && mo.said.length ? { g: mo.text, t: mo.text, t0: t, said: sbJs.membersSaid(mo.said), redraw: true } : { g: t, t };
        };
        return sbJs ? fix() : sbpy().then(function() {
          return still && !still() ? null : fix();
        }, function() {
          return still && !still() ? null : { g: t, t };
        });
      },
      drawOwn: function(t) {
        var no2 = noLayout(t);
        if (no2) return Promise.reject(new Error(no2));
        return yr().then(function() {
          return window.yrender.render(t, { classes: true, groups: true, sbgn: false }).svg;
        });
      },
      // a reader's own map drawn for the list (core.js drawText), as the build draws
      ahead: { load: yr },
      // the read-ahead: the renderer; the file is edited as it is
      reads: function(t) {
        return /<graphml[\s>]/.test(t.slice(0, 3e3));
      },
      entry: function(m) {
        var d = m && m.downloads && m.downloads[0];
        return !!(d && d.label === "GraphML");
      },
      kind: function(n) {
        return n.shape && n.shape.kind || null;
      },
      // a node's shape
      nameable: function() {
        return !!sbJs;
      }
    };
  }

  // editor/src/outbox.js
  var dbP;
  var opsP;
  var box;
  var loaded;
  var persisted;
  function keepAsked() {
    if (persisted) return;
    persisted = true;
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function(y) {
        if (!y) return navigator.storage.persist();
      }).catch(function() {
      });
    } catch (e) {
    }
  }
  function db() {
    if (!dbP) dbP = new Promise(function(res, rej) {
      var idb = window.indexedDB;
      if (!idb) return rej(new Error("this browser keeps no data for the page"));
      var r = idb.open("atlas-outbox", 1);
      r.onupgradeneeded = function() {
        if (!r.result.objectStoreNames.contains("saves")) r.result.createObjectStore("saves");
      };
      r.onsuccess = function() {
        var d = r.result;
        d.onversionchange = function() {
          d.close();
          dbP = null;
        };
        res(d);
      };
      r.onerror = function() {
        dbP = null;
        rej(r.error);
      };
      r.onblocked = function() {
        dbP = null;
        rej(new Error("another tab of this site holds the stored changes"));
      };
    });
    return dbP;
  }
  function opsDb() {
    if (!opsP) opsP = new Promise(function(res, rej) {
      var idb = window.indexedDB;
      if (!idb) return rej(new Error("this browser keeps no data for the page"));
      var r = idb.open("atlas-ops", 1);
      r.onupgradeneeded = function() {
        if (!r.result.objectStoreNames.contains("ops")) r.result.createObjectStore("ops", { keyPath: "seq", autoIncrement: true });
      };
      r.onsuccess = function() {
        var d = r.result;
        d.onversionchange = function() {
          d.close();
          opsP = null;
        };
        res(d);
      };
      r.onerror = function() {
        opsP = null;
        rej(r.error);
      };
      r.onblocked = function() {
        opsP = null;
        rej(new Error("another tab of this site holds the stored changes"));
      };
    });
    return opsP;
  }
  function tx(mode, f, store) {
    return (store === "ops" ? opsDb() : db()).then(function(d) {
      return new Promise(function(res, rej) {
        var t = d.transaction(store || "saves", mode), q = f(t.objectStore(store || "saves"));
        t.oncomplete = function() {
          res(q && q.result);
        };
        t.onerror = t.onabort = function() {
          rej(t.error);
        };
      });
    });
  }
  function outboxLoad(again) {
    if (!box) box = {};
    if (!loaded || again) loaded = tx("readonly", function(st) {
      return st.getAll();
    }).then(function(all) {
      var seen = {};
      (all || []).forEach(function(r) {
        if (r && r.key) {
          seen[r.key] = 1;
          if (!box[r.key] || (r.at || 0) >= (box[r.key].at || 0)) box[r.key] = r;
        }
      });
      if (again) Object.keys(box).forEach(function(k) {
        if (!seen[k] && box[k].kept) delete box[k];
      });
    }, function() {
    }).then(function() {
      return box;
    });
    return loaded;
  }
  function outboxKeep(rec) {
    if (!box) box = {};
    keepAsked();
    rec.at = Date.now();
    box[rec.key] = rec;
    return tx("readwrite", function(st) {
      return st.put(rec, rec.key);
    }).then(function() {
      rec.kept = true;
    });
  }
  function outboxFresh(key) {
    return tx("readonly", function(st) {
      return st.get(key);
    }).then(function(r) {
      if (!box) box = {};
      if (r) {
        r.kept = true;
        if (!box[key] || (r.at || 0) >= (box[key].at || 0)) box[key] = r;
      } else if (box[key] && box[key].kept) delete box[key];
      return box[key] || null;
    });
  }
  function outboxDone(key, text) {
    var r = box && box[key];
    if (r && text != null && r.text !== text) return Promise.resolve(false);
    if (r) delete box[key];
    return tx("readwrite", function(st) {
      var q = st.get(key);
      q.onsuccess = function() {
        if (q.result && (text == null || q.result.text === text)) st.delete(key);
      };
      return q;
    }).then(function() {
      return true;
    }, function() {
      return true;
    });
  }
  function outboxGet(key) {
    return box && box[key] || null;
  }
  function outboxAll() {
    return box ? Object.keys(box).map(function(k) {
      return box[k];
    }) : [];
  }
  function opsKeep(op) {
    keepAsked();
    op.at = Date.now();
    return tx("readwrite", function(st) {
      return st.add(op);
    }, "ops").then(function(seq) {
      op.seq = seq;
      return op;
    });
  }
  function opsAll(key) {
    return tx("readonly", function(st) {
      return st.getAll();
    }, "ops").then(function(all) {
      return (all || []).filter(function(o) {
        return o && o.key === key;
      }).sort(function(a, b) {
        return a.seq - b.seq;
      });
    });
  }
  function opsHas(seq) {
    return tx("readonly", function(st) {
      return st.get(seq);
    }, "ops").then(function(o) {
      return !!o;
    });
  }
  function opsDone(seq) {
    return tx("readwrite", function(st) {
      return st.delete(seq);
    }, "ops").catch(function() {
    });
  }

  // editor/src/minerva.js
  function u16(b, i) {
    return b[i] | b[i + 1] << 8;
  }
  function u32(b, i) {
    return (b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24) >>> 0;
  }
  function hiddenPath(n) {
    return /^__MACOSX\//.test(n) || n.split("/").some(function(p) {
      return p.charAt(0) === ".";
    });
  }
  function inflate(data) {
    var s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(s).arrayBuffer().then(function(a) {
      return new Uint8Array(a);
    });
  }
  function unzip(buf) {
    var b = new Uint8Array(buf), e = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 101010256) {
      e = i;
      break;
    }
    if (e < 0) return Promise.reject(new Error("not a zip file"));
    var count = u16(b, e + 10), at2 = u32(b, e + 16);
    if (count === 65535 || at2 === 4294967295) return Promise.reject(new Error("a zip in the large format (ZIP64), not read here"));
    var list2 = [], total = 0, utf8 = new TextDecoder("utf-8");
    for (var k = 0; k < count; k++) {
      if (at2 + 46 > b.length || u32(b, at2) !== 33639248) return Promise.reject(new Error("a damaged zip file"));
      var flags = u16(b, at2 + 8), method = u16(b, at2 + 10), csize = u32(b, at2 + 20), size = u32(b, at2 + 24);
      var nl = u16(b, at2 + 28), xl = u16(b, at2 + 30), cl = u16(b, at2 + 32), off = u32(b, at2 + 42);
      var name2 = utf8.decode(b.subarray(at2 + 46, at2 + 46 + nl)).replace(/\\/g, "/");
      at2 += 46 + nl + xl + cl;
      if (name2.charAt(0) === "/" || name2.split("/").indexOf("..") >= 0) return Promise.reject(new Error("a path outside the zip: " + name2));
      if (/\/$/.test(name2) || hiddenPath(name2)) continue;
      if (flags & 1) return Promise.reject(new Error("a zip with a password"));
      if (method !== 0 && method !== 8) return Promise.reject(new Error(name2 + " is packed in a way not read here"));
      if (off + 30 > b.length || u32(b, off) !== 67324752) return Promise.reject(new Error("a damaged zip file"));
      total += size;
      if (total > 500 * 1048576) return Promise.reject(new Error("the zip unpacks to more than 500 MB"));
      var start2 = off + 30 + u16(b, off + 26) + u16(b, off + 28);
      list2.push({ name: name2, method, raw: b.subarray(start2, start2 + csize), size });
    }
    return list2.reduce(function(p, x) {
      return p.then(function(out) {
        return (x.method === 0 ? Promise.resolve(x.raw) : inflate(x.raw)).then(function(d) {
          if (d.length !== x.size) throw new Error(x.name + " is damaged in the zip");
          out.push({ name: x.name, data: d });
          return out;
        });
      });
    }, Promise.resolve([]));
  }
  function glyphsNamed(text) {
    var re = /Glyph:[ \t]*([^\r\n<]+?\.(?:png|svg))[ \t\r]*(?:\n|<|$)/gi, out = [], m;
    while (m = re.exec(text)) if (out.indexOf(m[1]) < 0) out.push(m[1]);
    return out;
  }
  function formatName(t) {
    var h = t.slice(0, 3e3);
    if (/<sbml[\s>]/.test(h)) return t.indexOf("celldesigner") >= 0 ? "CellDesigner" : "SBML";
    if (/<sbgn[\s>]/.test(h)) return "SBGN-ML";
    if (/<Pathway[\s>]/.test(h)) return "GPML";
    return null;
  }
  function stem(path) {
    return path.split("/").pop().replace(/\.xml$/i, "");
  }
  function minervaProject(entries) {
    var dec = new TextDecoder("utf-8"), tops2 = [], subs = [], files = {};
    entries.forEach(function(e) {
      files[e.name] = e.data;
      if (/^[^/]+\.xml$/i.test(e.name)) tops2.push(e.name);
      else if (/^submaps\/[^/]+\.xml$/i.test(e.name) && !/^submaps\/mapping\.xml$/i.test(e.name)) subs.push(e.name);
    });
    if (!tops2.length) throw new Error("not a MINERVA project: no map at its top");
    if (tops2.length > 1) throw new Error("not a MINERVA project: " + tops2.length + " maps at its top (" + tops2.join(", ") + "), where MINERVA takes one");
    subs.sort(function(a, b) {
      return a.localeCompare(b);
    });
    var maps = tops2.concat(subs).map(function(p) {
      var text = dec.decode(files[p]), f = formatName(text);
      if (f !== "CellDesigner") throw new Error(f ? "the map " + stem(p) + " is " + f + ": only CellDesigner projects open here" : stem(p) + " is not a map");
      return { path: p, text };
    });
    var used = [], glyphs = {}, kept = {};
    maps.forEach(function(m) {
      glyphsNamed(m.text).forEach(function(g) {
        if (!/\.png$/i.test(g)) throw new Error(g + " is named in " + stem(m.path) + ": MINERVA takes PNG images only");
        if (!/^glyphs\/[^/]+$/.test(g)) throw new Error(g + " is named in " + stem(m.path) + ": only images directly in glyphs/ are read here");
        if (!files[g]) throw new Error(g + " is named in " + stem(m.path) + " but missing from the zip");
        if (used.indexOf(g) < 0) used.push(g);
      });
    });
    var mapping = Object.keys(files).filter(function(n) {
      return /^submaps\/mapping\.xml$/i.test(n);
    })[0];
    if (mapping) glyphsNamed(dec.decode(files[mapping])).forEach(function(g) {
      if (files[g] && used.indexOf(g) < 0) used.push(g);
    });
    var unused = 0;
    Object.keys(files).forEach(function(n) {
      if (tops2.indexOf(n) >= 0 || subs.indexOf(n) >= 0) return;
      if (/^glyphs\//.test(n)) {
        if (used.indexOf(n) >= 0) glyphs[n] = files[n];
        else unused++;
        return;
      }
      kept[n] = files[n];
    });
    return { maps, glyphs, kept, unused };
  }
  function renameGlyph(text, from, to) {
    var esc = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp("(Glyph:[ \\t]*)" + esc + "(?=[ \\t\\r]*(?:\\n|<|$))", "g"), function(m, a) {
      return a + to;
    });
  }
  function bytesSha(data) {
    var head = new TextEncoder().encode("blob " + data.length + "\0"), all = new Uint8Array(head.length + data.length);
    all.set(head);
    all.set(data, head.length);
    return crypto.subtle.digest("SHA-1", all).then(function(h) {
      return Array.prototype.map.call(new Uint8Array(h), function(x) {
        return (x < 16 ? "0" : "") + x.toString(16);
      }).join("");
    });
  }
  function settleGlyphs(p, taken) {
    var look = typeof taken === "function" ? taken : function(n) {
      return Promise.resolve(taken[n] || null);
    };
    var renames = [], names = Object.keys(p.glyphs), out = {}, mine2 = {};
    return names.reduce(function(q, g) {
      return q.then(function() {
        return bytesSha(p.glyphs[g]);
      }).then(function(sha) {
        var free = function(n, k) {
          var cand = k < 2 ? n : n.replace(/(\.[^./]+)$/, "-" + k + "$1");
          if (mine2[cand]) return Promise.resolve(free(n, k < 2 ? 2 : k + 1));
          return look(cand).then(function(s) {
            return !s || s === sha ? cand : free(n, k < 2 ? 2 : k + 1);
          });
        };
        return free(g, 1).then(function(to) {
          mine2[to] = 1;
          out[to] = p.glyphs[g];
          if (to !== g) renames.push([g, to]);
        });
      });
    }, Promise.resolve()).then(function() {
      p.glyphs = out;
      if (renames.length) p.maps.forEach(function(m) {
        renames.forEach(function(r) {
          m.text = renameGlyph(m.text, r[0], r[1]);
        });
      });
      return renames;
    });
  }
  var CRC;
  function crc32(d) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        CRC[n] = c >>> 0;
      }
    }
    var x = 4294967295;
    for (var i = 0; i < d.length; i++) x = CRC[(x ^ d[i]) & 255] ^ x >>> 8;
    return (x ^ 4294967295) >>> 0;
  }
  function deflate(data) {
    var s = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Response(s).arrayBuffer().then(function(a) {
      return new Uint8Array(a);
    });
  }
  function dosDate() {
    return 2026 - 1980 << 9 | 1 << 5 | 1;
  }
  function asBytes(d) {
    return typeof d === "string" ? new TextEncoder().encode(d) : d;
  }
  function zip(entries) {
    return entries.reduce(function(q, e) {
      return q.then(function(out) {
        var d = asBytes(e.data);
        return deflate(d).then(function(c) {
          out.push({ name: new TextEncoder().encode(e.name), utf: /[^\x20-\x7e]/.test(e.name), d, c, crc: crc32(d) });
          return out;
        });
      });
    }, Promise.resolve([])).then(function(list2) {
      var parts = [], cd = [], off = 0, size = 0;
      var head = function(n2, sig) {
        var b = new Uint8Array(n2), v = new DataView(b.buffer);
        v.setUint32(0, sig, true);
        return { b, v };
      };
      list2.forEach(function(x) {
        var flag = x.utf ? 2048 : 0, h = head(30, 67324752), c = head(46, 33639248);
        h.v.setUint16(4, 20, true);
        c.v.setUint16(4, 20, true);
        c.v.setUint16(6, 20, true);
        var at2 = function(v, i) {
          v.setUint16(i, flag, true);
          v.setUint16(i + 2, 8, true);
          v.setUint16(i + 4, 0, true);
          v.setUint16(i + 6, dosDate(), true);
          v.setUint32(i + 8, x.crc, true);
          v.setUint32(i + 12, x.c.length, true);
          v.setUint32(i + 16, x.d.length, true);
          v.setUint16(i + 20, x.name.length, true);
        };
        at2(h.v, 6);
        at2(c.v, 8);
        c.v.setUint32(42, off, true);
        parts.push(h.b, x.name, x.c);
        cd.push(c.b, x.name);
        off += 30 + x.name.length + x.c.length;
      });
      cd.forEach(function(b) {
        size += b.length;
      });
      var end = head(22, 101010256);
      end.v.setUint16(8, list2.length, true);
      end.v.setUint16(10, list2.length, true);
      end.v.setUint32(12, size, true);
      end.v.setUint32(16, off, true);
      var all = parts.concat(cd, [end.b]), n = 0;
      all.forEach(function(b) {
        n += b.length;
      });
      var out = new Uint8Array(n), k = 0;
      all.forEach(function(b) {
        out.set(b, k);
        k += b.length;
      });
      return out;
    });
  }
  function unesc(s) {
    return s.replace(/&(lt|gt|quot|apos|amp);/g, function(m, e) {
      return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[e];
    });
  }
  function attrOf(tag, a) {
    var m = new RegExp("\\s" + a + '="([^"]*)"').exec(tag);
    return m ? m[1] : null;
  }
  function boundsIn(seg) {
    var b = /<celldesigner:bounds\s[^>]*>/.exec(seg);
    return b ? ["x", "y", "w", "h"].map(function(k) {
      return +attrOf(b[0], k);
    }) : null;
  }
  function glyphOf(s) {
    var m = /Glyph:[ \t]*([^\r\n<]+?\.(?:png|svg))[ \t\r]*(?:\n|<|$)/i.exec(unesc(s || ""));
    return m ? m[1] : null;
  }
  function picturesOn(text) {
    var out = [], comps = {}, spBox = {}, cBox = {}, m;
    var aRe = /<celldesigner:(speciesAlias|complexSpeciesAlias|compartmentAlias)\b([^>]*)>([\s\S]*?)<\/celldesigner:\1>/g;
    while (m = aRe.exec(text)) {
      var b = boundsIn(m[3]);
      if (!b) continue;
      if (m[1] === "compartmentAlias") {
        var c = attrOf(m[2], "compartment");
        if (c && !cBox[c]) cBox[c] = b;
      } else {
        var s = attrOf(m[2], "species");
        (spBox[s] = spBox[s] || []).push(b);
      }
    }
    var eRe = /<(compartment|species)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
    while (m = eRe.exec(text)) {
      var id = attrOf(m[2], "id"), n = m[4] && /<notes\b[\s\S]*?<\/notes>/.exec(m[4]), g = n && glyphOf(n[0]);
      if (m[1] === "compartment") comps[id] = { at: m.index, end: m.index + m[0].length };
      if (!g) continue;
      out.push({ kind: m[1], id, glyph: g, boxes: m[1] === "compartment" ? cBox[id] ? [cBox[id]] : [] : spBox[id] || [], at: m.index, end: m.index + m[0].length });
    }
    var lRe = /<celldesigner:layerSpeciesAlias\b[^>]*>([\s\S]*?)<\/celldesigner:layerSpeciesAlias>/g;
    while (m = lRe.exec(text)) {
      var ln = /<celldesigner:layerNotes>([\s\S]*?)<\/celldesigner:layerNotes>/.exec(m[1]), lg = ln && glyphOf(ln[1]), lb = boundsIn(m[1]);
      if (lg) out.push({ kind: "layer", glyph: lg, boxes: lb ? [lb] : [], at: m.index, end: m.index + m[0].length });
    }
    return { pics: out, cBox };
  }
  function lineAt() {
    return "(^|\\n|>|&gt;)[ \\t]*";
  }
  function lineEnd() {
    return "[ \\t]*(\\r?\\n|(?=<)|(?=&lt;)|$)";
  }
  function zOf(seg) {
    var m = new RegExp(lineAt() + "Z-Index:[ \\t]*(-?\\d+)" + lineEnd()).exec(seg);
    return m ? +m[2] : null;
  }
  function inside(a, b) {
    return a !== b && a[0] >= b[0] - 0.5 && a[1] >= b[1] - 0.5 && a[0] + a[2] <= b[0] + b[2] + 0.5 && a[1] + a[3] <= b[1] + b[3] + 0.5 && (a[2] < b[2] || a[3] < b[3]);
  }
  function zSet(seg, z) {
    var noZ = seg.replace(new RegExp(lineAt() + "Z-Index:[^\\r\\n<&]*" + lineEnd(), "g"), function(m, a) {
      return a;
    });
    var g = new RegExp("Glyph:[ \\t]*[^\\r\\n<]+?\\.(?:png|svg)" + lineEnd(), "i").exec(noZ);
    if (!g) return seg;
    var at2 = g.index + g[0].length;
    return noZ.slice(0, at2) + (g[1] ? "Z-Index: " + z + g[1] : "\nZ-Index: " + z) + noZ.slice(at2);
  }
  function reckonZ(text) {
    var on2 = picturesOn(text), cs = on2.pics.filter(function(p) {
      return p.kind === "compartment" && p.boxes.length;
    });
    if (!cs.length) return { text, changed: 0 };
    var all = Object.keys(on2.cBox).map(function(k) {
      return on2.cBox[k];
    });
    cs.forEach(function(p) {
      p.depth = all.filter(function(b) {
        return inside(p.boxes[0], b);
      }).length;
      p.z = zOf(text.slice(p.at, p.end));
    });
    var holds2 = cs.every(function(a) {
      return a.z != null && cs.every(function(b) {
        return !inside(b.boxes[0], a.boxes[0]) || b.z != null && a.z < b.z;
      });
    });
    var edits2 = [], deep = Math.max.apply(null, cs.map(function(p) {
      return p.depth;
    }));
    if (!holds2) cs.forEach(function(p) {
      var z = -2 - (deep - p.depth);
      if (p.z !== z) edits2.push({ at: p.at, end: p.end, z });
    });
    var low = Math.min.apply(null, cs.map(function(p) {
      var e = edits2.filter(function(x) {
        return x.at === p.at;
      })[0];
      return e ? e.z : p.z != null ? p.z : 0;
    }));
    on2.pics.forEach(function(p) {
      if (p.kind !== "layer") return;
      var z = zOf(text.slice(p.at, p.end));
      if (z != null && z >= low) edits2.push({ at: p.at, end: p.end, z: low - 1, layer: true });
    });
    var changed2 = 0;
    edits2.sort(function(a, b) {
      return b.at - a.at;
    }).forEach(function(e) {
      var seg = text.slice(e.at, e.end), now = zSet(seg, e.z);
      if (now !== seg) {
        changed2++;
        text = text.slice(0, e.at) + now + text.slice(e.end);
      }
    });
    return { text, changed: changed2 };
  }
  function bareName(p) {
    return p.split("/").pop().replace(/\.xml$/i, "");
  }
  function mapStem(s) {
    return s.replace(/_underscore_/g, "_");
  }
  function pruneLinks(path, data, missing) {
    if (!missing.length) return { data, gone: [] };
    var miss = missing.map(function(m2) {
      return bareName(m2);
    }), gone = [];
    if (/^config\.json$/i.test(path)) {
      try {
        var cfg = JSON.parse(new TextDecoder().decode(data)), touched = false;
        (cfg.maps || []).forEach(function(mp) {
          var keep = (mp.custom_elements || []).filter(function(e) {
            var out = miss.indexOf(e.submap) >= 0;
            if (out && gone.indexOf(e.submap) < 0) gone.push(e.submap);
            return !out;
          });
          if (mp.custom_elements && keep.length !== mp.custom_elements.length) {
            mp.custom_elements = keep;
            touched = true;
          }
        });
        var maps0 = (cfg.maps || []).length;
        cfg.maps = (cfg.maps || []).filter(function(mp) {
          var out = miss.indexOf(mp.name) >= 0;
          if (out && gone.indexOf(mp.name) < 0) gone.push(mp.name);
          return !out;
        });
        if (cfg.maps.length !== maps0) touched = true;
        return { data: touched ? new TextEncoder().encode(JSON.stringify(cfg, null, 1)) : data, gone };
      } catch (e) {
        return { data, gone: [] };
      }
    }
    if (/^submaps\/mapping\.xml$/i.test(path)) {
      var t = new TextDecoder().decode(data), cx = {}, m, sRe = /<species\b([^>]*)>/g;
      while (m = sRe.exec(t)) {
        var nm = mapStem(unesc(attrOf(m[1], "name") || ""));
        if (miss.indexOf(nm) >= 0) cx[attrOf(m[1], "id")] = nm;
      }
      var inRe = /<celldesigner:species\b([^>]*)>([\s\S]*?)<\/celldesigner:species>/g, k;
      while (m = inRe.exec(t)) if ((k = /<celldesigner:complexSpecies>([^<]+)</.exec(m[2])) && cx[k[1].trim()]) cx[attrOf(m[1], "id")] = cx[k[1].trim()];
      var t2 = t.replace(/[ \t]*<reaction\b[\s\S]*?<\/reaction>[ \t]*\r?\n?/g, function(r) {
        var hit2 = null, a = /<celldesigner:base(?:Reactant|Product)\s[^>]*species="([^"]+)"/g, x;
        while (x = a.exec(r)) if (cx[x[1]]) hit2 = cx[x[1]];
        if (hit2 && gone.indexOf(hit2) < 0) gone.push(hit2);
        return hit2 ? "" : r;
      });
      return { data: t2 === t ? data : new TextEncoder().encode(t2), gone };
    }
    return { data, gone: [] };
  }
  function packPlan(maps) {
    var paths = {}, need = {}, order = [];
    maps.forEach(function(m) {
      var f = formatName(m.text);
      if (f !== "CellDesigner") throw new Error("the map " + m.title + " is " + (f || /<graphml[\s>]/.test(m.text.slice(0, 3e3)) && "GraphML" || "not CellDesigner") + ": only CellDesigner maps go into a MINERVA zip");
      var key = m.path.toLowerCase();
      if (paths[key]) throw new Error("two maps would be " + m.path + " in the zip (" + paths[key] + ", " + m.title + "): rename one file first");
      paths[key] = m.title;
      picturesOn(m.text).pics.forEach(function(p) {
        var g = p.glyph;
        if (!/^glyphs\/[^/]+\.png$/i.test(g)) throw new Error(g + " is named in " + m.title + ": MINERVA reads images as glyphs/<name>.png");
        var n = need[g];
        if (!n) {
          n = need[g] = { name: g, box: null, mixed: false, maps: [] };
          order.push(n);
        }
        if (n.maps.indexOf(m.title) < 0) n.maps.push(m.title);
        p.boxes.forEach(function(b) {
          if (!(b[2] > 0 && b[3] > 0)) return;
          if (!n.box) n.box = [b[2], b[3]];
          else if (Math.abs(b[2] / b[3] / (n.box[0] / n.box[1]) - 1) > 0.05) n.mixed = true;
        });
      });
    });
    return order;
  }
  function pngSize(d) {
    return d.length > 24 && d[0] === 137 && d[1] === 80 ? [(d[16] << 24 | d[17] << 16 | d[18] << 8 | d[19]) >>> 0, (d[20] << 24 | d[21] << 16 | d[22] << 8 | d[23]) >>> 0] : null;
  }
  function keptGlyphs(kept) {
    var k = Object.keys(kept || {}).filter(function(n) {
      return /^submaps\/mapping\.xml$/i.test(n);
    })[0];
    return k ? glyphsNamed(new TextDecoder().decode(kept[k])).filter(function(g) {
      return /^glyphs\/[^/]+\.png$/i.test(g);
    }) : [];
  }
  function svgPixels(box3) {
    var w = Math.max(1, box3[0] * 2), h = Math.max(1, box3[1] * 2), k = Math.min(1, 8e3 / Math.max(w, h));
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  }
  function fitPixels(size, box3) {
    var r = box3[0] / box3[1];
    if (Math.abs(size[0] / size[1] / r - 1) <= 0.05) return null;
    var w = Math.max(size[0], size[1] * r), h = w / r, k = Math.min(1, 8e3 / Math.max(w, h));
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  }
  function bgVisible(text) {
    return text.replace(/<celldesigner:layer\b[^>]*\sname="Background (?:images|pictures)"[^>]*>/g, function(h) {
      return h.replace(/\svisible="false"/, ' visible="true"');
    });
  }
  function bgUnder(text) {
    var n = 0;
    return text.replace(/(<celldesigner:layer\b[^>]*?\sid=")([^"]*)("[^>]*>)([\s\S]*?<\/celldesigner:layer>)/g, function(all, a, id, b, body) {
      if (!/\sname="Background (?:images|pictures)"/.test(all.slice(0, all.indexOf(">")))) return all;
      var items2 = body.match(/<celldesigner:layerSpeciesAlias\b[\s\S]*?<\/celldesigner:layerSpeciesAlias>/g) || [];
      var under2 = items2.length && !/<celldesigner:listOf(?:Squares|FreeLines)>\s*<celldesigner:/.test(body) && items2.every(function(t) {
        var ln = /<celldesigner:layerNotes>([\s\S]*?)<\/celldesigner:layerNotes>/.exec(t), z = ln && zOf(ln[1]);
        return ln && glyphOf(ln[1]) && z != null && z < 0;
      });
      return under2 ? a + -++n + b + body : all;
    });
  }
  function packEntries(maps, pics, kept, missing) {
    var z = [], gone = [], entries = [];
    maps.forEach(function(m) {
      var r = reckonZ(bgUnder(bgVisible(m.text)));
      if (r.changed) z.push(bareName(m.path));
      entries.push({ name: m.path, data: r.text });
    });
    Object.keys(pics).sort().forEach(function(g) {
      entries.push({ name: g, data: pics[g] });
    });
    Object.keys(kept || {}).sort().forEach(function(k) {
      var p = pruneLinks(k, kept[k], missing || []);
      p.gone.forEach(function(g) {
        if (gone.indexOf(g) < 0) gone.push(g);
      });
      entries.push({ name: k, data: p.data });
    });
    return { entries, z, gone };
  }

  // editor/src/own.js
  function draftPut(id, rec) {
    keepAsked();
    rec.id = id;
    V.drafts[id] = rec;
    V.draftIds();
    return V.draftDo("readwrite", function(st) {
      return st.put(rec, id);
    });
  }
  function draftDrop(id) {
    if (V.kept && V.kept.id === id && V.kept.draft) V.dropKept();
    if (!V.drafts[id]) return Promise.resolve();
    delete V.drafts[id];
    V.draftIds();
    return V.draftDo("readwrite", function(st) {
      return st.delete(id);
    }).catch(function() {
    });
  }
  var dirP;
  function __run110() {
    dirP = null;
  }
  function folder() {
    if (!V.folderName() || !window.indexedDB) return Promise.resolve(null);
    if (!dirP) dirP = V.draftDo("readonly", function(st) {
      return st.get("dir");
    }, "folder");
    dirP.catch(function() {
      dirP = null;
    });
    return Promise.all([dirP, V.draftDo("readonly", function(st) {
      return st.get("files");
    }, "folder")]).then(function(r) {
      return r[0] ? { dir: r[0], files: r[1] || {} } : null;
    });
  }
  function folderSet(dir) {
    return V.draftDo("readwrite", function(st) {
      st.put({}, "files");
      return st.put(dir, "dir");
    }, "folder").then(function() {
      dirP = Promise.resolve(dir);
      try {
        localStorage.setItem(V.folderKey, dir.name);
      } catch (e) {
      }
    });
  }
  function folderFile(id, w) {
    return V.draftDo("readwrite", function(st) {
      var q = st.get("files");
      q.onsuccess = function() {
        var r = q.result || {};
        r[id] = w;
        st.put(r, "files");
      };
      return q;
    }, "folder");
  }
  function folderForget() {
    try {
      localStorage.removeItem(V.folderKey);
    } catch (e) {
    }
    dirP = null;
    return V.draftDo("readwrite", function(st) {
      st.delete("files");
      return st.delete("dir");
    }, "folder").catch(function() {
    });
  }
  var MINE_KEY;
  var mine;
  var mineURLs;
  function __run26() {
    MINE_KEY = "atlas-mine", mine = {}, mineURLs = {};
  }
  function mineFlag() {
    try {
      if (Object.keys(mine).length) localStorage.setItem(MINE_KEY, "1");
      else localStorage.removeItem(MINE_KEY);
    } catch (e) {
    }
  }
  var mineIn;
  function __run36() {
    mineIn = function() {
      var has;
      try {
        has = localStorage.getItem(MINE_KEY);
      } catch (e) {
      }
      if (!has || !window.indexedDB) return Promise.resolve();
      return V.draftDo("readonly", function(st) {
        return st.getAll();
      }, "mine").then(function(all) {
        (all || []).forEach(function(r) {
          if (r && r.id && !mine[r.id]) mine[r.id] = r;
        });
        var legacy = null;
        try {
          legacy = localStorage.getItem("atlas-mine-group");
          localStorage.removeItem("atlas-mine-group");
        } catch (e) {
        }
        if (legacy && mineGroups().indexOf(legacy) < 0) mineGroupsSet(mineGroups().concat([legacy]));
        Object.keys(mine).forEach(function(k) {
          var r = mine[k];
          if (r.group === void 0) {
            r.group = legacy || "";
            minePut(r).catch(function() {
            });
          }
        });
      }).catch(function() {
      });
    }();
  }
  function minePut(r) {
    mine[r.id] = r;
    mineFlag();
    return V.draftDo("readwrite", function(st) {
      return st.put(r, r.id);
    }, "mine");
  }
  function mineShown() {
    return Object.keys(mine).map(function(k) {
      return mine[k];
    }).filter(function(r) {
      return !r.hidden;
    });
  }
  var GROUPS_KEY;
  function __run43() {
    GROUPS_KEY = "atlas-mine-groups";
  }
  function mineGroups() {
    try {
      var a = JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");
      return Array.isArray(a) ? a.filter(function(g) {
        return typeof g === "string" && g;
      }) : [];
    } catch (e) {
      return [];
    }
  }
  function mineGroupsSet(a) {
    try {
      if (a.length) localStorage.setItem(GROUPS_KEY, JSON.stringify(a));
      else localStorage.removeItem(GROUPS_KEY);
    } catch (e) {
    }
  }
  var groupsHere;
  function __run55() {
    groupsHere = [];
  }
  function mineGroupsHere() {
    var site2 = (V.siteList || []).map(function(m) {
      return m.group;
    });
    return mineGroups().filter(function(g) {
      return site2.indexOf(g) < 0;
    });
  }
  function ownGroup(name2) {
    return !!name2 && groupsHere.indexOf(name2) >= 0;
  }
  function sameName(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function groupTaken(v, was) {
    return !sameName(v, was || "") && (V.siteList || []).map(function(m) {
      return m.group || "";
    }).concat(mineGroups(), V.listGroups()).some(function(g) {
      return g && sameName(g, v);
    });
  }
  function mineValid(v, was) {
    return v === was || !groupTaken(v, was);
  }
  var naming;
  function __run65() {
    naming = null;
  }
  function inPlace(at2, o) {
    if (naming) naming(true);
    var f = document.createElement("input"), done = false;
    f.type = "text";
    f.className = o.cls;
    f.maxLength = o.max;
    f.value = o.value;
    f.placeholder = o.label;
    f.setAttribute("aria-label", o.label);
    at2.replaceWith(f);
    f.scrollIntoView({ block: "nearest" });
    f.focus();
    f.select();
    var end = naming = function(keep) {
      if (done) return;
      done = true;
      naming = null;
      o.end(keep ? f.value.trim() : null);
      V.refreshMine();
    };
    f.addEventListener("input", function() {
      f.classList.remove("m2-bad");
      f.title = "";
    });
    f.addEventListener("keydown", function(e) {
      e.stopPropagation();
      if (e.key === "Escape") return end(false);
      if (e.key !== "Enter") return;
      e.preventDefault();
      var why = o.bad && o.bad(f.value.trim());
      if (why) {
        f.classList.add("m2-bad");
        f.title = why;
        return;
      }
      end(true);
    });
    f.addEventListener("blur", function() {
      if (!document.hasFocus()) return;
      if (pressed) document.addEventListener("click", function() {
        setTimeout(function() {
          end(true);
        }, 0);
      }, { once: true, capture: true });
      else end(true);
    });
  }
  function canRenameGroup(name2) {
    return !!name2 && (ownGroup(name2) || V.listGroups().indexOf(name2) >= 0);
  }
  function renameSiteGroup(was) {
    if (naming) naming(true);
    var at2 = document.getElementById("m2-list").querySelector('.m2-group:not(.m2-mine):not(.m2-bin)[data-group="' + CSS.escape(was) + '"]');
    if (!at2) return;
    var clean = function(v) {
      return (v || "").replace(/["\\]/g, "").trim();
    };
    var taken = function(v) {
      return v !== was && groupTaken(v, was);
    };
    inPlace(at2, {
      cls: "m2-group-edit",
      max: 60,
      value: was,
      label: "Name of the group",
      bad: function(v) {
        v = clean(v);
        return v && taken(v) ? "A group of this name is in the list already" : "";
      },
      end: function(v) {
        v = clean(v);
        if (!v || v === was || taken(v)) return;
        var ex = (V.siteList || []).filter(function(m) {
          return m.example;
        }).map(function(m) {
          return m.id;
        });
        var fwd = siteGroupRename(was, v);
        listDid(function() {
          return fwd.then(function() {
            return siteGroupRename(v, was, ex);
          });
        }, function() {
          return siteGroupRename(was, v);
        });
      }
    });
  }
  function siteGroupRename(was, v, ex) {
    var gh2 = !!(repo() && token()), pages = [];
    (V.siteList || []).forEach(function(m) {
      var g = V.movedOf(m.id);
      if (g === null) g = m.group || "";
      if (g !== was) return;
      V.setMoved(m.id, v);
      if (gh2 && canRename(m, true)) pages.push(m.id);
    });
    Object.keys(mine).forEach(function(k) {
      var r = mine[k];
      if (r.group === was) {
        r.group = v;
        minePut(r).catch(function() {
        });
      }
    });
    V.regroupRename(was, v);
    if (V.closed[was]) {
      V.closed[v] = true;
      delete V.closed[was];
      V.saveClosed();
    }
    V.refreshMine();
    return pages.length ? opSend("group", { ids: pages, g: v, ex: ex || null }, pages).catch(function(e) {
      alert(was + " was not renamed on the site: " + (e && e.message ? e.message : e) + ". The new name is kept in this browser only.");
    }) : Promise.resolve();
  }
  function siteGroupTo(ids, g, ex) {
    var tries = 0, post = ghPost;
    var go = function() {
      return api("/git/ref/heads/main").then(ghJson).then(function(ref) {
        return Promise.all(ids.map(function(id) {
          return api("/contents/maps/" + encodeURIComponent(id) + ".md?ref=" + ref.object.sha).then(function(r) {
            return r.status === 404 ? null : ghJson(r);
          }).then(function(d) {
            if (!d) return null;
            var md = textOf(d.content), fm = /^---(\r?\n)([\s\S]*?)\r?\n---/.exec(md);
            if (!fm) return null;
            var head = fm[2].replace(/^group:[^\r\n]*/m, "group: " + JSON.stringify(g)).replace(/^example:.*(\r?\n|$)/m, "").replace(/\r?\n$/, "");
            if ((ex || []).indexOf(id) >= 0) head += fm[1] + "example: true";
            if (!/^group:/m.test(head)) head += fm[1] + "group: " + JSON.stringify(g);
            return { path: "maps/" + id + ".md", mode: "100644", type: "blob", content: "---" + fm[1] + head + md.slice(3 + fm[1].length + fm[2].length) };
          });
        })).then(function(tree) {
          tree = tree.filter(Boolean);
          if (!tree.length) return;
          return api("/git/commits/" + ref.object.sha).then(ghJson).then(function(c) {
            return post("/git/trees", { base_tree: c.tree.sha, tree });
          }).then(function(t) {
            return post("/git/commits", { message: "Group renamed in the viewer: " + g, tree: t.sha, parents: [ref.object.sha] });
          }).then(function(n) {
            return post("/git/refs/heads/main", { sha: n.sha }, "PATCH");
          });
        });
      }).catch(function(e) {
        if (e.status === 422 && ++tries < 3) return go();
        throw e;
      });
    };
    return go();
  }
  function renameGroup(was) {
    if (was && !ownGroup(was)) return renameSiteGroup(was);
    if (naming) naming(true);
    var box3 = document.getElementById("m2-list"), at2 = null, fresh = null;
    if (!was) {
      fresh = was = "New group";
      for (var k = 2; !mineValid(was); k++) was = fresh + " " + k;
      fresh = was;
      mineGroupsSet([was].concat(mineGroups()));
      V.refreshMine();
    }
    if (!(at2 = box3.querySelector('.m2-group.m2-mine[data-group="' + CSS.escape(was) + '"]'))) {
      if (fresh) {
        mineGroupsSet(mineGroups().filter(function(g) {
          return g !== fresh;
        }));
        V.refreshMine();
      }
      return;
    }
    inPlace(at2, {
      cls: "m2-group-edit",
      max: 60,
      value: was || "",
      label: "Name of the group",
      bad: function(v) {
        return v && !mineValid(v, was) ? "A group of this name is in the list already" : "";
      },
      end: function(v) {
        if (fresh && (!v || !mineValid(v, was))) return mineGroupsSet(mineGroups().filter(function(g) {
          return g !== fresh;
        }));
        if (!v || v === was || !mineValid(v, was)) {
          if (fresh) listDid(function() {
            removeGroup(fresh);
          }, function() {
            groupBack(fresh, 0);
          });
          return;
        }
        ownGroupTo(was, v);
        if (fresh) listDid(function() {
          removeGroup(v);
        }, function() {
          groupBack(v, 0);
        });
        else listDid(function() {
          ownGroupTo(v, was);
          V.refreshMine();
        }, function() {
          ownGroupTo(was, v);
          V.refreshMine();
        });
      }
    });
  }
  function ownGroupTo(was, v) {
    var gs = mineGroups(), k = gs.indexOf(was);
    if (k < 0) return;
    gs[k] = v;
    Object.keys(mine).forEach(function(id) {
      var r = mine[id];
      if (r.group === was) {
        r.group = v;
        minePut(r).catch(function() {
        });
      }
    });
    V.regroupRename(was, v);
    if (V.closed[was]) {
      V.closed[v] = true;
      delete V.closed[was];
      V.saveClosed();
    }
    mineGroupsSet(gs);
  }
  function groupBack(name2, at2) {
    var gs = mineGroups().filter(function(g) {
      return g !== name2;
    });
    gs.splice(Math.min(at2, gs.length), 0, name2);
    mineGroupsSet(gs);
    V.refreshMine();
  }
  var pressed;
  function __run75() {
    pressed = false;
    document.addEventListener("pointerdown", function() {
      pressed = true;
    }, true);
    document.addEventListener("pointerup", function() {
      setTimeout(function() {
        pressed = false;
      }, 0);
    }, true);
  }
  function removeGroup(name2) {
    mineGroupsSet(mineGroups().filter(function(g) {
      return g !== name2;
    }));
    Object.keys(mine).forEach(function(k) {
      var r = mine[k];
      if (r.group === name2) {
        r.group = "";
        minePut(r).catch(function() {
        });
      }
    });
    V.regroupRename(name2, null);
    if (V.closed[name2]) {
      delete V.closed[name2];
      V.saveClosed();
    }
    V.refreshMine();
  }
  var addTo;
  function __run83() {
    addTo = "";
  }
  function listItems(e) {
    var t = e.target.closest(".m2-map, .m2-group, .m2-empty"), m = t && t.classList.contains("m2-map") ? V.byId[t.dataset.id] : null;
    var gh2 = !!(repo() && token()), tg = t && !t.classList.contains("m2-link-group") && t.dataset.group;
    var g = m ? m.mine || gh2 ? m.group || "" : "" : tg && (ownGroup(tg) || gh2) ? tg : "", onGroup = t && !m && ownGroup(g);
    var into = m ? m.group || "" : tg && (ownGroup(tg) || V.siteGroupOf(tg) || t.classList.contains("m2-empty")) ? tg : "";
    var items2 = [["New SBGN-ML map", function() {
      listMade(function() {
        return newMap(into);
      });
    }], ["New CellDesigner map", function() {
      listMade(function() {
        return newMap(into, "cd");
      });
    }], ["Add map from file", function() {
      addTo = g;
      picker.click();
    }], ["Add group", function() {
      renameGroup(null);
    }]];
    if (canRestoreExamples()) items2.push(["Restore example maps", restoreExamples]);
    var editing2 = V.grid.classList.contains("m2-editing") && V.chosen && V.chosen.id === (m && m.id);
    if (m && m.binned) {
      var bsel = V.picked();
      if (bsel.indexOf(m.id) < 0) V.pickSet([]);
      else if (bsel.length > 1) {
        var bms = bsel.map(function(id) {
          return V.byId[id];
        }).filter(function(x2) {
          return x2 && x2.binned;
        });
        var bm = [["Restore " + bms.length + " maps", function() {
          restoreManyU(bms);
        }]];
        bm.last = [["Delete " + bms.length + " maps forever", function() {
          erase(bms);
        }]];
        return bm;
      }
      var bi = [["Restore", function() {
        restoreU(m);
      }]];
      bi.last = [["Delete forever", function() {
        erase([m]);
      }]];
      return bi;
    }
    if (t && t.dataset.bin) {
      var bh = [], gone = V.maps.filter(function(x2) {
        return x2.binned;
      });
      if (gone.length) bh.last = [["Delete all forever", function() {
        erase(gone);
      }]];
      return bh;
    }
    var mapItems = [], x = e.clientX, y = e.clientY;
    var sel = V.picked();
    if (m && sel.indexOf(m.id) < 0) V.pickSet([]);
    else if (m && sel.length > 1) {
      var ms = sel.map(function(id) {
        return V.byId[id];
      }).filter(Boolean), mv2 = ms.filter(movable), del = ms.filter(function(x2) {
        return canDelete(x2, gh2) && !(V.grid.classList.contains("m2-editing") && V.chosen && V.chosen.id === x2.id);
      });
      if (mv2.length && V.listGroups().length) mapItems.push(["Move " + mv2.length + " maps to...", function() {
        moveMenuMany(mv2, x, y);
      }]);
      var cds = ms.filter(function(q) {
        return !q.binned;
      });
      if (cds.some(cdOf)) {
        if (mapItems.length) mapItems.push(null);
        mapItems.push(packItem("Download " + cds.length + " maps as MINERVA zip", function() {
          packZip(cds, false, cds[0].group || mapName(cds[0]));
        }));
      }
      items2 = mapItems.length ? mapItems.concat([null], items2) : items2;
      if (del.length) items2.last = [["Delete " + del.length + " maps", function() {
        binU(del, true);
      }, false, DEL_KEY]];
      return items2;
    }
    if (m && canRename(m, gh2)) mapItems.push(["Rename map", function() {
      renameMap(m.id);
    }]);
    if (m && canCopy(m)) mapItems.push(["Make a copy", function() {
      listMade(function() {
        return copyMap(m.id);
      });
    }]);
    if (m && movable(m) && V.listGroups().length) mapItems.push(["Move to...", function() {
      moveMenu(m, x, y);
    }]);
    if (m && canTop(m)) mapItems.push(["Set as top level", function() {
      moveU([m.id], m.group, true);
    }]);
    if (mapItems.length) items2 = mapItems.concat([null], items2);
    items2.mapItems = mapItems.length;
    if (m && cdOf(m)) items2.dl = [packItem("Download as MINERVA zip", function() {
      packZip([m], false, mapName(m));
    })];
    var siteG = t && !m && tg && !ownGroup(tg) && !t.dataset.bin && canRenameGroup(tg) ? tg : null;
    var packG = t && !m && tg && !t.dataset.bin && inGroup(tg).some(cdOf) ? tg : null;
    if (packG) items2 = [packItem("Download as MINERVA zip", function() {
      packZip(inGroup(packG), true, packG);
    }), null].concat(items2);
    if (onGroup || siteG) items2 = [["Rename group", function() {
      renameGroup(siteG || g);
    }], null].concat(items2);
    if (onGroup) items2.last = [["Remove group", function() {
      removeU(g);
    }]];
    var dg = t && !m && tg && !t.dataset.bin ? groupMaps(tg, gh2) : null;
    if (dg && (dg.length || onGroup && !inGroup(tg).length)) (items2.last = items2.last || []).push(["Delete group", function() {
      deleteGroupU(tg, dg);
    }, false, DEL_KEY]);
    if (m && !editing2 && canDelete(m, gh2)) items2.last = [["Delete map", function() {
      binU([m]);
    }, false, DEL_KEY]];
    return items2;
  }
  function movable(m) {
    if (!m || m.shownAs) return false;
    var r = m.mine && mine[m.id];
    return m.mine ? !!r && !r.site : true;
  }
  function moveTo(id, g, before, k, many) {
    g = g || "";
    var m = V.byId[id], r = mine[id], sent = null;
    if (r) {
      r.group = g;
      minePut(r).catch(function() {
      });
    } else if (m) {
      if (g !== (m.group || "")) {
        if (repo() && token() && canRename(m, true) && !ownGroup(g)) g = g.replace(/["\\]/g, "");
        V.setMoved(id, g);
        if (repo() && token() && canRename(m, true) && !ownGroup(g)) sent = toSiteGroup(id, g, k, before === true ? many || 1 : 0).then(function() {
          return true;
        }, function(e) {
          if (!e || !e.noPage) alert((m.topic || m.title) + " was not moved on the site: " + (e && e.message ? e.message : e) + ". The move is kept in this browser only.");
          return false;
        });
      }
    } else return Promise.resolve();
    put(id, g, before);
    var moved = !!m && g !== (m.group || ""), n = m && mapName(m);
    var keep = moved && nameTaken(n, g, fmtOf(m), id, m.tab), local2 = !r && !(canRename(m, !!(repo() && token())) && !ownGroup(g));
    return Promise.resolve(sent).then(function(ok) {
      if (keep) {
        nameTo(V.byId[id] || m, freeTitle(n, g, fmtOf(m), null, id, m.tab), local2 || ok === false);
        V.refreshMine();
      }
    });
  }
  function moveMany(ids, g, before) {
    var top = before === true, run = top ? ids.slice().reverse() : ids;
    return run.reduce(function(p, id) {
      return p.then(function() {
        return moveTo(id, g, before, ids.indexOf(id), ids.length);
      });
    }, Promise.resolve());
  }
  var pageWas;
  function __run92() {
    pageWas = {};
  }
  function toSiteGroup(id, g, k, top) {
    var at2 = top ? siteFirst(g) - top + (k | 0) : siteOrder(g) + (k | 0);
    return siteFront(id, { set: { group: JSON.stringify(g.replace(/["\\]/g, "")), order: String(at2) }, drop: ["example"], was: ["order"] }, "Map moved in the viewer");
  }
  function put(id, g, before) {
    if (g && V.closed[g]) {
      delete V.closed[g];
      V.saveClosed();
    }
    V.placeMap(id, g, before);
    V.refreshMine();
  }
  function moveMenuMany(ms, x, y) {
    var site2 = (V.siteList || []).map(function(s) {
      return s.group;
    }), ids = ms.map(function(m) {
      return m.id;
    });
    var gs = V.listGroups().filter(function(n) {
      return n && (ownGroup(n) || site2.indexOf(n) >= 0);
    });
    V.listMenu(x, y, [["No group", function() {
      V.pickSet([]);
      moveU(ids, "", true);
    }], null].concat(gs.map(function(n) {
      return [n, function() {
        V.pickSet([]);
        moveU(ids, n, true);
      }];
    })));
  }
  function moveMenu(m, x, y) {
    var site2 = (V.siteList || []).map(function(s) {
      return s.group;
    });
    var gs = V.listGroups().filter(function(n) {
      return n && (ownGroup(n) || site2.indexOf(n) >= 0);
    });
    V.listMenu(x, y, [["No group", function() {
      moveU([m.id], "", true);
    }, !m.group], null].concat(gs.map(function(n) {
      return [n, function() {
        moveU([m.id], n, true);
      }, n === m.group];
    })));
  }
  function canCopy(m) {
    return !!m && !m.shownAs && (m.mine ? !!mine[m.id] : !!graphmlOf(m) && (!sbMap(m) || /^maps\/[^/]+\.sbgn$/.test(m.editPath || "")));
  }
  function fmtOf(m) {
    return (((m.site || m).downloads || [])[0] || {}).label || "";
  }
  function fmtOfText(t) {
    return isCd(t) ? "CellDesigner" : isSb(t) ? "SBGN-ML" : "GraphML";
  }
  function mapName(m) {
    return m.mine ? m.title : m.topic || m.title;
  }
  function bare(v) {
    return String(v || "").replace(/["\\]/g, "").trim();
  }
  function nameTaken(name2, group, fmt2, id, tab) {
    var key = bare(name2) + (tab ? " (" + tab + ")" : ""), seen = {};
    var all = (V.maps || []).concat(mineShown().map(function(r) {
      return { id: r.id, mine: true, title: r.title, group: r.group || "", downloads: [{ label: fmtOfText(r.text) }] };
    }));
    return all.some(function(m) {
      if (seen[m.id]) return false;
      seen[m.id] = 1;
      return m.id !== id && !m.binned && !m.deleted && (m.group || "") === (group || "") && fmtOf(m) === fmt2 && sameName(bare(mapName(m)) + (m.tab ? " (" + m.tab + ")" : ""), key);
    });
  }
  function freeTitle(t, group, fmt2, also, id, tab) {
    var f = t;
    for (var k = 1; nameTaken(f, group, fmt2, id, tab) || (also || []).some(function(a) {
      return sameName(a, f);
    }); k++) f = t + " (" + k + ")";
    return f;
  }
  function nameTo(m, v, local2) {
    var shown2 = mapName(m);
    if (!v || v === shown2) return;
    if (m.mine) {
      var r = mine[m.id];
      if (!r) return;
      r.title = v;
      minePut(r).catch(function() {
      });
      if (r.site) {
        var sid = r.site, was0 = renamed[sid] ? renamed[sid].was : r.siteTitle || shown2;
        renamed[sid] = { was: was0, to: v };
        var sent = toSiteName(sid, shown2, v).catch(function(e) {
          delete renamed[sid];
          alert(shown2 + " was not renamed on the site: " + (e && e.message ? e.message : e));
        });
      }
      if (V.current && V.current.id === m.id) {
        document.getElementById("m2-title").textContent = v;
        if (map && map.id === m.id) map.title = v;
      }
      return sent;
    } else if (local2) {
      renamed[m.id] = { was: renamed[m.id] ? renamed[m.id].was : (V.siteList || []).filter(function(x) {
        return x.id === m.id;
      }).map(function(x) {
        return x.topic;
      })[0] || shown2, to: v, local: true };
      namedSave();
    } else {
      var was = renamed[m.id] ? renamed[m.id].was : shown2;
      renamed[m.id] = { was, to: v };
      return toSiteName(m.id, shown2, v).catch(function(e) {
        delete renamed[m.id];
        V.refreshMine();
        alert(shown2 + " was not renamed: " + (e && e.message ? e.message : e));
      });
    }
  }
  function freeFile(name2) {
    var files = Object.keys(mine).map(function(k2) {
      return mine[k2].file;
    }), ext = (name2.match(/\.[^.]+$/) || [""])[0], base = name2.slice(0, name2.length - ext.length), f = name2;
    for (var k = 2; files.indexOf(f) >= 0; k++) f = base + "-" + k + ext;
    return f;
  }
  function textNow(m) {
    if (on && site && site.id === m.id) return Promise.resolve(src());
    if (m.mine) return Promise.resolve(mine[m.id].text);
    var t = V.drafts[m.id] && V.drafts[m.id].text || heldText(m);
    if (t) return Promise.resolve(t);
    var p = ahead(m);
    if (!p) return Promise.reject(new Error("its file is not known"));
    return Promise.all([p.sitePub, p.gh.catch(function() {
      return null;
    })]).then(function(x) {
      return x[1] ? x[1].text : x[0];
    });
  }
  function copyMap(id) {
    if (naming) naming(true);
    var m = V.byId[id];
    if (!m || !canCopy(m)) return;
    var r0 = m.mine ? mine[id] : null;
    return copyOf(m, null, "Copy of " + (r0 ? r0.title : m.topic || m.title), true).catch(function(e) {
      alert("No copy was made: " + (e && e.message ? e.message : e));
    });
  }
  function copyOf(m, t, name2, go, made2) {
    var id = m.id, r0 = m.mine ? mine[id] : null, group = m.group || "", fmt2 = fmtOf(m), title = freeTitle(name2, group, fmt2), next = after(id);
    var slug = function(v) {
      return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "map";
    };
    var ext = r0 ? (r0.file.match(/\.[^.]+$/) || [".xml"])[0] : cdMap(m) ? ".xml" : sbMap(m) ? ".sbgn" : ".graphml";
    var file = freeFile(slug(title) + ext);
    var gh2 = !!(repo() && token());
    return mineIn.then(function() {
      return t ? t() : textNow(m);
    }).then(function(t2) {
      if (fmtOfText(t2) !== fmt2) {
        title = freeTitle(name2, group, fmtOfText(t2));
        ext = isCd(t2) ? ".xml" : isSb(t2) ? ".sbgn" : ".graphml";
        file = freeFile(slug(title) + ext);
      }
      if (gh2) {
        ext = siteExt(t2);
        if (!ext) throw new Error(siteWhy(t2));
      }
      var made3 = r0 && t2 === r0.text ? Promise.resolve({ svg: r0.svg, width: r0.width, height: r0.height }) : drawText(t2);
      return made3.then(function(d) {
        var r = { id: newId(), title, file, text: t2, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(t2), hidden: false, group };
        if (!gh2) return minePut(r).then(function() {
          toFolder(r.id, r.file, r.text);
          return r;
        });
        return toSite(title, ext, t2, group, siteOrder(group)).then(function(s) {
          return minePut(onSite(r, s, title)).then(function() {
            return r;
          });
        });
      });
    }).then(function(r) {
      put(r.id, group, next);
      if (made2) made2(r);
      if (typeof go === "function" ? go() : go) V.go(r.id);
      else V.refreshMine();
      return r;
    });
  }
  function keepBeside(id, t, said) {
    var m = V.byId[id];
    if (!m) return Promise.reject(new Error("the map is no longer in the list"));
    if (!canCopy(m)) return Promise.reject(new Error("a map of this kind cannot be copied"));
    var r0 = m.mine ? mine[id] : null, was = r0 ? r0.title : m.topic || m.title;
    var still = function() {
      return on && site && site.id === id;
    };
    return copyOf(m, t, was + " (your version)", still, function(r) {
      var now = t();
      if (now !== r.text) {
        r.text = now;
        mine[r.id] = r;
        minePut(r).catch(function() {
        });
        if (!(repo() && token())) toFolder(r.id, r.file, now);
      }
      said(r.title, r.id, was);
    });
  }
  function keepOther(id, text) {
    var m = V.byId[id];
    if (!m) return Promise.reject(new Error("the map is no longer in the list"));
    if (!canCopy(m)) return Promise.reject(new Error("a map of this kind cannot be copied"));
    var r0 = m.mine ? mine[id] : null, was = r0 ? r0.title : m.topic || m.title;
    return copyOf(m, function() {
      return text;
    }, was + " (other version)", false).then(function(r) {
      return r.title;
    });
  }
  function fromTool(id, text, name2) {
    var m = V.byId[id];
    if (!m) return Promise.reject(new Error("the map is no longer in the list"));
    if (m.binned) return Promise.reject(new Error("the map is in Deleted"));
    if (naming) naming(true);
    var t = String(text == null ? "" : text), out = null, err = null;
    name2 = String(name2 == null ? "" : name2).replace(/\s+/g, " ").trim() || "Unnamed map";
    var go = function() {
      return listMade(function() {
        return copyOf(m, function() {
          return t;
        }, name2, true, function(r) {
          out = r;
        }).catch(function(e) {
          err = e;
        });
      }).then(function() {
        if (err) throw err;
        return { id: out.id, name: out.title };
      });
    };
    var p = (toolLast || Promise.resolve()).then(go, go);
    toolLast = p.catch(function() {
    });
    return p;
  }
  var toolLast;
  function keptNow(s) {
    return V.draftDo("readonly", function(st) {
      return st.get(s.id);
    }, s.mine ? "mine" : "maps").then(function(r) {
      var k = r ? r.text : null;
      if (k !== s.known) {
        if (s.mine) {
          if (r) mine[s.id] = r;
        } else if (r) V.drafts[s.id] = r;
        else if (V.drafts[s.id]) {
          delete V.drafts[s.id];
          V.draftIds();
        }
      }
      return k;
    });
  }
  function siteFirst(group) {
    var os = (V.siteList || []).filter(function(s) {
      return s.group === group;
    }).map(function(s) {
      return s.order || 0;
    });
    return os.length ? Math.min.apply(null, os) : 1;
  }
  function siteOrder(group) {
    return (V.siteList || []).reduce(function(a, s) {
      return !group || s.group === group ? Math.max(a, s.order || 0) : a;
    }, 0) + 1;
  }
  function after(id) {
    var ms = V.maps, i = ms.findIndex(function(x) {
      return x.id === id;
    });
    return i >= 0 && ms[i + 1] && (ms[i + 1].group || "") === (ms[i].group || "") ? ms[i + 1].id : null;
  }
  function __run102() {
    try {
      localStorage.removeItem("atlas-examples");
    } catch (e) {
    }
  }
  function letGo(url) {
    setTimeout(function() {
      var used = V.current && (V.current.image === url || (V.current.downloads || []).some(function(d) {
        return d.url === url;
      })) || Array.prototype.some.call(document.querySelectorAll("a[href], img[src]"), function(e) {
        return e.getAttribute("href") === url || e.getAttribute("src") === url;
      });
      if (used) letGo(url);
      else URL.revokeObjectURL(url);
    }, 1e4);
  }
  function mineEntry(r) {
    var u = mineURLs[r.id];
    if (!u || u.at !== r.at) {
      if (u) {
        letGo(u.svg);
        letGo(u.text);
      }
      u = mineURLs[r.id] = { at: r.at, svg: URL.createObjectURL(new Blob([r.svg], { type: "image/svg+xml" })), text: URL.createObjectURL(new Blob([r.text], { type: "application/xml" })) };
    }
    var cdm = isCd(r.text), sbm = !cdm && isSb(r.text);
    var e = {
      id: r.id,
      title: r.title,
      group: r.group && (groupsHere.indexOf(r.group) >= 0 || V.siteGroupOf(r.group)) ? r.group : "",
      topic: r.id,
      mine: true,
      file: r.file,
      width: r.width,
      height: r.height,
      v: String(r.at),
      image: u.svg,
      colours: true,
      legend: cdm ? "celldesigner" : "sbgn",
      downloads: [{ label: cdm ? "CellDesigner" : sbm ? "SBGN-ML" : "GraphML", url: u.text }]
    };
    if (sbm) {
      e.editBase = emptyBase();
      e.ownText = function() {
        return r.text;
      };
      e.editPath = r.file;
    }
    return e;
  }
  var HIDDEN_KEY;
  function __run11() {
    HIDDEN_KEY = "atlas-hidden-maps";
  }
  function hiddenSet(ids) {
    try {
      if (ids.length) localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
      else localStorage.removeItem(HIDDEN_KEY);
    } catch (e) {
    }
  }
  function siteHidden() {
    try {
      var a = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function withMine(list2) {
    var ids = {}, held2 = {};
    list2.forEach(function(m) {
      ids[m.id] = m;
    });
    Object.keys(mine).forEach(function(k) {
      var r = mine[k], s = r.site && ids[r.site];
      if (!s) return;
      var waits = on && site && site.id === k || r.saved != null && r.text !== r.saved;
      if (waits || r.sha && s.src && s.src !== r.sha && Date.now() - r.at < 36e5) {
        held2[r.site] = 1;
        return;
      }
      V.arrived[k] = r.site;
      delete mine[k];
      delete mineURLs[k];
      mineFlag();
      V.draftDo("readwrite", function(st) {
        return st.delete(k);
      }, "mine").catch(function() {
      });
      if (location.hash.slice(1) === k) setTimeout(function() {
        if (location.hash.slice(1) === k && V.byId[r.site]) V.go(r.site);
      }, 0);
    });
    list2 = siteNamed(list2.filter(function(m) {
      return !held2[m.id];
    }));
    var moved = movedSites(), hid = siteHidden(), gh2 = !!(repo() && token()), pend = binPending(), n0 = Object.keys(pend).length, binned = [];
    list2 = list2.filter(function(m) {
      if (moved[m.id]) return false;
      if (hiddenGone[m.id]) return false;
      var tb = twinBase(m), tp = tb && (ids[tb + "-graphml"] || ids[tb]), d = tp && m.deleted && m.deleted === tp.deleted ? binState(tp, pend) : tp && binState(tp, pend) || binState(m, pend);
      if (!d && (!gh2 || hid.indexOf(m.id) < 0)) return true;
      if (gh2) binned.push(Object.assign({}, m, { binned: d ? Date.parse(d) || Date.now() : Date.now() }));
      return false;
    });
    if (Object.keys(pend).length !== n0) binPendingSet(pend);
    var own2 = mineShown().sort(function(a, b) {
      return a.title.localeCompare(b.title);
    }).map(mineEntry);
    Object.keys(mine).forEach(function(k) {
      var r = mine[k];
      if (r.hidden && !r.gone) binned.push(Object.assign(mineEntry(r), { binned: r.deleted || r.at }));
    });
    return own2.concat(list2, binned);
  }
  var exBackup;
  function __run123() {
    exBackup = null;
  }
  function backupKnown() {
    if (exBackup !== null || !(repo() && token())) return;
    exBackup = false;
    api("/contents/examples?ref=main").then(function(r) {
      exBackup = r.ok;
    }, function() {
      exBackup = null;
    });
  }
  function exampleIds() {
    return (V.siteList || []).filter(function(m) {
      return m.example;
    }).map(function(m) {
      return m.id;
    });
  }
  function canRestoreExamples() {
    if (V.grid.classList.contains("m2-editing") && V.chosen && V.chosen.example) return false;
    backupKnown();
    return exampleIds().length > 0 || exBackup === true && !!(repo() && token());
  }
  function restoreExamples() {
    var gh2 = !!(repo() && token());
    var ids = exampleIds(), was = null, done = null, step2 = {};
    var fwd = run();
    function run() {
      was = examplesWas(ids);
      examplesHere(ids, gh2);
      if (!gh2) return Promise.resolve();
      return examplesToSite().then(function(r) {
        done = r;
        examplesHere(r.ids.filter(function(id) {
          return ids.indexOf(id) < 0;
        }), gh2);
      }).catch(function(e) {
        examplesPut(was);
        var k = listPast.indexOf(step2);
        if (k >= 0) listPast.splice(k, 1);
        alert("The example maps were not restored: " + (e && e.message ? e.message : e));
      });
    }
    step2.undo = function() {
      return fwd.then(function() {
        if (!gh2 || !done) {
          examplesPut(was);
          return;
        }
        return examplesBack(done).then(function(kept) {
          examplesPut(was);
          if (kept.length) alert("The restore was undone, except where a map was changed after it: " + kept.join(", "));
        }, function(e) {
          alert("The restore was not undone: " + (e && e.message ? e.message : e));
        });
      });
    };
    step2.redo = function() {
      done = null;
      fwd = run();
      return fwd;
    };
    listDid(step2.undo, step2.redo, step2);
  }
  function examplesAll(ids) {
    return ids.concat(ids.filter(function(id) {
      return /-graphml$/.test(id);
    }).map(twinOf));
  }
  function examplesWas(ids) {
    var was = { ids, at: Date.now(), pend: binPending(), hidden: siteHidden(), moved: {}, renamed: {}, gone: {}, drafts: {} };
    examplesAll(ids).forEach(function(id) {
      was.moved[id] = V.movedOf(id);
      was.renamed[id] = renamed[id];
      was.gone[id] = hiddenGone[id];
      if (V.drafts[id]) was.drafts[id] = V.drafts[id];
    });
    return was;
  }
  function examplesPut(was) {
    binPendingSet(was.pend);
    hiddenSet(was.hidden);
    Object.keys(was.moved).forEach(function(id) {
      V.setMoved(id, was.moved[id]);
      if (was.renamed[id]) renamed[id] = was.renamed[id];
      else delete renamed[id];
      if (was.gone[id]) hiddenGone[id] = was.gone[id];
      else delete hiddenGone[id];
    });
    namedSave();
    Object.keys(was.drafts).forEach(function(id) {
      if (!(V.drafts[id] && (V.drafts[id].at || 0) > was.at)) draftPut(id, Object.assign({}, was.drafts[id])).catch(function() {
      });
    });
    var m = V.current && V.byId[V.current.id];
    if (m && was.drafts[m.id] && !V.grid.classList.contains("m2-editing")) V.put(m, true);
    V.refreshMine();
  }
  function examplesBack(done) {
    var tries = 0;
    var go = function() {
      return api("/git/ref/heads/main").then(ghJson).then(function(ref) {
        return api("/git/commits/" + ref.object.sha).then(ghJson).then(function(c) {
          return api("/git/trees/" + c.tree.sha).then(ghJson).then(function(root) {
            var m = root.tree.filter(function(f) {
              return f.path === "maps" && f.type === "tree";
            })[0];
            return m ? api("/git/trees/" + m.sha + "?recursive=1").then(ghJson) : { tree: [] };
          }).then(function(x) {
            if (x.truncated) throw new Error("the maps are too many to read at once");
            var now = {};
            x.tree.forEach(function(f) {
              if (f.type === "blob") now["maps/" + f.path] = f.sha;
            });
            var kept = [], tree = [];
            Object.keys(done.before).forEach(function(p) {
              if ((now[p] || null) === (done.after[p] || null)) {
                if (done.before[p] || now[p]) tree.push({ path: p, mode: "100644", type: "blob", sha: done.before[p] });
              } else kept.push(p.replace(/^maps\//, "").replace(/\.[^./]+$/, "").replace(/^(extra|sbgn-ml|colours)\//, "").split("/")[0]);
            });
            kept = kept.filter(function(k, i) {
              return kept.indexOf(k) === i;
            });
            if (!tree.length) return kept;
            return ghPost("/git/trees", { base_tree: c.tree.sha, tree }).then(function(t) {
              return ghPost("/git/commits", { message: "Example maps restored in the viewer: undone", tree: t.sha, parents: [ref.object.sha] });
            }).then(function(n) {
              return ghPost("/git/refs/heads/main", { sha: n.sha }, "PATCH");
            }).then(function() {
              shared.ghDir = null;
              return kept;
            });
          });
        });
      }).catch(function(e) {
        if (e.status === 422 && ++tries < 3) return go();
        throw e;
      });
    };
    return go();
  }
  function examplesHere(ids, gh2) {
    var all = examplesAll(ids);
    var pend = binPending(), deleted = {};
    (V.siteList || []).forEach(function(m2) {
      deleted[m2.id] = m2.deleted;
    });
    all.forEach(function(id) {
      if (gh2 && deleted[id]) pend[id] = ["", Date.now()];
      else delete pend[id];
      unkeep(id).catch(function() {
      });
      delete hiddenGone[id];
      delete renamed[id];
      V.setMoved(id, null);
    });
    namedSave();
    binPendingSet(pend);
    if (V.kept && all.indexOf(V.kept.id) >= 0) V.dropKept();
    var m = V.current && V.byId[V.current.id];
    if (m && all.indexOf(m.id) >= 0 && !V.grid.classList.contains("m2-editing")) V.put(m, true);
    hiddenSet(siteHidden().filter(function(id) {
      return all.indexOf(id) < 0;
    }));
    V.refreshMine();
  }
  function examplesToSite() {
    var tries = 0, post = ghPost;
    var go = function() {
      return api("/git/ref/heads/main").then(ghJson).then(function(ref) {
        return api("/git/commits/" + ref.object.sha).then(ghJson).then(function(c) {
          return api("/git/trees/" + c.tree.sha).then(ghJson).then(function(root) {
            var at2 = function(n) {
              return root.tree.filter(function(f) {
                return f.path === n && f.type === "tree";
              })[0];
            };
            if (!at2("examples")) throw new Error("this site keeps no example maps to restore");
            return Promise.all([
              api("/git/trees/" + at2("examples").sha + "?recursive=1").then(ghJson),
              at2("maps") ? api("/git/trees/" + at2("maps").sha + "?recursive=1").then(ghJson) : { tree: [] }
            ]);
          }).then(function(x) {
            if (x[0].truncated || x[1].truncated) throw new Error("the maps are too many to read at once");
            var blobs = x[0].tree.filter(function(f) {
              return f.type === "blob" && /^maps\//.test(f.path);
            });
            var ids = blobs.filter(function(f) {
              return /^maps\/[^/]+\.md$/.test(f.path);
            }).map(function(f) {
              return f.path.slice(5, -3);
            });
            if (!ids.length) throw new Error("the saved set is empty");
            var now = x[1].tree.filter(function(f) {
              return f.type === "blob";
            }), shaOf = {};
            now.forEach(function(f) {
              shaOf[f.path] = f.sha;
            });
            var saved = {};
            blobs.forEach(function(f) {
              saved[f.path.slice(5)] = f.sha;
            });
            var changed2 = ids.filter(function(id) {
              return shaOf[id + ".md"] && shaOf[id + ".md"] !== saved[id + ".md"];
            });
            return Promise.all(changed2.map(function(id) {
              return api("/git/blobs/" + shaOf[id + ".md"]).then(ghJson).then(function(b) {
                var md = textOf(b.content);
                return /^example:[ \t]*"?true"?[ \t]*\r?$/m.test(md) ? null : id;
              });
            })).then(function(taken) {
              taken = taken.filter(Boolean);
              var tree = [], twin = function(id) {
                return "sbgn-ml/" + twinOf(id) + ".sbgn";
              };
              var put2 = function(path, sha) {
                tree.push({ path: "maps/" + path, mode: "100644", type: "blob", sha });
              };
              taken.forEach(function(id) {
                var used = function(n) {
                  return now.some(function(f) {
                    return f.path.indexOf(n + ".") === 0 || f.path.indexOf("extra/" + n + "/") === 0 || f.path === twin(n) || f.path === "colours/" + n + ".json" || f.path === "colours/" + twinOf(n) + ".json" || f.path.indexOf(twinOf(n) + ".") === 0;
                  });
                };
                var k = 2, nid;
                do {
                  nid = id.replace(/(-graphml|-celldesigner)?$/, "-" + k++ + "$1");
                } while (used(nid));
                now.forEach(function(f) {
                  var to = f.path.indexOf(id + ".") === 0 ? nid + f.path.slice(id.length) : f.path.indexOf("extra/" + id + "/") === 0 ? "extra/" + nid + "/" + f.path.slice(id.length + 7).split(id).join(nid) : f.path === twin(id) ? twin(nid) : f.path === "colours/" + id + ".json" ? "colours/" + nid + ".json" : f.path === "colours/" + twinOf(id) + ".json" && /-graphml$/.test(id) ? "colours/" + twinOf(nid) + ".json" : null;
                  if (!to) return;
                  put2(to, f.sha);
                  if (!saved[f.path]) put2(f.path, null);
                });
              });
              blobs.forEach(function(f) {
                put2(f.path.slice(5), f.sha);
              });
              ids.forEach(function(id) {
                if (shaOf[twin(id)] && taken.indexOf(id) < 0) put2(twin(id), null);
              });
              var back2 = [], binRead = shaOf["deleted.json"] ? api("/git/blobs/" + shaOf["deleted.json"]).then(ghJson) : Promise.resolve(null);
              return binRead.then(function(b) {
                if (!b) return;
                var o = binFileRead(b), twins = ids.map(twinOf);
                Object.keys(o).forEach(function(id) {
                  if (/^external-/.test(id) || twins.indexOf(id) >= 0) {
                    delete o[id];
                    back2.push(id);
                  }
                });
                if (back2.length) tree.push({ path: BIN_FILE, mode: "100644", type: "blob", content: binFileText(o) });
              }).then(function() {
                return post("/git/trees", { base_tree: c.tree.sha, tree });
              }).then(function(t) {
                return post("/git/commits", { message: "Example maps restored in the viewer" + (taken.length ? "; kept as the reader's: " + taken.join(", ") : ""), tree: t.sha, parents: [ref.object.sha] });
              }).then(function(n) {
                return post("/git/refs/heads/main", { sha: n.sha }, "PATCH");
              }).then(function() {
                shared.ghDir = null;
                var before = {}, after2 = {};
                return Promise.all(tree.map(function(f) {
                  before[f.path] = shaOf[f.path.slice(5)] || null;
                  if (f.content == null) {
                    after2[f.path] = f.sha;
                    return null;
                  }
                  return blobSha(f.content).then(function(h) {
                    after2[f.path] = h;
                  });
                })).then(function() {
                  return { ids: ids.concat(back2), before, after: after2 };
                });
              });
            });
          });
        });
      }).catch(function(e) {
        if (e.status === 422 && ++tries < 3) return go();
        throw e;
      });
    };
    return go();
  }
  function newId() {
    return "mine-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  var making;
  function __run133() {
    making = false;
  }
  function newMap(group, fmt2) {
    if (making) return Promise.resolve();
    making = true;
    var F = fmt2 === "cd" ? "CellDesigner" : "SBGN-ML";
    var files = mineShown().map(function(r) {
      return r.file;
    });
    var title = "Unnamed map", file;
    var ext = fmt2 === "cd" ? ".xml" : ".sbgn", text;
    for (var k = 2; nameTaken(title, group, F); k++) title = "Unnamed map " + k;
    file = title.toLowerCase().replace(/ /g, "-") + ext;
    for (k = 2; files.indexOf(file) >= 0; k++) file = title.toLowerCase().replace(/ /g, "-") + "-" + k + ext;
    if (fmt2 !== "cd") text = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="' + NEW_ID + '" language="process description">\n  </map>\n</sbgn>\n';
    return mineIn.then(function() {
      return fmt2 === "cd" ? cdpy().then(function() {
        text = cdMk.empty({ id: "untitled" });
      }) : null;
    }).then(function() {
      return drawText(text);
    }).then(function(d) {
      var r = { id: newId(), title, file, text, svg: d.svg, width: d.width, height: d.height, at: Date.now(), src: textHash(text), hidden: false, group: group || "" };
      var up = repo() && token() ? toSite(title, ext, text, r.group, siteOrder(r.group)).then(function(s) {
        onSite(r, s, title);
      }, function() {
      }) : null;
      return Promise.resolve(up).then(function() {
        return minePut(r);
      }).then(function() {
        toFolder(r.id, r.file, r.text);
        V.refreshMine();
        V.go(r.id);
        var tries = 0;
        (function edit() {
          var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
          if (eb && eb.offsetParent && V.current && V.current.id === r.id) {
            if (V.win !== "edit") eb.click();
            return;
          }
          if (++tries < 100 && location.hash === "#" + r.id) setTimeout(edit, 50);
        })();
      });
    }).catch(function(e) {
      alert("The new map was not made: " + (e && e.message ? e.message : e));
    }).then(function() {
      making = false;
    });
  }
  var renamed;
  var NAMED_KEY;
  var nk;
  function __run143() {
    renamed = {};
    NAMED_KEY = "atlas-named:" + location.pathname;
    try {
      nk = JSON.parse(localStorage.getItem(NAMED_KEY) || "{}");
      Object.keys(nk).forEach(function(id) {
        renamed[id] = Object.assign({ local: true }, nk[id]);
      });
    } catch (e) {
    }
  }
  function namedSave() {
    var o = {};
    Object.keys(renamed).forEach(function(id) {
      if (renamed[id].local) o[id] = { was: renamed[id].was, to: renamed[id].to };
    });
    try {
      if (Object.keys(o).length) localStorage.setItem(NAMED_KEY, JSON.stringify(o));
      else localStorage.removeItem(NAMED_KEY);
    } catch (e) {
    }
  }
  function canDelete(m, gh2) {
    return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && (!mine[m.id].site || !!gh2) : !!gh2);
  }
  function canRename(m, gh2) {
    return !!m && !m.shownAs && (m.mine ? !!mine[m.id] && (!mine[m.id].site || !!gh2) : !!gh2 && !/^maps\/sbgn-ml\//.test(m.editPath || ""));
  }
  function siteNamed(list2) {
    return list2.map(function(m) {
      var n = renamed[m.id];
      if (!n) return m;
      if (m.topic === n.to && !V.pageBehind(m) || n.local && m.topic !== n.was) {
        delete renamed[m.id];
        if (n.local) namedSave();
        return m;
      }
      return m.topic === n.was ? Object.assign({}, m, { topic: n.to }) : m;
    });
  }
  function renameMap(id) {
    if (naming) naming(true);
    var m = V.byId[id], b = document.querySelector('#m2-list .m2-map[data-id="' + CSS.escape(id) + '"]');
    if (!m || !b || !canRename(m, repo() && token())) return;
    var shown2 = m.mine ? m.title : m.topic;
    inPlace(b, {
      cls: "m2-group-edit m2-map-edit" + (b.classList.contains("m2-sub") ? " m2-sub" : ""),
      max: 120,
      value: shown2,
      label: "Name of the map",
      bad: function(v) {
        return v && v !== shown2 && nameTaken(v, m.group, fmtOf(m), id, m.tab) ? "A map of this name and format is in this group already" : "";
      },
      end: function(v) {
        if (!v || v === shown2 || nameTaken(v, m.group, fmtOf(m), id, m.tab)) return;
        var site2 = m.mine && mine[id] ? mine[id].site : null;
        nameTo(m, v);
        listDid(function() {
          var c = listCur(id, site2);
          if (c) nameTo(c, shown2);
        }, function() {
          var c = listCur(id, site2);
          if (c) nameTo(c, v);
        });
      }
    });
  }
  function toSiteName(id, was, v) {
    var q = JSON.stringify(v.replace(/["\\]/g, ""));
    var n = renamed[id];
    return siteFront(id, { need: "topic", follow: true, set: { topic: q }, show: n ? { was: n.was, to: n.to } : { was, to: v } }, "Map renamed in the viewer");
  }
  function textHash(t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36) + "." + t.length;
  }
  function mineMatch(name2, text, h) {
    h = h || textHash(text);
    return Object.keys(mine).map(function(k) {
      return mine[k];
    }).filter(function(r) {
      return !r.site && r.file === name2 && (r.text === text || (r.src ? r.src === h : true));
    })[0] || null;
  }
  function mineAdd(name2, text, d, id, group) {
    var h = textHash(text), old = id ? mine[id] : mineMatch(name2, text, h);
    var back2 = !id && old && old.text !== text && old.src === h;
    var r = {
      id: old ? old.id : newId(),
      title: old ? old.title : freeTitle(name2.replace(/\.(graphml|xml|sbgn|nwt)$/i, ""), group || "", fmtOfText(text)),
      file: old ? old.file : name2,
      text: back2 ? old.text : text,
      svg: back2 ? old.svg : d.svg,
      width: back2 ? old.width : d.width,
      height: back2 ? old.height : d.height,
      at: back2 ? old.at : Date.now(),
      src: old ? old.src || (id ? void 0 : h) : h,
      hidden: false,
      group: group !== void 0 ? group : old && old.group || ""
    };
    if (old && old.site) ["site", "path", "sha", "saved", "siteTitle"].forEach(function(k) {
      r[k] = old[k];
    });
    if (old && old.from) r.from = old.from;
    return minePut(r).then(function() {
      return old && old.hidden ? folderMove(r.id, false) : null;
    }).then(function() {
      return r;
    });
  }
  var adding;
  var ADD_AFTER;
  function __run153() {
    adding = [], ADD_AFTER = 300;
  }
  function addPaint() {
    var box3 = document.getElementById("m2-list");
    if (!box3) return;
    Array.prototype.forEach.call(box3.querySelectorAll(".m2-item.m2-wait, .m2-pend-n"), function(x) {
      x.remove();
    });
    Array.prototype.forEach.call(box3.querySelectorAll(".m2-empty[hidden]"), function(x) {
      x.hidden = false;
    });
    adding = adding.filter(function(b) {
      return b.rows.length || b.done < b.n;
    });
    if (document.getElementById("m2-search").value.trim()) return;
    var count = {};
    adding.forEach(function(b) {
      if (b.shown && b.done < b.n) {
        var c = count[b.group] = count[b.group] || [0, 0];
        c[0] += b.done;
        c[1] += b.n;
      }
    });
    adding.forEach(function(b) {
      if (!b.shown) return;
      var g = b.group, head = g ? box3.querySelector('.m2-group:not(.m2-link-group)[data-group="' + CSS.escape(g) + '"]') : null;
      if (g && !head) return;
      if (head && count[g] && !head.querySelector(".m2-pend-n")) head.appendChild(Object.assign(document.createElement("span"), { className: "m2-pend-n", textContent: "adding " + count[g][0] + " of " + count[g][1] }));
      if (head && head.classList.contains("m2-shut")) return;
      var maps = box3.querySelectorAll('.m2-map:not(.m2-binned)[data-group="' + CSS.escape(g) + '"]' + (g ? "" : ".m2-mine"));
      var at2 = box3.querySelectorAll('.m2-wait[data-group="' + CSS.escape(g) + '"]'), empty = g && box3.querySelector('.m2-empty[data-group="' + CSS.escape(g) + '"]');
      at2 = at2.length ? at2[at2.length - 1] : maps.length ? maps[maps.length - 1] : empty || head;
      if (empty) empty.hidden = true;
      b.rows.forEach(function(r) {
        var row = document.createElement("div");
        row.className = "m2-item m2-wait" + (g ? " m2-sub" : "") + (r.why ? " m2-wait-bad" : "");
        row.setAttribute("data-group", g);
        row.title = r.why ? r.name + " was not added: " + r.why + " (click to dismiss)" : "Adding " + r.name;
        if (!r.why) row.appendChild(Object.assign(document.createElement("span"), { className: "m2-spin" }));
        row.appendChild(Object.assign(document.createElement("span"), { className: "m2-name", textContent: r.name.replace(/\.(graphml|xml|sbgn|nwt)$/i, "") }));
        if (r.why) {
          row.appendChild(Object.assign(document.createElement("span"), { className: "m2-wait-why", textContent: r.why }));
          row.addEventListener("click", function() {
            var i = b.rows.indexOf(r);
            if (i >= 0) b.rows.splice(i, 1);
            addPaint();
          });
        }
        if (at2) at2.after(row);
        else box3.insertBefore(row, box3.firstChild);
        at2 = row;
      });
    });
  }
  function addFiles(list2, group, proj) {
    list2 = Array.prototype.slice.call(list2);
    var picked = list2.filter(function(f) {
      return /\.(graphml|xml|sbgn|nwt)$/i.test(f.name) || !proj && /\.zip$/i.test(f.name);
    });
    if (!picked.length) return Promise.resolve();
    var gh2 = repo() && token(), last = null, top = null, out = [];
    var b = { group: group || "", rows: picked.map(function(f) {
      return { name: f.name, f };
    }), n: picked.length, done: 0, shown: false };
    adding.push(b);
    if (group && V.closed[group]) {
      delete V.closed[group];
      V.saveClosed();
    }
    var timer2 = setTimeout(function() {
      b.shown = true;
      V.refreshMine();
    }, ADD_AFTER);
    var rowOf = function(f) {
      return b.rows.filter(function(r) {
        return r.f === f;
      })[0];
    };
    var gone = function(f) {
      var r = rowOf(f);
      if (r) b.rows.splice(b.rows.indexOf(r), 1);
    };
    var why = function(f, e) {
      var r = rowOf(f), w = e && e.message ? e.message : String(e);
      if (r) r.why = w;
      else b.rows.push({ name: f.name, f, why: w });
    };
    return picked.reduce(function(p, f) {
      if (/\.zip$/i.test(f.name) && !f.zipPath) return p.then(function() {
        return openZip(f);
      }).then(function() {
        gone(f);
        b.done++;
      }, function(e) {
        why(f, e);
        b.done++;
      });
      return p.then(function() {
        return f.text();
      }).then(function(t) {
        var drawn = f.drawn ? Promise.resolve(f.drawn) : drawText(t, null, "adding");
        if (gh2) return drawn.then(function(d) {
          var ext = siteExt(t), title = freeTitle(f.name.replace(/\.(graphml|xml|sbgn|nwt)$/i, ""), group || "", fmtOfText(t), out.filter(function(o) {
            return fmtOfText(o.t) === fmtOfText(t);
          }).map(function(o) {
            return o.title;
          }));
          if (!ext) throw new Error(siteWhy(t));
          if (proj && ext !== ".xml") throw new Error("not a CellDesigner map");
          out.push({ f, d, t, ext, title });
          b.done++;
          if (b.shown) addPaint();
        });
        return drawn.then(function(d) {
          return mineAdd(f.name, t, d, proj ? newId() : null, group || void 0);
        }).then(function(r) {
          if (proj) proj.ids[f.zipPath] = r.id;
          if (proj && f.zipPath === proj.maps[0].path) top = r.id;
          last = r.id;
          gone(f);
          b.done++;
          if (b.shown) V.refreshMine();
          return toFolder(r.id, r.file, r.text).catch(function(e) {
            why(f, new Error("kept in this browser, not in the folder: " + (e && e.message ? e.message : e)));
          });
        });
      }).catch(function(e) {
        why(f, e);
        b.done++;
      });
    }, Promise.resolve()).then(function() {
      if (!out.length) return;
      var order = siteOrder(group);
      return toSiteMany(out.map(function(o) {
        return { title: o.title, ext: o.ext, text: o.t, group, order: order++ };
      }), proj && siteProject(proj, out.map(function(o) {
        return o.f.zipPath;
      }))).then(function(ss) {
        return out.reduce(function(p, o, i) {
          if (ss[i].err) {
            why(o.f, ss[i].err);
            return p;
          }
          var r = { id: newId(), title: o.title, file: o.f.name, text: o.t, svg: o.d.svg, width: o.d.width, height: o.d.height, at: Date.now(), hidden: false, group: group || "" };
          return p.then(function() {
            return minePut(onSite(r, ss[i], o.title));
          }).then(function() {
            last = r.id;
            if (proj && o.f.zipPath === proj.maps[0].path) top = r.id;
            gone(o.f);
          }, function(e) {
            why(o.f, e);
          });
        }, Promise.resolve());
      }).catch(function(e) {
        out.forEach(function(o) {
          if (rowOf(o.f) && !rowOf(o.f).why) why(o.f, e);
        });
      });
    }).then(function() {
      if (proj && !gh2) return keepProject(proj);
    }).then(fin, function(e) {
      b.rows.forEach(function(r) {
        if (!r.why) r.why = e && e.message ? e.message : String(e);
      });
      fin();
    });
    function fin() {
      clearTimeout(timer2);
      b.done = b.n;
      b.rows = b.rows.filter(function(r) {
        return r.why;
      });
      b.shown = b.rows.length > 0;
      if (proj && !last) mineGroupsSet(mineGroups().filter(function(x) {
        return x !== group;
      }));
      V.refreshMine();
      if (proj && !gh2) proj.maps.forEach(function(m) {
        if (proj.ids[m.path]) {
          V.placeMap(proj.ids[m.path], group);
          V.refreshMine();
        }
      });
      if (last) V.go(top || last);
      if (proj) {
        recsNow = null;
        projRecs();
      }
    }
  }
  function openZip(f) {
    var gh2 = repo() && token();
    return f.arrayBuffer().then(unzip).then(function(es) {
      var p = minervaProject(es);
      return settleGlyphs(p, gh2 ? siteGlyphs() : localGlyphs()).then(function() {
        Object.keys(p.glyphs).forEach(function(g) {
          held[g] = p.glyphs[g];
        });
        var files = p.maps.map(function(m) {
          var x = new File([m.text], m.path.split("/").pop(), { type: "text/xml" });
          x.zipPath = m.path;
          return x;
        });
        return files.reduce(function(q, x, i) {
          return q.then(function() {
            return drawText(p.maps[i].text, null, "adding");
          }).then(function(d) {
            x.drawn = d;
          }, function(e) {
            throw new Error("the map " + x.name.replace(/\.xml$/i, "") + " cannot be drawn: " + (e && e.message ? e.message : e));
          });
        }, Promise.resolve()).then(function() {
          var base = f.name.replace(/\.zip$/i, "").replace(/["\\]/g, "").trim() || "MINERVA project", g = base;
          for (var k = 2; !mineValid(g); k++) g = base + " " + k;
          mineGroupsSet([g].concat(mineGroups()));
          p.rec = "mz-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          p.zip = f.name;
          p.size = f.size;
          p.ids = {};
          return addFiles(files, g, p);
        });
      });
    });
  }
  function bytes64(d) {
    var s = "";
    for (var i = 0; i < d.length; i += 32768) s += String.fromCharCode.apply(null, d.subarray(i, i + 32768));
    return btoa(s);
  }
  function siteGlyphs() {
    var got = api("/contents/maps/glyphs?ref=main").then(function(r) {
      return r.status === 404 ? [] : ghJson(r);
    }).then(function(d) {
      var o = {};
      (Array.isArray(d) ? d : []).forEach(function(x) {
        o["glyphs/" + x.name] = x.sha;
      });
      return o;
    });
    return function(n) {
      return got.then(function(o) {
        return o[n] || null;
      });
    };
  }
  function folderGlyphs() {
    var dir = (V.folderName() ? folder() : Promise.resolve(null)).then(function(f) {
      return f && f.dir.getDirectoryHandle("glyphs");
    }).catch(function() {
      return null;
    });
    return function(n) {
      return dir.then(function(d) {
        return d && d.getFileHandle(n.slice(7));
      }).then(function(h) {
        return h && h.getFile();
      }).then(function(fl) {
        return fl && fl.arrayBuffer();
      }).then(function(a) {
        return a ? bytesSha(new Uint8Array(a)) : null;
      }).catch(function() {
        return null;
      });
    };
  }
  var held;
  var ghPics;
  var storedAll;
  function __run302() {
    held = {};
    ghPics = null;
    storedAll = null;
    recsNow = null;
    recIds = null;
    recErr = null;
    mgMemo = null;
    packing = false;
    try {
      packedGroups = JSON.parse(localStorage.getItem("atlas-minerva-groups") || "[]");
    } catch (e) {
      packedGroups = [];
    }
    if (!Array.isArray(packedGroups)) packedGroups = [];
    cdPicSource(picRead, function(t) {
      return glyphsNamed(t.replace(/&(lt|gt|quot|apos|amp);/g, function(m, e) {
        return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[e];
      }));
    }, picKeep);
    followed = {};
    picQ = Promise.resolve();
  }
  var followed;
  var picQ;
  function inTurn(fn) {
    var p = picQ.then(fn);
    picQ = p.catch(function() {
    });
    return p;
  }
  function picKeep(f) {
    return inTurn(function() {
      return keepNow(f);
    });
  }
  function keepNow(f) {
    return f.arrayBuffer().then(function(a) {
      var d = new Uint8Array(a), png = d.length > 8 && d[0] === 137 && d[1] === 80 && d[2] === 78 && d[3] === 71;
      var svg = !png && /<svg[\s>]/i.test(new TextDecoder().decode(d.subarray(0, 65536)));
      if (!png && !svg) throw new Error(f.name + " is not an image MINERVA can take here: PNG or SVG only");
      var stem2 = f.name.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "") || "image", ext = png ? ".png" : ".svg", other = png ? ".svg" : ".png";
      var gh2 = repo() && token(), look = gh2 ? siteGlyphs() : localGlyphs();
      return bytesSha(d).then(function(sha) {
        var free = function(k) {
          var s = "glyphs/" + (k < 2 ? stem2 : stem2 + "-" + k);
          return Promise.all([look(s + ext), look(s + other)]).then(function(r) {
            return (!r[0] || r[0] === sha) && !r[1] ? { s, there: r[0] === sha } : free(k < 2 ? 2 : k + 1);
          });
        };
        return free(1);
      }).then(function(n) {
        var file = n.s + ext;
        held[file] = d;
        return (n.there ? Promise.resolve() : picStore(file, d, gh2)).then(function() {
          return { note: n.s + ".png", file, type: png ? "image/png" : "image/svg+xml", bytes: d };
        });
      });
    });
  }
  function picStore(file, d, gh2) {
    if (gh2) {
      var at2 = "/contents/maps/" + file.split("/").map(encodeURIComponent).join("/");
      return api(at2 + "?ref=main").then(function(r) {
        if (r.ok) return;
        return api(at2, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Image: " + file, content: bytes64(d), branch: "main" }) }).then(ghJson);
      }).then(function() {
        ghPics = null;
      }, function(e) {
        throw new Error("the image was not kept on GitHub: " + (e && e.message ? e.message : e));
      });
    }
    var blob = new Blob([d]);
    var inBrowser = V.draftDo("readonly", function(st) {
      return st.get("minerva:mz-pictures");
    }, "folder").then(function(r) {
      r = r || { id: "mz-pictures", glyphs: {} };
      r.glyphs[file] = blob;
      r.at = Date.now();
      storedAll = null;
      return V.draftDo("readwrite", function(st) {
        return st.put(r, "minerva:mz-pictures");
      }, "folder");
    }).catch(function(e) {
      throw new Error("the image was not kept in this browser: " + (e && e.message ? e.message : e));
    });
    return inBrowser.then(function() {
      return picToFolder(file, d);
    });
  }
  function picToFolder(file, d) {
    if (!V.folderName()) return Promise.resolve();
    return folder().then(function(f) {
      if (!f) return;
      return f.dir.queryPermission({ mode: "readwrite" }).then(function(perm) {
        if (perm === "granted") return putIn(f.dir, file, d);
      });
    }).catch(function(e) {
      warn("The image " + file + " was not kept in the folder: " + (e && e.message ? e.message : e));
    });
  }
  function putIn(dir, path, data) {
    var parts = path.split("/"), name2 = parts.pop();
    return parts.reduce(function(q, x) {
      return q.then(function(d) {
        return d.getDirectoryHandle(x, { create: true });
      });
    }, Promise.resolve(dir)).then(function(d) {
      return d.getFileHandle(name2, { create: true });
    }).then(function(h) {
      return h.createWritable();
    }).then(function(w) {
      return w.write(data).then(function() {
        return w.close();
      });
    });
  }
  function picRead(n, quiet2) {
    var svg = n.replace(/\.png$/i, ".svg"), names = svg !== n ? [svg, n] : [n];
    return names.reduce(function(q, m) {
      return q.then(function(b) {
        return b || picFrom(m, quiet2);
      });
    }, Promise.resolve(null));
  }
  function picFrom(n, quiet2) {
    var follow2 = quiet2 ? function(x, b) {
      return b;
    } : followTo;
    var type = /\.svg$/i.test(n) ? "image/svg+xml" : "image/png", blob = function(d) {
      return d ? new Blob([d], { type }) : null;
    };
    if (Object.prototype.hasOwnProperty.call(held, n)) return Promise.resolve(blob(held[n]));
    var tok = repo() && token();
    if (tok && !ghPics) {
      ghPics = siteGlyphs();
      setTimeout(function() {
        ghPics = null;
      }, 6e4);
    }
    var fromGh = tok ? ghPics(n).then(function(sha) {
      return sha && api("/git/blobs/" + sha).then(ghJson).then(function(d) {
        return blob(Uint8Array.from(atob((d.content || "").replace(/\s/g, "")), function(c) {
          return c.charCodeAt(0);
        }));
      });
    }) : Promise.resolve(null);
    return fromGh.catch(function() {
      return null;
    }).then(function(b) {
      if (b) return b;
      return (V.folderName() && /^glyphs\/[^/]+$/.test(n) ? folder() : Promise.resolve(null)).then(function(f) {
        return f && f.dir.getDirectoryHandle("glyphs");
      }).then(function(d) {
        return d && d.getFileHandle(n.slice(7));
      }).then(function(h) {
        return h && h.getFile();
      }).then(function(fl) {
        return fl ? follow2(n, blob(fl), "folder") : null;
      }).catch(function() {
        return null;
      });
    }).then(function(b) {
      return b || storedPic(n).then(function(d) {
        return d && follow2(n, blob(d), "browser");
      }).catch(function() {
        return null;
      });
    });
  }
  function followTo(n, b, from) {
    var gh2 = repo() && token(), to = gh2 ? "gh" : V.folderName() && from === "browser" ? "folder" : null;
    if (to && !followed[n]) {
      followed[n] = 1;
      inTurn(function() {
        return b.arrayBuffer().then(function(a) {
          var d = new Uint8Array(a);
          return to === "gh" ? picStore(n, d, true) : picToFolder(n, d);
        });
      }).catch(function(e) {
        followed[n] = 0;
        warn("The image " + n + " did not follow its map: " + (e && e.message ? e.message : e));
      });
    }
    return b;
  }
  function localGlyphs() {
    var f = folderGlyphs();
    return function(n) {
      return f(n).then(function(s) {
        if (s) return s;
        if (Object.prototype.hasOwnProperty.call(held, n)) return bytesSha(held[n]);
        return storedPic(n).then(function(b) {
          return b && b.arrayBuffer().then(function(a) {
            return bytesSha(new Uint8Array(a));
          });
        });
      });
    };
  }
  function storedPic(n) {
    if (!storedAll) {
      storedAll = V.draftDo("readonly", function(st) {
        return st.getAll();
      }, "folder").catch(function() {
        return [];
      });
      setTimeout(function() {
        storedAll = null;
      }, 2e3);
    }
    return storedAll.then(function(all) {
      var r = (all || []).filter(function(x) {
        return x && /^mz-/.test(x.id || "") && x.glyphs && x.glyphs[n];
      })[0];
      return r ? r.glyphs[n] : null;
    });
  }
  function projectRecord(p, maps) {
    return JSON.stringify({ zip: p.zip, maps, glyphs: Object.keys(p.glyphs), kept: Object.keys(p.kept) }, null, 1) + "\n";
  }
  function siteProject(p, paths) {
    var at2 = "maps/minerva/" + p.rec + "/", files = [];
    Object.keys(p.glyphs).forEach(function(g) {
      files.push({ path: "maps/" + g, data: p.glyphs[g] });
    });
    Object.keys(p.kept).forEach(function(k) {
      files.push({ path: at2 + k, data: p.kept[k] });
    });
    return {
      blobs: function() {
        return files.reduce(function(q, x) {
          return q.then(function(out) {
            return ghPost("/git/blobs", { content: bytes64(x.data), encoding: "base64" }).then(function(b) {
              out.push({ path: x.path, mode: "100644", type: "blob", sha: b.sha });
              return out;
            });
          });
        }, Promise.resolve([]));
      },
      record: function(ids) {
        var maps = paths.map(function(pa, i) {
          p.ids[pa] = ids[i];
          return { id: ids[i], path: pa };
        });
        return { path: at2 + "record.json", mode: "100644", type: "blob", content: projectRecord(p, maps) };
      }
    };
  }
  function keepProject(p) {
    var maps = p.maps.filter(function(m) {
      return p.ids[m.path];
    }).map(function(m) {
      return { id: p.ids[m.path], path: m.path, file: mine[p.ids[m.path]].file };
    });
    if (!maps.length) return Promise.resolve();
    var blobs = function(o) {
      var r = {};
      Object.keys(o).forEach(function(k) {
        r[k] = new Blob([o[k]]);
      });
      return r;
    };
    var rec = { id: p.rec, zip: p.zip, size: p.size, maps, glyphs: blobs(p.glyphs), kept: blobs(p.kept), at: Date.now() };
    return V.draftDo("readwrite", function(st) {
      return st.put(rec, "minerva:" + rec.id);
    }, "folder").then(function() {
      storedAll = null;
    }).catch(function(e) {
      warn("The images of " + p.zip + " were not kept in this browser: " + (e && e.message ? e.message : e));
    }).then(function() {
      return folderProject(p, maps);
    });
  }
  function folderProject(p, maps) {
    if (!V.folderName()) return Promise.resolve();
    return folder().then(function(f) {
      if (!f) return;
      return f.dir.queryPermission({ mode: "readwrite" }).then(function(perm) {
        if (perm !== "granted") return;
        var at2 = ".viewer/minerva/" + p.rec + "/", all = Object.keys(p.glyphs).map(function(g) {
          return [g, p.glyphs[g]];
        }).concat(Object.keys(p.kept).map(function(k) {
          return [at2 + k, p.kept[k]];
        }), [[at2 + "record.json", projectRecord(p, maps)]]);
        return all.reduce(function(q, x) {
          return q.then(function() {
            return putIn(f.dir, x[0], x[1]);
          });
        }, Promise.resolve());
      });
    }).catch(function(e) {
      warn("The images of " + p.zip + " were not kept in the folder: " + (e && e.message ? e.message : e));
    });
  }
  function openZipFolder(file) {
    return V.draftDo("readonly", function(st) {
      return st.getAll();
    }, "folder").catch(function() {
      return [];
    }).then(function(all) {
      if ((all || []).some(function(r) {
        return r && /^mz-/.test(r.id || "") && r.zip === file.name && r.size === file.size;
      })) return;
      return addFiles([file], "");
    });
  }
  var recsNow;
  var recIds;
  var recErr;
  var mgMemo;
  var packing;
  var packedGroups;
  function projRecs() {
    if (recsNow) return recsNow;
    var gh2 = repo() && token();
    if (!gh2) recErr = null;
    var claimed = {};
    var asListed = function(x) {
      var c = mine[x.id];
      if (!c && x.file) {
        var k = Object.keys(mine).filter(function(i) {
          return mine[i].file === x.file && !claimed[i];
        })[0];
        c = k ? mine[k] : null;
      }
      if (c) claimed[c.id] = 1;
      return { id: c ? c.site || c.id : x.id, also: x.id, path: x.path };
    };
    var bytesOfBlob = function(b) {
      return function() {
        return b.arrayBuffer().then(function(a) {
          return new Uint8Array(a);
        });
      };
    };
    var fromGh = function() {
      var blobOf = function(sha) {
        return function() {
          return api("/git/blobs/" + sha).then(ghJson).then(function(d) {
            return Uint8Array.from(atob((d.content || "").replace(/\s/g, "")), function(c) {
              return c.charCodeAt(0);
            });
          });
        };
      };
      var under2 = function(sha, name2) {
        return api("/git/trees/" + sha).then(ghJson).then(function(t) {
          return (t.tree || []).filter(function(f) {
            return f.path === name2 && f.type === "tree";
          })[0] || null;
        });
      };
      return api("/git/ref/heads/main").then(ghJson).then(function(ref) {
        return api("/git/commits/" + ref.object.sha).then(ghJson);
      }).then(function(c) {
        return under2(c.tree.sha, "maps");
      }).then(function(m) {
        return m && under2(m.sha, "minerva");
      }).then(function(d) {
        return d ? api("/git/trees/" + d.sha + "?recursive=1").then(ghJson) : { tree: [] };
      }).then(function(tr) {
        if (tr.truncated) throw new Error("the records are too many to read at once");
        var recs = {};
        (tr.tree || []).forEach(function(x) {
          if (x.type !== "blob") return;
          var k = x.path.indexOf("/");
          if (k > 0) (recs[x.path.slice(0, k)] = recs[x.path.slice(0, k)] || {})[x.path.slice(k + 1)] = x.sha;
        });
        return Promise.all(Object.keys(recs).map(function(id) {
          var files = recs[id];
          if (!files["record.json"]) return null;
          return blobOf(files["record.json"])().then(function(d) {
            var r = JSON.parse(new TextDecoder().decode(d)), kept = {};
            (r.kept || []).forEach(function(k) {
              if (files[k]) kept[k] = blobOf(files[k]);
            });
            return { id, maps: r.maps || [], kept };
          }).catch(function() {
            return null;
          });
        }));
      });
    };
    var fromBrowser = function() {
      return V.draftDo("readonly", function(st) {
        return st.getAll();
      }, "folder").then(function(all) {
        return (all || []).filter(function(r) {
          return r && /^mz-/.test(r.id || "") && Array.isArray(r.maps);
        }).map(function(r) {
          var kept = {};
          Object.keys(r.kept || {}).forEach(function(k) {
            kept[k] = bytesOfBlob(r.kept[k]);
          });
          return { id: r.id, maps: r.maps.map(asListed), kept };
        });
      }).catch(function() {
        return [];
      });
    };
    var fromFolder = function() {
      if (!V.folderName()) return Promise.resolve([]);
      var file = function(d, path) {
        return path.split("/").slice(0, -1).reduce(function(q, x) {
          return q.then(function(h) {
            return h.getDirectoryHandle(x);
          });
        }, Promise.resolve(d)).then(function(h) {
          return h.getFileHandle(path.split("/").pop());
        }).then(function(h) {
          return h.getFile();
        });
      };
      return folder().then(function(f) {
        return f && f.dir.getDirectoryHandle(".viewer").then(function(v) {
          return v.getDirectoryHandle("minerva");
        });
      }).then(function(m) {
        if (!m) return [];
        var it = m.values(), out = [];
        return function next() {
          return it.next().then(function(x) {
            if (x.done) return out;
            if (x.value.kind === "directory") out.push(x.value);
            return next();
          });
        }().then(function(ds) {
          return Promise.all(ds.map(function(d) {
            return file(d, "record.json").then(function(fl) {
              return fl.text();
            }).then(function(tx2) {
              var r = JSON.parse(tx2), kept = {};
              (r.kept || []).forEach(function(k) {
                kept[k] = function() {
                  return file(d, k).then(function(fl) {
                    return fl.arrayBuffer();
                  }).then(function(a) {
                    return new Uint8Array(a);
                  });
                };
              });
              return { id: d.name, maps: (r.maps || []).map(asListed), kept };
            }).catch(function() {
              return null;
            });
          }));
        });
      }).catch(function() {
        return [];
      });
    };
    var got = Promise.all([gh2 ? fromGh().then(function(l) {
      recErr = null;
      return l;
    }, function(e) {
      recErr = e;
      return [];
    }) : Promise.resolve([]), fromBrowser(), fromFolder()]);
    recsNow = got.then(function(ls) {
      var seen = {}, l = [];
      ls.forEach(function(x) {
        (x || []).filter(Boolean).forEach(function(r) {
          if (!seen[r.id]) {
            seen[r.id] = 1;
            l.push(r);
          }
        });
      });
      recIds = {};
      l.forEach(function(r) {
        r.maps.forEach(function(m) {
          recIds[m.id] = r;
          if (m.also) recIds[m.also] = r;
        });
      });
      mgMemo = null;
      V.refreshMine();
      if (recErr) recsNow = null;
      return l;
    });
    setTimeout(function() {
      recsNow = null;
    }, 6e4);
    return recsNow;
  }
  function sameMap(x, m) {
    return x.id === m.id || x.also === m.id || !!mine[m.id] && !!mine[m.id].site && mine[m.id].site === x.id;
  }
  function recOf(m) {
    return recIds && (recIds[m.id] || mine[m.id] && mine[m.id].site && recIds[mine[m.id].site]) || null;
  }
  function packedSaved() {
    try {
      localStorage.setItem("atlas-minerva-groups", JSON.stringify(packedGroups));
    } catch (e) {
    }
  }
  function minervaGroup(g) {
    if (!g) return false;
    memoNow();
    if (!(g in mgMemo.g)) mgMemo.g[g] = packedGroups.indexOf(g) >= 0 || inGroup(g).some(function(m) {
      return recOf(m) || m.mine && mine[m.id] && /Glyph:/.test(mine[m.id].text || "");
    });
    return mgMemo.g[g];
  }
  function cdOf(m) {
    return m.mine ? !!mine[m.id] && isCd(mine[m.id].text) : fmtOf(m) === "CellDesigner";
  }
  function memoNow() {
    if (!mgMemo || mgMemo.maps !== V.maps) mgMemo = { maps: V.maps, g: /* @__PURE__ */ Object.create(null), first: /* @__PURE__ */ Object.create(null) };
  }
  function firstOf(g) {
    memoNow();
    if (!(g in mgMemo.first)) mgMemo.first[g] = inGroup(g)[0] || null;
    return mgMemo.first[g];
  }
  function isTop(m) {
    return !!m && !m.binned && !!m.group && !!recIds && firstOf(m.group) === m && minervaGroup(m.group);
  }
  function canTop(m) {
    return !!m && !m.binned && !!m.group && !!recIds && firstOf(m.group) !== m && minervaGroup(m.group) && movable(m);
  }
  function zipPath(m, rec, top) {
    var at2 = rec && rec.maps.filter(function(x) {
      return sameMap(x, m);
    })[0];
    var base = at2 ? at2.path.split("/").pop() : m.mine && mine[m.id] && mine[m.id].file ? mine[m.id].file.replace(/\.[^.]*$/, "") + ".xml" : bare(mapName(m)).replace(/[\/\\:*?"<>|]+/g, "-") + ".xml";
    return top ? base : "submaps/" + base;
  }
  function toPng(src2, px) {
    return new Promise(function(ok, no2) {
      var c = document.createElement("canvas");
      c.width = px[0];
      c.height = px[1];
      var g = c.getContext("2d");
      if (!g) return no2(new Error("too large for this browser to draw"));
      g.drawImage(src2, 0, 0, px[0], px[1]);
      c.toBlob(function(b) {
        if (!b) return no2(new Error("too large for this browser to draw"));
        b.arrayBuffer().then(function(a) {
          ok(new Uint8Array(a));
        });
      }, "image/png");
    });
  }
  function svgSize(s) {
    var n = function(a) {
      var v = s && s.getAttribute(a) || "";
      return /%/.test(v) ? 0 : parseFloat(v) || 0;
    }, vb = (s && s.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    return n("width") && n("height") ? [n("width"), n("height")] : vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? [vb[2], vb[3]] : [300, 150];
  }
  function svgPng(blob, px) {
    return blob.text().then(function(t) {
      var doc2 = new DOMParser().parseFromString(t, "image/svg+xml"), s = doc2.documentElement;
      if (!s || s.localName !== "svg" || doc2.getElementsByTagName("parsererror").length) throw new Error("not an SVG that can be read");
      if (!s.getAttribute("viewBox")) s.setAttribute("viewBox", "0 0 " + svgSize(s).join(" "));
      s.setAttribute("width", px[0]);
      s.setAttribute("height", px[1]);
      s.setAttribute("preserveAspectRatio", "none");
      var u = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc2)], { type: "image/svg+xml" }));
      return new Promise(function(ok, no2) {
        var im = new Image();
        im.onload = function() {
          toPng(im, px).then(ok, no2);
        };
        im.onerror = function() {
          no2(new Error("not an SVG this browser can draw"));
        };
        im.src = u;
      }).then(function(d) {
        URL.revokeObjectURL(u);
        return d;
      }, function(e) {
        URL.revokeObjectURL(u);
        throw e;
      });
    });
  }
  function pngFitted(d, px) {
    return createImageBitmap(new Blob([d], { type: "image/png" })).then(function(bm) {
      return toPng(bm, px).then(function(x) {
        bm.close();
        return x;
      });
    }, function() {
      throw new Error("not a PNG this browser can read");
    });
  }
  function packItem(label, go) {
    return packing ? ["Making the MINERVA zip...", go, true] : [label, go];
  }
  function packZip(ms, whole, name2) {
    if (packing) return;
    packing = true;
    storedAll = null;
    var said = [], fitted = [];
    ms = ms.filter(function(m) {
      return m && !m.binned;
    });
    var g = ms[0] && ms[0].group, first = g ? inGroup(g)[0] : null;
    if (first && ms.indexOf(first) > 0) ms = [first].concat(ms.filter(function(m) {
      return m !== first;
    }));
    return projRecs().then(function() {
      if (recErr) throw new Error("the projects' records could not be read from GitHub (" + (recErr.message || recErr) + "): try again in a moment");
      return Promise.all(ms.map(function(m) {
        return textNow(m);
      }));
    }).then(function(texts) {
      var taken = { "submaps/mapping.xml": 1 }, renamed2 = [];
      var maps = ms.map(function(m, i) {
        var p0 = zipPath(m, recOf(m), i === 0), p = p0;
        for (var k = 2; taken[p.toLowerCase()]; k++) p = p0.replace(/\.xml$/i, "") + "-" + k + ".xml";
        taken[p.toLowerCase()] = 1;
        if (p !== p0) renamed2.push(p);
        return { m, text: texts[i], title: mapName(m), path: p };
      });
      if (renamed2.length) said.push("Maps of a name taken numbered in the zip: " + renamed2.join(", ") + " (MINERVA names a submap by it).");
      var top = recOf(ms[0]) || ms.map(recOf).filter(Boolean)[0] || null;
      var plan = packPlan(maps), kept = {}, missing = [];
      var others = ms.map(recOf).filter(function(r, i, a) {
        return r && r !== top && a.indexOf(r) === i;
      });
      if (whole && top) {
        kept = top.kept;
        missing = top.maps.filter(function(x) {
          return !ms.some(function(m) {
            return sameMap(x, m);
          });
        }).map(function(x) {
          return x.path;
        });
        if (others.length && others.some(function(r) {
          return Object.keys(r.kept).length;
        })) said.push("The other files of the maps from another zip were left out (only the top level's project keeps its links).");
      } else if (ms.some(function(m) {
        var r = recOf(m);
        return r && Object.keys(r.kept).length;
      })) said.push("The project's other files (its links between maps) were left out: they go back only when the whole group is packed.");
      var keptNames = Object.keys(kept);
      return keptNames.reduce(function(q, k) {
        return q.then(function(o) {
          return kept[k]().then(function(d) {
            o[k] = d;
            return o;
          });
        });
      }, Promise.resolve({})).then(function(keptBytes) {
        var linked = keptGlyphs(keptBytes), pics = {};
        var named = plan.map(function(n) {
          return n.name;
        });
        return named.concat(linked.filter(function(x) {
          return named.indexOf(x) < 0;
        })).reduce(function(q, gname) {
          return q.then(function() {
            return picRead(gname, true);
          }).then(function(b) {
            var n = plan.filter(function(x) {
              return x.name === gname;
            })[0];
            if (!b) {
              if (n) throw new Error(gname + " is named in " + n.maps.join(", ") + " but was not found where the maps are kept, or could not be read");
              return;
            }
            if (/svg/.test(b.type)) {
              var box3 = n && n.box || null;
              return (box3 ? Promise.resolve(svgPixels(box3)) : b.text().then(function(t) {
                return svgPixels(svgSize(new DOMParser().parseFromString(t, "image/svg+xml").documentElement));
              })).then(function(px) {
                return svgPng(b, px);
              }).then(
                function(d) {
                  pics[gname] = d;
                  if (n && n.mixed) said.push(gname + " is on boxes of different proportions: its PNG was made for the first.");
                },
                function(e) {
                  throw new Error(gname + " could not be made into a PNG: " + e.message);
                }
              );
            }
            return b.arrayBuffer().then(function(a) {
              var d = new Uint8Array(a), sz = pngSize(d), px = sz && n && n.box ? fitPixels(sz, n.box) : null;
              if (!sz) throw new Error(gname + " is not a PNG");
              if (n && n.mixed) said.push(gname + " is on boxes of different proportions: its PNG was made for the first.");
              if (!px) {
                pics[gname] = d;
                return;
              }
              return pngFitted(d, px).then(function(x) {
                pics[gname] = x;
                fitted.push(gname.replace(/^glyphs\//, ""));
              }, function(e) {
                throw new Error(gname + " could not be fitted to its box: " + e.message);
              });
            });
          });
        }, Promise.resolve()).then(function() {
          Object.keys(pics).forEach(function(x) {
            if (pics[x].length > 5 * 1048576) said.push(x + " is " + (pics[x].length / 1048576).toFixed(1) + " MB: MINERVA takes it in a zip, but its own editor refuses an image over 5 MB.");
          });
          var e = packEntries(maps.map(function(x) {
            return { path: x.path, text: x.text };
          }), pics, keptBytes, missing);
          if (fitted.length) said.push(fitted.length + " image" + (fitted.length > 1 ? "s" : "") + " made in the proportions of " + (fitted.length > 1 ? "their boxes" : "its box") + ", as here (MINERVA keeps an image's own): " + fitted.join(", ") + ".");
          if (e.z.length) said.push("Z-Index of the compartments with images set from what holds what in: " + e.z.join(", ") + ".");
          if (e.gone.length) said.push("Links to maps no longer in the group left out: " + e.gone.join(", ") + ".");
          return zip(e.entries);
        });
      });
    }).then(function(bytes) {
      var u = URL.createObjectURL(new Blob([bytes], { type: "application/zip" })), a = document.createElement("a");
      a.href = u;
      a.download = (bare(name2) || "MINERVA project").replace(/[\/\\:*?"<>|]+/g, "-") + ".zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function() {
        URL.revokeObjectURL(u);
      }, 1e4);
      packing = false;
      if (g && packedGroups.indexOf(g) < 0 && whole) {
        packedGroups.push(g);
        packedSaved();
        mgMemo = null;
        V.refreshMine();
      }
      if (said.length) alert("Downloaded as a MINERVA zip.\n\n" + said.join("\n"));
    }, function(e) {
      packing = false;
      alert("Not downloaded as a MINERVA zip: " + (e && e.message ? e.message : e));
    }).catch(function(e) {
      packing = false;
      warn("After the MINERVA zip: " + (e && e.message ? e.message : e));
    });
  }
  var picker;
  function __run163() {
    picker = document.createElement("input");
    picker.type = "file";
    picker.multiple = true;
    picker.accept = ".graphml,.xml,.sbgn,.nwt,.zip";
    picker.hidden = true;
    picker.addEventListener("change", function() {
      var l = Array.prototype.slice.call(picker.files), to = addTo;
      listMade(function() {
        return addFiles(l, to);
      });
      picker.value = "";
    });
    document.body.appendChild(picker);
    document.addEventListener("dragover", function(e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) e.preventDefault();
    });
    document.addEventListener("drop", function(e) {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var t = e.target.closest && e.target.closest("#m2-list [data-group]"), g = t && t.dataset.group;
      var l = Array.prototype.slice.call(e.dataTransfer.files);
      listMade(function() {
        return addFiles(l, ownGroup(g) ? g : "");
      });
    });
  }
  function siteExt(t) {
    return isCd(t) ? ".xml" : isSb(t) ? ".sbgn" : /yworks\.com/.test(t.slice(0, 5e3)) ? ".graphml" : null;
  }
  function siteWhy(t) {
    return t && noLayout(t) || "not a yEd GraphML, CellDesigner or SBGN-ML file";
  }
  function onSite(r, s, title) {
    r.site = s.id;
    r.path = s.path;
    r.sha = s.sha;
    r.saved = s.text;
    r.siteTitle = title;
    return r;
  }
  var BULK;
  function __run172() {
    BULK = 2e7;
  }
  function toSiteMany(items2, extra) {
    if (!(repo() && token())) return Promise.reject(new Error("not connected to GitHub"));
    var j = ghJson, post = ghPost, used = {}, more = extra ? extra.blobs() : Promise.resolve(null);
    more.catch(function() {
    });
    var slugOf = function(base) {
      return (base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "map").replace(/-(sbgn|sbgnml)$|^external-/, function(x) {
        return x === "external-" ? "map-external-" : x + "-map";
      });
    };
    var mdOf = function(base, it) {
      return "---\ntitle: " + JSON.stringify(base) + "\ntopic: " + JSON.stringify(base) + "\ngroup: " + JSON.stringify(it.group || "") + "\norder: " + (it.order | 0) + "\n---\n";
    };
    var halves = function(part) {
      var h = Math.ceil(part.length / 2);
      return send(part.slice(0, h)).then(function(a) {
        return send(part.slice(h)).then(function(b) {
          return a.concat(b);
        });
      });
    };
    var send = function(part) {
      if (!extra && part.length > 1 && part.reduce(function(n, it) {
        return n + it.text.length;
      }, 0) > BULK) return halves(part);
      var tries = 0, texts = extra ? part.reduce(function(q, it) {
        return q.then(function(out) {
          return post("/git/blobs", { content: it.text, encoding: "utf-8" }).then(function(b) {
            out.push(b.sha);
            return out;
          });
        });
      }, Promise.resolve([])) : Promise.resolve(null);
      texts.catch(function() {
      });
      var go = function() {
        var ids;
        return api("/contents/maps?ref=main").then(j).then(function(d) {
          var taken = Object.assign({}, used);
          d.forEach(function(f) {
            taken[f.name.replace(/\.[^.]+$/, "")] = 1;
          });
          ids = part.map(function(it) {
            var s = slugOf(it.title), id = s;
            for (var k = 2; taken[id]; k++) id = s + "-" + k;
            taken[id] = 1;
            return id;
          });
          return api("/git/ref/heads/main").then(j);
        }).then(function(ref) {
          return Promise.all([api("/git/commits/" + ref.object.sha).then(j), more, texts]).then(function(cm) {
            var c = cm[0], t = cm[1] ? cm[1].concat([extra.record(ids)]) : [];
            part.forEach(function(it, i) {
              var base = it.title.replace(/["\\]/g, "");
              t.push(Object.assign({ path: "maps/" + ids[i] + it.ext, mode: "100644", type: "blob" }, cm[2] ? { sha: cm[2][i] } : { content: it.text }), { path: "maps/" + ids[i] + ".md", mode: "100644", type: "blob", content: mdOf(base, it) });
            });
            return post("/git/trees", { base_tree: c.tree.sha, tree: t }).catch(function(e) {
              e.tree = true;
              throw e;
            });
          }).then(function(t) {
            return post("/git/commits", { message: part.length === 1 ? "Map added in the viewer: " + ids[0] + part[0].ext : part.length + " maps added in the viewer", tree: t.sha, parents: [ref.object.sha] });
          }).then(function(c) {
            return post("/git/refs/heads/main", { sha: c.sha }, "PATCH");
          });
        }).then(function() {
          return ids;
        }).catch(function(e) {
          if (e.tree && !extra && part.length > 1 && e.status !== 401 && e.status !== 403) throw Object.assign(e, { split: true });
          if (e.status === 422 && ++tries < 3) return go();
          throw e;
        });
      };
      return Promise.all(part.map(function(it) {
        return blobSha(it.text);
      })).then(function(shas) {
        return go().then(function(ids) {
          shared.ghDir = null;
          return ids.map(function(id, i) {
            used[id] = 1;
            delete hiddenGone[id];
            binClear(id);
            return { id, path: "maps/" + id + part[i].ext, sha: shas[i], text: part[i].text };
          });
        }, function(e) {
          return e.split ? halves(part) : part.map(function() {
            return { err: e };
          });
        });
      });
    };
    return send(items2);
  }
  function toSite(title, ext, text, group, order) {
    return toSiteMany([{ title, ext, text, group, order }]).then(function(a) {
      if (a[0].err) throw a[0].err;
      return a[0];
    });
  }
  var upping;
  function __run182() {
    upping = {};
  }
  function oneAtATime(f) {
    return navigator.locks && navigator.locks.request ? navigator.locks.request("atlas-own-to-site", f) : f();
  }
  function upOne(id) {
    if (upping[id]) return upping[id];
    var p = upping[id] = oneAtATime(function() {
      return V.draftDo("readonly", function(st) {
        return st.get(id);
      }, "mine").then(function(stored) {
        if (stored && stored.site && mine[id] && !mine[id].site) mine[id] = Object.assign({}, mine[id], ["site", "path", "sha", "saved", "siteTitle"].reduce(function(o, k) {
          o[k] = stored[k];
          return o;
        }, {}));
        var r = mine[id];
        if (!r || r.hidden || r.from) return null;
        if (r.site) return r;
        var ext = siteExt(r.text), title = r.title.replace(/\.(graphml|xml|sbgn|nwt)$/i, "");
        if (!ext) throw new Error(siteWhy(r.text));
        return toSite(title, ext, r.text, r.group || "", siteOrder(r.group || "")).then(function(s) {
          if (!mine[id]) return null;
          var n = onSite(Object.assign({}, mine[id]), s, title);
          if (n.hidden) siteBin(s.id, true).catch(function() {
          });
          if (n.title !== title) {
            renamed[s.id] = { was: title, to: n.title };
            toSiteName(s.id, title, n.title).catch(function() {
              delete renamed[s.id];
            });
          }
          return minePut(n).then(function() {
            return n;
          });
        });
      });
    });
    p.then(function() {
      delete upping[id];
    }, function() {
      delete upping[id];
    });
    return p;
  }
  function savedMine(s, t, took) {
    var r = mine[s.id];
    if (r && r.site) minePut(Object.assign({}, r, { sha: s.sha, saved: t }, took ? { text: t } : {})).catch(function() {
    });
  }
  function toGh(s) {
    if (!mine[s.id]) return Promise.resolve();
    return upOne(s.id).then(function(n) {
      delete mineStuck[s.id];
      if (!n || !n.path) return;
      if (site !== s || !on || !(repo() && token())) {
        if (n.text !== n.saved) upAll();
        return;
      }
      s.pending = false;
      s.path = n.path;
      s.sha = n.sha;
      s.saved = n.saved;
      localBox();
      V.refreshMine();
      if (src() !== n.saved) {
        shared.dirty = true;
        changed();
      }
    }, function(e) {
      var why = whyFailed(e);
      if (why !== "other") {
        mineStuck[s.id] = 1;
        sendFailed(why);
      } else if (site === s) warn("Not on GitHub: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ". This map is kept in this browser only; it is sent again after the next change.");
    });
  }
  var upRun;
  function __run192() {
    upRun = null;
  }
  function upAll() {
    if (!(repo() && token())) return Promise.resolve();
    if (upRun) return upRun;
    var went = [], failed = [], stuck2 = null, fail = function(r) {
      return function(e) {
        var why = whyFailed(e);
        if (why !== "other") {
          mineStuck[r.id] = 1;
          stuck2 = why;
        } else failed.push(r.title + " (" + (e && e.message ? e.message : e) + ")");
      };
    };
    var sent = function(r) {
      return function() {
        delete mineStuck[r.id];
        went.push(r.title);
      };
    };
    var listIn = function(n) {
      return V.siteList || !n ? Promise.resolve() : new Promise(function(res) {
        setTimeout(res, 500);
      }).then(function() {
        return listIn(n - 1);
      });
    };
    return upRun = mineIn.then(moveBack).then(function() {
      return listIn(60);
    }).then(function() {
      return Object.keys(mine).reduce(function(q, id) {
        return q.then(function() {
          var r = mine[id];
          if (!r || r.hidden || r.from || on && site && site.id === id) return;
          if (!r.site) return upOne(id).then(function(n) {
            if (n) sent(r)();
          }, fail(r));
          if (r.path && r.saved != null && r.text !== r.saved) return putMine(r).then(sent(r), fail(r));
          delete mineStuck[id];
        });
      }, Promise.resolve());
    }).then(function() {
      upRun = null;
      if (went.length || failed.length) V.refreshMine();
      if (stuck2) sendFailed(stuck2);
      if (failed.length) warn("Not on GitHub, kept in this browser only: " + failed.join(", ") + ".");
      else if (went.length && !stuck2) note();
    });
  }
  function putMine(r) {
    var t = r.text, learn = function(sha) {
      var n = mine[r.id];
      if (n) return minePut(Object.assign({}, n, { sha, saved: t }));
    };
    return api("/contents/" + r.path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Moved in the viewer: " + r.path.split("/").pop(), content: b64(t), sha: r.sha || void 0, branch: "main" })
    }).then(function(q) {
      if (q.ok) return q.json().then(function(d) {
        return learn(d.content.sha);
      });
      if (q.status !== 409 && q.status !== 422) throw ghErr(q.status);
      return Promise.all([
        api("/contents/" + r.path + "?ref=main").then(function(x) {
          return x.json();
        }),
        api("/contents/" + r.path + "?ref=main", { headers: { Accept: "application/vnd.github.raw" } }).then(function(x) {
          return x.text();
        })
      ]).then(function(f) {
        if (f[1] !== t) throw new Error("changed on GitHub since");
        return learn(f[0].sha);
      });
    });
  }
  function movedSites() {
    var o = {};
    Object.keys(mine).forEach(function(k) {
      var r = mine[k];
      if (r.from) o[r.from.site] = k;
    });
    return o;
  }
  function toMove() {
    var wait = Object.keys(mine).map(function(k) {
      return mine[k];
    }).filter(function(r) {
      return r.site && !r.hidden && !r.from;
    });
    return (V.maps || []).filter(function(m) {
      return !m.mine && !m.binned && !m.shownAs && graphmlOf(m) && formatOfMap(m);
    }).concat(wait);
  }
  function ghRaw(path) {
    return api("/contents/" + path + "?ref=main", { headers: { Accept: "application/vnd.github.raw" } }).then(function(r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("GitHub " + r.status);
      return r.text().then(function(t) {
        return blobSha(t).then(function(sha) {
          return { text: t, sha };
        });
      });
    });
  }
  function writeBack(dir, name2, t) {
    return dir.getFileHandle(name2).then(function(h) {
      return h.getFile().then(function(fl) {
        return fl.text();
      });
    }, function() {
      return null;
    }).then(function(old) {
      return old === null || old === t ? name2 : freeName(dir, name2, 2);
    }).then(function(nm) {
      var h;
      return dir.getFileHandle(nm, { create: true }).then(function(x) {
        h = x;
        return h.createWritable();
      }).then(function(w) {
        return w.write(t).then(function() {
          return w.close();
        });
      }).then(function() {
        return h.getFile();
      }).then(function(fl) {
        return fl.text().then(function(back2) {
          if (back2 !== t) throw new Error(nm + " did not read back as written");
          return { name: nm, mod: fl.lastModified, size: fl.size };
        });
      });
    });
  }
  function moveOut(dir, say) {
    var maps = toMove(), made2 = [], ids = {}, cols = {};
    return mineIn.then(function() {
      return folder();
    }).then(function(f) {
      return f && f.dir.isSameEntry(dir).then(function(same2) {
        return same2;
      }, function() {
        return false;
      });
    }).then(function(same2) {
      return same2 ? null : folderSet(dir);
    }).then(function() {
      return api("/contents/maps/colours?ref=main").then(function(r) {
        return r.status === 404 ? [] : ghJson(r);
      }).then(function(l) {
        (Array.isArray(l) ? l : []).forEach(function(x) {
          cols[x.name] = x.sha;
        });
      });
    }).then(function() {
      return maps.reduce(function(q, m, i) {
        return q.then(function() {
          var w0 = m.site !== void 0 && mine[m.id] === m, sid = w0 ? m.site : m.id, title = w0 ? m.title : mapName(m), group = (w0 ? m.group : m.group) || "";
          say("Copying " + (i + 1) + " of " + maps.length + ": " + title);
          var url = w0 ? null : graphmlOf(m), F = w0 ? null : formatOfMap(m), path = w0 ? m.path : "maps/" + url.split("?")[0].split("/").pop();
          if (F && F.ahead && F.ahead.path) path = F.ahead.path(m);
          var file = path.split("/").pop();
          return (w0 ? Promise.resolve({ text: m.saved != null ? m.saved : m.text, sha: m.sha || null }) : ghRaw(path).then(function(g) {
            return g || fetch(url, { cache: "no-cache" }).then(function(r) {
              if (!r.ok) throw new Error(title + ": " + r.status);
              return r.text();
            }).then(function(t) {
              return { text: t, sha: null };
            });
          })).then(function(g) {
            var dr = !w0 && V.drafts[m.id], t = w0 ? m.text : dr && dr.text ? dr.text : g.text;
            return writeBack(dir, file, t).then(function(w) {
              return drawText(t).then(function(d) {
                var r = {
                  id: newId(),
                  title,
                  file: w.name,
                  text: t,
                  svg: d.svg,
                  width: d.width,
                  height: d.height,
                  at: Date.now(),
                  src: textHash(t),
                  hidden: false,
                  group,
                  from: { site: sid, path, sha: g.sha, saved: g.text, title: w0 ? m.siteTitle || title : title, group }
                };
                return minePut(r).then(function() {
                  made2.push(r.id);
                  ids[sid] = r.id;
                  return folderFile(r.id, w);
                }).then(function() {
                  if (!cols[sid + ".json"]) return;
                  return ghRaw("maps/colours/" + sid + ".json").then(function(c) {
                    if (!c) return;
                    r.from.cols = c.text;
                    r.from.colSha = c.sha;
                    return minePut(r).then(folder).then(function(f) {
                      return origWrite(f, w.name, JSON.parse(c.text));
                    });
                  }).catch(function(e) {
                    throw new Error(title + "\u2019s own colours: " + (e && e.message ? e.message : e));
                  });
                });
              });
            });
          });
        });
      }, Promise.resolve());
    }).then(function() {
      return api("/contents/maps/glyphs?ref=main").then(function(r) {
        return r.status === 404 ? [] : ghJson(r);
      }).then(function(list2) {
        return (Array.isArray(list2) ? list2 : []).filter(function(x) {
          return x.type === "file";
        }).reduce(function(q, x) {
          return q.then(function() {
            say("Copying the pictures: " + x.name);
            return api("/contents/maps/glyphs/" + encodeURIComponent(x.name) + "?ref=main", { headers: { Accept: "application/vnd.github.raw" } }).then(function(r) {
              if (!r.ok) throw new Error("picture " + x.name + ": GitHub " + r.status);
              return r.arrayBuffer();
            }).then(function(a) {
              return putIn(dir, "glyphs/" + x.name, a).then(function() {
                return dir.getDirectoryHandle("glyphs");
              }).then(function(g) {
                return g.getFileHandle(x.name);
              }).then(function(h) {
                return h.getFile();
              }).then(function(fl) {
                if (fl.size !== a.byteLength) throw new Error("picture " + x.name + " did not read back as written");
              });
            });
          });
        }, Promise.resolve());
      });
    }).then(function() {
      if (made2.length !== maps.length) throw new Error(made2.length + " of " + maps.length + " maps copied");
      maps.forEach(function(m) {
        if (m.site !== void 0 && mine[m.id] === m) dropCopy(m.id);
      });
      V.refreshMine();
      return { n: made2.length, dir, ids };
    }, function(e) {
      return Promise.all(made2.map(function(k) {
        return dropCopy(k);
      })).then(function() {
        V.refreshMine();
        throw e;
      });
    });
  }
  function dropCopy(k) {
    delete mine[k];
    var u = mineURLs[k];
    if (u) {
      letGo(u.svg);
      letGo(u.text);
    }
    delete mineURLs[k];
    mineFlag();
    return V.draftDo("readwrite", function(st) {
      return st.delete(k);
    }, "mine").catch(function() {
    });
  }
  function putOn(path, t, sha) {
    return api("/contents/" + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Moved in the viewer: " + path.split("/").pop(), content: b64(t), sha: sha || void 0, branch: "main" })
    }).then(function(q) {
      if (q.ok) return q.json().then(function(d) {
        return d.content.sha;
      });
      if (q.status !== 409 && q.status !== 422) throw ghErr(q.status);
      return ghRaw(path).then(function(g) {
        return g && g.text === t ? g.sha : null;
      });
    });
  }
  function moveBack() {
    if (!(repo() && token())) return Promise.resolve();
    var ks = Object.keys(mine).filter(function(k) {
      return mine[k].from;
    });
    if (!ks.length) return Promise.resolve();
    var both = [], failed = [], back2 = 0;
    return folder().catch(function() {
      return null;
    }).then(function(f) {
      return ks.reduce(function(q, k) {
        return q.then(function() {
          var r = mine[k];
          if (!r || !r.from) return;
          var fr = r.from, t = r.text, keep = function() {
            return minePut(r);
          };
          if (r.hidden) return siteBin(fr.site, true).then(function() {
            return dropCopy(k);
          });
          return (f ? origRead(f, r.file) : Promise.resolve(null)).then(function(c) {
            var cols = c ? JSON.stringify(c) : null, colsWas = fr.cols ? JSON.stringify(JSON.parse(fr.cols)) : null;
            var named = r.title === fr.title, grouped = (r.group || "") === fr.group, colsSame = !cols || cols === colsWas;
            if (t === fr.saved && named && grouped && colsSame) {
              V.arrived[k] = fr.site;
              back2++;
              return dropCopy(k);
            }
            return (t === fr.saved ? Promise.resolve(fr.sha) : putOn(fr.path, t, fr.sha)).then(function(sha) {
              if (sha === null) {
                delete r.from;
                both.push(r.title);
                return keep();
              }
              fr.saved = t;
              fr.sha = sha;
              r.at = Date.now();
              return keep().then(function() {
                if (colsSame) return;
                return putOn("maps/colours/" + fr.site + ".json", JSON.stringify(c, null, 1) + "\n", fr.colSha).then(function(cs) {
                  if (cs) {
                    fr.cols = cols;
                    fr.colSha = cs;
                  }
                  return keep();
                });
              }).then(function() {
                if (/^maps\/sbgn-ml\//.test(fr.path)) return;
                if (!named) renamed[fr.site] = { was: fr.title, to: r.title };
                return (named ? Promise.resolve() : toSiteName(fr.site, fr.title, r.title).then(function() {
                  fr.title = r.title;
                  return keep();
                }, function(e) {
                  delete renamed[fr.site];
                  throw e;
                })).then(function() {
                  return grouped ? null : toSiteGroup(fr.site, r.group || "", 0).then(function() {
                    fr.group = r.group || "";
                    return keep();
                  });
                });
              }).then(function() {
                var n = Object.assign({}, r, { site: fr.site, path: fr.path, sha: fr.sha || null, saved: t, siteTitle: fr.title });
                delete n.from;
                back2++;
                return minePut(n);
              });
            });
          }).catch(function(e) {
            failed.push(r.title + " (" + (e && e.message ? e.message : e) + ")");
          });
        });
      }, Promise.resolve());
    }).then(function() {
      V.refreshMine();
      if (both.length || failed.length) tellBack(back2, both, failed);
    });
  }
  function tellBack(back2, both, failed) {
    var esc = function(t) {
      return String(t).replace(/[&<>"]/g, function(c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };
    var veil = document.createElement("div"), w = document.createElement("div"), was = document.activeElement;
    veil.className = "m2-me-veil";
    w.className = "m2-ask m2-back";
    w.setAttribute("role", "alertdialog");
    w.setAttribute("aria-modal", "true");
    w.setAttribute("aria-labelledby", "m2-back-h");
    w.innerHTML = '<h3 id="m2-back-h">Connected to GitHub again</h3>' + (back2 ? "<p>" + back2 + (back2 === 1 ? " map is" : " maps are") + " back on GitHub.</p>" : "") + (both.length ? "<p>Changed both in the folder and on GitHub since the copy, so both versions are kept as two maps in the list: " + both.map(esc).join(", ") + ". Keep the one you want and delete the other.</p>" : "") + (failed.length ? "<p>Not back on GitHub yet: " + failed.map(esc).join(", ") + ". Kept in this browser and in the folder; tried again when you connect next.</p>" : "") + '<div class="m2-ask-row"><button type="button" class="m2-ask-no">OK</button></div>';
    veil.appendChild(w);
    document.body.appendChild(veil);
    var ok = w.querySelector("button");
    var close = function() {
      veil.remove();
      window.removeEventListener("keydown", key, true);
      if (was && was.isConnected && was.focus) was.focus();
    };
    var key = function(e) {
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        e.preventDefault();
        ok.focus();
      }
    };
    ok.addEventListener("click", close);
    veil.addEventListener("pointerdown", function(e) {
      if (e.target === veil) close();
    });
    window.addEventListener("keydown", key, true);
    ok.focus();
  }
  var BIN_KEY;
  function __run202() {
    BIN_KEY = "atlas-bin-pending";
  }
  function binPending() {
    try {
      var o = JSON.parse(localStorage.getItem(BIN_KEY) || "{}");
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (e) {
      return {};
    }
  }
  function binPendingSet(o) {
    try {
      if (Object.keys(o).length) localStorage.setItem(BIN_KEY, JSON.stringify(o));
      else localStorage.removeItem(BIN_KEY);
    } catch (e) {
    }
  }
  function binState(m, pend) {
    var p = pend[m.id];
    var since = Array.isArray(p) && m.written && m.written >= new Date(p[1]).toISOString();
    if (!Array.isArray(p) || since || (m.deleted || "") === p[0] && !V.pageBehind(m) || Date.now() - p[1] > 36e5) {
      delete pend[m.id];
      return m.deleted || "";
    }
    return p[0];
  }
  function binClear(id) {
    var p = binPending();
    if (id in p) {
      delete p[id];
      binPendingSet(p);
    }
  }
  function textOf(b642) {
    return new TextDecoder().decode(Uint8Array.from(atob(b642.replace(/\n/g, "")), function(c) {
      return c.charCodeAt(0);
    }));
  }
  function ghPost(path, body, method) {
    return api(path, { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(ghJson);
  }
  function ghErr(s) {
    var e = new Error("GitHub " + s);
    e.status = s;
    return e;
  }
  function ghJson(r) {
    return r.ok ? r.json() : r.json().catch(function() {
      return {};
    }).then(function(d) {
      var e = new Error(d && d.message || "GitHub " + r.status);
      e.status = r.status;
      throw e;
    });
  }
  function __run212() {
  }
  function siteFront(id, spec, message) {
    V.pageSent(id, "");
    var show = spec.show;
    delete spec.show;
    return opSend("front", { id, spec, message }, [id], show).catch(function(e) {
      V.pageSent(id, null);
      throw e;
    });
  }
  function frontEdit(id, spec) {
    return function(f) {
      if (spec.need && f.get(spec.need) === null) throw new Error("its page has no " + spec.need + " line");
      if (spec.was) {
        var w = {};
        spec.was.forEach(function(k) {
          w[k] = f.get(k);
        });
        pageWas[id] = w;
      }
      if (spec.follow && spec.set && f.get("title") === f.get("topic")) f.set("title", spec.set.topic);
      (spec.drop || []).forEach(function(k) {
        f.drop(k);
      });
      Object.keys(spec.set || {}).forEach(function(k) {
        f.set(k, spec.set[k]);
      });
    };
  }
  var WAIT;
  var opsWait;
  var opsLast;
  var opsOut;
  var opsAwait;
  var opsStuckNow;
  var mineStuck;
  var roundRun;
  var idsMemo;
  var RUN;
  function __run312() {
    WAIT = { waiting: true }, opsWait = [], opsLast = null, opsOut = {}, opsAwait = {}, opsStuckNow = null, mineStuck = {}, roundRun = null, idsMemo = null;
    RUN = {
      front: function(a) {
        return frontWrite(a.id, frontEdit(a.id, a.spec), a.message, 0);
      },
      group: function(a) {
        return siteGroupTo(a.ids, a.g, a.ex);
      },
      bin: function(a) {
        var at2 = (/* @__PURE__ */ new Date()).toISOString();
        return binFileWrite(
          function(o) {
            a.ids.forEach(function(id) {
              if (a.on) o[id] = { deleted: a.date, written: at2 };
              else delete o[id];
            });
          },
          (a.on ? "Deleted in the viewer: " : "Restored in the viewer: ") + a.ids.join(", "),
          0
        ).then(function() {
          return at2;
        });
      },
      erase: function(a) {
        return siteErase(a.ids, a.gone);
      }
    };
  }
  function opLocked(f) {
    var g = function() {
      return Promise.race([f(), new Promise(function(ok, no2) {
        setTimeout(function() {
          no2(new TypeError("Failed to fetch (no answer in a minute)"));
        }, 6e4);
      })]);
    };
    return navigator.locks && navigator.locks.request ? navigator.locks.request("atlas-ops", g) : g();
  }
  function opSend(kind, args, ids, show) {
    var op = { key: repo(), kind, args, ids, show: show || null };
    idsMemo = null;
    return opsKeep(op).then(function() {
      opsWait.push(op);
      opsAwait[op.seq] = 1;
      var round = function(n) {
        return opsRound().then(function() {
          var x = opsOut[op.seq];
          if (!x && n < 3 && opsWait.some(function(o) {
            return o.seq === op.seq;
          }) && !opsStuckNow) return round(n + 1);
          delete opsOut[op.seq];
          delete opsAwait[op.seq];
          if (x && x.e) throw x.e;
          return x ? x.r : WAIT;
        });
      };
      return round(0);
    }, function() {
      return opLocked(function() {
        return RUN[kind](args);
      }).then(function(r) {
        opAfter(op, r);
        return r;
      });
    });
  }
  function opsRound() {
    if (!(repo() && token())) return Promise.resolve({ sent: 0, stuck: null, back: [] });
    if (roundRun) return roundRun;
    var out = { sent: 0, stuck: null, back: [] }, failed = [];
    roundRun = opsLoad().then(function(all) {
      return all.reduce(function(q, op) {
        return q.then(function() {
          if (out.stuck) return;
          return opLocked(function() {
            return opsHas(op.seq).then(function(still) {
              if (!still) return { gone: true };
              return RUN[op.kind](op.args).then(function(r) {
                return opsDone(op.seq).then(function() {
                  return { r };
                });
              });
            });
          }).then(function(x) {
            opForget(op);
            if (x.gone) {
              opsOut[op.seq] = { r: op.at };
              return;
            }
            opAfter(op, x.r);
            opsOut[op.seq] = { r: x.r };
            out.sent++;
            if ((opsLast || []).indexOf(op.seq) >= 0) out.back = out.back.concat(op.ids || []);
          }, function(e) {
            var why = whyFailed(e);
            if (why !== "other") {
              out.stuck = why;
              return;
            }
            opForget(op);
            opsOut[op.seq] = { e };
            if (!opsAwait[op.seq]) failed.push(opUndone(op, e));
            return opsDone(op.seq);
          });
        });
      }, Promise.resolve());
    }).then(function() {
      opsStuckNow = out.stuck;
      idsMemo = null;
      if (out.stuck) {
        opsHold();
        sendFailed(out.stuck);
      }
      if (failed.length) {
        V.refreshMine();
        alert("Not changed on GitHub: " + failed.join("; ") + ". The list shows them as GitHub has them.");
      }
      return out;
    }, function() {
      return out;
    });
    roundRun = roundRun.then(function(x) {
      roundRun = null;
      return x;
    });
    return roundRun;
  }
  function opForget(op) {
    opsWait = opsWait.filter(function(o) {
      return o.seq !== op.seq;
    });
    idsMemo = null;
  }
  function opAfter(op, r) {
    var a = op.args;
    if (op.kind === "front") V.pageSent(a.id, r);
    else if (op.kind === "bin") a.ids.forEach(function(id) {
      V.pageSent(id, a.on ? r : null);
    });
    else if (op.kind === "erase") hiddenSet(siteHidden().filter(function(id) {
      return a.ids.indexOf(id) < 0;
    }));
  }
  function opUndone(op, e) {
    var a = op.args;
    (op.ids || []).forEach(function(id) {
      V.pageSent(id, null);
      if (op.kind === "group" || op.kind === "front" && a.spec.set && "group" in a.spec.set) V.setMoved(id, null);
      if (op.kind === "bin" || binOf(op)) binClear(id);
      if (op.show && op.show.to) delete renamed[id];
      if (op.kind === "erase") delete hiddenGone[id];
    });
    return (op.ids || []).map(function(id) {
      var m = V.byId[id];
      return m ? mapName(m) : id;
    }).join(", ") + " (" + (e && e.message ? e.message : e) + ")";
  }
  function binOf(op) {
    var sp = op.kind === "front" && op.args.spec;
    if (!sp) return null;
    if (sp.set && "deleted" in sp.set) return [JSON.parse(sp.set.deleted)];
    return (sp.drop || []).indexOf("deleted") >= 0 ? [""] : null;
  }
  function opsHold() {
    var pend = binPending(), n = 0, any = false;
    opsWait.forEach(function(op) {
      var b = op.kind === "bin" ? [op.args.on ? op.args.date : ""] : binOf(op);
      (op.ids || []).forEach(function(id) {
        if (op.show && op.show.to) {
          renamed[id] = { was: op.show.was, to: op.show.to };
          any = true;
        }
        if (op.kind === "erase") {
          hiddenGone[id] = 1;
          any = true;
        }
        if (op.kind === "front" || op.kind === "bin") V.pageSent(id, "");
        if (b) {
          pend[id] = [b[0], Date.now()];
          n++;
        }
      });
    });
    if (n) binPendingSet(pend);
    return any || n > 0;
  }
  function opsLoad() {
    return opsAll(repo()).then(function(all) {
      opsWait = all;
      idsMemo = null;
      if (opsLast === null) {
        opsLast = all.map(function(o) {
          return o.seq;
        });
        if (opsHold()) V.refreshMine();
      }
      return all;
    }, function() {
      return opsWait;
    });
  }
  function opsDrain() {
    return opsRound().then(function(x) {
      return x.stuck ? x : upAll().then(function() {
        return x;
      }, function() {
        return x;
      });
    });
  }
  function opsIds() {
    if (idsMemo) return idsMemo;
    var bySite = {}, o = {};
    Object.keys(mine).forEach(function(k) {
      if (mine[k].site) bySite[mine[k].site] = k;
    });
    opsWait.forEach(function(op) {
      (op.ids || []).forEach(function(id) {
        o[bySite[id] || id] = 1;
      });
    });
    Object.keys(mineStuck).forEach(function(k) {
      if (mine[k]) o[k] = 1;
    });
    idsMemo = Object.keys(o);
    setTimeout(function() {
      idsMemo = null;
    }, 0);
    return idsMemo;
  }
  function frontWrite(id, edit, message, tries) {
    var path = "/contents/maps/" + encodeURIComponent(id) + ".md", at2 = (/* @__PURE__ */ new Date()).toISOString();
    return api(path + "?ref=main").then(function(r) {
      if (!r.ok) {
        var e = new Error(r.status === 404 ? "it has no page of its own" : "GitHub " + r.status);
        e.noPage = r.status === 404;
        e.status = r.status;
        throw e;
      }
      return r.json();
    }).then(function(d) {
      var md = textOf(d.content);
      var fm = /^---(\r?\n)([\s\S]*?)\r?\n---/.exec(md);
      if (!fm) throw new Error("its page has no front matter");
      var nl = fm[1], head = fm[2];
      edit({
        get: function(k) {
          var x = head.match(new RegExp("^" + k + ":[ \\t]*([^\\r\\n]*)", "m"));
          return x ? x[1].replace(/^"(.*)"$/, "$1") : null;
        },
        set: function(k, v) {
          var re = new RegExp("^" + k + ":[^\\r\\n]*", "m");
          head = re.test(head) ? head.replace(re, function() {
            return k + ": " + v;
          }) : head + nl + k + ": " + v;
        },
        drop: function(k) {
          head = head.replace(new RegExp("^" + k + ":.*(\\r?\\n|$)", "m"), "").replace(/\r?\n$/, "");
        }
      });
      head = /^written:/m.test(head) ? head.replace(/^written:[^\r\n]*/m, function() {
        return "written: " + JSON.stringify(at2);
      }) : head + nl + "written: " + JSON.stringify(at2);
      md = "---" + nl + head + fm[0].slice(3 + nl.length + fm[2].length) + md.slice(fm[0].length);
      return api(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message + ": " + id, content: b64(md), sha: d.sha, branch: "main" }) });
    }).then(function(r) {
      if ((r.status === 409 || r.status === 422) && tries < 3) return new Promise(function(ok) {
        setTimeout(ok, 500 * (tries + 1));
      }).then(function() {
        return frontWrite(id, edit, message, tries + 1);
      });
      if (!r.ok) throw ghErr(r.status);
      return at2;
    });
  }
  function siteBin(id, on2, topic) {
    if (pageless((V.siteList || []).filter(function(x) {
      return x.id === id;
    })[0])) return pagelessBin(id, on2);
    var pend = binPending(), was = pend[id], date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19) + "Z";
    pend[id] = [on2 ? date : "", Date.now()];
    binPendingSet(pend);
    var n = renamed[id], spec = on2 ? { set: { deleted: JSON.stringify(date) } } : { drop: ["deleted"] };
    if (!on2 && topic) {
      spec.set = { topic: JSON.stringify(topic.replace(/["\\]/g, "")) };
      spec.follow = true;
      if (n) spec.show = { was: n.was, to: n.to };
    }
    return siteFront(id, spec, on2 ? "Map deleted in the viewer" : "Map restored in the viewer").catch(function(e) {
      var p = binPending();
      if (was === void 0) delete p[id];
      else p[id] = was;
      binPendingSet(p);
      V.refreshMine();
      throw e;
    });
  }
  var BIN_FILE;
  function __run223() {
    BIN_FILE = "maps/deleted.json";
  }
  function pageless(m) {
    return !!m && !m.mine && !!m.pageless;
  }
  function binFileRead(d) {
    try {
      var o = d && d.content ? JSON.parse(textOf(d.content)) : {};
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (e) {
      return {};
    }
  }
  function binFileText(o) {
    return JSON.stringify(o, null, 1) + "\n";
  }
  function binFileGet(ref) {
    return api("/contents/" + BIN_FILE + "?ref=" + (ref || "main")).then(function(r) {
      return r.status === 404 ? {} : ghJson(r);
    });
  }
  function binFileWrite(edit, message, tries) {
    return binFileGet().then(function(d) {
      var o = binFileRead(d);
      edit(o);
      return api("/contents/" + BIN_FILE, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, content: b64(binFileText(o)), sha: d.sha || void 0, branch: "main" }) });
    }).then(function(r) {
      if ((r.status === 409 || r.status === 422) && tries < 3) return new Promise(function(ok) {
        setTimeout(ok, 500 * (tries + 1));
      }).then(function() {
        return binFileWrite(edit, message, tries + 1);
      });
      if (!r.ok) throw ghErr(r.status);
    });
  }
  var pbWait;
  function __run233() {
    pbWait = {};
  }
  function pagelessBin(id, on2) {
    var k = on2 ? "on" : "off", w = pbWait[k], pend = binPending();
    if (!w) {
      w = pbWait[k] = { ids: [], was: {}, date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19) + "Z" };
      w.p = new Promise(function(ok) {
        setTimeout(ok, 0);
      }).then(function() {
        delete pbWait[k];
        return pagelessWrite(w, on2);
      });
    }
    if (w.ids.indexOf(id) < 0) {
      w.ids.push(id);
      w.was[id] = pend[id];
    }
    pend[id] = [on2 ? w.date : "", Date.now()];
    binPendingSet(pend);
    V.pageSent(id, "");
    return w.p;
  }
  function pagelessWrite(w, on2) {
    var ids = w.ids;
    return opSend("bin", { ids, on: on2, date: w.date }, ids).catch(function(e) {
      ids.forEach(function(id) {
        V.pageSent(id, null);
      });
      var q = binPending();
      ids.forEach(function(id) {
        if (w.was[id] === void 0) delete q[id];
        else q[id] = w.was[id];
      });
      binPendingSet(q);
      V.refreshMine();
      throw e;
    });
  }
  var GONE_KEY;
  function __run243() {
    GONE_KEY = "atlas-groups-gone";
  }
  function goneRead() {
    try {
      var o = JSON.parse(localStorage.getItem(GONE_KEY) || "{}");
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (e) {
      return {};
    }
  }
  function goneSet(name2, at2) {
    var o = goneRead();
    if (at2 === null) delete o[name2];
    else o[name2] = at2;
    try {
      if (Object.keys(o).length) localStorage.setItem(GONE_KEY, JSON.stringify(o));
      else localStorage.removeItem(GONE_KEY);
    } catch (e) {
    }
  }
  function goneBack(name2) {
    var o = goneRead();
    if (!name2 || !(name2 in o)) return;
    goneSet(name2, null);
    if (mineGroups().indexOf(name2) < 0) groupBack(name2, o[name2]);
  }
  function groupGo(name2) {
    var at2 = mineGroups().indexOf(name2);
    if (at2 < 0) return;
    goneSet(name2, at2);
    mineGroupsSet(mineGroups().filter(function(g) {
      return g !== name2;
    }));
    if (V.closed[name2]) {
      delete V.closed[name2];
      V.saveClosed();
    }
    V.refreshMine();
  }
  function inGroup(name2) {
    return V.maps.filter(function(m) {
      return !m.binned && (m.group || "") === name2;
    });
  }
  function groupMaps(name2, gh2) {
    var editing2 = V.grid.classList.contains("m2-editing") && V.chosen, q = (document.getElementById("m2-search") || {}).value;
    var seen = q ? Array.prototype.map.call(document.querySelectorAll("#m2-list .m2-map:not(.m2-binned)"), function(b) {
      return b.dataset.id;
    }) : null;
    return inGroup(name2).filter(function(m) {
      return canDelete(m, gh2) && !(editing2 && V.chosen.id === m.id) && (!seen || seen.indexOf(m.id) >= 0);
    });
  }
  function deleteGroupU(name2, ms) {
    var own2 = ownGroup(name2), at2 = mineGroups().indexOf(name2), shut = !!V.closed[name2], ks = ms.map(listKey);
    var empty = function() {
      return own2 && !inGroup(name2).length;
    };
    var go = function() {
      return Promise.resolve(ms.length ? binMany(ms) : null).then(function() {
        if (empty()) {
          if (ms.length) groupGo(name2);
          else removeGroup(name2);
        }
      });
    };
    var fwd = go();
    listDid(function() {
      return fwd.then(function() {
        if (own2 && mineGroups().indexOf(name2) < 0) {
          goneSet(name2, null);
          groupBack(name2, at2);
          if (shut) {
            V.closed[name2] = true;
            V.saveClosed();
          }
        }
        return restoreKeys(ks);
      });
    }, function() {
      fwd = Promise.resolve(ks.length ? binKeys(ks) : null).then(function() {
        if (empty()) {
          if (ks.length) groupGo(name2);
          else removeGroup(name2);
        }
      });
      return fwd;
    });
    return fwd;
  }
  var DEL_KEY;
  function __run252() {
    DEL_KEY = /mac|iphone|ipad|ipod/i.test(navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || navigator.userAgent) ? "\u2318\u232B" : "Ctrl+Del";
    document.addEventListener("keydown", function(e) {
      if (e.key !== "Delete" && e.key !== "Backspace" || e.defaultPrevented || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey)) return;
      if (naming || document.querySelector(".m2-cx") || V.grid.classList.contains("m2-editing")) return;
      if (e.target.closest && e.target.closest("input, select, textarea, [contenteditable]")) return;
      var list2 = document.getElementById("m2-list"), m = V.chosen && V.byId[V.chosen.id], sel = V.picked(), pg = V.pickedGroup();
      if (pg !== null && list2 && list2.offsetParent) {
        var gm = groupMaps(pg, !!(repo() && token()));
        V.pickSet([]);
        if (gm.length || ownGroup(pg) && !inGroup(pg).length) {
          e.preventDefault();
          deleteGroupU(pg, gm);
          return;
        }
      }
      if ((sel.length > 1 || sel.length === 1 && (!m || sel[0] !== m.id)) && list2 && list2.offsetParent) {
        var ms = sel.map(function(id) {
          return V.byId[id];
        }).filter(function(x) {
          return x && !x.binned && canDelete(x, !!(repo() && token()));
        });
        if (ms.length) {
          e.preventDefault();
          binU(ms, true);
        }
        return;
      }
      if (!list2 || !list2.offsetParent || !m || m.binned || !canDelete(m, !!(repo() && token()))) return;
      if (V.mapSelected && V.mapSelected()) return;
      e.preventDefault();
      var items2 = Array.prototype.slice.call(list2.querySelectorAll(".m2-map:not(.m2-binned)")), i = items2.findIndex(function(b) {
        return b.dataset.id === m.id;
      });
      var next = i < 0 ? null : items2[i + 1] || items2[i - 1];
      if (next) V.go(next.dataset.id);
      binU([m]);
    });
  }
  function bin(m, quiet2) {
    var say = function(e) {
      alert((m.mine ? m.title : m.topic) + " was not deleted: " + (e && e.message ? e.message : e));
    }, sent = null;
    if (m.mine) {
      var r = mine[m.id];
      if (!r) return;
      r.hidden = true;
      r.deleted = Date.now();
      minePut(r).catch(function() {
      });
      folderMove(m.id, true);
      sent = r.site && repo() && token() ? siteBin(r.site, true).catch(say) : null;
    } else sent = siteBin(m.id, true).catch(say);
    if (!quiet2) V.refreshMine();
    return Promise.resolve(sent);
  }
  function binMany(ms) {
    var ids = ms.map(function(m) {
      return m.id;
    }), rows = Array.prototype.slice.call(document.querySelectorAll("#m2-list .m2-map:not(.m2-binned)")).map(function(b) {
      return b.dataset.id;
    });
    var lastAt = Math.max.apply(null, ids.map(function(id) {
      return rows.indexOf(id);
    })), next = rows.slice(lastAt + 1).concat(rows.slice(0, lastAt).reverse()).filter(function(id) {
      return ids.indexOf(id) < 0;
    })[0];
    V.pickSet([]);
    if (next && V.chosen && ids.indexOf(V.chosen.id) >= 0) V.go(next);
    ms = ms.filter(function(m) {
      var b = twinBase(m);
      return !b || !ms.some(function(x) {
        return x.id === b + "-graphml" || x.id === b;
      });
    });
    var all = Promise.all(ms.map(function(m) {
      return bin(m, true);
    }));
    V.refreshMine();
    return all;
  }
  function restore(m) {
    m = parentOf(m);
    goneBack(m.mine ? (mine[m.id] || {}).group : V.movedOf(m.id) || m.group);
    var name2 = mapName(m), to = nameTaken(name2, m.group, fmtOf(m), m.id, m.tab) ? freeTitle(name2, m.group, fmtOf(m), null, m.id, m.tab) : null;
    var say = function(e) {
      alert((m.mine ? m.title : m.topic) + " was not restored: " + (e && e.message ? e.message : e));
    };
    if (m.mine) {
      var r = mine[m.id];
      if (!r) return;
      r.hidden = false;
      delete r.deleted;
      if (to) r.title = to;
      minePut(r).catch(function() {
      });
      folderMove(m.id, false);
      var sent = r.site && repo() && token() ? siteBin(r.site, false, to).catch(say) : null;
    } else {
      var before = renamed[m.id];
      if (pageless(m)) to = null;
      if (to) renamed[m.id] = { was: before ? before.was : name2, to };
      sent = siteBin(m.id, false, to).catch(function(e) {
        if (before) renamed[m.id] = before;
        else delete renamed[m.id];
        say(e);
      });
    }
    V.refreshMine();
    return Promise.resolve(sent);
  }
  function twinOf(id) {
    return id.replace(/-graphml$/, "") + "-sbgn";
  }
  function twinBase(m) {
    return m && !m.mine && /^maps\/sbgn-ml\/[^/]+-sbgn\.sbgn$/.test(m.editPath || "") ? m.id.replace(/-sbgn$/, "") : null;
  }
  function parentOf(m) {
    var b = twinBase(m), l = V.siteList || [];
    if (!b) return m;
    var p = l.filter(function(x) {
      return x.id === b + "-graphml";
    })[0] || l.filter(function(x) {
      return x.id === b;
    })[0];
    var pm = p && V.byId[p.id];
    return pm && pm.binned ? Object.assign({}, pm, { binned: m.binned }) : m;
  }
  function origGhId() {
    if (!site || site.pending || !(repo() && token())) return null;
    if (site.mine) {
      var r = mine[site.id];
      return r && r.site || null;
    }
    return site.id || null;
  }
  function origPut(rec, sent) {
    var gid = origGhId(), body = JSON.stringify(Object.assign({}, rec, { sent: void 0 }));
    if (!gid) return;
    var p = repo() + "/contents/maps/colours/" + encodeURIComponent(gid) + ".json";
    var put2 = function(again) {
      return gh(p + "?ref=main").then(function(q) {
        return q.ok ? q.json() : {};
      }).then(function(d) {
        return gh(p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Colours kept in the viewer: " + gid, content: b64(body), sha: d.sha || void 0, branch: "main" }) });
      }).then(function(q) {
        if (q.ok) return sent();
        if ((q.status === 409 || q.status === 422) && !again) return put2(true);
        throw q.status;
      });
    };
    put2(false).catch(function(e) {
      warn("The map\u2019s own colours were kept in this browser only (GitHub " + (e && e.message || e) + ").");
    });
  }
  function origGh() {
    var gid = origGhId();
    return gid ? gh(repo() + "/contents/maps/colours/" + encodeURIComponent(gid) + ".json?ref=main", { headers: { Accept: "application/vnd.github.raw" } }).then(function(q) {
      return q.ok ? q.json() : null;
    }).catch(function() {
      return null;
    }) : Promise.resolve(null);
  }
  function siteErase(ids, gone) {
    var tries = 0, post = ghPost;
    gone = gone || [];
    var go = function() {
      return api("/contents/maps?ref=main").then(ghJson).then(function(d) {
        var paths = d.filter(function(f) {
          return f.type === "file" && ids.indexOf(f.name.replace(/\.[^.]+$/, "")) >= 0;
        }).map(function(f) {
          return f.path;
        });
        var twins = d.some(function(f) {
          return f.type === "dir" && f.name === "sbgn-ml";
        }) ? api("/contents/maps/sbgn-ml?ref=main").then(ghJson).then(function(x) {
          x.forEach(function(f) {
            if (f.type === "file" && ids.some(function(id) {
              return f.name === id.replace(/-graphml$/, "") + "-sbgn.sbgn";
            })) paths.push(f.path);
          });
        }) : Promise.resolve();
        var extras = d.some(function(f) {
          return f.type === "dir" && f.name === "extra";
        }) ? api("/contents/maps/extra?ref=main").then(ghJson) : Promise.resolve([]);
        var kept = d.some(function(f) {
          return f.type === "dir" && f.name === "colours";
        }) ? api("/contents/maps/colours?ref=main").then(ghJson).then(function(x) {
          x.forEach(function(f) {
            if (f.type === "file" && ids.indexOf(f.name.replace(/\.json$/, "")) >= 0) paths.push(f.path);
          });
        }) : Promise.resolve();
        return twins.then(function() {
          return kept;
        }).then(function() {
          return extras;
        }).then(function(x) {
          return Promise.all(x.filter(function(f) {
            return f.type === "dir" && ids.indexOf(f.name) >= 0;
          }).map(function(f) {
            return api("/contents/" + f.path + "?ref=main").then(ghJson);
          }));
        }).then(function(ds) {
          ds.forEach(function(fs) {
            fs.forEach(function(f) {
              if (f.type === "file") paths.push(f.path);
            });
          });
          return paths;
        });
      }).then(function(paths) {
        var tree = paths.map(function(p) {
          return { path: p, mode: "100644", type: "blob", sha: null };
        });
        if (!gone.length) return tree;
        var dirs = {};
        gone.forEach(function(g) {
          var d = g.path.replace(/\/[^/]*$/, "");
          (dirs[d] = dirs[d] || []).push(g.path);
        });
        return Promise.all(Object.keys(dirs).map(function(d) {
          return api("/contents/" + d + "?ref=main").then(function(r) {
            return r.ok ? r.json() : [];
          }).then(function(fs) {
            (Array.isArray(fs) ? fs : []).forEach(function(f) {
              if (f.type === "file" && dirs[d].indexOf(f.path) >= 0) tree.push({ path: f.path, mode: "100644", type: "blob", sha: null });
            });
          });
        })).then(function() {
          return tree;
        });
      }).then(function(tree) {
        return api("/git/ref/heads/main").then(ghJson).then(function(ref) {
          return binFileGet(ref.object.sha).then(function(d) {
            var o = binFileRead(d), was = binFileText(o), at2 = (/* @__PURE__ */ new Date()).toISOString();
            ids.forEach(function(id) {
              delete o[id];
              if (/-graphml$/.test(id)) delete o[twinOf(id)];
            });
            gone.forEach(function(g) {
              o[g.id] = { deleted: "forever", written: at2 };
            });
            if (binFileText(o) !== was) tree.push({ path: BIN_FILE, mode: "100644", type: "blob", content: binFileText(o) });
            return ref;
          });
        }).then(function(ref) {
          if (!tree.length) return;
          return api("/git/commits/" + ref.object.sha).then(ghJson).then(function(c) {
            return post("/git/trees", { base_tree: c.tree.sha, tree });
          }).then(function(t) {
            return post("/git/commits", { message: "Deleted forever in the viewer: " + ids.join(", "), tree: t.sha, parents: [ref.object.sha] });
          }).then(function(c) {
            return post("/git/refs/heads/main", { sha: c.sha }, "PATCH");
          });
        });
      }).catch(function(e) {
        if (e.status === 422 && ++tries < 3) return go();
        throw e;
      });
    };
    return go().then(function() {
      shared.ghDir = null;
    });
  }
  var BIN_DIR;
  function __run262() {
    BIN_DIR = "Deleted";
  }
  function folderMove(id, toBin) {
    if (repo() && token()) return Promise.resolve();
    return folder().then(function(f) {
      if (!f || !f.files[id]) return;
      var w = f.files[id], inBin = w.name.indexOf(BIN_DIR + "/") === 0, nm = inBin ? w.name.slice(BIN_DIR.length + 1) : w.name;
      if (inBin === toBin) return;
      return f.dir.queryPermission({ mode: "readwrite" }).then(function(p) {
        if (p !== "granted") return;
        return f.dir.getDirectoryHandle(BIN_DIR, { create: true }).then(function(bd) {
          var from = toBin ? f.dir : bd, to = toBin ? bd : f.dir, h2;
          return from.getFileHandle(nm).then(function(h) {
            return h.getFile();
          }).then(function(fl) {
            return to.getFileHandle(nm).then(function() {
              return freeName(to, nm, 2);
            }, function() {
              return nm;
            }).then(function(nm2) {
              return to.getFileHandle(nm2, { create: true }).then(function(x) {
                h2 = x;
                return x.createWritable();
              }).then(function(wr) {
                return wr.write(fl).then(function() {
                  return wr.close();
                });
              }).then(function() {
                return h2.getFile();
              }).then(function(nf) {
                return from.removeEntry(nm).then(function() {
                  return folderFile(id, { name: (toBin ? BIN_DIR + "/" : "") + nm2, mod: nf.lastModified, size: nf.size });
                });
              }).then(function() {
                if (toBin || nm2 === nm) return;
                return origRead(f, nm).then(function(r) {
                  return origFolderDrop(f, nm2).then(function() {
                    return r && origWrite(f, nm2, r).then(function() {
                      return origFolderDrop(f, nm);
                    });
                  });
                });
              });
            });
          });
        });
      });
    }).catch(function(e) {
      warn("Not moved in the folder: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ".");
    });
  }
  function folderErase(id) {
    return folder().then(function(f) {
      if (!f || !f.files[id]) return;
      var nm = f.files[id].name, inBin = nm.indexOf(BIN_DIR + "/") === 0;
      return f.dir.queryPermission({ mode: "readwrite" }).then(function(p) {
        if (p !== "granted") return;
        return (inBin ? f.dir.getDirectoryHandle(BIN_DIR) : Promise.resolve(f.dir)).then(function(d) {
          return d.removeEntry(inBin ? nm.slice(BIN_DIR.length + 1) : nm);
        }).catch(function(e) {
          if (!e || e.name !== "NotFoundError") throw e;
        }).then(function() {
          return origFolderDrop(f, inBin ? nm.slice(BIN_DIR.length + 1) : nm);
        }).then(function() {
          return V.draftDo("readwrite", function(st) {
            var q = st.get("files");
            q.onsuccess = function() {
              var r = q.result || {};
              delete r[id];
              st.put(r, "files");
            };
            return q;
          }, "folder");
        });
      });
    }).catch(function() {
    });
  }
  var hiddenGone;
  function __run272() {
    hiddenGone = {};
  }
  function erase(ms) {
    ms = ms.filter(Boolean).map(parentOf).filter(function(m, i, a) {
      return a.findIndex(function(x) {
        return x.id === m.id;
      }) === i;
    });
    if (!ms.length) return;
    var site2 = [], gone = [], gh2 = !!(repo() && token());
    ms.forEach(function(m) {
      if (m.mine) {
        var r = mine[m.id];
        if (!r) return;
        if (r.from) {
          folderErase(m.id);
          minePut(Object.assign({}, r, { hidden: true, gone: true, text: "", svg: "" })).catch(function() {
          });
          return;
        }
        if (r.site && gh2) site2.push(r.site);
        var u = mineURLs[m.id];
        if (u) {
          letGo(u.svg);
          letGo(u.text);
        }
        delete mine[m.id];
        delete mineURLs[m.id];
        mineFlag();
        V.draftDo("readwrite", function(st) {
          return st.delete(m.id);
        }, "mine").catch(function() {
        });
        folderErase(m.id);
      } else {
        site2.push(m.id);
        if (pageless(m)) gone.push({ id: m.id, path: m.editPath });
      }
    });
    if (!site2.length) return V.refreshMine();
    site2.forEach(function(id) {
      hiddenGone[id] = 1;
      binClear(id);
      delete renamed[id];
      draftDrop(id);
    });
    namedSave();
    V.refreshMine();
    opSend("erase", { ids: site2, gone }, site2).catch(function(e) {
      site2.forEach(function(id) {
        delete hiddenGone[id];
      });
      V.refreshMine();
      alert("Not deleted forever on GitHub: " + (e && e.message ? e.message : e) + ". The map stays in Deleted.");
    });
  }
  function binMigrate() {
    var hid = siteHidden();
    if (!hid.length || !(repo() && token()) || !V.siteList) return;
    var ids = {};
    V.siteList.forEach(function(m) {
      ids[m.id] = m;
    });
    var left = [];
    return hid.reduce(function(q, id) {
      return q.then(function() {
        var m = ids[id];
        if (!m || m.deleted || !canDelete(m, true)) return;
        return siteBin(id, true).catch(function() {
          left.push(id);
        });
      });
    }, Promise.resolve()).then(function() {
      hiddenSet(left);
      V.refreshMine();
    });
  }
  var listPast;
  var listLast;
  var listStepping;
  function __run282() {
    listPast = [], listLast = false, listStepping = Promise.resolve();
  }
  function listDid(undo2, redo, e) {
    e = e || { undo: undo2, redo };
    e.at = V.tick(true);
    listPast.push(e);
    if (listPast.length > 100) listPast.shift();
    shared.listAhead = [];
    listLast = true;
  }
  function listTop(back2) {
    var s = back2 ? listPast : shared.listAhead;
    return s.length ? s[s.length - 1].at || 0 : 0;
  }
  function toList() {
    var list2 = document.getElementById("m2-list");
    return !!(list2 && list2.offsetParent) && !(V.grid.classList.contains("m2-editing") && !listLast);
  }
  function listGo(back2) {
    var tl = toList();
    if (V.setFirst(back2, tl ? listTop(back2) : mapTop(back2))) return true;
    if (!tl) return false;
    listStep(back2);
    return true;
  }
  function listStep(back2) {
    var s = (back2 ? listPast : shared.listAhead).pop();
    if (!s) return;
    s.at = V.tick();
    (back2 ? shared.listAhead : listPast).push(s);
    listStepping = listStepping.then(function() {
      return new Promise(function(ok) {
        ok(back2 ? s.undo() : s.redo());
      }).catch(function() {
      }).then(function() {
        V.refreshMine();
      });
    });
  }
  function listCur(id, site2) {
    return V.byId[id] || site2 && V.byId[site2] || null;
  }
  function listKey(m) {
    return { id: m.id, site: mine[m.id] ? mine[m.id].site || null : null };
  }
  function leaveIf(ks) {
    if (!V.grid.classList.contains("m2-editing") || !V.chosen || !ks.some(function(k) {
      var c = listCur(k.id, k.site);
      return c && c.id === V.chosen.id;
    })) return;
    V.win = "list";
    V.railMark();
    if (V.chosen) V.put(V.chosen);
    else stop();
  }
  function binKeys(ks) {
    leaveIf(ks);
    var ms = ks.map(function(k) {
      return listCur(k.id, k.site);
    }).filter(function(m) {
      return m && !m.binned;
    });
    return ms.length ? binMany(ms) : null;
  }
  function restoreKeys(ks) {
    return Promise.all(ks.map(function(k) {
      var m = listCur(k.id, k.site);
      return m && m.binned ? restore(m) : null;
    }));
  }
  function binU(ms, many) {
    var ks = ms.map(listKey), fwd = Promise.resolve(many ? binMany(ms) : bin(ms[0]));
    listDid(function() {
      return fwd.then(function() {
        return restoreKeys(ks);
      });
    }, function() {
      return binKeys(ks);
    });
    return fwd;
  }
  function restoreU(m) {
    var ks = [listKey(parentOf(m))], had = mineGroups().slice(), fwd = restore(m), made2 = mineGroups().filter(function(g) {
      return had.indexOf(g) < 0;
    })[0];
    listDid(function() {
      return fwd.then(function() {
        return binKeys(ks);
      }).then(function() {
        if (made2 && !inGroup(made2).length) groupGo(made2);
      });
    }, function() {
      return restoreKeys(ks);
    });
  }
  function restoreManyU(ms) {
    var ks = ms.map(parentOf).map(listKey), had = mineGroups().slice(), fwd = restoreKeys(ks), made2 = mineGroups().filter(function(g) {
      return had.indexOf(g) < 0;
    });
    listDid(function() {
      return fwd.then(function() {
        return binKeys(ks);
      }).then(function() {
        made2.forEach(function(g) {
          if (!inGroup(g).length) groupGo(g);
        });
      });
    }, function() {
      return restoreKeys(ks);
    });
    return fwd;
  }
  function listMade(run) {
    var ks = [], at2 = location.hash.slice(1);
    var e = {
      undo: function() {
        return fwd.then(function() {
          var on1 = ks.some(function(k) {
            var c = listCur(k.id, k.site);
            return c && c.id === location.hash.slice(1);
          });
          return Promise.resolve(binKeys(ks)).then(function() {
            if (on1 && at2 && V.byId[at2] && !V.byId[at2].binned) V.go(at2);
          });
        });
      },
      redo: function() {
        return Promise.resolve(restoreKeys(ks)).then(function() {
          var c = ks.length === 1 && listCur(ks[0].id, ks[0].site);
          if (c) V.go(c.id);
        });
      }
    };
    var fwd = mineIn.then(function() {
      var had = {};
      Object.keys(mine).forEach(function(id) {
        had[id] = !mine[id].hidden;
      });
      return Promise.resolve(run()).then(function() {
        Object.keys(mine).forEach(function(id) {
          if (!had[id] && !mine[id].hidden) ks.push(listKey(mine[id]));
        });
        if (!ks.length) listPast.splice(listPast.indexOf(e) >>> 0, 1);
      });
    });
    listDid(e.undo, e.redo, e);
    return fwd;
  }
  function moveU(ids, g, before) {
    var o = V.orderNow(), o2 = null, gh2 = !!(repo() && token());
    var was = ids.map(function(id) {
      var m = V.byId[id], s = (V.siteList || []).filter(function(x) {
        return x.id === id;
      })[0];
      return { id, g: m ? m.group || "" : "", name: m ? mapName(m) : "", mv: V.movedOf(id), s: !mine[id] && s, page: !mine[id] && !!m && gh2 && canRename(m, true) && !ownGroup(g || "") };
    });
    var fwd = (ids.length > 1 ? moveMany(ids, g, before) : moveTo(ids[0], g, before)).then(function() {
      was.forEach(function(w) {
        w.pw = pageWas[w.id];
        delete pageWas[w.id];
      });
      o2 = V.orderNow();
    });
    listDid(function() {
      return fwd.then(function() {
        return was.reduce(function(p, w) {
          return p.then(function() {
            var m = V.byId[w.id];
            if (!m) return;
            if (!w.s) return moveTo(w.id, w.g);
            V.setMoved(w.id, w.page ? w.g : w.mv);
            if (w.page && (m.group || "") !== w.g) {
              var o3 = w.pw && w.pw.order != null ? w.pw.order : w.s.order, set = { group: JSON.stringify((ownGroup(w.g) ? w.s.group || "" : w.g).replace(/["\\]/g, "")) };
              if (o3 != null) set.order = String(o3);
              if (w.s.example) set.example = "true";
              return siteFront(w.id, { set }, "Map moved back in the viewer").catch(function() {
              });
            }
          }).then(function() {
            var m = V.byId[w.id], n = renamed[w.id];
            if (m && mapName(m) !== w.name) return nameTo(m, w.name, !mine[w.id] && (n ? !!n.local : !gh2));
          });
        }, Promise.resolve()).then(function() {
          V.orderPut(o);
        });
      });
    }, function() {
      return moveMany(ids, g, before).then(function() {
        if (o2) V.orderPut(o2);
      });
    });
    return fwd;
  }
  function removeU(name2) {
    var gs = mineGroups().slice(), at2 = gs.indexOf(name2), o = V.orderNow(), shut = !!V.closed[name2];
    var recs = Object.keys(mine).filter(function(id) {
      return mine[id].group === name2;
    });
    var moved = (V.siteList || []).filter(function(m) {
      return V.movedOf(m.id) === name2;
    }).map(function(m) {
      return m.id;
    });
    removeGroup(name2);
    listDid(function() {
      recs.forEach(function(id) {
        var r = mine[id];
        if (r) {
          r.group = name2;
          minePut(r).catch(function() {
          });
        }
      });
      moved.forEach(function(id) {
        V.setMoved(id, name2);
      });
      if (shut) {
        V.closed[name2] = true;
        V.saveClosed();
      }
      groupBack(name2, at2);
      V.orderPut(o);
    }, function() {
      removeGroup(name2);
    });
  }
  var own;
  function __run292() {
    window.addEventListener("pointerdown", function(e) {
      var t = e.target.closest ? e.target : e.target.parentElement;
      if (t && t.closest(".m2-cx, #m2-ed-undo, #m2-ed-redo")) return;
      listLast = !!(t && t.closest("#m2-list")) && !(V.grid.classList.contains("m2-editing") && t.closest(".m2-map"));
    }, true);
    window.addEventListener("keydown", function(e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = V.letter(e);
      if (k !== "z" && k !== "y") return;
      if (naming || V.typing()) return;
      if (!listGo(k === "z" && !e.shiftKey)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    own = {
      read: function() {
        return mineIn;
      },
      here: function() {
        return groupsHere = mineGroupsHere();
      },
      groups: function() {
        return groupsHere;
      },
      order: mineGroups,
      // order: every group the reader made, on the site or not, in their order
      withMine,
      addPaint,
      isGroup: ownGroup,
      movable,
      moveTo: function(id, g, before) {
        return moveU([id], g, before);
      },
      moveMany: moveU,
      did: listDid,
      rename: renameGroup,
      canRenameGroup,
      renameMap,
      canRename,
      newMap: function(g, f) {
        return listMade(function() {
          return newMap(g, f);
        });
      },
      shown: mineShown,
      listItems,
      rec: function(id) {
        return mine[id] || null;
      },
      naming: function() {
        return !!naming;
      },
      isTop,
      cloud: cloudOn,
      waitLine: waitText,
      tool: { kind: function(id) {
        return fmtOf(V.byId[id] || {});
      }, name: function(id) {
        var m = V.byId[id];
        return m ? mapName(m) : "";
      }, text: function(id) {
        var m = V.byId[id];
        return m ? textNow(m) : Promise.reject(new Error("the map is no longer in the list"));
      }, add: fromTool }
      // what a tool's run is handed (tools.js)
    };
    mineIn.then(upAll).then(binMigrate);
    mineIn.then(function() {
      projRecs();
    });
  }
  function __start7() {
    __run110();
    __run26();
    __run36();
    __run43();
    __run55();
    __run65();
    __run75();
    __run83();
    __run92();
    __run102();
    __run11();
    __run123();
    __run133();
    __run143();
    __run153();
    __run163();
    __run172();
    __run182();
    __run192();
    __run202();
    __run212();
    __run223();
    __run233();
    __run243();
    __run252();
    __run262();
    __run272();
    __run282();
    __run292();
    __run302();
    __run312();
  }

  // editor/src/create.js
  var import_notation2 = __toESM(require_notation());
  var PRESET;
  function __run111() {
    PRESET = { "nucleic acid feature ct:gene": ["nucleic acid feature", ["ct:gene"]], "nucleic acid feature ct:mRNA": ["nucleic acid feature", ["ct:mRNA"]] };
  }
  function baseKind(k) {
    return PRESET[k] ? PRESET[k][0] : k;
  }
  var PAL_PD;
  var PHENO;
  var OTHER;
  var GATES_PD;
  var ARC_PD;
  var DELAY;
  var INFL;
  var ACT;
  var ACT_UNIT;
  var ACT_NAME;
  var ACTS;
  var PD_SIGN;
  var ACTS_CD;
  var NAF_ACT;
  var NAF_CT;
  var nafSplit;
  var ACT_PROT;
  var ACT_REST;
  var ACT_REST_CD;
  var PERT;
  var LOGIC;
  function __run210() {
    PAL_PD = [
      // groups named as SBGN's PD reference card, ordered
      // nodes first, the gates, the arcs last; the gates and the arcs each start a block of the one list (palSigns);
      // each sign fills the 24-unit box as far as the tools' own signs do (as large as the ? beside them)
      ["Entity pool nodes", [
        ["macromolecule", "Macromolecule", '<rect x="1.5" y="5" width="21" height="14" rx="3.5"/>'],
        ["simple chemical", "Simple chemical", '<circle cx="12" cy="12" r="7"/>'],
        // as tall as the macromolecule's sign
        // two presets in place of the bare one (conceptual type gene and conceptual type mRNA, so the kind is always clear
        // and compatible: CellDesigner has a gene and an RNA, no nucleic acid feature): each
        // made with its unit of information (PRESET), which can be retyped or deleted as any other; the signs' words centred
        // in the shape at one size, mRNA in its own capitals (the unit made stays ct:mRNA)
        ["nucleic acid feature ct:gene", "Nucleic acid feature, ct:gene", '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/><text x="12" y="14" text-anchor="middle" font-size="5.5">gene</text>'],
        ["nucleic acid feature ct:mRNA", "Nucleic acid feature, ct:mRNA", '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/><text x="12" y="14" text-anchor="middle" font-size="5.5">mRNA</text>'],
        ["unspecified entity", "Unspecified entity", '<ellipse cx="12" cy="12" rx="10.5" ry="7"/>'],
        ["complex", "Complex", '<path d="M6 4h12l4 4v8l-4 4h-12l-4-4v-8z"/>'],
        ["perturbing agent", "Perturbing agent", '<path d="M1.5 5h21l-3.5 7 3.5 7h-21l3.5-7z"/>'],
        ["source and sink", "Empty set (source and sink)", '<circle cx="12" cy="12" r="8"/><path d="M4 20l16-16"/>']
      ]],
      // processes (process, omitted, uncertain; no association or dissociation, by choice): a bare
      // square, its antennas grown by its first arc; the other kinds from its right-click menu too
      ["Process nodes", [
        ["process", "Process", '<rect x="5" y="5" width="14" height="14"/>'],
        ["omitted process", "Omitted process", '<rect x="5" y="5" width="14" height="14"/><path d="M9 15l2.5-6M12.5 15l2.5-6" class="in"/>'],
        ["uncertain process", "Uncertain process", '<rect x="5" y="5" width="14" height="14"/><path d="M9.8 10.2a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.6" class="in"/><circle class="dot" cx="12" cy="16.4" r=".8"/>'],
        ["phenotype", "Phenotype", '<path d="M6 5h12l4.5 7-4.5 7h-12l-4.5-7z"/>']
      ]],
      // the card's one-sign sections (Container Nodes, Encapsulation Node) joined, as Newt's Other nodes (no
      // group of a single sign)
      ["Other nodes", [
        ["compartment", "Compartment", '<rect x="1.5" y="3" width="21" height="18" rx="4.5" stroke-width="2.2"/>'],
        ["submap", "Submap", '<rect x="1.5" y="4" width="21" height="16"/>'],
        // a tag: dropped on a submap's border it is that submap's terminal, sliding along it; elsewhere a free tag. Only
        // with the palette's CellDesigner compatible unticked (CellDesigner has neither; compat()); its sign the
        // macromolecule's box with the phenotype's point
        ["tag", "Tag / terminal", '<path d="M1.5 5h16.5l4.5 7-4.5 7h-16.5z"/>']
      ]],
      // logic gates (with SBGN's equivalence operator), a
      // circle with its word or sign, made bare as a process, its antennas grown by its arcs; marks inside a sign are class
      // 'in', a dot class 'dot', letters plain <text>: their weight is the Edit window's one rule (atlas-app.html, Sign weights)
      ["Logical operators", [
        ["and", "AND", '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">AND</text>'],
        ["or", "OR", '<circle cx="12" cy="12" r="10"/><text x="12" y="14.9" text-anchor="middle" font-size="8.2">OR</text>'],
        ["not", "NOT", '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">NOT</text>'],
        ["equivalence", "Equivalence", '<circle cx="12" cy="12" r="10"/><path d="M7.5 8.8h9M7.5 12h9M7.5 15.2h9" class="in"/>']
      ], true],
      // arcs: drawn by a drag from a node with the arc's sign picked
      ["Connecting arcs", [
        ["consumption", "Consumption / logic arc", '<path d="M3 12h18"/>'],
        ["production", "Production", '<path d="M3 12h11"/><path d="M13 7.5l8 4.5-8 4.5z" fill="currentColor"/>'],
        // the modulations, by use: catalysis, the most used, first; modulation, the least used, last
        ["catalysis", "Catalysis", '<path d="M3 12h12"/><circle cx="18" cy="12" r="3"/>'],
        ["stimulation", "Stimulation", '<path d="M3 12h10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ["inhibition", "Inhibition", '<path d="M3 12h17M20 6v12"/>'],
        ["necessary stimulation", "Necessary stimulation", '<path d="M3 12h10M10 7v10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ["modulation", "Modulation", '<path d="M3 12h10"/><path d="M13 12l4-4 4 4-4 4z"/>']
      ], true]
    ];
    PHENO = PAL_PD[1][1].filter(function(q) {
      return q[0] === "phenotype";
    })[0], OTHER = PAL_PD[2];
    GATES_PD = PAL_PD[3][1], ARC_PD = {};
    PAL_PD[4][1].forEach(function(q) {
      ARC_PD[q[0]] = q;
    });
    DELAY = ["delay", "Delay", '<circle cx="12" cy="12" r="10"/><text x="12" y="17" text-anchor="middle" font-size="14" font-family="Times New Roman, serif" fill="currentColor" stroke="none">\u03C4</text>'];
    INFL = [["stimulation", "Positive influence"], ["inhibition", "Negative influence"], ["modulation", "Unknown influence"], ["necessary stimulation", "Necessary stimulation"]];
    ACT = ["activity", "Activity", '<rect x="1.5" y="5" width="21" height="14"/>'];
    ACT_UNIT = { activity: "" }, ACT_NAME = {};
    ACTS = [ACT].concat([
      ["macromolecule", "Protein activity", '<rect x="10.5" y="2.5" width="10" height="5" rx="1.6"/>', 10.5, 20.5],
      ["simple chemical", "Metabolite activity", '<circle cx="18" cy="5" r="2.5"/>', 15.5, 20.5],
      ["nucleic acid feature", "Nucleic acid feature activity", '<path d="M10.5 2.5h10v3.4q0 1.6-1.6 1.6h-6.8q-1.6 0-1.6-1.6z"/>', 10.5, 20.5],
      ["complex", "Complex activity", '<path d="M12 2.5h7l1.5 1.5v2l-1.5 1.5h-7l-1.5-1.5v-2z"/>', 10.5, 20.5],
      ["unspecified entity", "Unspecified entity activity", '<ellipse cx="15.5" cy="5" rx="5" ry="2.5"/>', 10.5, 20.5]
    ].map(function(q) {
      var kind = q[1].toLowerCase();
      ACT_UNIT[kind] = q[0];
      ACT_NAME[q[0]] = kind;
      return [kind, q[1], '<path d="M' + q[3] + " 5H1.5v14h21V5H" + q[4] + '"/><g class="in">' + q[2] + "</g>"];
    }));
    PD_SIGN = {};
    PAL_PD[0][1].forEach(function(q) {
      PD_SIGN[q[0]] = q[2];
    });
    PD_SIGN["nucleic acid feature"] = '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/>';
    ACTS_CD = ["macromolecule", "simple chemical", "nucleic acid feature", "complex", "unspecified entity"].map(function(c) {
      var k = ACT_NAME[c];
      return [c === "macromolecule" ? "activity" : k, ACTS.filter(function(q) {
        return q[0] === k;
      })[0][1], PD_SIGN[c]];
    });
    NAF_ACT = "nucleic acid feature activity", NAF_CT = [["ct:gene", "gene"], ["ct:mRNA", "mRNA"]];
    NAF_CT.forEach(function(q) {
      PRESET[NAF_ACT + " " + q[0]] = [NAF_ACT, [q[0]]];
    });
    nafSplit = function(set, sbgnLook) {
      return [].concat.apply([], set.map(function(q) {
        if (q[0] !== NAF_ACT) return [q];
        return NAF_CT.map(function(c) {
          var sign = sbgnLook ? q[2] + '<text x="12" y="15.9" text-anchor="middle" font-size="5.5">' + c[1] + "</text>" : PAL_PD[0][1].filter(function(p) {
            return p[0] === "nucleic acid feature " + c[0];
          })[0][2];
          return [NAF_ACT + " " + c[0], q[1] + ", " + c[0], sign];
        });
      }));
    };
    ACTS = nafSplit(ACTS, true);
    ACTS_CD = nafSplit(ACTS_CD, false);
    ACT_PROT = ACTS.filter(function(q) {
      return q[0] === "protein activity";
    })[0];
    ACT_REST = ACTS.filter(function(q) {
      return q !== ACT && q !== ACT_PROT;
    }), ACT_REST_CD = ACTS_CD.filter(function(q) {
      return q[0] !== "activity";
    });
    PERT = ["perturbing agent", "Perturbation", PAL_PD[0][1].filter(function(q) {
      return q[0] === "perturbing agent";
    })[0][2]];
    LOGIC = ["logic arc", "Logic arc", '<path d="M3 12h18"/>'];
  }
  function palAf(sbgnLook, prot) {
    var first = prot ? ACT_PROT : ACT;
    return [
      ["Activity nodes", [sbgnLook ? first : [first[0], first[1], PD_SIGN.macromolecule]].concat(sbgnLook ? ACT_REST : ACT_REST_CD, [PHENO, PERT])],
      OTHER,
      ["Logical operators", GATES_PD.concat([DELAY]), true],
      ["Arcs", INFL.map(function(x) {
        var q = ARC_PD[x[0]];
        return [q[0], sbgnLook || x[0] === "necessary stimulation" ? x[1] : q[1] + " (" + x[1].toLowerCase() + ")", q[2]];
      }).concat([LOGIC]), true]
    ];
  }
  var PALS;
  var ARCS;
  var MODK;
  function __run37() {
    PALS = { pd: PAL_PD, rn: palAf(false), sbgn: palAf(true), rnP: palAf(false, true), sbgnP: palAf(true, true) };
    ARCS = {}, MODK = {};
    PAL_PD[4][1].forEach(function(q) {
      ARCS[q[0]] = 1;
      if (!/^(consumption|production)$/.test(q[0])) MODK[q[0]] = 1;
    });
    ARCS["logic arc"] = 1;
  }
  function arcTool() {
    return tool && ARCS[tool.kind] ? tool.kind : null;
  }
  var tool;
  var pal;
  var PAL_KEY;
  var palSet;
  function __run44() {
    tool = null;
    pal = document.createElement("div");
    pal.className = "m2-ed-palette";
    pal.hidden = true;
    pal.setAttribute("role", "toolbar");
    pal.setAttribute("aria-label", "Palette");
    PAL_KEY = "atlas-edit-palette", palSet = { lang: "pd", look: "rn" };
  }
  function palStore() {
    try {
      return JSON.parse(localStorage.getItem(PAL_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function palId() {
    return site && (site.id || site.path) || name || null;
  }
  function palFor() {
    var all = palStore(), id = palId(), k = id && all[id];
    if (k && (k.lang === "pd" || k.lang === "af")) return { lang: k.lang, look: k.look === "sbgn" ? "sbgn" : "rn", strict: k.strict === true, sbgn: k.sbgn === true };
    var af = sbFileAf();
    return { lang: af ? "af" : "pd", look: af ? "sbgn" : "rn", strict: false, sbgn: false };
  }
  function palKeep() {
    var all = palStore(), id = palId();
    if (!id) return;
    all[id] = palSet;
    try {
      localStorage.setItem(PAL_KEY, JSON.stringify(all));
    } catch (e) {
    }
  }
  function palSign(q) {
    return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + (ARCS[q[0]] ? ": picked, a drag from one node to another draws it (click: once; double click: several)" : CD_GATE[q[0]] ? ": click its inputs, then the reaction\u2019s square or the target species (click: once; double click: several)" : " (click: once; double click: several)") + '" aria-label="' + q[1] + '" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + q[2] + "</svg></button>";
  }
  function palSigns(set) {
    var blocks = [];
    set.forEach(function(s, i) {
      if (!i || s[2]) blocks.push(0);
      blocks[blocks.length - 1] += s[1].length;
    });
    return '<div class="m2-ed-prow" data-blocks="' + blocks.join(",") + '">' + set.map(function(s, i) {
      return (i && s[2] ? '<span class="m2-ed-pbr" aria-hidden="true"></span>' : "") + s[1].map(palSign).join("");
    }).join("") + "</div>";
  }
  function hybOn() {
    return palLangNow() === "pd" && palSet.strict !== true && !sbgnStrict();
  }
  function sbgnStrict() {
    return palLangNow() === "pd" && palSet.sbgn === true;
  }
  function palLangNow() {
    return palSet.lang === "af" ? "af" : "pd";
  }
  function palViews() {
    var k = palKind();
    return palLangNow() === "af" && (k === "af" || k === "empty");
  }
  function afMap() {
    return palOn() && palLangNow() === "af";
  }
  function palLookNow() {
    return palViews() && palSet.look === "sbgn" ? "sbgn" : "rn";
  }
  function palBtn(attr, title, sign) {
    return '<button type="button" ' + attr + ' title="' + title + '" aria-label="' + title + '" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + sign + "</svg></button>";
  }
  function palView(look, name2, title) {
    return '<button type="button" role="radio" data-look="' + look + '" title="' + title + '" aria-label="' + title + '" aria-checked="false"><span class="m2-ed-radio" aria-hidden="true"></span>' + name2 + "</button>";
  }
  var INFO;
  function __run56() {
    INFO = {
      strict: "Corresponds to CellDesigner's Reduced Notation. Stimulation, inhibition, necessary stimulation and modulation may also link entities, phenotypes and submaps. Such maps open in CellDesigner and MINERVA, but other SBGN-ML tools may not read them. Unticked, the SBGN Process Description rules alone. Off while Strict SBGN is ticked.",
      sbgnPd: "Keeps what is drawn from now on to the SBGN Process Description specification alone: no reduced notation, one catalysis and one necessary stimulation per process, one line at an empty set, no line from a phenotype. Unticked, the default, the specification and what CellDesigner also allows, such as a phenotype as a reaction's reactant or modifier. What the map already holds is not changed.",
      rn: "Corresponds to CellDesigner's Reduced Notation palette, which enables an Activity Flow type of representation.",
      sbgn: "Follows the SBGN Activity Flow specification. The map is saved as an Activity Flow SBGN-ML file.",
      prot: "When ticked, shows the auxiliary unit on protein activities. An activity with no auxiliary unit is by default a protein activity.",
      sites: "A state variable shows its site (P@S1177). Unticked, only the value (P): an SBGN-ML map is saved so, its sites kept in the glyphs' notes, and they come back when ticked.",
      cdc: "Keeps maps to what CellDesigner and MINERVA can hold. Unticked, the palette also offers tags, and submaps with terminals on their border. What a map already holds is not changed by it."
    };
  }
  function palTip(line2, name2, t) {
    t = t.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return '<div class="m2-ed-pline">' + line2 + '<button type="button" class="m2-ed-pinfo m2-ed-ptip m2-itip" aria-label="About ' + name2 + '" title="About ' + name2 + '" data-info="' + t + '" aria-expanded="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg></button></div>';
  }
  var palSignsEl;
  function __run66() {
    pal.innerHTML = '<div class="m2-ed-prow m2-ed-pnot" role="group" aria-label="Notation">' + palBtn('data-lang="pd"', "Process Description", '<text x="12" y="17.3" text-anchor="middle" font-size="15">PD</text>') + palBtn('data-lang="af"', "Activity Flow", '<text x="12" y="17.3" text-anchor="middle" font-size="15">AF</text>') + '</div><div class="m2-ed-plook" role="radiogroup" aria-label="Activity Flow view">' + palTip(palView("rn", "Reduced notation view", "Reduced notation view: each activity drawn as its entity"), "Reduced notation view", INFO.rn) + palTip(palView("sbgn", "SBGN AF view", "SBGN Activity Flow view: each entity drawn as its SBGN activity"), "SBGN Activity Flow view", INFO.sbgn) + '</div><div class="m2-ed-pblk m2-ed-pprot">' + palTip('<label class="m2-ed-phyb" title="Ticked: every protein activity carries the auxiliary unit of a macromolecule, drawn and saved in the file; unticked: none has it"><input type="checkbox"><span>Protein auxiliary unit</span></label>', "Protein auxiliary unit", INFO.prot) + '</div><div class="m2-ed-pblk m2-ed-pcdc">' + palTip('<label class="m2-ed-phyb" title="Ticked: the palette offers only what CellDesigner and MINERVA can hold; unticked: tags and submaps\u2019 terminals too"><input type="checkbox"><span>CellDesigner compatible</span></label>', "CellDesigner compatible", INFO.cdc) + '</div><div class="m2-ed-pblk m2-ed-psbgn">' + palTip('<label class="m2-ed-phyb" title="Ticked: what is drawn keeps to the SBGN PD specification alone; unticked: CellDesigner\u2019s additions too"><input type="checkbox"><span>Strict SBGN</span></label>', "Strict SBGN", INFO.sbgnPd) + '</div><div class="m2-ed-pblk m2-ed-pstrict">' + palTip('<label class="m2-ed-phyb" title="Ticked (the default): under PD a modulation may also end on an entity, and a logic gate\u2019s output go to one (CellDesigner\u2019s reduced notation); with a process on the map the file stays Process Description, without one such a link makes it Activity Flow. Unticked: Process Description only"><input type="checkbox"><span>Reduced notation</span></label>', "Reduced notation", INFO.strict) + '</div><div class="m2-ed-pblk m2-ed-psites">' + palTip('<label class="m2-ed-phyb" title="Ticked: every state variable shows its site and the map is saved so; unticked: the value alone, the sites kept in the notes"><input type="checkbox"><span>Show sites</span></label>', "Show sites", INFO.sites) + '</div><div class="m2-ed-psigns"></div>';
    palSignsEl = pal.querySelector(".m2-ed-psigns");
  }
  function palBlocks() {
    var row = palSignsEl.querySelector(".m2-ed-prow[data-blocks]"), b = row && row.querySelector("button");
    if (!row || !b) return;
    var n = row.dataset.blocks.split(",").map(Number), all = n.reduce(function(a, x) {
      return a + x;
    }, 0);
    var gap = parseFloat(getComputedStyle(row).columnGap) || 0, step2 = b.offsetWidth + gap, most = parseFloat(getComputedStyle(pal).maxWidth) || row.clientWidth;
    var cols = Math.max(1, Math.floor((row.clientWidth + gap) / step2)), top = Math.max(cols, Math.floor((most + gap) / step2)), flat = false;
    for (var c = cols; c < top && !flat; c++) flat = n.reduce(function(a, x) {
      return a + Math.ceil(x / c);
    }, 0) > Math.ceil(all / c);
    row.classList.toggle("m2-ed-pflat", flat);
  }
  function __run76() {
    if (window.ResizeObserver) new ResizeObserver(palBlocks).observe(palSignsEl);
  }
  function palKey() {
    return palLangNow() === "pd" ? "pd" : palLookNow() + (protOn ? "P" : "");
  }
  var EXTENDED;
  var CDC_KEY;
  function __run84() {
    EXTENDED = { tag: 1, delay: 1 };
    CDC_KEY = "atlas-cd-compatible";
  }
  function compat() {
    try {
      return localStorage.getItem(CDC_KEY) === "on";
    } catch (e) {
      return false;
    }
  }
  function palSet0(set) {
    return compat() ? set.map(function(g) {
      return [g[0], g[1].filter(function(q) {
        return !EXTENDED[q[0]];
      }), g[2]];
    }) : set;
  }
  var protOn;
  var protMemo;
  function __run93() {
    protOn = false, protMemo = [null, null];
  }
  function protFile() {
    if (protMemo[0] === shared.text) return protMemo[1];
    var A = sbJs.activities(shared.text, null, true), u = Object.keys(A).map(function(k) {
      return A[k];
    }).filter(function(x) {
      return x === "" || x === "macromolecule";
    });
    var r = !u.length ? null : u.every(function(x) {
      return x === "macromolecule";
    }) ? true : u.every(function(x) {
      return x === "";
    }) ? false : null;
    protMemo = [shared.text, r];
    return r;
  }
  var pmap;
  var ddOpen;
  function __run103() {
    pmap = document.createElement("div");
    pmap.className = "m2-ed-pmap";
    pmap.hidden = true;
    pmap.innerHTML = '<table class="m2-ed-ptab"></table>';
    ddOpen = null;
  }
  function ddClose() {
    if (!ddOpen) return;
    var f = ddOpen._r.querySelector(".m2-ed-pdd"), back2 = ddOpen._keys && ddOpen.contains(document.activeElement);
    f.setAttribute("aria-expanded", "false");
    ddOpen.remove();
    ddOpen = null;
    if (back2) f.focus();
  }
  function __run112() {
    document.addEventListener("pointerdown", function(e) {
      if (ddOpen && !ddOpen.contains(e.target) && !ddOpen._r.contains(e.target)) ddClose();
    }, true);
    document.addEventListener("keydown", function(e) {
      if (!ddOpen || e.key === "Enter" || e.key === " " || /^(Shift|Control|Alt|Meta)$/.test(e.key)) return;
      if (!/^(ArrowDown|ArrowUp|Escape)$/.test(e.key)) {
        ddClose();
        return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === "Escape") {
        ddClose();
        return;
      }
      var list2 = Array.prototype.slice.call(ddOpen.querySelectorAll("button"));
      if (!list2.length) return;
      var i = list2.indexOf(document.activeElement), d = e.key === "ArrowDown" ? 1 : -1;
      if (i < 0) i = list2.findIndex(function(b) {
        return b.getAttribute("aria-selected") === "true";
      });
      list2[i < 0 ? d > 0 ? 0 : list2.length - 1 : (i + d + list2.length) % list2.length].focus();
    }, true);
    window.addEventListener("resize", ddClose);
    document.addEventListener("scroll", function(e) {
      if (ddOpen && !ddOpen.contains(e.target)) ddClose();
    }, true);
  }
  function palDrop(o) {
    var r = pmap.querySelector('tr[data-k="' + o.key + '"]');
    if (!r) {
      r = document.createElement("tr");
      r.dataset.k = o.key;
      r.innerHTML = '<th></th><td><button type="button" class="m2-ed-pdd" aria-haspopup="listbox" aria-expanded="false"><span></span><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button></td>';
      var bx2 = r.querySelector("button");
      bx2.addEventListener("click", function(e) {
        e.stopPropagation();
        var was = ddOpen && ddOpen._r === r, keys = e.detail === 0;
        ddClose();
        bx2.blur();
        if (was) return;
        var q = r._o, m = q.get(), box3 = document.createElement("div");
        box3.className = "m2-cx m2-ed-pdl";
        box3.setAttribute("role", "listbox");
        box3.setAttribute("aria-label", q.label);
        q.list.forEach(function(c) {
          var b = document.createElement("button");
          b.type = "button";
          b.setAttribute("role", "option");
          b.setAttribute("aria-selected", String(c[0] === m));
          b.title = c[2];
          b.innerHTML = "<span>" + c[1] + "</span>" + (q.sq ? q.sq(c[0]) : "");
          b.addEventListener("click", function(ev) {
            ev.stopPropagation();
            var same2 = box3._t === src();
            ddClose();
            if (same2) {
              q.set(c[0]);
              palDrop(q);
            }
          });
          box3.appendChild(b);
        });
        document.body.appendChild(box3);
        var f2 = bx2.getBoundingClientRect(), k = box3.getBoundingClientRect().width / box3.offsetWidth || 1;
        box3.style.minWidth = f2.width / k + "px";
        var w = box3.offsetWidth * k, h = box3.offsetHeight * k, below = V.winH() - 4 - f2.bottom, above = f2.top - 4;
        var y = h + 2 * k <= below || below >= above ? f2.bottom + 2 * k : f2.top - 2 * k - h;
        box3.style.left = Math.max(4, Math.min(f2.left, V.winW() - 4 - w)) / k + "px";
        box3.style.top = Math.max(4, Math.min(y, V.winH() - 4 - h)) / k + "px";
        ddOpen = box3;
        box3._r = r;
        box3._t = src();
        box3._list = q.list;
        box3._keys = keys;
        bx2.setAttribute("aria-expanded", "true");
        if (keys) {
          var s = box3.querySelector('[aria-selected="true"]') || box3.firstChild;
          if (s) s.focus();
        }
      });
      pmap.firstChild.appendChild(r);
    }
    r._o = o;
    if (ddOpen && ddOpen._r === r && (ddOpen._t !== src() || ddOpen._list !== o.list)) ddClose();
    var th = r.firstChild, f = r.querySelector(".m2-ed-pdd"), cur = o.get(), v = o.list.filter(function(c) {
      return c[0] === cur;
    })[0][1];
    if (th.textContent !== o.label) th.textContent = o.label;
    if (f.title !== o.title) {
      f.title = o.title;
      f.setAttribute("aria-label", o.label + ", " + o.title);
    }
    if (f.firstChild.textContent !== v) f.firstChild.textContent = v;
    return r;
  }
  var CHOICE_KEY;
  var choiceMemo;
  function __run124() {
    CHOICE_KEY = "atlas-edit-map-choices", choiceMemo = {};
    try {
      ["atlas-edit-style", "atlas-edit-sb-colours", "atlas-edit-cd-colours"].forEach(function(k) {
        localStorage.removeItem(k);
      });
    } catch (e) {
    }
  }
  function choicesKept() {
    try {
      return JSON.parse(localStorage.getItem(CHOICE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function mapChoice(what, ids) {
    var id = palId(), k = id && choicesKept()[id], v = k && k[what];
    return ids.indexOf(v) >= 0 ? v : null;
  }
  function keepMapChoice(what, v) {
    var all = choicesKept(), id = palId();
    choiceMemo = {};
    if (!id) return;
    (all[id] = all[id] || {})[what] = v;
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(all));
    } catch (e) {
    }
  }
  var ORIG_KEY;
  function __run134() {
    ORIG_KEY = "atlas-edit-originals";
  }
  function origAll() {
    try {
      return JSON.parse(localStorage.getItem(ORIG_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function origKeep(id, r) {
    var all = origAll();
    all[id] = r;
    try {
      localStorage.setItem(ORIG_KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      return false;
    }
  }
  var pickSeq;
  function __run144() {
    pickSeq = 0;
  }
  function colsPick(v, cur, take2, back2, recolour) {
    var id = palId(), seq = ++pickSeq;
    if (v === "file") {
      if (!id) {
        palDid([CHOICE_KEY], function() {
          keepMapChoice("cols", "file");
        });
        return;
      }
      var mine0 = origAll()[id] || null, s0 = site;
      Promise.all([origGh(), origFromFolder(id)]).then(function(o) {
        if (seq !== pickSeq || !on || site !== s0 || palId() !== id) return;
        var r2 = [o[0], o[1]].reduce(function(a, x) {
          return x && typeof x === "object" && (x.fill || x.node) && (!a || (x.at || 0) > (a.at || 0)) ? x : a;
        }, mine0);
        if (r2 && r2 !== mine0) origKeep(id, Object.assign({}, r2, { sent: r2 === o[0] ? 1 : void 0 }));
        if (!r2) {
          palDid([CHOICE_KEY], function() {
            keepMapChoice("cols", "file");
          });
          paint();
          return;
        }
        keepMapChoice("cols", "file");
        back2(r2);
        paint();
      });
      return;
    }
    if (id && cur === "file") {
      var r = take2(), was = origAll()[id], bare2 = function(o) {
        return JSON.stringify(Object.assign({}, o, { at: 0, sent: 0 }));
      };
      var same2 = !!was && bare2(was) === bare2(r);
      r.at = same2 ? was.at : Date.now();
      if (same2 && was.sent) r.sent = was.sent;
      if (!origKeep(id, r)) warn("The map\u2019s own colours could not be kept in this browser.");
      origToFolder(id, r);
      if (!r.sent) origPut(r, function() {
        var all = origAll();
        if (all[id] && all[id].at === r.at) {
          all[id].sent = 1;
          origKeep(id, all[id]);
        }
      });
    }
    keepMapChoice("cols", v);
    recolour(v);
  }
  function mapCols(ids, is) {
    var id = palId(), b = shared.F.beside(), M = choiceMemo;
    if (M.id === id && M.t === shared.text && M.b === b) return M.v;
    var key = b == null ? shared.text.replace(GEO, "") : null;
    if (M.id === id && b == null && M.key === key) {
      M.t = shared.text;
      return M.v;
    }
    var k = mapChoice("cols", ids), v = k === "custom" || k && is(k) !== false ? k : null;
    if (!v) ids.some(function(m) {
      return m !== "file" && m !== "custom" && is(m) === true && (v = m);
    });
    choiceMemo = { id, t: shared.text, b, key, v: v || "file" };
    return choiceMemo.v;
  }
  var STYLES;
  function __run154() {
    STYLES = [["file", "From map", "New nodes the size most nodes of their kind have on this map"], ["default", "Standard sizes", "New nodes at the standard sizes: CellDesigner\u2019s own on a CellDesigner map, the editor\u2019s on others"], ["custom", "Custom default", "New nodes the size kept by Set as default; From map for a kind with none"]];
  }
  function palStyle() {
    return mapChoice("style", ["file", "default", "custom"]) || "file";
  }
  function styleRow() {
    return palDrop({ key: "style", label: "Style", title: "Sizes of new nodes", list: STYLES, get: palStyle, set: function(v) {
      palDid([CHOICE_KEY], function() {
        keepMapChoice("style", v);
      });
    } });
  }
  function confettiHex(h) {
    var s = 0.55, l = 0.82, f = function(n) {
      var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return "#" + [f(0), f(8), f(4)].map(function(v) {
      return ("0" + Math.round(v * 255).toString(16)).slice(-2);
    }).join("");
  }
  function confettiFill(text) {
    return confettiPick(confettiHues(text));
  }
  function confettiHues(text) {
    var hues = [], re = /(?:#|color="[0-9a-fA-F]{2})([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\b/g, m;
    while (m = re.exec(String(text || ""))) {
      var r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
      var mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
      if (d <= 0.08) continue;
      var H2 = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hues.push((H2 * 60 + 360) % 360);
    }
    return hues;
  }
  function confettiPick(hues) {
    return confettiHex(confettiHue(hues));
  }
  function confettiLine(hues) {
    var h = confettiHue(hues), s = 0.7, l = 0.42, f = function(n) {
      var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return "#" + [f(0), f(8), f(4)].map(function(v) {
      return ("0" + Math.round(v * 255).toString(16)).slice(-2);
    }).join("");
  }
  function confettiHue(hues) {
    var best = 0, far = -1;
    for (var k = 0; k < 64; k++) {
      var h = k * 137.508 % 360, near2 = hues.reduce(function(n, u) {
        var a = Math.abs(h - u) % 360;
        return Math.min(n, a, 360 - a);
      }, 360);
      if (near2 > far + 1e-9) {
        far = near2;
        best = h;
      }
    }
    if (far < 1e-6) best = hues.length % 64 * 137.508 % 360;
    hues.push(best);
    return best;
  }
  var CONF;
  function __run164() {
    CONF = null;
  }
  function confettiOne(hex2) {
    if (!CONF) {
      CONF = {};
      for (var k = 0; k < 64; k++) CONF[confettiHex(k * 137.508 % 360).toUpperCase()] = 1;
    }
    return !!hex2 && CONF[String(hex2).slice(0, 7).toUpperCase()] === 1;
  }
  function confettiSquares() {
    return '<span class="m2-cs-sw">' + [0, 1, 2, 3, 4].map(function(k) {
      var x = confettiHex(k * 137.508 % 360);
      return '<i style="background:' + x + '" title="' + x.toUpperCase() + '"></i>';
    }).join("") + "</span>";
  }
  function palFill() {
    var k = palKey();
    var lang = palLangNow(), look = palLookNow();
    var pn = pal.querySelector(".m2-ed-pnot");
    pn.hidden = false;
    pn.style.display = "";
    styleRow();
    sbColsRow();
    Array.prototype.forEach.call(pmap.querySelectorAll("tr.m2-ed-pbg"), function(r) {
      r.remove();
    });
    Array.prototype.forEach.call(pal.querySelectorAll("[data-lang]"), function(b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    Array.prototype.forEach.call(pal.querySelectorAll("[data-look]"), function(b) {
      b.setAttribute("aria-checked", String(b.dataset.look === look));
    });
    pal.querySelector(".m2-ed-plook").hidden = !palViews();
    var hy = pal.querySelector(".m2-ed-pstrict"), hyc = hy.querySelector("input"), sg = pal.querySelector(".m2-ed-psbgn"), sgc = sg.querySelector("input");
    hy.hidden = sg.hidden = lang !== "pd";
    cdInfo(hy, false);
    if (sgc.checked !== sbgnStrict()) sgc.checked = sbgnStrict();
    var red = palSet.strict !== true;
    if (hyc.checked !== red) hyc.checked = red;
    hyc.disabled = sbgnStrict();
    hy.classList.toggle("m2-ed-poff", sbgnStrict());
    var pb = pal.querySelector(".m2-ed-pprot"), pbc = pb.querySelector("input");
    pb.hidden = !palViews();
    if (!pb.hidden) {
      var pf = protFile();
      if (pf != null) protOn = pf;
      k = palKey();
    }
    if (pbc.checked !== protOn) pbc.checked = protOn;
    var ps = pal.querySelector(".m2-ed-psites input");
    if (ps.checked !== !!V.sites) ps.checked = !!V.sites;
    var cc = pal.querySelector(".m2-ed-pcdc"), ccb = cc.querySelector("input");
    cc.hidden = false;
    if (ccb.checked !== compat()) ccb.checked = compat();
    if (shared.palShown === k + compat()) return;
    shared.palShown = k + compat();
    if (tool && !palOk(tool.kind)) tool = null;
    palSignsEl.innerHTML = palSigns(palSet0(PALS[k]));
    palBlocks();
  }
  function palLook() {
    var want = palOn() && palLookNow() === "sbgn";
    if (want === shared.afSbgn) return;
    shared.afSbgn = want;
    if (on && V.current === map && shared.F.afView) render();
  }
  function palPick(lang, look) {
    palSet = { lang: lang || palSet.lang, look: look || palSet.look, strict: palSet.strict, sbgn: palSet.sbgn };
    if (tool && !palOk(tool.kind)) tool = null;
    palKeep();
    palFill();
    palShow();
  }
  function palOk(kind) {
    return palSet0(PALS[palKey()]).some(function(s) {
      return s[1].some(function(q) {
        return q[0] === kind;
      });
    });
  }
  var palMap;
  function __run203() {
    pal.addEventListener("click", function(e) {
      var b = e.target.closest("button[data-lang], button[data-look]");
      if (b && !b.disabled) palDid([PAL_KEY], function() {
        palPick(b.dataset.lang, b.dataset.look);
      });
    });
    pal.querySelector(".m2-ed-pstrict input").addEventListener("change", function(e) {
      e.target.blur();
      if (cdPal()) return;
      palDid([PAL_KEY], function() {
        palSet.strict = !e.target.checked;
        palKeep();
      });
    });
    pal.querySelector(".m2-ed-psbgn input").addEventListener("change", function(e) {
      e.target.blur();
      if (cdPal()) return;
      palDid([PAL_KEY], function() {
        palSet.sbgn = e.target.checked;
        palKeep();
        palFill();
      });
    });
    pal.querySelector(".m2-ed-pcdc input").addEventListener("change", function(e) {
      var v = e.target.checked;
      e.target.blur();
      palDid([CDC_KEY], function() {
        try {
          if (v) localStorage.setItem(CDC_KEY, "on");
          else localStorage.removeItem(CDC_KEY);
        } catch (er) {
        }
      });
      if (tool && !palOk(tool.kind)) tool = null;
      shared.palShown = null;
      palShow();
      paint();
    });
    pal.querySelector(".m2-ed-psites input").addEventListener("change", function(e) {
      e.target.blur();
      if (V.setSites) V.setSites(e.target.checked);
    });
    pal.querySelector(".m2-ed-pprot input").addEventListener("change", function(e) {
      protOn = e.target.checked;
      e.target.blur();
      var t2 = palOn() ? sbJs.proteinBoxes(shared.text, protOn) : shared.text;
      commit(t2, { name: "protein boxes" });
      palShow();
      paint();
    });
    palMap = null;
  }
  function palAgain() {
    palMap = null;
    shared.cdStrictMemo = [null, false];
    choiceMemo = {};
    if (on) {
      palSync();
      shared.palShown = null;
      palShow();
      paint();
    }
  }
  function palDid(keys, act) {
    var id = palId(), was = V.lsSnap(keys.map(function(k) {
      return k === PAL_KEY || k === CHOICE_KEY ? id ? k + "#" + id : k : k;
    }));
    act();
    V.lsDid(was, palAgain);
  }
  function palSync() {
    var id = palId();
    if (id !== palMap) {
      palMap = id;
      palSet = palFor();
      protOn = protFile() === true;
      shared.palShown = null;
      palFill();
    }
  }
  function __run213() {
    box2.querySelector(".m2-ed-tools").insertAdjacentElement("afterend", pal);
  }
  function palShow() {
    var cdp_ = cdPal(), show = palOn() || cdp_;
    if (cdp_) cdFill();
    else if (show) {
      palSync();
      palFill();
    }
    pal.hidden = !show;
    pmap.hidden = !show || !!(shared.selN.length || shared.selE.length || shared.selP.length || shared.svSel);
    if (pmap.hidden) ddClose();
    if (!show) tool = null;
    Array.prototype.forEach.call(pal.querySelectorAll("button[data-make]"), function(b) {
      var mine2 = !!tool && tool.kind === b.dataset.make;
      b.setAttribute("aria-pressed", String(mine2));
      b.classList.toggle("m2-ed-sticky", mine2 && tool.sticky);
    });
    if (!tool && V.view.style.cursor === "default") V.view.style.cursor = "";
    if (props) propsShow();
    palLook();
  }
  function palTake(kind, sticky) {
    tool = kind ? { kind, sticky: !!sticky } : null;
    shared.cdGate = null;
    palShow();
  }
  var placeAt;
  var placedAt;
  function __run224() {
    pal.addEventListener("click", function(e) {
      var b = e.target.closest("button[data-make]");
      if (!b) return;
      palTake(tool && tool.kind === b.dataset.make ? null : b.dataset.make, false);
    });
    pal.addEventListener("dblclick", function(e) {
      var b = e.target.closest("button[data-make]");
      if (b) palTake(b.dataset.make, true);
    });
    document.addEventListener("click", function(e) {
      if (e.target.closest && e.target.closest("#m2-set-edit")) setTimeout(palShow, 0);
    }, true);
    document.addEventListener("keydown", function(e) {
      if (tool && e.key === "Escape") palTake(null);
    }, true);
    placeAt = null, placedAt = 0;
  }
  function palDown(e) {
    if (!tool || arcTool() || !(palOn() || cdPal())) return false;
    placeAt = { x: e.clientX, y: e.clientY, P: at(e) };
    return true;
  }
  function palUp(e) {
    var p = placeAt;
    placeAt = null;
    if (!p || e.type !== "pointerup" || Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 5) return false;
    e.stopImmediatePropagation();
    if (!tool) return true;
    placedAt = Date.now();
    if (cdPal()) {
      cdClick(p.P);
      if (tool && !tool.sticky && !CD_GATE[tool.kind]) palTake(null);
      return true;
    }
    makeEntity(p.P, tool.kind);
    if (tool && !tool.sticky) palTake(null);
    return true;
  }
  function freeId(base, taken) {
    var s = src(), i = 1;
    var del = sbJs.gone(shared.text), used = function(q) {
      return shared.text.indexOf('"' + q + '"') >= 0 || s.indexOf('"' + q + '"') >= 0 || s.indexOf("'" + q + "'") >= 0 || del.indexOf(q) >= 0 || (taken || []).indexOf(q) >= 0;
    };
    while (used(base + i)) i++;
    return base + i;
  }
  function innermost(P, test) {
    var best = -1, area = Infinity;
    nodes2.forEach(function(n, i) {
      var b = boxOf(i);
      if (P[0] < b[0] || P[1] < b[1] || P[0] > b[0] + b[2] || P[1] > b[1] + b[3] || !test(n, i)) return;
      if (b[2] * b[3] < area) {
        area = b[2] * b[3];
        best = i;
      }
    });
    return best;
  }
  function joinWhy(code, name2) {
    return {
      lines: name2 + " has lines, so it stays where it was: a line goes to a complex, never to its member.",
      copies: name2 + " is drawn more than once, so it stays where it was: a complex member is drawn once."
    }[code] || "";
  }
  function joinPlan(moved, leaving) {
    var out = { joins: [], why: "" };
    var J = shared.F.join;
    if (!on || V.current !== map || V.level !== "full" || !moved.length || !J || !J.ok()) return out;
    var at2 = {}, cx = [], mv0 = {};
    nodes2.forEach(function(n, i) {
      at2[n.id] = i;
      if (n.shape.kind === "Complex") cx.push(i);
    });
    moved.forEach(function(id) {
      mv0[id] = 1;
    });
    var out0 = {};
    (leaving || []).forEach(function(id) {
      out0[id] = 1;
    });
    var inCx = function(i) {
      for (var u = nodes2[i].up; u != null; u = nodes2[u].up) if (nodes2[u].shape.kind === "Complex") return true;
      return false;
    };
    moved.forEach(function(id) {
      var i = at2[id];
      if (i == null || out.why || J.own && J.own(i) || nodes2[i].up != null && mv0[nodes2[nodes2[i].up].id] || !out0[id] && inCx(i)) return;
      var b = boxOf(i), P = [b[0] + b[2] / 2, b[1] + b[3] / 2], best = -1, area = Infinity;
      cx.forEach(function(j) {
        var q = boxOf(j);
        if (mv0[nodes2[j].id] || P[0] < q[0] || P[1] < q[1] || P[0] > q[0] + q[2] || P[1] > q[1] + q[3] || q[2] * q[3] >= area) return;
        for (var u = nodes2[j].up; u != null; u = nodes2[u].up) if (mv0[nodes2[u].id]) return;
        best = j;
        area = q[2] * q[3];
      });
      if (best < 0) return;
      var why;
      try {
        why = J.joinable(id, nodes2[best].id);
      } catch (err) {
        return;
      }
      if (!why) out.joins.push([id, nodes2[best].id]);
      else out.why = joinWhy(why, '"' + (nameOf(i) || id) + '"');
    });
    return out;
  }
  function joinBeside(id, cid) {
    var at2 = {};
    nodes2.forEach(function(n, k) {
      at2[n.id] = k;
    });
    var i = at2[id], c = at2[cid];
    if (i == null || c == null) return;
    var b = boxOf(i), ms = nodes2.map(function(n, k) {
      return k;
    }).filter(function(k) {
      return nodes2[k].up === c && k !== i;
    });
    if (!ms.some(function(k) {
      return overlap(boxOf(k), b);
    })) return;
    var u = ms.map(boxOf).reduce(function(a, q) {
      return [Math.min(a[0], q[0]), Math.max(a[1], q[1] + q[3])];
    }, [Infinity, -Infinity]), dx = u[0] - b[0], dy = u[1] + 4 - b[1], nb = {};
    nodes2.forEach(function(n, k) {
      if (k === i || under(k, i)) {
        var q = boxOf(k);
        nb[k] = [q[0] + dx, q[1] + dy, q[2], q[3]];
      }
    });
    setBoxes(nb);
  }
  function joinDo(joins) {
    if (!joins.length) return [];
    joins.forEach(function(q) {
      joinBeside(q[0], q[1]);
    });
    var sel = shared.selN.map(function(i) {
      return nodes2[i].id;
    }), done = shared.F.join.write(joins);
    if (!done.length) return done;
    parse();
    shared.dirty = true;
    var at2 = {};
    nodes2.forEach(function(n, i) {
      at2[n.id] = i;
    });
    shared.selN = sel.filter(function(id) {
      return at2[id] != null;
    }).map(function(id) {
      return at2[id];
    });
    return done;
  }
  function joinPack(cids) {
    if (cids.length) layTool("pack", cids, true);
  }
  function terminals() {
    var subs = [], key = null;
    nodes2.forEach(function(n, i) {
      n.sub = null;
      if (n.shape.kind === "Submap") subs.push(i);
    });
    if (!subs.length) return;
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, "key"), function(k) {
      if (k.getAttribute("attr.name") === "SBGN class" && k.getAttribute("for") === "node") key = k.getAttribute("id");
    });
    nodes2.forEach(function(n, i) {
      if (n.shape.kind !== "Tag") return;
      var d = key && Array.prototype.filter.call(n.el.childNodes, function(c) {
        return c.localName === "data" && c.getAttribute("key") === key;
      })[0];
      var marked = !!d && d.textContent.trim() === "terminal", b = boxOf(i), best = -1, bd = Infinity;
      subs.forEach(function(j) {
        var q = boxOf(j), touch = b[0] <= q[0] + q[2] + 1 && q[0] <= b[0] + b[2] + 1 && b[1] <= q[1] + q[3] + 1 && q[1] <= b[1] + b[3] + 1;
        var side = q[0] - 1 <= b[0] && b[0] + b[2] <= q[0] + q[2] + 1 && q[1] - 1 <= b[1] && b[1] + b[3] <= q[1] + q[3] + 1 && Math.min(Math.abs(b[0] - q[0]), Math.abs(b[0] + b[2] - q[0] - q[2]), Math.abs(b[1] - q[1]), Math.abs(b[1] + b[3] - q[1] - q[3])) <= 1;
        if (!(marked ? touch : side)) return;
        var dd = Math.hypot(b[0] + b[2] / 2 - q[0] - q[2] / 2, b[1] + b[3] / 2 - q[1] - q[3] / 2);
        if (dd < bd) {
          bd = dd;
          best = j;
        }
      });
      if (best >= 0) {
        n.sub = best;
        nodes2[best].inside.push(i);
      }
    });
  }
  function __run234() {
    parseFix.push(terminals);
  }
  function subAt(P, d) {
    var best = -1, bd = Infinity;
    nodes2.forEach(function(n, j) {
      if (n.shape.kind !== "Submap") return;
      var q = boxOf(j), ins = P[0] >= q[0] && P[0] <= q[0] + q[2] && P[1] >= q[1] && P[1] <= q[1] + q[3];
      var e = ins ? 0 : Math.hypot(Math.max(q[0] - P[0], 0, P[0] - q[0] - q[2]), Math.max(q[1] - P[1], 0, P[1] - q[1] - q[3]));
      if (e <= d && (e < bd || e === bd && best >= 0 && q[2] * q[3] < boxOf(best)[2] * boxOf(best)[3])) {
        bd = e;
        best = j;
      }
    });
    return best;
  }
  function onBorder(b, q) {
    var c = [b[0] + b[2] / 2, b[1] + b[3] / 2], L = Math.max(b[2], b[3]), S = Math.min(b[2], b[3]);
    var oy = Math.max(q[1] - c[1], 0, c[1] - q[1] - q[3]), ox = Math.max(q[0] - c[0], 0, c[0] - q[0] - q[2]);
    var d = [Math.hypot(c[0] - q[0], oy), Math.hypot(q[0] + q[2] - c[0], oy), Math.hypot(ox, c[1] - q[1]), Math.hypot(ox, q[1] + q[3] - c[1])], k = d.indexOf(Math.min.apply(null, d));
    var clamp = function(v, lo, hi) {
      return Math.max(lo, Math.min(v, Math.max(lo, hi)));
    };
    if (k < 2) {
      var y = clamp(c[1] - S / 2, q[1], q[1] + q[3] - S);
      return [[k ? q[0] + q[2] - L : q[0], y, L, S], k ? "left" : "right"];
    }
    var x = clamp(c[0] - S / 2, q[0], q[0] + q[2] - S);
    return [[x, k === 3 ? q[1] + q[3] - L : q[1], S, L], k === 3 ? "up" : "down"];
  }
  var SIDE;
  function __run244() {
    SIDE = { right: 0, left: 1, down: 2, up: 3 };
  }
  function onSide(b, q, way, any) {
    var k = SIDE[way], L = Math.max(b[2], b[3]), S = Math.min(b[2], b[3]), e = 0.5;
    if (k == null) return null;
    var clamp = function(v, lo, hi) {
      return Math.max(lo, Math.min(v, Math.max(lo, hi)));
    };
    if (k < 2) {
      var x = k ? q[0] + q[2] - L : q[0];
      if (!any && (Math.abs(b[0] - x) > e || b[2] !== L || b[1] < q[1] - e || b[1] + b[3] > q[1] + q[3] + e)) return null;
      return [[x, clamp(b[1], q[1], q[1] + q[3] - S), L, S], way];
    }
    var y = k === 3 ? q[1] + q[3] - L : q[1];
    if (!any && (Math.abs(b[1] - y) > e || b[3] !== L || b[0] < q[0] - e || b[0] + b[2] > q[0] + q[2] + e)) return null;
    return [[clamp(b[0], q[0], q[0] + q[2] - S), y, S, L], way];
  }
  var tKey;
  var HORIZ;
  function __run253() {
    tKey = null;
    keyTake.push(function(d, e) {
      if (!sbJs || !sbJs.way || shared.selN.length !== 1 || shared.selP.length) return false;
      var i = shared.selN[0], n = nodes2[i];
      if (!n || n.shape.kind !== "Tag" || n.sub == null || shared.selE.some(function(k) {
        return edges2[k].s !== i && edges2[k].t !== i;
      })) return false;
      var b = boxOf(i), q = boxOf(n.sub), L = Math.max(b[2], b[3]), S = Math.min(b[2], b[3]);
      var R = [q[0] + S / 2, q[1] + S / 2, Math.max(q[2] - S, 0), Math.max(q[3] - S, 0)], w = R[2], h = R[3], P = 2 * (w + h);
      if (!P) return true;
      var way = sbJs.wayOfR && sbJs.wayOfR(realizerOf(n.el)) || onBorder(b, q)[1];
      var cx = Math.max(R[0], Math.min(b[0] + b[2] / 2, R[0] + w)), cy = Math.max(R[1], Math.min(b[1] + b[3] / 2, R[1] + h));
      var t = { down: cx - R[0], left: w + cy - R[1], up: w + h + R[0] + w - cx, right: 2 * w + h + R[1] + h - cy }[way];
      if (t == null) return false;
      if (!tKey || tKey.id !== n.id || tKey.key !== e.key || !e.repeat) tKey = { id: n.id, key: e.key, dir: keyDir([0, 0, w, h], t, [Math.sign(d[0]), Math.sign(d[1])]) };
      t = ((t + tKey.dir * Math.max(Math.abs(d[0]), Math.abs(d[1]))) % P + P) % P;
      var nb, nw;
      if (t < w) {
        nw = "down";
        nb = [R[0] + t - S / 2, q[1], S, L];
      } else if (t < w + h) {
        nw = "left";
        nb = [q[0] + q[2] - L, R[1] + t - w - S / 2, L, S];
      } else if (t < 2 * w + h) {
        nw = "up";
        nb = [R[0] + w - (t - w - h) - S / 2, q[1] + q[3] - L, S, L];
      } else {
        nw = "right";
        nb = [q[0], R[1] + h - (t - 2 * w - h) - S / 2, L, S];
      }
      var o = {};
      o[i] = nb.map(function(v) {
        return +fmt(v);
      });
      var eids = shared.selE.map(function(k) {
        return edges2[k] && edges2[k].id;
      });
      commit(null, { name: "tag turned", ids: [tKey.id], merge: true, write: function() {
        setBoxes(o);
      }, parsed: true, then: function() {
        var at2 = -1;
        nodes2.forEach(function(m, k) {
          if (m.id === tKey.id) at2 = k;
        });
        if (at2 >= 0) {
          var t2 = tagTurnT(shared.text, at2, nw, true);
          if (t2 !== shared.text) {
            setText(t2);
            parse();
          }
        }
        shared.selN = at2 >= 0 ? [at2] : [];
        shared.selE = edges2.map(function(q2, k) {
          return eids.indexOf(q2.id) >= 0 ? k : -1;
        }).filter(function(k) {
          return k >= 0;
        });
      } });
      return true;
    });
    HORIZ = { left: 1, right: 1 };
  }
  function tagTurnT(t, i, way, placed2) {
    var n = nodes2[i], id = n.id, b = boxOf(i), now = sbJs.wayOfR && sbJs.wayOfR(realizerOf(n.el)) || "right", nb = b;
    if (!placed2 && (HORIZ[way] ? b[3] > b[2] : b[2] > b[3])) nb = [b[0] + b[2] / 2 - b[3] / 2, b[1] + b[3] / 2 - b[2] / 2, b[3], b[2]].map(function(v) {
      return +fmt(v);
    });
    if (nb !== b) t = sbJs.resize(t, id, nb);
    if (way !== now) t = sbJs.way(t, id, way);
    var q = n.sub != null ? boxOf(n.sub) : null, es = edges2.filter(function(e) {
      return e.s === i || e.t === i;
    });
    if (!q && es.length !== 1) return t;
    es.forEach(function(e) {
      var end = e.t === i, o = boxOf(end ? e.s : e.t), p = tagEnd(way, nb, q, [o[0] + o[2] / 2, o[1] + o[3] / 2]);
      t = import_graphml_edit.default.pathOf(t, e.id, [[end ? "tx" : "sx", p[0]], [end ? "ty" : "sy", p[1]]].map(function(k) {
        return [k[0], sbJs.repr(k[1])];
      }));
    });
    return t;
  }
  function tagEnd(way, b, q, oc) {
    var tip = { right: [b[2] / 2, 0], left: [-b[2] / 2, 0], down: [0, b[3] / 2], up: [0, -b[3] / 2] }[way];
    return !q || oc[0] > q[0] && oc[0] < q[0] + q[2] && oc[1] > q[1] && oc[1] < q[1] + q[3] ? tip : [-tip[0], -tip[1]];
  }
  function tagAim(ids) {
    var t2 = shared.text;
    nodes2.forEach(function(n, i) {
      if (ids.indexOf(n.id) < 0 || n.shape.kind !== "Tag" || n.sub != null) return;
      var es = edges2.filter(function(q2) {
        return q2.s === i || q2.t === i;
      });
      if (es.length !== 1) return;
      var o = es[0].s === i ? es[0].t : es[0].s, b = boxOf(i), q = boxOf(o), dx = q[0] + q[2] / 2 - b[0] - b[2] / 2, dy = q[1] + q[3] / 2 - b[1] - b[3] / 2;
      t2 = tagTurnT(t2, i, Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? "right" : "left" : dy >= 0 ? "down" : "up");
    });
    if (t2 !== shared.text) {
      setText(t2);
      parse();
      shared.dirty = true;
    }
  }
  function termsFix(list2, any) {
    if (!sbJs || !sbJs.way) return;
    var nb = {}, ways = [];
    list2.forEach(function(i) {
      var s = nodes2[i] && nodes2[i].sub;
      if (s == null) return;
      var b = boxOf(i), q = boxOf(s), on2 = onSide(b, q, sbJs.wayOfR && sbJs.wayOfR(realizerOf(nodes2[i].el)) || "", any) || onBorder(b, q);
      if (on2[0].some(function(v, j) {
        return Math.abs(v - b[j]) > 1e-3;
      })) nb[i] = on2[0];
      ways.push([nodes2[i].id, on2[1]]);
    });
    if (Object.keys(nb).length) setBoxes(nb);
    var t2 = shared.text, at2 = {};
    nodes2.forEach(function(n, k) {
      at2[n.id] = k;
    });
    ways.forEach(function(q) {
      t2 = tagTurnT(t2, at2[q[0]], q[1], true);
    });
    if (t2 !== shared.text) {
      setText(t2);
      parse();
      shared.dirty = true;
    }
  }
  var TURN;
  function __run263() {
    moveFix.push(function(set, alone) {
      if (!sbJs || !sbJs.terminal) return;
      var ids = /* @__PURE__ */ new Set(), keep = /* @__PURE__ */ new Set(), out = [], join2 = [];
      set.forEach(function(i) {
        ids.add(nodes2[i].id);
      });
      set.forEach(function(i) {
        var n = nodes2[i];
        if (n.shape.kind !== "Tag") return;
        if (n.sub != null) {
          if (set.has(n.sub)) return;
          if (alone && !centreIn(boxOf(i), boxOf(n.sub))) {
            if (linesAt(i) <= 1) {
              out.push(n.id);
              return;
            }
            warn("A free tag has one line: take one of this terminal\u2019s two lines off first.");
          }
          keep.add(n.id);
          return;
        }
        if (alone) return;
        var j = subIn(boxOf(i), set);
        if (j >= 0) join2.push([i, j]);
      });
      var nb = {};
      join2.forEach(function(q) {
        nb[q[0]] = onBorder(boxOf(q[0]), boxOf(q[1]))[0];
        keep.add(nodes2[q[0]].id);
      });
      if (join2.length) setBoxes(nb);
      var t2 = shared.text;
      out.forEach(function(id) {
        t2 = sbJs.terminal(t2, id, false);
      });
      join2.forEach(function(q) {
        t2 = sbJs.terminal(t2, nodes2[q[0]].id, true);
      });
      if (t2 !== shared.text) {
        setText(t2);
        parse();
        shared.dirty = true;
      }
      termsFix(nodes2.map(function(m, k) {
        return keep.has(m.id) ? k : -1;
      }).filter(function(k) {
        return k >= 0;
      }));
      var aim2 = [];
      edges2.forEach(function(q) {
        if (q.s != null && q.t != null) [[q.s, q.t], [q.t, q.s]].forEach(function(p) {
          if (nodes2[p[0]].shape.kind === "Tag" && ids.has(nodes2[p[0]].id) !== ids.has(nodes2[p[1]].id)) aim2.push(nodes2[p[0]].id);
        });
      });
      tagAim(aim2);
    });
    TURN = { right: 0, down: 90, left: 180, up: 270 };
    livePose.push(function(sets, alone, out, rs) {
      if (!sbJs || !sbJs.terminal) return;
      var wayNow = function(n) {
        return sbJs.wayOfR && sbJs.wayOfR(realizerOf(n.el)) || "right";
      };
      if (rs) {
        nodes2.forEach(function(n, i) {
          if (n.shape.kind !== "Tag" || n.sub !== rs.i) return;
          var b = termScaled(boxOf(i), boxOf(rs.i), rs.box), now = wayNow(n), on2 = onSide(b, rs.box, now, true) || onBorder(b, rs.box), ports2 = {};
          edges2.forEach(function(e, k) {
            if (e.s === i || e.t === i) {
              var o = boxOf(e.s === i ? e.t : e.s);
              ports2[k] = tagEnd(on2[1], on2[0], rs.box, [o[0] + o[2] / 2, o[1] + o[3] / 2]);
            }
          });
          out[i] = { box: on2[0], way: on2[1], turn: (TURN[on2[1]] - TURN[now] + 360) % 360, ports: ports2 };
        });
        return;
      }
      var raw = function(k) {
        var b = boxOf(k);
        return sets.n.has(k) ? [b[0] + sets.dx, b[1] + sets.dy, b[2], b[3]] : b;
      };
      var moved = function(k) {
        return out[k] ? out[k].box : raw(k);
      };
      var mid = function(b) {
        return [b[0] + b[2] / 2, b[1] + b[3] / 2];
      };
      var lines = null, linesOf = function(i) {
        if (!lines) {
          lines = {};
          edges2.forEach(function(q, k) {
            if (q.s != null && q.t != null) [q.s, q.t].forEach(function(x) {
              if (nodes2[x].shape.kind === "Tag") (lines[x] = lines[x] || []).push(k);
            });
          });
        }
        return lines[i] || [];
      };
      [0, 1].forEach(function() {
        nodes2.forEach(function(n, i) {
          if (n.shape.kind !== "Tag" || n.sub != null && sets.n.has(n.sub)) return;
          var mine2 = sets.n.has(i);
          if (!mine2 && n.sub != null) return;
          var es = linesOf(i);
          if (!mine2 && !(es.length === 1 && (out[edges2[es[0]].s === i ? edges2[es[0]].t : edges2[es[0]].s] || sets.n.has(edges2[es[0]].s === i ? edges2[es[0]].t : edges2[es[0]].s)))) return;
          var mb = raw(i), on2 = null, q = null, now = wayNow(n);
          if (mine2 && n.sub != null) {
            if (!(alone && !centreIn(mb, boxOf(n.sub)) && es.length <= 1)) q = boxOf(n.sub);
          } else if (mine2 && !alone) {
            var j = subIn(mb, sets.n);
            if (j >= 0) q = boxOf(j);
          }
          if (q) on2 = n.sub != null && onSide(mb, q, now) || onBorder(mb, q);
          else {
            if (es.length !== 1) return;
            if (mine2 && sets.n.has(edges2[es[0]].s === i ? edges2[es[0]].t : edges2[es[0]].s)) return;
            var e = edges2[es[0]], oc = mid(moved(e.s === i ? e.t : e.s)), c = mid(mb), dx = oc[0] - c[0], dy = oc[1] - c[1];
            var way = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? "right" : "left" : dy >= 0 ? "down" : "up";
            on2 = [!!HORIZ[way] === mb[2] >= mb[3] ? mb : [c[0] - mb[3] / 2, c[1] - mb[2] / 2, mb[3], mb[2]], way];
          }
          var ports2 = {};
          es.forEach(function(k) {
            var e2 = edges2[k];
            ports2[k] = tagEnd(on2[1], on2[0], q, mid(moved(e2.s === i ? e2.t : e2.s)));
          });
          out[i] = { box: on2[0], way: on2[1], turn: (TURN[on2[1]] - TURN[now] + 360) % 360, ports: ports2 };
        });
      });
    });
  }
  function centreIn(b, q) {
    var c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    return c[0] >= q[0] && c[0] <= q[0] + q[2] && c[1] >= q[1] && c[1] <= q[1] + q[3];
  }
  function subIn(b, not) {
    var j = -1, a = Infinity;
    nodes2.forEach(function(m, k) {
      var q = boxOf(k);
      if (m.shape.kind === "Submap" && !(not && not.has(k)) && centreIn(b, q) && q[2] * q[3] < a) {
        a = q[2] * q[3];
        j = k;
      }
    });
    return j;
  }
  function linesAt(i) {
    return edges2.filter(function(q) {
      return q.s === i || q.t === i;
    }).length;
  }
  function tagRoom(tg, o, k) {
    var n = nodes2[tg], es = edges2.filter(function(q2, j) {
      return j !== k && (q2.s === tg || q2.t === tg);
    });
    if (n.sub == null) return es.length ? "A tag has one line, and this one has it." : null;
    var q = boxOf(n.sub), side = function(x) {
      return centreIn(boxOf(x), q);
    }, mine2 = side(o);
    return es.some(function(e) {
      return side(e.s === tg ? e.t : e.s) === mine2;
    }) ? "A terminal has one line from outside its submap, at its back, and one from inside, at its point; this one is taken." : null;
  }
  function makeEntity(P, cls) {
    var units = PRESET[cls] ? PRESET[cls][1] : null;
    cls = baseKind(cls);
    var act = ACT_UNIT[cls], D = defOf(cls), w = D.w, h = D.h, X = P[0] - w / 2, Y2 = P[1] - h / 2;
    if (gridSet.snap) {
      X += toGrid(X + w / 2, gridSet.step);
      Y2 += toGrid(Y2 + h / 2, gridSet.step);
    }
    var bx0 = [+fmt(X), +fmt(Y2), w, h], c = holder(bx0, function() {
      return false;
    }, boxOf), id = freeId("glyph_"), onCx = innermost(P, function(n) {
      return n.shape.kind === "Complex";
    }) >= 0;
    var t2, way = null, sm = cls === "tag" ? subAt(P, Math.max(w, h) / 2) : -1;
    if (cls === "tag") {
      var on2 = sm >= 0 ? onBorder([X, Y2, w, h], boxOf(sm)) : null;
      way = on2 ? on2[1] : "right";
      if (!on2 && bx0[3] > bx0[2]) bx0 = [+fmt(P[0] - h / 2), +fmt(P[1] - w / 2), h, w];
      if (on2) {
        bx0 = on2[0].map(function(v) {
          return +fmt(v);
        });
        c = nodes2[sm].up;
      }
    }
    try {
      t2 = sbJs.add(shared.text, { id, cls: act != null ? sbJs.unitClass(act) : cls, activity: act, label: "", box: bx0, parent: c != null ? nodes2[c].id : null, fill: D.fill, line: D.line, width: D.width, multimer: D.multimer, font: D.font, units: units || void 0, way, letters: sbJs.GLT.test(cls) ? stdLetters() : null });
      if (sm >= 0) t2 = sbJs.terminal(t2, id, true);
    } catch (err) {
      warn("The " + (act != null ? "activity" : cls) + " could not be added: " + (err && err.message || err) + ".");
      return;
    }
    remember(false);
    setText(t2);
    if (cls === "compartment") {
      parse();
      var ni = nodes2.findIndex(function(n) {
        return n.id === id;
      }), inn = ni >= 0 ? regroup("box", /* @__PURE__ */ new Set([ni]), boxOf, function(k) {
        return k === ni ? [0, 0, 0, 0] : boxOf(k);
      }) : /* @__PURE__ */ new Map();
      return settle(inn, { moving: [id] }, function() {
        made(id);
      }, function() {
        made(id);
      });
    }
    if (!onCx) {
      made(id);
      return;
    }
    parse();
    var cids = joinDo(joinPlan([id]).joins);
    made(id);
    joinPack(cids);
  }
  function isMade(n) {
    var K = sbJs && sbJs.MAKE;
    return !!K && n.shape.kind !== "Compartment" && Object.keys(K).some(function(c) {
      return K[c] === n.shape.kind;
    }) && n.el.getAttribute("yfiles.foldertype") !== "group";
  }
  function emptyComp(n) {
    return !!n.comp && !nodes2.some(function(m) {
      return m.up != null && nodes2[m.up] === n;
    });
  }
  function madeAt(P) {
    return innermost(P, isMade);
  }
  function macroAt(P) {
    var i = madeAt(P);
    return i >= 0 && nodes2[i].shape.kind === "Macromolecule" ? i : -1;
  }
  var PLACES;
  function __run273() {
    PLACES = function() {
      var out = [], k;
      for (k = -4; k <= 4; k++) {
        out.push([k / 8, -0.5], [k / 8, 0.5]);
        if (Math.abs(k) < 4) out.push([-0.5, k / 8], [0.5, k / 8]);
      }
      return out;
    }();
  }
  function border(i, P) {
    var b = svBox(i), best = null, d0 = Infinity;
    PLACES.forEach(function(q) {
      var d = Math.hypot(b[0] + (0.5 + q[0]) * b[2] - P[0], b[1] + (0.5 + q[1]) * b[3] - P[1]);
      if (d < d0) {
        d0 = d;
        best = q;
      }
    });
    return best.slice();
  }
  var NAME_WORDS;
  function __run283() {
    NAME_WORDS = { tl: "Name at top left", t: "Name at top middle", tr: "Name at top right", bl: "Name at bottom left", b: "Name at bottom middle", br: "Name at bottom right" };
    ownMenus.push(function(P) {
      return svOn() && svAt(P);
    });
    window.m2EditNodeItems = function() {
      var it = nodeItems(), h = rclick && on && V.current === map ? hit(rclick) : null, i = h && h.n != null && h.p == null ? h.n : -1;
      if (i < 0 || svOn() && svAt(rclick) || kindKey(i) == null || asSpace(i)) return it;
      it = it || [];
      it.tail = [["Select all of this kind", function() {
        selectKind(i);
      }]];
      return it;
    };
  }
  function kindKey(i) {
    return nodes2[i] ? shared.F.kind(nodes2[i]) : null;
  }
  function selectKind(i) {
    var key = kindKey(i);
    if (key == null) return;
    shared.selN = nodes2.map(function(n, k) {
      return kindKey(k) === key && !(shared.afSbgn && inComplex(k)) ? k : -1;
    }).filter(function(k) {
      return k >= 0;
    });
    shared.selP = [];
    shared.selE = [];
    shared.part = null;
    shared.svSel = null;
    paint();
  }
  function nodeItems() {
    if (cdPal()) return cdItems();
    var P = rclick, k = P && palOn() && !svAt(P) ? madeAt(P) : -1;
    if (k < 0 && P && palOn()) {
      var h = hit(P), ed = h && h.e != null && h.p == null ? edges2[h.e] : null, now = ed && Object.keys(MODK).filter(function(c) {
        return sbJs.ARROW[c] === ed.arr[1];
      })[0];
      var afN = afKind();
      if (now) return lateItem(["Change identity", subItem(function(r, done) {
        return kindWindow(r, PAL_PD[4][1].filter(function(q) {
          return MODK[q[0]] && !(q[0] === "catalysis" && (afN || ruleSays("catalysis", ed.s, ed.t, h.e)));
        }).map(function(q) {
          var c = q[0], af = afN && sbJs.AF_ARC[c];
          return { name: af ? af[0].toUpperCase() + af.slice(1) : q[1], own: c === now, go: function() {
            var t2 = sbJs.arcKind(shared.text, ed.id, c);
            commit(t2, { name: "arc kind", sel: [], selE: [ed.id] });
          } };
        }), done);
      })]);
    }
    var au = k >= 0 && afMap() ? sbJs.activities(shared.text)[nodes2[k].id] : null;
    if (au == null && k >= 0 && afMap() && palKind() === "af" && !nodes2[k].kids.length) au = sbJs.unitFor(nodes2[k].shape.kind);
    if (au === void 0) au = null;
    if (au != null) {
      var aid = nodes2[k].id, setU = function(u) {
        return function() {
          commit(sbJs.activity(shared.text, aid, u), { name: "activity unit", sel: [aid], quiet: true });
        };
      };
      var ui = svList(k).filter(function(q) {
        return q[3] === UI;
      })[0], ut = ui ? ui[0] : "";
      var setT = function(v) {
        return function() {
          var t2 = ui ? v === null ? sbJs.unitDelete(shared.text, aid, 0) : sbJs.unitValue(shared.text, aid, 0, v) : sbJs.unit(shared.text, aid, v);
          commit(t2, { name: "unit text", sel: [aid], quiet: true });
        };
      };
      var typeT = function() {
        if (!ui && !commit(sbJs.unit(shared.text, aid, ""), { name: "unit added to type in", sel: [aid], quiet: true })) return;
        var j = svList(nodes2.findIndex(function(n) {
          return n.id === aid;
        })).map(function(q) {
          return q[3];
        }).indexOf(UI);
        if (j >= 0) typeIn(aid, j, !ui);
      };
      var texts = [[ut ? "Edit unit of information text" : "Add unit of information text", typeT]];
      if (au === "nucleic acid feature") NAF_CT.forEach(function(c) {
        if (ut !== c[0]) texts.push(["Unit of information " + c[0], setT(c[0])]);
      });
      if (ut) texts.push(["Remove unit of information text", setT(null)]);
      return sbJs.UNITS.filter(function(u) {
        return u !== au && ACT_NAME[u];
      }).map(function(u) {
        return ["Make " + ACT_NAME[u], setU(u)];
      }).concat(au ? [["Remove unit of information", setU("")]] : []).concat(texts);
    }
    var gc = k >= 0 && nodes2[k].shape.kind === "Operator" ? sbJs.classOf(src(), nodes2[k].id) : "";
    if (/^(and|or|not)$/.test(gc)) {
      var gid = nodes2[k].id;
      var gins = edges2.filter(function(q) {
        return q.t === k;
      }).length;
      return ["and", "or", "not"].filter(function(c) {
        return c !== gc && !(c === "not" && gins > 1);
      }).map(function(c) {
        return ["Make " + c.toUpperCase(), function() {
          commit(sbJs.kind(shared.text, gid, c), { name: "gate kind", sel: [gid], quiet: true });
        }];
      });
    }
    var ec = k >= 0 && !afKind() && !svAt(P) ? sbJs.classOf(src(), nodes2[k].id) || "" : "", eb = ec.replace(/ multimer$/, "");
    if (sbJs.ENTITIES.indexOf(eb) >= 0) {
      var eid = nodes2[k].id, eout = [], emulti = isMulti(k);
      if (eb === "macromolecule") eout.push(["Add state variable", function() {
        makeState(P);
      }], ["Add unit of information", function() {
        makeUnit(eid);
      }]);
      if (eb === "nucleic acid feature") eout.push(
        ["Add unit of information", function() {
          makeUnit(eid);
        }],
        // the conceptual types offered
        ["Add unit of information ct:mRNA", function() {
          makeUnit(eid, "ct:mRNA");
        }],
        ["Add unit of information ct:gene", function() {
          makeUnit(eid, "ct:gene");
        }]
      );
      eout.push(["Change identity", subItem(function(r, done) {
        return kindWindow(r, sbJs.ENTITIES.map(function(c) {
          return { name: c[0].toUpperCase() + c.slice(1), own: c === eb, go: function() {
            commit(sbJs.entityKind(shared.text, eid, c), { name: "entity kind", sel: [eid], quiet: true });
          } };
        }), done);
      })]);
      if (hasMulti(eb)) eout.push([emulti ? "Make " + eb : "Make multimer", function() {
        commit(sbJs.multimer(shared.text, eid, !emulti), { name: "multimer", sel: [eid], quiet: true });
      }]);
      eout.late = true;
      return eout;
    }
    var pc = k >= 0 && nodes2[k].shape.kind === "Process" ? sbJs.classOf(src(), nodes2[k].id) : "";
    if (sbJs.PROCESSES.indexOf(pc) >= 0) {
      var pid = nodes2[k].id, psigns = PAL_PD.filter(function(g) {
        return g[0] === "Process nodes";
      })[0][1];
      var pit = lateItem(["Change identity", subItem(function(r, done) {
        return kindWindow(r, sbJs.PROCESSES.map(function(c) {
          var q = psigns.filter(function(s) {
            return s[0] === c;
          })[0];
          return q && { name: q[1], own: c === pc, go: function() {
            commit(sbJs.kind(shared.text, pid, c), { name: "process kind", sel: [pid], quiet: true });
          } };
        }).filter(Boolean), done);
      })]);
      var rv = sbJs.reversibility(shared.text, pid, { sbgn: src() });
      if (rv && (rv.can || rv.rev)) pit.push([rv.rev ? "Make irreversible" : "Make reversible", function() {
        sbReversible(pid, !rv.rev, false);
      }]);
      return pit;
    }
    var stackOn = on && V.current === map && shared.F.stacks && full() && !!sbJs;
    var hc = k < 0 && P && (palOn() || stackOn) ? hit(P) : null;
    if (hc && hc.n != null && hc.p == null && nodes2[hc.n].comp) {
      var cid = nodes2[hc.n].id, np = palOn() ? sbJs.namePlaces(shared.text, cid) : null, sm = sbJs.stackMoves(shared.text, cid);
      var go = function(t2) {
        commit(t2, { name: "compartment", sel: [cid], quiet: true });
      };
      var its = (np ? np[1] : []).map(function(q) {
        return [NAME_WORDS[q], function() {
          go(sbJs.nameAt(shared.text, cid, q));
        }];
      });
      if (sm[1]) its.push(["Bring forward", function() {
        go(sbJs.restack(shared.text, cid, 1));
      }]);
      if (sm[0]) its.push(["Send backward", function() {
        go(sbJs.restack(shared.text, cid, -1));
      }]);
      if (its.length) return its;
    }
    return null;
  }
  function isMulti(i) {
    var r = realizerOf(nodes2[i].el), sp = r && Array.prototype.filter.call(r.children, function(c) {
      return c.localName === "StyleProperties";
    })[0];
    return !!sp && Array.prototype.some.call(sp.children, function(c) {
      return c.getAttribute("name") === "com.yworks.sbgn.style.mcount" && c.getAttribute("value") !== "1";
    });
  }
  function svPlaces(w, h, step2) {
    var S = step2 || 20, bx2 = sideSlots(w, S), sy2 = sideSlots(h, S), out = [];
    var near2 = sy2.length ? sy2.filter(function(d) {
      return Math.abs(Math.abs(d) - Math.abs(sy2[0])) < 1e-6;
    }) : [0];
    bx2.forEach(function(d) {
      out.push([d / w, 0.5]);
    });
    near2.forEach(function(d) {
      out.push([0.5, d / h], [-0.5, d / h]);
    });
    out.push([0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]);
    bx2.forEach(function(d) {
      out.push([d / w, -0.5]);
    });
    sy2.slice(near2.length).forEach(function(d) {
      out.push([0.5, d / h], [-0.5, d / h]);
    });
    return out;
  }
  function sideSlots(L, S) {
    var n = Math.max(0, Math.floor(L / S + 1e-9) - 1), o = [];
    for (var j = 1; j <= n; j++) o.push(Math.round((-L / 2 + j * L / (n + 1)) * 1e6) / 1e6);
    return o.sort(function(a, b) {
      return Math.abs(a) - Math.abs(b) || b - a;
    });
  }
  function iconKeep(p, w0, h0, w, h) {
    var x = p[0], y = p[1], onX = Math.abs(Math.abs(x) - w0 / 2) < 0.5, onY = Math.abs(Math.abs(y) - h0 / 2) < 0.5, sx2 = x < 0 ? -1 : 1, sy2 = y < 0 ? -1 : 1;
    if (onX && onY) return [sx2 * w / 2, sy2 * h / 2];
    if (onY) return [x, sy2 * h / 2];
    if (onX) return [sx2 * w / 2, y];
    return [x * w / w0, y * h / h0];
  }
  function spreadOn(slots, p) {
    var n = slots.length, m = p.length, C = [], W = [];
    var cost = function(d, x) {
      return Math.abs(d - x) - 1e-3 * Math.abs(d) - (d < 0 ? 1e-6 : 0);
    };
    for (var j = 0; j <= m; j++) {
      C.push([]);
      W.push([]);
      for (var k = 0; k <= n; k++) C[j].push(j === 0 ? 0 : Infinity);
    }
    for (j = 1; j <= m; j++) for (k = j; k <= n; k++) {
      var take2 = C[j - 1][k - 1] + cost(slots[k - 1], p[j - 1]), skip = C[j][k - 1];
      if (take2 <= skip) {
        C[j][k] = take2;
        W[j][k] = 1;
      } else {
        C[j][k] = skip;
        W[j][k] = 0;
      }
    }
    var out = [];
    for (j = m, k = n; j > 0; k--) if (W[j][k] === 1) {
      out.unshift(slots[k - 1]);
      j--;
    }
    return out;
  }
  function iconSpread(mv2, fixed, w0, h0, w, h, S) {
    var meet = function(a, sa, c, sc) {
      return Math.abs(a[0] - c[0]) < (sa[0] + sc[0]) / 2 + 2 - 1e-6 && Math.abs(a[1] - c[1]) < (sa[1] + sc[1]) / 2 + 2 - 1e-6;
    };
    var sides = { b: [], r: [], l: [], t: [] }, out = mv2.map(function(q) {
      return iconKeep(q.p, w0, h0, w, h);
    });
    mv2.forEach(function(q, k) {
      var onX = Math.abs(Math.abs(q.p[0]) - w0 / 2) < 0.5, onY = Math.abs(Math.abs(q.p[1]) - h0 / 2) < 0.5;
      if (onY && !onX) sides[q.p[1] > 0 ? "b" : "t"].push(k);
      else if (onX && !onY) sides[q.p[0] > 0 ? "r" : "l"].push(k);
    });
    ["b", "r", "l", "t"].forEach(function(sd) {
      var ks = sides[sd], hz = sd === "b" || sd === "t", L = hz ? w : h;
      if (!ks.length || Math.abs(L - (hz ? w0 : h0)) < 1e-6) return;
      var at2 = function(d) {
        return hz ? [d, sd === "b" ? h / 2 : -h / 2] : [sd === "r" ? w / 2 : -w / 2, d];
      };
      var o = fixed.concat(mv2.map(function(q, k) {
        return ks.indexOf(k) < 0 ? { p: out[k], s: q.s } : null;
      }).filter(Boolean));
      var slots = sideSlots(L, S).filter(function(d) {
        return !o.some(function(f) {
          return meet(at2(d), [S - 2, S - 2], f.p, f.s);
        });
      });
      if (slots.length < ks.length) return;
      var ord = ks.slice().sort(function(a, b) {
        return hz ? mv2[a].p[0] - mv2[b].p[0] : mv2[a].p[1] - mv2[b].p[1];
      });
      var res = spreadOn(slots.slice().sort(function(a, b) {
        return a - b;
      }), ord.map(function(k) {
        return hz ? out[k][0] : out[k][1];
      })).map(at2);
      var ok = ord.every(function(k, j) {
        return !o.some(function(f) {
          return meet(res[j], mv2[k].s, f.p, f.s);
        }) && ord.every(function(k2, j2) {
          return j2 === j || !meet(res[j], mv2[k].s, res[j2], mv2[k2].s);
        });
      });
      if (ok) ord.forEach(function(k, j) {
        out[k] = res[j];
      });
    });
    return out;
  }
  function svPt(b, r) {
    return [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]];
  }
  function svMoved(i, ic, b0, b, S) {
    if (b === b0) return ic;
    var rel = function(B, r) {
      return [r[0] * B[2], r[1] * B[3]];
    }, sv = ic.filter(function(q) {
      return q.k === SV;
    });
    var at2 = iconSpread(sv.map(function(q) {
      return { p: rel(b0, q.r), s: q.s };
    }), ic.filter(function(q) {
      return q.k !== SV;
    }).map(function(q) {
      return { p: rel(b, q.r), s: q.s };
    }), b0[2], b0[3], b[2], b[3], S || svStep(i));
    return ic.map(function(q) {
      var k = sv.indexOf(q);
      return k < 0 ? q : { r: [at2[k][0] / b[2], at2[k][1] / b[3]], s: q.s, k: q.k, n: q.n };
    });
  }
  function svStep(i) {
    return Math.max(20, 18 * svK(i) + 2);
  }
  function svGrowTo(id, nb, skip) {
    var i = nodes2.findIndex(function(n) {
      return n.id === id;
    }), b = boxOf(i), ic = svMoved(i, svIconsOn(i).filter(function(q) {
      return !skip || !skip(q);
    }), b, nb);
    setText(sbJs.resize(shared.text, id, nb));
    ic.forEach(function(q) {
      if (q.k === SV) setText(sbJs.stateMove(shared.text, id, q.n, q.r[0], q.r[1]));
    });
    parse();
  }
  function svIconsOn(i) {
    var b = boxOf(i);
    return svList(i).map(function(q) {
      return { r: [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5], s: q[2], k: q[3], n: q[4] };
    });
  }
  function svClash(c, s, b, icons) {
    return icons.some(function(q) {
      var p = svPt(b, q.r);
      return Math.abs(c[0] - p[0]) < (s[0] + q.s[0]) / 2 + 2 - 1e-6 && Math.abs(c[1] - p[1]) < (s[1] + q.s[1]) / 2 + 2 - 1e-6;
    });
  }
  function svGrowStep(b, base, S) {
    var w = b[2] + S, h = b[3] + S * base[1] / base[0];
    return [b[0] - (w - b[2]) / 2, b[1] - (h - b[3]) / 2, w, h];
  }
  function svRoom(i, s, skip) {
    var b0 = boxOf(i), b = b0, base = svBase(i), S = svStep(i), ic0 = svIconsOn(i).filter(function(q) {
      return !skip || !skip(q);
    }), c;
    for (var g = 0; g < 80; g++) {
      var ic = svMoved(i, ic0, b0, b, S);
      c = svPlaces(b[2], b[3], Math.max(20, s[1] + 2));
      for (var j = 0; j < c.length; j++) if (!svClash(svPt(b, c[j]), s, b, ic)) return { box: b === b0 ? null : b, r: c[j] };
      b = svGrowStep(b, base, S);
    }
    return { box: b === b0 ? null : b, r: c[0] };
  }
  function svK(i) {
    var q = svList(i).filter(function(x) {
      return x[3] === SV;
    })[0];
    return q ? q[2][1] / 18 : 1;
  }
  function svSettle(id, j) {
    var i = nodes2.findIndex(function(n) {
      return n.id === id;
    });
    if (i < 0) return false;
    var grew = false, base = svBase(i);
    for (var g = 0; g < 80; g++) {
      var b = boxOf(i), ic = svIconsOn(i), us = ic.filter(function(q) {
        return q.k === UI && Math.abs(q.r[1] + 0.5) < 1e-6;
      });
      if (!us.some(function(u, k) {
        return svClash(svPt(b, u.r), u.s, b, us.slice(k + 1));
      })) break;
      svGrowTo(id, [b[0] - 10, b[1], b[2] + 20, b[3]]);
      grew = true;
      i = nodes2.findIndex(function(n) {
        return n.id === id;
      });
    }
    for (var h = 0; h < 80; h++) {
      var b2 = boxOf(i), ic2 = svIconsOn(i), us2 = ic2.filter(function(q) {
        return q.k === UI;
      });
      var hit2 = ic2.filter(function(q) {
        return q.k === SV && (j != null ? q.n === j && svClash(svPt(b2, q.r), q.s, b2, ic2.filter(function(o) {
          return o !== q;
        })) : svClash(svPt(b2, q.r), q.s, b2, us2));
      })[0];
      if (!hit2) break;
      var sk = function(o) {
        return o.k === SV && o.n === hit2.n;
      }, r = svRoom(i, hit2.s, sk);
      if (r.box) {
        svGrowTo(id, r.box, sk);
        grew = true;
      }
      setText(sbJs.stateMove(shared.text, id, hit2.n, r.r[0], r.r[1]));
      parse();
      i = nodes2.findIndex(function(n) {
        return n.id === id;
      });
    }
    return grew;
  }
  function svHold(id, was) {
    var k = nodes2.findIndex(function(n) {
      return n.id === id;
    });
    if (k < 0) return;
    setBoxes(grown([k], boxOf, function(q) {
      return q === k ? was : boxOf(q);
    }, function() {
      return false;
    }));
    refit([id]);
  }
  function makeState(P) {
    var i = macroAt(P);
    if (i < 0) return;
    var k = svK(i), room = svRoom(i, [18 * k, 18 * k], null), was = boxOf(i);
    var id = nodes2[i].id, j = svList(i).filter(function(h) {
      return h[3] === SV;
    }).length;
    commit(null, { name: "state variable added", sel: [id], quiet: true, reparse: true, write: function() {
      if (room.box) svGrowTo(id, room.box);
      setText(sbJs.state(shared.text, id, "", room.r[0], room.r[1]));
    }, then: function() {
      if (room.box) svHold(id, was);
      svCopies(id).forEach(function(c) {
        svAddTo(c, room.r, "");
      });
    } });
    shared.selN = [];
    shared.svSel = { id, j };
    paint();
  }
  function svVar(s) {
    var a = (s || "").indexOf("@");
    return a < 0 ? "" : s.slice(a + 1).trim();
  }
  function svIdx(id) {
    return nodes2.findIndex(function(n) {
      return n.id === id;
    });
  }
  function svOnly(i) {
    return svList(i).filter(function(q) {
      return q[3] === SV;
    });
  }
  function svR(i, q) {
    var b = boxOf(i);
    return [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5];
  }
  function svTwin(c, txt, r) {
    var k = svIdx(c);
    if (k < 0) return -1;
    var svs = svOnly(k), v = svVar(txt), d = function(q) {
      var p = svR(k, q);
      return Math.abs(p[0] - r[0]) + Math.abs(p[1] - r[1]);
    };
    var hit2 = v ? svs.filter(function(q) {
      return svVar(q[0]) === v;
    })[0] : svs.filter(function(q) {
      return !svVar(q[0]) && d(q) < 0.04;
    })[0] || (!txt ? svs.filter(function(q) {
      return !q[0];
    }).sort(function(a, b) {
      return d(a) - d(b);
    })[0] : null);
    return hit2 ? hit2[4] : -1;
  }
  function svSize(i, txt) {
    var k = svK(i), n = (txt || "").length;
    return [n <= 2 ? 18 * k : Math.ceil(n * 5.4 * k + 12 * k), 18 * k];
  }
  function svAddTo(c, r, txt) {
    var k = svIdx(c);
    if (k < 0) return;
    var s = svSize(k, txt), b0 = boxOf(k), b = b0, base = svBase(k), S = svStep(k), ic0 = svIconsOn(k), at2 = null;
    for (var g = 0; g < 6 && !at2; g++) {
      var ic = svMoved(k, ic0, b0, b, S);
      if (!svClash(svPt(b, r), s, b, ic)) at2 = { box: b === b0 ? null : b, r };
      else b = svGrowStep(b, base, S);
    }
    if (!at2) at2 = svRoom(k, s, null);
    if (at2.box) svGrowTo(c, at2.box);
    setText(sbJs.state(shared.text, c, txt, at2.r[0], at2.r[1]));
    parse();
    if (at2.box) svHold(c, b0);
  }
  function svJoin(id) {
    var i = svIdx(id), cs = svCopies(id).map(svIdx).sort(function(a, b) {
      return svOnly(b).length - svOnly(a).length;
    });
    if (i < 0 || !cs.length) return;
    var k = cs[0], want = svOnly(k).map(function(q) {
      return [svVar(q[0]), svR(k, q)];
    });
    want.forEach(function(w) {
      if (svTwin(id, w[0] ? "@" + w[0] : "x", w[1]) < 0) svAddTo(id, w[1], w[0] ? "@" + w[0] : "");
    });
  }
  function makeUnit(id, value) {
    var i = nodes2.findIndex(function(n) {
      return n.id === id;
    });
    if (i < 0) return;
    var j = svList(i).length, was = boxOf(i);
    var t2 = sbJs.unit(shared.text, id, value || "");
    if (!commit(t2, { name: "unit added", sel: [id], quiet: true, reparse: true, then: function() {
      if (!shared.afSbgn && svSettle(id, null)) svHold(id, was);
    } })) return;
    shared.selN = [];
    shared.svSel = { id, j };
    paint();
  }
  function made(id) {
    var ids = [].concat(id);
    parse();
    shared.selN = [];
    shared.selP = [];
    shared.selE = [];
    shared.part = null;
    nodes2.forEach(function(n, i) {
      if (ids.indexOf(n.id) >= 0) shared.selN.push(i);
    });
    shared.dirty = true;
    quiet();
    render();
    paint();
    changed();
  }
  var SV;
  var UI;
  var SS;
  function __run293() {
    SV = "StateVariable", UI = "UnitOfInformation", SS = "StructuralState";
  }
  function svIcons() {
    var res = {};
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(Y, "Resource"), function(q) {
      var gn = q.getElementsByTagNameNS(Y, "GenericNode")[0], l = gn && gn.getElementsByTagNameNS(Y, "NodeLabel")[0], m = gn && /(StateVariable|UnitOfInformation)$/.exec(gn.getAttribute("configuration") || "");
      if (m) res[q.getAttribute("id")] = [m[1], l ? ownText(l) : ""];
    });
    return res;
  }
  function ownText(l) {
    var t = "";
    for (var c = l.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) t += c.nodeValue;
    return t;
  }
  function svList(i, res) {
    if (shared.F.sv) return shared.F.sv.list(i);
    var r = realizerOf(nodes2[i].el), b = boxOf(i), out = [], n = {};
    res = res || svIcons();
    if (r) Array.prototype.forEach.call(r.children, function(l) {
      var q = l.localName === "NodeLabel" && res[l.getAttribute("iconData")];
      if (!q) return;
      n[q[0]] = (n[q[0]] || 0) + 1;
      var w = num(l, "width"), h = num(l, "height");
      if (q[0] === SV) w = svSeen(q[1], w, h);
      out.push([q[1], [b[0] + num(l, "x") + num(l, "width") / 2, b[1] + num(l, "y") + num(l, "height") / 2], [w, h], q[0], n[q[0]] - 1]);
    });
    return out;
  }
  function svSeen(txt, w, h) {
    var ls = txt.split("\n");
    while (ls.length > 1 && !ls[ls.length - 1].trim()) ls.pop();
    if (V.sites || ls.length > 1 || ls[0].indexOf("@") < 0) return w;
    var n = ls[0].split("@")[0].length, kk = h / 18;
    return Math.min(w, n <= 2 ? 18 * kk : Math.ceil(n * 5.4 * kk + 12 * kk));
  }
  function nameOf(i) {
    var r = realizerOf(nodes2[i].el), l = r && Array.prototype.filter.call(r.children, function(c) {
      return c.localName === "NodeLabel" && !c.getAttribute("iconData");
    })[0];
    return l ? ownText(l) : "";
  }
  function typeIn(id, j, fresh) {
    if (shared.typing) shared.typing.done(true);
    var i = nodes2.findIndex(function(n) {
      return n.id === id;
    });
    if (i < 0) return;
    var b = boxOf(i), sv = j == null ? null : svList(i)[j];
    if (j != null && !sv) return;
    var unit = !!sv && sv[3] === UI;
    shared.selN = [];
    shared.selP = [];
    shared.selE = [];
    shared.part = null;
    shared.svSel = null;
    paint();
    var r = realizerOf(nodes2[i].el), fl = r && Array.prototype.filter.call(r.children, function(c) {
      return c.localName === "Fill";
    })[0];
    var lab = !sv ? r && Array.prototype.filter.call(r.children, function(c) {
      return c.localName === "NodeLabel" && !c.getAttribute("iconData");
    })[0] : null;
    var fs = lab ? num(lab, "fontSize") || 12 : 10, inset = 2;
    var grp = !sv && nodes2[i].el.getAttribute("yfiles.foldertype") === "group", nb = grp ? nameBox(i) : null, padL = null, at0;
    if (grp) {
      var bh = Math.min(b[3] - 2 * inset, Math.max(fs * 1.6, nb ? nb[3] + 2 : 0)), ly = lab && lab.hasAttribute("y") ? num(lab, "y") : null;
      var by = nb ? nb[1] + nb[3] / 2 - bh / 2 : ly != null && ly >= 0 && ly <= b[3] ? b[1] + ly + num(lab, "height") / 2 - bh / 2 : nodes2[i].comp ? b[1] + inset : b[1] + b[3] - inset - bh;
      at0 = [b[0] + inset, Math.max(b[1] + inset, Math.min(by, b[1] + b[3] - inset - bh)), b[2] - 2 * inset, bh];
      if (nb && Math.abs(nb[0] + nb[2] / 2 - (b[0] + b[2] / 2)) > 2) padL = Math.max(0, nb[0] - at0[0]);
    } else at0 = !sv ? [b[0] + inset, b[1] + inset, b[2] - 2 * inset, b[3] - 2 * inset] : [sv[1][0] - sv[2][0] / 2 + 1, sv[1][1] - sv[2][1] / 2 + 1, sv[2][0] - 2, sv[2][1] - 2];
    var au0 = unit && shared.afSbgn ? sbJs.activities(shared.text)[id] : null;
    if (au0 != null) {
      var B0 = sbJs.afUnitBox(b, au0, sv[0] || "x");
      at0 = [B0[0] + 1, B0[1] + 1, B0[2] - 2, B0[3] - 2];
    }
    var r0 = sv ? svR(i, sv) : null;
    var inp = document.createElement("input"), before = !sv ? shared.F.ownName ? shared.F.ownName(id) : nameOf(i) : sv[0], m0 = map;
    inp.type = "text";
    inp.className = "m2-ed-type";
    inp.value = before;
    inp.spellcheck = false;
    inp.setAttribute("aria-label", !sv ? "Name" : unit ? "Unit of information" : "State variable (value, or value@site)");
    var hid = au0 != null ? Array.prototype.slice.call(gN && gN[id] ? gN[id].querySelectorAll("text.m2-af-ut") : []) : textsOf(i, j);
    hid.forEach(function(el) {
      el.style.visibility = "hidden";
    });
    inp.style.background = gN && gN[nodes2[i].id] ? "transparent" : !sv && fl && fl.getAttribute("hasColor") !== "false" && fl.getAttribute("color") ? fl.getAttribute("color").slice(0, 7) : "#fff";
    inp.style.color = lab && lab.getAttribute("textColor") || "#000";
    if (shared.cdPend && sv && !sv[0]) {
      inp.style.background = "#fff";
      inp.style.border = "1px solid #000";
    }
    var grow = unit || !!sv && sv[3] === SS;
    var own2 = !!sv && !shared.F.sv && au0 == null, ik = own2 ? sv[2][1] / (unit ? 16 : 18) : 1;
    if (own2) {
      grow = true;
      fs = 10 * ik;
      at0 = [sv[1][0] - sv[2][0] / 2, sv[1][1] - sv[2][1] / 2, sv[2][0], sv[2][1]];
      inp.style.background = "#fff";
      inp.style.boxSizing = "border-box";
      inp.style.padding = "0";
      shapesOf(i, j).forEach(function(el) {
        el.style.visibility = "hidden";
        hid.push(el);
      });
    }
    var place = function() {
      var st = inp.style, n = inp.value.length;
      if (grow) {
        var cx = at0[0] + at0[2] / 2, uw = !own2 ? Math.max(at0[2], Math.ceil(n * 5.4 + (unit ? 8 : 24)) + 4) : unit ? Math.ceil(Math.max(n, 3) * 5.4 * ik + 8 * ik) : n <= 2 ? 18 * ik : Math.ceil(n * 5.4 * ik + 12 * ik);
        at0[0] = cx - uw / 2;
        at0[2] = uw;
      }
      st.left = sx(at0[0]) + "px";
      st.top = sy(at0[1]) + "px";
      st.width = at0[2] * V.z + "px";
      st.height = at0[3] * V.z + "px";
      st.fontSize = fs * V.z + "px";
      if (own2) st.border = V.z + "px solid #000";
      if (sv && !unit) st.borderRadius = at0[3] * V.z / 2 + "px";
      if (padL != null) {
        st.textAlign = "left";
        st.paddingLeft = padL * V.z + "px";
      }
    };
    if (grow) inp.addEventListener("input", place);
    place();
    V.view.appendChild(inp);
    shared.typing = {
      done: function(keep) {
        if (!shared.typing || shared.typing.inp !== inp) return;
        shared.typing = null;
        inp.remove();
        hid.forEach(function(el) {
          el.style.visibility = "";
        });
        var v = inp.value.replace(/[\r\n]+/g, " ");
        if (shared.F.sv && sv) {
          shared.F.sv.typed(id, v, keep && on && map === m0);
          return;
        }
        if (sv && !unit) v = v.replace(/@+$/, "");
        if (unit) v = v.trim();
        if (fresh && (!keep || !v) && on && map === m0) {
          var t0 = undo.length ? unpush() : shared.text;
          if (t0 !== shared.text) {
            setText(t0);
            parse();
            shared.dirty = true;
            quiet();
            render();
            paint();
            changed();
          }
          return;
        }
        if (!keep || v === before.replace(/[\r\n]+/g, " ") || !on || map !== m0) return;
        if (!sv) {
          setName(id, v);
          return;
        }
        var t2 = unit ? sbJs.unitValue(shared.text, id, sv[4], v) : sbJs.stateValue(shared.text, id, sv[4], v);
        if (t2 === shared.text) return;
        if (!fresh) remember(false);
        setText(t2);
        parse();
        if (au0 == null) {
          var ix = nodes2.findIndex(function(n) {
            return n.id === id;
          }), was = ix >= 0 ? boxOf(ix) : null;
          if (was && svSettle(id, unit ? null : sv[4])) svHold(id, was);
        }
        if (au0 == null && !unit) svShareText(id, sv[0], r0, sv[4], v);
        shared.dirty = true;
        quiet();
        render();
        paint();
        changed();
      },
      inp,
      place
    };
    inp.addEventListener("keydown", function(e) {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        shared.typing && shared.typing.done(true);
        V.view.focus({ preventScroll: true });
      } else if (e.key === "Escape") {
        e.preventDefault();
        shared.typing && shared.typing.done(false);
        V.view.focus({ preventScroll: true });
      }
    });
    inp.addEventListener("blur", function() {
      if (shared.typing && shared.typing.inp === inp) shared.typing.done(true);
    });
    inp.addEventListener("pointerdown", function(e) {
      e.stopPropagation();
    });
    setTimeout(function() {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }, 0);
  }
  function nameNow(i) {
    return (shared.F.ownName ? shared.F.ownName(nodes2[i].id) : nameOf(i)).replace(/[\r\n]+/g, " ").trim();
  }
  function shownName(i) {
    return (shared.F.ownName ? shared.F.ownName(nodes2[i].id, true) : nameOf(i)).replace(/[\r\n]+/g, " ").trim();
  }
  function setName(id, v) {
    if (shared.F.rename) {
      shared.F.rename(id, v);
      return;
    }
    if (!shared.F.nameable(id)) return;
    var t2 = sbJs.label(shared.text, id, v);
    commit(t2, { name: "name", ids: [id], then: function() {
      svJoin(id);
    }, quiet: true });
  }
  function membersName(c) {
    var ms = [], rows = [], mid = function(k, d) {
      var b = boxOf(k);
      return b[d] + b[d + 2] / 2;
    };
    nodes2.forEach(function(n, k) {
      if (n.up === c) ms.push(k);
    });
    ms.sort(function(a, b) {
      return mid(a, 1) - mid(b, 1);
    }).forEach(function(k) {
      var r = rows[rows.length - 1];
      if (r && mid(k, 1) - mid(r[0], 1) <= boxOf(r[0])[3] / 2) r.push(k);
      else rows.push([k]);
    });
    return [].concat.apply([], rows.map(function(r) {
      return r.sort(function(a, b) {
        return mid(a, 0) - mid(b, 0);
      });
    })).map(function(k) {
      return shownName(k) || (nodes2[k].shape.kind === "Complex" ? membersName(k) : "");
    }).filter(function(s) {
      return s;
    }).join(":");
  }
  function __run313() {
    window.m2EditNameHere = function(member) {
      var c = complexHere(member);
      if (c == null || shared.afSbgn || afKind()) return null;
      var v = membersName(c), id = nodes2[c].id, go = function() {
        setName(id, v);
      };
      go.same = v === nameNow(c) || !shared.F.nameable(id);
      return go;
    };
    V.view.addEventListener("dblclick", function(e) {
      if (!editing(e) || cdPal()) return;
      if (tool || Date.now() - placedAt < 600) {
        e.stopImmediatePropagation();
        return;
      }
      var full2 = palOn(), P = at(e), q = full2 ? svAt(P) : null;
      var ok = function(n) {
        return shared.F.nameable(n.id);
      };
      var grp = function(n) {
        return n.el.getAttribute("yfiles.foldertype") === "group";
      };
      var nameable = function(n) {
        return (n.comp || n.shape.kind === "Complex" && !shared.afSbgn && !afKind() || full2 && !grp(n)) && ok(n);
      };
      if (q) {
        e.stopImmediatePropagation();
        typeIn(nodes2[q[0]].id, q[1]);
        return;
      }
      var i = nameAt(P, nameable);
      if (i >= 0) {
        e.stopImmediatePropagation();
        typeIn(nodes2[i].id, null);
      }
    }, true);
  }
  function nameAt(P, test) {
    var h = hit(P) || {}, n = h.n != null ? nodes2[h.n] : null, holder2 = !!n && (n.kids.length > 0 || !!n.comp) && !(shared.afSbgn && n.shape.kind === "Complex");
    if (n && !holder2) return test(n, h.n) ? h.n : -1;
    var g = nameHit(P, test);
    if (g >= 0) return g;
    return n && test(n, h.n) ? h.n : -1;
  }
  function svAt(P) {
    var own2 = shared.F.sv;
    if (own2 ? !own2.on() : shared.afSbgn || afKind()) return null;
    var res = own2 ? null : svIcons(), found = null, pad = 3 / V.z, acts = hybridActs();
    nodes2.forEach(function(n, k) {
      if (own2 ? own2.far(P, k) : n.shape.kind !== "Macromolecule" && n.shape.kind !== "NucleicAcidFeature" || acts && acts[n.id] != null) return;
      svList(k, res).forEach(function(q, j) {
        if (Math.abs(P[0] - q[1][0]) <= q[2][0] / 2 + pad && Math.abs(P[1] - q[1][1]) <= q[2][1] / 2 + pad) found = [k, j];
      });
    });
    return found;
  }
  var svDrag;
  var svKey;
  function __run323() {
    svDrag = null, svKey = null;
  }
  function svOn() {
    return palOn() || cdPal();
  }
  function svBox(i) {
    return shared.F.sv ? shared.F.sv.box(i) : boxOf(i);
  }
  function svFixed(i, j) {
    return !!(shared.F.sv && shared.F.sv.unitStays) && svList(i)[j][3] === UI;
  }
  function svNode() {
    if (!shared.svSel) return -1;
    var i = nodes2.findIndex(function(n) {
      return n.id === shared.svSel.id;
    });
    return i >= 0 && svList(i)[shared.svSel.j] ? i : -1;
  }
  function svMarks(over) {
    if (shared.typing) shared.typing.place();
    cardMarks(over);
    var i = svNode();
    if (i < 0 || !svOn()) {
      shared.svSel = null;
      return;
    }
    var q = svList(i)[shared.svSel.j], c = svDrag && svDrag.to ? svDrag.to : svKey ? svKey.to : q[1], hs = Math.max(2, HANDLE * V.z);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(d) {
      over.push('<rect class="m2-ed-handle" x="' + f1(sx(c[0] + d[0] * q[2][0] / 2) - hs / 2) + '" y="' + f1(sy(c[1] + d[1] * q[2][1] / 2) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
    });
  }
  function svDown(e, P, h) {
    if (cdNameDown(e, P, h)) return true;
    if (cardDown(e, P)) return true;
    var q = svOn() && !tool ? svAt(P) : null;
    if (!q || e.shiftKey || h && h.p != null) {
      if (shared.svSel) {
        shared.svSel = null;
        paint();
      }
      return false;
    }
    V.view.focus({ preventScroll: true });
    var again = !!shared.svSel && shared.svSel.id === nodes2[q[0]].id && shared.svSel.j === q[1];
    if (!again) {
      svDrag = { pick: q, x: e.clientX, y: e.clientY };
      return true;
    }
    e.stopImmediatePropagation();
    shared.selN = [];
    shared.selP = [];
    shared.selE = [];
    shared.part = null;
    shared.svSel = { id: nodes2[q[0]].id, j: q[1] };
    svDrag = { i: q[0], again, x: e.clientX, y: e.clientY, to: null, r: null, fixed: svFixed(q[0], q[1]) };
    paint();
    return true;
  }
  function textsOf(i, j, res) {
    var g = gN && gN[nodes2[i].id];
    if (!g) return [];
    var svs = svList(i, res), r = V.view.getBoundingClientRect(), k = V.pz();
    var rect = function(q) {
      var L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k;
      return [L - 1.5, T - 1.5, L + q[2][0] * V.z * k + 1.5, T + q[2][1] * V.z * k + 1.5];
    };
    var inside2 = function(b, R) {
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      return cx >= R[0] && cx <= R[2] && cy >= R[1] && cy <= R[3];
    };
    return Array.prototype.filter.call(g.querySelectorAll("text:not(.m2-af-ut)"), function(t) {
      if (t.closest("[data-n]") !== g) return false;
      if (!t.getClientRects().length) return false;
      var b = t.getBoundingClientRect();
      return j == null ? !svs.some(function(q) {
        return inside2(b, rect(q));
      }) : inside2(b, rect(svs[j]));
    });
  }
  function shapesOf(i, j) {
    var g = gN && gN[nodes2[i].id], q = g && svList(i)[j];
    if (!q) return [];
    var r = V.view.getBoundingClientRect(), k = V.pz(), L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k, W = q[2][0] * V.z * k, H2 = q[2][1] * V.z * k;
    return Array.prototype.filter.call(g.querySelectorAll("path, rect, ellipse, circle, polygon"), function(el) {
      if (el.closest("[data-n]") !== g) return false;
      var b = el.getBoundingClientRect();
      return Math.abs(b.left - L) < 3 && Math.abs(b.top - T) < 3 && Math.abs(b.width - W) < 4 && Math.abs(b.height - H2) < 4;
    });
  }
  function nameBox(i, res) {
    var nm = nameNow(i), ts = textsOf(i, null, res).filter(function(t) {
      var x = t.textContent.trim();
      return x && nm.indexOf(x) >= 0;
    });
    if (!ts.length) return null;
    var r = V.view.getBoundingClientRect(), k = V.pz(), L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
    ts.forEach(function(t) {
      var q = t.getBoundingClientRect();
      L = Math.min(L, q.left);
      T = Math.min(T, q.top);
      R = Math.max(R, q.right);
      B = Math.max(B, q.bottom);
    });
    var X = function(c) {
      return ((c - r.left) / k - V.tx) / V.z + x0;
    }, Y2 = function(c) {
      return ((c - r.top) / k - V.ty) / V.z + y0;
    };
    return [X(L), Y2(T), X(R) - X(L), Y2(B) - Y2(T)];
  }
  function nameHit(P, test) {
    var best = -1, area = Infinity, pad = 3 / V.z, res = null;
    nodes2.forEach(function(n, k) {
      var b = boxOf(k);
      if (n.el.getAttribute("yfiles.foldertype") !== "group" || b[2] * b[3] >= area || P[0] < b[0] - 20 || P[1] < b[1] - 20 || P[0] > b[0] + b[2] + 20 || P[1] > b[1] + b[3] + 20 || !test(n, k)) return;
      var nb = nameBox(k, res = res || svIcons());
      if (nb && P[0] >= nb[0] - pad && P[0] <= nb[0] + nb[2] + pad && P[1] >= nb[1] - pad && P[1] <= nb[1] + nb[3] + pad) {
        area = b[2] * b[3];
        best = k;
      }
    });
    return best;
  }
  function svParts(i, q) {
    var g = gN && gN[nodes2[i].id];
    if (!g) return [];
    var first = g.firstElementChild && g.firstElementChild.localName === "a" ? g.firstElementChild : g, r = V.view.getBoundingClientRect(), k = V.pz();
    var L = r.left + sx(q[1][0] - q[2][0] / 2) * k - 1.5, T = r.top + sy(q[1][1] - q[2][1] / 2) * k - 1.5, R = L + q[2][0] * V.z * k + 3, B = T + q[2][1] * V.z * k + 3;
    return Array.prototype.filter.call(first.children, function(el) {
      var b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      return b.width + b.height > 0 && cx >= L && cx <= R && cy >= T && cy <= B && b.left >= L - 2 && b.right <= R + 2 && b.top >= T - 2 && b.bottom <= B + 2;
    });
  }
  function __run333() {
    window.addEventListener("pointermove", function(e) {
      if (svDrag && svDrag.pick) {
        if (!e.buttons || Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) >= 5) svDrag = null;
        return;
      }
      if (!svDrag || !shared.svSel) return;
      if (!e.buttons) {
        svUp();
        return;
      }
      if (!svDrag.to && Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) < 4) return;
      if (svDrag.fixed) {
        svDrag.moved = true;
        return;
      }
      var i = svDrag.i, b = svBox(i), r = border(i, at(e)), q = svList(i)[shared.svSel.j];
      if (!svDrag.parts) svDrag.parts = svParts(i, q);
      svDrag.r = r;
      svDrag.to = [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]];
      var dx = svDrag.to[0] - q[1][0], dy = svDrag.to[1] - q[1][1];
      svDrag.parts.forEach(function(el) {
        if (dx || dy) el.setAttribute("transform", "translate(" + f1(dx) + " " + f1(dy) + ")");
        else el.removeAttribute("transform");
      });
      paint();
    }, true);
    window.addEventListener("pointerup", svUp, true);
    document.addEventListener("keydown", function(e) {
      if (e.key !== "Escape") return;
      if (svDrag && svDrag.parts) {
        svDrag.parts.forEach(function(el) {
          el.removeAttribute("transform");
        });
        svDrag = null;
      } else if (palDrag && palDrag.moved) {
        if (palDrag.img) palDrag.img.remove();
        palDrag = null;
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
      paint();
    }, true);
  }
  function svUp(e) {
    var d = svDrag;
    svDrag = null;
    if (!d) return;
    if (d.pick) {
      if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
      shared.selN = [];
      shared.selP = [];
      shared.selE = [];
      shared.part = null;
      shared.svSel = { id: nodes2[d.pick[0]].id, j: d.pick[1] };
      paint();
      return;
    }
    if (d.r && shared.svSel) svMove(d.i, shared.svSel.j, d.r);
    else if (d.again && !d.moved && shared.svSel) (shared.F.sv ? shared.F.sv.open : typeIn)(shared.svSel.id, shared.svSel.j);
  }
  function svMove(i, j, r) {
    if (shared.F.sv) {
      shared.F.sv.move(i, j, r);
      return;
    }
    var q = svList(i)[j], share = q[3] === SV ? svShareMove(i, q, svR(i, q), r) : null;
    if (!commit((q[3] === UI ? sbJs.unitMove : sbJs.stateMove)(shared.text, nodes2[i].id, q[4], r[0], r[1]), { name: "state variable moved", ids: [nodes2[i].id], then: share })) {
      render();
      paint();
    }
  }
  function svDelete() {
    var i = svNode();
    if (i < 0) return false;
    if (shared.F.sv) {
      var j = shared.svSel.j;
      shared.svSel = null;
      return shared.F.sv.del(i, j);
    }
    return svDeleteSb(i);
  }
  var cardSel;
  var cardDrag;
  var cardKey;
  function __run342() {
    cardSel = null, cardDrag = null, cardKey = null;
  }
  function cardK(id) {
    return edges2.findIndex(function(q) {
      return q.id === id;
    });
  }
  function cardOn() {
    if (!cardSel) return null;
    var k = cardK(cardSel.id), c = cardAll()[cardSel.id];
    if (k < 0 || !c || shared.selE.length !== 1 || shared.selE[0] !== k || shared.selN.length || shared.selP.length) {
      cardSel = null;
      return null;
    }
    return c;
  }
  function cardLen(line2) {
    return sbJs.countLens(line2).reduce(function(t, v) {
      return t + v;
    }, 0);
  }
  function cardClamp(c, r) {
    var tot = cardLen(c.line), m = tot ? (2.5 * c.text.length + 4) / tot : 0.5;
    r = m >= 0.5 ? 0.5 : Math.max(m, Math.min(1 - m, r));
    return Math.round(r * 1e4) / 1e4;
  }
  function cardDir(c, r) {
    var L = c.line, lens = sbJs.countLens(L), d = r * cardLen(L);
    for (var i = 0; i < lens.length; i++) {
      if ((d <= lens[i] || i === lens.length - 1) && lens[i]) return [(L[i + 1][0] - L[i][0]) / lens[i], (L[i + 1][1] - L[i][1]) / lens[i]];
      d -= lens[i];
    }
    return [1, 0];
  }
  function cardSide(c) {
    if (c.pos) return c.pos.s;
    var b = c.box, q = sbJs.countAlong(c.line, [b[0] + b[2] / 2, b[1] + b[3] / 2]);
    return q ? q[1] : 1;
  }
  function cardParts(c) {
    var gs = gE && gE[cardSel.id];
    if (!gs) return [];
    var r = V.view.getBoundingClientRect(), k = V.pz(), b = c.box, L = r.left + sx(b[0]) * k - 2, T = r.top + sy(b[1]) * k - 2, R = r.left + sx(b[0] + b[2]) * k + 2, B = r.top + sy(b[1] + b[3]) * k + 2, out = [];
    gs.forEach(function(g) {
      Array.prototype.forEach.call(g.querySelectorAll("rect, text"), function(el) {
        var q = el.getBoundingClientRect();
        if (q.width + q.height > 0 && q.left >= L && q.right <= R && q.top >= T && q.bottom <= B) out.push(el);
      });
    });
    return out;
  }
  function cardShow(parts, on2) {
    parts.forEach(function(el) {
      el.style.visibility = on2 ? "" : "hidden";
    });
  }
  function cardMarks(over) {
    var c = cardOn();
    if (!c) return;
    var to = cardDrag && cardDrag.to || cardKey && cardKey.to, b = to ? sbJs.countOn(c.line, c.text, to) : c.box, hs = Math.max(2, HANDLE * V.z);
    if (to) over.push('<rect x="' + f1(sx(b[0])) + '" y="' + f1(sy(b[1])) + '" width="' + f1(b[2] * V.z) + '" height="' + f1(b[3] * V.z) + '" fill="#fff" stroke="#9aa0a6" stroke-width="' + f1(0.8 * V.z) + '"/><text x="' + f1(sx(b[0] + b[2] / 2)) + '" y="' + f1(sy(b[1] + b[3] / 2 + 3.2)) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + f1(9 * V.z) + '" fill="#9aa0a6" text-anchor="middle">' + c.text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>");
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function(d) {
      over.push('<rect class="m2-ed-handle" x="' + f1(sx(b[0] + d[0] * b[2]) - hs / 2) + '" y="' + f1(sy(b[1] + d[1] * b[3]) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
    });
  }
  function cardDown(e, P) {
    if (tool || e.shiftKey) return false;
    if (shared.F.cardDown) return shared.F.cardDown(e);
    var id = cardAt(P), k = id == null ? -1 : cardK(id);
    if (k < 0) return false;
    V.view.focus({ preventScroll: true });
    if (!(cardOn() && cardSel.id === id)) {
      cardDrag = { pick: k, id, x: e.clientX, y: e.clientY };
      return true;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    cardDrag = { id, x: e.clientX, y: e.clientY, to: null, c: cardAll()[id] };
    return true;
  }
  function cardTo(c, r, s, free) {
    if (gridSet.snap && !free) {
      var tot = cardLen(c.line), st = gridSet.step / (tot || 1), g = Math.round(r / st) * st;
      r = Math.abs(r - 0.5) < Math.abs(r - g) ? 0.5 : g;
    }
    return { r: cardClamp(c, r), s };
  }
  function __run352() {
    window.addEventListener("pointermove", function(e) {
      var d = cardDrag;
      if (!d) return;
      var far = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (d.pick != null) {
        if (!e.buttons || far >= 5) cardDrag = null;
        return;
      }
      if (!e.buttons) {
        cardUp();
        return;
      }
      if (!d.to && far < 4) return;
      var q = sbJs.countAlong(d.c.line, at(e));
      if (!q) return;
      if (!d.parts) {
        d.parts = cardParts(d.c);
        cardShow(d.parts, false);
      }
      d.to = cardTo(d.c, q[0], q[1], e.altKey || e.ctrlKey);
      paint();
    }, true);
    window.addEventListener("pointerup", cardUp, true);
  }
  function cardUp(e) {
    var d = cardDrag;
    cardDrag = null;
    if (!d) return;
    if (d.pick != null) {
      if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
      shared.selN = [];
      shared.selP = [];
      shared.selE = [d.pick];
      shared.part = null;
      shared.svSel = null;
      cardSel = { id: d.id };
      paint();
      return;
    }
    if (d.to && cardSel) {
      cardMove(d.id, d.to);
      return;
    }
    if (d.parts) cardShow(d.parts, true);
    var f = !d.to && cardOn() && document.getElementById("m2-ed-card");
    if (f && !f.closest("[hidden]")) {
      f.focus();
      f.select();
    }
    paint();
  }
  function cardMove(id, pos) {
    var t2 = sbJs.countMove(shared.text, id, pos);
    if (!commit(t2, { name: "cardinality moved", ids: [id] })) {
      render();
      paint();
    }
  }
  function __run362() {
    window.addEventListener("keydown", function(e) {
      if (!cardSel || /input|textarea|select/i.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" && cardDrag && cardDrag.to) {
        if (cardDrag.parts) cardShow(cardDrag.parts, true);
        cardDrag = null;
        e.preventDefault();
        e.stopImmediatePropagation();
        paint();
        return;
      }
      var c = cardOn();
      if (!c) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        var cid = cardSel.id, t2 = sbJs.recount(shared.text, cid, "");
        cardSel = null;
        commit(t2, { name: "cardinality taken off", ids: [cid] });
        return;
      }
      var d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!cardKey) cardKey = { id: cardSel.id, at: c.pos ? c.pos.r : 0.5, s: cardSide(c), parts: cardParts(c) };
      cardShow(cardKey.parts, false);
      var u = cardDir(c, cardKey.at), a = d[0] * u[0] + d[1] * u[1], n = d[0] * -u[1] + d[1] * u[0], tot = cardLen(c.line) || 1;
      if (Math.abs(a) >= Math.abs(n)) cardKey.at = cardClamp(c, cardKey.at + Math.sign(a) * (e.shiftKey ? 10 : 1) * (gridSet.snap ? gridSet.step : 1) / tot);
      else cardKey.s = n > 0 ? 1 : -1;
      cardKey.to = { r: cardKey.at, s: cardKey.s };
      paint();
    }, true);
    window.addEventListener("keyup", function(e) {
      if (!KEYS[e.key] || !cardKey) return;
      var k = cardKey;
      cardKey = null;
      if (k.to && cardSel && cardSel.id === k.id) cardMove(k.id, k.to);
      else {
        cardShow(k.parts, true);
        paint();
      }
    }, true);
  }
  function nodesDelete(list2, arcs) {
    list2 = list2.concat(nodes2.map(function(n, k) {
      return n.sub != null && list2.indexOf(n.sub) >= 0 && list2.indexOf(k) < 0 ? k : -1;
    }).filter(function(k) {
      return k >= 0;
    }));
    var ids = list2.filter(function(i) {
      return isMade(nodes2[i]) || emptyComp(nodes2[i]) || nodes2[i].shape.kind === "Complex";
    }).map(function(i) {
      return nodes2[i].id;
    });
    var eids = (arcs || []).map(function(k) {
      return edges2[k] && edges2[k].id;
    }).filter(Boolean);
    if (!ids.length && !eids.length) return false;
    var t2 = ids.length ? sbJs.remove(shared.text, ids) : shared.text;
    if (eids.length) t2 = sbJs.arcRemove(t2, eids);
    return commit(t2, { name: "deleted", ids: ids.concat(eids), sel: [] });
  }
  var KEYS;
  function __run372() {
    KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  }
  function perim(b) {
    return 2 * (b[2] + b[3]);
  }
  function toT(b, r) {
    var w = b[2], h = b[3], dt = Math.abs(r[1] + 0.5) * h, dr = Math.abs(r[0] - 0.5) * w, db2 = Math.abs(r[1] - 0.5) * h, dl = Math.abs(r[0] + 0.5) * w, m = Math.min(dt, dr, db2, dl);
    if (m === dt) return (r[0] + 0.5) * w;
    if (m === dr) return w + (r[1] + 0.5) * h;
    if (m === db2) return w + h + (0.5 - r[0]) * w;
    return 2 * w + h + (0.5 - r[1]) * h;
  }
  function fromT(b, t) {
    var w = b[2], h = b[3], P = perim(b);
    t = (t % P + P) % P;
    if (t < w) return [t / w - 0.5, -0.5];
    if (t < w + h) return [0.5, (t - w) / h - 0.5];
    if (t < 2 * w + h) return [0.5 - (t - w - h) / w, 0.5];
    return [-0.5, 0.5 - (t - 2 * w - h) / h];
  }
  function keyDir(b, t, d) {
    var w = b[2], h = b[3], P = perim(b), sideOf = function(u) {
      u = (u % P + P) % P;
      return u < w ? 0 : u < w + h ? 1 : u < 2 * w + h ? 2 : 3;
    };
    var TAN = [[1, 0], [0, 1], [-1, 0], [0, -1]], OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    var sides = [sideOf(t), sideOf(t - 0.5), sideOf(t + 0.5)];
    for (var k = 0; k < sides.length; k++) {
      var a = d[0] * TAN[sides[k]][0] + d[1] * TAN[sides[k]][1];
      if (a) return Math.sign(a);
    }
    return d[0] * OUT[sides[0]][0] + d[1] * OUT[sides[0]][1] > 0 ? -1 : 1;
  }
  function __run38() {
    document.addEventListener("keydown", function(e) {
      var d = KEYS[e.key];
      if (!d || !shared.svSel || !svOn() || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      var i = svNode();
      if (i < 0 || svFixed(i, shared.svSel.j)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var b = svBox(i), q = svList(i)[shared.svSel.j];
      if (!svKey) svKey = { i, t: toT(b, [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5]), c0: q[1], parts: svParts(i, q) };
      if (!e.repeat || svKey.key !== e.key) {
        svKey.key = e.key;
        svKey.dir = keyDir(b, (svKey.t % perim(b) + perim(b)) % perim(b), d);
      }
      svKey.t += svKey.dir * (e.shiftKey ? 10 : 1);
      var r = fromT(b, svKey.t);
      svKey.r = [Math.round(r[0] * 1e4) / 1e4, Math.round(r[1] * 1e4) / 1e4];
      svKey.to = [b[0] + (0.5 + svKey.r[0]) * b[2], b[1] + (0.5 + svKey.r[1]) * b[3]];
      var dx = svKey.to[0] - svKey.c0[0], dy = svKey.to[1] - svKey.c0[1];
      svKey.parts.forEach(function(el) {
        el.setAttribute("transform", "translate(" + f1(dx) + " " + f1(dy) + ")");
      });
      paint();
    }, true);
    document.addEventListener("keyup", function(e) {
      if (!KEYS[e.key] || !svKey) return;
      var k = svKey;
      svKey = null;
      if (!k.r || !shared.svSel) return;
      svMove(k.i, shared.svSel.j, k.r);
    }, true);
    document.addEventListener("keydown", function(e) {
      if (shared.svSel && (e.key === "Escape" || (e.ctrlKey || e.metaKey) && /^[zya]$/i.test(e.key) && !V.typing())) {
        shared.svSel = null;
        paint();
      }
    }, true);
    document.addEventListener("keydown", function(e) {
      if (e.key !== "Delete" && e.key !== "Backspace" || !svOn() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (!palOn()) {
        if (svDelete()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (svDelete() || (shared.selN.length || shared.selE.length && !shared.selP.length) && nodesDelete(shared.selN, shared.selP.length ? [] : shared.selE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    window.m2EditDelete = function() {
      if (cdPal()) return cdDeleteItem();
      if (!palOn() || !rclick) return null;
      var q = svAt(rclick);
      if (q) return function() {
        shared.svSel = { id: nodes2[q[0]].id, j: q[1] };
        svDelete();
      };
      var i = madeAt(rclick);
      if (i < 0) i = innermost(rclick, function(n) {
        return emptyComp(n) || n.shape.kind === "Complex";
      });
      if (i >= 0) return function() {
        if (shared.selN.indexOf(i) >= 0) nodesDelete(shared.selN, shared.selP.length ? [] : shared.selE);
        else nodesDelete([i]);
      };
      var h = hit(rclick);
      if (!h || h.e == null || h.p != null) return null;
      return function() {
        if (shared.selE.indexOf(h.e) >= 0 && !shared.selP.length) nodesDelete(shared.selN, shared.selE);
        else arcsDelete([h.e]);
      };
    };
  }
  function arcsDelete(list2) {
    var ids = list2.map(function(k) {
      return edges2[k] && edges2[k].id;
    }).filter(Boolean);
    if (!ids.length) return false;
    return commit(sbJs.arcRemove(shared.text, ids), { name: "arcs deleted", ids, sel: [] });
  }
  var palDrag;
  var GHOST;
  function __run39() {
    palDrag = null;
    GHOST = { submap: "rectangle", compartment: "roundrectangle", process: "rectangle", "omitted process": "rectangle", "uncertain process": "rectangle" };
    pal.addEventListener("pointerdown", function(e) {
      var b = e.target.closest("button[data-make]");
      if (b && e.button === 0 && !ARCS[b.dataset.make] && !CD_GATE[b.dataset.make]) palDrag = { kind: b.dataset.make, x: e.clientX, y: e.clientY, img: null };
    });
  }
  function palOver(e) {
    var r = V.view.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  var link;
  function __run40() {
    window.addEventListener("pointermove", function(e) {
      if (!palDrag) return;
      if (!e.buttons) {
        if (palDrag.img) palDrag.img.remove();
        palDrag = null;
        return;
      }
      if (!palDrag.moved && Math.hypot(e.clientX - palDrag.x, e.clientY - palDrag.y) < 5) return;
      palDrag.moved = true;
      if (!(palOn() || cdPal())) {
        if (palDrag.img) palDrag.img.hidden = true;
        return;
      }
      if (!palDrag.img && cdKind(palDrag.kind)) {
        var cg = cdGhost(palDrag.kind);
        palDrag.img = document.createElement("div");
        palDrag.img.className = "m2-ed-palghost";
        palDrag.img.style.cssText = "width:" + cg.w * V.z + "px;height:" + cg.h * V.z + "px";
        palDrag.img.innerHTML = cg.svg;
        V.view.appendChild(palDrag.img);
      }
      if (!palDrag.img) {
        var D = defOf(palDrag.kind);
        palDrag.img = document.createElement("div");
        palDrag.img.className = "m2-ed-palghost";
        palDrag.img.style.cssText = "width:" + D.w * V.z + "px;height:" + D.h * V.z + "px";
        var w = D.w, h = D.h, cmp = palDrag.kind === "compartment", au = ACT_UNIT[baseKind(palDrag.kind)], act = shared.afSbgn && au != null, sh = act ? { kind: "Macromolecule", props: { radius: "0" } } : { kind: GHOST[palDrag.kind] || sbJs.MAKE[au != null ? sbJs.unitClass(au) : baseKind(palDrag.kind)], props: { radius: "10", radiusX: "12", radiusY: "12" } };
        var ink = '" fill="' + (D.fill || (cmp ? "none" : "#fff")) + '" stroke="' + (D.line || "#000") + '" stroke-width="' + (D.width || (cmp ? 2 : 1)) + '"/>';
        palDrag.img.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + w + " " + h + '" overflow="visible"><path d="' + outlineD(sh, 0, 0, w, h) + ink + (palDrag.kind === "source and sink" ? '<path d="M0 ' + h + "L" + w + " 0" + ink : "") + (sbJs.SIGN[palDrag.kind] ? '<text x="' + w / 2 + '" y="' + h * 0.75 + '" text-anchor="middle" font-family="Dialog, Arial, sans-serif" font-size="' + h * 0.75 + '">' + sbJs.SIGN[palDrag.kind] + "</text>" : "") + (sbJs.GATE[palDrag.kind] ? '<text x="' + w / 2 + '" y="' + (h / 2 + 4.5) + '" text-anchor="middle" font-family="Dialog, Arial, sans-serif" font-size="12">' + sbJs.GATE[palDrag.kind] + "</text>" : "") + "</svg>";
        V.view.appendChild(palDrag.img);
      }
      var r = V.view.getBoundingClientRect(), g = palDrag.img;
      g.hidden = false;
      g.style.left = (e.clientX - r.left) / V.pz() - g.offsetWidth / 2 + "px";
      g.style.top = (e.clientY - r.top) / V.pz() - g.offsetHeight / 2 + "px";
    }, true);
    window.addEventListener("pointerup", function(e) {
      var d = palDrag;
      palDrag = null;
      if (!d || !d.moved) return;
      if (d.img) d.img.remove();
      if (!palOver(e) || !(palOn() || cdPal())) return;
      placedAt = Date.now();
      if (cdKind(d.kind)) {
        if (cdPal()) cdMake(at(e), d.kind);
        return;
      }
      makeEntity(at(e), d.kind);
    }, true);
    link = null;
  }
  function linkEnd(P, not) {
    var R = 4 / V.z, best = -1, ba = Infinity, L = shared.F.line;
    nodes2.forEach(function(n, i) {
      var b = L ? boxOf(i) : landBox(i, boxOf(i)), r = L ? L.role(i) : roleOf(i) || (hybOn() && nodes2[i].shape.kind === "Submap" ? "sub" : null);
      if (i === not || !r || P[0] < b[0] - R || P[0] > b[0] + b[2] + R || P[1] < b[1] - R || P[1] > b[1] + b[3] + R) return;
      if (b[2] * b[3] < ba) {
        ba = b[2] * b[3];
        best = i;
      }
    });
    return best < 0 && L ? L.lineAt(P, not) : best;
  }
  var downs;
  function __run41() {
    downs = /* @__PURE__ */ new Set();
    window.addEventListener("pointerdown", function(e) {
      downs.add(e.pointerId);
    }, true);
    ["pointerup", "pointercancel"].forEach(function(k) {
      window.addEventListener(k, function(e) {
        downs.delete(e.pointerId);
      }, true);
    });
  }
  function linkDown(e, P, h) {
    if (!(palOn() || cdPal()) || e.shiftKey || downs.size > 1 || link) return false;
    if (!arcTool()) return false;
    var L = shared.F.line;
    if (h.n == null && !h.glyph && !(L && L.onLine())) return false;
    var i = linkEnd(P, -1);
    if (i < 0) return false;
    if (L && !L.startOk(i)) return false;
    e.stopImmediatePropagation();
    e.preventDefault();
    V.view.setPointerCapture(e.pointerId);
    V.view.focus({ preventScroll: true });
    link = { from: i, pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false, to: -1, P, how: null, at: shared.text };
    shared.tap = { h, shift: false, x: e.clientX, y: e.clientY };
    return true;
  }
  function linkHow(a, b, P) {
    if (shared.F.line) return shared.F.line.how(a, b, P);
    var want = arcTool(), h = linkKind(a, b, P, want), g;
    if (h && h.no && want && tool.sticky && (g = linkKind(a, b, P, null)) && !g.no && !(g.pair && MODK[want])) return g;
    if (h && h.no && want === "catalysis" && tool.sticky && (g = linkKind(a, b, P, "stimulation")) && !g.no) return g;
    return h;
  }
  function fans(g) {
    if (!V.fanout || sbgnStrict() || nodes2[g].eq) return false;
    var l = nodes2[g].el.getElementsByTagNameNS(Y, "NodeLabel")[0], w = l ? l.textContent.trim().toUpperCase() : "";
    return w === "AND" || w === "OR";
  }
  function ntKind(i) {
    if (i < 0) return { kind: "process", cls: "process" };
    var r = roleOf(i), sub = nodes2[i].shape.kind === "Submap" && !nodes2[i].comp;
    if (!r && !sub) return null;
    var l = nodes2[i].el.getElementsByTagNameNS(Y, "NodeLabel")[0];
    if (nodes2[i].shape.kind === "NucleicAcidFeature") return import_notation2.default.nodeKind("graphml", "NucleicAcidFeature", ntUnits(i));
    return import_notation2.default.nodeKind("graphml", r === "proc" ? "Process" : nodes2[i].shape.kind, l ? l.textContent.trim() : "");
  }
  var unitMemo;
  function ntUnits(i) {
    if (!unitMemo || unitMemo[0] !== shared.text) unitMemo = [shared.text, svIcons()];
    return svList(i, unitMemo[1]).filter(function(q) {
      return q[3] === "UnitOfInformation";
    }).map(function(q) {
      return q[0].trim();
    }).join(" ");
  }
  function ntSets() {
    return (palLangNow() === "af" ? ["af"] : hybOn() ? ["pd", "reduced"] : ["pd"]).concat(V.fanout ? ["fanout"] : [], sbgnStrict() ? ["strict"] : []);
  }
  var revMemo;
  function reversibleNow(id) {
    if (!revMemo || revMemo.t !== shared.text) revMemo = { t: shared.text, r: {} };
    if (!(id in revMemo.r)) revMemo.r[id] = sbJs.reversibility(shared.text, id, { sbgn: src() });
    return revMemo.r[id];
  }
  function ntCheck(cls, s, t, skip) {
    var plain = import_notation2.default.arcHead("graphml", cls) === "none", same2 = function(q) {
      return plain ? q.arr[1] === "none" : import_notation2.default.arcKind("graphml", q.arr[1]) === cls;
    };
    var lines = function(f) {
      return edges2.filter(function(q, j) {
        return j !== skip && f(q);
      }).length;
    };
    return function(c) {
      if (c === "gateOneOut") return lines(function(q) {
        return q.s === s;
      }) ? "A logic gate has one line out, and this one has it." : null;
      if (c === "oneInput") return lines(function(q) {
        return q.t === t;
      }) ? "This gate has one input, and it has it." : null;
      if (c === "already") return s >= 0 && t >= 0 && lines(function(q) {
        return same2(q) && (q.s === s && q.t === t || plain && q.s === t && q.t === s);
      }) ? "This line is there already." : null;
      if (c === "tagRoom") {
        if (s < 0 || t < 0) return null;
        var tg = roleOf(s) === "tag" ? s : t;
        return tagRoom(tg, tg === s ? t : s, skip);
      }
      if (c === "reversible") {
        var rv = t >= 0 && reversibleNow(nodes2[t].id);
        return rv && rv.rev ? "A reversible process has productions on both sides." : null;
      }
      if (c === "oneCatalysis" || c === "oneNecessary") return t >= 0 && lines(function(q) {
        return q.t === t && same2(q);
      }) ? "A process has one " + cls + " in SBGN (Strict SBGN is ticked in the palette)." : null;
      if (c === "emptyOne") {
        var x = cls === "consumption" ? s : t;
        return x >= 0 && lines(function(q) {
          return q.s === x || q.t === x;
        }) ? "An empty set has one line in SBGN (Strict SBGN is ticked in the palette)." : null;
      }
      return null;
    };
  }
  function ntHeld(k, s) {
    var h = k >= 0 ? edges2[k] : null, hs = h && ntKind(h.s), ht = h && ntKind(h.t), ns = h && ntKind(s);
    var pic = function(x) {
      return x.kind === "phenotype" || x.kind === "submap";
    };
    return !!(ht && hs && ns) && pic(hs) === pic(ns) && (ht.kind === "entity" || pic(hs) && ht.kind !== "process");
  }
  function ruleSays(cls, s, t, skip) {
    var ks = ntKind(s), kt = ntKind(t);
    if (skip == null) skip = -1;
    if (!ks || !kt) return null;
    return import_notation2.default.allowed(cls, ks, kt, { sets: ntSets(), check: ntCheck(cls, s, t, skip), held: ntHeld(skip, s) });
  }
  function moveCls(k, s, t) {
    var e = edges2[k], kt = ntKind(t);
    if (e.arr[1] !== "none") return import_notation2.default.arcKind("graphml", e.arr[1]);
    if ([e.s, e.t, s, t].some(function(x) {
      return roleOf(x) === "tag";
    })) return "equivalence arc";
    return import_notation2.default.arcKind("graphml", "none", kt ? kt.kind : "") || "logic arc";
  }
  function moveSays(k, end, i) {
    if (shared.F.line) return shared.F.line.moveSays(k, end, i);
    var e = edges2[k], s = end ? e.s : i, t = end ? i : e.t;
    if (!ntKind(s) || !ntKind(t)) return "Not a glyph of the notation.";
    return ruleSays(moveCls(k, s, t), s, t, k);
  }
  function linkKind(a, b, P, want) {
    var r = linkKind0(a, b, P, want), m = r && !r.no && (r.pair ? ruleSays("consumption", a, -1) || ruleSays("production", -1, b) : ruleSays(r.cls, a, b));
    return m ? { no: m } : r;
  }
  function linkKind0(a, b, P, want) {
    if (b < 0) return null;
    var ra = roleOf(a), rb = roleOf(b), eqA = !!nodes2[a].eq, eqB = !!nodes2[b].eq;
    var has = function(s, t, head) {
      return edges2.some(function(q) {
        return q.s === s && q.t === t && q.arr[1] === head;
      });
    };
    var ok = function(cls2) {
      return has(a, b, sbJs.ARROW[cls2]) ? { no: "This " + cls2 + " is there already." } : { cls: cls2 };
    };
    var outs = function(g) {
      return edges2.filter(function(q) {
        return q.s === g;
      }).length;
    }, ins = function(g) {
      return edges2.filter(function(q) {
        return q.t === g;
      }).length;
    };
    if (ra === "tag" || rb === "tag") {
      var why = "A tag is joined to an entity by an equivalence arc.";
      if ((ra === "tag" ? rb : ra) !== "epn" || want && want !== "consumption" && want !== "logic arc") return { no: why };
      var room = tagRoom(ra === "tag" ? a : b, ra === "tag" ? b : a, -1);
      if (room) return { no: room };
      return has(a, b, "none") || has(b, a, "none") ? { no: "This equivalence arc is there already." } : { cls: "equivalence arc" };
    }
    if (ra === "pheno" && rb === "proc" && !sbgnStrict()) ra = "epn";
    if (ra === "proc" && rb === "pheno" && !sbgnStrict() && (!want || want === "production")) return has(a, b, "delta") ? { no: "This production is there already." } : { cls: "production" };
    var loose = hybOn(), subA = loose && nodes2[a].shape.kind === "Submap", subB = loose && nodes2[b].shape.kind === "Submap";
    if (subB) rb = "pheno";
    if (!loose && (nodes2[a].shape.kind === "Submap" || nodes2[b].shape.kind === "Submap")) return { no: "A submap is joined to the map by its tags or terminals (Reduced notation is unticked in the palette)." };
    if (loose && (ra === "pheno" || subA)) {
      if (want && !MODK[want] || want === "catalysis") return { no: "A phenotype or a submap starts a stimulation, inhibition, necessary stimulation or modulation." };
      if (rb !== "proc" && rb !== "pheno" && rb !== "epn") return { no: "A line from a phenotype or a submap goes to a process, an entity, a phenotype or a submap." };
      var u = want || usual(b, "stimulation");
      return ok(u === "catalysis" ? "stimulation" : u);
    }
    if (ra === "pheno") return { no: sbgnStrict() ? "Nothing leaves a phenotype in SBGN (Strict SBGN is ticked in the palette)." : "A line from a phenotype goes into a process (Reduced notation is unticked in the palette)." };
    if (ra === "gate" && !fans(a) && outs(a)) return { no: "A logic gate has one line out, and this one has it." };
    var word = function(i) {
      var l = nodes2[i].el.getElementsByTagNameNS(Y, "NodeLabel")[0];
      return l ? l.textContent.trim() : "";
    };
    if (rb === "gate" && (word(b) === "\u03C4" || word(b).toUpperCase() === "NOT") && ins(b)) return { no: "A " + (word(b) === "\u03C4" ? "delay" : "NOT gate") + " has one input, and this one has it." };
    var af = palLangNow() === "af";
    if (af) {
      if (ra === "epn" && rb === "epn") return want && !MODK[want] ? { no: "Activity Flow joins activities by an influence." } : ok(want || usual(b, "stimulation"));
      if (ra === "gate" && !eqA && rb === "epn") return want && !MODK[want] ? { no: "A logic gate\u2019s output is an influence." } : ok(want || usual(b, "stimulation"));
    } else if (hybOn()) {
      if (ra === "epn" && rb === "epn" && want && MODK[want]) return want === "catalysis" ? { no: "A catalysis ends on a process." } : ok(want);
      if (ra === "gate" && !eqA && rb === "epn" && (!want || MODK[want])) return want === "catalysis" ? { no: "A catalysis ends on a process." } : ok(want || usual(b, "stimulation"));
    }
    if (want === "logic arc" && rb !== "gate" && !(eqA && rb === "epn")) return { no: "A logic arc goes into a logic gate." };
    if (want && MODK[want]) {
      if ((ra === "epn" || ra === "gate" && !eqA) && (rb === "proc" || rb === "pheno")) return ok(want);
      return { no: "A " + want + " goes from an entity or a logic gate to a process or a phenotype" + ((ra === "epn" || ra === "gate") && rb === "epn" && palLangNow() === "pd" && !hybOn() ? " (Reduced notation is unticked in the palette)." : ".") };
    }
    if (rb === "gate") {
      if (want === "production") return { no: "A production goes from a process to an entity." };
      if (ra === "proc") return { no: "A process does not go into a logic gate: the gate\u2019s output goes to the process." };
      if (ra === "gate" && (eqA || eqB)) return { no: "An equivalence joins entities only." };
      return ok("logic arc");
    }
    if (ra === "gate") {
      if ((want === "logic arc" || want === "consumption") && eqA) return rb === "epn" ? ok("logic arc") : { no: "An equivalence\u2019s line goes to an entity." };
      if (want) return { no: "A " + want + " does not leave a logic gate: its output is a modulation (a stimulation, unless another is picked)." };
      if (eqA) return rb === "epn" ? ok("logic arc") : { no: "An equivalence\u2019s line goes to an entity." };
      return rb === "epn" ? { no: "A logic gate\u2019s output goes to a process, a phenotype or another gate (Reduced notation is unticked in the palette)." } : ok(usual(b, "stimulation"));
    }
    if (rb === "pheno") {
      if (ra !== "epn" || want) return { no: "A phenotype is modulated by an entity or a logic gate (a stimulation, unless another modulation is picked)." };
      return ok(usual(b, "stimulation"));
    }
    if (ra === "proc" && rb === "proc") return { no: "An arc goes from an entity into a process (a consumption) or from a process to an entity (a production), not between two processes." };
    if (ra === "epn" && rb === "epn") return !want || want === "consumption" || want === "production" ? { pair: true } : { no: "A " + want + " does not join two entities. A process is made between them with Consumption or Production picked." };
    var cls = ra === "epn" ? "consumption" : "production";
    if (want && want !== cls) return { no: want === "consumption" ? "A consumption goes from an entity into a process." : "A production goes from a process to an entity." };
    if (!want && cls === "consumption" && P && offAxis(b, P)) {
      var n = nodes2[a], sub = edges2.some(function(q) {
        return q.t === b && q.arr[1] === "none" && nodes2[q.s].shape.kind === "SimpleChemical";
      });
      return ok(usual(b, sub && (/^(Macromolecule|Complex)$/.test(n.shape.kind) || n.kids.length > 0) ? "catalysis" : "stimulation"));
    }
    if (has(a, b, cls === "production" ? "delta" : "none")) return { no: "This " + cls + " is there already." };
    return { cls };
  }
  function askAll(o) {
    if (!palOn()) return null;
    var keep = palSet, rows = {};
    palSet = { lang: o && o.lang || "pd", look: palSet.look, strict: !!(o && o.strict), sbgn: !!(o && o.sbgn) };
    try {
      var kindOf2 = ntKind, name2 = function(k) {
        return k.kind + ":" + k.cls;
      }, sets = ntSets();
      edges2.forEach(function(e, k) {
        var a = e.arr[1];
        if (a !== "none" && !import_notation2.default.arcKind("graphml", a)) return;
        [0, 1].forEach(function(end) {
          nodes2.forEach(function(n, i) {
            if (i === e.s || i === e.t) return;
            var s = end ? e.s : i, t = end ? i : e.t, ks = kindOf2(s), kt = kindOf2(t);
            if (!ks || !kt) return;
            var c = moveCls(k, s, t);
            var was = a !== "none" ? c : import_notation2.default.arcKind("graphml", "none", kindOf2(e.t) ? kindOf2(e.t).kind : "") || "logic arc";
            var key = [was, end, name2(ks), name2(kt), name2(kindOf2(e.s) || { kind: "?" }), name2(kindOf2(e.t) || { kind: "?" })].join("|");
            if (rows[key]) return;
            var want = c === "equivalence arc" && (ks.kind === "tag" || kt.kind === "tag") ? "consumption" : c, h = linkKind(s, t, null, want);
            rows[key] = {
              arc: was,
              now: c,
              end: end ? "target" : "source",
              from: name2(ks),
              to: name2(kt),
              line: name2(kindOf2(e.s) || { kind: "?" }) + " > " + name2(kindOf2(e.t) || { kind: "?" }),
              drag: !!takes(k, end, i),
              draw: !h ? "nothing" : h.no ? h.no : h.pair ? "pair" : h.cls,
              tableDrag: import_notation2.default.allowed(c, ks, kt, { sets, check: ntCheck(c, s, t, k), held: ntHeld(k, s) }),
              tableDraw: import_notation2.default.allowed(c, ks, kt, { sets, check: ntCheck(c, s, t, -1) })
            };
          });
        });
      });
    } finally {
      palSet = keep;
    }
    return Object.keys(rows).map(function(k) {
      return rows[k];
    });
  }
  function __run61() {
    window.m2EditAsk = askAll;
  }
  function usual(b, dflt) {
    var rb = roleOf(b), kind = {}, n = {}, best = dflt, most = 0;
    Object.keys(MODK).forEach(function(k) {
      if (k !== "catalysis" || rb === "proc") kind[sbJs.ARROW[k]] = k;
    });
    edges2.forEach(function(q) {
      var k = kind[q.arr[1]];
      if (k && q.t != null && roleOf(q.t) === rb) n[k] = (n[k] || 0) + 1;
    });
    PAL_PD[4][1].forEach(function(q) {
      if (n[q[0]] > most) {
        most = n[q[0]];
        best = q[0];
      }
    });
    return best;
  }
  function offAxis(i, P) {
    var id = nodes2[i].id, H2 = window.yrender && hubPorts()[id], b = bx(i), c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    if (!H2 || !H2[0] || !edges2.some(function(q) {
      return q.t === i && q.arr[1] === "none" || q.s === i && q.arr[1] === "delta";
    })) return false;
    var hz = Math.abs(H2[0][0] - c[0]) >= Math.abs(H2[0][1] - c[1]), dx = Math.abs(P[0] - c[0]), dy = Math.abs(P[1] - c[1]);
    return hz ? dy > dx : dx > dy;
  }
  function linkMove(e) {
    if (!link || e.pointerId !== link.pid) return false;
    e.stopImmediatePropagation();
    if (e.pointerType === "mouse" && !e.buttons || link.at !== shared.text) {
      link = null;
      shared.tap = null;
      paint();
      return true;
    }
    if (!link.moved && Math.hypot(e.clientX - link.x, e.clientY - link.y) < 5) return true;
    link.moved = true;
    shared.tap = null;
    link.P = at(e);
    link.to = linkEnd(link.P, link.from);
    link.how = linkHow(link.from, link.to, link.P);
    paint();
    return true;
  }
  function linkUp(e) {
    if (!link || e.pointerId !== link.pid) return false;
    var l = link;
    link = null;
    if (!l.moved) return false;
    e.stopImmediatePropagation();
    paint();
    if (e.type !== "pointerup" || !l.how || l.at !== shared.text) return true;
    if (l.how.no) return true;
    linkMake(l.from, l.to, l.how);
    if (tool && !tool.sticky) palTake(null);
    return true;
  }
  function linkMake(a, b, how) {
    if (shared.F.line) {
      shared.F.line.make(a, b, how);
      return;
    }
    var ia = nodes2[a].id, ib = nodes2[b].id, t2 = shared.text, ids = [], o = { sbgn: src(), ant: antNow() };
    try {
      if (how.cls) {
        ids.push(freeId("arc_"));
        t2 = sbJs.connect(t2, ids[0], ia, ib, how.cls, o);
      } else {
        var A = bx(a), B = bx(b), M = [(A[0] + A[2] / 2 + B[0] + B[2] / 2) / 2, (A[1] + A[3] / 2 + B[1] + B[3] / 2) / 2], D = defOf("process");
        var X = M[0] - D.w / 2, Y2 = M[1] - D.h / 2;
        if (gridSet.snap) {
          X += toGrid(X + D.w / 2, gridSet.step);
          Y2 += toGrid(Y2 + D.h / 2, gridSet.step);
        }
        var c = innermost(M, function(n) {
          return n.comp;
        }), pid = freeId("glyph_");
        t2 = sbJs.add(t2, { id: pid, cls: "process", label: "", box: [+fmt(X), +fmt(Y2), D.w, D.h], parent: c >= 0 ? nodes2[c].id : null });
        ids.push(freeId("arc_"));
        ids.push(freeId("arc_", ids));
        t2 = sbJs.connect(t2, ids[0], ia, pid, "consumption", o);
        t2 = sbJs.connect(t2, ids[1], pid, ib, "production", o);
      }
    } catch (err) {
      warn("The arc could not be made: " + (err && err.message || err) + ".");
      return;
    }
    if (sbCols() === "confetti") ids.forEach(function(id) {
      t2 = sbJs.recolour(t2, id, confettiLine(confettiHues(t2)).toUpperCase());
    });
    if (t2 === shared.text) return;
    commit(t2, { name: "arc made", sel: [], selE: ids, quiet: true, then: function() {
      tagAim([ia, ib]);
      termsFix(nodes2.map(function(n, k) {
        return (n.id === ia || n.id === ib) && n.sub != null ? k : -1;
      }).filter(function(k) {
        return k >= 0;
      }));
    } });
  }
  function linkLand(a, b, cls) {
    var B = bx(b), c = [B[0] + B[2] / 2, B[1] + B[3] / 2], r = roleOf(b), H2 = r && /^(proc|gate)$/.test(r) && window.yrender && hubPorts()[nodes2[b].id];
    if (!r || !/^(proc|gate)$/.test(r)) return c;
    if ((cls === "consumption" || cls === "logic arc") && H2 && H2[0]) return H2[0];
    if (!cls || !MODS.test(sbJs.ARROW[cls]) || r !== "proc") return c;
    var A = bx(a), dx = A[0] + A[2] / 2 - c[0], dy = A[1] + A[3] / 2 - c[1];
    var vert = H2 && H2[0] ? Math.abs(H2[0][0] - c[0]) >= Math.abs(H2[0][1] - c[1]) : Math.abs(dy) > Math.abs(dx);
    return vert ? [c[0], c[1] + (dy >= 0 ? 1 : -1) * B[3] / 2] : [c[0] + (dx >= 0 ? 1 : -1) * B[2] / 2, c[1]];
  }
  function linkPaint(out) {
    cdGateMarks(out);
    cdOverMarks(out);
    if (!link || !link.moved || link.at !== shared.text) return;
    var A = bx(link.from), C = [A[0] + A[2] / 2, A[1] + A[3] / 2], no2 = !!(link.how && link.how.no);
    var P = link.P, inFrom = inRim(rimOf(link.from, A), [P[0] - C[0], P[1] - C[1]]), S = inFrom ? null : cutShape(link.from, C, P, A);
    if (S && link.to >= 0 && link.to !== link.from) P = cutShape(link.to, P, S, bx(link.to));
    var L = shared.F.line, E = L && S ? L.liveEnds(S, P, C) : null;
    if (E) {
      S = E[0];
      P = E[1];
    }
    if (L) L.marks(out);
    else if (link.how && !no2 && link.to >= 0) out.push(landMarks([], linkLand(link.from, link.to, link.how.cls)));
    if (S) out.push('<path class="m2-ed-live" stroke-width="' + f1(Math.max(1, V.z)) + '"' + (no2 ? ' stroke-dasharray="4 3"' : "") + ' d="M' + f1(sx(S[0])) + " " + f1(sy(S[1])) + "L" + f1(sx(P[0])) + " " + f1(sy(P[1])) + '"/>');
  }
  function __run422() {
    document.addEventListener("keydown", function(e) {
      if (link && e.key === "Escape") {
        link = null;
        shared.tap = null;
        paint();
      }
    }, true);
  }
  function propFmt() {
    return palOn() ? PF_SB : cdPal() ? PF_CD : null;
  }
  function sizable(i) {
    var f = propFmt(), n = nodes2[i];
    if (!f || !n) return false;
    return n.shape.kind === "Complex" && n.kids.length ? !shared.afSbgn : f.sizable(i);
  }
  function setSize(i, nb) {
    setSizes([[i, nb]]);
  }
  function setSizes(pairs) {
    var f = propFmt();
    if (f) f.size(pairs.map(function(q) {
      return [q[0], q[1].map(function(v) {
        return +fmt(v);
      })];
    }));
  }
  function termScaled(b, b0, b1) {
    var rx2 = b0[2] ? (b[0] + b[2] / 2 - b0[0]) / b0[2] : 0.5, ry = b0[3] ? (b[1] + b[3] / 2 - b0[1]) / b0[3] : 0.5;
    return [b1[0] + rx2 * b1[2] - b[2] / 2, b1[1] + ry * b1[3] - b[3] / 2, b[2], b[3]];
  }
  var ROWS;
  var props;
  var EROWS;
  var RROWS;
  function __run432() {
    ROWS = [
      ["label", "Label", "text"],
      ["font", "Font size", "num", ' min="1" max="200"', "The name\u2019s size"],
      ["w", "Width", "num"],
      ["h", "Height", "num"],
      ["fill", "Fill colour", "colour"],
      ["line", "Border colour", "colour"],
      ["width", "Border width", "num"],
      ["multimer", "Multimer", "check"]
    ];
    props = document.createElement("div");
    props.className = "m2-ed-props";
    props.hidden = true;
    EROWS = [
      ["ecol", "Line colour", "colour"],
      ["ewid", "Line width", "num", ' min="0.25" max="20"'],
      ["sx", "Source port X", "num"],
      ["sy", "Source port Y", "num"],
      ["tx", "Target port X", "num"],
      ["ty", "Target port Y", "num"],
      ["card", "Cardinality", "card"]
    ];
    RROWS = [["rev", "Reversible", "check"]];
  }
  function table(rows, cls) {
    return '<table class="m2-ed-ptab' + cls + '">' + rows.map(function(r) {
      var id = "m2-ed-" + r[0], f = r[2] === "check" ? '<input type="checkbox" id="' + id + '">' : r[2] === "select" ? '<select id="' + id + '">' + r[3].map(function(o) {
        return '<option value="' + o + '">' + o + "</option>";
      }).join("") + "</select>" : r[2] === "colour" ? '<span class="m2-ed-pc"><input type="color" tabindex="-1" aria-label="' + r[1] + ', picker"><input type="text" id="' + id + '" spellcheck="false" autocomplete="off"' + (r[0] === "fill" ? ' placeholder="none"' : "") + "></span>" : r[2] === "num" ? '<input type="number" id="' + id + '" step="any"' + (r[3] || (r[0] === "width" ? ' min="0.25" max="20"' : /^[st][xy]$/.test(r[0]) ? "" : ' min="1" max="5000"')) + ">" : r[2] === "card" ? '<input type="text" inputmode="decimal" class="m2-ed-card" id="' + id + '" placeholder="1" spellcheck="false" autocomplete="off">' : r[2] === "pic" ? '<span class="m2-ed-ppic"><img alt="" hidden><span class="m2-ed-ppicname"></span><button type="button" id="' + id + '">Upload</button><button type="button" class="m2-ed-ppicoff">Remove</button></span>' : '<input type="text" id="' + id + '" spellcheck="false" autocomplete="off">';
      return '<tr data-k="' + r[0] + '"' + (r[4] ? ' title="' + r[4] + '"' : "") + '><th><label for="' + id + '">' + r[1] + "</label></th><td>" + f + "</td></tr>";
    }).join("") + "</table>";
  }
  var inW;
  var inH;
  var field;
  var pNow;
  function __run442() {
    props.innerHTML = "<p>Properties</p>" + table(ROWS, " m2-ed-pnode") + table(EROWS, " m2-ed-pedge") + table(RROWS, " m2-ed-prx") + '<table class="m2-ed-ptab m2-ed-pcard" hidden></table><table class="m2-ed-ptab m2-ed-prefs" hidden><tbody class="m2-ed-prefh"></tbody><tbody><tr class="m2-ed-padd" hidden><td colspan="2"><span class="m2-ed-ppic"><select class="m2-ed-pdb" aria-label="Database of the IDs typed"></select><input type="text" class="m2-ed-pin" aria-label="IDs or links to add" placeholder="IDs or links" spellcheck="false" autocomplete="off"><button type="button" class="m2-ed-pgo">Add</button></span></td></tr><tr class="m2-ed-psay" hidden><td colspan="2"></td></tr></tbody><tbody class="m2-ed-prefl"></tbody><tbody class="m2-ed-pfold"></tbody></table><button type="button" class="m2-ed-pdef" title="The next ones of this kind made from the palette take these">Set as default</button><button type="button" class="m2-ed-pall" title="Every glyph of this kind on the map (every process, or every logic gate) takes this one\u2019s size and antenna">Apply to all of this kind</button><button type="button" class="m2-ed-pstd" title="The standard size and antenna of processes and logic gates, at the map\u2019s scale (Style, Standard sizes)">Standard size</button>';
    pal.insertAdjacentElement("afterend", props);
    props.insertAdjacentElement("afterend", pmap);
    inW = props.querySelector("#m2-ed-w"), inH = props.querySelector("#m2-ed-h");
    field = function(k) {
      return props.querySelector("#m2-ed-" + k);
    }, pNow = {};
  }
  function propNode() {
    var f = propFmt();
    return !f || shared.selN.length !== 1 || shared.selP.length || shared.selE.length || shared.svSel ? -1 : f.node(shared.selN[0]);
  }
  function propNodes() {
    var f = propFmt();
    if (!f || !shared.selN.length || shared.selP.length || shared.selE.length || shared.svSel) return [];
    var a = shared.selN.map(function(i) {
      return f.node(i);
    });
    return shared.selN.length === 1 ? a[0] >= 0 ? a : [] : a.filter(function(i) {
      return i >= 0;
    });
  }
  function hasMulti(c) {
    return sbJs.MULTI.test(c);
  }
  function lookKey(cls, unit) {
    return cls === "biological activity" ? cls + ":" + (unit || "") : cls;
  }
  function propsShow(all) {
    propsShow0(all);
    refsShow();
  }
  function propsShow0(all) {
    var i = propNode(), k = propEdge(), r2 = function(v) {
      return String(Math.round(v * 100) / 100);
    }, ns = propNodes();
    props.querySelector(".m2-ed-prx").hidden = true;
    pcard.hidden = true;
    if (ns.length > 1 || ns.length && shared.selN.length > 1) return propsMany(ns, all, r2);
    var rx2 = propRx();
    if (rx2 && !propFmt().rx.withNode) {
      props.hidden = false;
      [".m2-ed-pnode", ".m2-ed-pedge", ".m2-ed-pdef", ".m2-ed-pall", ".m2-ed-pstd"].forEach(function(c) {
        props.querySelector(c).hidden = true;
      });
      props.querySelector(".m2-ed-prx").hidden = false;
      var fr = field("rev");
      if (all || document.activeElement !== fr) fr.checked = rx2.on;
      rxCounts(rx2, all);
      var rk = lineOfRx();
      if (rk >= 0) {
        props.querySelector(".m2-ed-pedge").hidden = false;
        edgeShow(rk, all, r2, true);
      }
      return;
    }
    Array.prototype.forEach.call(props.querySelectorAll(".m2-mixed"), function(tr) {
      tr.classList.remove("m2-mixed");
    });
    props.querySelector("#m2-ed-multimer").indeterminate = false;
    ROWS.forEach(function(r) {
      if (r[2] !== "check") field(r[0]).placeholder = r[0] === "fill" ? "none" : "";
    });
    props.hidden = i < 0 && k < 0;
    if (props.hidden) return;
    props.querySelector(".m2-ed-pnode").hidden = i < 0;
    props.querySelector(".m2-ed-pedge").hidden = i >= 0;
    if (i < 0) {
      edgeShow(k, all, r2);
      return;
    }
    var pf = propFmt(), b = bx(i);
    pNow = pf.look(i);
    if (!pNow) {
      props.hidden = true;
      return;
    }
    Array.prototype.forEach.call(props.querySelectorAll(".m2-ed-pnode tr[data-k]"), function(tr) {
      tr.hidden = /^[wh]$/.test(tr.dataset.k) && !sizable(i) || pf.off(tr.dataset.k, i);
    });
    props.querySelector(".m2-ed-pdef").hidden = !pf.def || pf.off("def", i);
    props.querySelector(".m2-ed-pall").hidden = props.querySelector(".m2-ed-pstd").hidden = !pf.hub || !pf.hub(i);
    if (rx2) {
      props.querySelector(".m2-ed-prx").hidden = false;
      var fr2 = field("rev");
      if (all || document.activeElement !== fr2) fr2.checked = rx2.on;
      rxCounts(rx2, all);
    }
    pNow.w = r2(b[2]);
    pNow.h = r2(b[3]);
    ROWS.forEach(function(r) {
      if (r[2] === "num" && pNow[r[0]] != null) pNow[r[0]] = r2(pNow[r[0]]);
    });
    ROWS.forEach(function(r) {
      var f = field(r[0]);
      if (r[2] === "pic") {
        picShow(f, pNow[r[0]]);
        return;
      }
      if (!all && document.activeElement === f) return;
      if (r[2] === "check") {
        f.checked = pNow[r[0]];
        return;
      }
      if (f.value !== pNow[r[0]]) f.value = pNow[r[0]];
      var pk = f.previousElementSibling;
      if (r[2] === "colour" && document.activeElement !== pk && pk.value !== (pNow[r[0]] || "#ffffff")) pk.value = pNow[r[0]] || "#ffffff";
    });
  }
  var mLook;
  function __run47() {
    mLook = [null, null, null];
  }
  function propsMany(ns, all, r2) {
    var pf = propFmt(), key = ns.join(","), now = shared.F.beside() || shared.text;
    if (mLook[0] !== key || mLook[2] !== now) mLook = [key, ns.map(function(i) {
      var L = pf.look(i), b = bx(i);
      if (L) {
        L.w = r2(b[2]);
        L.h = r2(b[3]);
        ROWS.forEach(function(r) {
          if (r[2] === "num" && L[r[0]] != null) L[r[0]] = r2(L[r[0]]);
        });
      }
      return L;
    }), now];
    var Ls = mLook[1];
    if (Ls.some(function(L) {
      return !L;
    })) {
      props.hidden = true;
      return;
    }
    props.hidden = false;
    props.querySelector(".m2-ed-pnode").hidden = false;
    props.querySelector(".m2-ed-pedge").hidden = true;
    props.querySelector(".m2-ed-pdef").hidden = props.querySelector(".m2-ed-pall").hidden = true;
    props.querySelector(".m2-ed-pstd").hidden = !pf.hub || !ns.every(pf.hub);
    ROWS.forEach(function(r) {
      var tr = props.querySelector('.m2-ed-pnode tr[data-k="' + r[0] + '"]'), f = field(r[0]);
      tr.hidden = r[0] === "label" || ns.some(function(i, j) {
        pNow = Ls[j];
        return /^[wh]$/.test(r[0]) && (!sizable(i) || holds(i)) || pf.off(r[0], i);
      });
      if (r[2] === "pic") {
        if (tr.hidden) return;
        var ps = Ls.map(function(L) {
          return L.pic ? L.pic.name : "";
        }), same2 = ps.every(function(p) {
          return p === ps[0];
        });
        tr.classList.toggle("m2-mixed", !same2);
        picShow(f, same2 ? Ls[0].pic : null);
        if (!same2) {
          f.parentNode.querySelector(".m2-ed-ppicname").textContent = "mixed";
          f.parentNode.querySelector(".m2-ed-ppicoff").hidden = false;
        }
        return;
      }
      if (tr.hidden || !all && document.activeElement === f) return;
      var vs = Ls.map(function(L) {
        return r[2] === "check" ? !!L[r[0]] : String(L[r[0]] == null ? "" : L[r[0]]);
      }), one = vs.every(function(v2) {
        return v2 === vs[0];
      });
      tr.classList.toggle("m2-mixed", !one);
      if (r[2] === "check") {
        f.indeterminate = !one;
        f.checked = one && vs[0];
        return;
      }
      var v = one ? vs[0] : "";
      if (f.value !== v) f.value = v;
      f.placeholder = one && r[0] === "fill" ? "none" : "";
      var pk = f.previousElementSibling;
      if (r[2] === "colour" && one && document.activeElement !== pk) pk.value = v || "#ffffff";
    });
  }
  function __run48() {
    [inW, inH].forEach(function(inp, k) {
      inp.addEventListener("change", function() {
        var ns = propNodes(), v = parseFloat(inp.value);
        if (!ns.length || !ns.every(sizable)) return;
        if (!isFinite(v)) {
          propsShow(true);
          return;
        }
        v = Math.min(Math.max(v, 1), 5e3);
        var pairs = ns.map(function(i) {
          var b = boxOf(i), w = nodes2[i].comp ? Math.max(v, 30) : v, nb = b.slice();
          nb[2 + k] = w;
          nb[k] = b[k] + b[2 + k] / 2 - w / 2;
          if (holds(i) && !nodes2[i].comp) nb = roomy(i, nb, k ? "tb" : "lr", b);
          return [i, nb];
        }).filter(function(q) {
          return Math.abs(q[1][2 + k] - boxOf(q[0])[2 + k]) >= 5e-3;
        });
        if (!pairs.length) {
          propsShow(true);
          return;
        }
        if (pairs.length === 1 && holds(pairs[0][0])) {
          var h = pairs[0];
          keepSel(function() {
            holderSize(h[0], h[1].map(function(x) {
              return +fmt(x);
            }), boxOf(h[0]));
          });
          return;
        }
        keepSel(function() {
          setSizes(pairs);
        });
      });
    });
  }
  function hex(v) {
    v = v.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, "$&$&");
    return /^[0-9a-f]{6}$/i.test(v) ? "#" + v.toUpperCase() : v ? null : "";
  }
  function propSet(k) {
    var ns = propNodes();
    if (!ns.length) return;
    var f = field(k), v = k === "multimer" ? f.checked : f.value;
    if (ns.length > 1 && k !== "multimer" && v === "" && f.closest("tr").classList.contains("m2-mixed")) {
      propsShow(true);
      return;
    }
    if (!keepSel(function() {
      return propFmt().set(k, v, ns);
    })) propsShow(true);
  }
  function keepSel(f) {
    var ids = shared.selN.map(function(i) {
      return nodes2[i].id;
    }), r = f();
    if (shared.selN.length !== ids.length) {
      shared.selN = [];
      nodes2.forEach(function(n, k) {
        if (ids.indexOf(n.id) >= 0) shared.selN.push(k);
      });
      paint();
    }
    return r;
  }
  var eFor;
  function __run50() {
    eFor = null;
  }
  function propRx() {
    var f = propFmt();
    return f && f.rx ? f.rx.of() : null;
  }
  var pcard;
  var pcardKey;
  function __run51() {
    pcard = props.querySelector(".m2-ed-pcard"), pcardKey = null;
  }
  function rxCounts(rx2, all) {
    var c = rx2 && propFmt().rx.counts ? propFmt().rx.counts(rx2.rid) : [];
    pcard.hidden = !c.length;
    if (!c.length) return;
    var key = rx2.rid + "\0" + c.map(function(p) {
      return p.line + "" + p.name;
    }).join("\0");
    if (key !== pcardKey) {
      pcardKey = key;
      pcard.innerHTML = '<tr><th colspan="2">Cardinality</th></tr>' + c.map(function(p) {
        return '<tr><th><label for="m2-ed-pc-' + escAttr(p.line) + '">' + escHtml(p.name) + '</label></th><td><input type="text" inputmode="decimal" class="m2-ed-card" id="m2-ed-pc-' + escAttr(p.line) + '" data-line="' + escAttr(p.line) + '" placeholder="1" spellcheck="false" autocomplete="off"></td></tr>';
      }).join("");
    }
    c.forEach(function(p) {
      var f = pcard.querySelector('[data-line="' + p.line.replace(/"/g, '\\"') + '"]');
      if (f && (all || document.activeElement !== f) && f.value !== p.value) f.value = p.value;
    });
  }
  var prefs;
  var prefsKey;
  var prefsSay;
  var prefsRid;
  var prefsFor;
  var prefsNew;
  var REF_DB;
  var ID_DBS;
  var ANN_DB;
  var prefsOpen;
  function __run622() {
    prefs = props.querySelector(".m2-ed-prefs");
    prefsKey = null;
    prefsSay = null;
    prefsRid = null;
    prefsFor = null;
    prefsOpen = false;
    prefsNew = null;
    REF_DB = { pubmed: "PubMed", doi: "DOI", uniprot: "UniProt", hgnc: "HGNC", "hgnc.symbol": "HGNC symbol", chebi: "ChEBI", go: "GO", mesh: "MeSH", ncbigene: "NCBI Gene", "entrez.gene": "NCBI Gene", ensembl: "Ensembl", refseq: "RefSeq", "pubchem.compound": "PubChem", hmdb: "HMDB", kegg: "KEGG", "kegg.compound": "KEGG", reactome: "Reactome", ec: "EC", "ec-code": "EC", taxonomy: "Taxonomy" };
    ID_DBS = { protein: ["hgnc.symbol", "uniprot"], gene: ["hgnc.symbol"], molecule: ["chebi"], phenotype: ["go", "mesh"], compartment: ["go", "mesh"] };
    ANN_DB = {
      pubmed: { ok: /^\d{1,9}$/, say: "a PubMed ID is digits, as 19461003" },
      doi: { ok: /^\d{2}\.\d{4}\S*\/\S+$/, say: "a DOI starts 10., as 10.1038/nature08124" },
      uniprot: { ok: /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/, plain: /^[A-Z][0-9][A-Z0-9]{3}[0-9](?:[A-Z0-9]{4})?(?:-\d+)?$/i, say: "UniProt is six or ten letters and digits, as Q15831" },
      hgnc: { ok: /^\d{1,6}$/, plain: /^\d+$/, say: "HGNC is digits, as 11389 or HGNC:11389" },
      "hgnc.symbol": { ok: /^[A-Za-z0-9][A-Za-z0-9_-]*@?$/, plain: /^[A-Za-z][A-Za-z0-9_-]*$/, say: "an HGNC symbol is letters and digits, as PDPK1 (the symbol, not the HGNC number)" },
      chebi: { ok: /^CHEBI:\d+$/, plain: /^\d+$/, say: "ChEBI is digits, as 15346 or CHEBI:15346" },
      go: { ok: /^GO:\d{7}$/, plain: /^\d{7}$/, say: "GO is seven digits, as GO:0016573" },
      mesh: { ok: /^[CD]\d{6,9}$/, plain: /^[CD]\d{6,9}$/i, say: "MeSH is D or C and digits, as D012345" }
    };
    var pin = prefs.querySelector(".m2-ed-pin");
    var enterAt = 0, pressAt = 0;
    [".m2-ed-prefh", ".m2-ed-prefl", ".m2-ed-pfold"].forEach(function(q) {
      prefs.querySelector(q).addEventListener("pointerdown", function() {
        pressAt = Date.now();
      }, true);
    });
    pin.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        pin.value = "";
        refsClose();
      } else if (e.key === "Enter" && !e.isComposing) {
        enterAt = Date.now();
        e.preventDefault();
        e.stopPropagation();
        var R = annNow();
        if (R && R.at === prefsFor) refsAdd();
      }
    });
    pin.addEventListener("paste", function(e) {
      var t = e.clipboardData && e.clipboardData.getData("text");
      if (t == null || !/[\r\n]/.test(t)) return;
      e.preventDefault();
      var a = pin.selectionStart, b = pin.selectionEnd, v = t.replace(/\s*[\r\n]+\s*/g, " ").trim();
      pin.value = pin.value.slice(0, a) + v + pin.value.slice(b);
      pin.selectionStart = pin.selectionEnd = a + v.length;
    });
    pin.addEventListener("focus", function() {
      var R = annNow();
      prefsFor = R ? R.at : null;
    });
    var pdb = prefs.querySelector(".m2-ed-pdb");
    pin.addEventListener("change", function() {
      var R = annNow(), at2 = R && R.at;
      if (Date.now() - enterAt < 200) return;
      setTimeout(function() {
        var R2 = annNow();
        if (document.activeElement !== pdb && Date.now() - pressAt > 500 && R2 && R2.at === at2 && at2 === prefsFor) refsAdd();
      }, 0);
    });
    prefs.querySelector(".m2-ed-padd").addEventListener("focusout", function() {
      setTimeout(function() {
        var row = prefs.querySelector(".m2-ed-padd");
        if (!row.contains(document.activeElement) && !pin.value.trim()) refsClose();
      }, 0);
    });
    pdb.addEventListener("focus", function() {
      var R = annNow();
      prefsFor = R ? R.at : null;
    });
    pdb.addEventListener("change", function() {
      pin.focus();
    });
    prefs.querySelector(".m2-ed-pgo").addEventListener("click", refsAdd);
    prefs.addEventListener("click", function(e) {
      if (e.target.closest && e.target.closest(".m2-ed-pplus")) {
        refsOpen();
        return;
      }
      if (e.target.closest && e.target.closest(".m2-ed-pmore")) {
        prefsOpen = !prefsOpen;
        prefsKey = null;
        refsShow();
        return;
      }
      var x = e.target.closest && e.target.closest(".m2-ed-px"), R = annNow();
      if (!x || !R) return;
      prefsSay = null;
      if (!R.api.set(R.id, [], [x.dataset.key])) {
        prefsKey = null;
        refsShow();
      }
    });
  }
  function refsOpen() {
    var R = annNow(), row = prefs.querySelector(".m2-ed-padd"), pdb = prefs.querySelector(".m2-ed-pdb"), pin = prefs.querySelector(".m2-ed-pin");
    if (!R) return;
    var has = R.items.filter(function(x) {
      return x.own;
    }).map(function(x) {
      return x.db;
    });
    pdb.value = R.kind && R.dbs.filter(function(d) {
      return has.indexOf(d) < 0;
    })[0] || R.dbs[0];
    row.hidden = false;
    prefsFor = R.at;
    pin.focus();
  }
  function refsClose() {
    var row = prefs.querySelector(".m2-ed-padd");
    if (row.contains(document.activeElement)) V.view.focus({ preventScroll: true });
    row.hidden = true;
  }
  function annNow() {
    var pf = propFmt(), R = pf && pf.refs ? pf.refs.of() : null, api2 = R && pf.refs, dbs = ["pubmed", "doi"];
    if (!R && pf && pf.ids) {
      R = pf.ids.of();
      api2 = pf.ids;
      dbs = R && ID_DBS[R.kind];
    }
    if (!R || !dbs) return null;
    R.api = api2;
    R.dbs = dbs;
    R.at = (R.kind || "refs") + "\0" + R.id;
    if (R.kind) R.items.forEach(function(x) {
      x.own = idOwn(x.q, x.db ? x.key : "");
    });
    return R;
  }
  function idOwn(q, key) {
    return (q === "bqbiol:is" || q === "bqbiol:hasVersion") && /^[\w.]+:\S+$/.test(key || "") && !/^https?:/i.test(key);
  }
  function signPlus() {
    return '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  function signX() {
    return '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  function annItem(r) {
    var c = r.key ? r.key.indexOf(":") : -1;
    return { key: r.key || r.link, db: c > 0 ? r.key.slice(0, c) : "", val: c > 0 ? r.key.slice(c + 1) : r.link, q: r.q, about: /^bqmodel:/.test(r.q) };
  }
  function refsParse(text, dbs, pick) {
    dbs = dbs || ["pubmed", "doi"];
    var out = { keys: [], bad: [], fits: [] }, t = String(text).replace(/\b(PMID|pubmed|doi|uniprot|HGNC|CHEBI|GO|mesh)(?!\.)\s*:?\s+(?=\d|[A-Z]\d)/gi, "$1:");
    t.split(/\s+|,(?=\s|\d|$)|;(?=\s|$)/).forEach(function(x) {
      x = x.replace(/^[(\[<"']+|[)\]>"'.,]+$/g, "");
      if (!x) return;
      var m, db2 = null, v = null, dec = function(s) {
        try {
          return decodeURIComponent(s);
        } catch (e) {
          return s;
        }
      };
      if (m = /^(?:https?:\/\/)?(?:www\.)?(?:pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pubmed)\/(\d+)\/?(?:[?#].*)?$/i.exec(x)) {
        db2 = "pubmed";
        v = m[1];
      } else if (m = /^(?:https?:\/\/)?(?:dx\.)?doi\.org\/(.+)$/i.exec(x)) {
        db2 = "doi";
        v = dec(m[1]);
      } else if (m = /^(?:https?:\/\/)?(?:www\.|rest\.)?uniprot\.org\/(?:uniprot|uniprotkb)\/([A-Za-z0-9-]+)(?:[\/.?#].*)?$/i.exec(x)) {
        db2 = "uniprot";
        v = m[1];
      } else if (m = /^(?:https?:\/\/)?(?:www\.)?genenames\.org\/.*?(?:HGNC(?::|%3A)|hgnc_id\/)(\d+)/i.exec(x)) {
        db2 = "hgnc";
        v = m[1];
      } else if (m = /^(?:https?:\/\/)?(?:www\.)?genenames\.org\/.*?\/symbol\/([A-Za-z0-9_-]+)/i.exec(x)) {
        db2 = "hgnc.symbol";
        v = m[1];
      } else if (m = /^(?:https?:\/\/)?(?:www\.)?ebi\.ac\.uk\/chebi\/.*?CHEBI(?::|%3A)(\d+)/i.exec(x)) {
        db2 = "chebi";
        v = m[1];
      } else if (m = /^(?:https?:\/\/)?(?:amigo\.geneontology\.org|(?:www\.)?ebi\.ac\.uk\/QuickGO)\/.*?GO(?::|%3A)(\d{7})/i.exec(x)) {
        db2 = "go";
        v = m[1];
      } else if (m = /^(?:https?:\/\/)?(?:meshb\.nlm\.nih\.gov|(?:www\.)?ncbi\.nlm\.nih\.gov\/mesh)\/.*?\b([CD]\d{6,9})\b/i.exec(x)) {
        db2 = "mesh";
        v = m[1];
      } else if ((m = /^(?:https?:\/\/)?identifiers\.org\/(?:([\w.]+)[:\/])?(.+)$/i.exec(x)) || (m = /^urn:miriam:([\w.]+):(.+)$/i.exec(x))) {
        db2 = (m[1] || "").toLowerCase().replace(/^obo\./, "");
        v = dec(m[2]);
        var p = /^(CHEBI|GO|HGNC):(.+)$/i.exec(v);
        if (p && (!db2 || db2 === p[1].toLowerCase())) {
          db2 = p[1].toLowerCase();
          v = p[2];
        }
      } else if (m = /^(pmid|pubmed|doi|uniprot|hgnc\.symbol|hgnc|chebi|go|mesh):(.+)$/i.exec(x)) {
        db2 = m[1].toLowerCase().replace("pmid", "pubmed");
        v = m[2];
      } else if (/^10\./.test(x)) {
        db2 = "doi";
        v = x;
      } else {
        var fit = function(d) {
          var D2 = ANN_DB[d];
          return d === "pubmed" ? /^\d+$/.test(x) : !!(D2.plain && D2.plain.test(x));
        };
        if (pick && dbs.indexOf(pick) >= 0) {
          if (pick === "hgnc.symbol" && dbs.indexOf("uniprot") >= 0 && ANN_DB.uniprot.ok.test(x.toUpperCase())) out.fits.push([x, "uniprot"]);
          else if (fit(pick)) {
            db2 = pick;
            v = x;
          } else dbs.some(function(d) {
            if (d !== pick && fit(d)) {
              out.fits.push([x, d]);
              return true;
            }
            return false;
          });
        } else dbs.some(function(d) {
          if (fit(d)) {
            db2 = d;
            v = x;
            return true;
          }
          return false;
        });
      }
      if (db2 === "chebi" || db2 === "go") v = db2.toUpperCase() + ":" + String(v).replace(/^(chebi|go):/i, "");
      else if (db2 === "uniprot" || db2 === "mesh") v = String(v).toUpperCase();
      else if (db2 === "hgnc") v = String(v).replace(/^hgnc:/i, "");
      var D = db2 && dbs.indexOf(db2) >= 0 && ANN_DB[db2], key = D && D.ok.test(v) ? db2 + ":" + v : null;
      if (!key) out.bad.push(x);
      else if (out.keys.indexOf(key) < 0) out.keys.push(key);
    });
    return out;
  }
  function refsAdd() {
    var pin = prefs.querySelector(".m2-ed-pin"), v = pin.value.trim(), R = annNow();
    if (!v || !R) return;
    var pick = prefs.querySelector(".m2-ed-pdb").value, P = refsParse(v, R.dbs, pick), had = R.items.map(function(x) {
      return x.key;
    }), add = P.keys.filter(function(k) {
      return had.indexOf(k) < 0;
    }), said = [];
    if (add.length) said.push(add.length + " added");
    if (P.keys.length > add.length) said.push(P.keys.length - add.length + " already there");
    if (P.bad.length) said.push("not read: " + P.bad.join(" ") + " (" + (ANN_DB[pick] ? ANN_DB[pick].say : R.dbs.map(function(d) {
      return ANN_DB[d].say;
    }).join("; ")) + ")" + P.fits.map(function(f) {
      return "; " + f[0] + " reads as " + REF_DB[f[1]] + ": choose " + REF_DB[f[1]] + " in the list" + (f[1] === "uniprot" && pick === "hgnc.symbol" ? " (a symbol of that shape: hgnc.symbol:" + f[0] + ")" : "");
    }).join(""));
    pin.value = P.bad.join(" ");
    if (!P.bad.length) refsClose();
    prefsSay = [R.at, said.join("; ") + "."];
    if (add.length) {
      prefsOpen = true;
      var mark2 = prefsNew = [R.at, add];
      setTimeout(function() {
        if (prefsNew !== mark2) return;
        prefsNew = null;
        prefs.querySelectorAll(".m2-ed-pnew").forEach(function(r) {
          r.classList.add("m2-ed-pfade");
        });
      }, 1200);
    }
    var sym = add.filter(function(k) {
      return k.indexOf("hgnc.symbol:") === 0;
    }), ni = nodes2.findIndex(function(n) {
      return n.id === R.id;
    });
    var nm = R.kind === "protein" && sym.length === 1 && ni >= 0 && !nameNow(ni) ? sym[0].slice(12) : null;
    if (add.length && !R.api.set(R.id, add, [], nm)) prefsSay = [R.at, "Not written: the file did not take them."];
    prefsKey = null;
    refsShow();
  }
  function refsShow() {
    var R = !props.hidden && propNodes().length <= 1 ? annNow() : null;
    prefs.hidden = !R;
    if (!R) {
      prefsKey = null;
      return;
    }
    var pin = prefs.querySelector(".m2-ed-pin");
    if (R.at !== prefsRid) {
      pin.value = "";
      prefsRid = R.at;
      refsClose();
      var pdb = prefs.querySelector(".m2-ed-pdb");
      pdb.innerHTML = R.dbs.map(function(d) {
        return '<option value="' + d + '">' + escHtml(REF_DB[d]) + "</option>";
      }).join("");
      pdb.value = R.dbs[0];
      pdb.disabled = R.dbs.length < 2;
      pin.placeholder = "IDs or links";
      pin.setAttribute("aria-label", "IDs or links to add");
    }
    if (prefsSay && prefsSay[0] !== R.at) prefsSay = null;
    var key = prefsOpen + "\0" + R.at + "\0" + R.title + "\0" + R.items.map(function(x) {
      return x.key + "" + x.q + (x.own ? "" : "!");
    }).join("\0") + "\0" + (prefsSay ? prefsSay[1] : "");
    if (key === prefsKey) return;
    prefsKey = key;
    var order = R.dbs.concat(R.items.map(function(x) {
      return x.db;
    })), rows = R.items.map(function(x, j) {
      return [x, j];
    }).sort(function(a, b) {
      return order.indexOf(a[0].db) - order.indexOf(b[0].db) || a[1] - b[1];
    }).map(function(r) {
      return r[0];
    });
    prefs.querySelector(".m2-ed-pfold").innerHTML = rows.length < 2 ? "" : '<tr><td colspan="2"><button type="button" class="m2-ed-pmore" aria-expanded="' + prefsOpen + '">' + (prefsOpen ? "Show fewer" : "Show all " + rows.length) + "</button></td></tr>";
    prefs.querySelector(".m2-ed-prefh").innerHTML = '<tr><th colspan="2">' + escHtml(R.title) + '<button type="button" class="m2-ed-pplus" title="Add ' + (R.kind ? "identifiers" : "references") + '" aria-label="Add ' + (R.kind ? "identifiers" : "references") + '">' + signPlus() + "</button></th></tr>";
    prefs.querySelector(".m2-ed-prefl").innerHTML = rows.map(function(x, j) {
      if (!prefsOpen && j > 0) return "";
      var name2 = REF_DB[x.db] || x.db || "Link", tip = name2 + " " + x.val + (x.own ? "" : ", " + x.q + (x.about ? ": about the map as a model, kept as written" : ", kept as written"));
      return '<tr title="' + escAttr(tip) + '"' + (prefsNew && prefsNew[0] === R.at && prefsNew[1].indexOf(x.key) >= 0 ? ' class="m2-ed-pnew"' : "") + "><th>" + escHtml(name2) + '</th><td><span class="m2-ed-ppic"><span class="m2-ed-ppicname">' + escHtml(x.val) + (x.about ? ' <span class="m2-ed-pabout">about the map</span>' : "") + "</span>" + (x.own ? '<button type="button" class="m2-ed-px" data-key="' + escAttr(x.key) + '" title="Remove ' + escAttr(name2 + " " + x.val) + '" aria-label="Remove">' + signX() + "</button>" : "") + "</span></td></tr>";
    }).join("");
    var fresh = prefsNew && prefs.querySelector(".m2-ed-pnew");
    if (fresh) fresh.scrollIntoView({ block: "nearest" });
    var say = prefs.querySelector(".m2-ed-psay");
    say.hidden = !prefsSay;
    say.firstChild.textContent = prefsSay ? prefsSay[1] : "";
  }
  function escHtml(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(v) {
    return escHtml(v).replace(/"/g, "&quot;");
  }
  function cardOf(f) {
    var v = f.value.trim(), n = parseFloat(v);
    return v === "" ? "" : n > 0 && n <= 1e3 ? String(Math.round(n * 100) / 100) : null;
  }
  function __run522() {
    pcard.addEventListener("change", function(e) {
      var f = e.target, r = propRx(), pf = propFmt(), v = f.dataset && f.dataset.line ? cardOf(f) : null;
      if (!r || !pf.rx.setCount || v === null || !pf.rx.setCount(r.rid, f.dataset.line, v)) propsShow(true);
    });
    field("rev").addEventListener("change", function(e) {
      e.target.blur();
      var r = propRx();
      if (!r || !propFmt().rx.set(r.rid, e.target.checked)) propsShow(true);
    });
  }
  function propEdge() {
    var f = propFmt(), k = shared.selE[0];
    return f && f.line && shared.selE.length === 1 && !shared.selN.length && !shared.selP.length && !shared.svSel && edges2[k] && edges2[k].path && f.line.colour(k) != null ? k : -1;
  }
  function lineOfRx() {
    var r = propRx(), f = propFmt();
    if (!r || !f.line) return -1;
    var k = edges2.findIndex(function(q) {
      return q.id.indexOf(r.rid + "|") === 0 && !/\|[mrp]\d+$/.test(q.id);
    });
    return k >= 0 && f.line.colour(k) != null ? k : -1;
  }
  function atHub(k, end) {
    var e = edges2[k];
    return (end ? e.t : e.s) == null || hubEnd(k, end) != null;
  }
  function edgeShow(k, all, r2, rxLine) {
    props.querySelector(".m2-ed-pdef").hidden = props.querySelector(".m2-ed-pall").hidden = props.querySelector(".m2-ed-pstd").hidden = true;
    var e = edges2[k], pl = propFmt().line, card = !rxLine && pl.count ? pl.count(k) : void 0;
    var now = { ecol: (pl.colour(k) || "#000000").slice(0, 7).toLowerCase(), ewid: r2(pl.width(k)), card: card || "" };
    ["sx", "sy", "tx", "ty"].forEach(function(a) {
      now[a] = r2(num(e.path, a) || 0);
    });
    EROWS.forEach(function(r) {
      var f = field(r[0]);
      var port = /^[st][xy]$/.test(r[0]);
      f.closest("tr").hidden = port && !pl.ports || r[0] === "card" && card === void 0;
      if (port) {
        f.disabled = atHub(k, r[0].charAt(0) === "t");
        f.closest("tr").title = f.disabled && hubEnd(k, r[0].charAt(0) === "t") ? "Fixed on the antenna: it moves with the process or gate (drag it, or Turn in its right-click menu)." : "";
      }
      if (!all && document.activeElement === f) return;
      if (f.value !== now[r[0]]) f.value = now[r[0]];
      var pk = f.previousElementSibling;
      if (r[2] === "colour" && document.activeElement !== pk && pk.value !== now.ecol) pk.value = now.ecol;
    });
  }
  function edgeSet(key) {
    var f = field(key), k = edges2.findIndex(function(q) {
      return q.id === eFor;
    }), pf = propFmt();
    if (k < 0 || !pf || !pf.line) return;
    var e = edges2[k];
    if (key === "ecol") {
      var c = hex(f.value);
      if (c === null) {
        propsShow(true);
        return;
      }
      if (!pf.line.set(k, c === "" || c === "#000000" ? null : c)) propsShow(true);
      return;
    }
    if (key === "card") {
      var v = cardOf(f);
      if (v === null || !pf.line.setCount || !pf.line.setCount(k, v)) propsShow(true);
      return;
    }
    if (key === "ewid") {
      var w = parseFloat(f.value);
      if (!isFinite(w) || !pf.line.setWidth(k, Math.round(Math.min(Math.max(w, 0.25), 20) * 100) / 100)) propsShow(true);
      return;
    }
    var end = key.charAt(0) === "t", v = parseFloat(f.value), a = end ? ["tx", "ty"] : ["sx", "sy"];
    if (atHub(k, end) || !(Math.abs(v) <= 5e3)) {
      propsShow(true);
      return;
    }
    var to = a.map(function(q) {
      return q === key ? v : num(e.path, q) || 0;
    });
    setPort({ k, end, n: end ? e.t : e.s, to });
  }
  function __run542() {
    EROWS.forEach(function(r) {
      var f = field(r[0]);
      [f, f.previousElementSibling].filter(Boolean).forEach(function(x) {
        x.addEventListener("focus", function() {
          var k = propEdge();
          if (k < 0) k = lineOfRx();
          eFor = k < 0 ? null : edges2[k].id;
        });
      });
      f.addEventListener("change", function() {
        edgeSet(r[0]);
      });
      if (r[2] === "colour") f.previousElementSibling.addEventListener("change", function(e) {
        f.value = e.target.value;
        edgeSet(r[0]);
      });
    });
  }
  function propListen(r) {
    if (/^[wh]$/.test(r[0]) || r[2] === "pic") return;
    var f = field(r[0]);
    f.addEventListener("change", function() {
      propSet(r[0]);
    });
    if (r[2] === "colour") f.previousElementSibling.addEventListener("change", function(e) {
      f.value = e.target.value;
      propSet(r[0]);
    });
  }
  var EXTRA;
  function __run552() {
    ROWS.forEach(propListen);
    EXTRA = [];
  }
  function propRows(rows) {
    var last = EXTRA.length ? EXTRA[EXTRA.length - 1] : "width", at2 = props.querySelector('.m2-ed-pnode tr[data-k="' + last + '"]'), tmp = document.createElement("div");
    tmp.innerHTML = table(rows, "");
    Array.prototype.slice.call(tmp.querySelectorAll("tr")).reverse().forEach(function(tr) {
      at2.insertAdjacentElement("afterend", tr);
    });
    var k = ROWS.findIndex(function(r) {
      return r[0] === last;
    });
    rows.forEach(function(r, j) {
      ROWS.splice(k + 1 + j, 0, r);
      EXTRA.push(r[0]);
      propListen(r);
    });
  }
  function picShow(f, v) {
    var box3 = f.parentNode, img = box3.querySelector("img"), nm = box3.querySelector(".m2-ed-ppicname"), src2 = v && v.src || "";
    nm.textContent = v ? v.name.replace(/^glyphs\//, "") : "none";
    nm.title = v ? v.name : "";
    if (img.getAttribute("src") !== src2) {
      if (src2) img.setAttribute("src", src2);
      else img.removeAttribute("src");
    }
    img.hidden = !src2;
    box3.querySelector(".m2-ed-ppicoff").hidden = !v;
    f.hidden = !!v;
  }
  var DEF_KEY;
  function __run562() {
    propRows([["way", "Orientation", "select", ["right", "left", "up", "down"]]]);
    propRows([["ant", "Antenna", "num", ' min="1" max="200"', "The stick from a process or logic gate to its port, in px from its side"]]);
    props.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.target.blur();
        e.preventDefault();
      } else if (e.key === "Escape") {
        propsShow(true);
        e.target.blur();
        e.preventDefault();
      }
      e.stopPropagation();
    });
    DEF_KEY = "atlas-edit-defaults";
  }
  function looksKept(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function defsKept() {
    return looksKept(DEF_KEY);
  }
  function defOf(cls) {
    cls = baseKind(cls);
    var kind0 = cls;
    if (ACT_UNIT[cls] != null) cls = "biological activity";
    var D = sbJs.defaults(src(), null, cls, ACT_UNIT[kind0]), kept = defsKept(), k = kept[lookKey(cls, ACT_UNIT[kind0])];
    D.multimer = false;
    var u = cls !== "biological activity" && palKind() === "af" ? sbJs.unitFor(kind0) : null;
    if (u != null) {
      k = kept[lookKey("biological activity", u)];
      var DA = sbJs.defaults(src(), null, "biological activity", u);
      D.fill = DA.fill;
      D.fallback = DA.fallback;
      if (DA.w !== DA.w0 || DA.h !== DA.h0) {
        D.w = DA.w;
        D.h = DA.h;
      }
    }
    if (k && !(k.w > 0)) k = null;
    var st = palStyle(), cm = sbCols();
    if (st === "default") {
      D.w = D.w0;
      D.h = D.h0;
    } else if (st === "custom" && k) {
      if (k.w > 0 && k.h > 0) {
        D.w = k.w;
        D.h = k.h;
      }
      if ("multimer" in k) D.multimer = k.multimer;
      if (k.font > 0) D.font = k.font;
    }
    var kc = cm === "custom" && !!k;
    if (kc) ["fill", "line", "width"].forEach(function(q) {
      if (q in k) D[q] = k[q];
    });
    else if (cm === "default") {
      D.fill = sbJs.fillFor(u != null ? "biological activity" : cls, u != null ? u : ACT_UNIT[kind0]);
      D.line = null;
      D.fallback = true;
    } else if (cm === "none") {
      D.fill = null;
      D.line = null;
      D.fallback = false;
    } else if (cm === "confetti" && cls !== "compartment" && sbJs.fillFor(u != null ? "biological activity" : cls, u != null ? u : ACT_UNIT[kind0])) {
      D.fill = confettiFill(src());
      D.line = null;
      D.fallback = false;
    }
    if (kind0 === "metabolite activity") D.w = D.h;
    return D;
  }
  function __run57() {
    props.querySelector(".m2-ed-pdef").addEventListener("click", function() {
      var i = propNode(), pf = propFmt();
      if (i >= 0 && pf.def) palDid([DEF_KEY, CD_DEF_KEY, CHOICE_KEY], function() {
        pf.def(i);
      });
    });
  }
  function keepLook(key, all) {
    try {
      localStorage.setItem(key, JSON.stringify(all));
      return true;
    } catch (e) {
      warn("The default could not be kept in this browser.");
      return false;
    }
  }
  var HUB_KINDS;
  function __run58() {
    HUB_KINDS = { process: ["process", "omitted process", "uncertain process"], gate: ["and", "or", "not", "equivalence", "delay"] };
  }
  function antNow() {
    var st = palStyle(), kept = defsKept(), A = sbAnts(), out = {};
    Object.keys(HUB_KINDS).forEach(function(g) {
      var k = kept[HUB_KINDS[g][0]];
      if (st === "default") {
        out[g] = sbJs.ANT * stdScale();
        return;
      }
      if (st === "custom" && k && k.ant != null) {
        out[g] = k.ant;
        return;
      }
      var cnt = {}, top = null;
      nodes2.forEach(function(n, i) {
        var L = A[n.id];
        if (L == null || hubGroup(i) !== g) return;
        cnt[L] = (cnt[L] || 0) + 1;
        if (top == null || cnt[L] > cnt[top]) top = L;
      });
      out[g] = top != null ? +top : sbJs.ANT * stdScale();
    });
    return out;
  }
  function stdScale() {
    var D = sbJs.defaults(src(), null, "process");
    return D.w0 / sbJs.SIZE.process[0];
  }
  function stdLetters() {
    return Math.round(sbJs.GATE_FONT * stdScale() * 2) / 2;
  }
  function __start8() {
    __run111();
    __run210();
    __run37();
    __run44();
    __run56();
    __run66();
    __run76();
    __run84();
    __run93();
    __run103();
    __run112();
    __run124();
    __run134();
    __run144();
    __run154();
    __run164();
    __run203();
    __run213();
    __run224();
    __run234();
    __run244();
    __run253();
    __run263();
    __run273();
    __run283();
    __run293();
    __run313();
    __run323();
    __run333();
    __run342();
    __run352();
    __run362();
    __run372();
    __run38();
    __run39();
    __run40();
    __run41();
    __run422();
    __run432();
    __run442();
    __run47();
    __run48();
    __run50();
    __run51();
    __run522();
    __run542();
    __run552();
    __run562();
    __run57();
    __run58();
    __run61();
    __run622();
  }

  // editor/src/live.js
  function liveFmt() {
    return shared.F.live();
  }
  function bx(i) {
    if (shared.poseNow && shared.poseNow[i]) return shared.poseNow[i].box;
    if (shared.liveC && shared.liveC[i]) return shared.liveC[i];
    var b = boxOf(i);
    if (shared.liveG && shared.liveG[i]) return [b[0] + shared.liveG[i][0], b[1] + shared.liveG[i][1], b[2], b[3]];
    return mv && mv.n.has(i) ? [b[0] + mv.dx, b[1] + mv.dy, b[2], b[3]] : b;
  }
  function liveFit(seed) {
    shared.liveC = seed || null;
    var ks = seed ? Object.keys(seed).map(Number).filter(function(i) {
      return !full() || !nodes2[i].comp;
    }) : mv && drag ? tops(mv.n, drag.alone) : [];
    var nb = ks.length ? grown(ks, bx, boxOf, function(k) {
      return !!(mv && mv.n.has(k));
    }, drag && drag.away) : {};
    shared.liveC = Object.assign({}, seed || {}, nb);
    if (!Object.keys(shared.liveC).length) shared.liveC = null;
    liveDraw(seed ? Object.keys(seed).map(Number).filter(function(i) {
      return !holds(i);
    }) : []);
    return Object.keys(nb).some(function(k) {
      return nodes2[+k].comp;
    });
  }
  function undraw(i) {
    if (shared.liveOrig && shared.liveOrig[i]) liveBack(shared.liveOrig[i]);
    if (shared.liveOrig) delete shared.liveOrig[i];
  }
  function picOff() {
    return shared.F.ownFrame ? [x0, y0] : [0, 0];
  }
  function toPic(b) {
    var o = picOff();
    return b.length > 2 ? [b[0] - o[0], b[1] - o[1], b[2], b[3]] : [b[0] - o[0], b[1] - o[1]];
  }
  function liveOff() {
    shared.liveC = null;
    if (shared.liveOrig) Object.keys(shared.liveOrig).forEach(function(i) {
      undraw(+i);
    });
    shared.liveOrig = null;
  }
  function shift() {
    if (!gN || !mv) return false;
    if (!mv.dx && !mv.dy) {
      unshift();
      return true;
    }
    poseBack();
    var tr = "translate(" + mv.dx + " " + mv.dy + ")";
    mv.n.forEach(function(i) {
      var g = gN[nodes2[i].id];
      if (g) g.setAttribute("transform", tr);
    });
    shared.live = shared.live || /* @__PURE__ */ new Set();
    posed();
    edges2.forEach(function(e, k) {
      var a = mv.n.has(e.s), b = mv.n.has(e.t), some = e.pts.some(function(p) {
        return mv.p.has(p);
      });
      var gs = gE[e.id];
      if (!gs || !(a || b || some)) return;
      if (a && b) gs.forEach(function(g) {
        g.setAttribute("transform", tr);
      });
      else {
        gs.forEach(function(g) {
          g.style.display = "none";
        });
        shared.live.add(k);
      }
    });
    liveFmt().glyphs(mv.n, mv.p, null);
    return true;
  }
  function unshift() {
    if (gN) Object.keys(gN).forEach(function(k) {
      gN[k].removeAttribute("transform");
    });
    if (gE) Object.keys(gE).forEach(function(k) {
      gE[k].forEach(function(g) {
        g.removeAttribute("transform");
        g.style.display = "";
      });
    });
    poseBack();
    shared.live = null;
    shared.liveG = null;
    liveOff();
    dropCopies();
    shared.frozen = false;
  }
  var livePose;
  function __run211() {
    livePose = [];
  }
  function posed(sets, rs) {
    var out = {};
    livePose.forEach(function(f) {
      f(sets || mv, !!(drag && drag.alone), out, rs || null);
    });
    if (!Object.keys(out).length) return;
    shared.poseNow = out;
    shared.poseText = /* @__PURE__ */ new Map();
    var o = picOff();
    Object.keys(out).forEach(function(k) {
      var i = +k, p = out[k], b = boxOf(i), g = gN[nodes2[i].id];
      if (!g) return;
      var c0 = [b[0] + b[2] / 2 - o[0], b[1] + b[3] / 2 - o[1]], c1 = [p.box[0] + p.box[2] / 2 - o[0], p.box[1] + p.box[3] / 2 - o[1]];
      g.setAttribute("transform", "translate(" + f1(c1[0]) + " " + f1(c1[1]) + ") rotate(" + p.turn + ") translate(" + f1(-c0[0]) + " " + f1(-c0[1]) + ")");
      if (p.turn) g.querySelectorAll("text").forEach(function(el) {
        var was = el.getAttribute("transform");
        shared.poseText.set(el, was);
        el.setAttribute("transform", "rotate(" + -p.turn + " " + f1(c0[0]) + " " + f1(c0[1]) + ")" + (was ? " " + was : ""));
      });
      edges2.forEach(function(e, j) {
        if ((e.s === i || e.t === i) && gE && gE[e.id]) {
          gE[e.id].forEach(function(q) {
            q.style.display = "none";
          });
          shared.live.add(j);
        }
      });
    });
  }
  function poseBack() {
    if (shared.poseText) shared.poseText.forEach(function(v, el) {
      if (v == null) el.removeAttribute("transform");
      else el.setAttribute("transform", v);
    });
    if (shared.poseNow && gN) Object.keys(shared.poseNow).forEach(function(k) {
      var g = gN[nodes2[+k].id];
      if (g && !(mv && mv.n.has(+k))) g.removeAttribute("transform");
    });
    shared.poseNow = null;
    shared.poseText = null;
  }
  function posePort(i, off, k) {
    var p = shared.poseNow && shared.poseNow[i];
    if (!p) return off;
    if (p.ports && p.ports[k]) return p.ports[k];
    if (!p.turn) return off;
    var a = p.turn * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [off[0] * c - off[1] * s, off[0] * s + off[1] * c];
  }
  function keyShift(ks, dx, dy) {
    if (!gN) return;
    shared.keyed = shared.keyed || { n: /* @__PURE__ */ new Set(), p: /* @__PURE__ */ new Set(), dx: 0, dy: 0 };
    shared.frozen = false;
    shared.keyed.dx += dx;
    shared.keyed.dy += dy;
    ks.n.forEach(function(i) {
      shared.keyed.n.add(i);
    });
    ks.p.forEach(function(i) {
      shared.keyed.p.add(i);
    });
    var tr = "translate(" + shared.keyed.dx + " " + shared.keyed.dy + ")";
    shared.keyed.n.forEach(function(i) {
      var g = gN[nodes2[i].id];
      if (g) g.setAttribute("transform", tr);
    });
    shared.live = shared.live || /* @__PURE__ */ new Set();
    edges2.forEach(function(e, k) {
      var a = ks.n.has(e.s), b = ks.n.has(e.t), some = e.pts.some(function(p) {
        return ks.p.has(p);
      });
      var gs = gE[e.id];
      if (!gs || !(a || b || some)) return;
      gs.forEach(function(g) {
        g.style.display = "none";
      });
      shared.live.add(k);
    });
    liveFmt().glyphs(shared.keyed.n, shared.keyed.p, [shared.keyed.dx, shared.keyed.dy]);
  }
  function restBox(i) {
    var b = boxOf(i), k = shared.keyed && shared.keyed.n.has(i);
    return k ? [b[0] - shared.keyed.dx, b[1] - shared.keyed.dy, b[2], b[3]] : b;
  }
  function restPt(pi) {
    var p = points[pi], k = shared.keyed && shared.keyed.p && shared.keyed.p.has(pi);
    return [num(p, "x") - (k ? shared.keyed.dx : 0), num(p, "y") - (k ? shared.keyed.dy : 0)];
  }
  function dropCopies() {
    shared.copies.forEach(function(c) {
      c[0].remove();
      if (c[1] && !(shared.live && shared.live.has(c[2]))) c[1].style.display = "";
    });
    shared.copies = [];
  }
  function follow(o, n) {
    var seg = [];
    for (var i = 1; i < o.length; i++) {
      var a = o[i - 1], b = o[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), a1 = n[i - 1], b1 = n[i], L1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
      seg.push({ a, L, u: L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0], a1, L1, u1: L1 ? [(b1[0] - a1[0]) / L1, (b1[1] - a1[1]) / L1] : L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0] });
    }
    return function(p) {
      var best = null, bd = Infinity;
      seg.forEach(function(S2, k) {
        var x = p[0] - S2.a[0], y = p[1] - S2.a[1], t2 = x * S2.u[0] + y * S2.u[1], c = Math.max(0, Math.min(S2.L, t2));
        var d = Math.hypot(x - c * S2.u[0], y - c * S2.u[1]) + (t2 < 0 && k > 0 ? 1e-6 : 0);
        if (d < bd) {
          bd = d;
          best = [S2, t2, -x * S2.u[1] + y * S2.u[0]];
        }
      });
      var S = best[0], t = best[1], w = best[2];
      var nA = t <= 15, nB = S.L - t <= 15;
      if (nA && nB) {
        nA = t <= S.L - t;
        nB = !nA;
      }
      var t1 = nA || S.L <= 0 ? t : nB ? S.L1 - (S.L - t) : t * S.L1 / S.L;
      return [S.a1[0] + t1 * S.u1[0] - w * S.u1[1], S.a1[1] + t1 * S.u1[1] + w * S.u1[0]];
    };
  }
  function endShape(o, n, c, P) {
    var L = o.length - 1, best = null, bd = 25;
    [[o[L], o[L - 1], n[L], n[L - 1]], [o[0], o[1], n[0], n[1]]].forEach(function(E) {
      var d = Math.hypot(c[0] - E[0][0], c[1] - E[0][1]);
      if (d < bd) {
        bd = d;
        best = E;
      }
    });
    if (!best) return null;
    var A = best[0], B = best[1], A1 = best[2], B1 = best[3], l = Math.hypot(A[0] - B[0], A[1] - B[1]), l1 = Math.hypot(A1[0] - B1[0], A1[1] - B1[1]);
    var u = l ? [(A[0] - B[0]) / l, (A[1] - B[1]) / l] : [1, 0], u1 = l1 ? [(A1[0] - B1[0]) / l1, (A1[1] - B1[1]) / l1] : u;
    if (P) {
      if (P.length !== 2) return null;
      var dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1], dl = Math.hypot(dx, dy);
      if (!dl || Math.abs(dx * u[0] + dy * u[1]) / dl > 0.2) return null;
    }
    return function(p) {
      var x = p[0] - A[0], y = p[1] - A[1], t = x * u[0] + y * u[1], w = -x * u[1] + y * u[0];
      return [A1[0] + t * u1[0] - w * u1[1], A1[1] + t * u1[1] + w * u1[0]];
    };
  }
  function withBends(str, R) {
    var tk = str.match(/[MLQCZ]|-?[\d.]+(?:e-?\d+)?/gi) || [], poly2 = !/[A-Z]/i.test(str);
    if (poly2) {
      var q = ["M"];
      tk.forEach(function(x, i2) {
        if (i2 > 0 && i2 % 2 === 0) q.push("L");
        q.push(x);
      });
      tk = q;
    }
    var segs = [], seen = [], cur = null, N = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
    for (var i = 0; i < tk.length; ) {
      var c = tk[i], m = N[c];
      if (m == null) return str;
      var a = tk.slice(i + 1, i + 1 + m).map(Number);
      for (var j = 0; j + 1 < a.length; j += 2) seen.push([a[j], a[j + 1]]);
      if (c === "L" && cur) segs.push({ at: i, a: cur });
      if (m) cur = [a[m - 2], a[m - 1]];
      i += 1 + m;
    }
    var add = [];
    R.forEach(function(r) {
      if (seen.some(function(s) {
        return Math.hypot(s[0] - r[0], s[1] - r[1]) < 0.5;
      })) return;
      segs.some(function(s) {
        var b = [+tk[s.at + 1], +tk[s.at + 2]], dx = b[0] - s.a[0], dy = b[1] - s.a[1], L = dx * dx + dy * dy;
        if (!L) return false;
        var t = ((r[0] - s.a[0]) * dx + (r[1] - s.a[1]) * dy) / L;
        if (t <= 0 || t >= 1 || Math.hypot(s.a[0] + dx * t - r[0], s.a[1] + dy * t - r[1]) > 1.5) return false;
        add.push([s.at, t, r]);
        return true;
      });
    });
    if (!add.length) return str;
    add.sort(function(x, y) {
      return y[0] - x[0] || y[1] - x[1];
    });
    add.forEach(function(x) {
      tk.splice(x[0], 0, "L", String(x[2][0]), String(x[2][1]));
    });
    if (poly2) return tk.filter(function(x) {
      return !/^[ML]$/.test(x);
    }).reduce(function(s, x, i2) {
      return s + (i2 % 2 ? "," : i2 ? " " : "") + x;
    }, "");
    return tk.join(" ");
  }
  function fullLines(ks, pp) {
    dropCopies();
    ks.forEach(function(k) {
      var e = edges2[k], gs = gE && gE[e.id];
      if (!gs) return;
      var o = line(k, restBox, restPt), n = line(k, null, null, pp);
      if (!o || !n) return;
      var F0 = follow(o, n), pair = function(str, closed) {
        if (!closed) str = withBends(str, o.slice(1, -1));
        var v = str.match(/-?[\d.]+(?:e-?\d+)?/g) || [], k2 = 0, P = [];
        for (var i = 0; i + 1 < v.length; i += 2) P.push([+v[i], +v[i + 1]]);
        var c = P.reduce(function(s, q) {
          return [s[0] + q[0] / P.length, s[1] + q[1] / P.length];
        }, [0, 0]);
        var F2 = P.length && endShape(o, n, c, closed ? null : P) || F0;
        return str.replace(/-?[\d.]+(?:e-?\d+)?/g, function(m) {
          var j = k2++;
          if (j % 2) return f1(F2([+v[j - 1], +v[j]])[1]);
          return f1(F2([+v[j], +v[j + 1]])[0]);
        });
      }, F = F0;
      gs.forEach(function(g) {
        g.style.display = "none";
        var c = g.cloneNode(true);
        c.removeAttribute("data-e");
        c.style.display = "";
        c.classList.add("m2-ed-copy");
        g.parentNode.insertBefore(c, g.nextSibling);
        shared.copies.push([c, g, k]);
        c.querySelectorAll("*").forEach(function(el) {
          var nm = el.localName;
          if ((nm === "polyline" || nm === "polygon") && !el.getAttribute("transform")) el.setAttribute("points", pair(el.getAttribute("points") || "", nm === "polygon"));
          else if (nm === "path" && !el.getAttribute("transform") && /^[MLQCZ\s\d.,e-]*$/.test(el.getAttribute("d") || "")) el.setAttribute("d", pair(el.getAttribute("d"), /Z\s*$/i.test(el.getAttribute("d"))));
          else if (nm === "line") {
            var q1 = F([+el.getAttribute("x1"), +el.getAttribute("y1")]), q2 = F([+el.getAttribute("x2"), +el.getAttribute("y2")]);
            el.setAttribute("x1", f1(q1[0]));
            el.setAttribute("y1", f1(q1[1]));
            el.setAttribute("x2", f1(q2[0]));
            el.setAttribute("y2", f1(q2[1]));
          } else if (nm !== "g" && nm !== "title" && nm !== "tspan") {
            var b;
            try {
              b = el.getBBox();
            } catch (x) {
              return;
            }
            var m = [b.x + b.width / 2, b.y + b.height / 2], q = (nm !== "text" && endShape(o, n, m) || F)(m);
            el.setAttribute("transform", "translate(" + f1(q[0] - m[0]) + " " + f1(q[1] - m[1]) + ")" + (el.getAttribute("transform") ? " " + el.getAttribute("transform") : ""));
          }
        });
      });
    });
  }
  function liveLines(out) {
    var pk0 = drag && drag.port && drag.port.to ? drag.port : null, lk = new Set(shared.live || []);
    var free = pk0 && pk0.free;
    if (pk0) {
      liveFmt().glyphs(/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), null, pk0);
      (shared.live || []).forEach(function(k) {
        lk.add(k);
      });
      lk.add(pk0.k);
    }
    if (gE) {
      if (!shared.frozen) {
        if (lk.size) {
          if (free || !liveFmt().lines(lk, pk0)) fullLines(lk, pk0);
        } else dropCopies();
      }
    } else lk.forEach(function(k) {
      var pts = line(k, null, null, pk0);
      if (pts) out.push('<path class="m2-ed-live" stroke-width="' + f1(V.z) + '" d="' + livePath(pts, edges2[k].smooth) + '"/>');
    });
    return pk0;
  }
  function liveDraw(skip) {
    if (!gN) return;
    if (shared.liveOrig) Object.keys(shared.liveOrig).forEach(function(i) {
      if (!shared.liveC || !shared.liveC[i]) undraw(+i);
    });
    if (!shared.liveC) return;
    shared.liveOrig = shared.liveOrig || {};
    skip = skip || [];
    var ks = Object.keys(shared.liveC).map(Number).filter(function(i) {
      var n = nodes2[i], g = gN[n.id];
      return g && skip.indexOf(i) < 0 && (n.comp || n.shape.kind === "Complex") && (shared.liveOrig[i] || !g.getAttribute("transform"));
    });
    if (liveFmt().holders) {
      liveFmt().holders(ks);
      return;
    }
    ks.forEach(function(i) {
      if (!shared.liveOrig[i]) shared.liveOrig[i] = liveRec(i);
      if (shared.liveOrig[i]) livePut(shared.liveOrig[i], shared.liveC[i]);
    });
  }
  function liveRec(i) {
    var g = gN && gN[nodes2[i].id];
    if (!g) return null;
    var first = g.firstElementChild && g.firstElementChild.localName === "a" ? g.firstElementChild : g, b = boxOf(i), seen = /* @__PURE__ */ new Set();
    var svs = svList(i).map(function(q) {
      var parts = svParts(i, q);
      parts.forEach(function(el) {
        seen.add(el);
      });
      return { parts, r: [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5], c: q[1] };
    });
    var shapes = [], kids = Array.prototype.slice.call(first.children);
    for (var k = 0; k < kids.length && kids[k].localName === "path" && !seen.has(kids[k]); k++) if (/[Zz]\s*$/.test(kids[k].getAttribute("d") || "")) shapes.push(kids[k]);
    var R = { i, b, shapes, svs, texts: kids.filter(function(el) {
      return el.localName === "text" && !seen.has(el);
    }), was: /* @__PURE__ */ new Map() };
    shapes.concat(R.texts).forEach(function(el) {
      R.was.set(el, [el.getAttribute("d"), el.getAttribute("transform")]);
    });
    svs.forEach(function(s) {
      s.parts.forEach(function(el) {
        R.was.set(el, [el.getAttribute("d"), el.getAttribute("transform")]);
      });
    });
    return R;
  }
  function livePut(R, nb) {
    var n = nodes2[R.i], b0 = R.b, two = R.shapes.length > 1 && n.shape.props.mcount === "2";
    R.shapes.forEach(function(el, k) {
      var o = two && k < R.shapes.length / 2 ? 6 : 0;
      el.setAttribute("d", outlineD(n.shape, nb[0] + o, nb[1] + o, nb[2], nb[3]));
    });
    var tr = function(dx, dy) {
      return "translate(" + f1(dx) + " " + f1(dy) + ")";
    };
    var pos = n.labPos || "c", v = pos.charAt(0);
    var ddx = /l$/.test(pos) ? nb[0] - b0[0] : /r$/.test(pos) ? nb[0] + nb[2] - b0[0] - b0[2] : nb[0] + nb[2] / 2 - b0[0] - b0[2] / 2;
    var ddy = v === "t" ? nb[1] - b0[1] : v === "b" ? nb[1] + nb[3] - b0[1] - b0[3] : nb[1] + nb[3] / 2 - b0[1] - b0[3] / 2;
    R.texts.forEach(function(el) {
      el.setAttribute("transform", tr(ddx, ddy));
    });
    R.svs.forEach(function(s) {
      var t = tr(nb[0] + (0.5 + s.r[0]) * nb[2] - s.c[0], nb[1] + (0.5 + s.r[1]) * nb[3] - s.c[1]);
      s.parts.forEach(function(el) {
        el.setAttribute("transform", t);
      });
    });
  }
  function liveBack(R) {
    if (R.back) {
      R.back();
      return;
    }
    R.was.forEach(function(v, el) {
      if (v[0] != null) el.setAttribute("d", v[0]);
      if (v[1] != null) el.setAttribute("transform", v[1]);
      else el.removeAttribute("transform");
    });
  }
  function sizeLive(i, nb) {
    var own2 = liveFmt().size;
    if (!shared.sizeRec || shared.sizeRec.i !== i) {
      sizeOff();
      shared.sizeRec = own2 ? own2(i, null, null) : liveRec(i);
    }
    if (shared.sizeRec) {
      if (own2) own2(i, nb, shared.sizeRec);
      else livePut(shared.sizeRec, nb);
    }
  }
  function poseSize(i, box3) {
    poseBack();
    if (!gN) return;
    shared.live = shared.live || /* @__PURE__ */ new Set();
    posed({ n: /* @__PURE__ */ new Set(), p: /* @__PURE__ */ new Set(), dx: 0, dy: 0 }, { i, box: box3 });
    if (shared.poseNow) shared.sizePosed = true;
  }
  function sizeOff() {
    if (shared.sizePosed) {
      shared.sizePosed = false;
      unshift();
    }
    if (!shared.sizeRec) return;
    liveBack(shared.sizeRec);
    shared.sizeRec = null;
  }
  function __start9() {
    __run211();
  }

  // editor/src/help.js
  var MOD;
  function __run113() {
    MOD = /mac|iphone|ipad|ipod/i.test(navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || navigator.userAgent) ? "Cmd" : "Ctrl";
  }
  function helpList() {
    return [
      ["While editing", null, [
        ["Click, then drag", "an item is selected first, then moved"],
        ["Drag on empty space or an item not selected", V.grab === false ? "selects an area in place of the selection" : "moves the map, as outside editing"],
        ["Shift + click, Shift + drag", "adds an item or an area to the selection; Shift + click takes an item out"],
        ["Shift + drag on what is selected", "moves it by itself, out of what holds it"],
        ["Arrow keys", "move what is selected by 1, with Shift by 10"],
        [MOD + " + Z, " + MOD + " + Shift + Z or " + MOD + " + Y", "undo, redo the last change, of the map or of a setting"],
        [MOD + " + A", "select all"],
        [MOD + " + S", "save at once"],
        ["Delete", "remove what is selected, where it can be removed"],
        ["E", "switch between editing and viewing"]
      ]],
      ["Less obvious", ["Gesture", "What it does", "Maps"], [
        ["Double click a palette sign", "keeps it in hand for several uses, Esc lets go", "all"],
        ["Drag between two entities with Consumption or Production", "makes the process between them, with both arcs", "SBGN-ML"],
        ["A sign kept in hand, dragged between two nodes", "draws what the two ends call for: consumption, modulation, production", "SBGN-ML, CellDesigner"],
        ["Drop a node on a complex", "makes it a member, the complex packed round it", "SBGN-ML, CellDesigner"],
        ["Double click a name", "types it in place", "SBGN-ML, CellDesigner"],
        ["Click a state variable already selected", "types its text in place (P, P@S505)", "SBGN-ML"],
        ["Alt held while dragging or resizing", "no snapping: any place, any size", "all"],
        ["Esc during a drag", "puts it back: nothing moved, resized, bent or made", "all"],
        ["Click a line\u2019s end square, then arrow keys", "moves the end round the node\u2019s outline", "all"],
        ["Click a state variable, then arrow keys", "moves it round the border", "SBGN-ML, CellDesigner"],
        ["Right click on a line", "adds a bend point there, or removes the one clicked", "all"],
        ["Right click on empty space", "Remove all bend points, Snap map to grid, Repack all complexes", "all"],
        ["Right click on a complex", "Name by members (A:B), Repack complex", "all"],
        ["Right click on a process", "Turn process, a quarter clockwise", "SBGN-ML, GraphML"],
        ["Right click on an entity, a process or a modulation", "Change identity: another kind, its lines kept", "SBGN-ML, CellDesigner"],
        ["Right click on overlapping compartments", "Bring forward, Send backward", "SBGN-ML, GraphML"],
        ["Right click on an added reactant or product", "Make main reactant, Make main product", "CellDesigner"],
        ["Add reactant or Add product, onto a reaction\u2019s line", "joins a line to a reaction already there", "CellDesigner"],
        ["A logic gate sign: click its inputs, then the reaction", "places the gate where CellDesigner would", "CellDesigner"],
        ["Image in Properties, or a PNG or SVG dropped on a compartment or species", "MINERVA\u2019s image, drawn in the box as MINERVA draws it; Fit box to image on the right click", "CellDesigner"],
        ["Right click on empty map space, Add background image, or a PNG or SVG dropped there", "an image under the whole map, as MINERVA draws it; a click on it where nothing else is selects it, then a drag moves it, its handles resize it (Shift keeps its proportions), Delete removes it; also listed under Background in the panel", "CellDesigner"],
        ["Set as default, in Properties", "the next ones of that kind made this size and look", "all"],
        ["Colours, Original", "puts back the map\u2019s own colours after another choice", "all"]
      ]]
    ];
  }
  var helpBtn;
  var helpBox;
  function __run214() {
    helpBtn = box2.querySelector("#m2-ed-help"), helpBox = null;
  }
  function helpBuild() {
    var e = function(t) {
      return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    };
    helpBox = document.createElement("div");
    helpBox.id = "m2-ed-help-box";
    helpBox.setAttribute("role", "dialog");
    helpBox.setAttribute("aria-label", "How to edit");
    helpBox.hidden = true;
    var table2 = function(head, rows) {
      return "<table>" + (head ? "<tr>" + head.map(function(h) {
        return "<th>" + e(h) + "</th>";
      }).join("") + "</tr>" : "") + rows.map(function(r) {
        return "<tr>" + r.map(function(c) {
          return "<td>" + e(c) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</table>";
    };
    helpBox.innerHTML = '<button type="button" class="m2-ed-help-x" aria-label="Close">\xD7</button><h3>Editing</h3>' + helpList().map(function(s) {
      return "<h4>" + e(s[0]) + "</h4>" + table2(s[1], s[2]);
    }).join("");
    document.body.appendChild(helpBox);
    helpBox.querySelector(".m2-ed-help-x").addEventListener("click", function() {
      help(false);
    });
  }
  function help(show, at2) {
    if (!helpBox) helpBuild();
    show = show === void 0 ? helpBox.hidden : show;
    if (show) {
      helpBox.remove();
      helpBuild();
    }
    if (show) {
      var b = helpBtn.getBoundingClientRect(), p = V.view.getBoundingClientRect();
      helpBox.hidden = false;
      var k = V.pz(), w = helpBox.offsetWidth * k, h = helpBox.offsetHeight * k, left = Math.max(p.left + 28, b.right + 8), top = b.top;
      if (left + w > V.winW() - 16) {
        left = Math.max(16, Math.min(b.right - w, V.winW() - 16 - w));
        top = b.bottom + 6;
      }
      helpBox.style.left = left / k + "px";
      helpBox.style.top = Math.max(16, Math.min(top, V.winH() - 16 - h)) / k + "px";
      var h4 = at2 && Array.prototype.filter.call(helpBox.querySelectorAll("h4"), function(x) {
        return x.textContent === at2;
      })[0];
      if (h4) helpBox.scrollTop = h4.offsetTop - 8;
    } else helpBox.hidden = true;
    helpBtn.setAttribute("aria-pressed", String(show));
  }
  function __run310() {
    helpBtn.addEventListener("click", function() {
      help();
    });
    document.addEventListener("keydown", function(ev) {
      if (helpBox && !helpBox.hidden && ev.key === "Escape") {
        help(false);
        ev.stopPropagation();
        return;
      }
      if (ev.key !== "?" || ev.ctrlKey || ev.metaKey || ev.altKey || !on) return;
      var a = document.activeElement;
      if (a && (/input|textarea|select/i.test(a.tagName) || a.isContentEditable)) return;
      ev.preventDefault();
      help();
    }, true);
    document.addEventListener("pointerdown", function(ev) {
      if (helpBox && !helpBox.hidden && !helpBox.contains(ev.target) && !helpBtn.contains(ev.target)) help(false);
    }, true);
  }
  function __start10() {
    __run113();
    __run214();
    __run310();
  }

  // editor/src/merge.js
  function merge3(base, ours, theirs) {
    if (ours === theirs || theirs === base) return { text: ours, clashes: 0, moved: 0, broken: null };
    if (ours === base) return { text: theirs, clashes: 0, moved: 0, broken: null };
    try {
      return join(read(base), read(ours), read(theirs));
    } catch (e) {
      return { text: ours, clashes: 0, moved: 0, broken: String(e && e.message ? e.message : e) };
    }
  }
  function read(text) {
    if (typeof text !== "string" || !text) throw new Error("an empty version");
    var doc2 = { path: "", kids: [], s: 0, e: text.length, unit: "" }, stack = [doc2], i = 0, n = text.length, byPath = {};
    while (i < n) {
      var lt = text.indexOf("<", i);
      if (lt < 0) break;
      if (text.startsWith("<!--", lt)) {
        i = upTo(text, "-->", lt);
        continue;
      }
      if (text.startsWith("<![CDATA[", lt)) {
        i = upTo(text, "]]>", lt);
        continue;
      }
      if (text.startsWith("<?", lt)) {
        i = upTo(text, "?>", lt);
        continue;
      }
      if (text.startsWith("<!", lt)) {
        var sb = text.indexOf("[", lt), gt0 = text.indexOf(">", lt);
        i = sb >= 0 && sb < gt0 ? upTo(text, "]>", lt) : gt0 + 1;
        if (i <= 0) throw new Error("a declaration not closed");
        continue;
      }
      var gt = tagEnd2(text, lt);
      if (text[lt + 1] === "/") {
        var top = stack.pop(), nm = text.slice(lt + 2, gt).trim();
        if (!top || top === doc2 || top.tag !== nm) throw new Error("an end tag " + nm + " that closes nothing open");
        top.cs = lt;
        top.e = gt + 1;
        i = gt + 1;
        continue;
      }
      var raw = text.slice(lt + 1, gt), self2 = raw[raw.length - 1] === "/", tag = (/^[^\s/>]+/.exec(raw) || [""])[0];
      if (!tag) throw new Error("a tag with no name");
      var el = { tag, at: attrs(raw), s: lt, oe: gt + 1, cs: gt + 1, e: gt + 1, kids: [], up: stack[stack.length - 1] };
      el.up.kids.push(el);
      if (!self2) stack.push(el);
      i = gt + 1;
    }
    if (stack.length !== 1) throw new Error("an element not closed: " + stack[stack.length - 1].tag);
    var roots = doc2.kids;
    if (roots.length !== 1) throw new Error("not one root element");
    var many = {};
    (function count(p) {
      p.kids.forEach(function(c) {
        if (c.at.id != null) {
          var k = c.tag + "#" + c.at.id;
          many[k] = (many[k] || 0) + 1;
        }
        count(c);
      });
    })(doc2);
    (function name2(p) {
      var rank = {};
      p.kids.forEach(function(c) {
        var id = c.at.id != null ? c.at.id : null;
        if (id != null) {
          c.path = c.key = (many[c.tag + "#" + id] > 1 ? p.unit + ">" : "") + c.tag + "#" + id;
          c.unit = c.key;
          c.ctx = c.tag;
        } else {
          var sig = c.tag + (c.at.key != null ? "[" + c.at.key + "]" : "");
          rank[sig] = (rank[sig] || 0) + 1;
          c.path = p.path + "/" + sig + "#" + rank[sig];
          c.unit = p.unit;
          c.ctx = (p.ctx ? p.ctx + "/" : "") + c.tag;
        }
        if (byPath[c.path] && id != null) {
          for (var r2 = 2; byPath[c.path + "~" + r2]; r2++) ;
          c.path = c.key = c.unit = c.path + "~" + r2;
        }
        if (byPath[c.path]) throw new Error("the element " + c.path + " found twice");
        byPath[c.path] = c;
        name2(c);
      });
    })(doc2);
    return { text, doc: doc2, root: roots[0], byPath, items: items(text, doc2) };
  }
  function upTo(t, end, from) {
    var k = t.indexOf(end, from);
    if (k < 0) throw new Error("a " + end + " missing");
    return k + end.length;
  }
  function tagEnd2(t, lt) {
    for (var k = lt + 1, q = ""; k < t.length; k++) {
      var c = t[k];
      if (q) {
        if (c === q) q = "";
      } else if (c === '"' || c === "'") q = c;
      else if (c === ">") return k;
    }
    throw new Error("a tag not closed");
  }
  function attrs(raw) {
    var o = {}, re = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g, m;
    while (m = re.exec(raw)) o[m[1]] = m[3] != null ? m[3] : m[4];
    return o;
  }
  function lead(t, at2) {
    var k = at2;
    while (k > 0 && /\s/.test(t[k - 1])) k--;
    return k;
  }
  function items(t, doc2) {
    var out = {};
    var own2 = function(el) {
      var s = "", pos = el.s;
      el.kids.forEach(function(c) {
        if (c.key) {
          s += t.slice(pos, lead(t, c.s));
          pos = c.e;
        } else {
          s += t.slice(pos, c.s) + own2(c);
          pos = c.e;
        }
      });
      return s + t.slice(pos, el.e);
    };
    var it = function(el, sig) {
      var pos = [];
      (function each(e) {
        if (e.at) ["x", "y"].forEach(function(ax) {
          var v = e.at[ax] != null ? parseFloat(e.at[ax]) : null;
          if (v != null && v === v) pos.push([e.ctx + " " + ax, ax, v]);
        });
        e.kids.forEach(function(c) {
          if (!c.key) each(c);
        });
      })(el);
      return { el, sig, blank: null, pos };
    };
    (function walk2(el) {
      el.kids.forEach(function(c) {
        if (c.key) out[c.key] = it(c, "in " + (c.up.path || "/") + "\n" + own2(c));
        walk2(c);
      });
    })(doc2);
    out[""] = it(doc2, own2(doc2));
    return out;
  }
  function rx() {
    return { TAG: /<([^\s/>!?]+)([^>]*)>/g, XY: /(\s)(x|y)(\s*=\s*)(["'])(-?[\d.]+(?:[eE][-+]?\d+)?)\4/g, GEO: /(\s(?:x|y|w|h|width|height|sizeX|sizeY|left|right|top|bottom|leftF|rightF|topF|bottomF)\s*=\s*)("[^"]*"|'[^']*')/g };
  }
  function blank(i) {
    if (i.blank == null) {
      var R = rx();
      i.blank = i.sig.replace(R.TAG, function(m, tag, rest) {
        return "<" + tag + rest.replace(R.XY, function(mm, sp, ax, eq, q) {
          return sp + ax + eq + q + q;
        }) + ">";
      });
    }
    return i.blank;
  }
  function alike(a, b) {
    return a.sig === b.sig || a.pos.length === b.pos.length && blank(a) === blank(b);
  }
  function frame(A, B) {
    var by = {}, F = { x: 0, y: 0, on: {} }, both = [];
    Object.keys(A.items).forEach(function(k) {
      var a = A.items[k], b = B.items[k];
      if (!b || !a.pos.length || !alike(a, b)) return;
      both.push([a, b]);
      a.pos.forEach(function(p, i) {
        var d = Math.round((p[2] - b.pos[i][2]) * 100) / 100, g = by[p[0]] || (by[p[0]] = { ax: p[1], n: 0, c: {} });
        g.n++;
        g.c[d] = (g.c[d] || 0) + 1;
      });
    });
    var best = { x: null, y: null };
    Object.keys(by).forEach(function(t) {
      var g = by[t], m = null;
      Object.keys(g.c).forEach(function(d) {
        if (m == null || g.c[d] > g.c[m] || g.c[d] === g.c[m] && Math.abs(+d) < Math.abs(+m)) m = d;
      });
      g.m = +m;
      if (g.m !== 0 && g.c[m] * 2 >= g.n && (!best[g.ax] || g.n > best[g.ax].n)) best[g.ax] = g;
    });
    ["x", "y"].forEach(function(ax) {
      if (!best[ax]) return;
      var m = best[ax].m, on2 = {};
      Object.keys(by).forEach(function(t) {
        var g = by[t];
        if (g.ax === ax && Math.abs(g.m - m) < 0.01) on2[t] = true;
      });
      var moved = both.filter(function(ab) {
        return ab[0].pos.some(function(p, i) {
          return on2[p[0]] && Math.abs(p[2] - ab[1].pos[i][2] - m) < 0.01;
        });
      }).length;
      if (moved * 2 < both.length) return;
      F[ax] = m;
      Object.keys(on2).forEach(function(t) {
        F.on[t] = true;
      });
    });
    return F;
  }
  function same(a, b, F) {
    if (!a || !b) return !a && !b;
    if (a.sig === b.sig && !F.x && !F.y) return true;
    if (!alike(a, b)) return false;
    for (var i = 0; i < a.pos.length; i++) {
      var p = a.pos[i];
      if (Math.abs(p[2] - b.pos[i][2] - (F.on[p[0]] ? F[p[1]] : 0)) > 0.01) return false;
    }
    return true;
  }
  function shifter(F) {
    if (!F.x && !F.y) return function(s) {
      return s;
    };
    return function(s, el) {
      if (!el || !el.ctx) return s;
      var gt = s.indexOf(">");
      return s.slice(0, gt).replace(rx().XY, function(mm, sp, ax, eq, q, v) {
        return F.on[el.ctx + " " + ax] && F[ax] ? sp + ax + eq + q + String(+(parseFloat(v) + F[ax]).toFixed(3)) + q : mm;
      }) + s.slice(gt);
    };
  }
  function join(B, O, T) {
    var Fo = frame(O, B), Ft = frame(T, B), Fot = frame(O, T), V2 = { o: O, t: T, shift: shifter(Fot) }, keys = {}, side = {}, clashes = 0, moved = 0;
    [B, O, T].forEach(function(v) {
      Object.keys(v.items).forEach(function(k) {
        keys[k] = 1;
      });
    });
    Object.keys(keys).forEach(function(k) {
      var b = B.items[k], o = O.items[k], t = T.items[k];
      if (same(t, b, Ft)) side[k] = o ? "o" : null;
      else if (same(o, b, Fo)) side[k] = t ? "t" : null;
      else {
        side[k] = o ? "o" : null;
        if (same(o, t, Fot)) return;
        if (o && t && o.sig.replace(rx().GEO, '$1""') === t.sig.replace(rx().GEO, '$1""')) moved++;
        else clashes++;
      }
    });
    if (side[""] == null) throw new Error("no document");
    var under2 = {}, placed2 = {};
    Object.keys(side).forEach(function(k) {
      if (!k || !side[k]) return;
      var el = V2[side[k]].items[k].el, p = el.up.path;
      (under2[p] = under2[p] || []).push(k);
    });
    var text = cut2(V2, side, under2, placed2, V2[side[""]].doc, side[""]);
    Object.keys(side).forEach(function(k) {
      if (k && side[k] && !placed2[k]) throw new Error("the item " + k + " has no place left");
    });
    refs(text, [B, O, T]);
    return { text, clashes, moved, broken: null };
  }
  function cut2(V2, side, under2, placed2, el, w) {
    var v = V2[w], t = v.text, here2 = (under2[el.path] || []).slice(), slots = [], pieces = [], pos = el.s;
    var sh = function(x, at2) {
      return w === "t" && at2 === el.s ? V2.shift(x, el) : x;
    };
    el.kids.forEach(function(c) {
      if (c.key) {
        pieces.push(sh(t.slice(pos, lead(t, c.s)), pos));
        slots.push(c.key);
        pieces.push({ slot: slots.length - 1 });
        pos = c.e;
      } else {
        pieces.push(sh(t.slice(pos, c.s), pos));
        pieces.push({ done: cut2(V2, side, under2, placed2, c, w) });
        pos = c.e;
      }
    });
    var tail = t.slice(pos, el.e), str = function(p) {
      return typeof p === "string" ? p : p.done != null ? p.done : null;
    };
    if (!here2.length) return pieces.map(function(p) {
      var x = str(p);
      return x == null ? "" : x;
    }).join("") + sh(tail, pos);
    var isHere = {}, slotOf = {};
    here2.forEach(function(k) {
      isHere[k] = true;
    });
    slots.forEach(function(k, i) {
      slotOf[k] = i;
    });
    var R = slots.filter(function(k) {
      return isHere[k];
    }), inR = {};
    R.forEach(function(k) {
      inR[k] = true;
    });
    here2.filter(function(k) {
      return !inR[k];
    }).forEach(function(k) {
      var kv = V2[side[k]], ke = kv.items[k].el, sib = ke.up.kids.filter(function(c) {
        return c.key;
      }), j = sib.indexOf(ke), at2 = -1;
      for (var a = j - 1; a >= 0 && at2 < 0; a--) {
        var ia = R.indexOf(sib[a].key);
        if (ia >= 0) at2 = ia + 1;
      }
      for (var z = j + 1; z < sib.length && at2 < 0; z++) {
        var iz = R.indexOf(sib[z].key);
        if (iz >= 0) at2 = iz;
      }
      if (at2 < 0) at2 = R.length;
      R.splice(at2, 0, k);
    });
    var group = {}, g = slots.length ? 0 : "end";
    R.forEach(function(k) {
      var si = slotOf[k];
      if (si != null) g = si;
      (group[g] = group[g] || []).push(k);
    });
    var item = function(k) {
      var kv = V2[side[k]], ke = kv.items[k].el;
      if (placed2[k]) throw new Error("the item " + k + " placed twice");
      placed2[k] = true;
      return kv.text.slice(lead(kv.text, ke.s), ke.s) + cut2(V2, side, under2, placed2, ke, side[k]);
    };
    var out = pieces.map(function(p) {
      var x = str(p);
      return x != null ? x : (group[p.slot] || []).map(item).join("");
    }).join("");
    if (group.end) {
      if (el.path && el.cs === el.e) throw new Error("items to place in an element written empty: " + el.tag);
      var cs = el.path ? el.cs : t.length, ws = lead(t, cs);
      var rel = ws - pos;
      out += sh(tail.slice(0, rel), pos) + group.end.map(item).join("") + tail.slice(rel);
    } else out += sh(tail, pos);
    return out;
  }
  function refs(text, vs) {
    var R = read(text), ids = {}, now = {};
    vs.forEach(function(v) {
      Object.keys(v.byPath).forEach(function(p) {
        var e = v.byPath[p];
        if (e.at.id != null) ids[e.at.id] = 1;
      });
    });
    Object.keys(R.byPath).forEach(function(p) {
      var e = R.byPath[p];
      if (e.at.id != null) now[e.at.id] = 1;
    });
    Object.keys(R.byPath).forEach(function(p) {
      var e = R.byPath[p];
      var check = function(v) {
        String(v).split(/[\s,]+/).forEach(function(x) {
          if (x && ids[x] && !now[x]) throw new Error("a reference to " + x + ", which is no longer there");
        });
      };
      Object.keys(e.at).forEach(function(a) {
        if (a !== "id") check(e.at[a]);
      });
      if (!e.kids.length) check(text.slice(e.oe, e.cs));
    });
  }

  // editor/src/core.js
  var lastSvg;
  var lastFor;
  var Y;
  var G;
  var drawing;
  function __run114() {
    lastSvg = null, lastFor = null;
    Y = "http://www.yworks.com/xml/graphml", G = "http://graphml.graphdrawing.org/xmlns";
    drawing = false;
  }
  function setText(t) {
    shared.text = t;
    return t;
  }
  function src() {
    return shared.F.now();
  }
  var box2;
  var status;
  var overlay;
  var on;
  var map;
  var name;
  var handle;
  var unsaved;
  var reSel;
  var reGh;
  var doc;
  var geos;
  var points;
  var nodes2;
  var edges2;
  var docText;
  var x0;
  var y0;
  var undo;
  var drag;
  var band;
  var ticket;
  var nudgeAt;
  var timer;
  var gN;
  var gE;
  var mv;
  var keyGuides;
  var keyRun;
  var keyDue;
  var keyNear;
  function __run215() {
    box2 = document.getElementById("m2-editwin"), status = document.getElementById("m2-ed-status");
    overlay = document.getElementById("m2-edit-layer");
    on = false, map = null;
    name = "", handle = null;
    unsaved = {};
    reSel = function() {
      try {
        var nav = performance.getEntriesByType("navigation")[0], r = JSON.parse(sessionStorage.getItem("atlas-edit-sel") || "null");
        sessionStorage.removeItem("atlas-edit-sel");
        return nav && nav.type === "reload" && r && r.path === location.pathname ? r : null;
      } catch (e) {
        return null;
      }
    }();
    reGh = reSel && reSel.gh && reSel.gh.path && reSel.gh.sha && typeof reSel.gh.text === "string" ? reSel.gh : null;
    doc = null, geos = [], points = [], nodes2 = [], edges2 = [];
    docText = null;
    x0 = 0, y0 = 0;
    undo = [], drag = null, band = null, ticket = 0, nudgeAt = 0, timer = null;
    gN = null, gE = null, mv = null;
    keyGuides = null, keyRun = null, keyDue = null;
  }
  function keyFlush() {
    clearTimeout(timer);
    if (keyDue) keyDue();
  }
  function boxesBefore(B0) {
    var o = {};
    nodes2.forEach(function(n, k) {
      o[n.id] = B0(k);
    });
    return o;
  }
  var TOKEN_KEY;
  var AUTOSAVE;
  var site;
  var saveTimer;
  var saving;
  var saveAgain;
  var stuck;
  var siteRef;
  var GRID_KEY;
  var STEP0;
  var stepOk;
  var gridSet;
  function __run311() {
    TOKEN_KEY = V.tokenKey, AUTOSAVE = 3e3;
    site = null;
    saveTimer = null, saving = null, saveAgain = false, stuck = false;
    siteRef = null;
    GRID_KEY = "atlas-edit-grid";
    STEP0 = 8, stepOk = function(v) {
      return v >= 1 && v <= 100 ? Math.round(v) : STEP0;
    };
    gridSet = function() {
      try {
        var g = JSON.parse(localStorage.getItem(GRID_KEY) || "{}");
        return { shown: g.shown !== false, snap: g.snap === true, step: stepOk(+g.step) };
      } catch (e) {
        return { shown: true, snap: false, step: STEP0 };
      }
    }();
  }
  function gridBlock() {
    var s = gridSet.step;
    return 2 * s * Math.ceil(8 / s);
  }
  function lineStep() {
    var s = gridSet.step;
    if (s % 2) return s;
    s /= 2;
    while (s > 8 && s % 2 === 0) s /= 2;
    return s;
  }
  function gridKeep() {
    try {
      localStorage.setItem(GRID_KEY, JSON.stringify(gridSet));
    } catch (e) {
    }
  }
  function gridButtons() {
    box2.querySelector("#m2-ed-grid").setAttribute("aria-pressed", String(gridSet.shown));
    box2.querySelector("#m2-ed-snap").setAttribute("aria-pressed", String(gridSet.snap));
  }
  var gridCv;
  function __run45() {
    gridCv = null;
  }
  function gridPaint() {
    var show = on && V.current === map && gridSet.shown;
    if (!show) {
      if (gridCv) gridCv.style.display = "none";
      return;
    }
    if (!gridCv || gridCv.parentNode !== V.view) {
      gridCv = document.createElement("canvas");
      gridCv.id = "m2-ed-gridcv";
      gridCv.setAttribute("aria-hidden", "true");
      gridCv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
      V.view.insertBefore(gridCv, V.view.firstChild);
    }
    gridCv.style.display = "";
    var R = gridCv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = V.view.clientWidth, H2 = V.view.clientHeight;
    var cw = Math.round(R.width * dpr), ch = Math.round(R.height * dpr), k = cw / W;
    if (gridCv.width !== cw || gridCv.height !== ch) {
      gridCv.width = cw;
      gridCv.height = ch;
    }
    var c = gridCv.getContext("2d");
    c.clearRect(0, 0, cw, ch);
    c.lineWidth = 1;
    var s = gridSet.step;
    while (s * V.z < 6) s *= 2;
    var a = s * V.z, ox = V.tx - x0 * V.z, oy = V.ty - y0 * V.z;
    [["rgba(0,0,0,.07)", 1], ["rgba(0,0,0,.13)", 0]].forEach(function(t) {
      c.strokeStyle = t[0];
      c.beginPath();
      [[ox, W, cw, true], [oy, H2, ch, false]].forEach(function(A) {
        var i = Math.ceil(-A[0] / a), v;
        for (; (v = A[0] + i * a) <= A[1]; i++) {
          if ((i % 2 + 2) % 2 !== t[1]) continue;
          var d = Math.round(v * k) + 0.5;
          if (A[3]) {
            c.moveTo(d, 0);
            c.lineTo(d, ch);
          } else {
            c.moveTo(0, d);
            c.lineTo(cw, d);
          }
        }
      });
      c.stroke();
    });
  }
  function toGrid(v, st) {
    return Math.round(v / st) * st - v;
  }
  function baseOf(pub, fr) {
    var all = (pub.match(/<y:Geometry\s[^>]*>/g) || []).map(function(tag) {
      var a = function(n) {
        var m = tag.match(new RegExp("\\s" + n + '="([^"]*)"'));
        return m ? parseFloat(m[1]) : NaN;
      };
      return [a("x"), a("y"), a("width"), a("height")];
    });
    if (all.length !== geos.length) {
      var d = new DOMParser().parseFromString(pub, "application/xml"), by = {};
      if (d.getElementsByTagName("parsererror").length) return null;
      Array.prototype.forEach.call(d.getElementsByTagNameNS(G, "node"), function(n) {
        var r = realizerOf(n), g = r && r.getElementsByTagNameNS(Y, "Geometry")[0];
        if (g) by[n.getAttribute("id")] = [num(g, "x"), num(g, "y"), num(g, "width"), num(g, "height")];
      });
      return { ids: nodes2.map(function(n) {
        return n.id;
      }), boxes: nodes2.map(function(n) {
        return by[n.id] || null;
      }), x0: fr.x0, y0: fr.y0 };
    }
    return { ids: nodes2.map(function(n) {
      return n.id;
    }), boxes: nodes2.map(function(n) {
      return all[n.ag];
    }), x0: fr.x0, y0: fr.y0 };
  }
  function picX0() {
    return shared.F.ownFrame ? 0 : x0;
  }
  function picY0() {
    return shared.F.ownFrame ? 0 : y0;
  }
  function nowRef() {
    return { ids: nodes2.map(function(n) {
      return n.id;
    }), boxes: nodes2.map(function(n, i) {
      return boxOf(i);
    }), x0, y0 };
  }
  function owner() {
    var h = location.hostname;
    return /\.github\.io$/.test(h) ? h.split(".")[0] : null;
  }
  function repo() {
    var o = owner();
    return o ? o + "/" + o + "-data" : null;
  }
  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }
  function gh(full2, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ Authorization: "Bearer " + token(), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, opt.headers || {});
    opt.cache = "no-store";
    return fetch("https://api.github.com/repos/" + full2, opt);
  }
  function api(path, opt) {
    var r = gh(repo() + path, opt), write2 = opt && opt.method && opt.method !== "GET";
    if (write2) r.then(function(q) {
      if (q.ok) startBuild();
    }, function() {
    });
    return r;
  }
  var buildTimer;
  var buildRefused;
  function __run59() {
    buildTimer = null, buildRefused = 0;
  }
  function dispatchBuild(keep) {
    var o = owner();
    return gh(o + "/" + o + ".github.io/actions/workflows/build.yml/dispatches", { method: "POST", keepalive: !!keep, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: "main" }) }).then(function(q) {
      buildRefused = q.ok ? 0 : q.status;
      if (!q.ok) warn(buildNote());
    }, function() {
    });
  }
  function startBuild() {
    clearTimeout(buildTimer);
    buildTimer = setTimeout(function() {
      buildTimer = null;
      dispatchBuild(false);
    }, 4e3);
  }
  function buildNote() {
    return "Saved, but the site is not rebuilt (" + buildRefused + "): the token cannot start its build.";
  }
  function __run67() {
    addEventListener("pagehide", function() {
      if (buildTimer) {
        clearTimeout(buildTimer);
        buildTimer = null;
        dispatchBuild(true);
      }
    });
  }
  function b64(t) {
    var u = new TextEncoder().encode(t), s = "";
    for (var i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
    return btoa(s);
  }
  function changed() {
    edits++;
    if (passStay) {
      passStay = false;
      passing = "";
      waitShow();
    }
    if (openSay) {
      if (status.textContent === openSay.t) quiet();
      openSay = null;
    }
    goodNow();
    if (shared.F.moved) shared.F.moved();
    if (site && site.pending) {
      localFor = site;
      clearTimeout(localTimer);
      localTimer = setTimeout(local, 800);
      localBox();
      return;
    }
    if (site && site.mine) {
      localFor = site;
      clearTimeout(localTimer);
      localTimer = setTimeout(local, 800);
    }
    if (!site || !token() || stuck) return;
    note();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(push, AUTOSAVE);
  }
  function push(again) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!site || site.pending || !site.path || !shared.dirty || stuck) return Promise.resolve();
    if (saving) {
      saveAgain = true;
      return saving;
    }
    if (drawing) {
      saveTimer = setTimeout(push, 300);
      return Promise.resolve();
    }
    var target = site, body = src();
    note();
    keepOut(target, body);
    sending[target.id] = body;
    saving = api("/contents/" + target.path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Moved in the viewer: " + target.path.split("/").pop(), content: b64(body), sha: target.sha || void 0, branch: "main" })
    }).then(function(r) {
      return r.json().then(function(d) {
        if (r.ok) {
          var was = target.sha;
          target.sha = d.content.sha;
          target.saved = body;
          outSent(target, body, was);
          if (bank[target.id] && bank[target.id].kept !== target) forget(target.id);
          learnt(target.path, target.sha);
          if (V.kept && V.kept.id === target.id) V.kept.sha = target.sha;
          var sm = V.byId[target.id];
          if (sm) target.v = V.ver(sm);
          if (target.mine) savedMine(target, body);
          var ks = lastFor && lastFor[2] === target.id && !lastFor[3] ? lastSvg : null;
          if (ks && site === target && src() === body && !target.mine) {
            var all = V.stored();
            var one = {};
            one[target.id] = all[target.id] = { v: target.v, sha: target.sha, svg: ks, text: body, file: name, width: map.width, height: map.height, x0: picX0(), y0: picY0(), at: Date.now(), ref: siteRef, cur: nowRef() };
            var bare2 = function(o, keep) {
              Object.keys(o).forEach(function(k) {
                if (k !== keep) delete o[k].text;
              });
              return o;
            };
            if (!V.store(all) && !V.store(bare2(all, target.id)) && !V.store(bare2(all)) && !V.store(bare2(one))) {
              all = V.stored();
              delete all[target.id];
              V.store(all);
            }
          }
          if (site === target && src() === body) shared.dirty = false;
          var uk = unsaved[target.id];
          if (uk && uk.site === target && (uk.text === body || site === target && !shared.dirty)) delete unsaved[target.id];
          note();
        } else if (r.status === 409 || r.status === 422) {
          return again ? conflict(target, body) : Promise.all([
            api("/contents/" + target.path + "?ref=main").then(function(q) {
              return q.json();
            }),
            api("/contents/" + target.path + "?ref=main", { headers: { Accept: "application/vnd.github.raw" } }).then(function(q) {
              return q.text();
            })
          ]).then(function(f) {
            if (f[1] !== (target.saved || target.base)) return conflict(target, body);
            target.sha = f[0].sha;
            saving = null;
            saveAgain = false;
            return push(true);
          }, function() {
            sendFailed("net");
          });
        } else if (r.status === 401 || r.status === 403 || r.status === 404) {
          sendFailed("token");
        } else if (r.status >= 500) sendFailed("net");
        else warn("Not saved (" + r.status + "): " + (d.message || "") + ". Your changes are kept in this browser; the next move tries again.");
      });
    }).catch(function() {
      sendFailed("net");
    }).then(function() {
      if (sending[target.id] === body) delete sending[target.id];
      if (saving !== ours) return;
      saving = null;
      if (saveAgain) {
        saveAgain = false;
        if (shared.dirty) return push();
      }
    });
    var ours = saving;
    return saving;
  }
  var waitFail;
  var sendRun;
  var retryTimer;
  var lastVisit;
  var passing;
  var passTimer;
  var passStay;
  var passAfter;
  var sending;
  var lockFree;
  var CLOUD;
  function __run472() {
    waitFail = false, sendRun = null, retryTimer = null, lastVisit = null, passing = "", passTimer = null, passStay = false, passAfter = null, sending = {}, lockFree = null;
    CLOUD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></svg>';
    addEventListener("online", function() {
      sendWaiting();
      sendOpen();
    });
    addEventListener("pagehide", keepNow2);
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") keepNow2();
    });
  }
  function keyOf(id) {
    return repo() + "|" + id;
  }
  function here() {
    var k = repo() + "|";
    return outboxAll().filter(function(r) {
      return r.key.indexOf(k) === 0;
    });
  }
  function savable() {
    return on && site && site.path && !site.pending && !stuck && !site.clashed && repo() && token();
  }
  function keepNow2() {
    if (savable() && shared.dirty && !drawing) {
      var t = src(), r = outboxGet(keyOf(site.id));
      if (!r || r.text !== t) keepOut(site, t);
    }
  }
  function sendOpen() {
    if (savable() && shared.dirty && !saving && !saveTimer) push();
  }
  function mapName2(id, fallback) {
    var m = V.byId[id];
    return m ? m.topic || m.title : fallback || id;
  }
  function recOf2(t, body, n) {
    return { key: keyOf(t.id), id: t.id, path: t.path, name: n || mapName2(t.id, name), text: body, sha: t.sha || null, saved: t.saved != null ? t.saved : t.base != null ? t.base : null, also: sending[t.id] || null, mine: !!t.mine };
  }
  function keepOut(t, body) {
    if (!t || !t.id || !t.path || !(repo() && token())) return Promise.resolve();
    return outboxKeep(recOf2(t, body)).catch(function(e) {
      warn("This browser could not keep your last change (" + String(e && e.message ? e.message : e).replace(/\.$/, "") + "). Download the map to keep it.");
    });
  }
  function outSent(t, body, was) {
    var k = keyOf(t.id), r = outboxGet(k);
    if (r && r.text !== body && r.sha === (was || null)) {
      r.sha = t.sha;
      r.saved = body;
      r.also = null;
      outboxKeep(r).catch(function() {
      });
    } else outboxDone(k, body);
    sendOk();
    if (here().some(function(x) {
      return x.id !== t.id;
    }) || opsIds().length) sendWaiting();
  }
  function sendOk() {
    clearTimeout(retryTimer);
    retryTimer = null;
    waitFail = false;
    waitShow();
  }
  function sendFailed(why) {
    if (why === "token") {
      if (waitFail !== "token") {
        warn("GitHub refused the token. Your changes are kept in this browser. Connect again with a new token.");
        ghForm(true);
      }
      waitFail = "token";
    } else {
      waitFail = "net";
      clearTimeout(retryTimer);
      retryTimer = setTimeout(function() {
        retryTimer = null;
        sendWaiting();
        sendOpen();
      }, 3e4);
    }
    waitShow();
  }
  function sendWhy(e) {
    var s = typeof e === "number" ? e : e && e.status;
    return s === 404 ? "token" : !s || s === 409 ? "net" : whyFailed(s);
  }
  function whyFailed(e) {
    var s = typeof e === "number" ? e : e && e.status;
    if (s === 401 || s === 403) return "token";
    if (s >= 500 || !s && e instanceof TypeError && /fetch|network|load failed/i.test(e.message || "")) return "net";
    return "other";
  }
  function waitIds() {
    var o = {};
    here().forEach(function(r) {
      o[r.id] = 1;
    });
    opsIds().forEach(function(id) {
      o[id] = 1;
    });
    return o;
  }
  function waitingOf(id) {
    return !!waitFail && !!waitIds()[id];
  }
  function waitText() {
    var n = waitFail === "net" ? Object.keys(waitIds()).length : 0;
    return n ? "Offline: changes to " + n + (n > 1 ? " maps" : " map") + " kept in this browser, sent to GitHub when the connection is back." : passing;
  }
  function cloudOn(b, id) {
    var c = b.querySelector(".m2-cloud"), w = waitingOf(id);
    if (w && !c) {
      c = document.createElement("span");
      c.className = "m2-cloud";
      c.title = "Not on GitHub yet: kept in this browser";
      c.innerHTML = CLOUD;
      var n = b.querySelector(".m2-fx") || b.querySelector(".m2-name");
      if (n) n.after(c);
      else b.appendChild(c);
    } else if (!w && c) c.remove();
  }
  function waitShow() {
    var t = waitText(), e = document.getElementById("m2-ed-wait");
    if (e) {
      e.textContent = t;
      e.hidden = !t;
    }
    var l = document.getElementById("m2-list");
    if (!l) return;
    var w = l.querySelector(":scope > p.m2-wait");
    if (t && !w) {
      w = document.createElement("p");
      w.className = "m2-set-note m2-wait";
      l.insertBefore(w, l.firstChild);
    }
    if (w) {
      if (t) w.textContent = t;
      else w.remove();
    }
    l.querySelectorAll(".m2-map[data-id]").forEach(function(b) {
      cloudOn(b, b.getAttribute("data-id"));
    });
  }
  function passSay(t, stay) {
    if (passStay && !stay) return;
    passing = t;
    passStay = !!stay;
    waitShow();
    clearTimeout(passTimer);
    passTimer = stay ? null : setTimeout(function() {
      passing = "";
      waitShow();
    }, 6e3);
  }
  function editLock(id) {
    editUnlock();
    if (!id || !navigator.locks || !(repo() && token())) return;
    var p = new Promise(function(res) {
      lockFree = res;
    });
    navigator.locks.request("atlas-edit-" + keyOf(id), function() {
      return p;
    }).catch(function() {
    });
  }
  function editUnlock() {
    if (lockFree) {
      lockFree();
      lockFree = null;
    }
  }
  function sendWaiting() {
    if (sendRun) return sendRun;
    var go = function() {
      return outboxLoad(true).then(function() {
        if (lastVisit === null) lastVisit = here().map(function(r) {
          return r.key;
        });
        if (!(repo() && token())) return;
        return (navigator.locks && navigator.locks.query ? navigator.locks.query() : Promise.resolve({ held: [] })).then(function(q) {
          var busy = (q.held || []).map(function(h) {
            return h.name;
          });
          var list2 = here().filter(function(r) {
            return !(on && site && site.id === r.id) && busy.indexOf("atlas-edit-" + r.key) < 0;
          }), back2 = [], says = [], sent = 0;
          return list2.reduce(function(p, r) {
            return p.then(function() {
              return sendOne(r).then(function(x) {
                if (!x) return;
                sent++;
                if (lastVisit.indexOf(r.key) >= 0) back2.push(r.key);
                if (x.say) says.push(x.say);
                waitShow();
              });
            });
          }, Promise.resolve()).then(function() {
            return null;
          }, function(e) {
            var why = sendWhy(e);
            if (why === "other") warn("Not saved on GitHub (" + e + "). Your changes are kept in this browser.");
            else sendFailed(why);
            return why;
          }).then(function(failed) {
            return opsDrain().then(function(x) {
              if (!failed && !x.stuck && (sent || x.sent) && !(on && site && outboxGet(keyOf(site.id)))) sendOk();
              x.back.forEach(function(id) {
                if (back2.indexOf(keyOf(id)) < 0) back2.push(keyOf(id));
              });
              lastVisit = lastVisit.filter(function(k) {
                return back2.indexOf(k) < 0;
              });
              if (says.length) passSay(says.join(" "), true);
              else if (back2.length) passSay("Changes to " + back2.length + (back2.length > 1 ? " maps" : " map") + " from your last visit sent to GitHub.");
            });
          });
        });
      });
    };
    var run = navigator.locks ? navigator.locks.request("atlas-outbox", go) : go();
    sendRun = run.catch(function() {
    }).then(function() {
      sendRun = null;
    });
    return sendRun;
  }
  function sendOne(r) {
    return outboxFresh(r.key).then(function(cur) {
      if (!cur || cur.text !== r.text) return null;
      return ghRead(r.path).then(function(g) {
        g = g || { sha: null, text: null };
        if (g.text === r.text) return { sha: g.sha, text: r.text };
        var j = g.text != null && g.sha !== r.sha && g.text !== r.saved && g.text !== r.also ? joined(r.saved, r.text, g.text) : null, t = j ? j.text : r.text;
        if (t === g.text) return { sha: g.sha, text: t };
        return api("/contents/" + r.path, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Moved in the viewer: " + r.path.split("/").pop(), content: b64(t), sha: g.sha || void 0, branch: "main" })
        }).then(function(q) {
          if (!q.ok) throw q.status;
          return q.json();
        }).then(function(d) {
          return { sha: d.content.sha, text: t, j, other: g.text };
        });
      }).then(function(x) {
        learnt(r.path, x.sha);
        forget(r.id);
        if (r.mine) savedMine({ id: r.id, sha: x.sha }, x.text, x.text !== r.text);
        var u = unsaved[r.id];
        if (u && u.text === r.text) delete unsaved[r.id];
        return outboxDone(r.key, r.text).then(function() {
          if (!x.j || !x.j.real) return x;
          return otherKept(r.id, r.name, x.j, x.other).then(function(l) {
            x.say = l;
            return x;
          });
        });
      });
    });
  }
  var localTimer;
  var localFor;
  var lq;
  function __run77() {
    localTimer = null, localFor = null, lq = Promise.resolve();
  }
  function local(force) {
    clearTimeout(localTimer);
    localTimer = null;
    var s = localFor;
    if (!s || site !== s) return;
    var drawn = !drawing && lastFor && lastFor[0] === shared.text && lastFor[1] === shared.F.beside();
    if (!drawn && !force) {
      localTimer = setTimeout(local, 300);
      return;
    }
    localFor = null;
    if (s.clashed) return;
    var t = src(), at2 = { width: map.width, height: map.height, x0: picX0(), y0: picY0(), ref: siteRef, cur: nowRef() };
    var own2 = lastFor && lastFor[2] === s.id && !lastFor[3] ? lastSvg : null;
    var nm = name, back2 = !s.mine && atSite(), g0 = !s.mine && shared.F.g0 ? shared.F.g0() : null;
    var pic = function() {
      return own2 ? Promise.resolve({ svg: own2, width: at2.width, height: at2.height }) : drawText(t, g0);
    };
    var fail = function(e) {
      if (site === s) warn("Not kept in this browser: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ". Download the map to keep your changes.");
    };
    lq = lq.then(function() {
      return keptNow(s).catch(function() {
        return s.known;
      });
    }).then(function(k) {
      if (s.clashed) return;
      if (k !== s.known) return clashed(s, t, "in another tab");
      return write2();
    }).catch(fail);
    function write2() {
      if (s.mine) {
        if (!mine[s.id]) return;
        toFolder(s.id, nm, t);
        return pic().then(function(d) {
          if (mine[s.id]) return minePut(Object.assign({}, mine[s.id], { text: t, svg: d.svg, width: d.width, height: d.height, at: Date.now() })).then(function() {
            s.known = t;
          });
        }).then(function() {
          if (s.pending && site === s && src() === t) shared.dirty = false;
          if (s.pending && repo() && token() && mine[s.id]) toGh(s);
          if (!on || site !== s) V.refreshMine();
        }).catch(fail);
      }
      if (back2) {
        if (site === s) {
          shared.dirty = false;
          localBox();
        }
        toFolder(s.id, nm, t, true);
        return draftDrop(s.id).then(function() {
          s.known = null;
        });
      }
      toFolder(s.id, nm, t);
      return pic().then(function(d) {
        return draftPut(s.id, { file: nm, v: s.v, text: t, svg: d.svg, width: d.width, height: d.height, x0: at2.x0, y0: at2.y0, ref: at2.ref, cur: at2.cur, at: Date.now() });
      }).then(function() {
        s.known = t;
        if (site === s && src() === t) shared.dirty = false;
      }).catch(fail);
    }
  }
  var leftMoves;
  function __run85() {
    leftMoves = null;
  }
  function atSite() {
    var n = !on && leftMoves && leftMoves.site === site ? leftMoves.n : undo.length;
    return site.pending && (src() === site.pub || !n && !site.fromDraft && (!shared.F.asRead || src() === site.base));
  }
  function unkeep(id) {
    if (localFor && localFor.id === id) {
      clearTimeout(localTimer);
      localTimer = null;
      localFor = null;
    }
    return draftDrop(id);
  }
  var canFolder;
  var folderOk;
  var fq;
  function __run94() {
    canFolder = "showDirectoryPicker" in window, folderOk = null, fq = Promise.resolve();
  }
  function folderCheck() {
    folderOk = null;
    localBox();
    return folder().then(function(f) {
      if (!f) return folderForget().then(function() {
        return null;
      });
      return f.dir.queryPermission({ mode: "readwrite" });
    }).then(function(p) {
      folderOk = p === "granted";
      localBox();
    }, function() {
      folderOk = false;
      localBox();
    });
  }
  function lost(e) {
    folderForget().then(function() {
      folderOk = null;
      localBox();
    });
    warn("Not saved to the folder: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ".");
  }
  function freeName(dir, file, n) {
    var nm = file.replace(/(\.[^.]+)?$/, "-" + n + "$1");
    return dir.getFileHandle(nm).then(function() {
      return freeName(dir, file, n + 1);
    }, function() {
      return nm;
    });
  }
  function toFolder(id, file, t, ours) {
    if (!canFolder || !V.folderName() || !file || repo() && token()) return fq;
    fq = fq.then(function() {
      return folder().then(function(f) {
        if (!f) return;
        var w = f.files[id];
        if (w && w.name.indexOf("/") >= 0) w = null;
        if (ours && !w) return;
        return f.dir.queryPermission({ mode: "readwrite" }).then(function(p) {
          folderOk = p === "granted";
          if (!folderOk) {
            localBox();
            return;
          }
          var nm = w ? w.name : file;
          return f.dir.getFileHandle(nm).then(function(h) {
            return h.getFile();
          }, function() {
            return null;
          }).then(function(old) {
            return old && !(w && old.lastModified === w.mod && old.size === w.size) ? freeName(f.dir, file, 2) : nm;
          }).then(function(nm2) {
            var h;
            return f.dir.getFileHandle(nm2, { create: true }).then(function(x) {
              h = x;
              return h.createWritable();
            }).then(function(wr) {
              return wr.write(t).then(function() {
                return wr.close();
              });
            }).then(function() {
              return h.getFile();
            }).then(function(fl) {
              return folderFile(id, { name: nm2, mod: fl.lastModified, size: fl.size });
            }).then(function() {
              if (w && w.name === nm2) return;
              return origFolderDrop(f, nm2).then(function() {
                var r = origAll()[id];
                if (r && (r.fill || r.node)) return origWrite(f, nm2, r);
              });
            });
          });
        });
      });
    }).catch(function(e) {
      if (e && (e.name === "NotFoundError" || e.name === "NotAllowedError")) lost(e);
      else warn("Not saved to the folder: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ".");
    });
    return fq;
  }
  function origFolderDir(f, make) {
    return f.dir.getDirectoryHandle(".viewer", { create: make }).then(function(d) {
      return d.getDirectoryHandle("colours", { create: make });
    });
  }
  function origFolderName(id, f) {
    var w = f && f.files[id];
    return w && w.name.indexOf("/") < 0 ? w.name : null;
  }
  function origWrite(f, nm, rec) {
    return origFolderDir(f, true).then(function(d) {
      return d.getFileHandle(nm + ".json", { create: true });
    }).then(function(h) {
      return h.createWritable();
    }).then(function(w) {
      return w.write(JSON.stringify(Object.assign({}, rec, { sent: void 0 }))).then(function() {
        return w.close();
      });
    });
  }
  function origFolderDrop(f, nm) {
    return origFolderDir(f, false).then(function(d) {
      return d.removeEntry(nm + ".json");
    }).catch(function() {
    });
  }
  function origRead(f, nm) {
    return origFolderDir(f, false).then(function(d) {
      return d.getFileHandle(nm + ".json");
    }).then(function(h) {
      return h.getFile();
    }).then(function(fl) {
      return fl.text();
    }).then(function(t) {
      var r = JSON.parse(t);
      return r && typeof r === "object" && !Array.isArray(r) && (r.fill || r.node) ? r : null;
    }).catch(function() {
      return null;
    });
  }
  function origToFolder(id, rec) {
    if (!canFolder || !V.folderName() || repo() && token()) return;
    fq = fq.then(function() {
      return folder().then(function(f) {
        var nm = origFolderName(id, f);
        if (!nm) return;
        return f.dir.queryPermission({ mode: "readwrite" }).then(function(p) {
          if (p === "granted") return origWrite(f, nm, rec);
        });
      });
    }).catch(function(e) {
      if (e && (e.name === "NotFoundError" || e.name === "NotAllowedError")) lost(e);
      else warn("The map\u2019s own colours were not kept in the folder: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ".");
    });
  }
  function origFromFolder(id) {
    if (!canFolder || !V.folderName() || repo() && token()) return Promise.resolve(null);
    return folder().then(function(f) {
      var nm = origFolderName(id, f);
      return nm ? origRead(f, nm) : null;
    }).catch(function() {
      return null;
    });
  }
  function allToFolder() {
    var d = V.drafts;
    Object.keys(d).forEach(function(id) {
      var m = V.byId[id], f = d[id].file || (graphmlOf(m && m.site || m) || "").split("?")[0].split("/").pop();
      toFolder(id, f, d[id].text);
    });
    Object.keys(mine).forEach(function(id) {
      var r = mine[id];
      if (!r.hidden && !r.site) toFolder(id, r.file, r.text);
    });
    return fq;
  }
  function chooseFolder() {
    if (!canFolder) return Promise.resolve();
    return window.showDirectoryPicker({ id: "atlas-maps", mode: "readwrite" }).then(function(dir) {
      return folderSet(dir);
    }).then(function() {
      folderOk = true;
      localBox();
      return allToFolder();
    }).then(syncFolder).catch(function(e) {
      if (e && e.name === "AbortError") return;
      warn("No folder chosen: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ".");
      throw e;
    });
  }
  function allowFolder() {
    return folder().then(function(f) {
      return f ? f.dir.requestPermission({ mode: "readwrite" }) : "denied";
    }).then(function(p) {
      if (p === "granted") {
        folderOk = true;
        localBox();
        return allToFolder().then(syncFolder);
      }
      lost("the browser did not allow it");
    }).catch(lost);
  }
  function syncFolder() {
    if (!canFolder || !V.folderName() || repo() && token()) return Promise.resolve();
    var news = false;
    var all = function(dir) {
      var it = dir.values(), out = [];
      return function next() {
        return it.next().then(function(x) {
          if (x.done) return out;
          out.push(x.value);
          return next();
        });
      }();
    };
    return mineIn.then(folder).then(function(f) {
      if (!f) return;
      return f.dir.queryPermission({ mode: "readwrite" }).then(function(p) {
        if (p !== "granted") return;
        var ours = {}, siteFiles = {};
        Object.keys(f.files).forEach(function(id) {
          ours[f.files[id].name] = id;
        });
        V.maps.forEach(function(m) {
          if (!m.mine) siteFiles[(graphmlOf(m.site || m) || "").split("?")[0].split("/").pop()] = 1;
        });
        return all(f.dir).then(function(hs) {
          var zips = hs.filter(function(h) {
            return h.kind === "file" && /\.zip$/i.test(h.name) && !f.files["zip:" + h.name];
          });
          return zips.reduce(function(q, h) {
            return q.then(function() {
              return h.getFile();
            }).then(function(fl) {
              return folderFile("zip:" + h.name, { name: h.name, mod: fl.lastModified, size: fl.size }).then(function() {
                return openZipFolder(fl);
              });
            }).catch(function() {
            });
          }, Promise.resolve()).then(function() {
            return hs;
          });
        }).then(function(hs) {
          return hs.filter(function(h) {
            return h.kind === "file" && /\.(graphml|xml|sbgn|nwt)$/i.test(h.name);
          }).reduce(function(q, h) {
            return q.then(function() {
              var id = ours[h.name];
              if (id ? !mine[id] : siteFiles[h.name.replace(/-\d+(\.[^.]+)$/, "$1")]) return;
              var r = id ? mine[id] : null, w = r && f.files[r.id];
              if (r && r.hidden) return;
              return h.getFile().then(function(fl) {
                if (r && w && fl.lastModified === w.mod && fl.size === w.size) return;
                return fl.text().then(function(t) {
                  if (!id && mineMatch(h.name, t)) return;
                  return drawText(t).then(function(d) {
                    return mineAdd(h.name, t, d, id || null);
                  }).then(function(n) {
                    news = true;
                    return folderFile(n.id, { name: h.name, mod: fl.lastModified, size: fl.size });
                  });
                });
              }).catch(function() {
              });
            });
          }, Promise.resolve());
        });
      });
    }).then(function() {
      if (news) V.refreshMine();
    }, function() {
    });
  }
  function drawText(t, g0, keep) {
    var F = formatOfText(t), made2 = F && F.drawOwn(t, g0, keep);
    if (!made2) return Promise.reject(new Error("not a GraphML, CellDesigner or SBGN-ML file"));
    return made2.then(function(svg) {
      var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
      if (!w) throw new Error("not a map this viewer can draw");
      return { svg, width: parseFloat(w[1]), height: parseFloat(w[2]) };
    });
  }
  function __run104() {
    box2.querySelector("#m2-ed-l-folder").addEventListener("click", function() {
      chooseFolder().catch(function() {
      });
    });
    box2.querySelector("#m2-ed-l-allow").addEventListener("click", allowFolder);
  }
  function localBox() {
    var b = box2.querySelector("#m2-ed-local"), show = !!(on && site && site.pending && (undo.length || site.fromDraft) && !(repo() && token()));
    b.hidden = !show;
    if (!show) return;
    if (!b.dataset.seen) {
      var told = null;
      try {
        told = localStorage.getItem("atlas-edit-told");
        localStorage.setItem("atlas-edit-told", "1");
      } catch (e) {
      }
      b.dataset.seen = told ? "before" : "now";
    }
    var first = b.dataset.seen === "now", fn = canFolder ? V.folderName() : "", q = function(k) {
      return b.querySelector(k);
    };
    q("#m2-ed-l1").hidden = !first || !!fn;
    var l5 = q("#m2-ed-l5");
    if (l5) l5.hidden = first || !!fn;
    if (l5) l5.textContent = canFolder ? "Kept in this browser only: choose a folder so your maps cannot be lost." : "Kept in this browser only: download the map so it cannot be lost.";
    q("#m2-ed-l2").hidden = !first || canFolder;
    q("#m2-ed-local-dl").hidden = canFolder;
    q("#m2-ed-l-folder").hidden = !canFolder || !!fn;
    q("#m2-ed-l3").hidden = !fn || folderOk !== true;
    q("#m2-ed-l4").hidden = q("#m2-ed-l-allow").hidden = !fn || folderOk !== false;
    q("#m2-ed-l3 span").textContent = q("#m2-ed-l4 span").textContent = fn;
  }
  function download() {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([src()], { type: "application/xml" }));
    a.download = name;
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(a.href);
    }, 1e3);
  }
  function __run115() {
    box2.querySelector("#m2-ed-local-dl").addEventListener("click", function() {
      if (shared.text) download();
    });
  }
  function conflict(s, body) {
    if (site === s) stuck = true;
    var u = unsaved[s.id];
    if (u && u.site === s) body = u.text;
    forget(s.id);
    learnt(s.path, "changed");
    delete unsaved[s.id];
    return joinOpen(s, body);
  }
  var openSay;
  function __run452() {
    openSay = null;
  }
  function sayOpen() {
    if (openSay && site && site.id === openSay.id) warn(openSay.t);
  }
  function clashed(s, t, where2) {
    if (s.clashed) return;
    s.clashed = true;
    var m0 = V.byId[s.id], n = m0 ? m0.topic || m0.title : name;
    return keepBeside(s.id, function() {
      return on && site === s ? src() : t;
    }, function(title, id, was) {
      openSay = { id, t: (n = was) + " was changed " + where2 + " since you opened it, so it is not overwritten: your version is kept beside it as " + title + ", and editing goes on there." };
      warn(openSay.t);
      outboxDone(keyOf(s.id), null).then(waitShow);
    }).catch(function(e) {
      if (s.path && repo() && token()) {
        s.clashed = false;
        return joinOpen(s, t);
      }
      warn("Not saved: " + n + " was changed " + where2 + " since you opened it, so it is not overwritten, and your version could not be kept beside it (" + String(e && e.message ? e.message : e).replace(/\.$/, "") + "). Download the map to keep your changes.");
    });
  }
  function joinOpen(s, body) {
    var t = on && site === s ? src() : body, r = recOf2(s, t), once = function() {
      return sendOne(r);
    };
    return outboxKeep(r).then(function() {
      return navigator.locks ? navigator.locks.request("atlas-outbox", once) : once();
    }).then(function(x) {
      if (site === s) {
        s.clashed = false;
        stuck = false;
      }
      if (!x) return;
      sendOk();
      if (!(on && site === s)) {
        if (x.say) passSay(x.say, true);
        return;
      }
      s.sha = x.sha;
      s.saved = x.text;
      return settled().then(function() {
        if (!(on && site === s)) {
          if (x.say) passSay(x.say, true);
          return;
        }
        var now = src();
        if (x.text === t) {
          if (x.say) passSay(x.say, true);
          if (now === t) shared.dirty = false;
          else {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(push, AUTOSAVE);
          }
          quiet();
          return;
        }
        if (now !== t) {
          var j2 = joined(t, now, x.text);
          outboxKeep(Object.assign(recOf2(s, j2.text), j2.broken ? { sha: null, saved: t } : { sha: x.sha, saved: x.text }, { also: null })).catch(function() {
          });
        }
        var m = V.current && V.current.id === s.id ? V.current : V.byId[s.id];
        clearTimeout(saveTimer);
        saveTimer = null;
        shared.dirty = false;
        if (x.say) passAfter = x.say;
        if (m) {
          editUnlock();
          on = false;
          editMap(m);
        } else if (x.say) {
          passAfter = null;
          passSay(x.say, true);
        }
      });
    }, function(e) {
      if (site === s) {
        s.clashed = false;
        stuck = false;
        quiet();
      }
      var why = sendWhy(e);
      if (why === "other") warn("Not saved on GitHub (" + e + "). Your changes are kept in this browser.");
      else sendFailed(why);
    });
  }
  function settled() {
    return new Promise(function(res) {
      (function w() {
        if (drawing) setTimeout(w, 100);
        else res();
      })();
    });
  }
  function joined(base, ours, theirs) {
    var m = base == null ? { text: ours, broken: "no version to start from" } : merge3(base, ours, theirs);
    return { text: m.text, real: !!m.broken || m.clashes > 0, broken: m.broken };
  }
  function otherKept(id, n, j, other) {
    var line2 = function(title) {
      var kept = title ? "the other version is kept as " + title + "." : "the other version is in its history.";
      return j.broken ? n + " had also changed elsewhere and the two could not be joined: your version is saved; " + kept : n + " had also changed elsewhere: the changes are joined, yours kept where both changed the same item; " + kept;
    };
    return keepOther(id, other).then(line2, function() {
      return line2(null);
    });
  }
  var good;
  var caughtAt;
  var srcMap;
  var PASSED;
  function __run46() {
    good = null, caughtAt = 0, srcMap = null;
    PASSED = /ResizeObserver loop|Failed to fetch|Load failed|NetworkError|network connection was lost|appears to be offline|request timed out|access control checks|The operation was aborted|AbortError|^Script error\.?$/;
    addEventListener("error", function(e) {
      caught(e.error || e.message, e.filename);
    });
    addEventListener("unhandledrejection", function(e) {
      caught(e.reason, "");
    });
  }
  function baseKeep() {
    return shared.F.base ? shared.F.base.keep() : null;
  }
  function basePut(b) {
    if (b && shared.F.base) shared.F.base.put(b);
  }
  function goodNow() {
    good = { u: undoText(), n: undo.length, base: baseKeep(), at: map };
  }
  function caught(err, file) {
    var msg = err && err.message ? err.message : String(err), stack = err && err.stack ? String(err.stack) : "";
    if (!on || PASSED.test(msg) || err && err.name === "AbortError") return;
    if (!file) {
      var u = /([a-z][a-z0-9+.-]*:\/\/[^\s()]+?):\d+:\d+/.exec(stack);
      if (u) file = u[1];
    }
    if (file && file.indexOf(location.origin) !== 0) return;
    var now = Date.now(), again = now - caughtAt < 1e3;
    caughtAt = now;
    var back2 = !again && good && good.at === map && (drag || band || shared.text !== (typeof good.u === "string" ? good.u : good.u.g) || undo.length !== good.n);
    if (back2) {
      drag = null;
      band = null;
      shared.tap = null;
      drawing = false;
      if (good.n < undo.length) {
        undo.length = good.n;
        if (undo.ts) undo.ts.length = Math.min(undo.ts.length, good.n);
      }
      var g = fromUndo(good.u);
      basePut(good.base);
      setText(g);
      shared.selN = [];
      shared.selP = [];
      shared.selE = [];
      shared.part = null;
      try {
        parse();
        render();
        paint();
      } catch (e) {
      }
    }
    var say = function(at2) {
      if (on) warn("Something went wrong in the editor (" + (at2 ? at2 + ": " : "") + msg.split("\n")[0] + ")" + (back2 ? "; the map is back as it was after the last change." : "."));
    };
    where(stack).then(say, function() {
      say("");
    });
  }
  function where(stack) {
    var m = /(https?:\/\/[^\s()]*\/editor\.js)(\?[^:\s()]*)?:(\d+):(\d+)/.exec(stack);
    if (!m) {
      var o = /\/([\w.-]+\.js)(\?[^:\s()]*)?:(\d+):\d+/.exec(stack);
      return Promise.resolve(o ? o[1] + ":" + o[3] : "");
    }
    if (!srcMap) srcMap = fetch(m[1] + ".map" + (m[2] || "")).then(function(q) {
      if (!q.ok) throw new Error(q.status);
      return q.json();
    });
    srcMap.catch(function() {
      srcMap = null;
    });
    return srcMap.then(function(sm) {
      return mapped(sm, +m[3], +m[4]) || "editor.js:" + m[3];
    }, function() {
      return "editor.js:" + m[3];
    });
  }
  function mapped(sm, line2, col) {
    var B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", lines = sm.mappings.split(";"), f = 0, l = 0, best = null;
    for (var i = 0; i < line2 && i < lines.length; i++) {
      var c = 0;
      lines[i].split(",").forEach(function(seg) {
        if (!seg) return;
        var d = [], v = 0, sh = 0;
        for (var k = 0; k < seg.length; k++) {
          var x = B.indexOf(seg[k]);
          v += (x & 31) << sh;
          if (x & 32) sh += 5;
          else {
            d.push(v & 1 ? -(v >> 1) : v >> 1);
            v = 0;
            sh = 0;
          }
        }
        c += d[0];
        if (d.length > 3) {
          f += d[1];
          l += d[2];
          if (i === line2 - 1 && c <= col - 1) best = [f, l];
        }
      });
    }
    return best ? String(sm.sources[best[0]]).split("/").pop() + ":" + (best[1] + 1) : "";
  }
  function ghForm(show) {
    var f = box2.querySelector("#m2-ed-gh");
    f.hidden = !show;
    box2.querySelector("#m2-ed-gh-off").hidden = show || !token() || !repo();
  }
  function warn(t) {
    status.textContent = t;
    status.classList.add("m2-ed-warn");
  }
  function note() {
    if (buildRefused) return warn(buildNote());
    quiet();
  }
  function quiet() {
    if (offSay && on && site && site.pending && !token()) return warn(offSay);
    status.textContent = "";
    status.classList.remove("m2-ed-warn");
  }
  var lay;
  function __run125() {
    lay = null;
  }
  function layout() {
    if (lay) return lay;
    lay = new Promise(function(res, rej) {
      if (window.layout) return res(window.layout);
      var s = document.createElement("script");
      s.src = V.renderers + "layout/layout.js" + V.build;
      s.onload = function() {
        res(window.layout);
        window.dispatchEvent(new Event("m2-layout"));
      };
      s.onerror = function() {
        rej("layout tools not found");
      };
      document.head.appendChild(s);
    });
    lay.catch(function(e) {
      lay = null;
      warn("The layout tools did not load: " + e);
    });
    return lay;
  }
  function layTool(what, ids, same2) {
    if (!on || V.current !== map || !shared.text) return;
    if (!same2) quiet();
    var uAt = undo.length, uTop = undo[uAt - 1];
    var m0 = map;
    Promise.all([layout(), sbpy()]).then(function(q) {
      if (!on || map !== m0) return;
      if (same2 && (undo.length !== uAt || undo[uAt - 1] !== uTop)) return;
      var L = q[0], N = q[1], out = [], t1 = shared.text, before = boxesBefore(boxOf);
      nodes2.forEach(function(n, k) {
        var p = n.up;
        if (p != null && nodes2[p].comp && !placed(k) && overlap(boxOf(k), boxOf(p)) && !inBox(boxOf(k), boxOf(p))) out.push([n.id, nodes2[p].id]);
      });
      out.forEach(function(m) {
        t1 = N.moveInto(t1, [[m[0], null]]);
      });
      var r = L.tidy(t1, what, ids || [], shared.F.engineCd, { grid: gridSet.step, route: lineStep() });
      if (r[1] < 0) return;
      if (!r[1]) return;
      var t2 = r[0];
      out.slice().reverse().forEach(function(m) {
        t2 = N.moveInto(t2, [m]);
      });
      if (!same2) remember(false);
      var keepSel2 = same2 ? shared.selN.map(function(i) {
        return nodes2[i].id;
      }) : [];
      setText(t2);
      parse();
      shared.selN = [];
      shared.selP = [];
      shared.selE = [];
      shared.dirty = true;
      if (keepSel2.length) nodes2.forEach(function(n, k) {
        if (keepSel2.indexOf(n.id) >= 0) shared.selN.push(k);
      });
      if (out.length) {
        var at2 = {};
        nodes2.forEach(function(n, k) {
          at2[n.id] = k;
        });
        setBoxes(grown(out.map(function(m) {
          return at2[m[0]];
        }), boxOf, function(k) {
          return before[nodes2[k].id] || boxOf(k);
        }, function() {
          return false;
        }));
        refit(out.map(function(m) {
          return m[0];
        }));
      }
      if (what === "grid") onNeighbour(new Set(points.map(function(p, i) {
        return i;
      })), 0.5);
      render();
      paint();
      changed();
    }).catch(function(e) {
      warn("Not done: " + (e && e.message ? e.message.split("\n").slice(-2).join(" ") : e));
    });
  }
  function snapMap() {
    layTool("grid", []);
  }
  function pack(ids) {
    layTool("pack", ids);
  }
  function __run135() {
    box2.querySelector("#m2-ed-tidy-grid").addEventListener("click", snapMap);
  }
  function outerComplex(i) {
    var c = null;
    for (var u = i; u != null; u = nodes2[u].up) if (nodes2[u].shape.kind === "Complex") c = u;
    return c;
  }
  function __run145() {
    box2.querySelector("#m2-ed-tidy-pack").addEventListener("click", function() {
      pack(shared.selN.map(function(i) {
        var c = outerComplex(i);
        return nodes2[c == null ? i : c].id;
      }));
    });
  }
  function parse(back2) {
    if (shared.F.parsing) shared.F.parsing(back2 ? "back" : "follow");
    var pd = preDoc.filter(function(x) {
      return x.text === shared.text;
    })[0];
    preDoc = preDoc.filter(function(x) {
      return x !== pd;
    });
    var R = import_graphml_edit.default.read(shared.text, { doc: pd ? pd.doc : null, cd: shared.F.engineCd });
    doc = R.doc;
    docText = shared.text;
    geos = R.geos;
    points = R.points;
    nodes2 = R.nodes;
    edges2 = R.edges;
    shared.procs = R.procs;
    parseFix.forEach(function(f) {
      f();
    });
  }
  function realizerOf(el) {
    return import_graphml_edit.default.realizerOf(el);
  }
  var moveFix;
  var parseFix;
  var keyTake;
  function __run155() {
    moveFix = [], parseFix = [];
    keyTake = [];
  }
  function fixMoved(set, alone) {
    var ids = [], sel = shared.selN.map(function(i) {
      return nodes2[i].id;
    });
    set.forEach(function(i) {
      ids.push(nodes2[i].id);
    });
    moveFix.forEach(function(f) {
      f(set, alone);
    });
    set.clear();
    shared.selN = [];
    nodes2.forEach(function(n, i) {
      if (ids.indexOf(n.id) >= 0) set.add(i);
      if (sel.indexOf(n.id) >= 0) shared.selN.push(i);
    });
  }
  function num(el, a) {
    return parseFloat(el.getAttribute(a));
  }
  function boxOf(i) {
    var g = geos[nodes2[i].ag];
    return [num(g, "x"), num(g, "y"), num(g, "width"), num(g, "height")];
  }
  function fmt(v) {
    return import_graphml_edit.default.fmt(v);
  }
  function write(g, p) {
    var same2 = docText === shared.text;
    setText(import_graphml_edit.default.place(shared.text, g, p));
    if (same2) docText = shared.text;
  }
  function moving(alone) {
    var all = /* @__PURE__ */ new Set();
    shared.selN.forEach(function(i) {
      if (shared.F.square(nodes2[i].id) == null) all.add(i);
      nodes2[i].inside.forEach(function(c) {
        if (!alone || nodes2[c].sub === i) all.add(c);
      });
    });
    var ps = new Set(shared.selP);
    shared.selE.forEach(function(k) {
      edges2[k].pts.forEach(function(p) {
        ps.add(p);
      });
    });
    edges2.forEach(function(e) {
      if (all.has(e.s) && all.has(e.t)) e.pts.forEach(function(p) {
        ps.add(p);
      });
    });
    return { n: all, p: ps, dx: 0, dy: 0 };
  }
  function movedIds(sets) {
    var a = [];
    sets.n.forEach(function(i) {
      a.push(nodes2[i].id);
    });
    return a;
  }
  function full() {
    return V.level === "full";
  }
  function inBox(b, c) {
    return import_holding.default.inBox(b, c);
  }
  function overlap(b, c) {
    return import_holding.default.overlap(b, c);
  }
  function under(i, a) {
    return hm().under(i, a);
  }
  function placed(i) {
    return hm().placed(i);
  }
  function holder(b, not, B) {
    return hm().holder(b, not, B);
  }
  function tops(set, alone) {
    return hm().tops(set, alone);
  }
  var PAD_KEY;
  function __run165() {
    PAD_KEY = "atlas-edit-padding";
  }
  function pads() {
    var p = {};
    try {
      p = JSON.parse(localStorage.getItem(PAD_KEY) || "{}") || {};
    } catch (e) {
    }
    var ok = function(v, m) {
      return typeof v === "number" && v >= 0 && v <= m && v % 4 === 0;
    };
    return { comp: ok(p.comp, 64) ? p.comp : 12, cx: ok(p.cx, 32) ? p.cx : "repack" };
  }
  var hmOf;
  function hm() {
    if (hmOf && hmOf.nodes === nodes2 && hmOf.cd === shared.F.engineCd) return hmOf.H;
    var M = { nodes: nodes2, box: boxOf, ext: extOf, cd: shared.F.engineCd, get pad() {
      return pads().comp;
    }, get cx() {
      return pads().cx;
    }, get room() {
      return window.layout && window.layout.room;
    } };
    hmOf = { nodes: nodes2, cd: M.cd, H: import_holding.default.make(M) };
    return hmOf.H;
  }
  function grown(ks, B, B0, moving2, away2) {
    return hm().grown(ks, B, B0, moving2, away2);
  }
  function extOf(k, b) {
    var L = window.layout, g = boxOf(k);
    if (!L || !L.extent) return [b[0], b[1], b[0] + b[2], b[1] + b[3]];
    var e = L.extent(nodes2[k].el);
    return [b[0] + e[0] - g[0], b[1] + e[1] - g[1], b[0] + b[2] + e[2] - g[0] - g[2], b[1] + b[3] + e[3] - g[1] - g[3]];
  }
  function refit(ids, before) {
    if (!shared.F.insets || !ids.length) return;
    var want = /* @__PURE__ */ new Set(), at2 = {};
    nodes2.forEach(function(n, k) {
      at2[n.id] = k;
    });
    ids.forEach(function(id) {
      for (var u = at2[id]; u != null; u = nodes2[u].up) if (nodes2[u].kids.length && nodes2[u].el.getAttribute("yfiles.foldertype") === "group") want.add(u);
    });
    var t0 = shared.text;
    want.forEach(function(u) {
      var n = nodes2[u], b = boxOf(u), x02 = Infinity, y02 = Infinity, x1 = -Infinity, y1 = -Infinity;
      if (before && wholeMove(u, before)) return;
      n.kids.forEach(function(k) {
        if (!inBox(boxOf(k), b)) return;
        var e = extOf(k, boxOf(k));
        x02 = Math.min(x02, e[0]);
        y02 = Math.min(y02, e[1]);
        x1 = Math.max(x1, e[2]);
        y1 = Math.max(y1, e[3]);
      });
      if (x02 === Infinity) return;
      var need = [x02 - b[0], y02 - b[1] - n.lab.t, b[0] + b[2] - x1, b[1] + b[3] - y1 - n.lab.b].map(function(v, j) {
        return v - n.ins[j];
      });
      var ins = n.ins.map(function(v, j) {
        return need[j] < 0 ? Math.max(v + need[j], 0) : null;
      }), bins = need.map(function(v) {
        return Math.max(v, 0);
      });
      insetsOf(n.id, ins, bins);
    });
    if (shared.text !== t0) parse();
  }
  function wholeMove(u, before) {
    var b0 = before[nodes2[u].id], b = boxOf(u);
    if (!b0) return false;
    var dx = b[0] - b0[0], dy = b[1] - b0[1], same2 = function(k) {
      var p = before[nodes2[k].id], q = boxOf(k), e = 1e-6;
      return !!p && Math.abs(q[0] - p[0] - dx) < e && Math.abs(q[1] - p[1] - dy) < e && Math.abs(q[2] - p[2]) < e && Math.abs(q[3] - p[3]) < e;
    };
    return same2(u) && nodes2[u].kids.every(same2);
  }
  function insetsOf(id, ins, bins) {
    setText(import_graphml_edit.default.insets(shared.text, id, ins, bins));
  }
  function setBoxes(nb) {
    var at2 = {};
    Object.keys(nb).forEach(function(k) {
      at2[nodes2[+k].ag] = nb[k].map(fmt);
    });
    if (!Object.keys(at2).length) return;
    setText(import_graphml_edit.default.boxes(shared.text, at2));
    parse();
    shared.dirty = true;
  }
  function regroup(how, set, B, B0) {
    return hm().regroup(how, set, B, B0);
  }
  function stackComps(ids, before, always) {
    var S = shared.F.stackComp;
    if (!S || !full()) return;
    var t2 = shared.text, at2 = {};
    nodes2.forEach(function(n, i) {
      at2[n.id] = i;
    });
    var part = function(a, b) {
      var ix = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), iy = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
      var holds2 = function(p, q) {
        return p[0] <= q[0] && p[1] <= q[1] && p[0] + p[2] >= q[0] + q[2] && p[1] + p[3] >= q[1] + q[3];
      };
      return ix > 0 && iy > 0 && !holds2(a, b) && !holds2(b, a);
    };
    var asWas = function(i) {
      var b1 = boxOf(i), b0 = before && before[nodes2[i].id];
      if (!b0 || Math.abs(b0[2] - b1[2]) > 1e-6 || Math.abs(b0[3] - b1[3]) > 1e-6) return false;
      return nodes2.every(function(n, j) {
        if (j === i || !n.comp) return true;
        var c1 = boxOf(j), c0 = before[n.id] || c1;
        return part(b1, c1) === part(b0, c0);
      });
    };
    ids.forEach(function(id) {
      var i = at2[id];
      if (i != null && nodes2[i].comp && ((always || []).indexOf(id) >= 0 || !asWas(i))) t2 = S(t2, id);
    });
    if (t2 === shared.text) return;
    var keep = shared.selN.map(function(i) {
      return nodes2[i].id;
    });
    setText(t2);
    parse();
    shared.dirty = true;
    shared.selN = [];
    nodes2.forEach(function(n, i) {
      if (keep.indexOf(n.id) >= 0) shared.selN.push(i);
    });
  }
  function settle(out, arg, done, refused) {
    var moves = [], at2 = {};
    nodes2.forEach(function(n, i) {
      at2[n.id] = i;
    });
    out.forEach(function(t, i) {
      moves.push([nodes2[i].id, t == null ? null : nodes2[t].id]);
    });
    var why = moves.length && shared.F.nestWhy ? shared.F.nestWhy(moves) : null;
    if (why) return refused(why);
    var jp = arg.join && arg.join.length ? joinPlan(arg.join, moves.map(function(m) {
      return m[0];
    })) : { joins: [], why: "" };
    if (jp.why) return refused(jp.why);
    var leftComplex = function() {
      var sel = shared.selN.map(function(i) {
        return nodes2[i].id;
      });
      if (!shared.F.leave || !shared.F.leave(moves)) return;
      parse();
      shared.dirty = true;
      var ix = {};
      nodes2.forEach(function(n, i) {
        ix[n.id] = i;
      });
      shared.selN = sel.filter(function(id) {
        return ix[id] != null;
      }).map(function(id) {
        return ix[id];
      });
    };
    var rest = function() {
      leftComplex();
      var cids = joinDo(jp.joins);
      var grew = [];
      if (arg.grow && arg.grow.length) {
        var idx = {}, mvd = {};
        nodes2.forEach(function(n, i) {
          idx[n.id] = i;
        });
        (arg.moving || []).forEach(function(id) {
          mvd[id] = 1;
        });
        var gb = grown(
          arg.grow.map(function(id) {
            return idx[id];
          }).filter(function(i) {
            return i != null;
          }),
          boxOf,
          function(k) {
            return arg.before && arg.before[nodes2[k].id] || boxOf(k);
          },
          function(k) {
            return !!mvd[nodes2[k].id];
          },
          arg.away
        );
        Object.keys(gb || {}).forEach(function(k) {
          if (nodes2[+k]) grew.push(nodes2[+k].id);
        });
        setBoxes(gb);
      }
      stackComps((arg.moving || []).concat(moves.map(function(m) {
        return m[0];
      }), grew), arg.before, moves.map(function(m) {
        return m[0];
      }));
      refit((arg.moving || []).concat(moves.map(function(m) {
        return m[0];
      })), arg.before);
      done();
      joinPack(cids);
    };
    if (!moves.length) return rest();
    var t0 = shared.text;
    sbpy().then(function(N) {
      if (shared.text !== t0) return;
      var t2 = shared.text, left = moves.slice();
      for (var r = 0; left.length && r <= moves.length; r++) left = left.filter(function(m) {
        try {
          t2 = N.moveInto(t2, [m]);
          return false;
        } catch (e) {
          return true;
        }
      });
      if (left.length) {
        warn("Not regrouped: " + left.map(function(m) {
          return m[0];
        }).join(", "));
        return rest();
      }
      var ids = shared.selN.map(function(i) {
        return nodes2[i].id;
      }), es = shared.selE.map(function(k) {
        return edges2[k].id;
      });
      var ps = shared.selP.map(function(pi) {
        var k = edges2.findIndex(function(e) {
          return e.pts.indexOf(pi) >= 0;
        });
        return k < 0 ? null : [edges2[k].id, edges2[k].pts.indexOf(pi)];
      });
      setText(t2);
      parse();
      shared.dirty = true;
      shared.part = null;
      var byN = {}, byE = {};
      nodes2.forEach(function(n, i) {
        byN[n.id] = i;
      });
      edges2.forEach(function(e, k) {
        byE[e.id] = k;
      });
      shared.selN = ids.filter(function(id) {
        return byN[id] != null;
      }).map(function(id) {
        return byN[id];
      });
      shared.selE = es.filter(function(id) {
        return byE[id] != null;
      }).map(function(id) {
        return byE[id];
      });
      shared.selP = ps.filter(function(x) {
        return x && byE[x[0]] != null && edges2[byE[x[0]]].pts[x[1]] != null;
      }).map(function(x) {
        return edges2[byE[x[0]]].pts[x[1]];
      });
      rest();
    }).catch(function(e) {
      warn("Not regrouped: " + (e && e.message || e));
      rest();
    });
  }
  function handleAt(P, only) {
    var hs = Math.max(HANDLE / 2, 4 / V.z), best = null;
    shared.selN.forEach(function(i) {
      if (!(only ? sizable(i) : nodes2[i].comp || sizable(i)) || best) return;
      var b = bx(i), off = 3.3, L = b[0] - off, Tp = b[1] - off, R = b[0] + b[2] + off, B = b[1] + b[3] + off;
      [[L, Tp, "lt"], [(L + R) / 2, Tp, "t"], [R, Tp, "rt"], [L, (Tp + B) / 2, "l"], [R, (Tp + B) / 2, "r"], [L, B, "lb"], [(L + R) / 2, B, "b"], [R, B, "rb"]].forEach(function(q) {
        if (!best && Math.abs(P[0] - q[0]) <= hs && Math.abs(P[1] - q[1]) <= hs) best = { c: i, s: q[2] };
      });
    });
    return best;
  }
  function edgeAt(P, any) {
    var T = 5 / V.z, best = handleAt(P);
    if (best) return best;
    nodes2.forEach(function(n, i) {
      if (!n.comp || !any && shared.selN.indexOf(i) < 0) return;
      var b = bx(i);
      if (P[0] < b[0] - T || P[0] > b[0] + b[2] + T || P[1] < b[1] - T || P[1] > b[1] + b[3] + T) return;
      var s = (Math.abs(P[0] - b[0]) <= T ? "l" : Math.abs(P[0] - b[0] - b[2]) <= T ? "r" : "") + (Math.abs(P[1] - b[1]) <= T ? "t" : Math.abs(P[1] - b[1] - b[3]) <= T ? "b" : "");
      if (s && (!best || b[2] * b[3] < best.area)) best = { c: i, s, area: b[2] * b[3] };
    });
    return best;
  }
  function resizeCursor(s) {
    return s === "l" || s === "r" ? "ew-resize" : s === "t" || s === "b" ? "ns-resize" : s === "lt" || s === "rb" ? "nwse-resize" : "nesw-resize";
  }
  function resized(d, P, snapOn) {
    var b = d.rs.b0, s = d.rs.s, x02 = b[0], y02 = b[1], x1 = b[0] + b[2], y1 = b[1] + b[3], dx = P[0] - d.x, dy = P[1] - d.y;
    var g = function(v) {
      return snapOn ? Math.round(v / gridSet.step) * gridSet.step : Math.round(v);
    };
    if (/l/.test(s)) x02 = g(x02 + dx);
    if (/r/.test(s)) x1 = g(x1 + dx);
    if (/t/.test(s)) y02 = g(y02 + dy);
    if (/b/.test(s)) y1 = g(y1 + dy);
    if (!full()) {
      var kp = hm().keepMembers(d.rs.c, b, [x02, y02, x1, y1]);
      x02 = kp[0];
      y02 = kp[1];
      x1 = kp[2];
      y1 = kp[3];
    }
    if (x1 - x02 < 30) {
      if (/l/.test(s)) x02 = x1 - 30;
      else x1 = x02 + 30;
    }
    if (y1 - y02 < 30) {
      if (/t/.test(s)) y02 = y1 - 30;
      else y1 = y02 + 30;
    }
    return [x02, y02, x1 - x02, y1 - y02];
  }
  function sized(d, P, free) {
    var b = d.rs.b0, s = d.rs.s, st = gridSet.step, dx = P[0] - d.x, dy = P[1] - d.y;
    var size = function(v) {
      return free ? Math.max(4, Math.round(v * 100) / 100) : Math.max(st, Math.round(v / st) * st);
    };
    var w = /[lr]/.test(s) ? size(b[2] + (/l/.test(s) ? -dx : dx)) : b[2], h = /[tb]/.test(s) ? size(b[3] + (/t/.test(s) ? -dy : dy)) : b[3];
    return [/l/.test(s) ? b[0] + b[2] - w : b[0], /t/.test(s) ? b[1] + b[3] - h : b[1], w, h];
  }
  function holds(i) {
    return !!nodes2[i].comp || nodes2[i].kids.length > 0;
  }
  function roomy(i, b, s, b0) {
    return hm().roomy(i, b, s, b0);
  }
  function pt(pi) {
    var p = points[pi], o = mv && mv.p.has(pi);
    return [num(p, "x") + (o ? mv.dx : 0), num(p, "y") + (o ? mv.dy : 0)];
  }
  function bendGuides(bp) {
    if (bp == null) {
      if (shared.selP.length !== 1 || shared.selN.length || shared.selE.length) return null;
      bp = shared.selP[0];
    }
    var k = -1, j = -1, out = [];
    edges2.forEach(function(e, i) {
      var at2 = e.pts.indexOf(bp);
      if (at2 >= 0) {
        k = i;
        j = at2 + 1;
      }
    });
    if (k < 0 || edges2[k].s == null || edges2[k].t == null) return null;
    var all = ports(k), B = all[j];
    [beyond(k, j - 1, all)[0], beyond(k, j + 1, all)[0]].forEach(function(q) {
      if (Math.abs(q[0] - B[0]) < 0.01 || Math.abs(q[1] - B[1]) < 0.01) out.push([B, q]);
    });
    out = out.concat(joinGuides(bp, B));
    return out.length ? out : null;
  }
  function keyAlign(bp, d, ms) {
    var k = -1, j = -1;
    edges2.forEach(function(e, i) {
      var at2 = e.pts.indexOf(bp);
      if (at2 >= 0) {
        k = i;
        j = at2 + 1;
      }
    });
    if (k < 0 || edges2[k].s == null || edges2[k].t == null) return d;
    var all = ports(k), B = all[j], out = d.slice();
    [j - 1, j + 1].forEach(function(i) {
      var nb = beyond(k, i, all), pi = nb[1];
      if (pi != null && ms.has(pi)) return;
      [0, 1].forEach(function(a) {
        if (!d[a]) return;
        var q = nb[0][a], from = B[a], to = B[a] + d[a];
        if (Math.abs(q - from) > 0.01 && (q - from) * (q - to) <= 0 && Math.abs(q - from) < Math.abs(out[a])) out[a] = q - from;
      });
    });
    glyphArcs(bp).forEach(function(o) {
      [0, 1].forEach(function(a) {
        if (!d[a]) return;
        [0, 1].forEach(function(cm) {
          var J = joinAt(o, bp, B), B2 = B.slice();
          B2[a] += d[a];
          var J2 = joinAt(o, bp, B2), r0 = J[0][cm] - J[1][cm], r1 = J2[0][cm] - J2[1][cm];
          if (Math.abs(r0) < 0.05 || r0 * r1 > 0) return;
          var c = joinSolve(o, bp, B, a, cm);
          if (c != null && c * d[a] > 0 && Math.abs(c) <= Math.abs(d[a]) + 1e-6 && Math.abs(c) < Math.abs(out[a])) out[a] = c;
        });
      });
    });
    return out;
  }
  function move(dx, dy, sets) {
    if (!dx && !dy) return;
    sets = sets || moving();
    var all = sets.n, ps = sets.p;
    var g = {}, p = {};
    all.forEach(function(i) {
      nodes2[i].geo.forEach(function(gi) {
        var el = geos[gi], v = [fmt(num(el, "x") + dx), fmt(num(el, "y") + dy)];
        g[gi] = v;
        el.setAttribute("x", v[0]);
        el.setAttribute("y", v[1]);
      });
    });
    ps.forEach(function(pi) {
      var el = points[pi], v = [fmt(num(el, "x") + dx), fmt(num(el, "y") + dy)];
      p[pi] = v;
      el.setAttribute("x", v[0]);
      el.setAttribute("y", v[1]);
    });
    write(g, p);
    shared.dirty = true;
  }
  function delta(from, to) {
    var a = 0, n = Math.min(from.length, to.length);
    while (a < n && from.charCodeAt(a) === to.charCodeAt(a)) a++;
    var b = 0;
    while (b < n - a && from.charCodeAt(from.length - 1 - b) === to.charCodeAt(to.length - 1 - b)) b++;
    var fl = from.slice(a, from.length - b).split("\n"), tl = to.slice(a, to.length - b).split("\n"), d = { a, b, len: to.length };
    if (fl.length === tl.length) {
      var at2 = [], lines = [];
      for (var i = 0; i < tl.length; i++) if (fl[i] !== tl[i]) {
        at2.push(i);
        lines.push(tl[i]);
      }
      d.at = at2;
      d.lines = JSON.parse(JSON.stringify(lines));
    } else d.mid = JSON.parse(JSON.stringify(to.slice(a, to.length - b)));
    return d;
  }
  function rebuild(d, from) {
    if (typeof d === "string" || d.g != null) return d;
    if (d.pg) return { g: rebuild(d.pg, from.g), b: rebuild(d.pb, from.b) };
    var mid;
    if (d.at) {
      mid = from.slice(d.a, from.length - d.b).split("\n");
      d.at.forEach(function(i, j) {
        mid[i] = d.lines[j];
      });
      mid = mid.join("\n");
    } else mid = d.mid;
    var t = from.slice(0, d.a) + mid + from.slice(from.length - d.b);
    if (t.length !== d.len) throw "undo history broken";
    return t;
  }
  function sizeOf(d) {
    if (d.g != null) return d.g.length + d.b.length;
    if (d.pg) return sizeOf(d.pg) + sizeOf(d.pb);
    return typeof d === "string" ? d.length : d.at ? d.lines.reduce(function(k, l) {
      return k + l.length + 8;
    }, 0) : d.mid.length;
  }
  var shiftSum;
  var tookShift;
  function __run173() {
    shiftSum = [0, 0], tookShift = null;
  }
  function rebase(dx, dy) {
    shiftSum = [shiftSum[0] + dx, shiftSum[1] + dy];
    x0 += dx;
    y0 += dy;
  }
  function step(stack, t, fresh) {
    var top = stack.length - 1, rs = stack.rb || (stack.rb = []), ts = stack.ts || (stack.ts = []);
    if (rs.length !== stack.length) rs = stack.rb = stack.map(function() {
      return null;
    });
    if (ts.length !== stack.length) ts = stack.ts = stack.map(function() {
      return 0;
    });
    rs.push(shiftSum);
    ts.push(V.tick(fresh));
    if (top >= 0) {
      var o = stack[top];
      stack[top] = typeof t === "string" && typeof o === "string" ? delta(t, o) : t.g != null && o.g != null ? { pg: delta(t.g, o.g), pb: delta(t.b, o.b) } : o;
    }
    stack.push(t);
    for (var k = 0, i = stack.length - 1; i >= 0; i--) {
      k += sizeOf(stack[i]);
      if (k > 4e7 || stack.length - i > 200) {
        stack.splice(0, i + 1);
        rs.splice(0, i + 1);
        ts.splice(0, i + 1);
        break;
      }
    }
  }
  function take(stack) {
    tookShift = stack.rb && stack.rb.length === stack.length ? stack.rb.pop() : null;
    if (stack.ts && stack.ts.length === stack.length) stack.ts.pop();
    var t = stack.pop(), top = stack.length - 1;
    if (top >= 0) stack[top] = rebuild(stack[top], t);
    return t;
  }
  function undoText() {
    return shared.F.undoKeep ? shared.F.undoKeep() : shared.text;
  }
  function fromUndo(t) {
    if (tookShift) {
      x0 += tookShift[0] - shiftSum[0];
      y0 += tookShift[1] - shiftSum[1];
      shiftSum = tookShift;
      tookShift = null;
    }
    if (typeof t === "string") return t;
    return shared.F.undoPut ? shared.F.undoPut(t) : t.g;
  }
  function unpush() {
    return fromUndo(take(undo));
  }
  var hist;
  var histKey;
  var openKey;
  var histLast;
  var edits;
  function __run183() {
    hist = {}, histKey = null, openKey = null, histLast = null, edits = 0;
  }
  function histKeep() {
    if (!histKey) return;
    var id = histKey;
    histKey = null;
    delete hist[id];
    histLast = null;
    if (undo.length || shared.redo.length) {
      var h = hist[id] = { undo, redo: shared.redo, u: undoText(), src: src(), shift: shiftSum, base: baseKeep(), size: 0 };
      h.size = sizeOf(h.u) + h.src.length + h.undo.concat(h.redo).reduce(function(k, d) {
        return k + sizeOf(d);
      }, 0);
      histLast = { id, h, site };
      var ids = Object.keys(hist), sum = ids.reduce(function(k, i2) {
        return k + hist[i2].size;
      }, 0);
      for (var i = 0; sum > 4e7 && i < ids.length; i++) {
        sum -= hist[ids[i]].size;
        delete hist[ids[i]];
      }
    }
    undo = [];
    shared.redo = [];
  }
  function histLate() {
    var L = histLast;
    if (!on && L && L.site === site && hist[L.id] === L.h) {
      L.h.src = src();
      L.h.u = undoText();
      L.h.shift = shiftSum;
    }
  }
  function histBack() {
    var L = histLast;
    if (!L || hist[L.id] !== L.h) return;
    delete hist[L.id];
    histKey = L.id;
    histLast = null;
    undo = L.h.undo;
    shared.redo = L.h.redo;
  }
  function histTake(t, g0) {
    var id = openKey && openKey.tk === opening ? openKey.id : null, h = id && hist[id];
    openKey = null;
    histKey = id;
    if (!h || h.src !== t) return;
    delete hist[id];
    histLast = null;
    try {
      basePut(h.base);
      var g = fromUndo(h.u);
      if (g !== shared.text) {
        setText(g);
        parse();
      }
      undo = h.undo;
      shared.redo = h.redo;
      shiftSum = h.shift;
    } catch (e) {
      undo = [];
      shared.redo = [];
      if (shared.text !== g0) {
        setText(g0);
        parse();
      }
    }
  }
  function commit(t2, o) {
    o = o || {};
    if (!o.write && t2 === shared.text) return false;
    remember(!!o.merge);
    if (o.write) o.write();
    else setText(t2);
    if (!o.parsed) parse();
    if (o.then) o.then();
    if (o.reparse) parse();
    if (o.sel || o.selE) {
      var n = o.sel || [], e = o.selE || [];
      shared.selN = [];
      shared.selP = [];
      shared.selE = [];
      shared.part = null;
      nodes2.forEach(function(q, i) {
        if (n.indexOf(q.id) >= 0) shared.selN.push(i);
      });
      edges2.forEach(function(q, k) {
        if (e.indexOf(q.id) >= 0) shared.selE.push(k);
      });
    }
    shared.dirty = true;
    shared.lastChange = { name: o.name || "change", ids: [].concat(o.ids || o.sel || [], o.ids ? [] : o.selE || []) };
    if (o.quiet) quiet();
    render();
    paint();
    changed();
    return true;
  }
  function remember(merge) {
    var now = Date.now();
    if (!(merge && now - nudgeAt < 800)) {
      step(undo, undoText(), true);
      shared.redo = [];
    } else if (undo.ts && undo.ts.length === undo.length && undo.length) undo.ts[undo.ts.length - 1] = V.tick(true);
    nudgeAt = merge ? now : 0;
  }
  function mapTop(back2) {
    var s = back2 ? undo : shared.redo;
    return on && V.current === map && s.length && s.ts && s.ts.length === s.length ? s.ts[s.ts.length - 1] : 0;
  }
  function back(from, to) {
    if (!from.length) return;
    var t;
    try {
      t = take(from);
    } catch (e) {
      from.length = 0;
      from.rb = [];
      from.ts = [];
      tookShift = null;
      warn("Undo history lost: " + e + ".");
      return;
    }
    clearTimeout(timer);
    keyDue = null;
    keyRun = null;
    var was = undoText(), selN = shared.selN.map(function(i) {
      return nodes2[i] && nodes2[i].id;
    }), selE = shared.selE.map(function(k) {
      return edges2[k] && edges2[k].id;
    });
    step(to, was);
    setText(fromUndo(t));
    shared.lastChange = { name: from === undo ? "undo" : "redo", ids: [] };
    nudgeAt = 0;
    shared.cdGate = null;
    parse(true);
    shared.selP = [];
    shared.part = null;
    shared.selN = [];
    nodes2.forEach(function(q, i) {
      if (selN.indexOf(q.id) >= 0) shared.selN.push(i);
    });
    shared.selE = [];
    edges2.forEach(function(q, k) {
      if (selE.indexOf(q.id) >= 0) shared.selE.push(k);
    });
    shared.dirty = true;
    render();
    paint();
    changed();
  }
  function render() {
    var t = ++ticket;
    drawing = true;
    return shared.F.load().then(function(p) {
      var r;
      if (shared.F.redraw) r = shared.F.redraw(drawMemo);
      else {
        var sh = !drag && noNegative();
        if (sh) {
          parse();
          rebase(sh[0], sh[1]);
          var lc = shared.lastChange;
          shared.lastChange = { name: "shift", ids: lc ? lc.ids : [], shift: sh, after: lc ? lc.name : null };
        }
        r = drawMemo && drawMemo.r && drawMemo.text === shared.text && !shared.afSbgn ? drawMemo.r : drawGraphml(shared.text);
      }
      if (t !== ticket) return;
      drawing = false;
      showDrawing(r);
    }).catch(function(e) {
      if (t === ticket) {
        drawing = false;
        warn("Not drawn: " + (e && e.message ? e.message.split("\n").slice(-2).join(" ") : e));
      }
    });
  }
  function showDrawing(r) {
    if (r[1].length) warn("Drawn with warnings: " + r[1].join("; "));
    var svg = r[0];
    lastSvg = svg;
    lastFor = [shared.text, shared.F.beside(), site && site.id, shared.afSbgn];
    if (!on && site && V.kept && V.kept.id === site.id && V.kept.text != null) {
      V.kept.text = src();
      V.kept.svg = svg;
    }
    if (!on && site && unsaved[site.id] && unsaved[site.id].site === site) unsaved[site.id].text = src();
    histLate();
    var m = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/);
    var w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
    var nx = -parseFloat(m[1]), ny = -parseFloat(m[2]), first = !map.width;
    if (!first) {
      V.tx += (nx - x0) * V.z;
      V.ty += (ny - y0) * V.z;
    }
    x0 = nx;
    y0 = ny;
    map.width = parseFloat(w[1]);
    map.height = parseFloat(w[2]);
    (function() {
      if (V.current !== map) return;
      var rec = V.recolour(svg), dm = drawMemo && drawMemo.pic && drawMemo.rec === rec ? drawMemo : null;
      var pic = dm ? dm.pic : document.importNode(new DOMParser().parseFromString(rec, "image/svg+xml").documentElement, true);
      if (dm) dm.pic = null;
      pic.style.visibility = "";
      var old = V.img.src || "";
      V.img.removeAttribute("id");
      pic.id = "m2-img";
      pic.setAttribute("aria-label", map.title);
      V.img.replaceWith(pic);
      V.img = pic;
      if (old.indexOf("blob:") === 0) URL.revokeObjectURL(old);
      gN = {};
      gE = {};
      resetDrawing();
      pic.querySelectorAll("[data-n]").forEach(function(g) {
        gN[g.getAttribute("data-n")] = g;
      });
      pic.querySelectorAll("[data-e]").forEach(function(g) {
        var k = g.getAttribute("data-e");
        (gE[k] = gE[k] || []).push(g);
      });
      if (shared.F.drawn) shared.F.drawn();
      if (first) V.fit();
      else V.draw();
      if (!r[1].length && !saveTimer && !saving && !shared.dirty) {
        if (takenIn) {
          openSaid = takenIn;
          takenIn = null;
        }
        if (openSaid && !undo.length) warn(openSaid);
        else {
          openSaid = null;
          quiet();
        }
        sayOpen();
      }
    })();
  }
  function adopt(svg) {
    ++ticket;
    drawing = false;
    showDrawing([svg, []]);
  }
  var opening;
  function __run193() {
    opening = 0;
  }
  function start(t, n, h, s, same2, g0) {
    if (shared.typing) shared.typing.done(true);
    if (localTimer) local(true);
    var tk = opening, still = function() {
      return tk === opening;
    };
    var F = formatOfText(t) || formats.graphml, o = F.open(t, g0, still);
    var go = function(o2) {
      if (!o2 || !still()) return;
      var sh = F.ownFrame ? null : shiftAhead(o2.g), moved = sh ? [sh[0] ? sh[0] + " right" : "", sh[1] ? sh[1] + " down" : ""].filter(Boolean).join(" and ") : "";
      openSaid = null;
      takenIn = [o2.said, moved ? "Everything moved " + moved + ", as a map here has no negative places." : ""].filter(Boolean).join(" ") || null;
      begin(o2.g, o2.t, n, h, s, o2.redraw ? null : same2, o2.t0 || null, F, o2.own);
    };
    if (!o.then) return go(o);
    quiet();
    return o.then(go).catch(function(e) {
      if (still()) warn("Cannot edit " + n + ": " + e);
    });
  }
  var takenIn;
  var openSaid;
  function __run204() {
    takenIn = null;
    openSaid = null;
  }
  function begin(g, t, n, h, s, same2, t0, F, own2) {
    var was = takeMap();
    resetMap();
    shared.F = F;
    if (own2) putMap(own2);
    layout();
    sbpy();
    try {
      setText(g);
      parse();
    } catch (e) {
      putMap(was);
      try {
        parse();
      } catch (e2) {
      }
      warn("Cannot edit " + n + ": " + e);
      return;
    }
    siteRef = null;
    name = n;
    handle = h;
    site = s || null;
    t0 = t0 || t;
    if (site) {
      site.base = site.pending && site.pub != null ? site.pub : t0;
      site.fromDraft = t0 !== site.base;
    }
    if (site) {
      site.known = site.mine ? mine[site.id] ? mine[site.id].text : null : V.drafts[site.id] ? V.drafts[site.id].text : null;
      site.clashed = false;
    }
    if (site && site.pending && canFolder && V.folderName()) folderCheck();
    stuck = false;
    undo = [];
    histTake(F.asRead ? t0 : t, g);
    edits = 0;
    if (reSel && V.chosen && reSel.map === V.chosen.id) {
      nodes2.forEach(function(n2, i) {
        if (reSel.n.indexOf(n2.id) >= 0) shared.selN.push(i);
      });
      edges2.forEach(function(a, i) {
        if (reSel.e.indexOf(a.id) >= 0) shared.selE.push(i);
      });
    }
    reSel = null;
    reGh = null;
    map = {
      id: "edit",
      title: openTitle || n,
      width: 0,
      height: 0,
      scale: 1,
      downloads: [],
      colours: true,
      // drawn with the role classes (drawing.js, V.recolour): Settings' Map colours offered while editing
      layoutOnly: !!(V.chosen && (V.chosen.site || V.chosen).layoutOnly)
    };
    if (same2) {
      map.width = same2.width;
      map.height = same2.height;
      map.scale = same2.scale;
      x0 = same2.x0;
      y0 = same2.y0;
    }
    V.current = map;
    on = true;
    goodNow();
    editLock(site && site.id);
    if (shared.F.opened) shared.F.opened();
    V.nodes = null;
    V.sel = null;
    V.renderInfo();
    V.drawPin();
    document.getElementById("m2-title").textContent = n;
    V.grid.classList.add("m2-editing");
    buttons();
    gN = gE = null;
    mv = null;
    if (same2 && same2.text === (F.asRead ? t0 : t)) {
      var grouped = same2.svg && same2.svg.indexOf(' data-n="') >= 0;
      shared.F.load().then(function() {
        if (on && V.current === map && !edits && !gN && !grouped) render();
      });
      quiet();
      if (grouped) adopt(same2.svg);
      paint();
      sayOpen();
      shownWhole();
      return;
    }
    quiet();
    sayOpen();
    render();
    shownWhole();
  }
  function shownWhole() {
    if (window.m2Shown) window.m2Shown();
  }
  function stop() {
    if (shared.typing) shared.typing.done(true);
    if (!on) return;
    keyFlush();
    if (saveTimer) push();
    editUnlock();
    leftMoves = { site, n: undo.length };
    var moved = undo.length > 0 || edits > 0;
    histKeep();
    var kpic = V.img;
    if (shared.afSbgn && shared.F.afView) {
      shared.afSbgn = false;
      var pl = drawGraphml(shared.text);
      lastSvg = pl[0];
      lastFor = [shared.text, null, site && site.id, false];
      kpic = new Promise(function(res) {
        var im = new Image();
        im.onload = function() {
          res(im);
        };
        im.onerror = function() {
          res(V.img);
        };
        im.src = URL.createObjectURL(new Blob([V.recolour(pl[0])], { type: "image/svg+xml" }));
      });
    }
    if (site && site.id && moved && !site.clashed)
      V.kept = { sites: V.sites, id: site.id, v: site.v, sha: site.sha, pic: kpic, width: map.width, height: map.height, x0: picX0(), y0: picY0(), text: src(), svg: nowSvg(), file: name, ref: siteRef, cur: nowRef(), draft: !!site.pending && !site.mine, mine: !!site.mine };
    if (helpBox) help(false);
    on = false;
    drag = null;
    band = null;
    V.grid.classList.remove("m2-editing");
    paint();
    buttons();
    if (site && site.mine && !localTimer) V.refreshMine();
    if (shared.dirty && !site) warn(name + " has moves not saved: Back to it, or Save.");
    else quiet();
    if (site && site.id && !site.pending && !stuck && shared.dirty && token()) {
      unsaved[site.id] = { id: site.id, name, site, text: src() };
      leftLater(unsaved[site.id]);
    } else leftSay();
    drawMemo = null;
    preDoc = [];
    if (!keepAhead()) forget(editPre && editPre.id);
    aheadSoon();
  }
  function leftLater(u) {
    if (unsaved[u.id] !== u) return leftSay();
    if (on) return;
    if (drawing || saveTimer || saving) {
      setTimeout(function() {
        leftLater(u);
      }, 300);
      return;
    }
    if (stuck || site === u.site && !shared.dirty) {
      delete unsaved[u.id];
      return leftSay();
    }
    if (site === u.site) u.text = src();
    leftSay();
  }
  function leftSay() {
    waitShow();
  }
  function ghKnown(s) {
    return stuck || !s || !s.sha || shared.dirty && site === s ? null : { sha: s.sha, text: s.saved || s.base };
  }
  function keepAhead() {
    var s = site, m = s && s.id ? V.byId[s.id] : null, old = editPre;
    if (!m || !old || stuck || s.pending || old.key !== preKey(m)) return false;
    var p = { key: old.key, id: old.id, path: old.path, file: old.file, img: old.img, sitePub: old.sitePub, siteFrame: old.siteFrame, base: old.base, F: old.F, kept: s };
    p.gh = (saving || Promise.resolve()).then(function() {
      var k = ghKnown(s);
      if (!k) throw "not saved";
      return k;
    }).catch(function() {
      return ghRead(p.path);
    });
    p.gh.catch(function() {
      if (bank[p.id] === p) forget(p.id);
    });
    p.sitePub.catch(function() {
    });
    bank[p.id] = p;
    var S = src(), g = shared.text, d0 = doc, el = V.img, svg = lastSvg;
    if (!(svg && !drawing && !mv && !shared.keyed && !shared.liveC && docText === g && lastFor && !lastFor[3] && lastFor[0] === g && lastFor[1] === shared.F.beside())) return true;
    var kept = shared.F.ahead.keeper ? shared.F.ahead.keeper() : null, make = function() {
      var dm = kept && kept(S, g, svg) || { cd: false, text: g, r: [svg, []] };
      p.memo = dm;
      p.docs = [{ text: g, doc: d0 }];
      p.drawn = Promise.resolve();
      if (el === V.img && el.tagName.toLowerCase() === "svg" && el.querySelector("[data-e]")) {
        el.querySelectorAll(".m2-ed-copy").forEach(function(x) {
          x.remove();
        });
        el.querySelectorAll("[data-n],[data-e]").forEach(function(x) {
          x.removeAttribute("transform");
          x.style.display = "";
          x.classList.remove("m2-ed-blue");
        });
        dm.rec = V.recolour(svg);
        dm.pic = el;
        return;
      }
      idle().then(function() {
        if (p.memo !== dm || on) return;
        dm.rec = V.recolour(svg);
        dm.pic = document.importNode(new DOMParser().parseFromString(dm.rec, "image/svg+xml").documentElement, true);
      });
    };
    if (!shared.dirty && !saving && S === (s.saved || s.base)) make();
    else p.gh.then(function(r) {
      if (r && r.text === S && bank[p.id] === p && !on) make();
    }, function() {
    });
    return true;
  }
  function buttons() {
    ["#m2-ed-save", "#m2-ed-undo", "#m2-ed-redo", "#m2-ed-grid", "#m2-ed-snap", "#m2-ed-tidy-grid", "#m2-ed-tidy-pack", "#m2-ed-help"].forEach(function(k) {
      box2.querySelector(k).disabled = !on;
    });
    box2.querySelector("#m2-ed-save").hidden = !!site;
    ghForm(!!(on && site && !site.mine && !token()));
    localBox();
    box2.querySelector("#m2-ed-back").hidden = on || !shared.text;
    box2.querySelector("#m2-ed-back").textContent = "Back to " + name;
    box2.querySelector("#m2-ed-stop").hidden = !on;
    var g = V.current && V.current.binned ? null : graphmlOf(V.current);
    box2.querySelector("#m2-ed-this").hidden = on || !g;
    var off = !on && !(shared.dirty && !site) && !g;
    V.grid.classList.toggle("m2-edit-off", off);
    if (off && V.win === "edit" && V.current && !shared.switching && !V.editRight) {
      V.win = "list";
      V.railMark();
    }
  }
  function graphmlOf(m) {
    var d = m && m.downloads && m.downloads[0];
    return d && formatOfMap(m) ? d.url : null;
  }
  function save() {
    if (!shared.text) return;
    if (site) {
      if (site.pending) {
        if (localTimer) local();
      } else if (token()) push();
      return;
    }
    var blob = new Blob([src()], { type: "application/xml" });
    var done = function() {
      shared.dirty = false;
      quiet();
    };
    var into = function(h) {
      return h.createWritable().then(function(w) {
        return w.write(blob).then(function() {
          return w.close();
        });
      }).then(done);
    };
    if (handle) return into(handle).catch(function(e) {
      warn("Not saved: " + e.message);
    });
    if (window.showSaveFilePicker) {
      return window.showSaveFilePicker({ suggestedName: name, types: [shared.F.fileType] }).then(function(h) {
        handle = h;
        name = h.name;
        return into(h);
      }).catch(function(e) {
        if (e.name !== "AbortError") warn("Not saved: " + e.message);
      });
    }
    download();
    done();
  }
  var bank;
  var preTimer;
  var sweepT;
  var openTitle;
  var drawMemo;
  var preDoc;
  var editPre;
  function __run216() {
    bank = {}, preTimer = null, sweepT = 0, openTitle = null, drawMemo = null, preDoc = [], editPre = null;
  }
  function preKey(m) {
    return m.id + "|" + V.ver(m) + "|" + (repo() && token() ? "gh" : "");
  }
  function forget(id) {
    if (id && bank[id]) delete bank[id];
  }
  function ghRead(path) {
    if (!(repo() && token())) return Promise.resolve(void 0);
    return Promise.all([
      api("/contents/" + path + "?ref=main"),
      api("/contents/" + path + "?ref=main", { headers: { Accept: "application/vnd.github.raw" } })
    ]).then(function(r) {
      if (r[0].status === 404) return null;
      if (!r[0].ok) throw r[0].status;
      if (!r[1].ok) throw r[1].status;
      return Promise.all([r[0].json(), r[1].text()]).then(function(d) {
        return { sha: d[0].sha, text: d[1] };
      });
    });
  }
  var known;
  function __run225() {
    known = {};
  }
  function ghList() {
    if (shared.ghDir && Date.now() - shared.ghDir.at < 3e5) return shared.ghDir;
    shared.ghDir = { at: Date.now() };
    shared.ghDir.p = api("/contents/maps?ref=main").then(function(r) {
      return r.ok ? r.json() : null;
    }).then(function(d) {
      if (!Array.isArray(d) || d.length >= 1e3) return null;
      var o = {};
      d.forEach(function(f) {
        o[f.path] = f.sha;
      });
      return o;
    }).catch(function() {
      return null;
    });
    return shared.ghDir;
  }
  function learnt(path, sha) {
    known[path] = { sha, at: Date.now() };
  }
  function blobSha(t) {
    var u = new TextEncoder().encode(t), h = new TextEncoder().encode("blob " + u.length + "\0"), all = new Uint8Array(h.length + u.length);
    all.set(h);
    all.set(u, h.length);
    return crypto.subtle.digest("SHA-1", all).then(function(b) {
      return Array.from(new Uint8Array(b)).map(function(x) {
        return (x < 16 ? "0" : "") + x.toString(16);
      }).join("");
    });
  }
  function ghFor(path, sitePub) {
    if (!(repo() && token())) return Promise.resolve(void 0);
    if (reGh && reGh.path === path) {
      var r0 = reGh;
      reGh = null;
      return Promise.resolve({ sha: r0.sha, text: r0.text });
    }
    var L = ghList();
    return L.p.then(function(d) {
      if (!d || !window.crypto || !crypto.subtle) return ghRead(path);
      var k = known[path], sha = k && k.at >= L.at ? k.sha : d[path];
      if (!sha) return ghRead(path);
      return sitePub.then(blobSha).then(function(h) {
        return h === sha ? sitePub.then(function(t) {
          return { sha, text: t };
        }) : ghRead(path);
      }, function() {
        return ghRead(path);
      });
    });
  }
  function frameOf(p) {
    if (!p.siteFrame) p.siteFrame = fetch(p.img).then(function(r) {
      return r.text();
    }).then(function(svg) {
      var t = svg.match(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/), w = svg.match(/ width="([\d.]+)" height="([\d.]+)"/);
      return w ? { width: parseFloat(w[1]), height: parseFloat(w[2]), x0: t ? -parseFloat(t[1]) : 0, y0: t ? -parseFloat(t[2]) : 0, scale: 1, svg } : null;
    }).catch(function() {
      return null;
    });
    return p.siteFrame;
  }
  var idle;
  var lastInput;
  var mark;
  function __run235() {
    idle = function() {
      return new Promise(function(res) {
        (window.requestIdleCallback || function(f) {
          setTimeout(f, 0);
        })(res);
      });
    };
    lastInput = 0, mark = function() {
      lastInput = Date.now();
    };
    ["pointerdown", "wheel", "keydown", "touchstart"].forEach(function(k) {
      document.addEventListener(k, mark, { capture: true, passive: true });
    });
    document.addEventListener("pointermove", function(e) {
      if (e.buttons) mark();
    }, { capture: true, passive: true });
  }
  function calm() {
    return new Promise(function(res) {
      (function w() {
        var q = Date.now() - lastInput;
        if (q >= 1500) idle().then(res);
        else setTimeout(w, 1500 - q);
      })();
    });
  }
  function waitFor(m) {
    return V.current && V.current.id === m.id ? idle() : calm();
  }
  function ahead(m, low) {
    var url = graphmlOf(m), F = url && formatOfMap(m), A = F && F.ahead;
    if (!url) return null;
    var key = preKey(m), old = bank[m.id];
    if (old && old.key === key && (!old.bad || low && Date.now() - old.bad < 3e5)) return old;
    var file = url.split("?")[0].split("/").pop(), path = "maps/" + file;
    if (A.path) {
      path = A.path(m);
      file = path.split("/").pop();
    }
    var p = { key, id: m.id, path, file, img: m.image + V.ver(m), F };
    if (A.base) {
      p.base = A.base(m, low);
      p.base.catch(function() {
        p.bad = p.bad || Date.now();
      });
    }
    p.sitePub = fetch(url, { cache: "no-cache", priority: low ? "low" : "auto" }).then(function(r) {
      if (!r.ok) throw r.status;
      return r.text();
    });
    p.gh = m.mine ? Promise.resolve(null) : ghFor(path, p.sitePub);
    var drop = function() {
      p.bad = p.bad || Date.now();
    };
    p.sitePub.catch(drop);
    p.gh.catch(drop);
    bank[m.id] = p;
    return p;
  }
  function heldText(m) {
    var k = V.kept;
    return k && k.id === m.id && (k.draft || V.behind(m, k)) && k.text ? k.text : null;
  }
  function readyOf(p, m) {
    if (p.ready) return p.ready;
    var A = p.F.ahead, still = function() {
      return bank[m.id] === p && !on;
    };
    var r = p.ready = A.load().then(function() {
      return Promise.all([heldText(m) || p.sitePub, p.gh]);
    }).then(function(x) {
      p.t = x[1] ? x[1].text : x[0];
      if (!A.graphml) return p;
      return Promise.resolve(p.base || null).then(function(b) {
        if (p.base) p.b = b;
        return waitFor(m);
      }).then(function() {
        if (!still()) throw 0;
        p.g = A.graphml(p.t, p.b, V.current && V.current.id === m.id ? m.id : false);
        return p;
      });
    });
    r.catch(function() {
      if (p.ready === r) p.ready = null;
    });
    return r;
  }
  function drawAhead(p, m) {
    if (p.drawn) return p.drawn;
    var F = p.F, mine2 = {};
    var still = function() {
      return bank[m.id] === p && !on && p.drawn === mine2.p;
    };
    var rd = function(x) {
      return new DOMParser().parseFromString(x, "application/xml");
    };
    var g, d, g2, d2, dm;
    frameOf(p);
    mine2.p = p.drawn = readyOf(p, m).then(function() {
      if (!still()) throw 0;
      g = p.g || p.t;
      d = rd(g);
      g2 = F.ownFrame ? g : shiftedAhead(g, d);
      d2 = g2 === g ? d : rd(g2);
      p.docs = g2 === g ? [{ text: g, doc: d }] : [{ text: g, doc: d }, { text: g2, doc: d2 }];
      return waitFor(m);
    }).then(function() {
      return Promise.all([frameOf(p), p.sitePub]);
    }).then(function(x) {
      if (!still()) throw 0;
      var fr = x[0];
      if (fr && fr.svg && fr.svg.indexOf(' data-n="') >= 0 && p.t === x[1]) {
        dm = { cd: null, text: null, pic: null, own: fr.svg };
        p.memo = dm;
        return waitFor(m);
      }
      if (F.ahead.draw) dm = F.ahead.draw(p.t, g);
      else {
        var y = window.yrender.render(d2, { classes: true, groups: true, sbgn: !!F.ahead.sbgn });
        dm = { cd: false, text: g2, r: [y.svg, y.errors] };
      }
      p.memo = dm;
      return waitFor(m);
    }).then(function() {
      if (!still() || p.memo !== dm) throw 0;
      if (dm.own && dm.own.length >= 3e6) return;
      dm.rec = V.recolour(dm.own || (dm.q ? dm.q[0] : dm.r[0]));
      dm.pic = document.importNode(new DOMParser().parseFromString(dm.rec, "image/svg+xml").documentElement, true);
    });
    mine2.p.catch(function() {
      if (p.drawn === mine2.p) p.drawn = null;
    });
    return mine2.p;
  }
  function dropDrawing(p) {
    p.drawn = null;
    p.memo = null;
    p.docs = null;
  }
  function sweep() {
    var cur = V.current, t = ++sweepT, here2 = cur ? V.maps.indexOf(V.byId[cur.id]) : -1;
    if (here2 < 0) return;
    var list2 = V.maps.filter(function(m) {
      return graphmlOf(m);
    }).map(function(m, i2) {
      return [m, Math.abs(V.maps.indexOf(m) - here2), i2];
    }).sort(function(a, b) {
      return a[1] - b[1] || a[2] - b[2];
    }).map(function(x) {
      return x[0];
    });
    var near2 = list2.slice(0, 3);
    Object.keys(bank).forEach(function(id) {
      if (!V.byId[id]) delete bank[id];
      else if (!near2.some(function(m) {
        return m.id === id;
      })) dropDrawing(bank[id]);
    });
    var i = 0;
    var next = function() {
      if (t !== sweepT || on || i >= list2.length) return;
      var m = list2[i], bg = m.id !== cur.id;
      if (bg && V.netIdle && !V.netIdle()) {
        setTimeout(next, 500);
        return;
      }
      var go = function() {
        if (t !== sweepT || on) return;
        var p = ahead(m, bg);
        i++;
        (near2.indexOf(m) >= 0 ? drawAhead(p, m) : readyOf(p, m)).then(idle, idle).then(next);
      };
      if (bg) calm().then(go);
      else go();
    };
    next();
  }
  function aheadSoon() {
    clearTimeout(preTimer);
    sweepT++;
    preTimer = setTimeout(function() {
      idle().then(function() {
        var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
        if (on || !eb || !eb.offsetParent) return;
        sweep();
      });
    }, 300);
  }
  function editShown() {
    return editMap(V.current);
  }
  function editMap(m) {
    var url = graphmlOf(m);
    if (!url) return;
    if (!V.draftsDone()) {
      V.draftsIn.then(function() {
        setTimeout(shown, 0);
      });
      return;
    }
    if (shared.dirty && !site && !confirm(name + " has moves not saved. Edit this map instead?")) return;
    if (saveTimer) push();
    var tk = ++opening;
    openKey = { tk, id: m.id };
    var p = ahead(m), file = m.mine ? m.file : p.file, path = p.path;
    editPre = p;
    var k = V.keep(m), shownPic = V.img;
    var published = k && k.text ? Promise.resolve(k.text) : p.sitePub;
    var frame2 = k ? Promise.resolve({ width: k.width, height: k.height, x0: k.x0, y0: k.y0, scale: 1 }) : frameOf(p);
    var go = function(t, s) {
      return Promise.all([published, frame2, p.sitePub, frameOf(p)]).then(function(r) {
        if (tk !== opening) return;
        drawMemo = p.memo || null;
        preDoc = p.docs || [];
        if (p.g && p.t === t && p.F.ahead.took) p.F.ahead.took(t, p.g);
        dropDrawing(p);
        var same2 = r[1] && V.img === shownPic && V.current === m ? Object.assign({}, r[1], { text: r[0] }) : null;
        if (s) {
          s.id = m.id;
          s.v = V.ver(m);
          if (s.pending) s.pub = r[2];
        }
        openTitle = m.title;
        return Promise.resolve(p.base || null).then(function(b) {
          if (tk === opening) return start(t, file, null, s, same2, b);
        }).then(function() {
          openTitle = null;
          if (tk !== opening) return;
          var Fs = formatOfText(r[2]);
          siteRef = r[3] ? baseOf(Fs && Fs.asGraphml ? Fs.asGraphml(r[2]) : r[2], r[3]) : null;
          map.title = m.title;
          document.getElementById("m2-title").textContent = m.title;
          if (passAfter) {
            var pa = passAfter;
            passAfter = null;
            setTimeout(function() {
              passSay(pa, true);
            }, 0);
          }
        });
      });
    };
    var notLoaded = function(e) {
      if (tk === opening) warn("Cannot edit " + m.title + ": its file did not load (" + e + ").");
    };
    var fromSite = function(s) {
      return published.then(function(t) {
        return go(t, s);
      }).catch(notLoaded);
    };
    quiet();
    var w = m.mine && mine[m.id];
    if (w && w.site && !w.path) {
      warn("Cannot edit " + m.title + " yet: the site is building it (a few minutes).");
      return;
    }
    if (w && w.site && repo() && token()) {
      return Promise.resolve(upRun).then(function() {
        var w2 = mine[m.id];
        if (tk !== opening || !w2) return;
        return fromSite({ path: w2.path, sha: w2.sha, saved: w2.saved, mine: true }).then(function() {
          if (tk === opening && on && site && site.mine && site.id === m.id && src() !== site.saved) {
            shared.dirty = true;
            changed();
          }
        });
      });
    }
    if (m.mine) return fromSite({ path: null, sha: null, pending: true, mine: true }).then(function() {
      if (tk === opening && on && site && site.mine && site.pending && repo() && token()) toGh(site);
    });
    if (!repo()) return fromSite(null);
    if (!token()) return fromSite({ path, sha: null, pending: true });
    var k = keyOf(m.id), had = null, gp = outboxLoad().then(function() {
      had = outboxGet(k);
      return had ? sendWaiting() : null;
    }).then(function() {
      return had && !outboxGet(k) ? ghRead(path) : p.gh;
    });
    gp.then(function(g) {
      var u = unsaved[m.id], o = outboxGet(k);
      if (!u && o) u = { text: o.text, site: { sha: o.sha, saved: o.saved }, also: o.also };
      var usha = u ? u.site.sha || null : void 0, j = null;
      delete unsaved[m.id];
      if (u && g && g.sha !== usha && g.text !== u.text) {
        var ub = u.site.saved != null ? u.site.saved : u.site.base;
        if (g.text !== ub && g.text !== u.also) {
          j = joined(ub, u.text, g.text);
          u.text = j.text;
        }
      }
      if (u && g && g.text === u.text) {
        u = null;
        outboxDone(k, o ? o.text : null).then(waitShow);
      }
      if (u) return go(u.text, g ? { path, sha: g.sha, saved: g.text } : { path, sha: null }).then(function() {
        if (tk !== opening) return;
        shared.dirty = true;
        changed();
        note();
        if (j && j.real) otherKept(m.id, m.topic || m.title, j, g.text).then(function(l) {
          passSay(l, true);
        });
      }, notLoaded);
      if (!g && p.F.ahead.path) return published.then(function(t) {
        return go(t, { path, sha: null });
      }).catch(notLoaded);
      if (!g) return fromSite(null);
      return go(g.text, { path, sha: g.sha }).then(function() {
        if (tk !== opening) return;
        recheck(p, g, m);
      }, notLoaded);
    }, function(e) {
      if (tk !== opening) return;
      var o = outboxGet(k);
      if (o && !(e === 401 || e === 403)) return go(o.text, { path, sha: o.sha, saved: o.saved }).then(function() {
        if (tk === opening) {
          shared.dirty = true;
          changed();
          sendFailed("net");
        }
      }, notLoaded);
      if (typeof e !== "number" && !p.F.ahead.path) return published.then(function(t) {
        return go(t, { path, sha: m.src || null, saved: t });
      }).catch(notLoaded);
      warn("Could not read the map from GitHub (" + e + "); the token may be refused.");
      ghForm(true);
    });
  }
  function recheck(p, g, m) {
    var s0 = site;
    api("/contents/" + p.path + "?ref=main").then(function(r) {
      return r.ok ? r.json() : null;
    }).then(function(d) {
      if (!d || d.sha === g.sha || !on || site !== s0) return;
      learnt(p.path, d.sha);
      if (bank[p.id] === p) forget(p.id);
      if (!edits && !shared.dirty) {
        on = false;
        editMap(m);
      }
    }).catch(function() {
    });
  }
  function __run245() {
    box2.querySelector("#m2-ed-gh-go").addEventListener("click", function() {
      var v = box2.querySelector("#m2-ed-gh-token").value.trim();
      if (!v) return;
      try {
        localStorage.setItem(TOKEN_KEY, v);
      } catch (e) {
        warn("This browser does not keep the token.");
        return;
      }
      quiet();
      api("").then(function(r) {
        return r.ok ? r.json() : Promise.reject(r.status);
      }).then(function(d) {
        if (!d.permissions || !d.permissions.push) throw "it cannot write to " + repo();
        box2.querySelector("#m2-ed-gh-token").value = "";
        offSay = null;
        upAll();
        waitFail = false;
        sendWaiting();
        if (on && site && site.mine) {
          buttons();
          quiet();
          if (site.pending) toGh(site);
          return;
        }
        var moved = shared.dirty || !!(site && site.pending && src() !== site.pub);
        if (on && site) {
          var keep = shared.text;
          var s0 = site, copy = !!shared.F.ahead.path;
          Promise.resolve(saving).catch(function() {
          }).then(function() {
            return Promise.all([
              api("/contents/" + s0.path + "?ref=main").then(function(r) {
                return r.status === 404 && copy ? {} : r.json();
              }),
              // a map edited as a copy of its own (SBGN-ML) with no copy yet: the first save makes it
              api("/contents/" + s0.path + "?ref=main", { headers: { Accept: "application/vnd.github.raw" } }).then(function(r) {
                return r.status === 404 && copy ? s0.base : r.text();
              })
            ]).then(function(f) {
              if (!on || site !== s0) return;
              s0.pending = false;
              buttons();
              if (f[1] !== (s0.saved != null ? s0.saved : s0.base)) {
                if (moved) return conflict(s0, keep);
                s0.sha = f[0].sha || null;
                stuck = true;
                warn("Connected, but the map on GitHub was changed elsewhere since you opened it; you made no move, so nothing is lost. Stop editing and open the map again.");
                return;
              }
              s0.sha = f[0].sha || null;
              if (s0.id) Promise.resolve(unkeep(s0.id)).then(function() {
                s0.known = null;
              }, function() {
              });
              if (moved) {
                setText(keep);
                shared.dirty = true;
                push();
              } else quiet();
            });
          });
        } else {
          buttons();
          quiet();
        }
      }).catch(function(e) {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch (x) {
        }
        warn("The token was not accepted (" + e + ").");
        ghForm(true);
      });
    });
    offSay = null;
    box2.querySelector("#m2-ed-gh-off").addEventListener("click", function() {
      askOff(disconnect);
    });
    box2.querySelector("#m2-ed-this").addEventListener("click", editShown);
  }
  var offSay;
  function disconnect() {
    var s = site, w = saveTimer ? push() : saving || Promise.resolve();
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
    }
    if (s && !s.pending) {
      s.pending = true;
      s.pub = s.saved || s.base;
      s.fromDraft = false;
      Promise.resolve(w).catch(function() {
      }).then(function() {
        if (s.pending && s.saved != null) s.pub = s.saved;
      });
    }
    offSay = "Disconnected from GitHub: moves are no longer saved to the site, only kept in this browser. Paste a token below to save them there again.";
    buttons();
    quiet();
  }
  function askOff(go) {
    var veil = document.createElement("div"), w = document.createElement("div"), back2 = document.activeElement;
    veil.className = "m2-me-veil";
    w.className = "m2-ask m2-ask-switch m2-ipop-beside";
    w.setAttribute("role", "alertdialog");
    w.setAttribute("aria-modal", "true");
    w.setAttribute("aria-labelledby", "m2-ask-h");
    var n = canFolder ? toMove().length : 0, esc = function(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    };
    var info = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg>';
    var card = function(cls, name2, line2, text, off) {
      return '<div class="m2-ask-opt m2-ipop-row"><button type="button" class="' + cls + '"' + (off ? " disabled" : "") + "><b>" + name2 + "</b><span>" + line2 + '</span></button><button type="button" class="m2-ask-i m2-itip" aria-label="About ' + name2 + '" data-info="' + esc(text) + '" aria-expanded="false">' + info + "</button></div>";
    };
    var keep = "GitHub is left as it is: connect again and what you changed goes back to it.";
    w.innerHTML = '<div class="m2-ask-pick"><h3 id="m2-ask-h">Switch where maps are saved</h3><p class="m2-ask-now">Now: GitHub' + (repo() ? " (" + esc(repo()) + ")" : "") + "</p>" + (canFolder && !n ? "" : card(
      "m2-ask-copy",
      "Work from a folder",
      canFolder ? "Saved to a folder on this computer" : "Chrome or Edge only",
      (n ? "Your " + n + " maps, with their colours and pictures, are copied into a folder you choose. " : "The maps are copied into a folder you choose. ") + "From then on every change is saved there automatically, and yEd or CellDesigner can open the same files. " + keep + " Chrome and Edge only: other browsers cannot save into a folder.",
      !canFolder
    )) + card(
      "m2-ask-yes",
      "Work in this browser",
      "Saved in this browser only",
      "Every change is kept in this browser, on this computer only, and lost if the browser's site data is cleared. " + keep + " The token is removed from this browser; to save to GitHub again, paste it again."
    ) + '<p class="m2-ask-say" hidden></p><button type="button" class="m2-ask-no">Cancel</button></div><div class="m2-ask-busy" hidden><h3></h3><div class="m2-ask-bar"><i></i></div><p class="m2-ask-say"></p></div><div class="m2-ask-done" hidden><h3></h3><p>Every change is saved in this folder.<br>GitHub is left as it was.</p><button type="button" class="m2-ask-ok">OK</button></div>';
    veil.appendChild(w);
    document.body.appendChild(veil);
    var busy = false, cardOpen = false;
    var close = function(yes2) {
      if (busy) return;
      veil.remove();
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", seen, true);
      if (back2 && back2.isConnected && back2.focus) back2.focus();
      if (yes2) go();
    };
    var pick = w.querySelector(".m2-ask-pick"), wait = w.querySelector(".m2-ask-busy"), done = w.querySelector(".m2-ask-done");
    var no2 = w.querySelector(".m2-ask-no"), yes = w.querySelector(".m2-ask-yes"), cp = w.querySelector(".m2-ask-copy"), say = pick.querySelector(".m2-ask-say");
    var order = function() {
      return Array.prototype.filter.call(w.querySelectorAll("button"), function(b) {
        return b.offsetParent && !b.disabled;
      });
    };
    var popped = function() {
      return !!document.querySelector(".m2-ipop");
    };
    var seen = function() {
      cardOpen = popped();
    };
    document.addEventListener("pointerdown", seen, true);
    var key = function(e) {
      if (e.key === "Escape" && popped()) return;
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        var o = order();
        if (o.length) o[(o.indexOf(document.activeElement) + (e.shiftKey ? o.length - 1 : 1)) % o.length].focus();
      }
    };
    no2.addEventListener("click", function() {
      close(false);
    });
    yes.addEventListener("click", function() {
      close(true);
    });
    w.querySelector(".m2-ask-ok").addEventListener("click", function() {
      close(false);
    });
    if (cp && canFolder) cp.addEventListener("click", function() {
      window.showDirectoryPicker({ id: "atlas-maps", mode: "readwrite" }).then(function(dir) {
        busy = true;
        say.hidden = true;
        say.classList.remove("m2-ask-bad");
        pick.hidden = true;
        wait.hidden = false;
        wait.querySelector("h3").textContent = "Copying to \u201C" + dir.name + "\u201D";
        var bar = wait.querySelector(".m2-ask-bar i"), line2 = wait.querySelector(".m2-ask-say");
        bar.style.width = "0";
        line2.textContent = "";
        var tell = function(t) {
          var m = /^Copying (\d+) of (\d+)/.exec(t);
          if (m) {
            bar.style.width = 100 * (+m[1] - 1) / +m[2] + "%";
            line2.textContent = m[1] + " of " + m[2] + " maps";
          } else {
            bar.style.width = "100%";
            line2.textContent = t.replace(/^Copying the pictures: .*/, "The pictures");
          }
        };
        var cur = V.current && V.current.id;
        if (on) {
          var st = box2.querySelector("#m2-ed-stop");
          if (st && !st.hidden) st.click();
        }
        return Promise.resolve(saveTimer ? push() : saving).catch(function() {
        }).then(function() {
          return moveOut(dir, tell);
        }).then(function(res) {
          disconnect();
          offSay = null;
          buttons();
          quiet();
          localBox();
          V.refreshMine();
          status.textContent = "Working from the folder " + res.dir.name + ": " + res.n + " maps copied there, every change saved there; GitHub is unchanged. Connect again to save what you change back to GitHub.";
          if (cur && res.ids[cur]) setTimeout(function() {
            V.go(res.ids[cur]);
          }, 0);
          wait.hidden = true;
          done.hidden = false;
          done.querySelector("h3").textContent = "Working from \u201C" + res.dir.name + "\u201D";
          busy = false;
          done.querySelector(".m2-ask-ok").focus();
        });
      }).catch(function(e) {
        if (e && e.name === "AbortError") return;
        busy = false;
        wait.hidden = true;
        pick.hidden = false;
        say.hidden = false;
        say.classList.add("m2-ask-bad");
        say.textContent = "Not copied, still connected to GitHub: " + String(e && e.message ? e.message : e).replace(/\.$/, "") + ". Files already written stay in the folder; copying again goes on from them.";
      });
    });
    veil.addEventListener("pointerdown", function(e) {
      if (e.target === veil && !cardOpen) close(false);
    });
    window.addEventListener("keydown", key, true);
    no2.focus();
  }
  function gridPut(g) {
    Object.assign(gridSet, { shown: g.shown, snap: g.snap, step: g.step });
    gridKeep();
    inGrid.value = String(gridSet.step);
    gridButtons();
    paint();
  }
  function gridDid(was) {
    V.setDid(gridPut, was, { shown: gridSet.shown, snap: gridSet.snap, step: gridSet.step });
  }
  function gridShow() {
    var was = Object.assign({}, gridSet);
    gridSet.shown = !gridSet.shown;
    gridKeep();
    gridButtons();
    paint();
    gridDid(was);
  }
  function gridSnap() {
    var was = Object.assign({}, gridSet);
    gridSet.snap = !gridSet.snap;
    gridKeep();
    gridButtons();
    gridDid(was);
  }
  var inGrid;
  var gsMenu;
  function __run254() {
    box2.querySelector("#m2-ed-grid").addEventListener("click", gridShow);
    box2.querySelector("#m2-ed-snap").addEventListener("click", gridSnap);
    inGrid = box2.querySelector("#m2-ed-gsize");
    inGrid.value = String(gridSet.step);
    inGrid.addEventListener("change", function() {
      var was = Object.assign({}, gridSet);
      gridSet.step = stepOk(parseFloat(inGrid.value));
      gridKeep();
      inGrid.value = String(gridSet.step);
      paint();
      gridDid(was);
    });
    inGrid.addEventListener("keydown", function(e) {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Escape") {
        if (e.key === "Escape") inGrid.value = String(gridSet.step);
        inGrid.blur();
      }
    });
    gsMenu = null;
  }
  function gsClose() {
    if (gsMenu) {
      gsMenu.remove();
      gsMenu = null;
    }
  }
  var kwBox;
  var kwBy;
  function __run264() {
    box2.querySelector("#m2-ed-gsdrop").addEventListener("click", function(e) {
      e.stopPropagation();
      if (gsMenu) {
        gsClose();
        return;
      }
      var r = inGrid.parentNode.getBoundingClientRect();
      gsMenu = document.createElement("div");
      gsMenu.className = "m2-cx m2-gs-menu";
      gsMenu.setAttribute("role", "menu");
      [4, 8, 16, 32, 64].forEach(function(v) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = String(v);
        b.setAttribute("role", "menuitemradio");
        b.setAttribute("aria-checked", String(v === gridSet.step));
        b.addEventListener("click", function(ev) {
          ev.stopPropagation();
          gsClose();
          inGrid.value = String(v);
          inGrid.dispatchEvent(new Event("change"));
        });
        gsMenu.appendChild(b);
      });
      document.body.appendChild(gsMenu);
      var k = gsMenu.getBoundingClientRect().width / gsMenu.offsetWidth || 1;
      gsMenu.style.left = r.left / k + "px";
      gsMenu.style.top = (r.bottom + 2) / k + "px";
    });
    document.addEventListener("pointerdown", function(e) {
      if (gsMenu && !gsMenu.contains(e.target) && !e.target.closest("#m2-ed-gsdrop")) gsClose();
    }, true);
    document.addEventListener("keydown", function(e) {
      if (gsMenu && e.key === "Escape") {
        e.preventDefault();
        gsClose();
      }
    }, true);
    window.addEventListener("resize", gsClose);
    gridButtons();
    kwBox = null, kwBy = null;
  }
  function kwClose(back2) {
    if (!kwBox) return;
    var b = kwBox;
    kwBox = null;
    b.remove();
    if (kwBy && kwBy.shut) kwBy.shut();
    if (back2 && kwBy && kwBy.by && kwBy.by.isConnected) kwBy.by.focus();
    kwBy = null;
  }
  function kindWindow(r, items2, done) {
    kwClose();
    var t0 = shared.text, m0 = map;
    kwBox = document.createElement("div");
    kwBox.className = "m2-cx m2-ci";
    kwBox.setAttribute("role", "menu");
    kwBox.setAttribute("aria-label", "Change identity");
    kwBy = r;
    items2.forEach(function(q) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", String(!!q.own));
      b.disabled = !!q.own;
      b.textContent = q.name;
      b.addEventListener("click", function(e) {
        e.stopPropagation();
        kwClose();
        if (done) done();
        if (on && V.current === m0 && shared.text === t0) q.go();
      });
      kwBox.appendChild(b);
    });
    document.body.appendChild(kwBox);
    var k = kwBox.getBoundingClientRect().width / kwBox.offsetWidth || 1, w = kwBox.offsetWidth * k, h = kwBox.offsetHeight * k;
    var first = kwBox.firstChild, lift = first ? first.getBoundingClientRect().top - kwBox.getBoundingClientRect().top : 0;
    var mr = r.mright != null ? r.mright : r.right, ml = r.mleft != null ? r.mleft : r.left;
    var x = mr - 2 * k + w <= V.winW() - 4 ? mr - 2 * k : ml + 2 * k - w >= 4 ? ml + 2 * k - w : V.winW() - 4 - w;
    kwBox.style.left = Math.max(4, x) / k + "px";
    kwBox.style.top = Math.max(4, Math.min(r.top - lift, V.winH() - 4 - h)) / k + "px";
    var box3 = kwBox;
    kwBox.m2close = function() {
      if (kwBox === box3) kwClose();
    };
    kwBox.m2first = function() {
      var f = box3.querySelector("button:not(:disabled)");
      if (f) f.focus();
    };
    return kwBox;
  }
  function subItem(f) {
    f.sub = true;
    return f;
  }
  function __run274() {
    document.addEventListener("pointerdown", function(e) {
      if (kwBox && !kwBox.contains(e.target) && !(kwBy && kwBy.by && kwBy.by.contains(e.target))) kwClose();
    }, true);
    document.addEventListener("keydown", function(e) {
      if (!kwBox || e.key === "Enter" || e.key === " " || /^(Shift|Control|Alt|Meta)$/.test(e.key)) return;
      if (!/^(ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Escape)$/.test(e.key)) {
        kwClose();
        return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === "ArrowRight") return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        var list2 = Array.prototype.slice.call(kwBox.querySelectorAll("button:not(:disabled)")), i = list2.indexOf(document.activeElement), d = e.key === "ArrowDown" ? 1 : -1;
        if (list2.length) list2[i < 0 ? d > 0 ? 0 : list2.length - 1 : (i + d + list2.length) % list2.length].focus();
        return;
      }
      kwClose(true);
    }, true);
    window.addEventListener("resize", kwClose);
    document.addEventListener("scroll", function(e) {
      if (kwBox && !kwBox.contains(e.target)) kwClose();
    }, true);
  }
  function lateItem(it) {
    var out = [it];
    out.late = true;
    return out;
  }
  var picWait;
  function __run284() {
    picWait = false;
  }
  function shown(any) {
    if (!V.grid.classList.contains("m2-win-edit") || on) return;
    if (!any && V.img && V.img.style.visibility === "hidden") {
      picWait = true;
      return;
    }
    picWait = false;
    if (shared.text && shared.dirty && !site) return resume();
    if (graphmlOf(V.current)) return editShown();
    buttons();
    shownWhole();
  }
  function __run294() {
    document.querySelectorAll('#m2-rail .m2-ri[data-win="edit"]').forEach(function(b) {
      b.addEventListener("click", shown);
    });
    box2.querySelector("#m2-ed-save").addEventListener("click", save);
    box2.querySelector("#m2-ed-undo").addEventListener("click", function() {
      if (on && !listGo(true)) back(undo, shared.redo);
    });
    box2.querySelector("#m2-ed-redo").addEventListener("click", function() {
      if (on && !listGo(false)) back(shared.redo, undo);
    });
    box2.querySelector("#m2-ed-stop").addEventListener("click", function() {
      V.win = "list";
      V.railMark();
      if (V.chosen) V.put(V.chosen);
      else stop();
    });
  }
  function resume() {
    V.current = map;
    on = true;
    V.grid.classList.add("m2-editing");
    buttons();
    histBack();
    editLock(site && site.id);
    document.getElementById("m2-title").textContent = map.title;
    x0 = y0 = 0;
    map.width = 0;
    render();
  }
  function __run303() {
    box2.querySelector("#m2-ed-back").addEventListener("click", resume);
  }
  function away() {
    if (!on) {
      opening++;
      if (V.grid.classList.contains("m2-editing")) {
        V.grid.classList.remove("m2-editing");
        buttons();
        if (V.chosen) V.put(V.chosen, true);
      }
      return;
    }
    if (V.chosen) V.put(V.chosen, true);
    else stop();
  }
  var HANDLE;
  var BEND;
  function __run314() {
    window.addEventListener("beforeunload", function(e) {
      if (shared.dirty) {
        keepNow2();
        if (saveTimer) push();
      }
      if (shared.dirty || waitFail && here().length) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    addEventListener("pagehide", function() {
      try {
        if (!(on && V.chosen)) return;
        var rec = {
          path: location.pathname,
          map: V.chosen.id,
          n: shared.selN.map(function(i) {
            return nodes2[i] && nodes2[i].id;
          }).filter(Boolean),
          e: shared.selE.map(function(i) {
            return edges2[i] && edges2[i].id;
          }).filter(Boolean)
        };
        var put2 = function(r) {
          sessionStorage.setItem("atlas-edit-sel", JSON.stringify(r));
        };
        var k = site && site.path && !site.mine && !site.pending && !saving && !saveTimer ? ghKnown(site) : null;
        if (!k || typeof k.text !== "string") return put2(rec);
        try {
          put2(Object.assign({ gh: { path: site.path, sha: k.sha, text: k.text } }, rec));
        } catch (e) {
          put2(rec);
        }
      } catch (e) {
      }
    });
    HANDLE = 5, BEND = 5;
  }
  function sq() {
    return Math.max(2, BEND * V.z);
  }
  function sw(units) {
    return ' style="stroke-width:' + f1(units * V.z) + 'px"';
  }
  function gw() {
    var k = (window.devicePixelRatio || 1) * V.pz();
    return ' style="stroke-width:' + Math.max(V.z, 2 / k).toFixed(2) + 'px"';
  }
  function handleMarks(b, cls) {
    var hs = Math.max(2, HANDLE * V.z), off = 3.3 * V.z, o = "";
    var L = sx(b[0]) - off, T = sy(b[1]) - off, R = sx(b[0] + b[2]) + off, B = sy(b[1] + b[3]) + off;
    [[L, T], [(L + R) / 2, T], [R, T], [L, (T + B) / 2], [R, (T + B) / 2], [L, B], [(L + R) / 2, B], [R, B]].forEach(function(q) {
      o += '<rect class="' + cls + '" x="' + f1(q[0] - hs / 2) + '" y="' + f1(q[1] - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>';
    });
    return o;
  }
  function landMarks(Ps, Q, cls) {
    var sqr = function(q, cls2, u) {
      var h = Math.max(u, u * V.z);
      return '<rect class="' + cls2 + '" x="' + f1(sx(q[0]) - h / 2) + '" y="' + f1(sy(q[1]) - h / 2) + '" width="' + f1(h) + '" height="' + f1(h) + '"/>';
    }, o = "";
    Ps.forEach(function(q) {
      if (!Q || Math.hypot(q[0] - Q[0], q[1] - Q[1]) > 1e-6) o += sqr(q, "m2-ed-place", 3);
    });
    return Q ? o + sqr(Q, cls || "m2-ed-port", cls ? HANDLE : 4) : o;
  }
  function sx(X) {
    return V.tx + (X - x0) * V.z;
  }
  function sy(Y2) {
    return V.ty + (Y2 - y0) * V.z;
  }
  function f1(v) {
    return Math.round(v * 100) / 100;
  }
  function rr(x, y, w, h, r, quad) {
    r = Math.min(r, w / 2, h / 2);
    if (r <= 0) return "M" + x + " " + y + "h" + w + "v" + h + "h" + -w + "Z";
    if (quad) return "M" + x + " " + (y + r) + "Q" + x + " " + y + " " + (x + r) + " " + y + "L" + (x + w - r) + " " + y + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) + "L" + (x + w) + " " + (y + h - r) + "Q" + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h) + "L" + (x + r) + " " + (y + h) + "Q" + x + " " + (y + h) + " " + x + " " + (y + h - r) + "Z";
    var A = "A" + r + " " + r + " 0 0 1 ";
    return "M" + x + " " + (y + r) + A + (x + r) + " " + y + "L" + (x + w - r) + " " + y + A + (x + w) + " " + (y + r) + "L" + (x + w) + " " + (y + h - r) + A + (x + w - r) + " " + (y + h) + "L" + (x + r) + " " + (y + h) + A + x + " " + (y + h - r) + "Z";
  }
  function poly(pts) {
    return "M" + pts.map(function(q) {
      return q[0] + " " + q[1];
    }).join("L") + "Z";
  }
  function outlineD(sh, x, y, w, h) {
    var f = parseFloat(sh.props.inset || 0);
    if (f > 0) {
      x += w * f;
      y += h * f;
      w *= 1 - 2 * f;
      h *= 1 - 2 * f;
    }
    var k = sh.kind, pr = sh.props, i = h * parseFloat(pr.indent || 0.25);
    if (k === "Macromolecule") return rr(x, y, w, h, parseFloat(pr.radius || 12), true);
    if (k === "SimpleChemical" || k === "StateVariable") return rr(x, y, w, h, Math.min(w, h) / 2, false);
    if (k === "Complex") {
      var rx2 = Math.min(parseFloat(pr.radiusX || 15), w / 2), ry = Math.min(parseFloat(pr.radiusY || 15), h / 2);
      return poly([[x + rx2, y], [x + w - rx2, y], [x + w, y + ry], [x + w, y + h - ry], [x + w - rx2, y + h], [x + rx2, y + h], [x, y + h - ry], [x, y + ry]]);
    }
    if (k === "NucleicAcidFeature") {
      var r = Math.min(parseFloat(pr.radius || 12), w / 2, h);
      return "M" + x + " " + y + "L" + (x + w) + " " + y + "L" + (x + w) + " " + (y + h - r) + "Q" + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h) + "L" + (x + r) + " " + (y + h) + "Q" + x + " " + (y + h) + " " + x + " " + (y + h - r) + "Z";
    }
    if (k === "EmptySet" || k === "Operator" || k === "UnspecifiedEntity" || k === "ellipse")
      return "M" + x + " " + (y + h / 2) + "A" + w / 2 + " " + h / 2 + " 0 1 1 " + (x + w) + " " + (y + h / 2) + "A" + w / 2 + " " + h / 2 + " 0 1 1 " + x + " " + (y + h / 2) + "Z";
    if (k === "Phenotype") return poly([[x + i, y], [x + w - i, y], [x + w, y + h / 2], [x + w - i, y + h], [x + i, y + h], [x, y + h / 2]]);
    if (k === "PerturbingAgent") return poly([[x, y], [x + w, y], [x + w - i, y + h / 2], [x + w, y + h], [x, y + h], [x + i, y + h / 2]]);
    if (k === "roundrectangle") return rr(x, y, w, h, 4, false);
    if (k === "Tag") {
      var o = pr.orientation, way = /^(left|right|up|down)$/.test(o || "") ? o : pr.inverse === "true" ? "left" : "right", a = Math.min(h * 3 / 8, w), b2 = Math.min(w * 3 / 8, h);
      if (way === "right") return poly([[x, y], [x + w - a, y], [x + w, y + h / 2], [x + w - a, y + h], [x, y + h]]);
      if (way === "left") return poly([[x + a, y], [x + w, y], [x + w, y + h], [x + a, y + h], [x, y + h / 2]]);
      if (way === "down") return poly([[x, y], [x + w, y], [x + w, y + h - b2], [x + w / 2, y + h], [x, y + h - b2]]);
      return poly([[x + w / 2, y], [x + w, y + b2], [x + w, y + h], [x, y + h], [x, y + b2]]);
    }
    return rr(x, y, w, h, 0);
  }
  function shapeD(i) {
    var b = shared.liveC && shared.liveC[i] ? shared.liveC[i] : bx(i), n = nodes2[i];
    var sh = drawnShape(i), d = outlineD(sh, b[0], b[1], b[2], b[3]);
    if (sh === n.shape && n.shape.props.mcount === "2") d = outlineD(n.shape, b[0] + 6, b[1] + 6, b[2], b[3]) + d;
    return d;
  }
  function drawnShape(i, still) {
    var p = !still && shared.poseNow && shared.poseNow[i];
    if (p && p.way) return { kind: nodes2[i].shape.kind, props: Object.assign({}, nodes2[i].shape.props, { orientation: p.way }) };
    return shared.afSbgn && AF_KINDS.test(nodes2[i].shape.kind) ? { kind: "Macromolecule", props: { radius: "0" } } : nodes2[i].shape;
  }
  function cut(port, outer, b) {
    if (!(port[0] > b[0] && port[0] < b[0] + b[2] && port[1] > b[1] && port[1] < b[1] + b[3])) return port;
    var dx = port[0] - outer[0], dy = port[1] - outer[1], best = 1;
    [[b[0], 0], [b[0] + b[2], 0], [b[1], 1], [b[1] + b[3], 1]].forEach(function(e) {
      var den = e[1] ? dy : dx;
      if (!den) return;
      var t = (e[0] - (e[1] ? outer[1] : outer[0])) / den;
      if (t >= 0 && t < best) {
        var o = e[1] ? outer[0] + dx * t : outer[1] + dy * t, lo = e[1] ? b[0] : b[1], hi = e[1] ? b[0] + b[2] : b[1] + b[3];
        if (o >= lo - 0.01 && o <= hi + 0.01) best = t;
      }
    });
    return [outer[0] + dx * best, outer[1] + dy * best];
  }
  function line(k, B, P, pp) {
    var e = edges2[k];
    if (e.s == null || e.t == null) return null;
    B = B || bx;
    P = P || pt;
    var mine2 = pp && pp.to && pp.k === k, S = B(mine2 && !pp.end && pp.n2 != null ? pp.n2 : e.s), T = B(mine2 && pp.end && pp.n2 != null ? pp.n2 : e.t), pa = e.path, o = function(a) {
      if (mine2 && (pp.end ? "t" : "s") === a[0]) return pp.to[a[1] === "x" ? 0 : 1];
      return pa ? parseFloat(pa.getAttribute(a)) || 0 : 0;
    };
    var so = [o("sx"), o("sy")], to = [o("tx"), o("ty")];
    if (B === bx) {
      so = posePort(e.s, glyphPort(e.s, so, e.id), k);
      to = posePort(e.t, glyphPort(e.t, to, e.id), k);
    }
    var pts = [[S[0] + S[2] / 2 + so[0], S[1] + S[3] / 2 + so[1]]];
    e.pts.forEach(function(pi) {
      pts.push(P(pi));
    });
    pts.push([T[0] + T[2] / 2 + to[0], T[1] + T[3] / 2 + to[1]]);
    pts[0] = cutShape(mine2 && !pp.end && pp.n2 != null ? pp.n2 : e.s, pts[0], pts[1], S, B !== bx);
    pts[pts.length - 1] = cutShape(mine2 && pp.end && pp.n2 != null ? pp.n2 : e.t, pts[pts.length - 1], pts[pts.length - 2], T, B !== bx);
    return pts;
  }
  function cutShape(n, port, outer, b, still) {
    var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2, R = rimOf(n, b, still), q = [port[0] - cx, port[1] - cy];
    if (!inRim(R, q) && onRim(R, q).d >= 0.5) return port;
    var o = [outer[0] - cx, outer[1] - cy], best = null;
    R.forEach(function(A, i) {
      var B = R[(i + 1) % R.length], den = (q[0] - o[0]) * (B[1] - A[1]) - (q[1] - o[1]) * (B[0] - A[0]);
      if (Math.abs(den) < 1e-12) return;
      var t = ((A[0] - o[0]) * (B[1] - A[1]) - (A[1] - o[1]) * (B[0] - A[0])) / den, u = ((A[0] - o[0]) * (q[1] - o[1]) - (A[1] - o[1]) * (q[0] - o[0])) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
    });
    return best === null ? port : [outer[0] + (port[0] - outer[0]) * best, outer[1] + (port[1] - outer[1]) * best];
  }
  function livePath(pts, smooth) {
    return roundPath(pts, smooth, function(q) {
      return f1(sx(q[0])) + " " + f1(sy(q[1]));
    });
  }
  function roundPath(pts, smooth, P) {
    var d = "M" + P(pts[0]);
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], b = pts[i], c = pts[i + 1], la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (smooth && la > 0 && lc > 0) {
        var da = Math.min(10, la / 2), dc = Math.min(10, lc / 2);
        d += "L" + P([b[0] + (a[0] - b[0]) * da / la, b[1] + (a[1] - b[1]) * da / la]) + "Q" + P(b) + " " + P([b[0] + (c[0] - b[0]) * dc / lc, b[1] + (c[1] - b[1]) * dc / lc]);
      } else d += "L" + P(b);
    }
    return d + "L" + P(pts[pts.length - 1]);
  }
  function lit() {
    var hlE = new Set(shared.selE), glyphs = /* @__PURE__ */ new Set();
    if (shared.F.lit) shared.F.lit(hlE, glyphs);
    return { e: hlE, g: glyphs };
  }
  function partSel() {
    return shared.part && !shared.selN.length && !shared.selP.length && shared.selE.indexOf(shared.part.k) >= 0 ? shared.part : null;
  }
  function markSize() {
    return Math.max(1.5, 4 * V.z);
  }
  function markReach() {
    return markSize() + Math.max(1, 2 * V.z) / 2;
  }
  function portAt(P) {
    var R = 6 / V.z, L = lit(), best = null, dB = R, ps = partSel(), wide = !shared.selN.length && !shared.selP.length, hp = wide && L.e.size && hit(P);
    L.e.forEach(function(k) {
      var e = edges2[k];
      if (e.s == null || e.t == null || !e.path) return;
      var all = ports(k);
      [[0, e.s], [all.length - 1, e.t]].forEach(function(q, end) {
        if (shared.F.square(nodes2[q[1]].id) != null && !procSpots({ k, end, n: q[1] })) return;
        var d = Math.hypot(all[q[0]][0] - P[0], all[q[0]][1] - P[1]), hb = !!hubEnd(k, end), b = hb && bx(q[1]);
        if (hb && P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3]) return;
        var sq2 = Math.max(Math.abs(all[q[0]][0] - P[0]), Math.abs(all[q[0]][1] - P[1])) * V.z;
        if (wide && shared.selE.indexOf(k) >= 0 && !(hp && hp.e === k && hp.p != null) && sq2 <= markReach() + 2)
          d = ps && ps.port && ps.k === k && ps.port.end === end ? 0 : sq2 / 1e4;
        if (d <= dB) {
          dB = d;
          best = { k, end, n: q[1], to: null, hub: hb };
        }
      });
    });
    return best;
  }
  function procSpots(pp) {
    return pp.end && shared.F.modLine && shared.F.modLine(edges2[pp.k].id) ? procPlaces(pp.n) : null;
  }
  function procPlaces(n) {
    var r = shared.F.square(nodes2[n].id);
    if (r == null) return null;
    var ka = edges2.findIndex(function(e) {
      return e.id === r + "|a";
    });
    if (ka < 0) return null;
    var p = ports(ka), A = p[p.length - 2], C = p[p.length - 1], L = Math.hypot(C[0] - A[0], C[1] - A[1]), h = bx(n)[2] / 2;
    if (!L) return null;
    return sixPlaces([(C[0] - A[0]) / L, (C[1] - A[1]) / L], h, h);
  }
  function sixPlaces(f, hw, hh) {
    return [[0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(function(s) {
      return [hw * (s[0] * f[0] - s[1] * f[1]), hh * (s[0] * f[1] + s[1] * f[0])];
    });
  }
  function hubEnd(k, end, at2) {
    var e = edges2[k], n = at2 != null ? at2 : end ? e.t : e.s;
    if (n == null || !nodes2[n].hub) return null;
    if (end) return e.arr[1] === "none" ? "in" : null;
    return !(e.t != null && nodes2[e.t].hub) && e.arr[0] === "none" && e.arr[1] === "none" && !nodes2[n].eq ? "in" : "out";
  }
  function hubPorts() {
    if (!shared.hpMemo || shared.hpMemo[0] !== shared.text) shared.hpMemo = [shared.text, window.yrender.render(docText === shared.text ? doc : shared.text, {}).ports];
    return shared.hpMemo[1];
  }
  function hubSides(pp) {
    var n = nodes2[pp.n];
    if (!n.hub || hubEnd(pp.k, pp.end) || !window.yrender) return null;
    var P = hubPorts()[n.id], b = bx(pp.n);
    if (!P) return null;
    var hz = Math.abs(P[1][0] - P[0][0]) >= Math.abs(P[1][1] - P[0][1]);
    return sixPlaces(hz ? [Math.sign(P[1][0] - P[0][0]) || 1, 0] : [0, Math.sign(P[1][1] - P[0][1]) || 1], b[2] / 2, b[3] / 2);
  }
  function turn(i) {
    var P = hubPorts()[nodes2[i].id], b = boxOf(i), c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    if (!P) return;
    var rel = function(q) {
      return [q[0] - c[0], q[1] - c[1]];
    }, list2 = [];
    edges2.forEach(function(e, k) {
      if (!e.path) return;
      [0, 1].forEach(function(end) {
        if ((end ? e.t : e.s) !== i) return;
        var a = end ? ["tx", "ty"] : ["sx", "sy"], o = [num(e.path, a[0]) || 0, num(e.path, a[1]) || 0], role = hubEnd(k, end);
        if (role && Math.abs(o[0]) <= b[2] / 2 + 0.5 && Math.abs(o[1]) <= b[3] / 2 + 0.5) {
          if (role === "in") o = rel(P[0]);
          else if (P[2]) o = rel(P[1]);
          else {
            var all = ports(k), nx = all[1];
            o = rel(Math.hypot(P[1][0] - nx[0], P[1][1] - nx[1]) <= Math.hypot(P[0][0] - nx[0], P[0][1] - nx[1]) ? P[1] : P[0]);
          }
        }
        var L = Math.abs(o[0]) >= Math.abs(o[1]) ? Math.abs(o[0]) - b[2] / 2 : Math.abs(o[1]) - b[3] / 2, port = L > 0.5 && Math.min(Math.abs(o[0]), Math.abs(o[1])) <= 0.5;
        list2.push({ k, end, to: port ? Math.abs(o[0]) >= Math.abs(o[1]) ? [0, Math.sign(o[0]) * (b[3] / 2 + L)] : [-Math.sign(o[1]) * (b[2] / 2 + L), 0] : [-o[1] * b[2] / b[3], o[0] * b[3] / b[2]] });
      });
    });
    if (list2.length) setPorts(list2);
  }
  function placesOf(pp) {
    if (hubEnd(pp.k, pp.end, pp.n) && window.yrender && hubPorts()[nodes2[pp.n].id]) return null;
    var N = places(pp.n);
    return procSpots(pp) || hubSides(pp) || N && [[0, 0]].concat(N) || (shared.F.fixedEnds ? fivePlaces(pp.n) : null);
  }
  function fivePlaces(n) {
    var b = bx(n);
    return [[0, 0], [0, -b[3] / 2], [0, b[3] / 2], [-b[2] / 2, 0], [b[2] / 2, 0]];
  }
  function places(n) {
    return shared.F.places ? shared.F.places(n) : null;
  }
  function spot(pp, P, free) {
    var b = bx(pp.n), c = [b[0] + b[2] / 2, b[1] + b[3] / 2], S = procSpots(pp) || hubSides(pp), N = S ? null : places(pp.n), F = null;
    if (!S && !shared.F.fixedEnds) return gridSpot(pp.n, [P[0] - c[0], P[1] - c[1]], free);
    if (N && nodeCentre(pp.n, P)) return [0, 0];
    if (S) {
      var all = ports(pp.k);
      F = all[all.length - 2];
    }
    var cost = function(o) {
      var q = [c[0] + o[0], c[1] + o[1]];
      return Math.hypot(q[0] - P[0], q[1] - P[1]) + (F ? 1e-3 * Math.hypot(q[0] - F[0], q[1] - F[1]) : 0);
    };
    return (S || N || fivePlaces(pp.n)).reduce(function(m, o) {
      return cost(o) < cost(m) ? o : m;
    });
  }
  var rimMemo;
  function __run343() {
    rimMemo = /* @__PURE__ */ new Map();
  }
  function rim(n) {
    return rimOf(n, bx(n));
  }
  function rimOf(n, b, still) {
    var sh = drawnShape(n, still), key = sh.kind + JSON.stringify(sh.props) + "|" + b[2] + "|" + b[3], R = rimMemo.get(key);
    if (!R) {
      R = flatten(outlineD(sh, -b[2] / 2, -b[3] / 2, b[2], b[3]));
      if (rimMemo.size > 200) rimMemo.clear();
      rimMemo.set(key, R);
    }
    return R;
  }
  function flatten(d) {
    var tk = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [], i = 0, P = [], cur = [0, 0], st = [0, 0], c = "";
    var n = function() {
      return parseFloat(tk[i++]);
    }, same2 = function(a2, q) {
      return Math.abs(a2[0] - q[0]) < 1e-9 && Math.abs(a2[1] - q[1]) < 1e-9;
    };
    var add = function(q) {
      if (!P.length || !same2(P[P.length - 1], q)) P.push(q);
      cur = q;
    };
    var inside2 = function(ts2) {
      return ts2.filter(function(t) {
        return t > 0 && t <= 1;
      }).sort(function(x, y) {
        return x - y;
      });
    };
    while (i < tk.length) {
      if (/[a-zA-Z]/.test(tk[i])) c = tk[i++];
      if (c === "M") {
        st = [n(), n()];
        add(st);
      } else if (c === "L") add([n(), n()]);
      else if (c === "h") add([cur[0] + n(), cur[1]]);
      else if (c === "v") add([cur[0], cur[1] + n()]);
      else if (c === "Q") {
        var q0 = cur, q1 = [n(), n()], q2 = [n(), n()], a = [q1[0] - q0[0], q1[1] - q0[1]], e = [q2[0] - q1[0], q2[1] - q1[1]], ts = [];
        [1, -1].forEach(function(sg) {
          var den = e[0] - a[0] - sg * (e[1] - a[1]);
          if (Math.abs(den) > 1e-12) ts.push(-(a[0] - sg * a[1]) / den);
        });
        for (var k = 1; k <= 24; k++) ts.push(k / 24);
        inside2(ts).forEach(function(t) {
          var u = 1 - t;
          add([u * u * q0[0] + 2 * u * t * q1[0] + t * t * q2[0], u * u * q0[1] + 2 * u * t * q1[1] + t * t * q2[1]]);
        });
      } else if (c === "A") {
        var rx2 = n(), ry = n();
        n();
        var fa = n(), fs = n(), p2 = [n(), n()], p1 = cur;
        var dx = (p1[0] - p2[0]) / 2, dy = (p1[1] - p2[1]) / 2, lam = dx * dx / (rx2 * rx2) + dy * dy / (ry * ry);
        if (lam > 1) {
          rx2 *= Math.sqrt(lam);
          ry *= Math.sqrt(lam);
        }
        var co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx2 * rx2 * ry * ry - rx2 * rx2 * dy * dy - ry * ry * dx * dx) / (rx2 * rx2 * dy * dy + ry * ry * dx * dx)));
        var cxp = co * rx2 * dy / ry, cyp = -co * ry * dx / rx2, cx = cxp + (p1[0] + p2[0]) / 2, cy = cyp + (p1[1] + p2[1]) / 2;
        var t1 = Math.atan2((dy - cyp) / ry, (dx - cxp) / rx2), dt = Math.atan2((-dy - cyp) / ry, (-dx - cxp) / rx2) - t1;
        if (fs && dt < 0) dt += 2 * Math.PI;
        if (!fs && dt > 0) dt -= 2 * Math.PI;
        var m = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 180))), th = [], t0 = Math.atan(ry / rx2);
        for (var k2 = 1; k2 <= m; k2++) th.push(k2 / m);
        for (var j = -4; j <= 4; j++) [t0, -t0].forEach(function(x) {
          th.push((x + j * Math.PI - t1) / dt);
        });
        inside2(th).forEach(function(f) {
          var t = t1 + f * dt;
          add([cx + rx2 * Math.cos(t), cy + ry * Math.sin(t)]);
        });
        add(p2);
      } else if (c === "Z" || c === "z") add(st);
      else i++;
    }
    if (P.length > 1 && same2(P[0], P[P.length - 1])) P.pop();
    return P;
  }
  function keyAx(v) {
    return Math.abs(v[0]) >= Math.abs(v[1]) ? 0 : 1;
  }
  function gridNext(v, s, g) {
    var e = 0.02 / g;
    return s > 0 ? (Math.floor(v / g + e) + 1) * g : (Math.ceil(v / g - e) - 1) * g;
  }
  function dec2(q) {
    return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100];
  }
  function onRim(R, o) {
    var best = { d: Infinity };
    R.forEach(function(p, j) {
      var q = R[(j + 1) % R.length], v = [q[0] - p[0], q[1] - p[1]], L = v[0] * v[0] + v[1] * v[1];
      var t = L ? Math.max(0, Math.min(1, ((o[0] - p[0]) * v[0] + (o[1] - p[1]) * v[1]) / L)) : 0, X = [p[0] + t * v[0], p[1] + t * v[1]], d = Math.hypot(X[0] - o[0], X[1] - o[1]);
      if (d < best.d) best = { d, j, pt: X };
    });
    return best;
  }
  function inRim(R, o) {
    var inn = false;
    for (var i = 0, j = R.length - 1; i < R.length; j = i++) {
      var a = R[i], b = R[j];
      if (a[1] > o[1] !== b[1] > o[1] && o[0] < (b[0] - a[0]) * (o[1] - a[1]) / (b[1] - a[1]) + a[0]) inn = !inn;
    }
    return inn;
  }
  function walk(R, loc, di, A, s, g) {
    var N = R.length, p = loc.pt, moved = false;
    for (var m = 0; m < N; m++) {
      var q = di ? R[((loc.j - m) % N + N) % N] : R[(loc.j + 1 + m) % N], w = [q[0] - p[0], q[1] - p[1]];
      if (Math.hypot(w[0], w[1]) < 0.05) {
        p = q;
        continue;
      }
      if (A == null) {
        A = keyAx(w);
        s = Math.sign(w[A]);
      }
      if (keyAx(w) !== A || Math.sign(w[A]) !== s) break;
      var v = gridNext(loc.pt[A], s, g);
      if ((q[A] - v) * s >= -1e-9) {
        var t = (v - p[A]) / w[A], X = [p[0] + t * w[0], p[1] + t * w[1]];
        X[A] = v;
        return X;
      }
      p = q;
      moved = true;
    }
    return moved && Math.hypot(p[0] - loc.pt[0], p[1] - loc.pt[1]) > 0.05 ? p : null;
  }
  function along(R, loc, A, s, g) {
    for (var di = 0; di < 2; di++) {
      var X = walk(R, loc, di, A, s, g);
      if (X) return { to: X, di };
    }
    return null;
  }
  function portStep(n, o, d, g, round) {
    var R = rim(n), A = d[0] ? 0 : 1, s = Math.sign(d[A]), loc = onRim(R, o), t = o.slice();
    if (loc.d > 0.05 && !inRim(R, o)) return { to: dec2(loc.pt) };
    if (loc.d > 0.05) {
      t[A] = gridNext(o[A], s, g);
      if (inRim(R, t) && onRim(R, t).d > 0.05) return { to: dec2(t) };
      var hit2 = null;
      R.forEach(function(p, j) {
        var q = R[(j + 1) % R.length], B = 1 - A;
        if ((p[B] - o[B]) * (q[B] - o[B]) > 0 || p[B] === q[B]) return;
        var X2 = p[A] + (q[A] - p[A]) * (o[B] - p[B]) / (q[B] - p[B]);
        if ((X2 - o[A]) * s > 1e-9 && (hit2 == null || (X2 - hit2) * s < 0)) hit2 = X2;
      });
      if (hit2 == null) return null;
      t[A] = hit2;
      return { to: dec2(t) };
    }
    if (round != null) {
      var X = walk(R, loc, round, null, 0, g);
      return X ? { to: dec2(X), di: round } : null;
    }
    var r = along(R, loc, A, s, g);
    if (r) return { to: dec2(r.to), di: r.di };
    var probe = loc.pt.slice();
    probe[A] += s * 0.5;
    t = loc.pt.slice();
    t[A] = gridNext(t[A], s, g);
    return inRim(R, probe) && inRim(R, t) && onRim(R, t).d > 0.05 ? { to: dec2(t) } : null;
  }
  function gridSpot(n, q, free) {
    var R = rim(n), loc = onRim(R, q), inn = inRim(R, q);
    if (free) return dec2(inn ? q : loc.pt);
    if (inn && loc.d > 3 / V.z) {
      var PG = lineStep(), x02 = Math.floor(q[0] / PG) * PG, y02 = Math.floor(q[1] / PG) * PG, best = null, bd = Infinity;
      [0, PG].forEach(function(dx) {
        [0, PG].forEach(function(dy) {
          var g = [x02 + dx, y02 + dy], d = Math.hypot(g[0] - q[0], g[1] - q[1]);
          if (d < bd && inRim(R, g) && onRim(R, g).d > 0.05) {
            bd = d;
            best = g;
          }
        });
      });
      if (best) return best;
    }
    var PG = lineStep(), p = loc.pt, j = loc.j, w = [R[(j + 1) % R.length][0] - R[j][0], R[(j + 1) % R.length][1] - R[j][1]], A = keyAx(w), v = Math.round(p[A] / PG) * PG;
    if (Math.abs(v - p[A]) < 1e-6) return dec2(p);
    var r = along(R, loc, A, Math.sign(v - p[A]), PG);
    return dec2(r ? r.to : p);
  }
  function spotNo(pp, to) {
    var S = procSpots(pp), best = null, bd = Infinity;
    if (S) S.forEach(function(o, i) {
      var d = Math.hypot(o[0] - to[0], o[1] - to[1]);
      if (d < bd) {
        bd = d;
        best = i + 2;
      }
    });
    return best;
  }
  var EPN;
  var MODS;
  function __run353() {
    EPN = /^(Macromolecule|SimpleChemical|Complex|NucleicAcidFeature|UnspecifiedEntity|EmptySet|PerturbingAgent)$/;
    MODS = /^(white_circle|white_delta|white_delta_bar|t_shape|crows_foot_one|white_diamond)$/;
  }
  function roleOf(i) {
    var n = nodes2[i];
    if (n.comp || n.up != null && !nodes2[n.up].comp) return null;
    if (n.hub) return n.shape.kind === "Operator" ? "gate" : "proc";
    return EPN.test(n.shape.kind) ? "epn" : n.shape.kind === "Phenotype" ? "pheno" : n.shape.kind === "Tag" ? "tag" : null;
  }
  function takes0(k, end, i) {
    if (V.level !== "full") return false;
    var e = edges2[k], a = e.arr, other = end ? e.s : e.t, r = roleOf(i), ro = roleOf(other);
    var hub = function(x) {
      return x === "proc" || x === "gate";
    };
    if (shared.F.endTo) return shared.F.endTo(k, end, i);
    if (i === other || !r && !(hybOn() && nodes2[i].shape.kind === "Submap") || a[0] !== "none") return false;
    var tg = roleOf(e.s) === "tag" ? e.s : roleOf(e.t) === "tag" ? e.t : null;
    if (a[1] === "none" && tg != null) return (end ? e.t : e.s) !== tg && r === "epn";
    if (a[1] === "none") {
      if (!hub(roleOf(e.s)) && !hub(roleOf(e.t))) return false;
      var h = hub(roleOf(e.t)) ? 1 : 0;
      return end === h ? hub(r) && !(r === "proc" && ro === "gate") : r === "epn" || r === "gate" || r === "pheno";
    }
    if (a[1] === "delta") return hub(roleOf(end ? e.t : e.s)) ? r === "proc" : r !== "proc";
    return MODS.test(a[1]);
  }
  function takes(k, end, i) {
    return takes0(k, end, i) && !moveSays(k, end, i);
  }
  function landBox(i, b) {
    var H2 = nodes2[i].hub && window.yrender && hubPorts()[nodes2[i].id];
    if (!H2 || !H2[0] || !H2[1]) return b;
    var x1 = Math.min(b[0], H2[0][0], H2[1][0]), y1 = Math.min(b[1], H2[0][1], H2[1][1]);
    return [x1, y1, Math.max(b[0] + b[2], H2[0][0], H2[1][0]) - x1, Math.max(b[1] + b[3], H2[0][1], H2[1][1]) - y1];
  }
  function takerAt(pp, P) {
    var R = 4 / V.z, best = null, ba = Infinity;
    nodes2.forEach(function(n, i) {
      var b = landBox(i, bx(i));
      if (P[0] < b[0] - R || P[0] > b[0] + b[2] + R || P[1] < b[1] - R || P[1] > b[1] + b[3] + R) return;
      if (i !== pp.n && !takes(pp.k, pp.end, i)) return;
      if (b[2] * b[3] < ba) {
        ba = b[2] * b[3];
        best = i;
      }
    });
    return best;
  }
  function portOn(pp, i, P, free) {
    var b = bx(i), e = edges2[pp.k], H2 = nodes2[i].hub && window.yrender && hubPorts()[nodes2[i].id];
    if (!H2 || !hubEnd(pp.k, pp.end, i)) return spot({ k: pp.k, end: pp.end, n: i }, P, free);
    var q = pp.end || e.arr[1] === "none" && !nodes2[e.t].hub ? H2[0] : H2[1];
    return [q[0] - b[0] - b[2] / 2, q[1] - b[1] - b[3] / 2];
  }
  function aim(pp, P, free) {
    var i = takerAt(pp, P), b;
    pp.n2 = null;
    pp.free = false;
    pp.home = null;
    if (i == null && !pp.hub && !free && !shared.F.fixedEnds) i = pp.n;
    if (i === pp.n) {
      if (pp.hub) {
        var q = ports(pp.k);
        pp.to = null;
        pp.home = q[pp.end ? q.length - 1 : 0];
        return;
      }
      pp.to = spot(pp, P, free);
      return;
    }
    if (i != null) {
      pp.n2 = i;
      pp.to = portOn(pp, i, P, free);
      return;
    }
    b = bx(pp.n);
    pp.free = true;
    pp.to = [P[0] - b[0] - b[2] / 2, P[1] - b[1] - b[3] / 2];
  }
  function reconnect(pp) {
    shared.part = null;
    shared.frozen = true;
    setPorts([pp], { k: pp.k, att: pp.end ? "target" : "source", id: nodes2[pp.n2].id.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;") });
  }
  function setPort(pp, merge) {
    setPorts([pp], null, merge);
  }
  function setPorts(list2, re, merge) {
    var all = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, "Path")), by = /* @__PURE__ */ new Map();
    if (re && (shared.text.match(/<edge\b[^>]*>/g) || []).length !== edges2.length) {
      shared.frozen = false;
      warn("The line could not be moved to another node: the file is not read edge for edge.");
      unshift();
      paint();
      return;
    }
    list2.forEach(function(pp) {
      var e = edges2[pp.k], a = pp.end ? ["tx", "ty"] : ["sx", "sy"], no2 = spotNo(pp, pp.to), vals = [fmt(pp.to[0]), fmt(pp.to[1])];
      if (no2) {
        a = a.concat("spot");
        vals.push(String(no2));
      }
      if (!re && Math.abs((num(e.path, a[0]) || 0) - pp.to[0]) < 0.01 && Math.abs((num(e.path, a[1]) || 0) - pp.to[1]) < 0.01) return;
      var nth = all.indexOf(e.path);
      by.set(nth, (by.get(nth) || []).concat(a.map(function(k, j) {
        return [k, vals[j]];
      })));
    });
    if (!by.size) {
      unshift();
      paint();
      return;
    }
    remember(!!merge);
    setText(import_graphml_edit.default.ends(shared.text, by, re));
    parse();
    shared.dirty = true;
    render();
    paint();
    changed();
  }
  function paint() {
    palShow();
    if (V.img && V.img.querySelectorAll) {
      V.img.querySelectorAll(".m2-ed-blue").forEach(function(x) {
        x.classList.remove("m2-ed-blue");
      });
    }
    gridPaint();
    if (!on || V.current !== map) {
      overlay.innerHTML = "";
      return;
    }
    var out = [], over = [];
    var pk0 = liveLines(out);
    shared.selP.forEach(function(pi) {
      if (shared.selE.some(function(k) {
        return edges2[k].pts.indexOf(pi) >= 0;
      })) return;
      var q = pt(pi), a2 = markSize(), g = markReach() - a2, X = sx(q[0]), Y3 = sy(q[1]);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(c2) {
        over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(c2[0] < 0 ? X - g - a2 : X + g) + '" y="' + f1(c2[1] < 0 ? Y3 - g - a2 : Y3 + g) + '" width="' + f1(a2) + '" height="' + f1(a2) + '"/>');
      });
    });
    var L = lit(), hlE = L.e, glyphs = L.g;
    var blueG = function(g) {
      var cs = shared.copies.filter(function(c2) {
        return c2[1] === g;
      });
      if (cs.length) cs.forEach(function(c2) {
        if (c2[0].classList) c2[0].classList.add("m2-ed-blue");
      });
      else g.classList.add("m2-ed-blue");
    };
    hlE.forEach(function(k) {
      var gs = gE && gE[edges2[k].id];
      if (gs) return blueG(gs[gs.length - 1]);
      var pts = line(k, null, null, pk0);
      if (pts) out.push('<path class="m2-ed-sel" stroke-width="' + f1(V.z) + '" d="' + livePath(pts, edges2[k].smooth) + '"/>');
    });
    glyphs.forEach(function(i) {
      var g = gN && gN[nodes2[i].id];
      if (g) return blueG(g);
      var b = bx(i);
      out.push('<rect class="m2-ed-sel" stroke-width="' + f1(V.z) + '" x="' + f1(sx(b[0])) + '" y="' + f1(sy(b[1])) + '" width="' + f1(b[2] * V.z) + '" height="' + f1(b[3] * V.z) + '"/>');
    });
    hlE.forEach(function(k) {
      var e = edges2[k];
      if (e.s == null || e.t == null) return;
      var all = ports(k, pk0), grouped = !!shared.F.ownLine && shared.F.ownLine(e.id);
      var pj = !drag && shared.part && shared.part.k === k && !shared.selN.length && !shared.selP.length ? shared.part.port ? shared.part.port.end ? all.length - 1 : 0 : e.pts.indexOf(shared.part.p) + 1 : -1;
      all.forEach(function(q, j) {
        var sqAt = function(n) {
          return glyphs.has(n) || shared.F.square(nodes2[n].id) != null;
        };
        if (grouped && (j === 0 && sqAt(e.s) || j === all.length - 1 && sqAt(e.t))) return;
        if (j === pj) return;
        if (drag && drag.port && (drag.port.to || drag.port.home) && drag.port.k === k && j === (drag.port.end ? all.length - 1 : 0)) return;
        over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(sx(q[0]) - sq() / 2) + '" y="' + f1(sy(q[1]) - sq() / 2) + '" width="' + f1(sq()) + '" height="' + f1(sq()) + '"/>');
      });
    });
    var pt1 = !drag ? partSel() : null;
    if (pt1) {
      var qa = ports(pt1.k), Q = pt1.port ? qa[pt1.port.end ? qa.length - 1 : 0] : pt(pt1.p);
      var a1 = markSize(), g1 = markReach() - a1, X1 = sx(Q[0]), Y1 = sy(Q[1]);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(c2) {
        over.push('<rect class="m2-ed-bend"' + sw(0.5) + ' x="' + f1(c2[0] < 0 ? X1 - g1 - a1 : X1 + g1) + '" y="' + f1(c2[1] < 0 ? Y1 - g1 - a1 : Y1 + g1) + '" width="' + f1(a1) + '" height="' + f1(a1) + '"/>');
      });
    }
    if (drag && drag.port && drag.port.to) {
      var pk = drag.port, n0 = pk.n2 != null ? pk.n2 : pk.n, b0 = bx(n0), c0 = [b0[0] + b0[2] / 2, b0[1] + b0[3] / 2];
      var at0 = function(o) {
        return [c0[0] + o[0], c0[1] + o[1]];
      };
      over.push(pk.free ? landMarks((procSpots(pk) || hubSides(pk) || []).map(at0), null) + landMarks([], at0(pk.to), "m2-ed-handle") : landMarks((placesOf({ k: pk.k, end: pk.end, n: n0 }) || []).map(at0), at0(pk.to)));
    }
    if (drag && drag.port && drag.port.home) over.push(landMarks([], drag.port.home));
    if (!drag && keyGuides) keyGuides.forEach(function(g) {
      out.push('<path class="m2-ed-guide"' + gw() + ' d="M' + f1(sx(g[0][0])) + " " + f1(sy(g[0][1])) + "L" + f1(sx(g[1][0])) + " " + f1(sy(g[1][1])) + '"/>');
    });
    if (drag && drag.guides) drag.guides.forEach(function(g) {
      out.push('<path class="m2-ed-guide"' + gw() + ' d="M' + f1(sx(g[0][0])) + " " + f1(sy(g[0][1])) + "L" + f1(sx(g[1][0])) + " " + f1(sy(g[1][1])) + '"/>');
    });
    var seg = function(g) {
      return "M" + f1(sx(g[0][0])) + " " + f1(sy(g[0][1])) + "L" + f1(sx(g[1][0])) + " " + f1(sy(g[1][1]));
    };
    if (drag && drag.lines) drag.lines.forEach(function(g) {
      out.push('<path class="m2-ed-snapline"' + gw() + ' d="' + seg(g) + '"/>');
    });
    if (drag && drag.crosses) drag.crosses.forEach(function(q) {
      var X = sx(q[0]), Y2 = sy(q[1]), r = Math.max(3.5 * V.z, 4);
      out.push('<path class="m2-ed-snapline"' + gw() + ' d="M' + f1(X - r) + " " + f1(Y2 - r) + "L" + f1(X + r) + " " + f1(Y2 + r) + "M" + f1(X - r) + " " + f1(Y2 + r) + "L" + f1(X + r) + " " + f1(Y2 - r) + '"/>');
    });
    if (drag && drag.ext) drag.ext.forEach(function(g) {
      out.push('<path class="m2-ed-snapline"' + gw() + ' d="' + seg(g) + '"/>');
    });
    if (drag && drag.marks) drag.marks.forEach(function(g) {
      var X0 = sx(g[0][0]), Y0 = sy(g[0][1]), X12 = sx(g[1][0]), Y12 = sy(g[1][1]), t = Math.max(3 * V.z, 3);
      var u = X12 - X0, v = Y12 - Y0, L2 = Math.hypot(u, v) || 1;
      u *= t / L2;
      v *= t / L2;
      var head = function(X, Y2, s) {
        return "M" + f1(X + s * u - v) + " " + f1(Y2 + s * v + u) + "L" + f1(X) + " " + f1(Y2) + "L" + f1(X + s * u + v) + " " + f1(Y2 + s * v - u);
      };
      out.push('<path class="m2-ed-mark"' + gw() + ' d="' + seg(g) + head(X0, Y0, 1) + head(X12, Y12, -1) + '"/>');
    });
    shared.selN.forEach(function(i) {
      over.push(handleMarks(bx(i), "m2-ed-handle"));
    });
    if (drag && (drag.dx || drag.dy) && !gN) {
      var dx = drag.dx, dy = drag.dy, moving2 = /* @__PURE__ */ new Set(), ps = new Set(shared.selP);
      shared.selN.forEach(function(i) {
        moving2.add(i);
        nodes2[i].inside.forEach(function(c2) {
          moving2.add(c2);
        });
      });
      shared.selE.forEach(function(k) {
        edges2[k].pts.forEach(function(p) {
          ps.add(p);
        });
      });
      moving2.forEach(function(i) {
        var b = boxOf(i);
        over.push('<rect class="m2-ed-ghost" x="' + sx(b[0] + dx) + '" y="' + sy(b[1] + dy) + '" width="' + b[2] * V.z + '" height="' + b[3] * V.z + '"/>');
      });
      ps.forEach(function(i) {
        var p = points[i];
        over.push('<rect class="m2-ed-ghost" x="' + f1(sx(num(p, "x") + dx) - 3.5) + '" y="' + f1(sy(num(p, "y") + dy) - 3.5) + '" width="7" height="7"/>');
      });
    }
    if (band) {
      var a = [Math.min(band.x, band.x2), Math.min(band.y, band.y2)], c = [Math.max(band.x, band.x2), Math.max(band.y, band.y2)];
      over.push('<rect class="m2-ed-band" x="' + sx(a[0]) + '" y="' + sy(a[1]) + '" width="' + (c[0] - a[0]) * V.z + '" height="' + (c[1] - a[1]) * V.z + '"/>');
    }
    overlay.classList.toggle("m2-ed-cd", !!shared.F.magenta);
    svMarks(over);
    linkPaint(out);
    overlay.innerHTML = out.concat(over).join("");
  }
  function at(e) {
    var r = V.view.getBoundingClientRect(), vx = (e.clientX - r.left) / V.pz(), vy = (e.clientY - r.top) / V.pz();
    return [(vx - V.tx) / V.z + x0, (vy - V.ty) / V.z + y0];
  }
  function near(P, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L)) : 0;
    return Math.hypot(P[0] - a[0] - dx * t, P[1] - a[1] - dy * t);
  }
  function inComplex(i) {
    return hm().inComplex(i);
  }
  function hit(P) {
    var R = 6 / V.z, best = null, group = null;
    var dB = Infinity, ofArc = /* @__PURE__ */ new Set();
    shared.selE.forEach(function(k) {
      edges2[k].pts.forEach(function(q) {
        ofArc.add(q);
      });
    });
    points.forEach(function(p, i) {
      var dx = Math.abs(num(p, "x") - P[0]), dy = Math.abs(num(p, "y") - P[1]);
      if (dx > R || dy > R) return;
      var d = Math.hypot(dx, dy) - (shared.selP.indexOf(i) >= 0 ? 4 * R : ofArc.has(i) ? 2 * R : 0);
      if (d < dB) {
        dB = d;
        best = { p: i };
      }
    });
    if (best) return best;
    nodes2.forEach(function(n, i) {
      var b = boxOf(i);
      if (!(P[0] >= b[0] && P[0] <= b[0] + b[2] && P[1] >= b[1] && P[1] <= b[1] + b[3])) return;
      var h = { n: i, area: b[2] * b[3] };
      var gm = shared.F.square(n.id);
      if (gm != null) {
        var ga = edges2.findIndex(function(q) {
          return q.id === gm + "|a";
        });
        if (ga >= 0 && !best) best = { e: ga, glyph: true, area: 0 };
        return;
      }
      if (shared.afSbgn && inComplex(i)) return;
      if ((n.kids.length || n.comp) && !(shared.afSbgn && n.shape.kind === "Complex")) {
        if (!group || h.area < group.area) group = h;
      } else if (!best || h.area < best.area) best = h;
    });
    if (best) return best;
    var E = 5 / V.z, d0 = E;
    edges2.forEach(function(e, k) {
      var pts = line(k);
      if (!pts) return;
      for (var j = 1; j < pts.length; j++) {
        var d = near(P, pts[j - 1], pts[j]);
        if (d <= d0) {
          d0 = d;
          best = { e: k };
        }
      }
    });
    return best || group;
  }
  function editing(e) {
    return on && V.current === map && !e.target.closest(".m2-ctrl, .m2-info, .m2-ed-type");
  }
  function __run363() {
    V.view.addEventListener("pointerdown", function(e) {
      keyGuides = null;
      keyFlush();
      shared.tap = null;
      if (!editing(e)) return;
      var P0 = at(e);
      if (e.button === 2 || e.button === 0 && e.ctrlKey && /Mac/.test(navigator.platform)) {
        rclick = P0;
        e.stopImmediatePropagation();
        return;
      }
      if (e.button !== 0) return;
      if (palDown(e)) return;
      var P = at(e), h = hit(P);
      var pp = !e.shiftKey && portAt(P);
      if (pp) {
        e.stopImmediatePropagation();
        e.preventDefault();
        V.view.setPointerCapture(e.pointerId);
        V.view.focus({ preventScroll: true });
        drag = { port: pp, x: P[0], y: P[1], dx: 0, dy: 0, cx: e.clientX, cy: e.clientY };
        mv = null;
        shared.part = { k: pp.k, port: pp };
        paint();
        return;
      }
      if (!(!e.shiftKey && handleAt(P, true)) && svDown(e, P, h)) return;
      var rz = !e.shiftKey && edgeAt(P);
      if (rz && h && h.p != null) rz = null;
      if (!rz && !e.shiftKey) {
        var ez0 = edgeAt(P, true);
        if (ez0 && (!h || h.p == null && h.e == null && h.n != null && nodes2[h.n].comp)) h = { n: ez0.c };
      }
      if (rz) {
        e.stopImmediatePropagation();
        e.preventDefault();
        V.view.setPointerCapture(e.pointerId);
        V.view.focus({ preventScroll: true });
        shared.selN = [rz.c];
        shared.selP = [];
        shared.selE = [];
        drag = { x: P[0], y: P[1], dx: 0, dy: 0, rs: { c: rz.c, s: rz.s, b0: boxOf(rz.c), cx: e.clientX, cy: e.clientY } };
        mv = null;
        paint();
        return;
      }
      var shiftOn = e.shiftKey && !!h && h.n != null && !h.glyph && shared.selN.indexOf(h.n) >= 0;
      var alone = shiftOn && (full() || shared.selN.every(function(i) {
        return !nodes2[i].kids.length && !inComplex(i);
      }));
      if (e.shiftKey && !shiftOn) {
        e.stopImmediatePropagation();
        e.preventDefault();
        V.view.setPointerCapture(e.pointerId);
        V.view.focus({ preventScroll: true });
        band = { x: P[0], y: P[1], x2: P[0], y2: P[1], h, add: true, cx: e.clientX, cy: e.clientY };
        paint();
        return;
      }
      var tapped = function() {
        if (e.pointerType === "mouse" && !V.grab) {
          e.stopImmediatePropagation();
          e.preventDefault();
          V.view.setPointerCapture(e.pointerId);
          V.view.focus({ preventScroll: true });
          band = { x: P[0], y: P[1], x2: P[0], y2: P[1], h, add: false, cx: e.clientX, cy: e.clientY };
          paint();
          return;
        }
        shared.tap = { h, shift: e.shiftKey, x: e.clientX, y: e.clientY };
        V.view.focus({ preventScroll: true });
      };
      if (!h) return tapped();
      if (!alone && linkDown(e, P, h)) return;
      if (h.glyph) return tapped();
      var list2 = h.p != null ? shared.selP : h.e != null ? shared.selE : shared.selN, k = h.p != null ? h.p : h.e != null ? h.e : h.n, there = list2.indexOf(k) >= 0;
      var keepE = null;
      if (!there && h.p != null && shared.selE.some(function(q) {
        return edges2[q].pts.indexOf(h.p) >= 0;
      })) {
        shared.part = { k: shared.selE.find(function(q) {
          return edges2[q].pts.indexOf(h.p) >= 0;
        }), p: h.p };
        keepE = shared.selE.slice();
        shared.selN = [];
        shared.selE = [];
        shared.selP = [h.p];
        list2 = shared.selP;
        there = true;
      }
      if (!there && h.p != null && !keepE) {
        var ak = edges2.findIndex(function(q) {
          return q.pts.indexOf(h.p) >= 0;
        });
        if (ak >= 0) {
          h = { e: ak };
          return tapped();
        }
      }
      if (!there) return tapped();
      e.stopImmediatePropagation();
      e.preventDefault();
      V.view.setPointerCapture(e.pointerId);
      V.view.focus({ preventScroll: true });
      drag = {
        x: P[0],
        y: P[1],
        dx: 0,
        dy: 0,
        p: h.p != null && shared.selP.indexOf(h.p) >= 0 ? h.p : null,
        guides: [],
        n: h.n != null && shared.selN.indexOf(h.n) >= 0 ? h.n : null,
        e: h.e != null && shared.selE.indexOf(h.e) >= 0 ? h.e : null,
        keepE,
        sx0: e.clientX,
        sy0: e.clientY,
        alone,
        away: { x0: 0, x1: 0, y0: 0, y1: 0 }
      };
      if (h.e != null && !e.shiftKey) drag.grab = { k: h.e, P, sx: e.clientX, sy: e.clientY };
      mv = moving(alone);
      paint();
    }, true);
  }
  function ports(k, pp) {
    var e = edges2[k], mine2 = pp && pp.to && pp.k === k, ns = mine2 && !pp.end && pp.n2 != null ? pp.n2 : e.s, nt = mine2 && pp.end && pp.n2 != null ? pp.n2 : e.t, pa = e.path, o = function(a) {
      if (mine2 && (pp.end ? "t" : "s") === a[0]) return pp.to[a[1] === "x" ? 0 : 1];
      return pa ? parseFloat(pa.getAttribute(a)) || 0 : 0;
    };
    var S = bx(ns), T = bx(nt), so = posePort(ns, [o("sx"), o("sy")], k), to = posePort(nt, [o("tx"), o("ty")], k);
    return [[S[0] + S[2] / 2 + so[0], S[1] + S[3] / 2 + so[1]]].concat(e.pts.map(pt), [[T[0] + T[2] / 2 + to[0], T[1] + T[3] / 2 + to[1]]]);
  }
  function snap(d) {
    d.guides = [];
    var k = -1, j = -1;
    edges2.forEach(function(e, i) {
      var at2 = e.pts.indexOf(d.p);
      if (at2 >= 0) {
        k = i;
        j = at2 + 1;
      }
    });
    if (k < 0 || edges2[k].s == null || edges2[k].t == null) return;
    mv.dx = d.dx;
    mv.dy = d.dy;
    var all = ports(k), B = all[j], nb = [beyond(k, j - 1, all), beyond(k, j + 1, all)].filter(function(q) {
      return !(q[1] != null && mv.p.has(q[1]));
    }).map(function(q) {
      return q[0];
    });
    var T = 6 / V.z, cx = null, cy = null;
    nb.forEach(function(q) {
      if (Math.abs(q[0] - B[0]) <= T && (cx == null || Math.abs(q[0] - B[0]) < Math.abs(cx))) cx = q[0] - B[0];
      if (Math.abs(q[1] - B[1]) <= T && (cy == null || Math.abs(q[1] - B[1]) < Math.abs(cy))) cy = q[1] - B[1];
    });
    glyphArcs(d.p).forEach(function(o) {
      [0, 1].forEach(function(cm) {
        [0, 1].forEach(function(a) {
          var c = joinSolve(o, d.p, B, a, cm);
          if (c == null || Math.abs(c) > T) return;
          if (a === 0 && (cx == null || Math.abs(c) < Math.abs(cx))) cx = c;
          if (a === 1 && (cy == null || Math.abs(c) < Math.abs(cy))) cy = c;
        });
      });
    });
    if (cx != null) d.dx += cx;
    if (cy != null) d.dy += cy;
    d.gx = cx != null;
    d.gy = cy != null;
    var C = [B[0] + (cx || 0), B[1] + (cy || 0)];
    nb.forEach(function(q) {
      if (Math.abs(q[0] - C[0]) < 0.01 || Math.abs(q[1] - C[1]) < 0.01) d.guides.push([C, q]);
    });
    d.guides = d.guides.concat(joinGuides(d.p, C));
  }
  function bend(k, P) {
    var e = edges2[k], pts = line(k);
    if (!pts || !e.path) return null;
    var j = 1, dmin = Infinity;
    for (var i = 1; i < pts.length; i++) {
      var d0 = near(P, pts[i - 1], pts[i]);
      if (d0 < dmin) {
        dmin = d0;
        j = i;
      }
    }
    var a = pts[j - 1], b = pts[j], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L)) : 0;
    var Q = [Math.round((a[0] + dx * t) * 1e3) / 1e3, Math.round((a[1] + dy * t) * 1e3) / 1e3];
    var at2 = j - 1, first = function() {
      return Array.prototype.indexOf.call(doc.getElementsByTagNameNS(Y, "Path"), e.path);
    };
    var t2 = import_graphml_edit.default.bend(shared.text, at2 < e.pts.length ? { before: e.pts[at2] } : e.pts.length ? { after: e.pts[e.pts.length - 1] } : { path: first() }, Q[0], Q[1]);
    if (t2 == null) return null;
    remember(false);
    setText(t2);
    parse();
    return { p: edges2[k].pts[at2], at: Q, k: k + 1 };
  }
  function unbend(list2) {
    var t = import_graphml_edit.default.unbend(shared.text, list2);
    if (t === shared.text) return false;
    keyGuides = null;
    return commit(t, { name: "bend point removed", sel: [] });
  }
  var rclick;
  function __run373() {
    rclick = null;
  }
  function nowSvg() {
    return lastFor && !lastFor[3] && lastFor[0] === shared.text && lastFor[1] === shared.F.beside() ? lastSvg : null;
  }
  function shownSvg() {
    return nowSvg() || (lastFor && !lastFor[3] && site && lastFor[2] === site.id ? lastSvg : null);
  }
  function __run382() {
    window.m2EditSites = function() {
      if (on) paint();
      if (!on || !site || !shared.F.sitesOut || !shared.F.sitesOut()) return;
      if (src() === (site.saved || site.base)) return;
      shared.dirty = true;
      changed();
    };
    window.m2EditNow = function() {
      return on && site && site.id && shared.text ? { id: site.id, text: src(), svg: shownSvg(), file: name } : null;
    };
    window.m2EditTurn = function() {
      if (!on || V.current !== map || !rclick || !window.yrender || onOwnMenu()) return null;
      var h = hit(rclick);
      if (!h || h.n == null || !nodes2[h.n].hub) return null;
      var i = h.n, gate = nodes2[i].shape.kind === "Operator";
      return { label: gate ? "Turn logic gate" : "Turn process", go: function() {
        turn(i);
      } };
    };
    window.m2EditMain = function() {
      if (!on || V.current !== map || !rclick || !shared.F.mainLines || !window.cd_edit || onOwnMenu()) return null;
      var h = hit(rclick), k = h && h.e != null && !h.glyph ? h.e : h && h.p != null ? edges2.findIndex(function(e) {
        return e.pts.indexOf(h.p) >= 0;
      }) : -1;
      if (k < 0 || !/\|[rp]\d+$/.test(edges2[k].id)) return null;
      var t2 = window.cd_edit.makeMain(shared.text, edges2[k].id);
      if (!t2) return null;
      return { label: /\|r\d+$/.test(edges2[k].id) ? "Make main reactant" : "Make main product", go: function() {
        keyGuides = null;
        commit(t2, { name: "make main", ids: [edges2[k].id], sel: [] });
      } };
    };
  }
  function onOwnMenu() {
    return ownMenus.some(function(f) {
      return f(rclick);
    });
  }
  function __run392() {
    window.m2EditBend = function() {
      if (!on || V.current !== map || !rclick || onOwnMenu()) return null;
      var h = hit(rclick);
      if (!h || h.p == null) return null;
      var pi = h.p;
      return function() {
        unbend([pi]);
      };
    };
  }
  function emptyClick() {
    if (!on || V.current !== map || !shared.text || !rclick) return false;
    if (ownMenus.some(function(f) {
      return f(rclick);
    })) return false;
    var h = hit(rclick);
    return !h || h.n != null && asSpace(h.n);
  }
  function asSpace(i) {
    return nodes2[i].kids.length > 0 && nodes2[i].shape.kind !== "Complex";
  }
  var ownMenus;
  var ownCursors;
  function __run402() {
    window.m2EditOnObject = function() {
      return !!(on && V.current === map && shared.text && rclick) && !emptyClick();
    };
    window.m2EditAllBends = function() {
      if (!points.length || !emptyClick()) return null;
      return function() {
        unbend(points.map(function(p, i) {
          return i;
        }));
      };
    };
    ownMenus = [];
    ownCursors = [];
  }
  function complexHere(member) {
    if (!on || V.current !== map || !shared.text || !rclick || member && (emptyClick() || ownMenus.some(function(f) {
      return f(rclick);
    }))) return null;
    var h = hit(rclick), c = h && h.n != null ? h.n : null;
    while (c != null && nodes2[c].shape.kind !== "Complex") c = nodes2[c].up;
    return c;
  }
  var GAP_OUT;
  var CLOSE;
  function __run412() {
    window.m2EditPackHere = function(member) {
      var c = complexHere(member);
      if (c != null) c = outerComplex(c);
      if (c == null) return null;
      var id = nodes2[c].id;
      return function() {
        pack([id]);
      };
    };
    window.m2EditMapItems = function() {
      if (!emptyClick()) return null;
      var tick = function(v) {
        return v ? '<span class="m2-cx-key" aria-hidden="true">\u2713</span>' : "";
      };
      return [
        ["Snap map to grid", snapMap],
        ["Repack all complexes", function() {
          pack([]);
        }],
        ["Show grid", gridShow, tick(gridSet.shown), gridSet.shown],
        ["Snap to grid", gridSnap, tick(gridSet.snap), gridSet.snap]
      ].concat(shared.F.mapItems && shared.F.mapItems() || []);
    };
    window.m2EditAddBend = function() {
      if (!on || V.current !== map || !rclick || onOwnMenu()) return null;
      var h = hit(rclick), P = rclick;
      if (!h || h.e == null || h.glyph) return null;
      var k = h.e;
      return function() {
        var nb = bend(k, P);
        if (!nb) return;
        shared.selN = [];
        shared.selP = [];
        shared.selE = [k];
        keyGuides = null;
        shared.dirty = true;
        render();
        paint();
        changed();
      };
    };
    GAP_OUT = 12;
    CLOSE = 40;
  }
  function snapNode(d) {
    d.guides = [];
    d.lines = [];
    d.marks = [];
    d.ext = [];
    d.crosses = [];
    var T = 6 / V.z, b0 = boxOf(d.n), cand = { x: [], y: [] }, moved = mv.n, up = /* @__PURE__ */ new Set();
    nodes2.forEach(function(n, i) {
      if (n.inside.indexOf(d.n) >= 0) up.add(i);
    });
    var r = V.view.getBoundingClientRect(), v0 = [-V.tx / V.z + x0, -V.ty / V.z + y0], v1 = [(r.width / V.pz() - V.tx) / V.z + x0, (r.height / V.pz() - V.ty) / V.z + y0];
    var B = [b0[0] + d.dx, b0[1] + d.dy, b0[2], b0[3]];
    function add(ax, cur, to, rank, why) {
      var c = to - cur;
      if (Math.abs(c) <= T) cand[ax].push({ c, rank, why });
    }
    mv.dx = d.dx;
    mv.dy = d.dy;
    edges2.forEach(function(e, k) {
      if (e.s == null || e.t == null || moved.has(e.s) === moved.has(e.t)) return;
      var P = ports(k), a = moved.has(e.s), i = a ? 0 : P.length - 1, j = a ? 1 : P.length - 2;
      var pi = a ? e.pts[0] : e.pts[e.pts.length - 1];
      if (pi != null && mv.p.has(pi)) return;
      add("x", P[i][0], P[j][0], 1, { arc: k, end: i, to: j });
      add("y", P[i][1], P[j][1], 1, { arc: k, end: i, to: j });
    });
    var cx = B[0] + B[2] / 2, cy = B[1] + B[3] / 2;
    var others = [];
    nodes2.forEach(function(n, i) {
      if (moved.has(i) || up.has(i)) return;
      var o = boxOf(i);
      if (o[0] > v1[0] || o[1] > v1[1] || o[0] + o[2] < v0[0] || o[1] + o[3] < v0[1]) return;
      others.push(o);
      add("x", cx, o[0] + o[2] / 2, 2, { c: o, ax: "x" });
      add("y", cy, o[1] + o[3] / 2, 2, { c: o, ax: "y" });
      add("x", B[0], o[0], 3, { s: o, at: 0 });
      add("x", B[0] + B[2], o[0] + o[2], 3, { s: o, at: 1 });
      add("y", B[1], o[1], 3, { s: o, at: 0 });
      add("y", B[1] + B[3], o[1] + o[3], 3, { s: o, at: 1 });
      var gx = Math.max(o[0] - B[0] - B[2], B[0] - o[0] - o[2]), gy = Math.max(o[1] - B[1] - B[3], B[1] - o[1] - o[3]);
      if (gx <= CLOSE) {
        add("y", B[1], o[1] + o[3], 3, { s: o, at: 1 });
        add("y", B[1] + B[3], o[1], 3, { s: o, at: 0 });
      }
      if (gy <= CLOSE) {
        add("x", B[0], o[0] + o[2], 3, { s: o, at: 1 });
        add("x", B[0] + B[2], o[0], 3, { s: o, at: 0 });
      }
    });
    var NEAR = CLOSE / 2;
    ["x", "y"].forEach(function(ax) {
      var h = ax === "x" ? 0 : 1, w = 1 - h;
      function seen(a, m, dir) {
        var lo2 = a[w] - m, hi2 = a[w] + a[w + 2] + m, cov = [], out = [];
        var gap = function(o) {
          return dir > 0 ? o[h] - a[h] - a[h + 2] : a[h] - o[h] - o[h + 2];
        };
        others.filter(function(o) {
          return o !== a && gap(o) >= 0;
        }).sort(function(p, q) {
          return gap(p) - gap(q);
        }).some(function(o) {
          var s0 = Math.max(o[w], lo2), e0 = Math.min(o[w] + o[w + 2], hi2);
          if (s0 >= e0) return false;
          var reach = function(x) {
            cov.forEach(function(c) {
              if (c[0] <= x && c[1] > x) x = c[1];
            });
            return x;
          };
          if (reach(s0) < e0) out.push([o, gap(o)]);
          var k = 0;
          while (k < cov.length && cov[k][0] <= s0) k++;
          cov.splice(k, 0, [s0, e0]);
          return reach(lo2) >= hi2;
        });
        return out;
      }
      var lo = seen(B, NEAR, -1)[0], hi = seen(B, NEAR, 1)[0], bef = seen(B, 0, -1), aft = seen(B, 0, 1);
      if (lo && hi) add(ax, B[h], (lo[0][h] + lo[0][h + 2] + hi[0][h] - B[h + 2]) / 2, 4, { mid: [lo[0], hi[0]] });
      if (!bef.length && !aft.length) return;
      [[bef, -1], [aft, 1]].forEach(function(sd) {
        sd[0].forEach(function(nq) {
          var nb = nq[0];
          seen(nb, 0, sd[1]).forEach(function(fq2) {
            if (fq2[1] <= 0) return;
            var p = sd[1] > 0 ? [nb, fq2[0], fq2[1]] : [fq2[0], nb, fq2[1]];
            if (sd[1] > 0) add(ax, B[h] + B[h + 2], nb[h] - fq2[1], 4, { rep: p, nb, side: 1 });
            else add(ax, B[h], nb[h] + nb[h + 2] + fq2[1], 4, { rep: p, nb, side: 0 });
          });
        });
      });
    });
    add("x", d.dx, 0, 5, null);
    add("y", d.dy, 0, 5, null);
    ["x", "y"].forEach(function(ax) {
      var l = cand[ax];
      if (!l.length) {
        d["w" + ax] = [];
        return;
      }
      var m = Math.min.apply(null, l.map(function(q) {
        return Math.abs(q.c);
      })), z1 = 1 / V.z;
      var pick = l.filter(function(q) {
        return Math.abs(q.c) <= m + z1;
      }).sort(function(a, b) {
        return a.rank - b.rank;
      })[0];
      if (ax === "x") {
        d.dx += pick.c;
        d.gx = true;
      } else {
        d.dy += pick.c;
        d.gy = true;
      }
      d["w" + ax] = l.filter(function(q) {
        return Math.abs(q.c - pick.c) < 0.01 && q.why;
      }).map(function(q) {
        return q.why;
      });
    });
    mv.dx = d.dx;
    mv.dy = d.dy;
    var F = [b0[0] + d.dx, b0[1] + d.dy, b0[2], b0[3]], E = CLOSE / 2;
    var dist = function(p) {
      return Math.abs(p[0][0] + p[1][0] + (p[0][2] + p[1][2]) / 2 - 2 * F[0] - F[2]) + Math.abs(p[0][1] + p[1][1] + (p[0][3] + p[1][3]) / 2 - 2 * F[1] - F[3]);
    };
    ["x", "y"].forEach(function(ax) {
      var h = ax === "x" ? 0 : 1, w = 1 - h;
      var gaps = [], rep = [];
      (d["w" + ax] || []).forEach(function(q) {
        if (q.arc != null) {
          var P = ports(q.arc);
          d.guides.push([P[q.end], P[q.to]]);
          return;
        }
        var o = q.c || q.s;
        if (o) {
          var at2 = q.c ? o[h] + o[h + 2] / 2 : o[h] + o[h + 2] * q.at, a = Math.min(o[w], F[w]) - E, c = Math.max(o[w] + o[w + 2], F[w] + F[w + 2]) + E;
          d.lines.push(h === 0 ? [[at2, a], [at2, c]] : [[a, at2], [c, at2]]);
          var m1 = o[w] + o[w + 2] / 2, m2 = F[w] + F[w + 2] / 2;
          d.crosses.push(h === 0 ? [at2, m1] : [m1, at2], h === 0 ? [at2, m2] : [m2, at2]);
          return;
        }
        if (q.mid) gaps.push([q.mid[0], F], [F, q.mid[1]]);
        if (q.rep && (!rep[q.side] || dist(q.rep) < dist(rep[q.side].rep))) rep[q.side] = q;
      });
      var has = function(a, b) {
        return gaps.some(function(g) {
          return g[0] === a && g[1] === b;
        });
      };
      rep.forEach(function(q) {
        [q.side ? [F, q.nb] : [q.nb, F], [q.rep[0], q.rep[1]]].forEach(function(g) {
          if (!has(g[0], g[1])) gaps.push(g);
        });
      });
      var pt2 = function(along2, acr) {
        return h === 0 ? [along2, acr] : [acr, along2];
      };
      var mark2 = function(gs, far) {
        var boxes = [];
        gs.forEach(function(g) {
          g.forEach(function(o) {
            if (boxes.indexOf(o) < 0) boxes.push(o);
          });
        });
        var at2 = far ? Math.max.apply(null, boxes.map(function(o) {
          return o[w] + o[w + 2];
        })) + GAP_OUT : Math.min.apply(null, boxes.map(function(o) {
          return o[w];
        })) - GAP_OUT, past = far ? 4 : -4;
        gs.forEach(function(g) {
          var a = g[0][h] + g[0][h + 2], b = g[1][h];
          d.marks.push([pt2(a, at2), pt2(b, at2)]);
          d.ext.push([pt2(a, at2 + past), pt2(a, far ? g[0][w] + g[0][w + 2] : g[0][w])], [pt2(b, at2 + past), pt2(b, far ? g[1][w] + g[1][w + 2] : g[1][w])]);
        });
      };
      var mid = function(o) {
        return o[w] + o[w + 2] / 2;
      }, mean = 0, k = 0;
      gaps.forEach(function(g) {
        g.forEach(function(o) {
          if (o !== F) {
            mean += mid(o);
            k++;
          }
        });
      });
      if (gaps.length) mark2(gaps, k > 0 && mid(F) > mean / k + 0.5);
    });
  }
  function onGrid(d) {
    var X, Y2, st;
    if (d.n != null) {
      var b = boxOf(d.n);
      X = b[0] + b[2] / 2;
      Y2 = b[1] + b[3] / 2;
      st = gridSet.step;
    } else {
      var pi = d.p != null ? d.p : d.e != null && edges2[d.e].pts.length ? edges2[d.e].pts[0] : null;
      if (pi == null || shared.F.fixedEnds) return;
      X = num(points[pi], "x");
      Y2 = num(points[pi], "y");
      st = lineStep();
    }
    if (!d.gx) d.dx += toGrid(X + d.dx, st);
    if (!d.gy) d.dy += toGrid(Y2 + d.dy, st);
  }
  function tether(d) {
    mv.n.forEach(function(i) {
      var p = nodes2[i].up, s0 = boxOf(i);
      if (p == null || mv.n.has(p) || !nodes2[p].comp) return;
      var c = boxOf(p);
      if (!overlap(s0, c)) return;
      d.dx = Math.max(c[0] - s0[0] - s0[2] + 1, Math.min(c[0] + c[2] - s0[0] - 1, d.dx));
      d.dy = Math.max(c[1] - s0[1] - s0[3] + 1, Math.min(c[1] + c[3] - s0[1] - 1, d.dy));
    });
  }
  function __run423() {
    V.view.addEventListener("pointermove", function(e) {
      if (linkMove(e)) return;
      if (shared.tap && Math.hypot(e.clientX - shared.tap.x, e.clientY - shared.tap.y) >= 5) shared.tap = null;
      if ((drag || band) && e.pointerType === "mouse" && !e.buttons) return release(e);
      if (drag || band) {
        e.stopImmediatePropagation();
        var P = at(e);
        if (band) {
          band.x2 = P[0];
          band.y2 = P[1];
        } else if (drag.port) {
          if (drag.port.moved || Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) >= 4) {
            drag.port.moved = true;
            aim(drag.port, P, e.altKey || e.ctrlKey);
          }
        } else if (drag.rs && !drag.rs.go && Math.hypot(e.clientX - drag.rs.cx, e.clientY - drag.rs.cy) < 4) return;
        else if (drag.rs) {
          var seed = {}, rc = drag.rs.c;
          drag.rs.go = true;
          seed[rc] = nodes2[rc].comp ? resized(drag, P, gridSet.snap && !e.altKey && !e.ctrlKey) : holds(rc) ? roomy(rc, sized(drag, P, e.altKey || e.ctrlKey), drag.rs.s, drag.rs.b0) : sized(drag, P, e.altKey || e.ctrlKey);
          liveFit(seed);
          if (!holds(rc)) sizeLive(rc, seed[rc]);
          poseSize(rc, shared.liveC && shared.liveC[rc] || seed[rc]);
        } else if (drag.grab && Math.hypot(e.clientX - drag.grab.sx, e.clientY - drag.grab.sy) < 4) return;
        else {
          if (drag.grab) {
            var nb = bend(drag.grab.k, drag.grab.P);
            drag.grab = null;
            if (nb) {
              drag.x = nb.at[0];
              drag.y = nb.at[1];
              drag.p = nb.p;
              drag.e = null;
              drag.made = drag.made || nb.k;
              shared.selN = [];
              shared.selE = [];
              shared.selP = [nb.p];
              mv = moving();
            }
          }
          drag.dx = Math.round(P[0] - drag.x);
          drag.dy = Math.round(P[1] - drag.y);
          drag.gx = drag.gy = false;
          drag.guides = [];
          drag.lines = [];
          drag.marks = [];
          drag.ext = [];
          drag.crosses = [];
          if (drag.p != null) snap(drag);
          else if (drag.n != null && !e.altKey && !e.ctrlKey) snapNode(drag);
          if (gridSet.snap && !e.altKey && !e.ctrlKey) onGrid(drag);
          if (drag.alone && !full()) tether(drag);
          mv.dx = drag.dx;
          mv.dy = drag.dy;
          shift();
          var aw = drag.away;
          if (aw) aw.x0 = Math.min(aw.x0, drag.dx), aw.x1 = Math.max(aw.x1, drag.dx), aw.y0 = Math.min(aw.y0, drag.dy), aw.y1 = Math.max(aw.y1, drag.dy);
          if (mv.n.size) liveFit();
        }
        paint();
        return;
      }
      if (tool && on && V.current === map && !e.buttons) {
        V.view.style.cursor = "default";
        return;
      }
      if (on && V.current === map && !e.buttons) {
        var PP = at(e);
        var hh = e.shiftKey ? null : hit(PP), ez = !e.shiftKey && edgeAt(PP);
        if (ez && hh && hh.p != null) ez = null;
        var oc = null;
        ownCursors.some(function(f) {
          return oc = f(PP, !hh && !ez);
        });
        if (oc) {
          V.view.style.cursor = oc;
          return;
        }
        if (ez) {
          V.view.style.cursor = resizeCursor(ez.s);
          return;
        }
        var sel = hh && ((hh.p != null ? shared.selP.indexOf(hh.p) : hh.e != null ? shared.selE.indexOf(hh.e) : shared.selN.indexOf(hh.n)) >= 0 || hh.p != null && shared.selE.some(function(q) {
          return edges2[q].pts.indexOf(hh.p) >= 0;
        }));
        V.view.style.cursor = !hh ? "" : sel ? "move" : "pointer";
      }
    }, true);
  }
  function release(e) {
    if (palUp(e)) return;
    if (linkUp(e)) return;
    var t = shared.tap;
    shared.tap = null;
    if (t && e.type === "pointerup" && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 5) {
      e.stopImmediatePropagation();
      click(t);
      return;
    }
    if (!drag && !band) return;
    e.stopImmediatePropagation();
    if (band) {
      var bd = band;
      band = null;
      if (e.type === "pointerup" && Math.hypot(e.clientX - bd.cx, e.clientY - bd.cy) < 5) {
        click({ h: bd.h, shift: bd.add });
        return;
      }
      if (!bd.add) {
        shared.selN = [];
        shared.selP = [];
        shared.selE = [];
      }
      var a = [Math.min(bd.x, bd.x2), Math.min(bd.y, bd.y2)], c = [Math.max(bd.x, bd.x2), Math.max(bd.y, bd.y2)];
      nodes2.forEach(function(n, i) {
        var b = boxOf(i);
        if (shared.F.square(n.id) != null) return;
        if (b[0] >= a[0] && b[1] >= a[1] && b[0] + b[2] <= c[0] && b[1] + b[3] <= c[1] && shared.selN.indexOf(i) < 0) shared.selN.push(i);
      });
      points.forEach(function(p, i) {
        var X = num(p, "x"), Y2 = num(p, "y");
        if (X >= a[0] && Y2 >= a[1] && X <= c[0] && Y2 <= c[1] && shared.selP.indexOf(i) < 0) shared.selP.push(i);
      });
      shared.part = null;
      paint();
      return;
    }
    dragEnd(e);
  }
  function click(t) {
    var hs = t.h;
    shared.part = null;
    if (!hs) {
      if (!t.shift) {
        shared.selN = [];
        shared.selP = [];
        shared.selE = [];
      }
      paint();
      return;
    }
    var li = hs.p != null ? shared.selP : hs.e != null ? shared.selE : shared.selN, ki = hs.p != null ? hs.p : hs.e != null ? hs.e : hs.n;
    if (t.shift) {
      if (li.indexOf(ki) >= 0) li.splice(li.indexOf(ki), 1);
      else li.push(ki);
    } else {
      shared.selN = hs.n != null ? [ki] : [];
      shared.selP = hs.p != null ? [ki] : [];
      shared.selE = hs.e != null ? [ki] : [];
    }
    paint();
  }
  function holderSize(rc, nb, b0r) {
    var rid = nodes2[rc].id, one = {};
    remember(false);
    one[rc] = nb;
    setBoxes(one);
    var pf = propFmt();
    if (pf && pf.ends) pf.ends(rid, b0r, nb);
    var before = boxesBefore(function(k) {
      return nodes2[k].id === rid ? b0r : boxOf(k);
    });
    var B0r = function(k) {
      return before[nodes2[k].id] || boxOf(k);
    }, doneR = function() {
      render();
      paint();
      changed();
    }, ri = nodes2.findIndex(function(n) {
      return n.id === rid;
    });
    if (!full() || !nodes2[ri].comp) {
      setBoxes(grown([ri], boxOf, B0r, function() {
        return false;
      }));
      refit([rid]);
      doneR();
      return;
    }
    settle(regroup("box", /* @__PURE__ */ new Set([ri]), boxOf, B0r), { moving: [rid] }, doneR, function() {
      setText(unpush());
      parse();
      liveOff();
      paint();
    });
  }
  function dragCancel() {
    if (!drag && !band) return false;
    var d = drag;
    drag = null;
    band = null;
    mv = null;
    shared.poseNow = null;
    if (d && d.made != null) {
      setText(unpush());
      parse();
      shared.selP = [];
      shared.selE = [d.made - 1];
    } else if (d && d.keepE) {
      shared.selE = d.keepE;
      shared.selP = [];
    }
    unshift();
    sizeOff();
    if (d && d.made != null) render();
    paint();
    return true;
  }
  function linesAt2(ps) {
    var m = /* @__PURE__ */ new Map();
    if (ps && ps.size) edges2.forEach(function(e, k) {
      if (e.s != null && e.t != null && e.pts.some(function(pi) {
        return ps.has(pi);
      })) m.set(e.id, ports(k));
    });
    return m;
  }
  function onNeighbour(ps, lim0, before) {
    if (!ps || !ps.size) return;
    var lim = lim0 || sq() / V.z, out = [], lines = [];
    edges2.forEach(function(e, k) {
      if (e.s == null || e.t == null || !e.pts.some(function(pi) {
        return ps.has(pi);
      })) return;
      var all = ports(k), kept = 0, B = before && before.get(e.id);
      if (B && B.length !== all.length) B = null;
      var by = function(P, Q) {
        return Math.max(Math.abs(Q[0] - P[0]), Math.abs(Q[1] - P[1])) < lim;
      };
      e.pts.forEach(function(pi, j) {
        var hit2 = function(q) {
          return by(all[j + 1], all[q]) && !(B && by(B[j + 1], B[q]));
        };
        if (ps.has(pi) && (hit2(kept) || hit2(j + 2))) {
          out.push(pi);
          if (lines.indexOf(k) < 0) lines.push(k);
        } else kept = j + 1;
      });
    });
    if (!out.length) return;
    var ids = lines.map(function(k) {
      return edges2[k].id;
    });
    setText(import_graphml_edit.default.unbend(shared.text, out));
    parse();
    if (lim0) return;
    shared.selP = [];
    shared.selE = [];
    shared.part = null;
    edges2.forEach(function(q, k) {
      if (ids.indexOf(q.id) >= 0) shared.selE.push(k);
    });
  }
  function dragEnd(e) {
    var d = drag;
    drag = null;
    var sets = mv;
    mv = null;
    shared.poseNow = null;
    if (!d.port && !d.rs) shared.frozen = true;
    if (d.port) {
      if (d.port.n2 != null) reconnect(d.port);
      else if (d.port.free || d.port.moved && !d.port.to || d.port.hub && !d.port.to) {
        unshift();
        paint();
      } else if (d.port.to) setPort(d.port);
      else paint();
      return;
    }
    if (d.rs) {
      var nb = shared.liveC && shared.liveC[d.rs.c];
      if (!nb || nb.every(function(v, j) {
        return Math.abs(v - d.rs.b0[j]) < 0.01;
      })) {
        liveOff();
        sizeOff();
        paint();
        return;
      }
      if (!holds(d.rs.c)) {
        setSize(d.rs.c, nb);
        return;
      }
      holderSize(d.rs.c, nb, d.rs.b0);
      return;
    }
    var movedNow = sets ? movedIds(sets) : [];
    var fitAfter = function() {
      var B0 = function(k) {
        var b = boxOf(k);
        return sets.n.has(k) ? [b[0] - d.dx, b[1] - d.dy, b[2], b[3]] : b;
      };
      settle(
        full() ? regroup(d.alone ? "alone" : "plain", sets.n, boxOf, B0) : /* @__PURE__ */ new Map(),
        { join: full() ? movedNow : null, grow: tops(sets.n, d.alone).map(function(k) {
          return nodes2[k].id;
        }), before: boxesBefore(B0), moving: movedNow, away: d.away },
        function() {
          render();
          changed();
        },
        function() {
          setText(unpush());
          parse();
          unshift();
          paint();
        }
      );
    };
    if (d.made != null && Math.abs(d.dx) < 0.01 && Math.abs(d.dy) < 0.01) {
      setText(unpush());
      parse();
      shared.selP = [];
      shared.selE = [d.made - 1];
      unshift();
      paint();
      return;
    }
    if (d.made == null && !d.keepE && d.sx0 != null && e.type === "pointerup" && Math.hypot(e.clientX - d.sx0, e.clientY - d.sy0) < 4) {
      unshift();
      var out1 = function(list2, k) {
        var j = list2.indexOf(k);
        if (k != null && j >= 0) list2.splice(j, 1);
      };
      if (d.p != null) out1(shared.selP, d.p);
      else if (d.e != null) out1(shared.selE, d.e);
      else out1(shared.selN, d.n);
      paint();
      return;
    }
    if (d.made != null) {
      move(d.dx, d.dy);
      onNeighbour(sets ? sets.p : /* @__PURE__ */ new Set([d.p]));
      fitAfter();
    } else if (d.dx || d.dy) {
      remember(false);
      var near0 = linesAt2(sets.p);
      move(d.dx, d.dy, sets);
      fixMoved(sets.n, d.alone);
      onNeighbour(sets.p, 0, near0);
      if (d.keepE) {
        shared.selE = d.keepE;
        shared.selP = [];
      }
      fitAfter();
    } else {
      unshift();
      if (d.keepE) {
        shared.selE = d.keepE;
        shared.selP = [];
      }
    }
    paint();
  }
  function __run433() {
    V.view.addEventListener("pointerup", release, true);
    V.view.addEventListener("pointercancel", release, true);
  }
  function portKey(pp, d, fine) {
    if (pp.hub) return;
    var e = edges2[pp.k], a = pp.end ? ["tx", "ty"] : ["sx", "sy"], b = bx(pp.n), u = [Math.sign(d[0]), Math.sign(d[1])];
    var off = [num(e.path, a[0]) || 0, num(e.path, a[1]) || 0], G2 = procSpots(pp) || hubSides(pp), N = G2 ? null : places(pp.n), S = G2 || N && [[0, 0]].concat(N);
    if (!S && !shared.F.fixedEnds) {
      var rn = pp.run, go = rn && rn.u + "" === u + "" && Math.abs(rn.to[0] - off[0]) < 0.01 && Math.abs(rn.to[1] - off[1]) < 0.01 ? rn.di : null;
      var g2 = portStep(pp.n, off, u, fine ? 1 : lineStep(), go);
      pp.run = g2 && g2.di != null ? { u, di: g2.di, to: g2.to } : null;
      if (g2) setPort({ k: pp.k, end: pp.end, n: pp.n, to: g2.to }, true);
      return;
    }
    var c = [b[0] + b[2] / 2, b[1] + b[3] / 2], o = spot(pp, [c[0] + off[0], c[1] + off[1]]), s = [Math.sign(o[0]), Math.sign(o[1])];
    if (S) {
      var best = null, bs = G2 ? 0.3 : -Infinity;
      S.forEach(function(q) {
        var v = [q[0] - o[0], q[1] - o[1]], L = Math.hypot(v[0], v[1]), cs = L > 0.01 ? (v[0] * u[0] + v[1] * u[1]) / L : -1;
        var sc = G2 ? cs - L / 1e3 : cs >= 0.5 ? -L / cs : -Infinity;
        if (sc > bs) {
          bs = sc;
          best = q;
        }
      });
      if (best) setPort({ k: pp.k, end: pp.end, n: pp.n, to: best }, true);
      return;
    }
    var to = (s[0] || s[1]) && s[0] === -u[0] && s[1] === -u[1] ? [0, 0] : [u[0] * b[2] / 2, u[1] * b[3] / 2];
    setPort({ k: pp.k, end: pp.end, n: pp.n, to }, true);
  }
  function __run443() {
    document.addEventListener("keydown", function(e) {
      if (!shared.text) return;
      var mod = e.ctrlKey || e.metaKey, k = V.letter(e) || (e.key || "").toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (!on || V.current !== map || V.typing()) return;
      if (/input|select/i.test(document.activeElement.tagName) && !(mod && (k === "z" || k === "y"))) return;
      if (mod && k === "a" || e.key === "Escape") keyFlush();
      if (mod && k === "a") {
        e.preventDefault();
        shared.part = null;
        keyGuides = null;
        shared.selP = [];
        shared.selN = nodes2.map(function(n, i) {
          return i;
        }).filter(function(i) {
          return shared.F.square(nodes2[i].id) == null;
        });
        shared.selE = edges2.map(function(x, k2) {
          return k2;
        });
        paint();
        return;
      }
      if (mod && (k === "z" || k === "y")) {
        e.preventDefault();
        if (k === "z" && !e.shiftKey) back(undo, shared.redo);
        else back(shared.redo, undo);
        return;
      }
      if (e.key === "Escape" && dragCancel()) {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        if (e.defaultPrevented || ddOpen || tool || link || helpBox && !helpBox.hidden) return;
        shared.selN = [];
        shared.selP = [];
        shared.selE = [];
        shared.part = null;
        keyGuides = null;
        paint();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && shared.selP.length && !shared.selN.length) {
        e.preventDefault();
        unbend(shared.selP);
        return;
      }
      var step2 = e.shiftKey ? 10 : 1, d = { arrowleft: [-step2, 0], arrowright: [step2, 0], arrowup: [0, -step2], arrowdown: [0, step2] }[k];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      if (!shared.selN.length && !shared.selP.length && !shared.selE.length) return;
      var pt0 = partSel();
      if (!shared.selN.length && !shared.selP.length && !pt0) return;
      if (pt0 && pt0.port) {
        portKey(pt0.port, d, e.shiftKey);
        return;
      }
      if (!pt0 && keyTake.some(function(f) {
        return f(d, e);
      })) return;
      var ks = pt0 ? { n: /* @__PURE__ */ new Set(), p: /* @__PURE__ */ new Set([pt0.p]), dx: 0, dy: 0 } : moving();
      var bp = pt0 ? pt0.p : shared.selP.length === 1 && !shared.selN.length && !shared.selE.length ? shared.selP[0] : null;
      if (bp != null) d = keyAlign(bp, d, ks.p);
      var NW = shared.F.nestReady && shared.F.nestReady() ? shared.F.nestWhy : null;
      if (ks.n.size && NW && full()) {
        var r0 = keyRun || [0, 0], dd = d, Bk = function(k2) {
          var b = boxOf(k2);
          return ks.n.has(k2) ? [b[0] + dd[0], b[1] + dd[1], b[2], b[3]] : b;
        };
        var mvs = [];
        regroup("plain", ks.n, Bk, function(k2) {
          var b = boxOf(k2);
          return ks.n.has(k2) ? [b[0] - r0[0], b[1] - r0[1], b[2], b[3]] : b;
        }).forEach(function(t2, i) {
          mvs.push([nodes2[i].id, t2 == null ? null : nodes2[t2].id]);
        });
        var whyK = mvs.length ? NW(mvs) : null;
        if (whyK) return;
      }
      if (!keyRun) keyNear = linesAt2(ks.p);
      remember(true);
      move(d[0], d[1], ks);
      keyShift(ks, d[0], d[1]);
      keyGuides = bp != null ? bendGuides(bp) : null;
      paint();
      var kids = movedIds(ks);
      keyRun = keyRun || [0, 0];
      keyRun[0] += d[0];
      keyRun[1] += d[1];
      keyDue = function() {
        keyDue = null;
        var run = keyRun || [0, 0];
        keyRun = null;
        var near0 = keyNear;
        keyNear = null;
        onNeighbour(ks.p, 0, near0);
        var set = new Set(nodes2.map(function(n, i) {
          return kids.indexOf(n.id) >= 0 ? i : -1;
        }).filter(function(i) {
          return i >= 0;
        }));
        fixMoved(set);
        var B0 = function(k2) {
          var b = boxOf(k2);
          return set.has(k2) ? [b[0] - run[0], b[1] - run[1], b[2], b[3]] : b;
        };
        settle(
          full() ? regroup("plain", set, boxOf, B0) : /* @__PURE__ */ new Map(),
          { grow: tops(set, false).map(function(k2) {
            return nodes2[k2].id;
          }), before: boxesBefore(B0), moving: kids },
          function() {
            render();
            paint();
          },
          function() {
            setText(unpush());
            parse();
            shared.keyed = null;
            render();
            paint();
          }
        );
      };
      clearTimeout(timer);
      timer = setTimeout(function() {
        if (keyDue) keyDue();
      }, 150);
      changed();
    }, true);
  }
  function __start11() {
    __run114();
    __run215();
    __run311();
    __run45();
    __run59();
    __run67();
    __run77();
    __run85();
    __run94();
    __run104();
    __run115();
    __run125();
    __run135();
    __run145();
    __run155();
    __run165();
    __run173();
    __run183();
    __run193();
    __run204();
    __run216();
    __run225();
    __run235();
    __run245();
    __run254();
    __run264();
    __run274();
    __run284();
    __run294();
    __run303();
    __run314();
    __run343();
    __run353();
    __run363();
    __run373();
    __run382();
    __run392();
    __run402();
    __run412();
    __run423();
    __run433();
    __run443();
    __run452();
    __run46();
    __run472();
  }

  // editor/src/tools.js
  function registry() {
    var list2 = [];
    function get(id) {
      return list2.filter(function(t) {
        return t.id === id;
      })[0] || null;
    }
    function fits(t, map2) {
      if (!map2 || t.kinds.indexOf("*") < 0 && t.kinds.indexOf(map2.kind) < 0) return false;
      if (!t.applies) return true;
      try {
        return !!t.applies(map2);
      } catch (e) {
        return false;
      }
    }
    return {
      register: function(t) {
        if (!t || typeof t.id !== "string" || !t.id) throw new Error("a tool needs an id");
        if (typeof t.run !== "function") throw new Error("tool " + t.id + " has no run");
        if (get(t.id)) throw new Error("a tool with the id " + t.id + " is registered already");
        var k = Array.isArray(t.kinds) ? t.kinds.slice() : typeof t.kinds === "string" ? [t.kinds] : [];
        if (!k.length) throw new Error("tool " + t.id + " names no kind of map");
        var rec = { id: t.id, label: t.label || t.id, kinds: k, applies: typeof t.applies === "function" ? t.applies : null, run: t.run };
        list2.push(rec);
        return function() {
          var i = list2.indexOf(rec);
          if (i >= 0) list2.splice(i, 1);
        };
      },
      forMap: function(map2) {
        return list2.filter(function(t) {
          return fits(t, map2);
        }).map(function(t) {
          return { id: t.id, label: t.label };
        });
      },
      run: function(id, map2, ctx) {
        var t = get(id);
        if (!t) return Promise.reject(new Error("no tool " + id));
        if (!fits(t, map2)) return Promise.reject(new Error(t.label + " does not apply to this map"));
        try {
          return Promise.resolve(t.run(ctx));
        } catch (e) {
          return Promise.reject(e);
        }
      },
      label: function(id) {
        var t = get(id);
        return t ? t.label : "";
      }
    };
  }

  // editor/src/main.js
  window.m2Editor = function(v) {
    addFormats({ graphml: graphmlFormat(), cd: cdFormat(), sb: sbFormat() });
    setV(v);
    window.m2EditState = function() {
      var s = stateNow();
      s.cdKept = cdKept();
      return s;
    };
    window.m2EditPlant = plant;
    __start11();
    __start9();
    __start2();
    __start5();
    __start();
    __start3();
    __start8();
    __start6();
    __start4();
    __start10();
    __start7();
    var tools = registry();
    var shownMap = function() {
      var m = v.current;
      return m ? { id: m.id, name: own.tool.name(m.id), kind: own.tool.kind(m.id) } : null;
    };
    window.m2Tools = {
      register: tools.register,
      forMap: function() {
        var m = shownMap();
        return m ? tools.forMap(m) : [];
      },
      run: function(id) {
        var m = shownMap();
        if (!m) return Promise.reject(new Error("no map is shown"));
        return tools.run(id, m, { map: m, text: function() {
          return own.tool.text(m.id);
        }, add: function(t, name2) {
          return own.tool.add(m.id, t, name2 || m.name + " (" + tools.label(id) + ")");
        } });
      }
    };
    buttons();
    aheadSoon();
    syncFolder();
    sendWaiting();
    if (v.current) setTimeout(shown, 0);
    return { fresh: function() {
      shared.redo = [];
      shared.listAhead = [];
    }, paint, away, unkeep, chooseFolder, own, hasToken: function() {
      return !!(repo() && token());
    }, leaving: function(m) {
      if (on && m !== map) {
        shared.switching = true;
        try {
          stop();
        } finally {
          shared.switching = false;
        }
      }
    }, left: function(m) {
      cdShown(m && m.id);
      if (on && m !== map) stop();
      buttons();
      setTimeout(shown, 0);
      warmUp();
      aheadSoon();
    }, pictured: function(failed) {
      if (picWait) shown(!!failed);
    } };
  };
})();
//# sourceMappingURL=editor.js.map
