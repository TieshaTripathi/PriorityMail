// PriorityMail backend — Database Migrations
// Migrations are applied at startup. Supports PostgreSQL and SQLite syntax.

import type { Database } from './database.js';

export async function runMigrations(db: Database): Promise<void> {
  const isPg = db.isPostgres;

  // 1. users
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      google_user_id  TEXT NOT NULL UNIQUE,
      email           TEXT NOT NULL,
      display_name    TEXT NOT NULL,
      avatar_url      TEXT,
      created_at      TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  // 2. connected_google_accounts
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS connected_google_accounts (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      google_user_id  TEXT NOT NULL,
      email           TEXT NOT NULL,
      display_name    TEXT NOT NULL,
      avatar_url      TEXT,
      is_primary      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"},
      UNIQUE(user_id, google_user_id)
    );
  `);

  // 3. gmail_credentials (access & refresh tokens stored AES-256-GCM encrypted)
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS gmail_credentials (
      id                    TEXT PRIMARY KEY,
      connected_account_id  TEXT NOT NULL UNIQUE REFERENCES connected_google_accounts(id) ON DELETE CASCADE,
      access_token_enc      TEXT NOT NULL,
      refresh_token_enc     TEXT NOT NULL,
      expires_at            TEXT NOT NULL,
      scope                 TEXT NOT NULL,
      created_at            TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"},
      updated_at            TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  // 4. priority_rules
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS priority_rules (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      value       TEXT NOT NULL,
      weight      INTEGER NOT NULL DEFAULT 4,
      enabled     INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  // 5. vip_senders
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS vip_senders (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'Personal',
      created_at  TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"},
      UNIQUE(user_id, email)
    );
  `);

  // 6. email_metadata
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS email_metadata (
      id                    TEXT PRIMARY KEY,
      user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connected_account_id  TEXT NOT NULL REFERENCES connected_google_accounts(id) ON DELETE CASCADE,
      gmail_message_id      TEXT NOT NULL,
      gmail_thread_id       TEXT NOT NULL,
      is_read               INTEGER NOT NULL DEFAULT 0,
      is_completed          INTEGER NOT NULL DEFAULT 0,
      snoozed_until         TEXT,
      updated_at            TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"},
      UNIQUE(user_id, gmail_message_id)
    );
  `);

  // 7. push_subscriptions (Web Push / iPhone PWA)
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  // 8. mobile_device_tokens (Expo / Android)
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS mobile_device_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      platform    TEXT NOT NULL DEFAULT 'android',
      device_name TEXT,
      created_at  TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"},
      updated_at  TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  // 9. gmail_watch_state (Pub/Sub watch status per account)
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS gmail_watch_state (
      id                    TEXT PRIMARY KEY,
      connected_account_id  TEXT NOT NULL UNIQUE REFERENCES connected_google_accounts(id) ON DELETE CASCADE,
      history_id            TEXT NOT NULL,
      expiration            TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'active',
      last_synced_at        TEXT,
      updated_at            TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  // 10. notification_history (deduplication to prevent duplicate notifications)
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS notification_history (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gmail_message_id  TEXT NOT NULL,
      created_at        TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"},
      UNIQUE(user_id, gmail_message_id)
    );
  `);

  // 11. user_settings (Notification toggles, Quiet Hours, Sensitivity)
  await db.execScript(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id               TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      vip_alerts            INTEGER NOT NULL DEFAULT 1,
      deadline_alerts       INTEGER NOT NULL DEFAULT 1,
      action_alerts         INTEGER NOT NULL DEFAULT 1,
      sensitivity           TEXT NOT NULL DEFAULT 'Balanced',
      quiet_hours_enabled   INTEGER NOT NULL DEFAULT 0,
      quiet_start           TEXT NOT NULL DEFAULT '22:00',
      quiet_end             TEXT NOT NULL DEFAULT '08:00',
      updated_at            TEXT NOT NULL DEFAULT ${isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))"}
    );
  `);

  console.log(`[db] All database tables and migrations applied successfully (${isPg ? 'PostgreSQL' : 'SQLite'}).`);
}
