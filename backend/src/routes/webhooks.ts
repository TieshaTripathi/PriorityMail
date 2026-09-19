// PriorityMail backend — Google Cloud Pub/Sub Webhook Route
// Receives real-time Gmail push notifications, pulls history, evaluates priority,
// and delivers push notifications to the user.

import { Router, type Request, type Response } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { decrypt, encrypt } from '../services/encryption.js';
import { buildOAuth2Client, refreshAccessToken } from '../services/googleAuth.js';
import { getMessage } from '../services/gmailService.js';
import { classifyEmail } from '../services/priorityEngine.js';
import { sendPushToUser, type NotificationPayload } from '../services/pushService.js';

export const webhooksRouter = Router();

interface PubSubMessageBody {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface GmailPubSubPayload {
  emailAddress?: string;
  historyId?: string;
}

function isQuietHours(settings: {
  quiet_hours_enabled: number;
  quiet_start: string;
  quiet_end: string;
}): boolean {
  if (!settings.quiet_hours_enabled) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = (settings.quiet_start || '22:00').split(':').map(Number);
  const [endH, endM] = (settings.quiet_end || '08:00').split(':').map(Number);

  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  if (startTotal === endTotal) return true;
  if (startTotal < endTotal) {
    return currentMinutes >= startTotal && currentMinutes < endTotal;
  }
  // Crosses midnight (e.g. 22:00 to 08:00)
  return currentMinutes >= startTotal || currentMinutes < endTotal;
}

/**
 * POST /api/webhooks/gmail-pubsub
 * Webhook endpoint registered with Google Cloud Pub/Sub Push Subscription.
 */
webhooksRouter.post('/gmail-pubsub', async (req: Request, res: Response) => {
  // Always acknowledge immediately or quickly with 200 so Pub/Sub does not resend endlessly
  const body = req.body as PubSubMessageBody;

  if (!body?.message?.data) {
    return res.status(200).json({ status: 'ignored', reason: 'no data in message' });
  }

  let eventData: GmailPubSubPayload;
  try {
    const raw = Buffer.from(body.message.data, 'base64').toString('utf8');
    eventData = JSON.parse(raw);
  } catch (err) {
    console.error('[pubsub] Could not parse Pub/Sub data payload:', err);
    return res.status(200).json({ status: 'ignored', reason: 'malformed data' });
  }

  const { emailAddress, historyId: incomingHistoryId } = eventData;
  if (!emailAddress || !incomingHistoryId) {
    return res.status(200).json({ status: 'ignored', reason: 'missing emailAddress or historyId' });
  }

  console.log(`[pubsub] Event received for account: ${emailAddress} (historyId: ${incomingHistoryId})`);

  const db = getDb();

  // 1. Locate the connected account and owner user
  const account = await db.queryOne<{
    id: string;
    user_id: string;
    email: string;
    access_token_enc: string;
    refresh_token_enc: string;
    expires_at: string;
  }>(
    `SELECT cga.id, cga.user_id, cga.email, gc.access_token_enc, gc.refresh_token_enc, gc.expires_at
     FROM connected_google_accounts cga
     JOIN gmail_credentials gc ON gc.connected_account_id = cga.id
     WHERE LOWER(cga.email) = LOWER(?)`,
    [emailAddress],
  );

  if (!account) {
    console.log(`[pubsub] No connected account found for email: ${emailAddress}`);
    return res.status(200).json({ status: 'ignored', reason: 'account not registered' });
  }

  const userId = account.user_id;

  // 2. Fetch watch state and previous historyId
  const watchState = await db.queryOne<{
    id: string;
    history_id: string;
  }>(
    'SELECT id, history_id FROM gmail_watch_state WHERE connected_account_id = ?',
    [account.id],
  );

  const startHistoryId = watchState?.history_id || incomingHistoryId;

  // 3. Prepare Gmail client
  let accessToken = decrypt(account.access_token_enc);
  const refreshToken = decrypt(account.refresh_token_enc);
  let expiresAt = account.expires_at;

  if (new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;
      await db.execute(
        'UPDATE gmail_credentials SET access_token_enc = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE connected_account_id = ?',
        [encrypt(accessToken), expiresAt, account.id],
      );
    } catch (err) {
      console.error('[pubsub] Token refresh failed:', err);
      return res.status(200).json({ status: 'error', reason: 'token refresh failed' });
    }
  }

  const auth = buildOAuth2Client(accessToken, refreshToken, expiresAt);
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    // 4. Fetch history since startHistoryId
    const historyRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
    });

    const histories = historyRes.data.history || [];
    const newMsgIds: string[] = [];

    for (const h of histories) {
      if (h.messagesAdded) {
        for (const ma of h.messagesAdded) {
          if (ma.message?.id && !newMsgIds.includes(ma.message.id)) {
            newMsgIds.push(ma.message.id);
          }
        }
      }
    }

    console.log(`[pubsub] Found ${newMsgIds.length} newly added messages for ${account.email}`);

    // Update stored historyId
    if (watchState) {
      await db.execute(
        'UPDATE gmail_watch_state SET history_id = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?',
        [incomingHistoryId, watchState.id],
      );
    }

    if (newMsgIds.length === 0) {
      return res.status(200).json({ status: 'ok', messagesProcessed: 0 });
    }

    // 5. Load user rules, VIPs, and notification settings
    const rules = await db.query<{
      id: string;
      type: string;
      value: string;
      weight: number;
      enabled: number;
    }>('SELECT * FROM priority_rules WHERE user_id = ? AND enabled = 1', [userId]);

    const vips = await db.query<{
      id: string;
      name: string;
      email: string;
      category: string;
    }>('SELECT * FROM vip_senders WHERE user_id = ?', [userId]);

    const settings = (await db.queryOne<{
      notifications_enabled: number;
      vip_alerts: number;
      deadline_alerts: number;
      action_alerts: number;
      sensitivity: string;
      quiet_hours_enabled: number;
      quiet_start: string;
      quiet_end: string;
    }>('SELECT * FROM user_settings WHERE user_id = ?', [userId])) ?? {
      notifications_enabled: 1,
      vip_alerts: 1,
      deadline_alerts: 1,
      action_alerts: 1,
      sensitivity: 'Balanced',
      quiet_hours_enabled: 0,
      quiet_start: '22:00',
      quiet_end: '08:00',
    };

    let notificationsDispatched = 0;

    for (const msgId of newMsgIds) {
      // 6. Deduplication check
      const alreadySent = await db.queryOne<{ id: string }>(
        'SELECT id FROM notification_history WHERE user_id = ? AND gmail_message_id = ?',
        [userId, msgId],
      );

      if (alreadySent) {
        continue;
      }

      // Record dedup key
      await db.execute(
        'INSERT INTO notification_history (id, user_id, gmail_message_id) VALUES (?, ?, ?)',
        [uuidv4(), userId, msgId],
      );

      // 7. Fetch full message
      const rawEmail = await getMessage(auth, msgId, account.id, account.email);

      // 8. Run priority classification
      const engineRules = rules.map((r) => ({
        id: r.id,
        type: r.type as any,
        value: r.value,
        weight: r.weight,
        enabled: Boolean(r.enabled),
      }));

      const result = classifyEmail(
        {
          senderName: rawEmail.senderName,
          senderEmail: rawEmail.senderEmail,
          subject: rawEmail.subject,
          snippet: rawEmail.snippet,
          body: rawEmail.body,
          labelIds: rawEmail.labelIds,
        },
        engineRules,
        vips,
        (settings.sensitivity as any) || 'Balanced',
      );

      // 9. PHASE 13 — Priority Decision Gate
      if (!settings.notifications_enabled) {
        console.log(`[pubsub] Notifications disabled for user ${userId}. Skipping alert.`);
        continue;
      }

      if (isQuietHours(settings)) {
        console.log(`[pubsub] Quiet hours active for user ${userId}. Silencing notification.`);
        continue;
      }

      const isVip = vips.some(
        (v) =>
          v.email.toLowerCase() === rawEmail.senderEmail.toLowerCase() ||
          (v.name && rawEmail.senderName.toLowerCase().includes(v.name.toLowerCase())),
      );

      const hasDeadline = result.reasons.some((r) => r.toLowerCase().includes('deadline'));
      const isAction = result.actionRequired;

      if (isVip && !settings.vip_alerts) continue;
      if (hasDeadline && !settings.deadline_alerts) continue;
      if (isAction && !settings.action_alerts && !isVip) continue;

      const isImportant =
        result.priority === 'urgent' ||
        result.priority === 'high' ||
        result.actionRequired ||
        (isVip && settings.vip_alerts);

      if (!isImportant) {
        console.log(
          `[pubsub] Message ${msgId} skipped: priority=${result.priority}, score=${result.score} below threshold.`,
        );
        continue;
      }

      // 10. Send notification
      const payload: NotificationPayload = {
        internalEmailId: rawEmail.gmailMessageId,
        gmailMessageId: rawEmail.gmailMessageId,
        gmailThreadId: rawEmail.gmailThreadId,
        accountEmail: rawEmail.accountEmail,
        senderName: rawEmail.senderName || 'Unknown Sender',
        subject: rawEmail.subject || '(No Subject)',
        priority: result.priority,
        reason: result.reason,
        category: result.category,
      };

      await sendPushToUser(userId, payload);
      notificationsDispatched++;
      console.log(`[pubsub] Push dispatched for email: ${rawEmail.subject} to user: ${userId}`);
    }

    res.status(200).json({
      status: 'ok',
      messagesFound: newMsgIds.length,
      notificationsDispatched,
    });
  } catch (err) {
    console.error('[pubsub] Error processing history:', err);
    res.status(200).json({ status: 'error', error: String(err) });
  }
});
