const CACHE = '__CACHE__';
const SHELL = __SHELL__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

// Updates wait until all old tabs close so old and new bundles never mix.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('prioritymail-') && k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(cached => cached || fetch(event.request)));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
  // API responses are deliberately excluded from offline caching.
});

self.addEventListener('push', event => {
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
  const emailId = payload.emailId || payload.internalEmailId || '';

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: emailId || 'prioritymail',
    data: {
      ...payload,
      url: emailId ? '/?email=' + encodeURIComponent(emailId) : '/',
    },
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
  const data = event.notification.data || {};
  const id = data.emailId || data.internalEmailId;
  const targetUrl = (id ? '/?email=' + encodeURIComponent(id) : data.url) || '/';
  const candidate = new URL(targetUrl, self.location.origin);
  const url = candidate.origin === self.location.origin ? candidate.href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      const client = clients.find(c => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.navigate(url);
        return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
