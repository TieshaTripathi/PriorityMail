// PriorityMail backend — Real-World Verification Scenario Tests
// Phase 18: Verification of important email notification trigger and non-important email suppression

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEmail } from '../src/services/priorityEngine.js';

test('Phase 18 Scenario A: Interview Confirmation Required triggers actionRequired and high/urgent priority', () => {
  const importantEmail = {
    senderName: 'Placement Cell',
    senderEmail: 'placement@university.edu',
    subject: 'Interview Confirmation Required',
    snippet: 'Please confirm your attendance by tomorrow at 5 PM.',
    body: 'Dear candidate, your technical round is scheduled. Please confirm your attendance by tomorrow at 5 PM.',
    labelIds: ['INBOX'],
  };

  const result = classifyEmail(importantEmail, [], [], 'Balanced');

  // Must detect deadline / interview / action item
  assert.ok(result.score >= 4, `Score should be >= 4, got ${result.score}`);
  assert.ok(
    result.priority === 'urgent' || result.priority === 'high',
    `Priority must be urgent or high, got ${result.priority}`,
  );
  assert.equal(result.actionRequired, true, 'actionRequired must be true');
  assert.ok(
    result.reasons.some((r) => /deadline|interview|action/i.test(r)),
    `Reasons should reflect interview or deadline: ${JSON.stringify(result.reasons)}`,
  );

  // Verification that this meets Phase 13 notification gate
  const meetsNotificationGate =
    result.priority === 'urgent' ||
    result.priority === 'high' ||
    result.actionRequired;
  assert.equal(meetsNotificationGate, true, 'Important email MUST meet notification gate');
});

test('Phase 18 Scenario B: Weekly Newsletter is classified as FYI/Normal and suppressed from notifications', () => {
  const newsletterEmail = {
    senderName: 'Tech Digest Weekly',
    senderEmail: 'newsletter@techdigest.io',
    subject: 'Weekly Newsletter #42',
    snippet: 'Here are the top stories this week. Unsubscribe at any time.',
    body: 'Welcome to this week in tech! Catch up on the latest trends and promotional discounts. Click here to unsubscribe.',
    labelIds: ['INBOX'],
  };

  const result = classifyEmail(newsletterEmail, [], [], 'Balanced');

  // Downweighted by noise words
  assert.ok(
    result.priority === 'fyi' || result.priority === 'normal',
    `Newsletter priority should be fyi or normal, got ${result.priority}`,
  );
  assert.equal(result.actionRequired, false, 'Newsletter must NOT require action');

  // Verification that this is suppressed by Phase 13 notification gate
  const meetsNotificationGate =
    result.priority === 'urgent' ||
    result.priority === 'high' ||
    result.actionRequired;
  assert.equal(meetsNotificationGate, false, 'Newsletter email MUST be suppressed from push notification');
});

test('Phase 18 Scenario C: VIP sender elevates even standard messages to priority notifications', () => {
  const vipEmail = {
    senderName: 'Prof. Sharma',
    senderEmail: 'sharma@cs.dept.edu',
    subject: 'Quick question about the project',
    snippet: 'Are you available to chat later today?',
    body: 'Let me know what time works best for you.',
    labelIds: ['INBOX'],
  };

  const vips = [
    {
      id: 'vip-1',
      name: 'Prof. Sharma',
      email: 'sharma@cs.dept.edu',
      category: 'Professor',
    },
  ];

  const result = classifyEmail(vipEmail, [], vips, 'Balanced');

  assert.ok(
    result.priority === 'high' || result.priority === 'urgent',
    `VIP email should be high or urgent priority, got ${result.priority}`,
  );
  assert.equal(result.actionRequired, true, 'VIP email should mark actionRequired');
  assert.ok(result.reasons.some((r) => r.includes('VIP Contact')));
});
