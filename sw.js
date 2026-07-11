/* ILGIGLIO — Service Worker v1
 * Same structure as the sibling NRDS Tahiti app's sw.js: intercepts only same-origin app shell +
 * map tiles. Does NOT touch esm.sh or supabase.co (intercepting esm.sh ES-module imports breaks
 * Supabase on mobile). */

var CACHE = 'ilgiglio-v1';
var TILE_CACHE = 'ilgiglio-tiles-v1';
var BASE = new URL(self.location.href).pathname.replace('sw.js', '');

var PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      var fetches = PRECACHE.map(function(url) {
        return cache.add(url).catch(function() {});
      });
      return Promise.all(fetches);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE && k !== TILE_CACHE; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(err) { return; }

  if (
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('tile.openstreetmap.org')
  ) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(cache) {
        return cache.match(req).then(function(hit) {
          if (hit) return hit;
          return fetch(req).then(function(resp) {
            if (resp && resp.ok && resp.status === 200) {
              cache.put(req, resp.clone());
            }
            return resp;
          }).catch(function() {
            return new Response('', { status: 503, statusText: 'Tile offline' });
          });
        });
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function(hit) {
        var networkFetch = fetch(req).then(function(resp) {
          if (resp && resp.ok) {
            caches.open(CACHE).then(function(c) { c.put(req, resp.clone()); });
          }
          return resp;
        }).catch(function() {
          return hit || new Response('App offline', { status: 503 });
        });
        return hit || networkFetch;
      })
    );
    return;
  }
});
