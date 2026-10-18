import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import { AnalyticsReport, TweetPerformance, HourlyEngagement, AudienceInsight, GrowthMetrics } from '@/analytics/engine';
import { tweetRepo, userRepo, followerRepo } from '@/storage/repositories';
import { logger } from '@/server/logger';

// ============================================
// Types
// ============================================

export type ExportFormat = 'json' | 'csv' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeTweets?: boolean;
  includeAudience?: boolean;
  includeHourly?: boolean;
  dateRange?: { start: number; end: number };
}

// ============================================
// JSON Export
// ============================================

export function exportToJson(report: AnalyticsReport, options: ExportOptions = { format: 'json' }): string {
  const output: Record<string, unknown> = {
    metadata: {
      generatedAt: new Date(report.generatedAt).toISOString(),
      period: {
        start: new Date(report.period.start).toISOString(),
        end: new Date(report.period.end).toISOString(),
      },
    },
    summary: report.summary,
  };

  if (options.includeTweets !== false) {
    output.topTweets = report.topTweets;
  }

  if (options.includeHourly !== false) {
    output.hourlyEngagement = report.hourlyEngagement;
  }

  if (options.includeAudience !== false) {
    output.audience = report.audience;
  }

  output.growth = report.growth;

  return JSON.stringify(output, null, 2);
}

// ============================================
// CSV Export
// ============================================

export function exportToCsv(report: AnalyticsReport, options: ExportOptions = { format: 'csv' }): string {
  const sections: string[] = [];

  // Summary section
  sections.push('=== SUMMARY ===');
  sections.push(stringify([
    ['Metric', 'Value'],
    ['Total Impressions', report.summary.impressions],
    ['Total Engagements', report.summary.engagements],
    ['Total Likes', report.summary.likes],
    ['Total Retweets', report.summary.retweets],
    ['Total Replies', report.summary.replies],
    ['Total Quotes', report.summary.quotes],
    ['Total Bookmarks', report.summary.bookmarks],
    ['Engagement Rate (%)', report.summary.engagementRate.toFixed(2)],
  ]));

  // Top Tweets section
  if (options.includeTweets !== false && report.topTweets.length > 0) {
    sections.push('\n=== TOP TWEETS ===');
    sections.push(stringify([
      ['Rank', 'Tweet ID', 'Date', 'Text', 'Impressions', 'Engagements', 'Engagement Rate (%)', 'Likes', 'Retweets', 'Replies', 'Quotes', 'Bookmarks', 'URL'],
      ...report.topTweets.map((tweet, i) => [
        i + 1,
        tweet.tweetId,
        new Date(tweet.createdAt).toISOString(),
        tweet.text,
        tweet.metrics.impressions,
        tweet.metrics.engagements,
        tweet.metrics.engagementRate.toFixed(2),
        tweet.metrics.likes,
        tweet.metrics.retweets,
        tweet.metrics.replies,
        tweet.metrics.quotes,
        tweet.metrics.bookmarks,
        tweet.url,
      ]),
    ]));
  }

  // Hourly Engagement section
  if (options.includeHourly !== false) {
    sections.push('\n=== HOURLY ENGAGEMENT (UTC) ===');
    sections.push(stringify([
      ['Hour (UTC)', 'Tweets', 'Avg Impressions', 'Avg Engagement Rate (%)', 'Total Engagements'],
      ...report.hourlyEngagement.map(h => [
        h.hour,
        h.tweets,
        h.avgImpressions,
        h.avgEngagementRate.toFixed(2),
        h.totalEngagements,
      ]),
    ]));
  }

  // Audience section
  if (options.includeAudience !== false) {
    sections.push('\n=== AUDIENCE - TOP COUNTRIES ===');
    const countryEntries = Object.entries(report.audience.countries).slice(0, 20);
    sections.push(stringify([
      ['Country', 'Followers'],
      ...countryEntries.map(([country, count]) => [country, count]),
    ]));

    sections.push('\n=== AUDIENCE SUMMARY ===');
    sections.push(stringify([
      ['Metric', 'Value'],
      ['Total Followers', report.audience.totalFollowers],
      ['Verified Followers', report.audience.verifiedFollowers],
      ['Avg Follower Count (of followers)', report.audience.avgFollowerCount],
      ['Avg Following Count (of followers)', report.audience.avgFollowingCount],
      ['Avg Tweet Count (of followers)', report.audience.avgTweetCount],
    ]));
  }

  // Growth section
  sections.push('\n=== GROWTH ===');
  sections.push(stringify([
    ['Metric', 'Value'],
    ['Followers Gained', report.growth.followersGained],
    ['Followers Lost', report.growth.followersLost],
    ['Net Change', report.growth.netChange],
    ['Tweets Posted', report.growth.tweetsPosted],
    ['Period (Days)', report.growth.periodDays],
  ]));

  return sections.join('\n');
}

