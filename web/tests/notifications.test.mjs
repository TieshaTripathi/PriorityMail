import test from 'node:test';
import assert from 'node:assert/strict';
import { mockNotification } from '../src/services/notifications.ts';

const basePrefs = {
  notifications: true,
  aiClassification: true,
  deadlineAlerts: true,
  vipAlerts: true,
  quietHours: false,
  quietStart: '22:00',
  quietEnd: '08:00',
};

test('mockNotification warns when notifications are disabled globally', () => {
  const result = mockNotification({ ...basePrefs, notifications: false });
  assert.equal(result, 'Notifications are paused. Enable them in Settings.');
});

test('mockNotification respects deadlineAlerts preference', () => {
  const result = mockNotification(
    { ...basePrefs, deadlineAlerts: false },
    'deadline'
  );
  assert.equal(result, 'Deadline alerts are paused.');
});

test('mockNotification respects vipAlerts preference', () => {
  const result = mockNotification({ ...basePrefs, vipAlerts: false }, 'vip');
  assert.equal(result, 'VIP alerts are paused.');
});

test('mockNotification respects quiet hours during active window', () => {
  // Midnight (23:30) is inside 22:00 -> 08:00 window
  const nighttime = new Date('2026-09-15T23:30:00');
  const result = mockNotification(
    { ...basePrefs, quietHours: true, quietStart: '22:00', quietEnd: '08:00' },
    'general',
    nighttime
  );
  assert.equal(result, 'Quiet hours are active. Your demo alert was silenced.');
});

test('mockNotification delivers alert outside quiet hours window', () => {
  // Afternoon (14:00) is outside 22:00 -> 08:00 window
  const daytime = new Date('2026-09-15T14:00:00');
  const result = mockNotification(
    { ...basePrefs, quietHours: true, quietStart: '22:00', quietEnd: '08:00' },
    'deadline',
    daytime
  );
  assert.ok(result.includes('Demo alert'));
});
