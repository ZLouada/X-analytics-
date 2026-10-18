import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatNumber, formatDate, EngagementChart, HourlyChart, TopTweetsTable } from '../components';

interface QuickStats {
  totalTweets: number;
  totalImpressions: number;
  totalEngagements: number;
  avgEngagementRate: number;
  totalFollowers: number;
  followersChange7d: number;
  tweetsLast7d: number;
  bestHour: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, reportRes] = await Promise.all([
        fetch('/api/analytics/quick-stats', { credentials: 'include' }),
        fetch(`/api/analytics/report?period=${period}`, { credentials: 'include' }),
      ]);

      if (!statsRes.ok || !reportRes.ok) throw new Error('Failed to fetch data');

      const statsData = await statsRes.json();
      const reportData = await reportRes.json();

      setStats(statsData);
      setReport(reportData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Welcome back, @{user?.username}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-xl font-medium text-gray-900 mb-2">Failed to load dashboard</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back, @{user?.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Impressions"
          value={formatNumber(stats?.totalImpressions || 0)}
          icon={<ImpressionsIcon />}
          trend={stats && `+${formatNumber(stats.tweetsLast7d)} tweets this week`}
        />
        <MetricCard
          label="Total Engagements"
          value={formatNumber(stats?.totalEngagements || 0)}
          icon={<EngagementsIcon />}
          trend={`${(stats?.avgEngagementRate || 0).toFixed(2)}% avg rate`}
        />
        <MetricCard
          label="Followers"
          value={formatNumber(stats?.totalFollowers || 0)}
          icon={<FollowersIcon />}
          trend={stats && stats.followersChange7d !== 0 ? `${stats.followersChange7d > 0 ? '+' : ''}${stats.followersChange7d} this week` : 'No change tracked'}
        />
        <MetricCard
          label="Tweets (30d)"
          value={formatNumber(stats?.tweetsLast7d || 0)}
          icon={<TweetsIcon />}
          trend={`Best hour: ${stats?.bestHour || 12}:00 UTC`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Engagement Over Time">
          {report?.hourlyEngagement && (
            <EngagementChart data={report.hourlyEngagement} />
          )}
        </Card>
        <Card title="Best Posting Hours (UTC)">
          {report?.hourlyEngagement && (
            <HourlyChart data={report.hourlyEngagement} />
          )}
        </Card>
      </div>

      {/* Top Tweets */}
      <Card title="Top Performing Tweets">
        {report?.topTweets && report.topTweets.length > 0 ? (
          <TopTweetsTable tweets={report.topTweets.slice(0, 5)} />
        ) : (
          <p className="text-gray-500 text-center py-8">No tweets found for this period</p>
        )}
      </Card>

      {/* Audience Summary */}
      {report?.audience && (
        <Card title="Audience Overview">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{formatNumber(report.audience.totalFollowers)}</p>
              <p className="text-sm text-gray-500">Total Followers</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{report.audience.verifiedFollowers}</p>
              <p className="text-sm text-gray-500">Verified Followers</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{Object.keys(report.audience.countries).length}</p>
              <p className="text-sm text-gray-500">Countries Represented</p>
            </div>
          </div>
          {Object.keys(report.audience.countries).length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Top Countries</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.audience.countries)
                  .slice(0, 10)
                  .map(([country, count]) => (
                    <span key={country} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                      {country} ({formatNumber(count)})
                    </span>
                  ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ============================================
// Components
// ============================================

function MetricCard({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-sm text-gray-400 mt-1">{trend}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">{icon}</div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

// Simple SVG icons
function ImpressionsIcon() {
  return <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
}
function EngagementsIcon() {
  return <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
}
function FollowersIcon() {
  return <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
}
function TweetsIcon() {
  return <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h4M8 16h4M8 8h4M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
}

// ============================================
// Chart Components (Simple Canvas-based)
// ============================================

function EngagementChart({ data }: { data: Array<{ hour: number; avgEngagementRate: number }> }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Find max rate
    const maxRate = Math.max(...data.map(d => d.avgEngagementRate), 1);

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw Y labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - 2 * padding) * (i / 4);
      const val = (maxRate * (1 - i / 4)).toFixed(2);
      ctx.fillText(val + '%', padding - 8, y);
    }

    // Draw line
    if (data.length > 1) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      data.forEach((point, i) => {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        const y = padding + (height - 2 * padding) * (1 - point.avgEngagementRate / maxRate);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw points
      ctx.fillStyle = '#3b82f6';
      data.forEach((point, i) => {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        const y = padding + (height - 2 * padding) * (1 - point.avgEngagementRate / maxRate);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // X labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = Math.max(1, Math.floor(data.length / 8));
    data.forEach((point, i) => {
      if (i % step === 0 || i === data.length - 1) {
        const x = padding + (width - 2 * padding) * (i / (data.length - 1));
        ctx.fillText(`${point.hour}:00`, x, height - padding + 4);
      }
    });
  }, [data]);

  return <canvas ref={canvasRef} className="w-full h-full" aria-label="Engagement rate over time" />;
}

function HourlyChart({ data }: { data: Array<{ hour: number; avgEngagementRate: number; tweets: number }> }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    const sortedData = [...data].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate).slice(0, 12);
    const maxRate = Math.max(...sortedData.map(d => d.avgEngagementRate), 1);
    const barWidth = (width - 2 * padding) / sortedData.length * 0.8;

    // Draw bars
    sortedData.forEach((point, i) => {
      const x = padding + (width - 2 * padding) * (i / (sortedData.length - 1)) - barWidth / 2;
      const barHeight = (height - 2 * padding) * (point.avgEngagementRate / maxRate);
      const y = height - padding - barHeight;

      // Gradient
      const gradient = ctx.createLinearGradient(0, height - padding, 0, y);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#93c5fd');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Hour label
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${point.hour}:00`, x + barWidth / 2, height - padding + 16);

      // Rate label
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(point.avgEngagementRate.toFixed(2) + '%', x + barWidth / 2, y - 8);
    });
  }, [data]);

  return <canvas ref={canvasRef} className="w-full h-full" aria-label="Best posting hours by engagement rate" />;
}

function TopTweetsTable({ tweets }: { tweets: Array<{ tweetId: string; text: string; createdAt: number; metrics: any; url: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-500">Tweet</th>
            <th className="text-right py-2 px-3 font-medium text-gray-500">Impressions</th>
            <th className="text-right py-2 px-3 font-medium text-gray-500">Eng. Rate</th>
            <th className="text-right py-2 px-3 font-medium text-gray-500">Likes</th>
            <th className="text-right py-2 px-3 font-medium text-gray-500">RTs</th>
            <th className="text-right py-2 px-3 font-medium text-gray-500">Replies</th>
          </tr>
        </thead>
        <tbody>
          {tweets.map((tweet, i) => (
            <tr key={tweet.tweetId} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-3">
                <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block max-w-xs truncate">
                  {tweet.text}
                </a>
                <span className="text-xs text-gray-400">{formatDate(tweet.createdAt)}</span>
              </td>
              <td className="py-3 px-3 text-right text-gray-900 font-medium">{formatNumber(tweet.metrics.impressions)}</td>
              <td className="py-3 px-3 text-right text-blue-600 font-medium">{tweet.metrics.engagementRate.toFixed(2)}%</td>
              <td className="py-3 px-3 text-right text-gray-600">{formatNumber(tweet.metrics.likes)}</td>
              <td className="py-3 px-3 text-right text-gray-600">{formatNumber(tweet.metrics.retweets)}</td>
              <td className="py-3 px-3 text-right text-gray-600">{formatNumber(tweet.metrics.replies)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Utility functions
// ============================================

export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}