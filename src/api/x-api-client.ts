import { randomBytes, createHash } from 'crypto';
import { getConfig } from '@/config';
import { logger } from '@/server/logger';
import { encrypt, decrypt } from '@/server/encryption';
import { tokenRepo, userRepo, tweetRepo, followerRepo, apiUsageRepo } from '@/storage/repositories';
import { DatabaseManager } from '@/storage/database';

// ============================================
// Types
// ============================================

export interface XUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  description?: string;
  verified?: boolean;
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  location?: string;
  url?: string;
  protected?: boolean;
}

export interface XTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
  attachments?: { media_keys?: string[] };
  edit_history_tweet_ids?: string[];
  lang?: string;
  possibly_sensitive?: boolean;
  reply_settings?: string;
  source?: string;
  withheld?: { copyright?: boolean; country_codes?: string[]; scope?: string };
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  organic_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  promoted_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  non_public_metrics?: {
    impression_count: number;
    url_link_clicks: number;
    user_profile_clicks: number;
  };
}

export interface XApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  errors?: Array<{ title: string; detail: string; value?: string }>;
}

export interface PaginationToken {
  next_token?: string;
  previous_token?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp seconds
}

// ============================================
// PKCE Helpers
// ============================================

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return randomBytes(16).toString('base64url');
}

// ============================================
// X API Client
// ============================================

const X_API_BASE = 'https://api.x.com/2';
const X_OAUTH_BASE = 'https://x.com/i/oauth2';

const REQUIRED_SCOPES = [
  'tweet.read',
  'users.read',
  'offline.access',
].join(' ');

export class XApiClient {
  private userId: string;
  private accessToken: string | null = null;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  // ---------------------------------------------------------------------------
  // OAuth 2.0 PKCE Flow
  // ---------------------------------------------------------------------------

