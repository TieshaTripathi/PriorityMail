// PriorityMail backend — Gmail Fetch Routes
// GET /api/gmail/messages             → fetch, normalize, classify emails across all accounts
// GET /api/gmail/:accountId/messages  → fetch, normalize, classify emails for a specific account
// POST /api/gmail/sync                → trigger manual sync across all accounts
// POST /api/gmail/:accountId/sync     → trigger manual sync for an account
// GET /api/gmail/:accountId/labels    → list Gmail labels

import { Router, type Request, type Response } from 'express';
import {
  buildOAuth2Client,
  refreshAccessToken,
} from '../services/googleAuth.js';
import {
  listRecentMessages,
  getMessage,
  listLabels,
} from '../services/gmailService.js';
import { encrypt, decrypt } from '../services/encryption.js';
import { getDb } from '../db/database.js';
import { classifyEmail } from '../services/priorityEngine.js';

export const gmailRouter = Router();

// Auth guard
function requireAuth(req: Request, res: Response, next: () => void) {
  const session = req.session as { userId?: string };
  if (!session.userId) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  next();
}

// ----------------------------------------------------------------
// Helper: get a valid OAuth2Client for a connected account,
// auto-refreshing the access token if expired.
// ----------------------------------------------------------------
async function getAuthClient(accountId: string, userId: string) {
  const db = getDb();

  const account = await db.queryOne<{
    id: string;
    email: string;
    access_token_enc: string;
    refresh_token_enc: string;
    expires_at: string;
  }>(
    `SELECT cga.id, cga.email, gc.access_token_enc, gc.refresh_token_enc, gc.expires_at
     FROM connected_google_accounts cga
     JOIN gmail_credentials gc ON gc.connected_account_id = cga.id
     WHERE cga.id = ? AND cga.user_id = ?`,
    [accountId, userId],
  );

  if (!account) return null;

  let accessToken = decrypt(account.access_token_enc);
  const refreshToken = decrypt(account.refresh_token_enc);
  let expiresAt = account.expires_at;

  // Refresh if within 5 minutes of expiry
  if (new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;
      await db.execute(
        `UPDATE gmail_credentials
         SET access_token_enc = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE connected_account_id = ?`,
        [encrypt(accessToken), expiresAt, accountId],
      );
    } catch (e) {
      console.error('[gmail] Token refresh failed:', e);
      return null;
    }
  }

  return {
    client: buildOAuth2Client(accessToken, refreshToken, expiresAt),
    email: account.email,
  };
}

// ----------------------------------------------------------------
// Helper: load user's rules and VIP people for classification
// ----------------------------------------------------------------
async function getUserClassificationData(userId: string) {
  const db = getDb();
  const rules = await db.query<{
    id: string;
    type: string;
    value: string;
    weight: number;
    enabled: number;
    description: string | null;
  }>('SELECT * FROM priority_rules WHERE user_id = ? AND enabled = 1', [userId]);

  const vip = await db.query<{
    id: string;
    name: string;
    email: string;
    category: string;
  }>('SELECT * FROM vip_senders WHERE user_id = ?', [userId]);

  const settings = await db.queryOne<{
    sensitivity: string;
  }>('SELECT sensitivity FROM user_settings WHERE user_id = ?', [userId]);

  return {
    rules: rules.map((r) => ({
      id: r.id,
      type: r.type as 'label' | 'sender' | 'domain' | 'keyword' | 'subject_keyword' | 'vip',
      value: r.value,
      weight: r.weight,
      enabled: Boolean(r.enabled),
    })),
    vipPeople: vip,
    sensitivity: (settings?.sensitivity as any) || 'Balanced',
  };
}

// ----------------------------------------------------------------
// Core helper: fetch, normalize, and classify emails for an account
// ----------------------------------------------------------------
async function fetchAccountEmails(
  accountId: string,
  userId: string,
  maxResults = 25,
) {
  const authResult = await getAuthClient(accountId, userId);
  if (!authResult) {
    return null;
  }

  const { client, email: accountEmail } = authResult;
  const { messageIds } = await listRecentMessages(client, maxResults);

  if (messageIds.length === 0) {
    return { emails: [], accountId, accountEmail };
  }

  const BATCH = 5;
  const rawEmails = [];
  for (let i = 0; i < messageIds.length; i += BATCH) {
    const batch = messageIds.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map((id) => getMessage(client, id, accountId, accountEmail)),
    );
    rawEmails.push(...fetched);
  }

  const { rules, vipPeople, sensitivity } = await getUserClassificationData(userId);
  const DEADLINE_REGEX = /\b(deadline|closes tomorrow|closing tomorrow|due by|due tomorrow|submission deadline|expires|last date)\b/i;

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
      sensitivity,
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

  classified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { emails: classified, accountId, accountEmail };
}

