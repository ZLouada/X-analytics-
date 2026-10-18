import { useEffect, useState } from 'react';
import { formatNumber, formatDate } from './DashboardPage';

interface Tweet {
  id: string;
  text: string;
  created_at: number;
  public_metrics: {
    impression_count: number;
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    bookmark_count: number;
  };
  conversation_id: string | null;
  lang: string | null;
}

interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export function TweetsPage() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ limit: 50, offset: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTweets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      });
      const res = await fetch(`/api/analytics/tweets?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tweets');
      const data = await res.json();
      setTweets(data.tweets);
      setPagination(prev => ({ ...prev, total: data.pagination.total }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTweets();
  }, [pagination.offset, pagination.limit]);

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tweets</h1>
          <p className="text-gray-500">All your tweets with performance metrics</p>
        </div>
        <button onClick={fetchTweets} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : tweets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h4M8 16h4M8 8h4M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tweets found</h3>
          <p className="text-gray-500">Sync your data to see tweets here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 border-b">Tweet</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Impressions</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Engagements</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Eng. Rate</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Likes</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Retweets</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Replies</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Date</th>
                </tr>
              </thead>
              <tbody>
                {tweets.map(tweet => {
                  const m = tweet.public_metrics;
                  const engagements = m.like_count + m.retweet_count + m.reply_count + m.quote_count + m.bookmark_count;
                  const rate = m.impression_count > 0 ? (engagements / m.impression_count * 100).toFixed(2) : '0.00';
                  return (
                    <tr key={tweet.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 max-w-2xl">
                        <a href={`https://x.com/i/web/status/${tweet.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block truncate">
                          {tweet.text}
                        </a>
                        {tweet.conversation_id && tweet.conversation_id !== tweet.id && (
                          <span className="text-xs text-gray-400">Part of thread</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 font-medium">{formatNumber(m.impression_count)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(engagements)}</td>
                      <td className="py-3 px-4 text-right text-blue-600 font-medium">{rate}%</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(m.like_count)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(m.retweet_count)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(m.reply_count)}</td>
                      <td className="py-3 px-4 text-right text-gray-500">{formatDate(tweet.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}