  static generateAuthUrl(): { url: string; codeVerifier: string; state: string } {
    const config = getConfig();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.X_CLIENT_ID,
      redirect_uri: config.X_REDIRECT_URI,
      scope: REQUIRED_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `${X_OAUTH_BASE}/authorize?${params.toString()}`,
      codeVerifier,
      state,
    };
  }

  static async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const config = getConfig();

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.X_REDIRECT_URI,
      code_verifier: codeVerifier,
      client_id: config.X_CLIENT_ID,
    });

    if (config.X_CLIENT_SECRET) {
      params.append('client_secret', config.X_CLIENT_SECRET);
    }

    const response = await fetch(`${X_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = await response.json() as { error_description?: string; error?: string };

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${data.error_description || data.error || response.statusText}`);
    }

    return data as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
  }

  static async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const config = getConfig();

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.X_CLIENT_ID,
    });

    if (config.X_CLIENT_SECRET) {
      params.append('client_secret', config.X_CLIENT_SECRET);
    }

    const response = await fetch(`${X_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = await response.json() as { error_description?: string; error?: string };

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error || response.statusText}`);
    }

    return data as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
  }

  // ---------------------------------------------------------------------------
  // Token Management
  // ---------------------------------------------------------------------------

  async loadTokens(): Promise<void> {
    const tokens = tokenRepo.getByUserId(this.userId);
    if (!tokens) {
      throw new Error('No tokens found for user');
    }

    const accessToken = await decrypt(tokens.access_token_encrypted);
    const refreshToken = await decrypt(tokens.refresh_token_encrypted);

    this.accessToken = accessToken;

    // Check if expired and refresh if needed
    if (tokenRepo.isExpired(tokens)) {
      await this.refreshTokens(refreshToken);
    }
  }

  private async refreshTokens(refreshToken: string): Promise<void> {
    logger.info({ userId: this.userId }, 'Refreshing access token');

    const newTokens = await XApiClient.refreshAccessToken(refreshToken);

    const expiresAt = Date.now() + newTokens.expires_in * 1000;

    await encrypt(newTokens.access_token).then(access_token_encrypted =>
      encrypt(newTokens.refresh_token).then(refresh_token_encrypted => {
        tokenRepo.upsert({
          user_id: this.userId,
          access_token_encrypted,
          refresh_token_encrypted,
          expires_at: expiresAt,
          token_type: newTokens.token_type,
          scope: newTokens.scope,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      })
    );

    this.accessToken = newTokens.access_token;
    logger.info({ userId: this.userId }, 'Access token refreshed successfully');
  }

  // ---------------------------------------------------------------------------
  // Core Request Method
  // ---------------------------------------------------------------------------

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    params: URLSearchParams = new URLSearchParams()
  ): Promise<{ data: T; rateLimit: RateLimitInfo }> {
    if (!this.accessToken) {
      await this.loadTokens();
    }

    const url = `${X_API_BASE}${endpoint}?${params.toString()}`;
    const startTime = Date.now();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'X-Analytics-Free/1.0',
        ...options.headers,
      },
    });

    const responseTimeMs = Date.now() - startTime;
    const rateLimit = this.parseRateLimit(response.headers);

    // Log API usage
    apiUsageRepo.log({
      id: randomBytes(8).toString('hex'),
      user_id: this.userId,
      endpoint,
      method: options.method || 'GET',
      status_code: response.status,
      rate_limit_remaining: rateLimit.remaining,
      rate_limit_reset: rateLimit.reset,
      response_time_ms: responseTimeMs,
      error_message: response.ok ? null : `HTTP ${response.status}`,
    });

    const responseData = await response.json() as unknown;

    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 429) {
        const resetTime = rateLimit.reset * 1000;
        const waitTime = Math.max(resetTime - Date.now(), 0);
        logger.warn({ userId: this.userId, waitTime }, 'Rate limited, waiting');
        await new Promise(r => setTimeout(r, waitTime + 1000));
        return this.request<T>(endpoint, options, params); // Retry once
      }

      // Handle token expiration
      if (response.status === 401) {
        const tokens = tokenRepo.getByUserId(this.userId);
        if (tokens) {
          const refreshToken = await decrypt(tokens.refresh_token_encrypted);
          await this.refreshTokens(refreshToken);
          return this.request<T>(endpoint, options, params); // Retry with new token
        }
      }

      const error = (responseData as { errors?: { detail: string }[]; detail?: string }).errors?.[0]?.detail || (responseData as { detail?: string }).detail || `HTTP ${response.status}`;
      throw new Error(`X API error: ${error}`);
    }

    this.rateLimitInfo = rateLimit;
    return { data: responseData as T, rateLimit };
  }

  private parseRateLimit(headers: Headers): RateLimitInfo {
    const limit = parseInt(headers.get('x-rate-limit-limit') || '0', 10);
    const remaining = parseInt(headers.get('x-rate-limit-remaining') || '0', 10);
    const reset = parseInt(headers.get('x-rate-limit-reset') || '0', 10);

    return { limit, remaining, reset };
  }

  getRateLimit(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  // ---------------------------------------------------------------------------
  // User Endpoints
  // ---------------------------------------------------------------------------

  async getMe(): Promise<XUser> {
    const params = new URLSearchParams({
      'user.fields': 'id,username,name,profile_image_url,description,verified,created_at,public_metrics,location,url,protected',
    });

    const { data } = await this.request<XApiResponse<XUser>>('/users/me', {}, params);
    return data.data;
  }

  async getUserByUsername(username: string): Promise<XUser | null> {
    const params = new URLSearchParams({
      'user.fields': 'id,username,name,profile_image_url,description,verified,created_at,public_metrics,location,url,protected',
    });

    try {
      const { data } = await this.request<XApiResponse<XUser>>(`/users/by/username/${username}`, {}, params);
      return data.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) return null;
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Tweet Endpoints
  // ---------------------------------------------------------------------------

  async getUserTweets(
    userId: string,
    options: {
      maxResults?: number;
      paginationToken?: string;
      startTime?: string;
      endTime?: string;
      tweetFields?: string;
      expansions?: string;
    } = {}
  ): Promise<{ tweets: XTweet[]; meta: PaginationToken }> {
    const {
      maxResults = 100,
      paginationToken,
      startTime,
      endTime,
      tweetFields = 'created_at,conversation_id,in_reply_to_user_id,referenced_tweets,attachments,edit_history_tweet_ids,lang,possibly_sensitive,reply_settings,source,withheld,public_metrics,organic_metrics,promoted_metrics,non_public_metrics',
      expansions = 'author_id',
    } = options;

    const params = new URLSearchParams({
      'max_results': String(maxResults),
      'tweet.fields': tweetFields,
      expansions,
    });

    if (paginationToken) params.append('pagination_token', paginationToken);
    if (startTime) params.append('start_time', startTime);
    if (endTime) params.append('end_time', endTime);

    const { data } = await this.request<XApiResponse<XTweet[]> & { meta: PaginationToken }>(
      `/users/${userId}/tweets`,
      {},
      params
    );

    return {
      tweets: data.data || [],
      meta: data.meta || {},
    };
  }

  async getTweet(tweetId: string): Promise<XTweet | null> {
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,conversation_id,in_reply_to_user_id,referenced_tweets,attachments,edit_history_tweet_ids,lang,possibly_sensitive,reply_settings,source,withheld,public_metrics,organic_metrics,promoted_metrics,non_public_metrics',
      expansions: 'author_id',
    });

    try {
      const { data } = await this.request<XApiResponse<XTweet>>(`/tweets/${tweetId}`, {}, params);
      return data.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) return null;
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Follower Endpoints
  // ---------------------------------------------------------------------------

  async getFollowers(
    userId: string,
    options: {
      maxResults?: number;
      paginationToken?: string;
      userFields?: string;
    } = {}
  ): Promise<{ users: XUser[]; meta: PaginationToken }> {
    const {
      maxResults = 1000,
      paginationToken,
      userFields = 'id,username,name,profile_image_url,description,verified,created_at,public_metrics,location,url,protected',
    } = options;

    const params = new URLSearchParams({
      'max_results': String(maxResults),
      'user.fields': userFields,
    });

    if (paginationToken) params.append('pagination_token', paginationToken);

    const { data } = await this.request<XApiResponse<XUser[]> & { meta: PaginationToken }>(
      `/users/${userId}/followers`,
      {},
      params
    );

    return {
      users: data.data || [],
      meta: data.meta || {},
    };
  }

  async getFollowing(
    userId: string,
    options: {
      maxResults?: number;
      paginationToken?: string;
      userFields?: string;
    } = {}
  ): Promise<{ users: XUser[]; meta: PaginationToken }> {
    const {
      maxResults = 1000,
      paginationToken,
      userFields = 'id,username,name,profile_image_url,description,verified,created_at,public_metrics,location,url,protected',
    } = options;

    const params = new URLSearchParams({
      'max_results': String(maxResults),
      'user.fields': userFields,
    });

    if (paginationToken) params.append('pagination_token', paginationToken);

    const { data } = await this.request<XApiResponse<XUser[]> & { meta: PaginationToken }>(
      `/users/${userId}/following`,
      {},
      params
    );

    return {
      users: data.data || [],
      meta: data.meta || {},
    };
  }
}

