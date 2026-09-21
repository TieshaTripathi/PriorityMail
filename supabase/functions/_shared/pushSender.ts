// PriorityMail Edge Functions — Push Notification Sender
// Supports Web Push (RFC 8291 / 8292 VAPID) and Expo native mobile push.

import webpush from 'npm:web-push@3.6.7';
import { getAdminClient } from './supabaseClient.ts';
import { notificationClickData } from './notificationClickData.ts';

export interface NotificationPayload {
  internalEmailId: string;
  emailId?: string;
  connectedAccountId?: string;
  route?: string;
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

export function getVapidKeys() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@prioritymail.app';
  return { publicKey, privateKey, subject };
}

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const { publicKey, privateKey, subject } = getVapidKeys();
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
    } catch (err) {
      console.error('[pushSender] VAPID configuration error:', err);
    }
  }
}

/**
 * Sends push notifications across all Web Push and Expo Android devices registered to `userId`.
 */
export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ pwaSent: number; mobileSent: number; errors: number }> {
  ensureVapidConfigured();
  const adminClient = getAdminClient();

  let pwaSent = 0;
  let mobileSent = 0;
  let errors = 0;

  const title = payload.title || 'PriorityMail';
  const reasonText = payload.reason ? `\nReason: ${payload.reason}` : '';
  const body = payload.body || `${payload.senderName}\n${payload.subject}${reasonText}`;

  const fullPayload = {
    ...payload,
    title,
    body,
  };

  // 1. Web Push (PWA subscriptions)
  const { data: subscriptions } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (subscriptions && subscriptions.length > 0) {
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
          JSON.stringify({
            ...fullPayload,
            icon: '/icons/icon-192.png',
            data: notificationClickData(payload),
          })
        );
        pwaSent++;
      } catch (err: unknown) {
        errors++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        console.warn(`[pushSender] Web push failed for sub ${sub.id.slice(0, 8)}:`, statusCode || err);
        // Clean up expired or unsubscribed endpoints
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  // 2. Mobile Device Tokens (Expo Android)
  const { data: mobileTokens } = await adminClient
    .from('mobile_device_tokens')
    .select('id, token, platform')
    .eq('user_id', userId);

  if (mobileTokens && mobileTokens.length > 0) {
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
          } else {
            errors++;
            console.warn(`[pushSender] Expo push response error: ${res.status}`);
          }
        }
      } catch (err) {
        errors++;
        console.warn(`[pushSender] Mobile push error for ${item.id}:`, err);
      }
    }
  }

  return { pwaSent, mobileSent, errors };
}
