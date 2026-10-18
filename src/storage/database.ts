import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '@/config';
import { logger } from '@/server/logger';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
  // Migration 1: Initial schema
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT,
    profile_image_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );`,

  `CREATE TABLE IF NOT EXISTS oauth_tokens (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scope TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );`,

  `CREATE TABLE IF NOT EXISTS tweets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    conversation_id TEXT,
    in_reply_to_user_id TEXT,
    referenced_tweets TEXT, -- JSON array
    attachments TEXT, -- JSON
    edit_history_tweet_ids TEXT, -- JSON array
    lang TEXT,
    possibly_sensitive INTEGER DEFAULT 0,
    reply_settings TEXT,
    source TEXT,
    withheld TEXT, -- JSON
    public_metrics TEXT NOT NULL, -- JSON: {retweet_count, reply_count, like_count, quote_count, bookmark_count, impression_count}
    organic_metrics TEXT, -- JSON
    promoted_metrics TEXT, -- JSON
    non_public_metrics TEXT, -- JSON
    fetched_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_tweets_user_id ON tweets(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_tweets_conversation_id ON tweets(conversation_id);`,

  `CREATE TABLE IF NOT EXISTS followers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    follower_id TEXT NOT NULL,
    follower_username TEXT NOT NULL,
    follower_name TEXT,
    follower_description TEXT,
    follower_profile_image_url TEXT,
    follower_verified INTEGER DEFAULT 0,
    follower_created_at INTEGER,
    follower_public_metrics TEXT, -- JSON: {followers_count, following_count, tweet_count, listed_count}
    follower_location TEXT,
    follower_url TEXT,
    follower_protected INTEGER DEFAULT 0,
    followed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(user_id, follower_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_followers_user_id ON followers(user_id);`,

  `CREATE TABLE IF NOT EXISTS following (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL,
    following_username TEXT NOT NULL,
    following_name TEXT,
    following_description TEXT,
    following_profile_image_url TEXT,
    following_verified INTEGER DEFAULT 0,
    following_created_at INTEGER,
    following_public_metrics TEXT, -- JSON
    following_location TEXT,
    following_url TEXT,
    following_protected INTEGER DEFAULT 0,
    followed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(user_id, following_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_following_user_id ON following(user_id);`,

  `CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    tweets_count INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_engagements INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_retweets INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,
    total_quotes INTEGER DEFAULT 0,
    total_bookmarks INTEGER DEFAULT 0,
    avg_engagement_rate REAL DEFAULT 0,
    best_posting_hours TEXT, -- JSON: {hour: engagement_rate}
    top_tweets TEXT, -- JSON array of tweet IDs
    audience_countries TEXT, -- JSON: {country: count}
    audience_languages TEXT, -- JSON: {lang: count}
    followers_gained INTEGER DEFAULT 0,
    followers_lost INTEGER DEFAULT 0,
    net_followers_change INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_id ON analytics_snapshots(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period ON analytics_snapshots(period_start, period_end);`,

  `CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    rate_limit_remaining INTEGER,
    rate_limit_reset INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT DEFAULT 'UTC',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    auto_refresh_enabled INTEGER DEFAULT 1,
    auto_refresh_interval_minutes INTEGER DEFAULT 60,
    data_retention_days INTEGER DEFAULT 365,
    export_format TEXT DEFAULT 'json',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );`,
];

export class DatabaseManager {
  private db: Database.Database | null = null;
  private static instance: DatabaseManager;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  getDb(): Database.Database {
    if (!this.db) {
      this.db = this.initialize();
    }
    return this.db;
  }

  private initialize(): Database.Database {
    const config = getConfig();
    const dbPath = resolve(config.DATABASE_PATH);

    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });

    logger.info({ dbPath }, 'Initializing database');

    const db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // Run migrations
    this.runMigrations(db);

    return db;
  }

  private runMigrations(db: Database.Database): void {
    const migrationTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `;
    db.exec(migrationTable);

    const applied = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
    const appliedVersions = new Set(applied.map(m => m.version));

    MIGRATIONS.forEach((migration, index) => {
      const version = index + 1;
      if (!appliedVersions.has(version)) {
        logger.info({ version }, 'Applying migration');
        db.exec(migration);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
      }
    });

    logger.info({ totalMigrations: MIGRATIONS.length, applied: appliedVersions.size }, 'Migrations complete');
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  // Health check
  healthCheck(): boolean {
    try {
      const db = this.getDb();
      db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}

export const db: BetterSqlite3Database = DatabaseManager.getInstance().getDb();