// ----------------------------------------------------------------
// GET /api/gmail/messages & /api/emails/priority — Fetch across ALL connected accounts
// ----------------------------------------------------------------
async function handleAllMessages(req: Request, res: Response) {
  const { userId } = req.session as { userId: string };
  const maxResults = Math.min(Number(req.query.max) || 25, 50);
  const db = getDb();

  const accounts = await db.query<{ id: string; email: string }>(
    'SELECT id, email FROM connected_google_accounts WHERE user_id = ?',
    [userId],
  );

  if (accounts.length === 0) {
    return res.json({ emails: [], accounts: [] });
  }

  try {
    const perAccountLimit = Math.max(5, Math.floor(maxResults / accounts.length));
    const results = await Promise.all(
      accounts.map((acc) => fetchAccountEmails(acc.id, userId, perAccountLimit)),
    );

    const allEmails = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .flatMap((r) => r.emails);

    allEmails.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    res.json({ emails: allEmails, accounts });
  } catch (err) {
    console.error('[gmail] all messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages across accounts.' });
  }
}

gmailRouter.get('/messages', requireAuth, handleAllMessages);
gmailRouter.get('/priority', requireAuth, handleAllMessages);

// ----------------------------------------------------------------
// POST /api/gmail/:accountId/sync — Manual sync trigger for single account
// ----------------------------------------------------------------
gmailRouter.post('/:accountId/sync', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.session as { userId: string };
  const accountId = String(req.params.accountId);

  try {
    const data = await fetchAccountEmails(accountId, userId, 25);
    if (!data) {
      return res.status(404).json({ error: 'Account not found or expired.' });
    }
    res.json({
      success: true,
      count: data.emails.length,
      syncedAt: new Date().toISOString(),
      accountEmail: data.accountEmail,
    });
  } catch (err) {
    console.error('[gmail] sync error:', err);
    res.status(500).json({ error: 'Sync failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/gmail/sync — Manual sync trigger across ALL connected accounts
// ----------------------------------------------------------------
gmailRouter.post('/sync', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.session as { userId: string };
  const db = getDb();
  const accounts = await db.query<{ id: string; email: string }>(
    'SELECT id, email FROM connected_google_accounts WHERE user_id = ?',
    [userId],
  );

  if (accounts.length === 0) {
    return res.json({ success: true, count: 0, syncedAt: new Date().toISOString() });
  }

  try {
    const results = await Promise.all(
      accounts.map((acc) => fetchAccountEmails(acc.id, userId, 25)),
    );
    const totalCount = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .reduce((sum, r) => sum + r.emails.length, 0);

    res.json({ success: true, count: totalCount, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[gmail] sync all error:', err);
    res.status(500).json({ error: 'Sync failed across connected accounts.' });
  }
});

// ----------------------------------------------------------------
// GET /api/gmail/:accountId/messages — Specific account messages
// ----------------------------------------------------------------
gmailRouter.get('/:accountId/messages', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.session as { userId: string };
  const accountId = String(req.params.accountId);
  const maxResults = Math.min(Number(req.query.max) || 25, 50);

  try {
    const data = await fetchAccountEmails(accountId, userId, maxResults);
    if (!data) {
      return res.status(404).json({
        error: 'Account not found or credentials expired. Please reconnect in Settings.',
      });
    }
    res.json(data);
  } catch (err) {
    console.error('[gmail] messages error:', err);
    res.status(500).json({ error: 'Failed to fetch Gmail messages.' });
  }
});

// ----------------------------------------------------------------
// GET /api/gmail/:accountId/labels
// ----------------------------------------------------------------
gmailRouter.get('/:accountId/labels', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.session as { userId: string };
  const accountId = String(req.params.accountId);

  const authResult = await getAuthClient(accountId, userId);
  if (!authResult) {
    return res.status(404).json({ error: 'Account not found or credentials expired.' });
  }

  try {
    const labels = await listLabels(authResult.client);
    res.json({ labels });
  } catch (err) {
    console.error('[gmail] labels error:', err);
    res.status(500).json({ error: 'Failed to fetch Gmail labels.' });
  }
});
