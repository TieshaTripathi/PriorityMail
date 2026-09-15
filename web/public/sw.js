// PriorityMail Service Worker - Development & Fallback Shell
// In production builds, scripts/build-sw.mjs generates a versioned precache manifest.

const CACHE_NAME = 'prioritymail-dev';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // In dev mode, network-first ensures Vite HMR and module reloading work seamlessly.
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      return cached || (event.request.mode === 'navigate' ? cache.match('/') : null);
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    // Privacy-preserving default
  }
  const emailId = typeof payload.emailId === 'string' ? payload.emailId : '';
  event.waitUntil(
    self.registration.showNotification('PriorityMail', {
      body: payload.body || 'You have an email that needs attention.',
      icon: '/icons/icon-192.png',
      tag: emailId || 'prioritymail',
      data: { url: emailId ? '/#email/' + encodeURIComponent(emailId) : '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
  const url = candidate.origin === self.location.origin ? candidate.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.navigate(url);
        return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
