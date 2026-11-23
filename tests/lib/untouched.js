// The untouched-elements check: given a map's text before and after a change, and the ids the change was meant to touch,
// every other element with an id (a node, an edge, a glyph, an arc, a species, an alias, a reaction) compares equal:
// its own text, attributes in their order, with the elements inside it that have ids of their own left out (each is
// compared by itself), so a member moved inside a complex touches the member and not the complex, nor does a touched
// element added to it or taken out of it (its place among the others is not compared). An indent changed is seen;
// what the parser evens out is not (quotes, an entity written another way, <c/> for <c></c>, spaces between attributes):
// a writer that keeps the file byte for byte is checked by comparing the texts themselves. The text outside
// every element with an id (the file's header, its lists) is compared as the element '' and is touched only when ''
// is named; so is the declaration before the root, compared as written. Format-free: GraphML, SBGN-ML and CellDesigner alike.
//   var U = require('./lib/untouched.js');
//   U.diff(before, after, touched, opt) -> [] when nothing else changed, else one line per difference
//     touched: an array of ids, or a function (id) -> true for an id the change may touch (added and removed ids too)
//     opt.DOMParser: a DOMParser (default @xmldom/xmldom's)
//   U.elements(text, opt) -> { id: own text } (an id met again is keyed id#2, id#3, ...)
var X = require('@xmldom/xmldom');
function own(el, S) {   // the element as text, its id'd descendants as a mark in their place
  var c = el.cloneNode(true);
  (function cut(n) {
    var kids = Array.prototype.slice.call(n.childNodes);
    kids.forEach(function (k) {
      if (k.nodeType !== 1) return;
      if (k.getAttribute('id')) n.replaceChild(c.ownerDocument.createComment('#' + k.getAttribute('id')), k);
      else cut(k);
    });
  })(c);
  return S.serializeToString(c);
}
function elements(text, opt) {
  var DP = (opt && opt.DOMParser) || X.DOMParser, S = new X.XMLSerializer();
  var d = new DP().parseFromString(String(text).replace(/^﻿/, ''), 'application/xml'), out = {}, seen = {};
  (function walk(n) {
    Array.prototype.forEach.call(n.childNodes, function (k) {
      if (k.nodeType !== 1) return;
      var id = k.getAttribute('id');
      if (id) { seen[id] = (seen[id] || 0) + 1; out[seen[id] > 1 ? id + '#' + seen[id] : id] = own(k, S); }
      walk(k);
    });
  })(d);
  out[''] = own(d.documentElement, S);
  return out;
}
function diff(before, after, touched, opt) {
  var may = typeof touched === 'function' ? touched : (function (s) { return function (id) { return s.indexOf(id.replace(/#\d+$/, '')) >= 0; }; })(touched || []);
  var A = elements(before, opt), B = elements(after, opt), out = [];
  var mine = function (t) { return t.replace(/\s*<!--#([^]*?)-->/g, function (all, id) { return may(id) ? '' : all; }); };   // a touched element added, taken out or moved in it, with the indent before it
  var pro = function (t) { var m = /<[^?!]/.exec(String(t).replace(/^\ufeff/, '')); return m ? String(t).replace(/^\ufeff/, '').slice(0, m.index) : ''; };   // the declaration and what stands before the root, as written
  if (!may('') && pro(before) !== pro(after)) out.push('the text before the root element: changed' + first(pro(before), pro(after)));
  Object.keys(A).forEach(function (id) {
    if (may(id)) return;
    if (!(id in B)) out.push((id || 'the file outside its elements') + ': removed');
    else if (mine(A[id]) !== mine(B[id])) out.push((id || 'the file outside its elements') + ': changed' + first(A[id], B[id]));
  });
  Object.keys(B).forEach(function (id) { if (!(id in A) && !may(id)) out.push(id + ': added'); });
  return out;
}
function first(a, b) {   // where two texts part, shortened
  var c = 0; while (c < a.length && a[c] === b[c]) c++;
  var cut = function (s) { return s.slice(Math.max(0, c - 40), c + 60).replace(/\s+/g, ' '); };
  return ' (before: ' + cut(a) + ' | now: ' + cut(b) + ')';
}
module.exports = { diff: diff, elements: elements };
