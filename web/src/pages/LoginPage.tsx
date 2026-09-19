import { useState } from 'react';
import { useAuth } from '../services/authContext';
import { Icon } from '../components/Icon';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';
import { TermsPage } from './TermsPage';

export function LoginPage() {
  const { login, auth, errorMessage } = useAuth();
  const [view, setView] = useState<'login' | 'privacy' | 'terms'>('login');
  const isLoading = auth.status === 'loading';

  if (view === 'privacy') {
    return <PrivacyPolicyPage onBack={() => setView('login')} />;
  }

  if (view === 'terms') {
    return <TermsPage onBack={() => setView('login')} />;
  }

  const displayError = errorMessage;

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand-mark">
            <Icon name="mail" />
          </span>
          <h1>PriorityMail</h1>
          <p className="login-tagline">Your important emails, without the noise.</p>
        </div>

        {/* Status / Error banner */}
        {displayError && (
          <div
            className="notice"
            role="alert"
            style={{
              marginBottom: 18,
              background: '#fef2f2',
              borderColor: '#fecaca',
              color: '#991b1b',
              fontSize: '12px',
              lineHeight: '1.5',
            }}
          >
            <strong>Connection note:</strong> {displayError}
          </div>
        )}

        {/* Features summary */}
        <ul className="login-features" aria-label="What PriorityMail does">
          <li>
            <span className="feature-dot urgent" />
            Surfaces urgent and time-sensitive emails first
          </li>
          <li>
            <span className="feature-dot high" />
            VIP contacts always rise to the top
          </li>
          <li>
            <span className="feature-dot normal" />
            Connect multiple Gmail accounts in one place
          </li>
        </ul>

        {/* CTA */}
        <button
          id="login-google-btn"
          type="button"
          className="login-google-btn"
          onClick={login}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <span className="login-spinner" aria-label="Loading…" />
          ) : (
            <GoogleIcon />
          )}
          {isLoading ? 'Checking session…' : 'Continue with Google'}
        </button>

        <p className="login-footnote">
          Signing in lets you connect Gmail accounts inside the app.
          <br />
          PriorityMail requests read-only access — we never send, delete,
          or modify your emails.
        </p>

        <div style={{ marginTop: 14, display: 'flex', gap: 12, justifyContent: 'center', fontSize: '11px' }}>
          <button
            type="button"
            onClick={() => setView('privacy')}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            Privacy Policy
          </button>
          <span style={{ color: '#D1D5DB' }}>·</span>
          <button
            type="button"
            onClick={() => setView('terms')}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            Terms of Service
          </button>
        </div>
      </div>

      {/* Decorative gradient orbs */}
      <div className="login-orb login-orb-1" aria-hidden="true" />
      <div className="login-orb login-orb-2" aria-hidden="true" />
    </div>
  );
}

/** Google's official "G" logo SVG (safe to use per Google Brand Guidelines). */
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
