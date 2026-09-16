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
// GET /api/gmail/:accountId/messages
// ----------------------------------------------------------------
gmailRouter.get('/:accountId/messages', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.session as { userId: string };
  const accountId = String(req.params.accountId);
  const maxResults = Math.min(Number(req.query.max) || 20, 50);

  const authResult = await getAuthClient(accountId, userId);
  if (!authResult) {
    return res.status(404).json({
      error: 'Account not found or credentials expired. Please reconnect.',
    });
  }

  try {
    const { client, email: accountEmail } = authResult;

    // Fetch message IDs
    const { messageIds } = await listRecentMessages(client, maxResults);

    if (messageIds.length === 0) {
      return res.json({ emails: [], accountId, accountEmail });
    }

    // Fetch messages in parallel (batched for safety)
    const BATCH = 5;
    const emails = [];
    for (let i = 0; i < messageIds.length; i += BATCH) {
      const batch = messageIds.slice(i, i + BATCH);
      const fetched = await Promise.all(
        batch.map((id) => getMessage(client, id, accountId, accountEmail)),
      );
      emails.push(...fetched);
    }

    // Classify each email
    const { rules, vipPeople } = getUserClassificationData(userId);
    const classified = emails.map((email) => {
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
        // PriorityEmail fields
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
        isCompleted: false,
        snoozedUntil: null,
        // Priority result
        priority: result.priority,
        category: result.category,
        actionRequired: result.actionRequired,
        reason: result.reason,
        reasons: result.reasons,
        score: result.score,
      };
    });

    // Sort by priority score descending
    classified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    res.json({ emails: classified, accountId, accountEmail });
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
