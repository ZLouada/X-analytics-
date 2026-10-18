import { useEffect, useState } from 'react';
import { formatNumber, formatDate } from './DashboardPage';

interface Snapshot {
  id: string;
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
  followers_gained: number;
  followers_lost: number;
  net_followers_change: number;
  created_at: number;
}

export function ReportsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/history?limit=50', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setSnapshots(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format });
      if (customRange.start && customRange.end) {
        params.append('start', String(new Date(customRange.start).getTime()));
        params.append('end', String(new Date(customRange.end).getTime()));
      } else {
        params.append('period', period);
      }
      const res = await fetch(`/api/analytics/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.split('filename=')[1]?.replace(/"/g, '') || `report.${format}`;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleFullExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (!confirm(`Export ALL data as ${format.toUpperCase()}? This may take a while.`)) return;
    setExporting(`${format}-full`);
    try {
      const res = await fetch(`/api/analytics/export/all?format=${format}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Full export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.split('filename=')[1]?.replace(/"/g, '') || `full-export.${format}`;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Full export failed: ${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Exports</h1>
        <p className="text-gray-500">Generate and download analytics reports</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as '7d' | '30d' | '90d')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom Start Date</label>
            <input
              type="date"
              value={customRange.start}
              onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom End Date</label>
            <input
              type="date"
              value={customRange.end}
              onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {exporting === 'json' ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
            ) : 'JSON'}
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {exporting === 'csv' ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
            ) : 'CSV'}
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {exporting === 'pdf' ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
            ) : 'PDF'}
            Export PDF
          </button>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-medium text-gray-900 mb-3">Full Data Export</h3>
          <p className="text-sm text-gray-500 mb-4">Export all tweets, followers, and raw data (larger files)</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleFullExport('json')}
              disabled={exporting !== null}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'json-full' ? 'Exporting...' : 'Full JSON'}
            </button>
            <button
              onClick={() => handleFullExport('csv')}
              disabled={exporting !== null}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'csv-full' ? 'Exporting...' : 'Full CSV'}
            </button>
            <button
              onClick={() => handleFullExport('pdf')}
              disabled={exporting !== null}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'pdf-full' ? 'Exporting...' : 'Full PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Historical Snapshots */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Report History</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center">
            <svg className="animate-spin w-8 h-8 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">No reports generated yet. Create a report above to see history.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 border-b">Period</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Tweets</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Impressions</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Engagements</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Eng. Rate</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 border-b">Followers Δ</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 border-b">Generated</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map(snapshot => (
                  <tr key={snapshot.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">
                        {formatDate(snapshot.period_start)} - {formatDate(snapshot.period_end)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.ceil((snapshot.period_end - snapshot.period_start) / (1000 * 60 * 60 * 24))} days
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">{formatNumber(snapshot.tweets_count)}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{formatNumber(snapshot.total_impressions)}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{formatNumber(snapshot.total_engagements)}</td>
                    <td className="py-3 px-4 text-right text-blue-600 font-medium">{snapshot.avg_engagement_rate.toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right">
                      {snapshot.net_followers_change >= 0 ? (
                        <span className="text-green-600">+{formatNumber(snapshot.net_followers_change)}</span>
                      ) : (
                        <span className="text-red-600">{formatNumber(snapshot.net_followers_change)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{formatDate(snapshot.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}