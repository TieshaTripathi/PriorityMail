// PriorityMail — Privacy Policy Page
// Production-ready Privacy Policy for Google OAuth Verification compliance.

export function PrivacyPolicyPage({ onBack }: { onBack?: () => void }) {
  return (
    <div className="legal-page" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px', color: '#1F2937' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom: 20,
            background: 'none',
            border: 'none',
            color: '#2563EB',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            padding: 0,
          }}
        >
          ← Back to PriorityMail
        </button>
      )}

      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: 28 }}>
        Effective Date: September 20, 2026 · Last Updated: September 20, 2026
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>1. Introduction</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          PriorityMail (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a personal email priority assistant designed to help users identify important and actionable emails without noise. We are committed to protecting your privacy and being transparent about our data practices.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>2. Google API Data Usage & Scopes</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151', marginBottom: 12 }}>
          PriorityMail requests the following minimum read-only permissions through Google OAuth:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
          <li>
            <strong>https://www.googleapis.com/auth/gmail.readonly:</strong> Used solely to retrieve message headers, snippets, and labels to calculate priority scores, detect action items, and surface deadlines.
          </li>
          <li>
            <strong>https://www.googleapis.com/auth/gmail.labels:</strong> Used to read mailbox labels (e.g. INBOX, IMPORTANT) to match user-configured priority rules.
          </li>
          <li>
            <strong>openid, email, profile:</strong> Used for PriorityMail user authentication and account identification.
          </li>
        </ul>
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#EFF6FF', borderRadius: 8, borderLeft: '4px solid #2563EB' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#1E40AF', lineHeight: 1.5 }}>
            <strong>Zero Send/Modify/Delete Permissions:</strong> PriorityMail NEVER requests permission to compose, send, modify, or delete your emails. We cannot send messages on your behalf or delete anything from your mailbox.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>3. How We Use and Store Your Information</h2>
        <ul style={{ paddingLeft: 20, fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
          <li>
            <strong>Encrypted Credentials:</strong> Gmail OAuth refresh tokens are encrypted on the server using AES-256-GCM encryption with backend-only secret keys. They are never transmitted to client devices or third parties.
          </li>
          <li>
            <strong>Email Metadata Only:</strong> We store normalized message metadata (message ID, thread ID, sender, subject, snippet, timestamp, classification score, priority level, and reason tags) to power your Priority Inbox and push notifications. Full email message bodies are not permanently retained.
          </li>
          <li>
            <strong>No Data Selling or Advertising:</strong> We DO NOT sell, rent, or transfer your email data or personal information to third-party data brokers or advertising networks.
          </li>
          <li>
            <strong>No Human Review:</strong> No human reads or inspects your emails. Email classification is performed automatically using deterministic, rule-based heuristics.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>4. Google API Limited Use Requirements</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          PriorityMail&apos;s use and transfer of information received from Google APIs to any other app will adhere to{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563EB', textDecoration: 'underline' }}
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>5. Data Retention & Deletion Instructions</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151', marginBottom: 12 }}>
          You retain full control over your connected accounts and data at all times:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
          <li>
            <strong>Disconnecting a Mailbox:</strong> Navigate to <em>Settings → Connected Gmail Accounts</em> and click <strong>Disconnect</strong>. This immediately revokes the OAuth token with Google and purges all stored credentials, watch subscriptions, and associated metadata for that mailbox from our database.
          </li>
          <li>
            <strong>Account Deletion:</strong> To request complete deletion of your PriorityMail account and all associated data, contact us at{' '}
            <a href="mailto:support@prioritymail.app" style={{ color: '#2563EB' }}>
              support@prioritymail.app
            </a>
            . All user records will be deleted within 48 hours.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>6. Contact Us</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          If you have questions about this Privacy Policy or our security practices, please contact us at:
          <br />
          <strong>PriorityMail Support:</strong>{' '}
          <a href="mailto:support@prioritymail.app" style={{ color: '#2563EB' }}>
            support@prioritymail.app
          </a>
        </p>
      </section>
    </div>
  );
}
