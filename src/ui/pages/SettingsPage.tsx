import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface Settings {
  timezone: string;
  date_format: string;
  auto_refresh_enabled: number;
  auto_refresh_interval_minutes: number;
  data_retention_days: number;
  export_format: string;
}

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    auto_refresh_enabled: 1,
    auto_refresh_interval_minutes: 60,
    data_retention_days: 365,
    export_format: 'json',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ syncing: boolean; lastSync: number | null; result: string | null }>({
    syncing: false,
    lastSync: null,
    result: null,
  });

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/analytics/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/analytics/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save');
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to save: ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (type: 'profile' | 'tweets' | 'followers' | 'all') => {
    setSyncStatus({ syncing: true, lastSync: null, result: null });
    try {
      const res = await fetch('/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      setSyncStatus({
        syncing: false,
        lastSync: Date.now(),
        result: `Synced: ${Object.entries(data.results).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
      });
      setMessage({ type: 'success', text: 'Sync completed successfully' });
    } catch (err) {
      setSyncStatus({ syncing: false, lastSync: null, result: `Error: ${(err as Error).message}` });
      setMessage({ type: 'error', text: `Sync failed: ${(err as Error).message}` });
    }
  };

  const handleLogout = () => {
    // Handled by Layout
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Configure your analytics preferences</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Account Info */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="flex items-center gap-4">
          {user?.profile_image_url ? (
            <img src={user.profile_image_url} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-medium text-2xl">{user?.name?.[0] || user?.username?.[0]}</span>
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{user?.name}</h3>
            <p className="text-gray-500">@{user?.username}</p>
            <p className="text-sm text-gray-400">User ID: {user?.id}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-red-600 hover:text-red-700"
          >
            Log Out
          </button>
        </div>
      </section>

      {/* Data Sync */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Synchronization</h2>
        <p className="text-gray-500 mb-4">Fetch latest data from X API. Respects rate limits.</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <button onClick={() => handleSync('profile')} disabled={syncStatus.syncing} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            Sync Profile
          </button>
          <button onClick={() => handleSync('tweets')} disabled={syncStatus.syncing} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            Sync Tweets
          </button>
          <button onClick={() => handleSync('followers')} disabled={syncStatus.syncing} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            Sync Followers
          </button>
          <button onClick={() => handleSync('all')} disabled={syncStatus.syncing} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {syncStatus.syncing ? 'Syncing All...' : 'Sync Everything'}
          </button>
        </div>
        {syncStatus.lastSync && (
          <div className="text-sm text-gray-500">
            Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
            {syncStatus.result && <span className="ml-2 text-gray-700">{syncStatus.result}</span>}
          </div>
        )}
      </section>

      {/* Preferences */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              value={settings.timezone}
              onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (US)</option>
              <option value="America/Chicago">Central Time (US)</option>
              <option value="America/Denver">Mountain Time (US)</option>
              <option value="America/Los_Angeles">Pacific Time (US)</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Australia/Sydney">Sydney</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
            <select
              value={settings.date_format}
              onChange={e => setSettings(s => ({ ...s, date_format: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="YYYY-MM-DD">2024-01-15</option>
              <option value="MM/DD/YYYY">01/15/2024</option>
              <option value="DD/MM/YYYY">15/01/2024</option>
              <option value="MMM D, YYYY">Jan 15, 2024</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Export Format</label>
            <select
              value={settings.export_format}
              onChange={e => setSettings(s => ({ ...s, export_format: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Retention (days)</label>
            <input
              type="number"
              min="30"
              max="3650"
              value={settings.data_retention_days}
              onChange={e => setSettings(s => ({ ...s, data_retention_days: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Auto Refresh */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Auto Refresh</h2>
        <div className="flex items-center gap-4 mb-4">
          <input
            type="checkbox"
            id="auto_refresh"
            checked={settings.auto_refresh_enabled === 1}
            onChange={e => setSettings(s => ({ ...s, auto_refresh_enabled: e.target.checked ? 1 : 0 }))}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="auto_refresh" className="text-sm text-gray-700">
            Automatically refresh data in background
          </label>
        </div>
        <div className="ml-6" style={{ display: settings.auto_refresh_enabled ? 'block' : 'none' }}>
          <label className="block text-sm font-medium text-gray-700 mb-2">Refresh Interval (minutes)</label>
          <input
            type="number"
            min="15"
            max="1440"
            value={settings.auto_refresh_interval_minutes}
            onChange={e => setSettings(s => ({ ...s, auto_refresh_interval_minutes: parseInt(e.target.value) }))}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">Minimum 15 minutes to respect API rate limits</p>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : 'Save Settings'}
          Save Settings
        </button>
      </div>

      {/* Danger Zone */}
      <section className="bg-white rounded-lg shadow p-6 border border-red-200">
        <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
        <p className="text-gray-500 mb-4">These actions are irreversible.</p>
        <button
          onClick={() => {
            if (confirm('This will delete ALL your data (tweets, followers, settings). Are you sure?')) {
              alert('Data deletion not implemented in demo. Would call DELETE /api/analytics/data');
            }
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          Delete All My Data
        </button>
      </section>
    </div>
  );
}