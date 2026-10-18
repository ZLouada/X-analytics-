import { db } from '@/storage/database';
import { logger } from '@/server/logger';

// ============================================
// Types
// ============================================

export interface UserRow {
  id: string;
  username: string;
  name: string | null;
  profile_image_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface OAuthTokensRow {
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: number;
  token_type: string;
  scope: string;
  created_at: number;
  updated_at: number;
}

export interface TweetRow {
  id: string;
  user_id: string;
  text: string;
  created_at: number;
  conversation_id: string | null;
  in_reply_to_user_id: string | null;
  referenced_tweets: string | null;
  attachments: string | null;
  edit_history_tweet_ids: string | null;
  lang: string | null;
  possibly_sensitive: number;
  reply_settings: string | null;
  source: string | null;
  withheld: string | null;
  public_metrics: string;
  organic_metrics: string | null;
  promoted_metrics: string | null;
  non_public_metrics: string | null;
  fetched_at: number;
  updated_at: number;
}

export interface FollowerRow {
  id: string;
  user_id: string;
  follower_id: string;
  follower_username: string;
  follower_name: string | null;
  follower_description: string | null;
  follower_profile_image_url: string | null;
  follower_verified: number;
  follower_created_at: number | null;
  follower_public_metrics: string | null;
  follower_location: string | null;
  follower_url: string | null;
  follower_protected: number;
  followed_at: number;
}

export interface AnalyticsSnapshotRow {
  id: string;
  user_id: string;
  period_start: number;
  period_end: number;
  tweets_count: number;
  total_impressions: number;
  total_engagements: number;
  total_likes: number;
  total_retweets: number;
  total_replies: number;
  total_quotes: number;
  total_bookmarks: number;
  avg_engagement_rate: number;
  best_posting_hours: string | null;
  top_tweets: string | null;
  audience_countries: string | null;
  audience_languages: string | null;
  followers_gained: number;
  followers_lost: number;
  net_followers_change: number;
  created_at: number;
}

export interface SettingsRow {
  user_id: string;
  timezone: string;
  date_format: string;
  auto_refresh_enabled: number;
  auto_refresh_interval_minutes: number;
  data_retention_days: number;
  export_format: string;
  created_at: number;
  updated_at: number;
}

// ============================================
// User Repository
// ============================================

export const userRepo = {
  upsert(user: UserRow): void {
    db.prepare(`
      INSERT INTO users (id, username, name, profile_image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        name = excluded.name,
        profile_image_url = excluded.profile_image_url,
        updated_at = excluded.updated_at
    `).run(user.id, user.username, user.name, user.profile_image_url, user.created_at, user.updated_at);
  },

  getById(id: string): UserRow | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  },

  getByUsername(username: string): UserRow | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  },

  delete(id: string): void {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

// ============================================
// OAuth Tokens Repository
// ============================================

export const tokenRepo = {
  upsert(tokens: OAuthTokensRow): void {
    db.prepare(`
      INSERT INTO oauth_tokens (user_id, access_token_encrypted, refresh_token_encrypted, expires_at, token_type, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        access_token_encrypted = excluded.access_token_encrypted,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        expires_at = excluded.expires_at,
        token_type = excluded.token_type,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `).run(
      tokens.user_id,
      tokens.access_token_encrypted,
      tokens.refresh_token_encrypted,
      tokens.expires_at,
      tokens.token_type,
      tokens.scope,
      tokens.created_at,
      tokens.updated_at
    );
  },

  getByUserId(userId: string): OAuthTokensRow | undefined {
    return db.prepare('SELECT * FROM oauth_tokens WHERE user_id = ?').get(userId) as OAuthTokensRow | undefined;
  },

  delete(userId: string): void {
    db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(userId);
  },

  isExpired(tokens: OAuthTokensRow): boolean {
    return Date.now() >= tokens.expires_at - 60000; // 1 min buffer
  },
};

// ============================================
// Tweets Repository
// ============================================

export const tweetRepo = {
  upsertMany(tweets: TweetRow[]): number {
    if (tweets.length === 0) return 0;

    const stmt = db.prepare(`
      INSERT INTO tweets (
        id, user_id, text, created_at, conversation_id, in_reply_to_user_id,
        referenced_tweets, attachments, edit_history_tweet_ids, lang,
        possibly_sensitive, reply_settings, source, withheld,
        public_metrics, organic_metrics, promoted_metrics, non_public_metrics,
        fetched_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        conversation_id = excluded.conversation_id,
        in_reply_to_user_id = excluded.in_reply_to_user_id,
        referenced_tweets = excluded.referenced_tweets,
        attachments = excluded.attachments,
        edit_history_tweet_ids = excluded.edit_history_tweet_ids,
        lang = excluded.lang,
        possibly_sensitive = excluded.possibly_sensitive,
        reply_settings = excluded.reply_settings,
        source = excluded.source,
        withheld = excluded.withheld,
        public_metrics = excluded.public_metrics,
        organic_metrics = excluded.organic_metrics,
        promoted_metrics = excluded.promoted_metrics,
        non_public_metrics = excluded.non_public_metrics,
        updated_at = excluded.updated_at
    `);

    const transaction = db.transaction((tweets: TweetRow[]) => {
      for (const tweet of tweets) {
        stmt.run(
          tweet.id, tweet.user_id, tweet.text, tweet.created_at,
          tweet.conversation_id, tweet.in_reply_to_user_id,
          tweet.referenced_tweets, tweet.attachments, tweet.edit_history_tweet_ids,
          tweet.lang, tweet.possibly_sensitive, tweet.reply_settings,
          tweet.source, tweet.withheld,
          tweet.public_metrics, tweet.organic_metrics, tweet.promoted_metrics, tweet.non_public_metrics,
          tweet.fetched_at, tweet.updated_at
        );
      }
    });

    transaction(tweets);
    return tweets.length;
  },

  getByUserId(userId: string, limit = 100, offset = 0): TweetRow[] {
    return db.prepare(`
      SELECT * FROM tweets
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as TweetRow[];
  },

  getByIds(ids: string[]): TweetRow[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT * FROM tweets WHERE id IN (${placeholders})`).all(...ids) as TweetRow[];
  },

  getCountByUserId(userId: string): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM tweets WHERE user_id = ?').get(userId) as { count: number } | undefined;
    return result?.count ?? 0;
  },

  getDateRange(userId: string): { min: number; max: number } | null {
    const row = db.prepare(`
      SELECT MIN(created_at) as min, MAX(created_at) as max
      FROM tweets WHERE user_id = ?
    `).get(userId) as { min: number | null; max: number | null } | undefined;

    if (!row || row.min === null) return null;
    return { min: row.min, max: row.max as number };
  },

  deleteOlderThan(userId: string, cutoffMs: number): number {
    const result = db.prepare('DELETE FROM tweets WHERE user_id = ? AND created_at < ?').run(userId, cutoffMs);
    return result.changes;
  },
};

