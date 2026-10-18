import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const { checkAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    const authError = searchParams.get('error');
    if (authError) {
      const messages: Record<string, string> = {
        invalid_session: 'Your session expired. Please try again.',
        no_code: 'Authentication failed. Please try again.',
        state_mismatch: 'Security check failed. Please try again.',
      };
      setError(messages[authError] || `Authentication failed: ${authError}`);
    }

    const success = searchParams.get('auth');
    if (success === 'success') {
      checkAuth();
    }
  }, [searchParams, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">X Analytics Free</h1>
          <p className="text-gray-600 mt-2">Free, self-hosted analytics for your X account</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={() => window.location.href = '/auth/login'}
          className="w-full py-3 px-6 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Sign in with X (Twitter)
        </button>

        {/* Features */}
        <details className="mt-8" open={showFeatures} onToggle={() => setShowFeatures(!showFeatures)}>
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium">
            Why use X Analytics Free?
          </summary>
          <ul className="mt-4 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span><strong>100% Free</strong> — No subscriptions, no hidden costs. Run it yourself.</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span><strong>Your Data, Your Control</strong> — Runs on your machine. We never see your tokens or tweets.</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span><strong>Official API Only</strong> — Uses X's official API v2 with your explicit permission via OAuth 2.0.</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span><strong>Open Source</strong> — MIT licensed. Audit the code, contribute, self-host anywhere.</span>
            </li>
          </ul>
        </details>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-400">
          Not affiliated with X Corp. Uses official X API with your permission.
          <br />
          <a href="https://github.com/yourusername/x-analytics-free" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}