import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gmailWebUrl,
  gmailAndroidIntent,
} from '../src/services/gmailDeepLink.ts';

test('gmailWebUrl generates correct URL for valid email with thread ID', () => {
  const url = gmailWebUrl({
    accountEmail: 'college@gmail.com',
    threadId: '18de921b714fa01',
  });
  assert.equal(
    url,
    'https://mail.google.com/mail/u/?authuser=college%40gmail.com#inbox/18de921b714fa01'
  );
});

test('gmailWebUrl falls back to messageId when threadId is omitted', () => {
  const url = gmailWebUrl({
    accountEmail: 'work@gmail.com',
    messageId: 'mock-msg-999',
  });
  assert.equal(
    url,
    'https://mail.google.com/mail/u/?authuser=work%40gmail.com#inbox/mock-msg-999'
  );
});

test('gmailWebUrl falls back to inbox root when neither threadId nor messageId is provided', () => {
  const url = gmailWebUrl({
    accountEmail: 'personal@gmail.com',
  });
  assert.equal(
    url,
    'https://mail.google.com/mail/u/?authuser=personal%40gmail.com#inbox'
  );
});

test('gmailWebUrl safely encodes special characters in email and thread ID', () => {
  const url = gmailWebUrl({
    accountEmail: 'user+test@domain.com',
    threadId: 'thread/123?abc=1',
  });
  assert.equal(
    url,
    'https://mail.google.com/mail/u/?authuser=user%2Btest%40domain.com#inbox/thread%2F123%3Fabc%3D1'
  );
});

test('gmailWebUrl throws an error for empty or invalid email address', () => {
  assert.throws(() => {
    gmailWebUrl({ accountEmail: '' });
  }, /This email needs a Gmail account/);

  assert.throws(() => {
    gmailWebUrl({ accountEmail: 'invalid-email' });
  }, /This email needs a Gmail account/);
});

test('gmailAndroidIntent creates a valid Android Intent URI with fallback', () => {
  const intent = gmailAndroidIntent({
    accountEmail: 'work@gmail.com',
    threadId: '18de8f99e4bca02',
  });
  assert.ok(intent.startsWith('intent://mail.google.com/mail/u/'));
  assert.ok(intent.includes('package=com.google.android.gm'));
  assert.ok(intent.includes('S.browser_fallback_url='));
  assert.ok(intent.endsWith(';end'));
});