// ============================================
// High-Level Sync Functions
// ============================================

export async function syncUserProfile(userId: string): Promise<XUser> {
  const client = new XApiClient(userId);
  const user = await client.getMe();

  userRepo.upsert({
    id: user.id,
    username: user.username,
    name: user.name,
    profile_image_url: user.profile_image_url || null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  return user;
}

export async function syncUserTweets(userId: string, options: { sinceId?: string; untilId?: string } = {}): Promise<number> {
  const client = new XApiClient(userId);
  let totalSynced = 0;
  let paginationToken: string | undefined;
  const maxPages = 10; // Limit to prevent excessive API calls

  for (let page = 0; page < maxPages; page++) {
    const { tweets, meta } = await client.getUserTweets(userId, {
      maxResults: 100,
      paginationToken,
      tweetFields: 'created_at,conversation_id,in_reply_to_user_id,referenced_tweets,attachments,edit_history_tweet_ids,lang,possibly_sensitive,reply_settings,source,withheld,public_metrics,organic_metrics,promoted_metrics,non_public_metrics',
    });

    if (tweets.length === 0) break;

    const tweetRows = tweets.map(tweet => ({
      id: tweet.id,
      user_id: userId,
      text: tweet.text,
      created_at: new Date(tweet.created_at).getTime(),
      conversation_id: tweet.conversation_id || null,
      in_reply_to_user_id: tweet.in_reply_to_user_id || null,
      referenced_tweets: tweet.referenced_tweets ? JSON.stringify(tweet.referenced_tweets) : null,
      attachments: tweet.attachments ? JSON.stringify(tweet.attachments) : null,
      edit_history_tweet_ids: tweet.edit_history_tweet_ids ? JSON.stringify(tweet.edit_history_tweet_ids) : null,
      lang: tweet.lang || null,
      possibly_sensitive: tweet.possibly_sensitive ? 1 : 0,
      reply_settings: tweet.reply_settings || null,
      source: tweet.source || null,
      withheld: tweet.withheld ? JSON.stringify(tweet.withheld) : null,
      public_metrics: JSON.stringify(tweet.public_metrics),
      organic_metrics: tweet.organic_metrics ? JSON.stringify(tweet.organic_metrics) : null,
      promoted_metrics: tweet.promoted_metrics ? JSON.stringify(tweet.promoted_metrics) : null,
      non_public_metrics: tweet.non_public_metrics ? JSON.stringify(tweet.non_public_metrics) : null,
      fetched_at: Date.now(),
      updated_at: Date.now(),
    }));

    tweetRepo.upsertMany(tweetRows);
    totalSynced += tweets.length;

    paginationToken = meta.next_token;
    if (!paginationToken) break;

    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 200));
  }

  logger.info({ userId, totalSynced }, 'Tweet sync complete');
  return totalSynced;
}

