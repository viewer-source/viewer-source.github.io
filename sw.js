// The page kept for offline: a service worker the viewer's page registers (atlas-app.html, include sw). It keeps a copy
// of what the page fetches from this site, so the same address opens the page, its code and the maps already seen
// when there is no connection. Changes a reader makes wait in the page's own outbox; nothing here sends anything.
//   The page itself (a navigation to this worker's scope): the network first, the copy kept when there is no answer in
//   WAIT ms or no connection. So a new release is taken at the next load with a connection, never under an open page.
//   A versioned address (a query, the browser's usual cache mode): the copy kept when it is that same address, else the
//   network (and kept), else the copy of any version. An address without a version, or asked with no-cache: the
//   network first, the copy when it fails. Other sites (GitHub's API) are never touched.
// One copy per path (the query is left out of the key; the full address it came from is in a header).
// KILL: a release with true drops every copy this scope kept and unregisters the worker, with no reload (a page that
// registers it again at its next load only repeats this); sw="off" on the include unregisters it from the page.
var LAYOUT = 1;   // the kept copies' layout: a new number drops the copies of the earlier one
var KILL = false;
var WAIT = 4000;
var SCOPE = new URL(self.registration.scope).pathname;
var NAME = 'offline-' + LAYOUT + ':' + SCOPE;
var FROM = 'x-kept-from';
var pruned = 0;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(activate()); });
function mine(k) { return k.indexOf('offline-') === 0 && k.slice(k.indexOf(':') + 1) === SCOPE; }
function activate() {
  return caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return mine(k) && (KILL || k !== NAME); }).map(function (k) { return caches.delete(k); }));
  }).then(function () {
    if (!KILL) return self.clients.claim();
    return self.registration.unregister();   // pages open stay as they are (this worker answers nothing now); the next load is the network's
  });
}
self.addEventListener('message', function (e) {   // the page asks which layout and scope answer it
  if (e.data === 'kept?' && e.source) e.source.postMessage({ kept: NAME, kill: KILL });
});

function keyOf(url) { var u = new URL(url); return u.origin + u.pathname; }
function keep(req, r) {   // a whole answer kept under its path, with the address it came from
  if (!r || r.status !== 200 || r.type !== 'basic') return Promise.resolve();
  var c = r.clone();
  return c.blob().then(function (b) {
    var h = new Headers(c.headers);
    h.set(FROM, req.url);
    return caches.open(NAME).then(function (cache) { return cache.put(keyOf(req.url), new Response(b, { status: 200, statusText: c.statusText, headers: h })); });
  }).then(function () { if (/\/index\.json$/.test(new URL(req.url).pathname)) return prune(r); }).catch(function () {});
}
function kept(url) { return caches.open(NAME).then(function (c) { return c.match(keyOf(url)); }); }
function network(req) {   // the network's answer, kept; null when it fails
  return fetch(req).then(function (r) { return keep(req, r).then(function () { return r; }); }, function () { return null; });
}
function late(p, ms) { return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]); }
function fallback(p, url) {
  return p.then(function (r) { return r || kept(url).then(function (k) { return k || Response.error(); }); });
}

self.addEventListener('fetch', function (e) {
  var req = e.request, u = new URL(req.url);
  if (KILL || req.method !== 'GET' || u.origin !== location.origin || req.headers.has('range')) return;
  if (req.mode === 'navigate') {
    if (u.pathname !== SCOPE && u.pathname !== SCOPE + 'index.html') return;   // another page of the site: as without the worker
    var got = network(req);
    e.respondWith(late(got, WAIT).then(function (r) {
      if (r) return r;
      return kept(req.url).then(function (k) { return k || got.then(function (g) { return g || Response.error(); }); });   // nothing kept: the network's answer, however late
    }));
    return;
  }
  if (u.search && (req.cache === 'default' || req.cache === 'force-cache')) {
    e.respondWith(kept(req.url).then(function (k) {
      if (k && k.headers.get(FROM) === req.url) return k;
      return fallback(network(req), req.url);
    }));
    return;
  }
  e.respondWith(fallback(network(req), req.url));
});

// index.json kept: the files of maps it no longer lists are let go (at most once an hour)
function prune(r) {
  if (Date.now() - pruned < 3600000) return Promise.resolve();
  pruned = Date.now();
  return r.clone().json().then(function (list) {
    if (!Array.isArray(list)) return;
    var used = {};
    var add = function (p) { if (typeof p === 'string' && p.charAt(0) === '/') used[p.split('?')[0]] = 1; };
    list.forEach(function (m) {
      if (!m) return;
      [m.image, m.annotation, m.data, m.file].forEach(add);
      if (m.sbgn) [m.sbgn.image, m.sbgn.annotation, m.sbgn.file].forEach(add);
      (m.downloads || []).forEach(function (d) { add(d && d.url); });
    });
    return caches.open(NAME).then(function (c) {
      return c.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) {
          var p = new URL(k.url).pathname;
          if (/^\/(downloads|atlas-data|data)\//.test(p) && !/^\/atlas-data\/search\.json$/.test(p) && !used[p] && !used[p.replace(/\/$/, '')]) return c.delete(k);
        }));
      });
    });
  }).catch(function () {});
}
