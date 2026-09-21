import assert from 'node:assert/strict';
import { notificationClickData } from './notificationClickData.ts';

Deno.test('Web Push data serializes an absolute PriorityMail UUID route', () => {
  const emailId = '12345678-1234-1234-1234-123456789012';
  const data = notificationClickData({ emailId, internalEmailId: emailId,
    gmailMessageId: 'gmail-id', gmailThreadId: 'thread-id', accountEmail: 'test@example.com' });
  const sent = JSON.parse(JSON.stringify({ title: 'PriorityMail', body: 'Preview', data }));
  assert.equal(sent.data.url, `https://priority-mail-zeta.vercel.app/?email=${emailId}`);
  assert.equal(sent.data.emailId, emailId);
  assert.equal(sent.data.gmailThreadId, 'thread-id');
  assert.equal(sent.data.accountEmail, 'test@example.com');
});
