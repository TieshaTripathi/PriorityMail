import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriority } from '../src/engine/priorityEngine.ts';

const baseEmail = {
  senderName: 'Generic Sender',
  senderEmail: 'sender@example.com',
  subject: 'General Update',
  snippet: 'Here is some information for you.',
  body: 'Full message body details.',
  category: 'work',
};

test('calculatePriority detects VIP Contacts and awards +6 score and actionRequired', () => {
  const vipList = [
    {
      id: 'vip-1',
      name: 'Sarah Chen',
      email: 'sarah.chen@techcorp.io',
      category: 'Manager',
    },
  ];

  const email = {
    ...baseEmail,
    senderName: 'Sarah Chen',
    senderEmail: 'sarah.chen@techcorp.io',
    subject: 'Project check-in',
  };

  const result = calculatePriority(email, [], vipList, 'Balanced');
  assert.ok(result.score >= 6, `Expected score >= 6, got ${result.score}`);
  assert.equal(result.actionRequired, true);
  assert.ok(result.reasons.some((r) => r.includes('VIP Contact: Sarah Chen')));
});

test('calculatePriority detects explicit deadlines and awards +5 score and actionRequired', () => {
  const email = {
    ...baseEmail,
    subject: 'Application submission',
    snippet: 'Please submit your files before the deadline.',
    deadline: 'Tomorrow, 5:00 PM',
  };

  const result = calculatePriority(email, [], [], 'Balanced');
  assert.ok(result.score >= 5, `Expected score >= 5, got ${result.score}`);
  assert.equal(result.actionRequired, true);
  assert.ok(result.reasons.some((r) => r.includes('deadline detected')));
});

test('calculatePriority detects interview rounds and awards +4 score', () => {
  const email = {
    ...baseEmail,
    subject: 'Technical Round 1 Schedule Confirmed',
    snippet: 'Your technical round is scheduled for Wednesday.',
  };

  const result = calculatePriority(email, [], [], 'Balanced');
  assert.ok(result.score >= 4, `Expected score >= 4, got ${result.score}`);
  assert.equal(result.actionRequired, true);
  assert.ok(result.reasons.some((r) => r.includes('Interview schedule')));
});

test('calculatePriority downweights marketing and newsletters (-5 points)', () => {
  const email = {
    ...baseEmail,
    subject: 'Weekly Digest: Top News',
    snippet: 'Click here to unsubscribe from this promotional newsletter.',
    category: 'personal',
  };

  const result = calculatePriority(email, [], [], 'Balanced');
  assert.equal(result.priority, 'fyi');
  assert.ok(result.reasons.some((r) => r.includes('newsletter')));
});

test('calculatePriority applies user priority rules correctly', () => {
  const rules = [
    {
      id: 'rule-domain',
      type: 'domain',
      value: 'sies.edu.in',
      weight: 4,
      enabled: true,
    },
    {
      id: 'rule-keyword',
      type: 'keyword',
      value: 'hackathon',
      weight: 5,
      enabled: true,
    },
  ];

  const email = {
    ...baseEmail,
    senderEmail: 'organizer@sies.edu.in',
    subject: 'National Hackathon 2026',
    snippet: 'Join the annual hackathon challenge.',
    category: 'college',
  };

  const result = calculatePriority(email, rules, [], 'Balanced');
  assert.ok(result.score >= 9, `Expected score >= 9, got ${result.score}`);
  assert.equal(result.priority, 'urgent');
  assert.ok(result.reasons.some((r) => r.includes('Domain rule matched: @sies.edu.in')));
  assert.ok(result.reasons.some((r) => r.includes('Keyword matched: "hackathon"')));
});

test('calculatePriority respects sensitivity thresholds', () => {
  const email = {
    ...baseEmail,
    subject: 'Short question',
    snippet: 'Could you review draft when you have a moment?',
  };

  // 'review draft' matches action items (+4 points)
  const highResult = calculatePriority(email, [], [], 'High');
  assert.equal(highResult.priority, 'high'); // Score 4 >= 3 -> 'high'

  const lowResult = calculatePriority(email, [], [], 'Low');
  assert.equal(lowResult.priority, 'normal'); // Score 4 < 6 -> 'normal'
});
