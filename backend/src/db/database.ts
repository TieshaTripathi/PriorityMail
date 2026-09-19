// PriorityMail backend — Unified Database Layer
// Supports PostgreSQL in production (via pg.Pool) and SQLite in local development (via node:sqlite).
// Safe, parameterized queries with automatic SQL dialect mapping (? -> $1, $2, ... for PostgreSQL).

import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './migrations.js';

const { Pool } = pg;

export interface Database {
  isPostgres: boolean;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<void>;
  execScript(script: string): Promise<void>;
  close(): Promise<void>;
}

let dbInstance: Database | null = null;
let pgPoolInstance: pg.Pool | null = null;

export function getPgPool(): pg.Pool | null {
  return pgPoolInstance;
}

class PostgresDatabase implements Database {
  readonly isPostgres = true;

  constructor(private pool: pg.Pool) {}

  private prepareSql(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pgSql = this.prepareSql(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const pgSql = this.prepareSql(sql);
    await this.pool.query(pgSql, params);
  }

  async execScript(script: string): Promise<void> {
    await this.pool.query(script);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class SqliteDatabase implements Database {
  readonly isPostgres = false;

  constructor(private sqlite: DatabaseSync) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.sqlite.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.sqlite.prepare(sql);
    const row = stmt.get(...params);
    return (row ?? null) as T | null;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const stmt = this.sqlite.prepare(sql);
    stmt.run(...params);
  }

  async execScript(script: string): Promise<void> {
    this.sqlite.exec(script);
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}

export async function initDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    console.log('[db] Initializing PostgreSQL connection from DATABASE_URL...');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pgPoolInstance = pool;
    const pgDb = new PostgresDatabase(pool);

    // Verify connectivity
    await pgDb.queryOne('SELECT 1');
    await runMigrations(pgDb);
    dbInstance = pgDb;
    console.log('[db] PostgreSQL initialized and migrations applied.');
    return dbInstance;
  }

  const defaultDbPath = './data/prioritymail.db';
  const dbPath = process.env.DATABASE_PATH ?? defaultDbPath;
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`[db] Initializing local SQLite database at ${path.resolve(dbPath)}...`);
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  const sqliteDb = new SqliteDatabase(sqlite);
  await runMigrations(sqliteDb);
  dbInstance = sqliteDb;
  console.log('[db] SQLite initialized and migrations applied.');
  return dbInstance;
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('[db] Database not initialized. Call initDb() on server startup.');
  }
  return dbInstance;
}
