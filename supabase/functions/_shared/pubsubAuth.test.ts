import assert from 'node:assert/strict';
import { parseGmailPush, verifyPubSubSender } from './pubsubAuth.ts';

const envelope = (data: unknown) => ({
  subscription: 'projects/test-project/subscriptions/gmail',
  message: { messageId: '123', data: btoa(JSON.stringify(data)) },
});

Deno.test('valid Gmail envelope ignores arbitrary user ownership fields', () => {
  assert.deepEqual(parseGmailPush(envelope({
    emailAddress: 'test@example.com', historyId: '12345678901234567890', user_id: 'attacker',
  })), { emailAddress: 'test@example.com', historyId: '12345678901234567890' });
});

Deno.test('malformed envelopes and Gmail data are rejected', () => {
  for (const body of [null, [], {}, { message: {} }, envelope(null), envelope([]),
    envelope({ emailAddress: 'test@example.com', historyId: 123 }),
    envelope({ emailAddress: 'not-an-email', historyId: '123' }),
    envelope({ emailAddress: 'test@example.com', historyId: '-1' }),
    { ...envelope({}), message: { messageId: '123', data: '%%%' } },
  ]) assert.throws(() => parseGmailPush(body));
});

Deno.test('missing sender token and missing configuration fail closed', async () => {
  await assert.rejects(verifyPubSubSender(new Request('https://example.com')), /authentication required/);
  const previous = Deno.env.get('PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL');
  try {
    Deno.env.delete('PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL');
    await assert.rejects(verifyPubSubSender(new Request('https://example.com', {
      headers: { Authorization: 'Bearer test-invalid-token' },
    })), /not configured/);
  } finally {
    if (previous !== undefined) Deno.env.set('PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL', previous);
  }
});
