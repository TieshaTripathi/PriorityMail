/// <reference path="../types/session.d.ts" />
import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  buildLoginAuthUrl,
  exchangeLoginCode,
  verifyIdToken,
} from '../services/googleAuth.js';
import { getDb } from '../db/database.js';

export const authRouter = Router();

function getFrontendUrl(): string {
  const url =
    process.env.FRONTEND_URL ??
    process.env.WEB_APP_URL ??
    'http://localhost:5173';
  return url.replace(/\/+$/, '');
}

/**
 * Direct browser navigation endpoint: GET /api/auth/google
 * Instantly redirects browser to Google OAuth consent screen.
 */
authRouter.get('/google', (_req: Request, res: Response) => {
  const state = randomBytes(16).toString('hex');
  try {
    const url = buildLoginAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error('[auth] buildLoginAuthUrl error:', err);
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/?auth_error=oauth_not_configured`);
  }
});

authRouter.get('/google/login', (_req: Request, res: Response) => {
  const state = randomBytes(16).toString('hex');
  try {
    const url = buildLoginAuthUrl(state);
    res.json({ url, state });
  } catch (err) {
    console.error('[auth] buildLoginAuthUrl error:', err);
    res.status(500).json({ error: 'OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_AUTH_REDIRECT_URI.' });
  }
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error: oauthError } = req.query;
  const frontendUrl = getFrontendUrl();

  if (oauthError || !code || typeof code !== 'string') {
    console.error('[auth] OAuth error from Google:', oauthError);
    return res.redirect(`${frontendUrl}/?auth_error=access_denied`);
  }

  try {
    const tokens = await exchangeLoginCode(code);
    if (!tokens.idToken) throw new Error('No ID token returned from Google.');

    const profile = await verifyIdToken(tokens.idToken);
    const db = getDb();

    let user = await db.queryOne<{
      id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
    }>('SELECT * FROM users WHERE google_user_id = ?', [profile.sub]);

    if (!user) {
      const newId = uuidv4();
      await db.execute(
        'INSERT INTO users (id, google_user_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)',
        [newId, profile.sub, profile.email, profile.name, profile.picture ?? null],
      );
      user = await db.queryOne<{
        id: string;
        email: string;
        display_name: string;
        avatar_url: string | null;
      }>('SELECT * FROM users WHERE id = ?', [newId]);
    } else {
      await db.execute(
        'UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE google_user_id = ?',
        [profile.email, profile.name, profile.picture ?? null, profile.sub],
      );
    }

    if (!user) throw new Error('Failed to create or find user.');

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    console.log(`[auth] Login successful: ${profile.email}`);
    res.redirect(`${frontendUrl}/?auth=success`);
  } catch (err) {
    console.error('[auth] Callback error:', err);
    res.redirect(`${frontendUrl}/?auth_error=server_error`);
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[auth] Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    res.clearCookie('pm.sid');
    res.json({ ok: true });
  });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const db = getDb();
  const user = await db.queryOne<{
    id: string;
    google_user_id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
  }>(
    'SELECT id, google_user_id, email, display_name, avatar_url, created_at FROM users WHERE id = ?',
    [req.session.userId],
  );

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'User not found.' });
  }

  res.json({
    id: user.id,
    googleUserId: user.google_user_id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url ?? undefined,
    createdAt: user.created_at,
  });
});
