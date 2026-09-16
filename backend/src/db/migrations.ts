// PriorityMail backend — Database Migrations
// Migrations are applied once at startup via CREATE TABLE IF NOT EXISTS.
// For future changes: add new migration steps with ALTER TABLE or
// CREATE TABLE IF NOT EXISTS for new tables.

import type { DatabaseSync } from 'node:sqlite';

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    -- ----------------------------------------------------------------
    -- users: PriorityMail identity (from Google login)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,          -- UUID v4
      google_user_id  TEXT NOT NULL UNIQUE,      -- Google sub claim
      email           TEXT NOT NULL,
      display_name    TEXT NOT NULL,
      avatar_url      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ----------------------------------------------------------------
    -- connected_google_accounts: Gmail accounts linked by the user.
    -- A user can connect multiple Gmail accounts (different from login).
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS connected_google_accounts (
      id              TEXT PRIMARY KEY,          -- UUID v4
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      google_user_id  TEXT NOT NULL,             -- Google sub claim for this Gmail account
      email           TEXT NOT NULL,
      display_name    TEXT NOT NULL,
      avatar_url      TEXT,
      is_primary      INTEGER NOT NULL DEFAULT 0, -- 1 = primary account
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, google_user_id)
    );

    -- ----------------------------------------------------------------
    -- gmail_credentials: OAuth tokens for each connected account.
    -- access_token and refresh_token are stored AES-256-GCM encrypted.
    -- They must NEVER be sent to any client.
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS gmail_credentials (
      id                    TEXT PRIMARY KEY,    -- UUID v4
      connected_account_id  TEXT NOT NULL UNIQUE REFERENCES connected_google_accounts(id) ON DELETE CASCADE,
      access_token_enc      TEXT NOT NULL,       -- AES-256-GCM encrypted
      refresh_token_enc     TEXT NOT NULL,       -- AES-256-GCM encrypted
      expires_at            TEXT NOT NULL,       -- ISO-8601
      scope                 TEXT NOT NULL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ----------------------------------------------------------------
    -- priority_rules: Per-user priority rules (sync from web/mobile)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS priority_rules (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK(type IN ('label','sender','domain','keyword','subject_keyword','vip')),
      value       TEXT NOT NULL,
      weight      INTEGER NOT NULL DEFAULT 4,
      enabled     INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ----------------------------------------------------------------
    -- vip_senders: Per-user VIP contacts
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS vip_senders (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'Personal',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, email)
    );

    -- ----------------------------------------------------------------
    -- email_metadata: Tracks read/done/snoozed state per email, per user.
    -- The actual email content lives in Gmail — we just store state here.
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS email_metadata (
      id                    TEXT PRIMARY KEY,
      user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connected_account_id  TEXT NOT NULL REFERENCES connected_google_accounts(id) ON DELETE CASCADE,
      gmail_message_id      TEXT NOT NULL,
      gmail_thread_id       TEXT NOT NULL,
      is_read               INTEGER NOT NULL DEFAULT 0,
      is_completed          INTEGER NOT NULL DEFAULT 0,
      snoozed_until         TEXT,                -- ISO-8601 or NULL
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, gmail_message_id)
    );

    -- ----------------------------------------------------------------
    -- sessions: express-session store (managed by connect-sqlite3)
    -- The table is created automatically by connect-sqlite3 on first use.
    -- Listed here for documentation purposes only.
    -- ----------------------------------------------------------------
  `);

  console.log('[db] Migrations applied.');
}
