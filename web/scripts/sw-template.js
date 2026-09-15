const CACHE = '__CACHE__';
const SHELL = __SHELL__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
// Updates wait until all old tabs close so old and new bundles never mix.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('prioritymail-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(cached => cached || fetch(event.request)));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
  // Future OAuth/API responses are deliberately excluded from offline caching.
});
self.addEventListener('push', event => {
  // Future server must enforce notification preferences and quiet hours.
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Use privacy-preserving default. */ }
  const emailId = typeof payload.emailId === 'string' ? payload.emailId : '';
  event.waitUntil(self.registration.showNotification('PriorityMail', {
    body: 'You have an email that needs attention.',
    icon: '/icons/icon-192.png',
    tag: emailId || 'prioritymail',
    data: { url: emailId ? '/#email/' + encodeURIComponent(emailId) : '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
  const url = candidate.origin === self.location.origin ? candidate.href : self.location.origin;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(c => new URL(c.url).origin === self.location.origin);
    if (client) { await client.navigate(url); return client.focus(); }
    return self.clients.openWindow(url);
  }));
});
