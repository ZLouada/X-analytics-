import { db } from '@/storage/database';
import { tweetRepo, followerRepo, analyticsRepo, userRepo } from '@/storage/repositories';
import { logger } from '@/server/logger';

// ============================================
// Types
// ============================================

export interface EngagementMetrics {
  impressions: number;
  engagements: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  engagementRate: number;
}

export interface TweetPerformance {
  tweetId: string;
  text: string;
  createdAt: number;
  metrics: EngagementMetrics;
  url: string;
}

export interface HourlyEngagement {
  hour: number; // 0-23
  tweets: number;
  avgImpressions: number;
  avgEngagementRate: number;
  totalEngagements: number;
}

export interface AudienceInsight {
  countries: Record<string, number>;
  languages: Record<string, number>;
  verifiedFollowers: number;
  totalFollowers: number;
  avgFollowerCount: number;
  avgFollowingCount: number;
  avgTweetCount: number;
}

export interface GrowthMetrics {
  followersGained: number;
  followersLost: number;
  netChange: number;
  tweetsPosted: number;
  periodDays: number;
}

export interface AnalyticsReport {
  period: { start: number; end: number };
  summary: EngagementMetrics;
  topTweets: TweetPerformance[];
  hourlyEngagement: HourlyEngagement[];
  audience: AudienceInsight;
  growth: GrowthMetrics;
  generatedAt: number;
}

// ============================================
// Helper Functions
// ============================================

function parsePublicMetrics(json: string): {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count: number;
  impression_count: number;
} {
  try {
    return JSON.parse(json);
  } catch {
    return { retweet_count: 0, reply_count: 0, like_count: 0, quote_count: 0, bookmark_count: 0, impression_count: 0 };
  }
}

function calculateEngagementRate(impressions: number, engagements: number): number {
  if (impressions === 0) return 0;
  return (engagements / impressions) * 100;
}

function getHourFromTimestamp(ts: number): number {
  return new Date(ts).getUTCHours();
}

function formatTweetUrl(username: string, tweetId: string): string {
  return `https://x.com/${username}/status/${tweetId}`;
}

// ============================================
// Analytics Engine
// ============================================

export class AnalyticsEngine {
  private userId: string;
  private username: string;

  constructor(userId: string) {
    this.userId = userId;
    const user = userRepo.getById(userId);
    this.username = user?.username || 'unknown';
  }

  // ---------------------------------------------------------------------------
  // Main Report Generation
  // ---------------------------------------------------------------------------

  async generateReport(periodStart: number, periodEnd: number): Promise<AnalyticsReport> {
    logger.info({ userId: this.userId, periodStart, periodEnd }, 'Generating analytics report');

    const tweets = tweetRepo.getByUserId(this.userId, 10000);
    const filteredTweets = tweets.filter(t => t.created_at >= periodStart && t.created_at <= periodEnd);

    const summary = this.computeSummary(filteredTweets);
    const topTweets = this.getTopTweets(filteredTweets, 10);
    const hourlyEngagement = this.computeHourlyEngagement(filteredTweets);
    const audience = await this.computeAudienceInsights();
    const growth = this.computeGrowthMetrics(periodStart, periodEnd);

    const report: AnalyticsReport = {
      period: { start: periodStart, end: periodEnd },
      summary,
      topTweets,
      hourlyEngagement,
      audience,
      growth,
      generatedAt: Date.now(),
    };

    // Save snapshot
    const snapshotId = `${this.userId}:${periodStart}:${periodEnd}`;
    analyticsRepo.upsert({
      id: snapshotId,
      user_id: this.userId,
      period_start: periodStart,
      period_end: periodEnd,
      tweets_count: summary.impressions > 0 ? filteredTweets.length : 0,
      total_impressions: summary.impressions,
      total_engagements: summary.engagements,
      total_likes: summary.likes,
      total_retweets: summary.retweets,
      total_replies: summary.replies,
      total_quotes: summary.quotes,
      total_bookmarks: summary.bookmarks,
      avg_engagement_rate: summary.engagementRate,
      best_posting_hours: JSON.stringify(hourlyEngagement.map(h => ({ hour: h.hour, rate: h.avgEngagementRate }))),
      top_tweets: JSON.stringify(topTweets.map(t => t.tweetId)),
      audience_countries: JSON.stringify(audience.countries),
      audience_languages: JSON.stringify(audience.languages),
      followers_gained: growth.followersGained,
      followers_lost: growth.followersLost,
      net_followers_change: growth.netChange,
      created_at: Date.now(),
    });

    return report;
  }

