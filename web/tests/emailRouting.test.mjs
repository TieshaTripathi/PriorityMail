import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { loadEmailById, loadLatestEmails, newestFirst, plainEmailPreview } from '../src/services/emailStore.ts';
import { subscribeInboxRefresh } from '../src/services/inboxRefresh.ts';

const id = '12345678-1234-1234-1234-123456789012';
const row = { id, user_id: 'A', connected_account_id: 'account-A', gmail_message_id: 'gmail-1',
  gmail_thread_id: 'thread-1', connected_google_accounts: { email: 'a@example.com' },
  received_at: '2026-09-21T10:00:00Z' };
function clientFor(user, rows) {
  return { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    from(table) {
      assert.equal(table, 'email_metadata');
      let result = rows;
      const query = {
        select: () => query,
        eq: (key, value) => { result = result.filter(r => r[key] === value); return query; },
        order: (key, options) => { assert.equal(key, 'received_at'); assert.equal(options.ascending, false); return query; },
        limit: async () => ({ data: result }),
        maybeSingle: async () => ({ data: result[0] || null }),
      };
      return query;
    },
  };
}
test('off-page detail loads by persisted UUID and cannot query another owner', async () => {
  assert.equal((await loadEmailById(id, clientFor('A', [row]))).gmailThreadId, 'thread-1');
  assert.equal(await loadEmailById(id, clientFor('B', [row])), null);
  assert.equal(await loadEmailById('gmail-1', clientFor('A', [row])), null);
});
test('latest inbox scopes account and owner and explicitly requests newest first', async () => {
  assert.equal((await loadLatestEmails('account-A', clientFor('A', [row]))).length, 1);
  assert.equal((await loadLatestEmails('other-account', clientFor('A', [row]))).length, 0);
  assert.equal((await loadLatestEmails('all', clientFor('B', [row]))).length, 0);
  assert.deepEqual(newestFirst([{ id: 'old', receivedAt: '2026-09-20' }, { id: 'new', receivedAt: '2026-09-21' },
    { id: 'new', receivedAt: '2026-09-21' }]).map(e => e.id), ['new', 'old']);
});
test('focus and visible events refetch newly persisted emails and cleanup listeners', async () => {
  const win = new EventTarget(); const doc = new EventTarget(); doc.visibilityState = 'visible';
  win.setInterval = () => 1; win.clearInterval = () => {};
  const rows = []; let emails = []; let pending; const worker = new EventTarget();
  const stop = subscribeInboxRefresh(() => { pending = loadLatestEmails('all', clientFor('A', rows)).then(v => emails = v); }, win, doc, worker);
  rows.push(row); win.dispatchEvent(new Event('focus')); await pending;
  assert.equal(emails[0].id, id);
  emails = []; doc.dispatchEvent(new Event('visibilitychange')); await pending; assert.equal(emails.length, 1);
  emails = []; worker.dispatchEvent(new MessageEvent('message', { data: { type: 'prioritymail-inbox-refresh' } }));
  await pending; assert.equal(emails.length, 1);
  stop(); emails = []; win.dispatchEvent(new Event('focus')); await pending; assert.equal(emails.length, 0);
});
for (const path of ['scripts/sw-template.js', 'public/sw.js']) {
  test(`${path}: notification click uses UUID query route in existing and new windows`, async () => {
    const listeners = {}; let notification; let navigated; let focused = false; let opened;
    let windows = [{ url: 'https://priority.test/', navigate: async url => { navigated = url; return windows[0]; }, focus: async () => focused = true }];
    const self = { location: { origin: 'https://priority.test' }, addEventListener: (name, fn) => listeners[name] = fn,
      registration: { showNotification: async (_, options) => notification = options },
      clients: { matchAll: async () => windows, openWindow: async url => opened = url } };
    const code = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace('__SHELL__', '[]');
    vm.runInNewContext(code, { self, URL });
    let pending;
    listeners.push({ data: { json: () => ({ emailId: id, internalEmailId: id, gmailMessageId: 'gmail-1' }) }, waitUntil: p => pending = p });
    await pending;
    const click = () => listeners.notificationclick({ notification: { data: notification.data, close() {} }, waitUntil: p => pending = p });
    click(); await pending;
    assert.equal(navigated, `https://priority.test/?email=${id}`); assert.ok(focused);
    windows = []; click(); await pending; assert.equal(opened, navigated);
  });
}
test('preview removes basic Markdown without interpreting HTML', () => {
  assert.equal(plainEmailPreview('**Hello** ![](https://image) [link](https://test)'), 'Hello  link');
  assert.equal(plainEmailPreview('<script>alert(1)</script>'), '<script>alert(1)</script>');
});
