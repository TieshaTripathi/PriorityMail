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

  const title = payload.title || 'PriorityMail';
  const sender = payload.senderName || 'Important Message';
  const subject = payload.subject || 'Action required';
  const reason = payload.reason ? `\nReason: ${payload.reason}` : '';
  const body = payload.body || `${sender}\n${subject}${reason}`;
  const emailId = payload.internalEmailId || payload.gmailMessageId || '';

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: emailId || 'prioritymail',
    data: {
      url: emailId ? '/#email/' + encodeURIComponent(emailId) : '/',
      ...payload,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const candidate = new URL(targetUrl, self.location.origin);
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
