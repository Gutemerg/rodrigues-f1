/* RODRIGUES F1 — service worker: funciona offline e recebe as notificações. */
const VERSION = 'rf1-v9';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'circuits.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/badge-96.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache do navegador, para não guardar arquivos antigos na versão nova
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Arquivos do app: busca sempre a versão mais nova na rede; sem internet, usa a cópia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true }))
        || (e.request.mode === 'navigate' ? await cache.match('index.html') : Response.error());
    }
  })());
});

// Caixa de entrada guardada no aparelho (lida pela tela Alertas).
function saveInbox(item) {
  return new Promise((res) => {
    const r = indexedDB.open('rf1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('inbox', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => {
      const tx = r.result.transaction('inbox', 'readwrite');
      tx.objectStore('inbox').add(item);
      tx.oncomplete = res; tx.onerror = res;
    };
    r.onerror = res;
  });
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'RODRIGUES F1', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'RODRIGUES F1';
  const item = { title, body: d.body || '', url: d.url || './', at: Date.now() };
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: item.body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
      tag: d.tag || undefined, renotify: !!d.tag, data: { url: item.url }, lang: 'pt-BR',
    }),
    saveInbox(item),
    self.clients.matchAll({ type: 'window' }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'push' }))),
  ]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(self.registration.scope)) { c.focus(); return c.navigate(target); }
    return self.clients.openWindow(target);
  }));
});