// ============================================
// PDF Export
// ============================================

export function exportToPdf(report: AnalyticsReport, options: ExportOptions = { format: 'pdf' }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('X Analytics Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(
      `Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}`,
      { align: 'center' }
    );
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    doc.fontSize(16).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);

    const summaryData = [
      ['Metric', 'Value'],
      ['Total Impressions', report.summary.impressions.toLocaleString()],
      ['Total Engagements', report.summary.engagements.toLocaleString()],
      ['Total Likes', report.summary.likes.toLocaleString()],
      ['Total Retweets', report.summary.retweets.toLocaleString()],
      ['Total Replies', report.summary.replies.toLocaleString()],
      ['Total Quotes', report.summary.quotes.toLocaleString()],
      ['Total Bookmarks', report.summary.bookmarks.toLocaleString()],
      ['Engagement Rate', `${report.summary.engagementRate.toFixed(2)}%`],
    ];

    drawTable(doc, summaryData, { colWidths: [250, 200] });
    doc.moveDown(2);

    // Top Tweets
    if (options.includeTweets !== false && report.topTweets.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Top Performing Tweets');
      doc.moveDown(0.5);

      const tweetData = [
        ['#', 'Date', 'Impressions', 'Eng. Rate', 'Likes', 'RTs', 'Replies', 'Text (truncated)'],
        ...report.topTweets.slice(0, 10).map((tweet, i) => [
          String(i + 1),
          new Date(tweet.createdAt).toLocaleDateString(),
          tweet.metrics.impressions.toLocaleString(),
          `${tweet.metrics.engagementRate.toFixed(2)}%`,
          tweet.metrics.likes.toString(),
          tweet.metrics.retweets.toString(),
          tweet.metrics.replies.toString(),
          tweet.text.slice(0, 60) + (tweet.text.length > 60 ? '...' : ''),
        ]),
      ];

      drawTable(doc, tweetData, { colWidths: [30, 80, 70, 60, 40, 40, 40, 230], fontSize: 8 });
      doc.moveDown(2);
    }

    // Hourly Engagement
    if (options.includeHourly !== false) {
      doc.fontSize(16).font('Helvetica-Bold').text('Best Posting Hours (UTC)');
      doc.moveDown(0.5);

      const hourlyData = [
        ['Hour (UTC)', 'Tweets', 'Avg Impressions', 'Avg Eng. Rate (%)', 'Total Engagements'],
        ...report.hourlyEngagement.slice(0, 12).map(h => [
          `${h.hour}:00`,
          h.tweets.toString(),
          h.avgImpressions.toLocaleString(),
          h.avgEngagementRate.toFixed(2),
          h.totalEngagements.toLocaleString(),
        ]),
      ];

      drawTable(doc, hourlyData, { colWidths: [100, 80, 120, 120, 130] });
      doc.moveDown(2);
    }

    // Audience
    if (options.includeAudience !== false) {
      doc.fontSize(16).font('Helvetica-Bold').text('Audience Insights');
      doc.moveDown(0.5);

      const audienceData = [
        ['Metric', 'Value'],
        ['Total Followers', report.audience.totalFollowers.toLocaleString()],
        ['Verified Followers', report.audience.verifiedFollowers.toLocaleString()],
        ['Avg Follower Count', report.audience.avgFollowerCount.toLocaleString()],
        ['Avg Following Count', report.audience.avgFollowingCount.toLocaleString()],
        ['Avg Tweet Count', report.audience.avgTweetCount.toLocaleString()],
      ];

      drawTable(doc, audienceData, { colWidths: [250, 200] });
      doc.moveDown(1);

      if (Object.keys(report.audience.countries).length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Top Countries');
        doc.moveDown(0.5);

        const countryData = [
          ['Country', 'Followers'],
          ...Object.entries(report.audience.countries).slice(0, 15).map(([country, count]) => [country, count.toLocaleString()]),
        ];

        drawTable(doc, countryData, { colWidths: [250, 200] });
      }
      doc.moveDown(2);
    }

    // Growth
    doc.fontSize(16).font('Helvetica-Bold').text('Growth Metrics');
    doc.moveDown(0.5);

    const growthData = [
      ['Metric', 'Value'],
      ['Followers Gained', report.growth.followersGained.toLocaleString()],
      ['Followers Lost', report.growth.followersLost.toLocaleString()],
      ['Net Change', report.growth.netChange.toLocaleString()],
      ['Tweets Posted', report.growth.tweetsPosted.toLocaleString()],
      ['Period (Days)', report.growth.periodDays.toString()],
    ];

    drawTable(doc, growthData, { colWidths: [250, 200] });

    doc.end();
  });
}

