// PriorityMail Edge Function: gmail-messages
// Fetches, normalizes, classifies, and returns real Gmail messages for an account or all accounts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';
import { decrypt, encrypt } from '../_shared/crypto.ts';
import { refreshGoogleToken } from '../_shared/googleAuth.ts';
import { listRecentMessages, getMessage, type NormalizedEmail } from '../_shared/gmailApi.ts';
import {
  classifyEmail,
  type EngineRule,
  type EngineVipPerson,
  type PrioritySensitivity,
} from '../_shared/priorityEngine.ts';

interface AccountAuth {
  id: string;
  email: string;
  accessToken: string;
}

async function getValidAccessToken(
  accountId: string,
  userId: string
): Promise<AccountAuth | null> {
  const adminClient = getAdminClient();

  const { data: account } = await adminClient
    .from('connected_google_accounts')
    .select('id, email')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!account) return null;

  const { data: cred } = await adminClient
    .from('gmail_credentials')
    .select('encrypted_refresh_token, encrypted_access_token, expires_at')
    .eq('connected_account_id', accountId)
    .maybeSingle();

  if (!cred) return null;

  let accessToken = cred.encrypted_access_token ? await decrypt(cred.encrypted_access_token) : '';
  const refreshToken = await decrypt(cred.encrypted_refresh_token);
  const expiresAtMs = new Date(cred.expires_at).getTime();

  // If token is expired or within 5 minutes of expiration, refresh it
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
        .eq('connected_account_id', accountId);
    } catch (err) {
      console.error(`[gmail-messages] Token refresh failed for ${account.email}:`, err);
      return null;
    }
  }

  return {
    id: account.id,
    email: account.email,
    accessToken,
  };
}

async function getUserClassificationData(userId: string) {
  const adminClient = getAdminClient();

  const [rulesRes, vipsRes, settingsRes] = await Promise.all([
    adminClient.from('priority_rules').select('*').eq('user_id', userId).eq('enabled', true),
    adminClient.from('vip_senders').select('*').eq('user_id', userId),
    adminClient.from('user_settings').select('sensitivity').eq('user_id', userId).maybeSingle(),
  ]);

  const rules: EngineRule[] = (rulesRes.data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    value: r.value,
    weight: r.weight,
    enabled: r.enabled,
  }));

  const vipPeople: EngineVipPerson[] = (vipsRes.data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    email: v.email,
    category: v.category,
  }));

  const sensitivity: PrioritySensitivity =
    (settingsRes.data?.sensitivity as PrioritySensitivity) || 'Balanced';

  return { rules, vipPeople, sensitivity };
}

async function fetchAccountEmails(
  accountId: string,
  userId: string,
  maxResults = 25,
  classificationData: Awaited<ReturnType<typeof getUserClassificationData>>
) {
  const auth = await getValidAccessToken(accountId, userId);
  if (!auth) return null;

  const { messageIds } = await listRecentMessages(auth.accessToken, maxResults);
  if (messageIds.length === 0) {
    return { emails: [], accountId, accountEmail: auth.email };
  }

  const BATCH = 5;
  const rawEmails: NormalizedEmail[] = [];
  for (let i = 0; i < messageIds.length; i += BATCH) {
    const batch = messageIds.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map((id) => getMessage(auth.accessToken, id, accountId, auth.email))
    );
    rawEmails.push(...fetched);
  }

  const DEADLINE_REGEX =
    /\b(deadline|closes tomorrow|closing tomorrow|due by|due tomorrow|submission deadline|expires|last date)\b/i;

  const { rules, vipPeople, sensitivity } = classificationData;
  const adminClient = getAdminClient();

  const classified = rawEmails.map((email) => {
    const result = classifyEmail(
      {
        senderName: email.senderName,
        senderEmail: email.senderEmail,
        subject: email.subject,
        snippet: email.snippet,
        body: email.body,
        labelIds: email.labelIds,
      },
      rules,
      vipPeople,
      sensitivity
    );

    const hasDeadline =
      DEADLINE_REGEX.test(`${email.subject} ${email.snippet} ${email.body || ''}`) ||
      result.reasons.some((r) => r.toLowerCase().includes('deadline'));

    return {
      id: email.gmailMessageId,
      accountId,
      accountEmail: email.accountEmail,
      connectedAccountId: email.connectedAccountId,
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      senderName: email.senderName,
      senderEmail: email.senderEmail,
      subject: email.subject,
      snippet: email.snippet,
      body: email.body,
      receivedAt: email.receivedAt,
      labelIds: email.labelIds,
      isRead: email.isRead,
      isImportant:
        email.labelIds.includes('IMPORTANT') ||
        result.priority === 'urgent' ||
        result.priority === 'high',
      isCompleted: false,
      snoozedUntil: null,
      priority: result.priority,
      category: result.category,
      actionRequired: result.actionRequired,
      reason: result.reason,
      reasons: result.reasons,
      score: result.score,
      deadline: hasDeadline ? 'Deadline detected' : undefined,
    };
  });

  // Persist email metadata in background
  Promise.resolve().then(async () => {
    for (const em of classified) {
      await adminClient.from('email_metadata').upsert(
        {
          user_id: userId,
          connected_account_id: accountId,
          gmail_message_id: em.gmailMessageId,
          gmail_thread_id: em.gmailThreadId,
          sender_name: em.senderName,
          sender_email: em.senderEmail,
          subject: em.subject,
          snippet: em.snippet,
          received_at: em.receivedAt,
          label_ids: em.labelIds,
          is_read: em.isRead,
          is_important: em.isImportant,
          priority: em.priority,
          score: em.score,
          category: em.category,
          reasons: em.reasons,
          action_required: em.actionRequired,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,gmail_message_id' }
      );
    }
  }).catch((e) => console.warn('[gmail-messages] Metadata persistence notice:', e));

  classified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { emails: classified, accountId, accountEmail: auth.email };
}

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId') || 'all';
    const maxResults = Math.min(Number(url.searchParams.get('max')) || 25, 50);

    const adminClient = getAdminClient();
    const classificationData = await getUserClassificationData(user.id);

    // Specific single account
    if (accountId && accountId !== 'all') {
      const result = await fetchAccountEmails(accountId, user.id, maxResults, classificationData);
      if (!result) {
        return errorResponse('Connected account not found or credentials expired', 404);
      }
      return jsonResponse(result);
    }

    // All connected accounts for this user
    const { data: accounts } = await adminClient
      .from('connected_google_accounts')
      .select('id, email')
      .eq('user_id', user.id);

    if (!accounts || accounts.length === 0) {
      return jsonResponse({ emails: [], accounts: [] });
    }

    const perAccountLimit = Math.max(5, Math.floor(maxResults / accounts.length));
    const results = await Promise.all(
      accounts.map((acc) =>
        fetchAccountEmails(acc.id, user.id, perAccountLimit, classificationData)
      )
    );

    const allEmails = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .flatMap((r) => r.emails);

    allEmails.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return jsonResponse({ emails: allEmails, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gmail-messages] error:', msg);
    return errorResponse(msg, 500);
  }
});
