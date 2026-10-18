import { useEffect, useState } from 'react';
import { formatNumber, formatDate } from './DashboardPage';

interface Follower {
  id: string;
  username: string;
  name: string | null;
  description: string | null;
  profile_image_url: string | null;
  verified: number;
  location: string | null;
  url: string | null;
  protected: number;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  } | null;
}

interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export function FollowersPage() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ limit: 50, offset: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchFollowers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      });
      const res = await fetch(`/api/analytics/followers?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch followers');
      const data = await res.json();
      setFollowers(data.followers);
      setPagination(prev => ({ ...prev, total: data.pagination.total }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowers();
  }, [pagination.offset, pagination.limit]);

  const filteredFollowers = followers.filter(f =>
    f.username.toLowerCase().includes(search.toLowerCase()) ||
    (f.name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Followers</h1>
          <p className="text-gray-500">Your audience — {formatNumber(pagination.total)} followers</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search followers..."
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <button onClick={fetchFollowers} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
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
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredFollowers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{search ? 'No matching followers' : 'No followers found'}</h3>
          <p className="text-gray-500">Sync your data to see followers here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 border-b">Follower</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 border-b">Location</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Followers</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Following</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Tweets</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 border-b">Verified</th>
                </tr>
              </thead>
              <tbody>
                {filteredFollowers.map(follower => (
                  <tr key={follower.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <a href={`https://x.com/${follower.username}`} target="_blank" rel="noopener noreferrer">
                          {follower.profile_image_url ? (
                            <img src={follower.profile_image_url} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-700 font-medium">{follower.username[0]}</span>
                            </div>
                          )}
                        </a>
                        <div>
                          <a href={`https://x.com/${follower.username}`} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-blue-600">
                            @{follower.username}
                          </a>
                          {follower.name && (
                            <p className="text-sm text-gray-500">{follower.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{follower.location || '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{follower.public_metrics ? formatNumber(follower.public_metrics.followers_count) : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{follower.public_metrics ? formatNumber(follower.public_metrics.following_count) : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{follower.public_metrics ? formatNumber(follower.public_metrics.tweet_count) : '—'}</td>
                    <td className="py-3 px-4">
                      {follower.verified ? (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 12.586 7.707 11.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          Verified
                        </span>
                      ) : follower.protected ? (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                          Protected
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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