// ============================================
// Followers Repository
// ============================================

export const followerRepo = {
  upsertMany(followers: FollowerRow[]): number {
    if (followers.length === 0) return 0;

    const stmt = db.prepare(`
      INSERT INTO followers (
        id, user_id, follower_id, follower_username, follower_name,
        follower_description, follower_profile_image_url, follower_verified,
        follower_created_at, follower_public_metrics, follower_location,
        follower_url, follower_protected, followed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, follower_id) DO UPDATE SET
        follower_username = excluded.follower_username,
        follower_name = excluded.follower_name,
        follower_description = excluded.follower_description,
        follower_profile_image_url = excluded.follower_profile_image_url,
        follower_verified = excluded.follower_verified,
        follower_created_at = excluded.follower_created_at,
        follower_public_metrics = excluded.follower_public_metrics,
        follower_location = excluded.follower_location,
        follower_url = excluded.follower_url,
        follower_protected = excluded.follower_protected,
        followed_at = excluded.followed_at
    `);

    const transaction = db.transaction((followers: FollowerRow[]) => {
      for (const f of followers) {
        stmt.run(
          f.id, f.user_id, f.follower_id, f.follower_username, f.follower_name,
          f.follower_description, f.follower_profile_image_url, f.follower_verified,
          f.follower_created_at, f.follower_public_metrics, f.follower_location,
          f.follower_url, f.follower_protected, f.followed_at
        );
      }
    });

    transaction(followers);
    return followers.length;
  },

  getByUserId(userId: string, limit = 1000, offset = 0): FollowerRow[] {
    return db.prepare(`
      SELECT * FROM followers
      WHERE user_id = ?
      ORDER BY followed_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as FollowerRow[];
  },

  getCountByUserId(userId: string): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM followers WHERE user_id = ?').get(userId) as { count: number } | undefined;
    return result?.count ?? 0;
  },

  getCountries(userId: string): Record<string, number> {
    const rows = db.prepare(`
      SELECT follower_location as country, COUNT(*) as count
      FROM followers
      WHERE user_id = ? AND follower_location IS NOT NULL AND follower_location != ''
      GROUP BY follower_location
      ORDER BY count DESC
    `).all(userId) as { country: string; count: number }[];

    return Object.fromEntries(rows.map(r => [r.country, r.count]));
  },

  getLanguages(userId: string): Record<string, number> {
    // We don't store language directly, but can infer from tweets or user profile
    // For now, return empty - would need to fetch from user objects
    return {};
  },

  deleteOlderThan(userId: string, cutoffMs: number): number {
    const result = db.prepare('DELETE FROM followers WHERE user_id = ? AND followed_at < ?').run(userId, cutoffMs);
    return result.changes;
  },
};

// ============================================
// Analytics Snapshots Repository
// ============================================

export const analyticsRepo = {
  upsert(snapshot: AnalyticsSnapshotRow): void {
    db.prepare(`
      INSERT INTO analytics_snapshots (
        id, user_id, period_start, period_end, tweets_count,
        total_impressions, total_engagements, total_likes, total_retweets,
        total_replies, total_quotes, total_bookmarks, avg_engagement_rate,
        best_posting_hours, top_tweets, audience_countries, audience_languages,
        followers_gained, followers_lost, net_followers_change, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tweets_count = excluded.tweets_count,
        total_impressions = excluded.total_impressions,
        total_engagements = excluded.total_engagements,
        total_likes = excluded.total_likes,
        total_retweets = excluded.total_retweets,
        total_replies = excluded.total_replies,
        total_quotes = excluded.total_quotes,
        total_bookmarks = excluded.total_bookmarks,
        avg_engagement_rate = excluded.avg_engagement_rate,
        best_posting_hours = excluded.best_posting_hours,
        top_tweets = excluded.top_tweets,
        audience_countries = excluded.audience_countries,
        audience_languages = excluded.audience_languages,
        followers_gained = excluded.followers_gained,
        followers_lost = excluded.followers_lost,
        net_followers_change = excluded.net_followers_change
    `).run(
      snapshot.id, snapshot.user_id, snapshot.period_start, snapshot.period_end,
      snapshot.tweets_count, snapshot.total_impressions, snapshot.total_engagements,
      snapshot.total_likes, snapshot.total_retweets, snapshot.total_replies,
      snapshot.total_quotes, snapshot.total_bookmarks, snapshot.avg_engagement_rate,
      snapshot.best_posting_hours, snapshot.top_tweets, snapshot.audience_countries,
      snapshot.audience_languages, snapshot.followers_gained, snapshot.followers_lost,
      snapshot.net_followers_change, snapshot.created_at
    );
  },

  getLatest(userId: string): AnalyticsSnapshotRow | undefined {
    return db.prepare(`
      SELECT * FROM analytics_snapshots
      WHERE user_id = ?
      ORDER BY period_end DESC
      LIMIT 1
    `).get(userId) as AnalyticsSnapshotRow | undefined;
  },

  getByPeriod(userId: string, periodStart: number, periodEnd: number): AnalyticsSnapshotRow | undefined {
    return db.prepare(`
      SELECT * FROM analytics_snapshots
      WHERE user_id = ? AND period_start = ? AND period_end = ?
      LIMIT 1
    `).get(userId, periodStart, periodEnd) as AnalyticsSnapshotRow | undefined;
  },

  getHistory(userId: string, limit = 30): AnalyticsSnapshotRow[] {
    return db.prepare(`
      SELECT * FROM analytics_snapshots
      WHERE user_id = ?
      ORDER BY period_end DESC
      LIMIT ?
    `).all(userId, limit) as AnalyticsSnapshotRow[];
  },
};

// ============================================
// Settings Repository
// ============================================

export const settingsRepo = {
  get(userId: string): SettingsRow | undefined {
    return db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) as SettingsRow | undefined;
  },

  upsert(settings: SettingsRow): void {
    db.prepare(`
      INSERT INTO settings (user_id, timezone, date_format, auto_refresh_enabled, auto_refresh_interval_minutes, data_retention_days, export_format, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        timezone = excluded.timezone,
        date_format = excluded.date_format,
        auto_refresh_enabled = excluded.auto_refresh_enabled,
        auto_refresh_interval_minutes = excluded.auto_refresh_interval_minutes,
        data_retention_days = excluded.data_retention_days,
        export_format = excluded.export_format,
        updated_at = excluded.updated_at
    `).run(
      settings.user_id, settings.timezone, settings.date_format,
      settings.auto_refresh_enabled, settings.auto_refresh_interval_minutes,
      settings.data_retention_days, settings.export_format,
      settings.created_at, settings.updated_at
    );
  },

  getDefaults(): SettingsRow {
    const now = Date.now();
    return {
      user_id: '',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      auto_refresh_enabled: 1,
      auto_refresh_interval_minutes: 60,
      data_retention_days: 365,
      export_format: 'json',
      created_at: now,
      updated_at: now,
    };
  },
};

// ============================================
// API Usage Repository
// ============================================

export const apiUsageRepo = {
  log(usage: {
    id: string;
    user_id: string;
    endpoint: string;
    method: string;
    status_code: number | null;
    rate_limit_remaining: number | null;
    rate_limit_reset: number | null;
    response_time_ms: number;
    error_message: string | null;
  }): void {
    db.prepare(`
      INSERT INTO api_usage (id, user_id, endpoint, method, status_code, rate_limit_remaining, rate_limit_reset, response_time_ms, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usage.id, usage.user_id, usage.endpoint, usage.method,
      usage.status_code, usage.rate_limit_remaining, usage.rate_limit_reset,
      usage.response_time_ms, usage.error_message, Date.now()
    );
  },

  getRecent(userId: string, limit = 100): Array<{
    endpoint: string;
    method: string;
    status_code: number | null;
    rate_limit_remaining: number | null;
    response_time_ms: number;
    error_message: string | null;
    created_at: number;
  }> {
    return db.prepare(`
      SELECT endpoint, method, status_code, rate_limit_remaining, response_time_ms, error_message, created_at
      FROM api_usage
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit) as Array<{
      endpoint: string;
      method: string;
      status_code: number | null;
      rate_limit_remaining: number | null;
      response_time_ms: number;
      error_message: string | null;
      created_at: number;
    }>;
  },
};