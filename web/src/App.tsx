import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { EmailCard, PriorityBadge } from './components/EmailCard';
import { Icon, type IconName } from './components/Icon';
import { Modal } from './components/Modal';
import { defaultMockRules, defaultVipPeople, initialMockEmails } from './services/mockData';
import { useStored } from './services/storage';
import { gmailWebUrl, openEmailInGmail } from './services/gmailDeepLink';
import {
  enablePushNotifications,
  triggerTestPush,
  getExistingPushSubscription,
  type NotificationPreferences,
} from './services/notifications';
import type { PriorityRule, PriorityRuleType, VipPerson, PrioritySensitivity, PriorityEmail } from './types';
import { AuthProvider, useAuth } from './services/authContext';
import { LoginPage } from './pages/LoginPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { ConnectedAccountsList } from './components/ConnectedAccountsList';
import {
  getConnectedAccounts,
  fetchGmailMessages,
  fetchAllGmailMessages,
  syncGmailAccount,
  syncAllGmailAccounts,
  startConnectGmailAccount,
  getUserSettings,
  updateUserSettings,
  type ConnectedAccountDto,
  type GmailEmailDto,
} from './services/apiClient';

const tabs = [
  ['inbox', 'Priority Inbox', 'inbox'],
  ['all', 'All Emails', 'mail'],
  ['rules', 'Rules', 'rules'],
  ['people', 'VIP People', 'star'],
  ['settings', 'Settings', 'settings'],
] as const;

type Tab = typeof tabs[number][0];

const ruleTypes: { value: PriorityRuleType; label: string }[] = [
  { value: 'label', label: 'Gmail label' },
  { value: 'sender', label: 'Sender email' },
  { value: 'domain', label: 'Sender domain' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'subject_keyword', label: 'Subject keyword' },
  { value: 'vip', label: 'VIP person' },
];

type Settings = NotificationPreferences & { sensitivity: PrioritySensitivity; showDevDemo?: boolean };
const defaults: Settings = {
  notifications: true,
  aiClassification: true,
  deadlineAlerts: true,
  vipAlerts: true,
  quietHours: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  sensitivity: 'Balanced',
  showDevDemo: false,
};

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const validRules = (x: unknown): x is PriorityRule[] =>
  Array.isArray(x) &&
  x.every(
    r =>
      record(r) &&
      typeof r.id === 'string' &&
      typeof r.value === 'string' &&
      typeof r.enabled === 'boolean' &&
      ruleTypes.some(t => t.value === r.type) &&
      (r.weight === undefined || typeof r.weight === 'number'),
  );
const validPeople = (x: unknown): x is VipPerson[] =>
  Array.isArray(x) &&
  x.every(p => record(p) && ['id', 'name', 'email', 'category'].every(k => typeof p[k] === 'string'));
const validIds = (x: unknown): x is string[] => Array.isArray(x) && x.every(i => typeof i === 'string');
const validSnoozes = (x: unknown): x is Record<string, string> =>
  record(x) && Object.values(x).every(v => typeof v === 'string' && Number.isFinite(Date.parse(v)));
const validSettings = (x: unknown): x is Settings =>
  record(x) &&
  ['notifications', 'aiClassification', 'deadlineAlerts', 'vipAlerts', 'quietHours'].every(
    k => typeof x[k] === 'boolean',
  ) &&
  ['Low', 'Balanced', 'High'].includes(String(x.sensitivity)) &&
  ['quietStart', 'quietEnd'].every(k => typeof x[k] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x[k] as string));

const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function route() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('email/')) {
    try {
      return { tab: 'inbox' as Tab, detail: decodeURIComponent(hash.slice(6)) };
    } catch {
      return { tab: 'inbox' as Tab, detail: '' };
    }
  }
  return { tab: tabs.some(t => t[0] === hash) ? (hash as Tab) : ('inbox' as Tab), detail: '' };
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input className="switch" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="check" />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

