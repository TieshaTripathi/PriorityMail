// PriorityMail backend — Gmail Watch Service
// Manages Gmail users.watch for real-time inbox change detection via Google Cloud Pub/Sub.

import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { decrypt, encrypt } from './encryption.js';
import { buildOAuth2Client, refreshAccessToken } from './googleAuth.js';

export interface WatchResult {
  success: boolean;
  historyId?: string;
  expiration?: string;
  error?: string;
}

export async function setupWatchForAccount(connectedAccountId: string): Promise<WatchResult> {
  const topicName = process.env.PUBSUB_TOPIC_NAME;
  if (!topicName) {
    console.log('[watch] PUBSUB_TOPIC_NAME not set in environment. Skipping users.watch registration.');
    return {
      success: false,
      error: 'PUBSUB_TOPIC_NAME is not configured in environment variables.',
    };
  }

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
     WHERE cga.id = ?`,
    [connectedAccountId],
  );

  if (!account) {
    return { success: false, error: 'Connected account not found or credentials missing.' };
  }

  try {
    let accessToken = decrypt(account.access_token_enc);
    const refreshToken = decrypt(account.refresh_token_enc);
    let expiresAt = account.expires_at;

    // Refresh token if near expiration
    if (new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        expiresAt = refreshed.expiresAt;
        await db.execute(
          'UPDATE gmail_credentials SET access_token_enc = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE connected_account_id = ?',
          [encrypt(accessToken), expiresAt, connectedAccountId],
        );
      } catch (err) {
        console.error('[watch] Token refresh failed before watch setup:', err);
        return { success: false, error: 'Failed to refresh token.' };
      }
    }

    const auth = buildOAuth2Client(accessToken, refreshToken, expiresAt);
    const gmail = google.gmail({ version: 'v1', auth });

    console.log(`[watch] Registering Gmail watch for ${account.email} on topic: ${topicName}`);
    const watchRes = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    });

    const historyId = watchRes.data.historyId ?? '';
    const expiration = watchRes.data.expiration
      ? new Date(Number(watchRes.data.expiration)).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Persist watch state
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM gmail_watch_state WHERE connected_account_id = ?',
      [connectedAccountId],
    );

    if (existing) {
      await db.execute(
        'UPDATE gmail_watch_state SET history_id = ?, expiration = ?, status = ?, last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [historyId, expiration, 'active', existing.id],
      );
    } else {
      await db.execute(
        'INSERT INTO gmail_watch_state (id, connected_account_id, history_id, expiration, status, last_synced_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [uuidv4(), connectedAccountId, historyId, expiration, 'active'],
      );
    }

    console.log(`[watch] Gmail watch active for ${account.email}, expires: ${expiration}, historyId: ${historyId}`);
    return { success: true, historyId, expiration };
  } catch (err) {
    console.error(`[watch] users.watch error for ${account.email}:`, err);
    return { success: false, error: String(err) };
  }
}

/**
 * Daily renewal job: re-registers watches for all connected accounts.
 */
export async function renewAllWatches(): Promise<{ renewed: number; failed: number }> {
  const db = getDb();
  const accounts = await db.query<{ id: string; email: string }>(
    'SELECT id, email FROM connected_google_accounts',
  );

  let renewed = 0;
  let failed = 0;

  for (const acc of accounts) {
    const result = await setupWatchForAccount(acc.id);
    if (result.success) {
      renewed++;
    } else {
      failed++;
    }
  }

  console.log(`[watch] Renewal run complete: ${renewed} renewed, ${failed} failed.`);
  return { renewed, failed };
}
