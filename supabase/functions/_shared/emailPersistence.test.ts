import assert from 'node:assert/strict';
import { persistEmailIdentity } from './emailPersistence.ts';

Deno.test('notification identity comes from successful persisted upsert; duplicate key reuses row', async () => {
  const rows = new Map<string, { id: string }>();
  const client = { from(table: string) {
    assert.equal(table, 'email_metadata');
    return { upsert(row: Record<string, unknown>, options: { onConflict: string }) {
      assert.equal(options.onConflict, 'user_id,gmail_message_id');
      const key = `${row.user_id}:${row.gmail_message_id}`;
      if (!rows.has(key)) rows.set(key, { id: crypto.randomUUID() });
      return { select: () => ({ single: async () => ({ data: rows.get(key)!, error: null }) }) };
    } };
  } };
  const row = { user_id: 'A', gmail_message_id: 'gmail-1', gmail_thread_id: 'thread-1', connected_account_id: 'account-1' };
  const first = await persistEmailIdentity(client, row);
  const duplicate = await persistEmailIdentity(client, row);
  assert.equal(rows.size, 1);
  assert.equal(first.emailId, duplicate.emailId);
  assert.notEqual(first.emailId, row.gmail_message_id);
  assert.equal(first.route, `/?email=${first.emailId}`);
  assert.equal(first.gmailThreadId, 'thread-1');
});
Deno.test('failed persistence cannot produce a notification identity', async () => {
  const client = { from: () => ({ upsert: () => ({ select: () => ({
    single: async () => ({ data: null, error: new Error('database unavailable') }),
  }) }) }) };
  await assert.rejects(persistEmailIdentity(client, {}), /Could not persist/);
});