// ============================================
// PDF Table Helper
// ============================================

interface TableOptions {
  colWidths: number[];
  fontSize?: number;
  headerColor?: string;
  rowColors?: [string, string];
}

function drawTable(doc: PDFKit.PDFDocument, rows: string[][], options: TableOptions) {
  const { colWidths, fontSize = 10, headerColor = '#2c3e50', rowColors = ['#ffffff', '#f8f9fa'] } = options;
  const startX = doc.x;
  const rowHeight = 20;
  const padding = 5;

  doc.fontSize(fontSize);

  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const y = doc.y;

    // Check if we need a new page
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    // Background
    const bgColor = isHeader ? headerColor : rowColors[rowIndex % 2];
    doc.save();
    if (!isHeader) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(bgColor);
    } else {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(bgColor);
    }
    doc.restore();

    // Text
    let x = startX;
    row.forEach((cell, colIndex) => {
      const width = colWidths[colIndex];
      const color = isHeader ? '#ffffff' : '#000000';
      const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';

      doc.font(font).fontSize(fontSize).fillColor(color);
      doc.text(cell, x + padding, y + padding, {
        width: width - padding * 2,
        ellipsis: true,
      });
      x += width;
    });

    doc.y = y + rowHeight;
  });

  doc.fillColor('#000000');
}

// ============================================
// Full Data Export (all tweets, all followers)
// ============================================

export async function exportAllData(userId: string, format: ExportFormat): Promise<string | Buffer> {
  const user = userRepo.getById(userId);
  const tweets = tweetRepo.getByUserId(userId, 50000);
  const followers = followerRepo.getByUserId(userId, 50000);

  if (format === 'json') {
    return JSON.stringify({
      user: user ? { id: user.id, username: user.username, name: user.name } : null,
      tweets: tweets.map(t => ({
        id: t.id,
        text: t.text,
        created_at: new Date(t.created_at).toISOString(),
        public_metrics: JSON.parse(t.public_metrics),
      })),
      followers: followers.map(f => ({
        id: f.follower_id,
        username: f.follower_username,
        name: f.follower_name,
        location: f.follower_location,
        verified: f.follower_verified,
        public_metrics: f.follower_public_metrics ? JSON.parse(f.follower_public_metrics) : null,
      })),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  if (format === 'csv') {
    const tweetCsv = stringify([
      ['ID', 'Date', 'Text', 'Impressions', 'Likes', 'Retweets', 'Replies', 'Quotes', 'Bookmarks'],
      ...tweets.map(t => {
        const m = JSON.parse(t.public_metrics);
        return [t.id, new Date(t.created_at).toISOString(), t.text, m.impression_count, m.like_count, m.retweet_count, m.reply_count, m.quote_count, m.bookmark_count];
      }),
    ]);

    const followerCsv = stringify([
      ['ID', 'Username', 'Name', 'Location', 'Verified', 'Followers', 'Following', 'Tweets'],
      ...followers.map(f => {
        const m = f.follower_public_metrics ? JSON.parse(f.follower_public_metrics) : {};
        return [f.follower_id, f.follower_username, f.follower_name || '', f.follower_location || '', f.follower_verified, m.followers_count || 0, m.following_count || 0, m.tweet_count || 0];
      }),
    ]);

    return `=== TWEETS ===\n${tweetCsv}\n\n=== FOLLOWERS ===\n${followerCsv}`;
  }

  if (format === 'pdf') {
    // For full data PDF, create a simpler report
    const engine = await import('@/analytics/engine');
    const analyticsEngine = new engine.AnalyticsEngine(userId);
    const report = await analyticsEngine.generateReport(Date.now() - 365 * 24 * 60 * 60 * 1000, Date.now());
    return exportToPdf(report, { format: 'pdf', includeTweets: true, includeAudience: true, includeHourly: true });
  }

  throw new Error(`Unsupported format: ${format}`);
}