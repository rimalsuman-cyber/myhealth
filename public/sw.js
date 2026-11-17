const BASE = new URL('./', self.location.href).pathname;
const PREFIX = 'health-shell-' + BASE + '-';
const CACHE = PREFIX + 'v2';
const SHELL = ['', 'index.html', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.filter(path => path !== 'index.html').map(path => BASE + path))));
 self.skipWaiting();
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
 const path = url.pathname.slice(BASE.length);
 if(!SHELL.includes(path) && !/^assets\/[\w.-]+\.(js|css)$/.test(path)) return;
 event.respondWith(fetch(event.request).then(response => {
  if(response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
  return response;
 }).catch(async () => (await caches.match(event.request)) || new Response('Offline. Reconnect to load the app.', {status:503})));
});
