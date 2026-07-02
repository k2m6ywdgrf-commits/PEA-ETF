var CACHE_NAME = 'patrimoine-cache-v3';
var ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(ASSETS); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if(e.request.method !== 'GET') return;

  var isAppShell = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').indexOf('text/html') !== -1;

  if(isAppShell) {
    // App shell (index.html) : toujours la dernière version si en ligne,
    // pour que les correctifs s'appliquent dès le premier chargement.
    e.respondWith(
      fetch(e.request).then(function(resp) {
        if(resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function() { return caches.match(e.request); })
    );
    return;
  }

  // Assets statiques (icônes, manifest, polices Google Fonts...) :
  // cache d'abord, réseau en secours. Les réponses opaques (CSS des polices
  // chargé en no-cors) sont cachées aussi, sinon la typographie disparaît
  // hors ligne.
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var network = fetch(e.request).then(function(resp) {
        if(resp && (resp.status === 200 || resp.type === 'opaque')) {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function() { return cached; });
      return cached || network;
    })
  );
});
