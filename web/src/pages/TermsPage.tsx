// PriorityMail — Terms of Service Page
// Production-ready Terms of Service for Google OAuth Verification compliance.

export function TermsPage({ onBack }: { onBack?: () => void }) {
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

      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: 28 }}>
        Effective Date: September 20, 2026 · Last Updated: September 20, 2026
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>1. Acceptance of Terms</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          By creating an account or using PriorityMail, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the service.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>2. Service Description</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          PriorityMail is an automated personal email priority assistant that connects to your authorized Gmail accounts with read-only permissions to classify incoming messages by priority, highlight deadlines and action items, and deliver instant notifications for critical emails.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>3. User Accounts & Security</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          You are responsible for maintaining the confidentiality of your credentials and connected accounts. You may disconnect any connected Gmail account at any time through the application settings.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>4. Permitted Use</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          You agree to use PriorityMail only for lawful personal or business email management purposes. You agree not to reverse-engineer, exploit, or disrupt the application or its underlying APIs.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>5. Disclaimer of Warranties & Limitation of Liability</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          PriorityMail is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Priority classification is automated and heuristic; we do not guarantee 100% accuracy of priority determinations. We are not liable for any missed emails, delays, or damages arising from the use of this service.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>6. Contact Information</h2>
        <p style={{ lineHeight: 1.6, fontSize: '14px', color: '#374151' }}>
          For inquiries or support, contact:{' '}
          <a href="mailto:support@prioritymail.app" style={{ color: '#2563EB' }}>
            support@prioritymail.app
          </a>
        </p>
      </section>
    </div>
  );
}
