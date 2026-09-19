// PriorityMail backend — Push Notification Service
// Standards-based Web Push (VAPID) for iPhone Home Screen PWA & desktop browsers.
// Native mobile push dispatch via Expo push service for Android devices.

import webpush from 'web-push';
import { getDb } from '../db/database.js';

export interface NotificationPayload {
  internalEmailId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  accountEmail: string;
  senderName: string;
  subject: string;
  priority: string;
  reason: string;
  category: string;
  title?: string;
  body?: string;
}

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@prioritymail.app';

if (!vapidPublicKey || !vapidPrivateKey) {
  // Generate dev fallback keys if not explicitly provided
  const generated = webpush.generateVAPIDKeys();
  vapidPublicKey = generated.publicKey;
  vapidPrivateKey = generated.privateKey;
  console.log('[push] Generated temporary development VAPID keys.');
  console.log('[push] Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in production.');
}

try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('[push] Web Push VAPID configured.');
} catch (err) {
  console.error('[push] Failed to set VAPID details:', err);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey || '';
}

/**
 * Send notification to all registered PWA subscriptions and mobile devices for a user.
 */
export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<{ pwaSent: number; mobileSent: number; errors: number }> {
  const db = getDb();
  let pwaSent = 0;
  let mobileSent = 0;
  let errors = 0;

  // Format message text
  const title = payload.title || 'PriorityMail';
  const reasonText = payload.reason ? `\nReason: ${payload.reason}` : '';
  const body = payload.body || `${payload.senderName}\n${payload.subject}${reasonText}`;

  const fullPayload = {
    ...payload,
    title,
    body,
  };

  // 1. Web Push (PWA / Browser)
  const subscriptions = await db.query<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId],
  );

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(fullPayload),
      );
      pwaSent++;
      console.log(`[push] Sent PWA push to subscription ${sub.id.slice(0, 8)}...`);
    } catch (err: unknown) {
      errors++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      console.warn(`[push] Failed to send push to ${sub.id.slice(0, 8)}:`, statusCode || err);
      // Clean up expired or unsubscribed endpoints
      if (statusCode === 404 || statusCode === 410) {
        await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        console.log(`[push] Removed expired subscription ${sub.id}`);
      }
    }
  }

  // 2. Mobile Device Tokens (Expo Android/iOS)
  const mobileTokens = await db.query<{
    id: string;
    token: string;
    platform: string;
  }>(
    'SELECT id, token, platform FROM mobile_device_tokens WHERE user_id = ?',
    [userId],
  );

  for (const item of mobileTokens) {
    try {
      if (item.token.startsWith('ExponentPushToken[') || item.token.startsWith('ExpoPushToken[')) {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            to: item.token,
            title,
            body,
            data: fullPayload,
            sound: 'default',
            priority: payload.priority === 'urgent' ? 'high' : 'default',
          }),
        });

        if (res.ok) {
          mobileSent++;
          console.log(`[push] Sent mobile push to device ${item.id.slice(0, 8)}...`);
        } else {
          const resText = await res.text();
          console.warn(`[push] Expo push response error: ${res.status} - ${resText}`);
          errors++;
        }
      }
    } catch (err) {
      errors++;
      console.warn(`[push] Mobile push error for ${item.id}:`, err);
    }
  }

  return { pwaSent, mobileSent, errors };
}

/**
 * Send a verification/test notification to the user's connected devices.
 */
export async function sendTestNotification(
  userId: string,
): Promise<{ pwaSent: number; mobileSent: number; errors: number; totalDevices: number }> {
  const db = getDb();
  const subsCount = await db.queryOne<{ count: number | string }>(
    'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?',
    [userId],
  );
  const tokensCount = await db.queryOne<{ count: number | string }>(
    'SELECT COUNT(*) as count FROM mobile_device_tokens WHERE user_id = ?',
    [userId],
  );

  const totalDevices =
    Number(subsCount?.count || 0) + Number(tokensCount?.count || 0);

  const testPayload: NotificationPayload = {
    internalEmailId: 'test-notification-sample',
    gmailMessageId: 'sample-gmail-id',
    gmailThreadId: 'sample-thread-id',
    accountEmail: 'user@example.com',
    senderName: 'PriorityMail Verification',
    subject: 'Push Notification Connected Successfully',
    priority: 'high',
    reason: 'Verified PriorityMail instant push delivery',
    category: 'personal',
    title: 'PriorityMail',
    body: 'PriorityMail Verification\nPush Notification Connected Successfully\nReason: Verified PriorityMail instant push delivery',
  };

  const results = await sendPushToUser(userId, testPayload);
  return { ...results, totalDevices };
}
