/// <reference path="../types/session.d.ts" />
import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  buildGmailAuthUrl,
  exchangeGmailCode,
  verifyIdToken,
  buildOAuth2Client,
} from '../services/googleAuth.js';
import { getProfile } from '../services/gmailService.js';
import { encrypt, decrypt } from '../services/encryption.js';
import { getDb } from '../db/database.js';
import { setupWatchForAccount } from '../services/watchService.js';

export const accountsRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  next();
}

async function listAccounts(req: Request, res: Response) {
  const userId = req.session.userId as string;
  const db = getDb();

  try {
    const accounts = await db.query<{
      id: string;
      user_id: string;
      google_user_id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
      is_primary: number;
      created_at: string;
    }>(
      `SELECT id, user_id, google_user_id, email, display_name, avatar_url, is_primary, created_at
       FROM connected_google_accounts
       WHERE user_id = ?
       ORDER BY is_primary DESC, created_at ASC`,
      [userId],
    );

    res.json(
      accounts.map((a) => ({
        id: a.id,
        userId: a.user_id,
        googleUserId: a.google_user_id,
        email: a.email,
        displayName: a.display_name,
        avatarUrl: a.avatar_url ?? undefined,
        isPrimary: Boolean(a.is_primary),
        createdAt: a.created_at,
      })),
    );
  } catch (err) {
    console.error('[accounts] listAccounts error:', err);
    res.status(500).json({ error: 'Failed to list connected accounts.' });
  }
}

accountsRouter.get('/', requireAuth, listAccounts);
accountsRouter.get('/connected', requireAuth, listAccounts);

function getFrontendUrl(): string {
  const url =
    process.env.FRONTEND_URL ??
    process.env.WEB_APP_URL ??
    'http://localhost:5173';
  return url.replace(/\/+$/, '');
}

/**
 * Direct browser navigation endpoint: GET /api/accounts/google/connect
 * Redirects browser to Google OAuth consent screen for Gmail permissions.
 */
accountsRouter.get('/google/connect', requireAuth, (req: Request, res: Response) => {
  const state = randomBytes(16).toString('hex');
  req.session.gmailOAuthState = state;
  req.session.save((err) => {
    const frontendUrl = getFrontendUrl();
    if (err) {
      console.error('[accounts] Session save error:', err);
      return res.redirect(`${frontendUrl}/#settings?connect_error=server_error`);
    }
    try {
      const url = buildGmailAuthUrl(state);
      res.redirect(url);
    } catch (e) {
      console.error('[accounts] buildGmailAuthUrl error:', e);
      res.redirect(`${frontendUrl}/#settings?connect_error=server_error`);
    }
  });
});

accountsRouter.post('/connect/start', requireAuth, (req: Request, res: Response) => {
  const state = randomBytes(16).toString('hex');
  req.session.gmailOAuthState = state;
  req.session.save((err) => {
    if (err) {
      console.error('[accounts] Session save error:', err);
      return res.status(500).json({ error: 'Could not save session state.' });
    }
    try {
      const url = buildGmailAuthUrl(state);
      res.json({ url });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
});

async function handleGmailCallback(req: Request, res: Response) {
  const { code, state: returnedState, error: oauthError } = req.query;
  const frontendUrl = getFrontendUrl();

  if (oauthError || !code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}/#settings?connect_error=access_denied`);
  }

  if (!req.session.gmailOAuthState || req.session.gmailOAuthState !== returnedState) {
    return res.redirect(`${frontendUrl}/#settings?connect_error=state_mismatch`);
  }

  if (!req.session.userId) {
    return res.redirect(`${frontendUrl}/?auth_error=session_expired`);
  }

  delete req.session.gmailOAuthState;

  try {
    const tokens = await exchangeGmailCode(code);
    if (!tokens.idToken) throw new Error('No ID token in Gmail callback.');

    const profile = await verifyIdToken(tokens.idToken);

    const oauthClient = buildOAuth2Client(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );
    const gmailProfile = await getProfile(oauthClient);
    const gmailEmail = gmailProfile.emailAddress || profile.email;

    const db = getDb();
    const userId = req.session.userId;

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM connected_google_accounts WHERE user_id = ? AND google_user_id = ?',
      [userId, profile.sub],
    );

    let accountId: string;
    const hasAnyAccount = await db.queryOne<{ id: string }>(
      'SELECT id FROM connected_google_accounts WHERE user_id = ?',
      [userId],
    );
    const isPrimary = !hasAnyAccount;

    if (existing) {
      accountId = existing.id;
      await db.execute(
        `UPDATE connected_google_accounts
         SET email = ?, display_name = ?, avatar_url = ?
         WHERE id = ?`,
        [gmailEmail, profile.name, profile.picture ?? null, accountId],
      );
    } else {
      accountId = uuidv4();
      await db.execute(
        `INSERT INTO connected_google_accounts
         (id, user_id, google_user_id, email, display_name, avatar_url, is_primary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          userId,
          profile.sub,
          gmailEmail,
          profile.name,
          profile.picture ?? null,
          isPrimary ? 1 : 0,
        ],
      );
    }

    const encAccess = encrypt(tokens.accessToken);
    const encRefresh = encrypt(tokens.refreshToken);

    const credExisting = await db.queryOne<{ id: string }>(
      'SELECT id FROM gmail_credentials WHERE connected_account_id = ?',
      [accountId],
    );

    if (credExisting) {
      await db.execute(
        `UPDATE gmail_credentials
         SET access_token_enc = ?, refresh_token_enc = ?, expires_at = ?, scope = ?, updated_at = CURRENT_TIMESTAMP
         WHERE connected_account_id = ?`,
        [encAccess, encRefresh, tokens.expiresAt, tokens.scope, accountId],
      );
    } else {
      await db.execute(
        `INSERT INTO gmail_credentials
         (id, connected_account_id, access_token_enc, refresh_token_enc, expires_at, scope)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), accountId, encAccess, encRefresh, tokens.expiresAt, tokens.scope],
      );
    }

    console.log(`[accounts] Connected Gmail account: ${gmailEmail} for user ${userId}`);

    // Trigger Gmail users.watch registration in background
    setupWatchForAccount(accountId).catch((wErr) => {
      console.warn('[accounts] Watch setup attempt completed with result:', wErr);
    });

    await new Promise<void>((resolve) => {
      req.session.save(() => resolve());
    });
    res.redirect(`${frontendUrl}/#settings?connect_success=1`);
  } catch (err) {
    console.error('[accounts] connect callback error:', err);
    res.redirect(`${frontendUrl}/#settings?connect_error=server_error`);
  }
}

accountsRouter.get('/google/callback', handleGmailCallback);
accountsRouter.get('/connect/callback', handleGmailCallback);

accountsRouter.delete('/:accountId', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  const accountId = String(req.params['accountId']);
  const db = getDb();

  const account = await db.queryOne<{ id: string }>(
    'SELECT id FROM connected_google_accounts WHERE id = ? AND user_id = ?',
    [accountId, userId],
  );

  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  try {
    const cred = await db.queryOne<{ access_token_enc: string }>(
      'SELECT access_token_enc FROM gmail_credentials WHERE connected_account_id = ?',
      [accountId],
    );

    if (cred) {
      const accessToken = decrypt(cred.access_token_enc);
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client();
      await client.revokeToken(accessToken);
    }
  } catch (e) {
    console.warn('[accounts] Token revoke failed (non-fatal):', e);
  }

  await db.execute('DELETE FROM connected_google_accounts WHERE id = ?', [accountId]);

  console.log(`[accounts] Disconnected account ${accountId} for user ${userId}`);
  res.json({ ok: true });
});