  // ---------------------------------------------------------------------------
  // Summary Computation
  // ---------------------------------------------------------------------------

  private computeSummary(tweets: ReturnType<typeof tweetRepo.getByUserId>): EngagementMetrics {
    let totalImpressions = 0;
    let totalEngagements = 0;
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;
    let totalQuotes = 0;
    let totalBookmarks = 0;

    for (const tweet of tweets) {
      const metrics = parsePublicMetrics(tweet.public_metrics);
      totalImpressions += metrics.impression_count;
      totalLikes += metrics.like_count;
      totalRetweets += metrics.retweet_count;
      totalReplies += metrics.reply_count;
      totalQuotes += metrics.quote_count;
      totalBookmarks += metrics.bookmark_count;
    }

    totalEngagements = totalLikes + totalRetweets + totalReplies + totalQuotes + totalBookmarks;

    return {
      impressions: totalImpressions,
      engagements: totalEngagements,
      likes: totalLikes,
      retweets: totalRetweets,
      replies: totalReplies,
      quotes: totalQuotes,
      bookmarks: totalBookmarks,
      engagementRate: calculateEngagementRate(totalImpressions, totalEngagements),
    };
  }

  // ---------------------------------------------------------------------------
  // Top Tweets
  // ---------------------------------------------------------------------------

  private getTopTweets(tweets: ReturnType<typeof tweetRepo.getByUserId>, limit: number): TweetPerformance[] {
    const performances = tweets.map(tweet => {
      const metrics = parsePublicMetrics(tweet.public_metrics);
      const engagements = metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count + metrics.bookmark_count;
      const engagementRate = calculateEngagementRate(metrics.impression_count, engagements);

      return {
        tweetId: tweet.id,
        text: tweet.text.length > 100 ? tweet.text.slice(0, 97) + '...' : tweet.text,
        createdAt: tweet.created_at,
        metrics: {
          impressions: metrics.impression_count,
          engagements,
          likes: metrics.like_count,
          retweets: metrics.retweet_count,
          replies: metrics.reply_count,
          quotes: metrics.quote_count,
          bookmarks: metrics.bookmark_count,
          engagementRate,
        },
        url: formatTweetUrl(this.username, tweet.id),
      };
    });

    return performances
      .sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate)
      .slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Hourly Engagement
  // ---------------------------------------------------------------------------

  private computeHourlyEngagement(tweets: ReturnType<typeof tweetRepo.getByUserId>): HourlyEngagement[] {
    const hourlyData: Record<number, { tweets: number; impressions: number; engagements: number }> = {};

    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { tweets: 0, impressions: 0, engagements: 0 };
    }