export async function syncFollowers(userId: string): Promise<number> {
  const client = new XApiClient(userId);
  let totalSynced = 0;
  let paginationToken: string | undefined;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page++) {
    const { users, meta } = await client.getFollowers(userId, {
      maxResults: 1000,
      paginationToken,
    });

    if (users.length === 0) break;

    const followerRows = users.map(user => ({
      id: `${userId}:${user.id}`,
      user_id: userId,
      follower_id: user.id,
      follower_username: user.username,
      follower_name: user.name,
      follower_description: user.description || null,
      follower_profile_image_url: user.profile_image_url || null,
      follower_verified: user.verified ? 1 : 0,
      follower_created_at: user.created_at ? new Date(user.created_at).getTime() : null,
      follower_public_metrics: user.public_metrics ? JSON.stringify(user.public_metrics) : null,
      follower_location: user.location || null,
      follower_url: user.url || null,
      follower_protected: user.protected ? 1 : 0,
      followed_at: Date.now(),
    }));

    followerRepo.upsertMany(followerRows);
    totalSynced += users.length;

    paginationToken = meta.next_token;
    if (!paginationToken) break;

    await new Promise(r => setTimeout(r, 500));
  }

  logger.info({ userId, totalSynced }, 'Follower sync complete');
  return totalSynced;
}

export async function syncFollowing(userId: string): Promise<number> {
  const client = new XApiClient(userId);
  let totalSynced = 0;
  let paginationToken: string | undefined;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page++) {
    const { users, meta } = await client.getFollowing(userId, {
      maxResults: 1000,
      paginationToken,
    });

    if (users.length === 0) break;

    const followingRows = users.map(user => ({
      id: `${userId}:${user.id}`,
      user_id: userId,
      following_id: user.id,
      following_username: user.username,
      following_name: user.name,
      following_description: user.description || null,
      following_profile_image_url: user.profile_image_url || null,
      following_verified: user.verified ? 1 : 0,
      following_created_at: user.created_at ? new Date(user.created_at).getTime() : null,
      following_public_metrics: user.public_metrics ? JSON.stringify(user.public_metrics) : null,
      following_location: user.location || null,
      following_url: user.url || null,
      following_protected: user.protected ? 1 : 0,
      followed_at: Date.now(),
    }));

    // Reuse follower table structure but with different prefix
    // We'll store in a separate table - for now skip to keep simple

    paginationToken = meta.next_token;
    if (!paginationToken) break;

    await new Promise(r => setTimeout(r, 500));
  }

  return totalSynced;
}