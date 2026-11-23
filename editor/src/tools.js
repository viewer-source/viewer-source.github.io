// Places for tools: a tool's command registered for the kinds of map it takes, with an id, a test of whether it applies
// to the map open and a run. The shape a full registry of actions (menus, keys and help from one table) grows from.
// Imports nothing; the page hands a run its context (main.js): the map, its text now, and add(text, name), a new map
// of the reader's right under it in every way maps are kept (own.js fromTool).
//   register({ id, label, kinds, applies, run }) -> unregister()
//     kinds: the formats taken ('CellDesigner', 'SBGN-ML', 'GraphML'), '*' any; applies(map): optional, a throw counts
//     as no; run(ctx): the work, a value or a promise
//   forMap(map): the tools that apply to map { id, name, kind }, in the order registered
//   run(id, map, ctx): the tool's run, refused when it does not apply
export function registry() {
  var list = [];
  function get(id) { return list.filter(function (t) { return t.id === id; })[0] || null; }
  function fits(t, map) {
    if (!map || (t.kinds.indexOf('*') < 0 && t.kinds.indexOf(map.kind) < 0)) return false;
    if (!t.applies) return true;
    try { return !!t.applies(map); } catch (e) { return false; }
  }
  return {
    register: function (t) {
      if (!t || typeof t.id !== 'string' || !t.id) throw new Error('a tool needs an id');
      if (typeof t.run !== 'function') throw new Error('tool ' + t.id + ' has no run');
      if (get(t.id)) throw new Error('a tool with the id ' + t.id + ' is registered already');
      var k = Array.isArray(t.kinds) ? t.kinds.slice() : typeof t.kinds === 'string' ? [t.kinds] : [];
      if (!k.length) throw new Error('tool ' + t.id + ' names no kind of map');
      var rec = { id: t.id, label: t.label || t.id, kinds: k, applies: typeof t.applies === 'function' ? t.applies : null, run: t.run };
      list.push(rec);
      return function () { var i = list.indexOf(rec); if (i >= 0) list.splice(i, 1); };
    },
    forMap: function (map) { return list.filter(function (t) { return fits(t, map); }).map(function (t) { return { id: t.id, label: t.label }; }); },
    run: function (id, map, ctx) {
      var t = get(id);
      if (!t) return Promise.reject(new Error('no tool ' + id));
      if (!fits(t, map)) return Promise.reject(new Error(t.label + ' does not apply to this map'));
      try { return Promise.resolve(t.run(ctx)); } catch (e) { return Promise.reject(e); }
    },
    label: function (id) { var t = get(id); return t ? t.label : ''; }
  };
}
