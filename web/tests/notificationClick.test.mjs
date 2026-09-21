import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const origin = 'https://priority-mail-zeta.vercel.app';
const emailId = '12345678-1234-1234-1234-123456789012';
const url = `${origin}/?email=${emailId}`;
for (const file of ['scripts/sw-template.js', 'public/sw.js']) {
  function worker(windows = [], matchFails = false) {
    const handlers = {}; const calls = []; let options;
    const self = { location: { origin }, addEventListener: (name, fn) => handlers[name] = fn,
      registration: { showNotification: async (_, value) => options = value },
      clients: {
        matchAll: async args => { calls.push(['match', args]); if (matchFails) throw Error('closed'); return windows; },
        openWindow: async target => { calls.push(['open', target]); return null; },
      },
    };
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace('__SHELL__', '[]');
    vm.runInNewContext(source, { self, URL, console });
    return { calls, async push(payload) {
      let pending; handlers.push({ data: { json: () => payload }, waitUntil: p => pending = p });
      await pending; return options;
    }, async click(data) {
      let pending;
      handlers.notificationclick({ notification: { data, close: () => calls.push(['close']) },
        waitUntil: p => { calls.push(['waitUntil']); pending = p; } });
      assert.ok(pending instanceof Promise || typeof pending?.then === 'function');
      await pending;
    } };
  }
  test(`${file}: nested data reaches notification and exact window route`, async () => {
    let navigated; let focused = false;
    const client = { url: origin, navigate: async target => { navigated = target; return client; }, focus: async () => focused = true };
    const sw = worker([client]);
    const data = { emailId, url, gmailThreadId: 'thread-1', accountEmail: 'test@example.com' };
    const options = await sw.push({ title: 'PriorityMail', body: 'Preview', data });
    assert.equal(options.data.url, url);
    assert.equal(options.data.emailId, emailId);
    assert.equal(options.data.gmailThreadId, 'thread-1');
    sw.calls.length = 0;
    await sw.click(options.data);
    assert.equal(sw.calls[0][0], 'close');
    assert.ok(sw.calls.some(c => c[0] === 'waitUntil'));
    assert.equal(navigated, url); assert.ok(focused);
    assert.ok(!sw.calls.some(c => c[0] === 'open'));
  });
  test(`${file}: absent/closed/failing windows fall back to openWindow`, async () => {
    for (const clients of [[], [{ url: origin, navigate: async () => { throw Error('closed'); }, focus() {} }],
      [{ url: origin, navigate: async () => null, focus() {} }],
      [{ url: origin, navigate: async () => ({ focus: async () => { throw Error('unfocusable'); } }), focus() {} }]]) {
      const sw = worker(clients); await sw.click({ emailId, url });
      assert.equal(sw.calls.find(c => c[0] === 'open')[1], url);
    }
    const sw = worker([], true); await sw.click({ url });
    assert.equal(sw.calls.find(c => c[0] === 'open')[1], url);
  });
  test(`${file}: missing or malicious data opens only app home`, async () => {
    for (const data of [undefined, {}, { url: 'https://mail.google.com/' }, { url: 'http://[' }]) {
      const sw = worker(); await sw.click(data);
      assert.equal(sw.calls.find(c => c[0] === 'open')[1], `${origin}/`);
    }
  });
  test(`${file}: tries next window after first navigation fails`, async () => {
    let navigated;
    const next = { url: origin, navigate: async target => { navigated = target; return next; }, focus: async () => {} };
    const sw = worker([{ url: origin, navigate: async () => { throw Error('closed'); }, focus() {} }, next]);
    await sw.click({ url }); assert.equal(navigated, url);
    assert.ok(!sw.calls.some(c => c[0] === 'open'));
  });
}
