import assert from 'node:assert/strict';
import { parseGmailPush, verifyPubSubSender, PubSubValidationError } from './pubsubAuth.ts';

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

Deno.test('diagnostics identify validation stages without including raw input', () => {
  const marker = 'DO-NOT-LOG-PRIVATE-CONTENT';
  const cases: [unknown, string, string][] = [
    [{}, 'parse-envelope', 'subscription-missing-or-invalid'],
    [{ ...envelope({}), message: { messageId: '1', data: marker } }, 'decode-message', 'invalid-base64-encoding'],
    [{ ...envelope({}), message: { messageId: '1', data: btoa(marker) } }, 'decode-message', 'decoded-data-not-json'],
    [envelope({ emailAddress: 'test@example.com', historyId: 123, body: marker }), 'gmail-payload-validation', 'history-id-missing-or-not-digit-string'],
  ];
  for (const [body, stage, reason] of cases) {
    assert.throws(() => parseGmailPush(body), (error: unknown) => {
      assert.ok(error instanceof PubSubValidationError);
      assert.equal(error.stage, stage);
      assert.equal(error.reason, reason);
      assert.ok(!JSON.stringify(error).includes(marker));
      return true;
    });
  }
  const stages: string[] = [];
  parseGmailPush(envelope({ emailAddress: 'test@example.com', historyId: '123' }), stage => stages.push(stage));
  assert.deepEqual(stages, ['pubsub-envelope-parsed', 'gmail-payload-decoded']);
});