function formatReceivedAt(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${Math.max(1, diffMin)} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    if (diffHr < 48) return 'Yesterday';
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

function gmailDtoToEmail(dto: GmailEmailDto): PriorityEmail {
  const hasDeadline = dto.reasons?.some(r => r.toLowerCase().includes('deadline'));
  return {
    id: dto.id || dto.gmailMessageId,
    accountId: dto.accountId,
    accountEmail: dto.accountEmail,
    gmailMessageId: dto.gmailMessageId,
    gmailThreadId: dto.gmailThreadId,
    senderName: dto.senderName,
    senderEmail: dto.senderEmail,
    subject: dto.subject,
    snippet: dto.snippet,
    body: dto.body,
    receivedAt: formatReceivedAt(dto.receivedAt),
    labelIds: dto.labelIds || [],
    isRead: dto.isRead,
    isImportant:
      dto.isImportant ??
      (dto.priority === 'urgent' || dto.priority === 'high' || (dto.labelIds && dto.labelIds.includes('IMPORTANT'))),
    isCompleted: false,
    snoozedUntil: null,
    priority: dto.priority,
    category: (dto.category?.toLowerCase() || 'personal') as PriorityEmail['category'],
    actionRequired: dto.actionRequired,
    reason: dto.reason,
    reasons: dto.reasons && dto.reasons.length > 0 ? dto.reasons : [dto.reason || 'Flagged by PriorityMail'],
    score: dto.score,
    deadline: hasDeadline ? 'Deadline detected' : undefined,
  };
}

// ----------------------------------------------------------------
// Inner app (rendered only when authenticated)
// ----------------------------------------------------------------
function AppInner() {
  const { auth, logout } = useAuth();
  const user = auth.status === 'authenticated' ? auth.user : null;

  const [location, setLocation] = useState(route);
  const [rules, setRules, rulesError] = useStored('rules', defaultMockRules, validRules);
  const [people, setPeople, peopleError] = useStored('people', defaultVipPeople, validPeople);
  const [settings, setSettings, settingsError] = useStored('settings', defaults, validSettings);
  const [done, setDone, doneError] = useStored<string[]>('done', [], validIds);
  const [read, setRead, readError] = useStored<string[]>('read', [], validIds);
  const [snoozes, setSnoozes, snoozeError] = useStored<Record<string, string>>('snoozes', {}, validSnoozes);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [account, setAccount] = useState('all');
  const [status, setStatus] = useState('all');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'rule' | 'person' | 'install' | 'reset' | 'privacy' | 'terms' | null>(null);
  const [snoozeId, setSnoozeId] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountDto[]>([]);
  const [gmailEmails, setGmailEmails] = useState<GmailEmailDto[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailError, setGmailError] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  const tab = location.tab;

  const fetchRealEmails = async (targetAccountId: string = account) => {
    setGmailLoading(true);
    setGmailError('');
    try {
      if (targetAccountId === 'all') {
        const result = await fetchAllGmailMessages(30);
        setGmailEmails(result.emails);
        if (result.emails.length > 0) {
          setToast(`Synced ${result.emails.length} emails across connected accounts.`);
        }
      } else {
        const result = await fetchGmailMessages(targetAccountId, 25);
        setGmailEmails(result.emails);
        setToast(`Synced ${result.emails.length} emails from ${result.accountEmail}.`);
      }
    } catch (err) {
      console.error('[App] fetchRealEmails error:', err);
      setGmailError(err instanceof Error ? err.message : 'Could not fetch Gmail messages.');
    } finally {
      setGmailLoading(false);
    }
  };

  const handleManualSync = async () => {
    setGmailSyncing(true);
    setGmailError('');
    try {
      if (account === 'all') {
        const res = await syncAllGmailAccounts();
        setToast(`Synced ${res.count} emails from Gmail.`);
      } else {
        const res = await syncGmailAccount(account);
        setToast(`Synced ${res.count} emails from Gmail.`);
      }
      await fetchRealEmails(account);
    } catch (err) {
      console.error('[App] Manual sync error:', err);
      setToast('Sync failed. Please verify your connection or reconnect in Settings.');
      setGmailError('Manual sync failed.');
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleConnectGmail = async () => {
    setConnectingGoogle(true);
    try {
      const url = await startConnectGmailAccount();
      window.location.assign(url);
    } catch {
      setToast('Could not start Gmail connection. Check backend connection.');
      setConnectingGoogle(false);
    }
  };

  // Load connected accounts and push/settings state on mount
  useEffect(() => {
    getConnectedAccounts()
      .then(accounts => {
        setConnectedAccounts(accounts);
        if (accounts.length > 0) {
          fetchRealEmails('all');
        }
      })
      .catch(err => {
        console.warn('[App] getConnectedAccounts error:', err);
      });

    getExistingPushSubscription()
      .then(sub => setPushActive(Boolean(sub)))
      .catch(() => {});

    getUserSettings()
      .then(serverSettings => {
        if (serverSettings) {
          setSettings(prev => ({
            ...prev,
            notifications: serverSettings.notifications,
            vipAlerts: serverSettings.vipAlerts,
            deadlineAlerts: serverSettings.deadlineAlerts,
            actionAlerts: serverSettings.actionAlerts,
            sensitivity: serverSettings.sensitivity,
            quietHours: serverSettings.quietHours,
            quietStart: serverSettings.quietStart,
            quietEnd: serverSettings.quietEnd,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Handle ?connect_success=1 or error from Gmail OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect_success') === '1') {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setToast('Gmail account connected! Fetching your real messages…');
      getConnectedAccounts()
        .then(accounts => {
          setConnectedAccounts(accounts);
          if (accounts.length > 0) {
            fetchRealEmails('all');
          }
        })
        .catch(() => {});
    }
    if (params.get('connect_error')) {
      const errCode = params.get('connect_error');
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setToast(`Gmail connection failed (${errCode}). Please try again.`);
    }
  }, []);

  useEffect(() => {
    const change = () => {
      setLocation(route());
      window.scrollTo(0, 0);
    };
    const connection = () => setOnline(navigator.onLine);
    const refresh = () => setNow(Date.now());
    const install = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt: () => Promise<void> });
    };
    const updated = () => setUpdateReady(true);
    const failed = () => setOfflineError(true);
    window.addEventListener('hashchange', change);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('prioritymail-update', updated);
    window.addEventListener('prioritymail-offline-error', failed);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('hashchange', change);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('prioritymail-update', updated);
      window.removeEventListener('prioritymail-offline-error', failed);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.title = `${location.detail ? 'Email' : tabs.find(t => t[0] === tab)?.[1]} · PriorityMail`;
  }, [tab, location.detail]);

  // STRICT RULE: No automatic mock emails in production.
  // Mocks appear ONLY if explicitly enabled in local development mode.
  const isDev = import.meta.env.DEV;
  const allowDevMocks = isDev && settings.showDevDemo;

  const baseEmails: PriorityEmail[] = useMemo(() => {
    if (connectedAccounts.length > 0 && gmailEmails.length > 0) {
      return gmailEmails.map(gmailDtoToEmail).map(e => ({
        ...e,
        isCompleted: done.includes(e.id),
        isRead: read.includes(e.id) || e.isRead,
        snoozedUntil: snoozes[e.id] && Date.parse(snoozes[e.id]) > now ? snoozes[e.id] : null,
      }));
    }
    if (allowDevMocks) {
      return initialMockEmails.map(e => ({
        ...e,
        isCompleted: done.includes(e.id),
        isRead: read.includes(e.id) || e.isRead,
        snoozedUntil: snoozes[e.id] && Date.parse(snoozes[e.id]) > now ? snoozes[e.id] : null,
      }));
    }
    return [];
  }, [connectedAccounts.length, gmailEmails, allowDevMocks, done, read, snoozes, now]);

  // Account filtering
  const emailsForAccount = useMemo(() => {
    if (account === 'all') return baseEmails;
    return baseEmails.filter(
      e =>
        e.accountId === account ||
        ('connectedAccountId' in e && (e as unknown as { connectedAccountId: string }).connectedAccountId === account) ||
        e.accountEmail.toLowerCase() === account.toLowerCase(),
    );
  }, [baseEmails, account]);

  // Priority Inbox messages (urgent, high, action required, uncompleted, unsnoozed)
  const activePriorityEmails = useMemo(() => {
    return emailsForAccount.filter(
      e => !e.isCompleted && !e.snoozedUntil && (e.priority === 'urgent' || e.priority === 'high' || e.actionRequired),
    );
  }, [emailsForAccount]);

  // Metrics from REAL data
  const statsMetrics = useMemo(() => {
    const unread = emailsForAccount.filter(e => !e.isRead && !e.isCompleted).length;
    const important = emailsForAccount.filter(
      e => (e.isImportant || e.priority === 'urgent' || e.priority === 'high') && !e.isCompleted,
    ).length;
    const needsAttention = activePriorityEmails.length;
    const urgent = emailsForAccount.filter(e => e.priority === 'urgent' && !e.isCompleted).length;
    const deadlines = emailsForAccount.filter(e => Boolean(e.deadline) && !e.isCompleted).length;
    return { unread, important, needsAttention, urgent, deadlines };
  }, [emailsForAccount, activePriorityEmails]);

  // Visible emails for the current tab with filters applied
  const visible = useMemo(() => {
    const pool = tab === 'inbox' ? activePriorityEmails : emailsForAccount;
    return pool.filter(e => {
      if (filter !== 'all' && e.category !== filter) return false;
      if (status === 'done') {
        if (!e.isCompleted) return false;
      } else if (status === 'snoozed') {
        if (!e.snoozedUntil) return false;
      } else if (status === 'unread') {
        if (e.isRead || e.isCompleted) return false;
      } else if (status === 'important') {
        if (!(e.isImportant || e.priority === 'urgent' || e.priority === 'high')) return false;
      } else if (status === 'active') {
        if (e.isCompleted || e.snoozedUntil) return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const text = `${e.subject} ${e.senderName} ${e.senderEmail} ${e.snippet}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [tab, activePriorityEmails, emailsForAccount, filter, status, search]);

  const selected = baseEmails.find(e => e.id === location.detail);

  const complete = (id: string) => {
    setDone(ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]));
    setToast(done.includes(id) ? 'Moved back to your inbox.' : 'Marked done.');
  };

  const open = (id: string) => {
    setRead(ids => (ids.includes(id) ? ids : [...ids, id]));
    window.location.hash = `email/${encodeURIComponent(id)}`;
  };

  const navigate = (next: Tab) => {
    setSearch('');
    setFilter('all');
    setStatus('all');
    window.location.hash = next;
  };

  const closeDetail = () => {
    window.location.hash = tab === 'all' ? 'all' : 'inbox';
  };

  const snooze = (date: Date) => {
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setToast('Choose a future time.');
      return;
    }
    setSnoozes(s => ({ ...s, [snoozeId]: date.toISOString() }));
    setSnoozeId('');
    setToast("Snoozed. You'll find it in All Emails until then.");
  };

  const addRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get('value')).trim();
    if (!value) return;
    setRules(r => [
      ...r,
      { id: newId(), type: String(form.get('type')) as PriorityRuleType, value, enabled: true, weight: 4 },
    ]);
    setModal(null);
    setToast('Rule added. Your inbox has been reprioritized.');
  };

  const addPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name')).trim(),
      email = String(form.get('email')).trim().toLowerCase();
    if (!name || !email) return;
    if (people.some(p => p.email.toLowerCase() === email)) {
      setToast('This person is already in your VIP list.');
      return;
    }
    setPeople(p => [...p, { id: newId(), name, email, category: String(form.get('category')) }]);
    setModal(null);
    setToast('VIP added. Their messages will always stand out.');
  };

  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(s => ({ ...s, [key]: value }));
    updateUserSettings({ [key]: value } as any).catch(err =>
      console.warn('[App] updateUserSettings error:', err),
    );
  };

  const storageError = rulesError || peopleError || settingsError || doneError || readError || snoozeError;
  const greeting =
    new Date(now).getHours() < 12 ? 'Good morning' : new Date(now).getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const userName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inbox">
          <span className="brand-mark">
            <Icon name="mail" />
          </span>
          PriorityMail
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connectedAccounts.length > 0 && (
            <button
              type="button"
              className="text-button blue"
              style={{ minHeight: 34, padding: '5px 12px', fontSize: 12, background: '#eef3ff', borderRadius: 10 }}
              onClick={handleManualSync}
              disabled={gmailLoading || gmailSyncing}
              aria-label="Sync all connected Gmail accounts"
            >
              <Icon name="refresh" />
              <span>{gmailSyncing ? 'Syncing…' : 'Sync'}</span>
            </button>
          )}
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              width={34}
              height={34}
              style={{ borderRadius: '50%', cursor: 'pointer', border: '2px solid #fff', boxShadow: '0 2px 6px #0002' }}
              referrerPolicy="no-referrer"
              onClick={() => navigate('settings')}
            />
          ) : (
            <button className="profile" aria-label="Open Settings" onClick={() => navigate('settings')}>
              {(user?.displayName?.[0] ?? 'U').toUpperCase()}
            </button>
          )}
        </div>
      </header>

      <main>
        {!online && <div className="notice">You're offline. Your saved inbox and rules are available.</div>}
        {storageError && (
          <div className="notice" role="alert">
            Storage is unavailable. Changes will last for this session only.
          </div>
        )}
        {offlineError && (
          <div className="notice" role="alert">
            Offline setup failed. Reconnect and reload to try again.
          </div>
        )}
        {updateReady && (
          <div className="notice">An update is ready. Close all PriorityMail windows and reopen to update.</div>
        )}

        {(tab === 'inbox' || tab === 'all') && (
          <>
            <section className="page-heading">
              <div className="eyebrow">
                {tab === 'inbox' ? 'A LITTLE FOCUS. A LOT LESS NOISE.' : 'EVERY ACCOUNT, ONE PLACE'}
              </div>
              <h1>
                {tab === 'inbox' ? (
                  <>
                    {greeting},
                    <br />
                    {userName} <span className="hello">✦</span>
                  </>
                ) : (
                  'All Emails'
                )}
              </h1>
              <p>
                {tab === 'inbox'
                  ? 'Your important emails, without the noise.'
                  : 'Find what you need. Leave the rest for later.'}
              </p>
            </section>

            {/* ONBOARDING STATE: When NO Gmail account is connected */}
            {connectedAccounts.length === 0 && !allowDevMocks && (
              <div
                className="simple-card"
                style={{
                  padding: 24,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f4f7ff 100%)',
                  border: '1.5px solid #dbe5ff',
                  borderRadius: 20,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: '#315ff4',
                    color: 'white',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 16px',
                    boxShadow: '0 6px 16px #315ff433',
                  }}
                >
                  <Icon name="mail" />
                </div>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>Connect Gmail to load your inbox</h2>
                <p style={{ fontSize: 13, color: '#687796', lineHeight: 1.6, margin: '0 auto 20px', maxWidth: 360 }}>
                  PriorityMail uses read-only access to analyze, classify, and prioritize your emails. Connect your
                  Google account to get started.
                </p>
                <button
                  className="primary full"
                  onClick={handleConnectGmail}
                  disabled={connectingGoogle}
                  style={{ maxWidth: 280, margin: '0 auto' }}
                >
                  <Icon name="plus" />
                  {connectingGoogle ? 'Opening Google…' : 'Connect Gmail Account'}
                </button>
              </div>
            )}

            {/* ERROR BANNER: Real Gmail fetch failure */}
            {gmailError && (
              <div
                className="notice"
                role="alert"
                style={{
                  background: '#fef2f2',
                  borderColor: '#fecaca',
                  color: '#991b1b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <div>
                  <strong>Gmail sync error</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 12 }}>{gmailError}</p>
                </div>
                <button
                  className="secondary"
                  style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => fetchRealEmails(account)}
                  disabled={gmailLoading}
                >
                  Retry
                </button>
              </div>
            )}

            {/* REAL ACCOUNT-AWARE SUMMARY STATS (Section 5) */}
            {connectedAccounts.length > 0 && (
              <section className="stats-5" aria-label="Inbox real summary" style={{ marginBottom: 18 }}>
                <div className="stat stat-0">
                  <Icon name="inbox" />
                  <strong>{statsMetrics.needsAttention}</strong>
                  <span>Needs attention</span>
                </div>
                <div className="stat stat-1">
                  <Icon name="bell" />
                  <strong>{statsMetrics.urgent}</strong>
                  <span>Urgent</span>
                </div>
                <div className="stat stat-2">
                  <Icon name="clock" />
                  <strong>{statsMetrics.deadlines}</strong>
                  <span>Deadlines</span>
                </div>
                <div className="stat stat-3">
                  <Icon name="star" />
                  <strong>{statsMetrics.important}</strong>
                  <span>Important</span>
                </div>
                <div className="stat stat-4">
                  <Icon name="mail" />
                  <strong>{statsMetrics.unread}</strong>
                  <span>Unread</span>
                </div>
              </section>
            )}

            {/* CONNECTED ACCOUNT SELECTOR (All Accounts vs Individual) */}
            {connectedAccounts.length > 0 && (
              <div style={{ margin: '0 0 16px' }}>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: 11, color: '#687796', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Gmail Account
                  </span>
                  <select
                    value={account}
                    onChange={e => {
                      const newAcc = e.target.value;
                      setAccount(newAcc);
                      fetchRealEmails(newAcc);
                    }}
                    style={{ fontSize: 13 }}
                  >
                    <option value="all">All Accounts ({connectedAccounts.length} connected)</option>
                    {connectedAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.email} {a.isPrimary ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* SECTION HEADING & CONTROLS */}
            <div className="section-title">
              <h2>{tab === 'inbox' ? 'Priority list' : 'All Messages'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {connectedAccounts.length > 0 && (
                  <button
                    type="button"
                    className="text-button blue"
                    style={{ minHeight: 30, padding: '2px 8px', fontSize: 11, background: '#eef3ff', borderRadius: 8 }}
                    onClick={handleManualSync}
                    disabled={gmailLoading || gmailSyncing}
                    aria-label="Sync"
                  >
                    <Icon name="refresh" />
                    <span>{gmailSyncing ? 'Syncing…' : 'Sync'}</span>
                  </button>
                )}
                <span>{visible.length} emails</span>
              </div>
            </div>

            {gmailLoading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  background: '#f5f8ff',
                  borderRadius: 12,
                  margin: '10px 0',
                  fontSize: 12,
                  color: '#325df4',
                }}
              >
                <span className="login-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span>Fetching real Gmail messages…</span>
              </div>
            )}

            {/* SEARCH & FILTERS */}
            {tab === 'all' && (
              <label className="search">
                <Icon name="search" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search sender, subject or snippet"
                  aria-label="Search emails"
                />
              </label>
            )}

            <div className="filter-row" aria-label="Filter category">
              {['all', 'work', 'college', 'internship', 'academic', 'personal'].map(c => (
                <button
                  key={c}
                  className={`chip ${filter === c ? 'selected' : ''}`}
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                >
                  {c === 'all' ? 'All categories' : c}
                </button>
              ))}
            </div>

            {tab === 'all' && (
              <div className="select-row" style={{ marginTop: 4, marginBottom: 14 }}>
                <label>
                  Filter Status
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="all">All status</option>
                    <option value="unread">Unread</option>
                    <option value="important">Important</option>
                    <option value="active">Active</option>
                    <option value="done">Completed</option>
                    <option value="snoozed">Snoozed</option>
                  </select>
                </label>
              </div>
            )}

            {/* EMAIL LIST */}
            <div className="email-list">
              {visible.map(email => (
                <EmailCard
                  key={email.id}
                  email={email}
                  onOpen={() => open(email.id)}
                  onDone={() => complete(email.id)}
                  onSnooze={() => setSnoozeId(email.id)}
                />
              ))}
            </div>

            {visible.length === 0 && !gmailLoading && (
              <EmptyState
                title={tab === 'inbox' ? 'All caught up' : 'No messages found'}
                body={
                  connectedAccounts.length === 0
                    ? 'Connect a Gmail account to view and prioritize your real messages.'
                    : tab === 'inbox'
                      ? 'No urgent or high-priority emails right now. Check All Emails to see all messages.'
                      : 'No emails match your filter or search query.'
                }
                action={
                  connectedAccounts.length === 0 ? (
                    <button className="primary" onClick={handleConnectGmail} disabled={connectingGoogle}>
                      <Icon name="plus" /> Connect Gmail
                    </button>
                  ) : undefined
                }
              />
            )}

            {connectedAccounts.length > 0 && (
              <p className="demo-caption">REAL GMAIL · DETERMINISTIC PRIORITY ENGINE · READ-ONLY OAUTH</p>
            )}
            {allowDevMocks && (
              <p className="demo-caption" style={{ color: '#d97706' }}>
                DEV DEMO MODE ACTIVE · LOCAL MOCK DATA
              </p>
            )}
          </>
        )}

        {tab === 'rules' && (
          <>
            <section className="page-heading">
              <div className="eyebrow">YOUR INBOX, YOUR CALL</div>
              <h1>Priority rules</h1>
              <p>Teach your inbox what matters to you.</p>
            </section>
            <button className="primary full" onClick={() => setModal('rule')}>
              <Icon name="plus" />
              Add priority rule
            </button>
            <div className="section-title">
              <h2>Your rules</h2>
              <span>{rules.filter(r => r.enabled).length} enabled</span>
            </div>
            {rules.map(rule => (
              <article className="simple-card" key={rule.id}>
                <div className="rule-top">
                  <span className="mini-icon">
                    <Icon name="rules" />
                  </span>
                  <div className="grow">
                    <span className="tiny muted">{ruleTypes.find(t => t.value === rule.type)?.label}</span>
                    <h3>{rule.value}</h3>
                  </div>
                  <input
                    className="switch"
                    type="checkbox"
                    aria-label={`Enable ${rule.value}`}
                    checked={rule.enabled}
                    onChange={() =>
                      setRules(rs => rs.map(r => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
                    }
                  />
                </div>
                <div className="rule-bottom">
                  <span className="tiny muted">+{rule.weight ?? 4} priority points</span>
                  <button className="text-button danger" onClick={() => setRules(rs => rs.filter(r => r.id !== rule.id))}>
                    Delete rule
                  </button>
                </div>
              </article>
            ))}
            {!rules.length && (
              <EmptyState title="Make it yours" body="Add a sender, label, or keyword to start prioritizing." />
            )}
            <p className="help">
              Rules apply to real Gmail messages immediately. Sender, domain, and keyword rules dynamically elevate
              matching emails.
            </p>
          </>
        )}

        {tab === 'people' && (
          <>
            <section className="page-heading">
              <div className="eyebrow">PEOPLE BEFORE EVERYTHING</div>
              <h1>VIP People</h1>
              <p>The people you never want to miss.</p>
            </section>
            <button className="primary full" onClick={() => setModal('person')}>
              <Icon name="plus" />
              Add a VIP person
            </button>
            <div className="section-title">
              <h2>Your inner circle</h2>
              <span>{people.length} people</span>
            </div>
            {people.map(person => (
              <article className="simple-card" key={person.id}>
                <div className="rule-top">
                  <span className="avatar academic">{person.name[0]}</span>
                  <div className="grow">
                    <h3>{person.name}</h3>
                    <p className="account-label">{person.email}</p>
                    <span className="category-tag">{person.category}</span>
                  </div>
                </div>
                <div className="rule-bottom">
                  <span className="tiny blue">Always important</span>
                  <button
                    className="text-button danger"
                    onClick={() => setPeople(ps => ps.filter(p => p.id !== person.id))}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
            {!people.length && (
              <EmptyState title="Who matters most?" body="Add your mentor, manager, or professor." />
            )}
          </>
        )}

        {tab === 'settings' && (
          <>
            <section className="page-heading">
              <div className="eyebrow">MAKE ROOM FOR WHAT MATTERS</div>
              <h1>Settings</h1>
              <p>A quieter inbox, on your terms.</p>
            </section>

            {/* Authenticated PriorityMail user */}
            {user && (
              <>
                <h2 className="settings-title">Your account</h2>
                <section className="settings-card">
                  <div className="connected">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        width={40}
                        height={40}
                        style={{ borderRadius: '50%' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="avatar">{user.displayName[0]}</span>
                    )}
                    <div className="grow">
                      <strong>{user.displayName}</strong>
                      <small>{user.email}</small>
                    </div>
                    <button
                      className="text-button danger"
                      onClick={async () => {
                        await logout();
                        setToast('Signed out successfully.');
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* Real connected Gmail accounts */}
            <h2 className="settings-title">Connected Gmail accounts</h2>
            <ConnectedAccountsList
              accounts={connectedAccounts}
              onAccountAdded={() => {
                getConnectedAccounts().then(accs => {
                  setConnectedAccounts(accs);
                  if (accs.length > 0) fetchRealEmails('all');
                });
              }}
              onAccountRemoved={id => {
                setConnectedAccounts(prev => prev.filter(a => a.id !== id));
                setGmailEmails(prev => prev.filter(e => e.accountId !== id && e.connectedAccountId !== id));
              }}
              onToast={setToast}
            />

            <h2 className="settings-title">Notifications</h2>
            <section className="settings-card">
              <Toggle
                label="Notifications"
                description="Allow priority email alerts"
                checked={settings.notifications}
                onChange={v => setting('notifications', v)}
              />
              <Toggle
                label="Deadline alerts"
                description="A heads-up before time runs out"
                checked={settings.deadlineAlerts}
                onChange={v => setting('deadlineAlerts', v)}
              />
              <Toggle
                label="VIP alerts"
                description="Keep your people close"
                checked={settings.vipAlerts}
                onChange={v => setting('vipAlerts', v)}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderTop: '1px solid #f0f3f8',
                  borderBottom: '1px solid #f0f3f8',
                  margin: '8px 0 12px',
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, display: 'block' }}>Push delivery</strong>
                  <small style={{ color: '#687796' }}>Standards-based Web Push (iPhone PWA / Web)</small>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: pushActive ? '#dcfce7' : '#f3f4f6',
                    color: pushActive ? '#15803d' : '#6b7280',
                  }}
                >
                  {pushActive ? 'ACTIVE' : 'NOT ENABLED'}
                </span>
              </div>

              <button
                type="button"
                className="primary full"
                disabled={enablingPush}
                onClick={async () => {
                  setEnablingPush(true);
                  const res = await enablePushNotifications();
                  setEnablingPush(false);
                  setToast(res.message);
                  const sub = await getExistingPushSubscription();
                  setPushActive(Boolean(sub));
                }}
              >
                {enablingPush
                  ? 'Enabling push…'
                  : pushActive
                    ? 'Re-enable / Update Push Subscription'
                    : 'Enable Push Notifications'}
              </button>

              <button
                type="button"
                className="text-button blue full"
                style={{ marginTop: 6 }}
                disabled={testingPush}
                onClick={async () => {
                  setTestingPush(true);
                  const res = await triggerTestPush();
                  setTestingPush(false);
                  setToast(res.message);
                }}
              >
                {testingPush ? 'Sending test notification…' : 'Send Test Notification'}
              </button>
            </section>

            <h2 className="settings-title">Quiet hours</h2>
            <section className="settings-card">
              <Toggle
                label="Give yourself a break"
                description="Silence notifications during these hours"
                checked={settings.quietHours}
                onChange={v => setting('quietHours', v)}
              />
              <div className="select-row">
                <label>
                  From
                  <input
                    type="time"
                    required
                    value={settings.quietStart}
                    onChange={e => {
                      if (e.target.value) setting('quietStart', e.target.value);
                    }}
                  />
                </label>
                <label>
                  Until
                  <input
                    type="time"
                    required
                    value={settings.quietEnd}
                    onChange={e => {
                      if (e.target.value) setting('quietEnd', e.target.value);
                    }}
                  />
                </label>
              </div>
            </section>

            <h2 className="settings-title">Priority assistant</h2>
            <section className="settings-card">
              <Toggle
                label="AI classification"
                description="Saved preference for future AI; deterministic rules run now"
                checked={settings.aiClassification}
                onChange={v => setting('aiClassification', v)}
              />
              <label className="field">
                Priority sensitivity
                <select
                  value={settings.sensitivity}
                  onChange={e => setting('sensitivity', e.target.value as PrioritySensitivity)}
                >
                  {['Low', 'Balanced', 'High'].map(v => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </section>

            {isDev && (
              <>
                <h2 className="settings-title">Developer options</h2>
                <section className="settings-card">
                  <Toggle
                    label="Show mock demo emails"
                    description="Development only: test UI with mock dataset when no Gmail is connected"
                    checked={Boolean(settings.showDevDemo)}
                    onChange={v => setting('showDevDemo', v)}
                  />
                </section>
              </>
            )}

            <h2 className="settings-title">Your app, your data</h2>
            <section className="settings-card">
              <p className="help">
                Connected Gmail accounts use OAuth read-only access. Priority rules and preferences are saved
                persistently.
              </p>
              <button className="secondary full" onClick={() => setModal('install')}>
                Install PriorityMail
              </button>
              <button className="text-button danger full" onClick={() => setModal('reset')}>
                Reset local preferences
              </button>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f3f8', display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="text-button blue"
                  style={{ fontSize: '12px' }}
                  onClick={() => setModal('privacy')}
                >
                  Privacy Policy
                </button>
                <span style={{ color: '#D1D5DB' }}>·</span>
                <button
                  type="button"
                  className="text-button blue"
                  style={{ fontSize: '12px' }}
                  onClick={() => setModal('terms')}
                >
                  Terms of Service
                </button>
              </div>
            </section>
            <p className="demo-caption">PRIORITYMAIL · REAL GMAIL INTEGRATION</p>
          </>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map(([id, label, icon]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={e => {
              e.preventDefault();
              navigate(id);
            }}
          >
            <span>
              <Icon name={icon} />
            </span>
            {label}
          </a>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}>
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* DETAIL MODAL WITH DYNAMIC OPEN IN GMAIL */}
      {location.detail && !snoozeId && (
        <Modal title="Email details" onClose={closeDetail}>
          {selected ? (
            <>
              <PriorityBadge priority={selected.priority} />
              <div className="detail-sender">
                <span className="avatar">{selected.senderName[0]}</span>
                <div>
                  <strong>{selected.senderName}</strong>
                  <small>{selected.senderEmail}</small>
                </div>
              </div>
              <div className="opening-account">
                Opening with <strong>{selected.accountEmail}</strong>
              </div>
              <h1 className="detail-subject">{selected.subject}</h1>
              <span className="category-tag">{selected.category}</span>
              {selected.deadline && (
                <div className="deadline">
                  <Icon name="clock" />
                  {selected.deadline}
                </div>
              )}
              <section className="detail-reasons">
                <h3>Why PriorityMail flagged this</h3>
                <ul>
                  {selected.reasons.map(r => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
              <p className="email-body">{selected.body || selected.snippet}</p>

              {/* DYNAMIC OPEN IN GMAIL — EXACT ACCOUNT & THREAD */}
              <button
                className="primary full"
                onClick={() => {
                  try {
                    openEmailInGmail({
                      accountEmail: selected.accountEmail,
                      threadId: selected.gmailThreadId,
                      messageId: selected.gmailMessageId,
                    });
                  } catch {
                    setToast('Gmail could not open. Use the web link below.');
                  }
                }}
              >
                Open in Gmail <Icon name="arrow" />
              </button>
              <a
                className="text-button blue full"
                href={gmailWebUrl({
                  accountEmail: selected.accountEmail,
                  threadId: selected.gmailThreadId,
                  messageId: selected.gmailMessageId,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Use Gmail web directly
              </a>
              <div className="select-row">
                <button className="secondary" onClick={() => complete(selected.id)}>
                  <Icon name="check" />
                  {selected.isCompleted ? 'Undo done' : 'Mark done'}
                </button>
                <button className="secondary" onClick={() => setSnoozeId(selected.id)}>
                  <Icon name="clock" />
                  Snooze
                </button>
              </div>
              {selected.snoozedUntil && (
                <button
                  className="text-button full"
                  onClick={() =>
                    setSnoozes(s => {
                      const next = { ...s };
                      delete next[selected.id];
                      return next;
                    })
                  }
                >
                  Unsnooze now
                </button>
              )}
            </>
          ) : (
            <EmptyState title="Email not found" body="This message is not in the current inbox." />
          )}
        </Modal>
      )}

      {snoozeId && (
        <Modal title="A better time for this" onClose={() => setSnoozeId('')}>
          <p className="help">This email will return to your priority list after the selected time.</p>
          {['In 1 hour', 'Tonight · 8 PM', 'Tomorrow · 9 AM'].map((text, i) => (
            <button
              key={text}
              className="snooze-option"
              onClick={() => {
                const d = new Date();
                if (i === 0) d.setHours(d.getHours() + 1);
                else {
                  if (i === 2) d.setDate(d.getDate() + 1);
                  d.setHours(i === 1 ? 20 : 9, 0, 0, 0);
                  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                }
                snooze(d);
              }}
            >
              <Icon name="clock" />
              {text}
              <Icon name="arrow" />
            </button>
          ))}
          <form
            onSubmit={e => {
              e.preventDefault();
              snooze(new Date(String(new FormData(e.currentTarget).get('date'))));
            }}
          >
            <label className="field">
              Choose a date and time
              <input name="date" type="datetime-local" required />
            </label>
            <button className="primary full">Snooze until then</button>
          </form>
        </Modal>
      )}

      {modal === 'rule' && (
        <Modal title="Add a priority rule" onClose={() => setModal(null)}>
          <form onSubmit={addRule}>
            <label className="field">
              Rule type
              <select name="type">
                {ruleTypes.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Match value
              <input name="value" required maxLength={120} placeholder="e.g. deadline or manager@company.com" />
            </label>
            <p className="help">Matching messages receive +4 priority points.</p>
            <button className="primary full">Save rule</button>
          </form>
        </Modal>
      )}

      {modal === 'person' && (
        <Modal title="Add a VIP person" onClose={() => setModal(null)}>
          <form onSubmit={addPerson}>
            <label className="field">
              Name
              <input name="name" required maxLength={80} autoComplete="name" placeholder="Professor, mentor, manager…" />
            </label>
            <label className="field">
              Email
              <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="name@example.com" />
            </label>
            <label className="field">
              Category
              <select name="category">
                {['Mentor', 'Professor', 'Internship Manager', 'Placement Coordinator', 'Personal'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button className="primary full">Add to VIP People</button>
          </form>
        </Modal>
      )}

      {modal === 'install' && (
        <Modal title="Your inbox, one tap away" onClose={() => setModal(null)}>
          <span className="install-mark">
            <Icon name="mail" />
          </span>
          <p>Give PriorityMail a place on your Home Screen.</p>
          <ol className="install-steps">
            <li>Open your deployed HTTPS link in Safari or Chrome.</li>
            <li>Tap Share / Menu, then Add to Home Screen / Install.</li>
            <li>Launch PriorityMail from its new home icon.</li>
          </ol>
          {installPrompt && (
            <button
              className="primary full"
              onClick={async () => {
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}
            >
              Install app
            </button>
          )}
        </Modal>
      )}

      {modal === 'reset' && (
        <Modal title="Reset local preferences?" onClose={() => setModal(null)}>
          <p>This restores default rules, VIPs, and settings for this browser.</p>
          <button
            className="primary full"
            onClick={() => {
              setRules(defaultMockRules);
              setPeople(defaultVipPeople);
              setSettings(defaults);
              setDone([]);
              setRead([]);
              setSnoozes({});
              setModal(null);
              setToast('Preferences reset.');
            }}
          >
            Reset
          </button>
          <button className="text-button full" onClick={() => setModal(null)}>
            Keep my data
          </button>
        </Modal>
      )}

      {modal === 'privacy' && (
        <Modal title="Privacy Policy" onClose={() => setModal(null)}>
          <PrivacyPolicyPage />
        </Modal>
      )}

      {modal === 'terms' && (
        <Modal title="Terms of Service" onClose={() => setModal(null)}>
          <TermsPage />
        </Modal>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Root App — wraps everything in AuthProvider, gates on auth state
// ----------------------------------------------------------------
export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { auth } = useAuth();

  if (auth.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span className="login-spinner" aria-label="Loading PriorityMail…" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return <LoginPage />;
  }

  return <AppInner />;
}
