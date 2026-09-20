import test from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../src/services/supabaseClient.ts';
import { startConnectGmailAccount } from '../src/services/apiClient.ts';

test('Gmail connection requires a session and invokes the function before redirecting', async (t) => {
  const session = t.mock.method(supabase.auth, 'getSession', async () => ({
    data: { session: { access_token: 'test-session-token' } }, error: null,
  }));
  const invoke = t.mock.method(Object.getPrototypeOf(supabase.functions), 'invoke', async () => ({
    data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' }, error: null,
  }));
  assert.equal(await startConnectGmailAccount(), 'https://accounts.google.com/o/oauth2/v2/auth?state=test');
  assert.deepEqual(invoke.mock.calls[0].arguments, ['gmail-connect', {
    method: 'POST', headers: { Authorization: 'Bearer test-session-token' },
  }]);

  session.mock.mockImplementation(async () => ({ data: { session: null }, error: null }));
  await assert.rejects(startConnectGmailAccount(), /Please sign in/);
  assert.equal(invoke.mock.callCount(), 1);

  session.mock.mockImplementation(async () => ({ data: { session: null }, error: new Error('Session expired') }));
  await assert.rejects(startConnectGmailAccount(), /Session expired/);
  assert.equal(invoke.mock.callCount(), 1);
});

test('Gmail connection surfaces errors and never falls back to a function URL', async (t) => {
  t.mock.method(supabase.auth, 'getSession', async () => ({
    data: { session: { access_token: 'test-session-token' } }, error: null,
  }));
  const invoke = t.mock.method(Object.getPrototypeOf(supabase.functions), 'invoke', async () => ({
    data: null, error: { context: new Response(JSON.stringify({ message: 'OAuth configuration missing' })) },
  }));
  await assert.rejects(startConnectGmailAccount(), /OAuth configuration missing/);
  invoke.mock.mockImplementation(async () => ({ data: {}, error: null }));
  await assert.rejects(startConnectGmailAccount(), /valid Google authorization URL/);
  invoke.mock.mockImplementation(async () => ({
    data: { url: 'https://hcakoyjungekkjoowovx.supabase.co/functions/v1/gmail-connect' }, error: null,
  }));
  await assert.rejects(startConnectGmailAccount(), /unexpected authorization URL/);
});

