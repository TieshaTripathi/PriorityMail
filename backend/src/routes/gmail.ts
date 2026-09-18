// PriorityMail backend — Gmail Fetch Routes
// GET /api/gmail/:accountId/messages  → fetch, normalize, classify emails
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
// auto-refreshing the access token if it has expired.
// ----------------------------------------------------------------
async function getAuthClient(accountId: string, userId: string) {
  const db = getDb();

  const account = db
    .prepare(
      `SELECT cga.id, cga.email, gc.access_token_enc, gc.refresh_token_enc, gc.expires_at
       FROM connected_google_accounts cga
       JOIN gmail_credentials gc ON gc.connected_account_id = cga.id
       WHERE cga.id = ? AND cga.user_id = ?`,
    )
    .get(accountId, userId) as {
      id: string;
      email: string;
      access_token_enc: string;
      refresh_token_enc: string;
      expires_at: string;
    } | undefined;

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
      // Update stored token
      db.prepare(
        `UPDATE gmail_credentials
         SET access_token_enc = ?, expires_at = ?, updated_at = datetime('now')
         WHERE connected_account_id = ?`,
      ).run(encrypt(accessToken), expiresAt, accountId);
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
function getUserClassificationData(userId: string) {
  const db = getDb();
  const rules = db
    .prepare('SELECT * FROM priority_rules WHERE user_id = ? AND enabled = 1')
    .all(userId) as {
      id: string;
      type: string;
      value: string;
      weight: number;
      enabled: number;
      description: string | null;
    }[];

  const vip = db
    .prepare('SELECT * FROM vip_senders WHERE user_id = ?')
    .all(userId) as {
      id: string;
      name: string;
      email: string;
      category: string;
    }[];

  return {
    rules: rules.map((r) => ({
      id: r.id,
      type: r.type as 'label' | 'sender' | 'domain' | 'keyword' | 'subject_keyword' | 'vip',
      value: r.value,
      weight: r.weight,
      enabled: Boolean(r.enabled),
    })),
    vipPeople: vip,
  };
}

// ----------------------------------------------------------------
// Core helper: fetch, normalize, and classify emails for an account
// ----------------------------------------------------------------
async function fetchAccountEmails(
  accountId: string,
  userId: string,
  maxResults = 20,
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

  const { rules, vipPeople } = getUserClassificationData(userId);
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
      'Balanced',
    );

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
      isImportant: email.labelIds.includes('IMPORTANT') || result.priority === 'urgent' || result.priority === 'high',
      isCompleted: false,
      snoozedUntil: null,
      priority: result.priority,
      category: result.category,
      actionRequired: result.actionRequired,
      reason: result.reason,
      reasons: result.reasons,
      score: result.score,
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
  const maxResults = Math.min(Number(req.query.max) || 20, 50);
  const db = getDb();

  const accounts = db
    .prepare('SELECT id, email FROM connected_google_accounts WHERE user_id = ?')
    .all(userId) as { id: string; email: string }[];

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
    res.json({ success: true, count: data.emails.length, syncedAt: new Date().toISOString() });
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
  const accounts = db
    .prepare('SELECT id, email FROM connected_google_accounts WHERE user_id = ?')
    .all(userId) as { id: string; email: string }[];

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
  const maxResults = Math.min(Number(req.query.max) || 20, 50);

  try {
    const data = await fetchAccountEmails(accountId, userId, maxResults);
    if (!data) {
      return res.status(404).json({
        error: 'Account not found or credentials expired. Please reconnect.',
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
