// Click contract v2: absolute, same-origin PriorityMail detail URLs.
function notificationTarget(data = {}) {
  const home = new URL('/', self.location.origin);
  try {
    const emailId = data.emailId || data.internalEmailId;
    if (typeof emailId === 'string' && emailId) {
      home.searchParams.set('email', emailId);
      return home.href;
    }
    const candidate = new URL(data.url || data.route || '/', home);
    return candidate.origin === home.origin && candidate.pathname === '/' ? candidate.href : home.href;
  } catch {
    return home.href;
  }
}

// PriorityMail Service Worker - Development & Fallback Shell
// In production builds, scripts/build-sw.mjs generates a versioned precache manifest.

const CACHE_NAME = 'prioritymail-dev-click-v2';

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
  // Accept the new nested data contract and existing queued flat payloads.
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const emailId = data.emailId || data.internalEmailId || '';

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: emailId || 'prioritymail',
    data: { ...data, url: notificationTarget(data) },
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) client.postMessage?.({ type: 'prioritymail-inbox-refresh' });
    }),
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = notificationTarget(event.notification.data || {});
    let windows = [];
    try {
      windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    } catch {
      // A client enumeration failure must not prevent opening the app.
    }
    for (const client of windows) {
      try {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if (typeof client.navigate !== 'function' || typeof client.focus !== 'function') continue;
        const navigated = await client.navigate(url);
        // navigate() can return null for a window that closed during the click.
        if (!navigated) continue;
        await navigated.focus();
        return;
      } catch {
        // Try another app window, then fall back to opening a new one.
      }
    }
    if (self.clients.openWindow) {
      try {
        const opened = await self.clients.openWindow(url);
        if (opened && typeof opened.focus === 'function') await opened.focus();
      } catch {
        console.warn('[prioritymail-sw] notification navigation failed');
      }
    }
  })());
});
