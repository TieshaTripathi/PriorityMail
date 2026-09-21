// PriorityMail Edge Function: gmail-pubsub-webhook
// Receives real-time Gmail push notifications from Google Cloud Pub/Sub,
// fetches history, classifies new messages, and dispatches push notifications.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { verifyPubSubSender, parseGmailPush, PubSubValidationError } from '../_shared/pubsubAuth.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { decrypt, encrypt } from '../_shared/crypto.ts';
import { refreshGoogleToken } from '../_shared/googleAuth.ts';
import { listHistory, getMessage } from '../_shared/gmailApi.ts';
import {
  classifyEmail,
  type EngineRule,
  type EngineVipPerson,
  type PrioritySensitivity,
} from '../_shared/priorityEngine.ts';
import { sendPushToUser, type NotificationPayload } from '../_shared/pushSender.ts';

function isQuietHours(settings: {
  quiet_hours_enabled: boolean;
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
  return currentMinutes >= startTotal || currentMinutes < endTotal;
}

async function handleRequest(req: Request, log: (stage: string, metadata?: Record<string, unknown>, rejected?: boolean) => void) {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== 'POST') {
    log('request-method', { reason: 'method-not-allowed', status: 405 }, true);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let eventData: { emailAddress: string; historyId: string };
  try {
    eventData = parseGmailPush(await req.json(), log);
  } catch (error) {
    log(error instanceof PubSubValidationError ? error.stage : 'parse-envelope', {
      reason: error instanceof PubSubValidationError ? error.reason : 'request-body-not-json', status: 400,
    }, true);
    return jsonResponse({ error: 'Invalid Pub/Sub payload' }, 400);
  }
  try {
    await verifyPubSubSender(req, log);
  } catch (error) {
    log('jwt-verification', {
      reason: error instanceof PubSubValidationError ? error.reason : 'sender-verification-failed', status: 401,
    }, true);
    // Do not log bearer tokens or expose verification internals.
    return jsonResponse({ error: 'Pub/Sub sender verification failed' }, 401);
  }
  const { emailAddress, historyId: incomingHistoryId } = eventData;

  log('gmail-email-address-resolved', { emailAddress });
  log('history-id-received', { historyId: incomingHistoryId });

  const adminClient = getAdminClient();

  // 1. Locate the connected account and owner user
  const { data: account, error: accountError } = await adminClient
    .from('connected_google_accounts')
    .select('id, user_id, email')
    .ilike('email', emailAddress.replace(/[\\%_]/g, '\\$&'))
    .maybeSingle();

  if (!account) {
    log('account-resolution', { reason: accountError ? 'account-lookup-failed' : 'account-not-registered', status: 200 }, true);
    return jsonResponse({ status: 'ignored', reason: 'account not registered' }, 200);
  }

  log('connected-account-found', { connected_account_id: account.id });
  const userId = account.user_id;

  // 2. Fetch watch state and previous historyId
  const { data: watchState } = await adminClient
    .from('gmail_watch_state')
    .select('id, history_id')
    .eq('connected_account_id', account.id)
    .maybeSingle();

  // Acknowledge notifications already covered by the stored Gmail history cursor.
  if (watchState?.history_id && /^[0-9]+$/.test(watchState.history_id) &&
      BigInt(incomingHistoryId) <= BigInt(watchState.history_id)) {
    log('deduplication', { reason: 'history-already-processed', status: 200 });
    return jsonResponse({ status: 'ignored', reason: 'history already processed' }, 200);
  }

  const startHistoryId = watchState?.history_id || incomingHistoryId;

  // 3. Load and decrypt credentials
  const { data: cred } = await adminClient
    .from('gmail_credentials')
    .select('encrypted_refresh_token, encrypted_access_token, expires_at')
    .eq('connected_account_id', account.id)
    .maybeSingle();

  if (!cred) {
    log('credentials', { reason: 'credentials-missing', status: 200 }, true);
    return jsonResponse({ status: 'ignored', reason: 'credentials missing' }, 200);
  }

  let accessToken = cred.encrypted_access_token ? await decrypt(cred.encrypted_access_token) : '';
  const refreshToken = await decrypt(cred.encrypted_refresh_token);
  const expiresAtMs = new Date(cred.expires_at).getTime();

  if (!accessToken || expiresAtMs - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshGoogleToken(refreshToken);
      accessToken = refreshed.accessToken;
      const encAccess = await encrypt(accessToken);

      await adminClient
        .from('gmail_credentials')
        .update({
          encrypted_access_token: encAccess,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('connected_account_id', account.id);
    } catch (err) {
      log('token-refresh', { reason: 'token-refresh-failed', status: 200 }, true);
      return jsonResponse({ status: 'error', reason: 'token refresh failed' }, 200);
    }
  }

  try {
    // 4. Fetch history since startHistoryId
    log('gmail-history-processing-started', { historyId: startHistoryId });
    const { newMsgIds, latestHistoryId } = await listHistory(accessToken, startHistoryId);

    log('gmail-history-fetched', { messageCount: newMsgIds.length });

    // Update watch state with new historyId
    const historyToStore = latestHistoryId || incomingHistoryId;
    if (watchState) {
      await adminClient
        .from('gmail_watch_state')
        .update({
          history_id: historyToStore,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', watchState.id);
    }

    if (newMsgIds.length === 0) {
      return jsonResponse({ status: 'ok', messagesProcessed: 0 }, 200);
    }

    // 5. Load user rules, VIPs, and notification settings
    const [rulesRes, vipsRes, settingsRes] = await Promise.all([
      adminClient.from('priority_rules').select('*').eq('user_id', userId).eq('enabled', true),
      adminClient.from('vip_senders').select('*').eq('user_id', userId),
      adminClient.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const rules: EngineRule[] = (rulesRes.data ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      value: r.value,
      weight: r.weight,
      enabled: r.enabled,
    }));

    const vips: EngineVipPerson[] = (vipsRes.data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      email: v.email,
      category: v.category,
    }));

    const settings = settingsRes.data ?? {
      notifications_enabled: true,
      vip_alerts: true,
      deadline_alerts: true,
      action_alerts: true,
      sensitivity: 'Balanced',
      quiet_hours_enabled: false,
      quiet_start: '22:00',
      quiet_end: '08:00',
    };

    let notificationsDispatched = 0;

    for (const msgId of newMsgIds) {
      // 6. Deduplication check
      const { data: alreadySent } = await adminClient
        .from('notification_history')
        .select('id')
        .eq('user_id', userId)
        .eq('gmail_message_id', msgId)
        .maybeSingle();

      if (alreadySent) {
        log('push-decision', { decision: 'skip', reason: 'already-recorded' });
        continue;
      }

      // Record dedup key
      await adminClient.from('notification_history').insert({
        user_id: userId,
        gmail_message_id: msgId,
      });

      // 7. Fetch full message
      const rawEmail = await getMessage(accessToken, msgId, account.id, account.email);

      // 8. Run priority classification
      const result = classifyEmail(
        {
          senderName: rawEmail.senderName,
          senderEmail: rawEmail.senderEmail,
          subject: rawEmail.subject,
          snippet: rawEmail.snippet,
          body: rawEmail.body,
          labelIds: rawEmail.labelIds,
        },
        rules,
        vips,
        (settings.sensitivity as PrioritySensitivity) || 'Balanced'
      );

      log('priority-result', { priority: result.priority, category: result.category });

      // Persist email metadata
      await adminClient.from('email_metadata').upsert(
        {
          user_id: userId,
          connected_account_id: account.id,
          gmail_message_id: rawEmail.gmailMessageId,
          gmail_thread_id: rawEmail.gmailThreadId,
          sender_name: rawEmail.senderName,
          sender_email: rawEmail.senderEmail,
          subject: rawEmail.subject,
          snippet: rawEmail.snippet,
          received_at: rawEmail.receivedAt,
          label_ids: rawEmail.labelIds,
          is_read: rawEmail.isRead,
          is_important:
            rawEmail.labelIds.includes('IMPORTANT') ||
            result.priority === 'urgent' ||
            result.priority === 'high',
          priority: result.priority,
          score: result.score,
          category: result.category,
          reasons: result.reasons,
          action_required: result.actionRequired,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,gmail_message_id' }
      );

      // 9. Notification Decision Gate
      if (!settings.notifications_enabled) {
        log('push-decision', { decision: 'skip', reason: 'notifications-disabled' });
        continue;
      }

      if (isQuietHours(settings)) {
        log('push-decision', { decision: 'skip', reason: 'quiet-hours' });
        continue;
      }

      const isVip = vips.some(
        (v) =>
          v.email.toLowerCase() === rawEmail.senderEmail.toLowerCase() ||
          (v.name && rawEmail.senderName.toLowerCase().includes(v.name.toLowerCase()))
      );

      const hasDeadline = result.reasons.some((r) => r.toLowerCase().includes('deadline'));
      const isAction = result.actionRequired;

      if (isVip && !settings.vip_alerts) {
        log('push-decision', { decision: 'skip', reason: 'vip-alerts-disabled' });
        continue;
      }
      if (hasDeadline && !settings.deadline_alerts) {
        log('push-decision', { decision: 'skip', reason: 'deadline-alerts-disabled' });
        continue;
      }
      if (isAction && !settings.action_alerts && !isVip) {
        log('push-decision', { decision: 'skip', reason: 'action-alerts-disabled' });
        continue;
      }

      const isImportant =
        result.priority === 'urgent' ||
        result.priority === 'high' ||
        result.actionRequired ||
        (isVip && settings.vip_alerts);

      if (!isImportant) {
        log('push-decision', { decision: 'skip', reason: 'not-important' });
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

      log('push-decision', { decision: 'dispatch' });
      await sendPushToUser(userId, payload);
      log('push-dispatch-returned');
      notificationsDispatched++;
    }

    return jsonResponse(
      {
        status: 'ok',
        messagesFound: newMsgIds.length,
        notificationsDispatched,
      },
      200
    );
  } catch (err) {
    log('gmail-history-processing', { reason: 'history-processing-failed', status: 200 }, true);
    return jsonResponse({ status: 'error', error: String(err) }, 200);
  }
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  let lastStage = 'request-start';
  const log = (stage: string, metadata: Record<string, unknown> = {}, rejected = false) => {
    lastStage = stage;
    const fields = { requestId, stage, ...metadata };
    if (rejected) console.warn('[gmail-pubsub] rejected', fields);
    else console.log('[gmail-pubsub] stage', fields);
  };
  try {
    return await handleRequest(req, log);
  } catch (error) {
    log('unhandled-error', { reason: 'unhandled-function-error', afterStage: lastStage, status: 500 }, true);
    // Preserve runtime error handling; never print the raw error or request.
    throw new Error('Pub/Sub webhook processing failed');
  }
});
