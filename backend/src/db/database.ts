// PriorityMail backend — SQLite database initializer
// Uses Node.js 22's built-in node:sqlite module.
// No native compilation required — works on all platforms.

// node:sqlite is available in Node.js >= 22.5.0 (flag: --experimental-sqlite)
// In Node.js >= 22.12.0 it's unflagged.
// We use --experimental-sqlite via the tsx invocation flag in start scripts.

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './migrations.js';

const DEFAULT_DB_PATH = './data/prioritymail.db';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
  const dir = path.dirname(dbPath);

  // Ensure the directory exists before opening
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.exec('PRAGMA journal_mode = WAL');
  // Enforce FK constraints
  db.exec('PRAGMA foreign_keys = ON');

  runMigrations(db);

  console.log(`[db] SQLite opened at ${path.resolve(dbPath)}`);
  return db;
}