    for (const tweet of tweets) {
      const hour = getHourFromTimestamp(tweet.created_at);
      const metrics = parsePublicMetrics(tweet.public_metrics);
      const engagements = metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count + metrics.bookmark_count;

      hourlyData[hour].tweets += 1;
      hourlyData[hour].impressions += metrics.impression_count;
      hourlyData[hour].engagements += engagements;
    }

    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: parseInt(hour, 10),
        tweets: data.tweets,
        avgImpressions: data.tweets > 0 ? Math.round(data.impressions / data.tweets) : 0,
        avgEngagementRate: data.impressions > 0 ? calculateEngagementRate(data.impressions, data.engagements) : 0,
        totalEngagements: data.engagements,
      }))
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
  }

  // ---------------------------------------------------------------------------
  // Audience Insights
  // ---------------------------------------------------------------------------

  private async computeAudienceInsights(): Promise<AudienceInsight> {
    const followers = followerRepo.getByUserId(this.userId, 10000);
    const countries = followerRepo.getCountries(this.userId);

    let verifiedFollowers = 0;
    let totalFollowersCount = 0;
    let totalFollowingCount = 0;
    let totalTweetCount = 0;

    for (const follower of followers) {
      if (follower.follower_verified) verifiedFollowers++;
      if (follower.follower_public_metrics) {
        try {
          const metrics = JSON.parse(follower.follower_public_metrics) as {
            followers_count: number;
            following_count: number;
            tweet_count: number;
          };
          totalFollowersCount += metrics.followers_count || 0;
          totalFollowingCount += metrics.following_count || 0;
          totalTweetCount += metrics.tweet_count || 0;
        } catch {
          // ignore parse errors
        }
      }
    }

    const count = followers.length || 1;

    return {
      countries,
      languages: {}, // Would need tweet lang analysis
      verifiedFollowers,
      totalFollowers: followers.length,
      avgFollowerCount: Math.round(totalFollowersCount / count),
      avgFollowingCount: Math.round(totalFollowingCount / count),
      avgTweetCount: Math.round(totalTweetCount / count),
    };
  }

  // ---------------------------------------------------------------------------
  // Growth Metrics
  // ---------------------------------------------------------------------------

  private computeGrowthMetrics(periodStart: number, periodEnd: number): GrowthMetrics {
    const periodDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));

    // Get tweets in period
    const tweets = tweetRepo.getByUserId(this.userId, 10000);
    const tweetsInPeriod = tweets.filter(t => t.created_at >= periodStart && t.created_at <= periodEnd);

    // For followers gained/lost, we'd need historical snapshots
    // For now, estimate from current followers vs period start
    // This is a simplification - real implementation would track daily counts
    const currentFollowers = followerRepo.getCountByUserId(this.userId);

    return {
      followersGained: 0, // Would need historical tracking
      followersLost: 0,
      netChange: 0,
      tweetsPosted: tweetsInPeriod.length,
      periodDays,
    };
  }

  // ---------------------------------------------------------------------------
  // Quick Stats (for dashboard cards)
  // ---------------------------------------------------------------------------

  async getQuickStats(): Promise<{
    totalTweets: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
    totalFollowers: number;
    followersChange7d: number;
    tweetsLast7d: number;
    bestHour: number;
  }> {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const allTweets = tweetRepo.getByUserId(this.userId, 10000);
    const tweets30d = allTweets.filter(t => t.created_at >= thirtyDaysAgo);
    const tweets7d = allTweets.filter(t => t.created_at >= sevenDaysAgo);

    const summary30d = this.computeSummary(tweets30d);
    const summary7d = this.computeSummary(tweets7d);
    const hourly = this.computeHourlyEngagement(tweets30d);
    const bestHour = hourly[0]?.hour || 12;
    const totalFollowers = followerRepo.getCountByUserId(this.userId);

    return {
      totalTweets: allTweets.length,
      totalImpressions: summary30d.impressions,
      totalEngagements: summary30d.engagements,
      avgEngagementRate: summary30d.engagementRate,
      totalFollowers,
      followersChange7d: 0, // Would need historical data
      tweetsLast7d: tweets7d.length,
      bestHour,
    };
  }
}

// ============================================
// Convenience Functions
// ============================================

export function getPeriodRange(period: '7d' | '30d' | '90d' | 'all'): { start: number; end: number } {
  const end = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (period) {
    case '7d': return { start: end - 7 * dayMs, end };
    case '30d': return { start: end - 30 * dayMs, end };
    case '90d': return { start: end - 90 * dayMs, end };
    case 'all': {
      // Get earliest tweet date
      const tweets = tweetRepo.getByUserId(''); // Will be filtered by userId in engine
      // This is a placeholder - actual implementation needs userId
      return { start: end - 365 * dayMs, end };
    }
  }
}