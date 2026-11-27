// The outbox: with a token, a map's save is kept in this browser before it is sent to GitHub, and taken out once GitHub
// has it, so a lost connection, a reload or a closed tab never loses a change. One record per map, the newest text
// replacing the one before: { key, id, path, name, text, sha, saved, also, mine, at }; key: the data repository and the
// map's id (several sites share one github.io address); sha and saved: GitHub's version the text was made on (null for
// a file not on GitHub yet), so a later send can tell whether the file changed there meanwhile; also: a save of this
// page under way when the text was kept (GitHub may have it by the next visit: the page's own, not another's).
// A database of its own (atlas-outbox), so the page's database keeps its version for older copies of the page. Every
// tab of the site writes it: the records are read afresh before a send (outboxFresh) and let go only while they still
// hold the text sent. Imports nothing; core.js sends (sendWaiting) and says what waits.
// Database atlas-ops, of its own too (an older copy of the page on the same address keeps opening atlas-outbox at
// version 1): the list's changes with a token (a map's page edited: renamed, moved, deleted, restored; a group renamed; a
// map deleted forever; Deleted's file for the build's own maps), one record per change in the order made, its key the
// store's own counter (seq): { seq, key: the data repository, kind, args, ids, show, at }; own.js sends them (opSend,
// opsDrain) one at a time and lets each go once GitHub has it.
var dbP, opsP, box, loaded, persisted;
// the browser asked once a change is first kept here to keep the site's data when storage runs short (Safari's seven
// days, a full disk); asked then, not at the first visit, as Firefox puts it to the reader
export function keepAsked() {
  if (persisted) return;
  persisted = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (y) { if (!y) return navigator.storage.persist(); }).catch(function () {}); } catch (e) {}
}
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
function opsDb() {
  if (!opsP) opsP = new Promise(function (res, rej) {
    var idb = window.indexedDB;
    if (!idb) return rej(new Error('this browser keeps no data for the page'));
    var r = idb.open('atlas-ops', 1);
    r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('ops')) r.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true }); };
    r.onsuccess = function () { var d = r.result; d.onversionchange = function () { d.close(); opsP = null; }; res(d); };
    r.onerror = function () { opsP = null; rej(r.error); };
    r.onblocked = function () { opsP = null; rej(new Error('another tab of this site holds the stored changes')); };
  });
  return opsP;
}
function tx(mode, f, store) {
  return (store === 'ops' ? opsDb() : db()).then(function (d) {
    return new Promise(function (res, rej) {
      var t = d.transaction(store || 'saves', mode), q = f(t.objectStore(store || 'saves'));
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
  keepAsked();
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
// the list's changes: kept (rejects when the browser refused to keep it), every one of a repository in order, one
// still there (another tab may have sent it), let go
export function opsKeep(op) {
  keepAsked();
  op.at = Date.now();
  return tx('readwrite', function (st) { return st.add(op); }, 'ops').then(function (seq) { op.seq = seq; return op; });
}
export function opsAll(key) {
  return tx('readonly', function (st) { return st.getAll(); }, 'ops').then(function (all) {
    return (all || []).filter(function (o) { return o && o.key === key; }).sort(function (a, b) { return a.seq - b.seq; });
  });
}
export function opsHas(seq) { return tx('readonly', function (st) { return st.get(seq); }, 'ops').then(function (o) { return !!o; }); }
export function opsDone(seq) { return tx('readwrite', function (st) { return st.delete(seq); }, 'ops').catch(function () {}); }
