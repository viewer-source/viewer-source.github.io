// The outbox: with a token, a map's save is kept in this browser before it is sent to GitHub, and taken out once GitHub
// has it, so a lost connection, a reload or a closed tab never loses a change. One record per map, the newest text
// replacing the one before: { key, id, path, name, text, sha, saved, also, mine, at }; key: the data repository and the
// map's id (several sites share one github.io address); sha and saved: GitHub's version the text was made on (null for
// a file not on GitHub yet), so a later send can tell whether the file changed there meanwhile; also: a save of this
// page under way when the text was kept (GitHub may have it by the next visit: the page's own, not another's).
// A database of its own (atlas-outbox), so the page's database keeps its version for older copies of the page. Every
// tab of the site writes it: the records are read afresh before a send (outboxFresh) and let go only while they still
// hold the text sent. Imports nothing; core.js sends (sendWaiting) and says what waits.
var dbP, box, loaded;
function db() {
  if (!dbP) dbP = new Promise(function (res, rej) {
    var idb = window.indexedDB;
    if (!idb) return rej(new Error('this browser keeps no data for the page'));
    var r = idb.open('atlas-outbox', 1);
    r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('saves')) r.result.createObjectStore('saves'); };
    r.onsuccess = function () { var d = r.result; d.onversionchange = function () { d.close(); dbP = null; }; res(d); };
    r.onerror = function () { dbP = null; rej(r.error); };
    r.onblocked = function () { dbP = null; rej(new Error('another tab of this site holds the stored changes')); };
  });
  return dbP;
}
function tx(mode, f) {
  return db().then(function (d) {
    return new Promise(function (res, rej) {
      var t = d.transaction('saves', mode), q = f(t.objectStore('saves'));
      t.oncomplete = function () { res(q && q.result); };
      t.onerror = t.onabort = function () { rej(t.error); };
    });
  });
}
// the records as stored now (this tab's and other tabs'); again: read afresh, else once per page
export function outboxLoad(again) {
  if (!box) box = {};
  if (!loaded || again) loaded = tx('readonly', function (st) { return st.getAll(); })
    .then(function (all) {
      var seen = {};
      (all || []).forEach(function (r) { if (r && r.key) { seen[r.key] = 1; if (!box[r.key] || (r.at || 0) >= (box[r.key].at || 0)) box[r.key] = r; } });
      if (again) Object.keys(box).forEach(function (k) { if (!seen[k] && box[k].kept) delete box[k]; });   // let go by another tab
    }, function () {})
    .then(function () { return box; });
  return loaded;
}
export function outboxKeep(rec) {   // rejects when the browser refused to keep it (storage full, a private window's limits)
  if (!box) box = {};
  rec.at = Date.now();
  box[rec.key] = rec;
  return tx('readwrite', function (st) { return st.put(rec, rec.key); }).then(function () { rec.kept = true; });
}
// the record of key as stored now (another tab may have kept a newer text), or null
export function outboxFresh(key) {
  return tx('readonly', function (st) { return st.get(key); }).then(function (r) {
    if (!box) box = {};
    if (r) { r.kept = true; if (!box[key] || (r.at || 0) >= (box[key].at || 0)) box[key] = r; } else if (box[key] && box[key].kept) delete box[key];
    return box[key] || null;
  });
}
// GitHub has text for key: its record let go, here and in the database, unless a newer text was kept meanwhile (text:
// null lets it go whatever it holds)
export function outboxDone(key, text) {
  var r = box && box[key];
  if (r && text != null && r.text !== text) return Promise.resolve(false);
  if (r) delete box[key];
  return tx('readwrite', function (st) {
    var q = st.get(key);
    q.onsuccess = function () { if (q.result && (text == null || q.result.text === text)) st.delete(key); };
    return q;
  }).then(function () { return true; }, function () { return true; });
}
export function outboxGet(key) { return (box && box[key]) || null; }
export function outboxAll() { return box ? Object.keys(box).map(function (k) { return box[k]; }) : []; }
