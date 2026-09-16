import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { EmailCard, PriorityBadge } from './components/EmailCard';
import { Icon, type IconName } from './components/Icon';
import { Modal } from './components/Modal';
import { initialMockEmails, mockConnectedAccounts, defaultMockRules, defaultVipPeople } from './services/mockData';
import { calculatePriority } from './engine/priorityEngine';
import { useStored } from './services/storage';
import { gmailWebUrl, openEmailInGmail } from './services/gmailDeepLink';
import { mockNotification, requestNotificationPermission, type NotificationPreferences } from './services/notifications';
import type { PriorityRule, PriorityRuleType, VipPerson, PrioritySensitivity } from './types';
import { AuthProvider, useAuth } from './services/authContext';
import { LoginPage } from './pages/LoginPage';
import { ConnectedAccountsList } from './components/ConnectedAccountsList';
import {
  getConnectedAccounts,
  fetchGmailMessages,
  type ConnectedAccountDto,
  type GmailEmailDto,
} from './services/apiClient';

const tabs = [ ['inbox', 'Priority Inbox', 'inbox'], ['all', 'All Emails', 'mail'], ['rules', 'Rules', 'rules'], ['people', 'VIP People', 'star'], ['settings', 'Settings', 'settings'] ] as const;
type Tab = typeof tabs[number][0];
const ruleTypes: { value: PriorityRuleType; label: string }[] = [
  { value: 'label', label: 'Gmail label' }, { value: 'sender', label: 'Sender email' },
  { value: 'domain', label: 'Sender domain' }, { value: 'keyword', label: 'Keyword' },
  { value: 'subject_keyword', label: 'Subject keyword' }, { value: 'vip', label: 'VIP person' },
];
type Settings = NotificationPreferences & { sensitivity: PrioritySensitivity };
const defaults: Settings = { notifications: true, aiClassification: true, deadlineAlerts: true, vipAlerts: true, quietHours: false, quietStart: '22:00', quietEnd: '08:00', sensitivity: 'Balanced' };
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const validRules = (x: unknown): x is PriorityRule[] => Array.isArray(x) && x.every(r => record(r) && typeof r.id === 'string' && typeof r.value === 'string' && typeof r.enabled === 'boolean' && ruleTypes.some(t => t.value === r.type) && (r.weight === undefined || typeof r.weight === 'number'));
const validPeople = (x: unknown): x is VipPerson[] => Array.isArray(x) && x.every(p => record(p) && ['id', 'name', 'email', 'category'].every(k => typeof p[k] === 'string'));
const validIds = (x: unknown): x is string[] => Array.isArray(x) && x.every(i => typeof i === 'string');
const validSnoozes = (x: unknown): x is Record<string, string> => record(x) && Object.values(x).every(v => typeof v === 'string' && Number.isFinite(Date.parse(v)));
const validSettings = (x: unknown): x is Settings => record(x) && ['notifications', 'aiClassification', 'deadlineAlerts', 'vipAlerts', 'quietHours'].every(k => typeof x[k] === 'boolean') && ['Low', 'Balanced', 'High'].includes(String(x.sensitivity)) && ['quietStart', 'quietEnd'].every(k => typeof x[k] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x[k] as string));
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function route() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('email/')) {
    try { return { tab: 'inbox' as Tab, detail: decodeURIComponent(hash.slice(6)) }; }
    catch { return { tab: 'inbox' as Tab, detail: '' }; }
  }
  return { tab: tabs.some(t => t[0] === hash) ? hash as Tab : 'inbox' as Tab, detail: '' };
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="setting-row"><span><strong>{label}</strong><small>{description}</small></span><input className="switch" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /></label>;
}
function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty"><span className="empty-icon"><Icon name="check" /></span><h3>{title}</h3><p>{body}</p></div>;
}

// ----------------------------------------------------------------
// Converts a GmailEmailDto to a PriorityEmail-compatible shape for
// the existing email list UI.
// ----------------------------------------------------------------
function gmailDtoToEmail(dto: GmailEmailDto) {
  return {
    ...dto,
    // Compute a human-readable receivedAt for display
    receivedAt: formatReceivedAt(dto.receivedAt),
    snoozedUntil: dto.snoozedUntil ?? null,
    deadline: undefined,
    body: dto.body,
    labelIds: dto.labelIds,
  };
}

function formatReceivedAt(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    if (diffHr < 48) return 'Yesterday';
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
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
  const [modal, setModal] = useState<'rule' | 'person' | 'install' | 'reset' | null>(null);
  const [snoozeId, setSnoozeId] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  // Real Gmail accounts from backend
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountDto[]>([]);
  const [gmailEmails, setGmailEmails] = useState<GmailEmailDto[]>([]);
  const [gmailAccountId, setGmailAccountId] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState('');

  const tab = location.tab;

  // Load connected accounts on mount
  useEffect(() => {
    getConnectedAccounts()
      .then(setConnectedAccounts)
      .catch(() => { /* not critical */ });
  }, []);

  // Handle ?connect_success=1 from Gmail OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect_success') === '1') {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setToast('Gmail account connected! Go to All Emails to fetch real messages.');
      getConnectedAccounts().then(setConnectedAccounts).catch(() => {});
    }
    if (params.get('connect_error')) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setToast('Gmail connection failed. Please try again.');
    }
  }, []);

  useEffect(() => {
    const change = () => { setLocation(route()); window.scrollTo(0, 0); };
    const connection = () => setOnline(navigator.onLine);
    const refresh = () => setNow(Date.now());
    const install = (event: Event) => { event.preventDefault(); setInstallPrompt(event as Event & { prompt: () => Promise<void> }); };
    const updated = () => setUpdateReady(true);
    const failed = () => setOfflineError(true);
    window.addEventListener('hashchange', change);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('prioritymail-update', updated); window.addEventListener('prioritymail-offline-error', failed);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('hashchange', change); window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('prioritymail-update', updated); window.removeEventListener('prioritymail-offline-error', failed);
      document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer);
    };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 6000); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { document.title = `${location.detail ? 'Email' : tabs.find(t => t[0] === tab)?.[1]} · PriorityMail`; }, [tab, location.detail]);

  const mockEmails = useMemo(() => initialMockEmails.map(email => ({
    ...email,
    ...calculatePriority(email, rules, people, settings.sensitivity),
    isCompleted: done.includes(email.id),
    isRead: read.includes(email.id) || email.isRead,
    snoozedUntil: snoozes[email.id] && Date.parse(snoozes[email.id]) > now ? snoozes[email.id] : null,
  })).sort((a, b) => (b.score || 0) - (a.score || 0)), [rules, people, settings.sensitivity, done, read, snoozes, now]);

  // In "All Emails" with a real Gmail account selected, show Gmail emails
  const realEmailsActive = tab === 'all' && gmailAccountId !== null && gmailEmails.length > 0;

  const baseEmails = realEmailsActive
    ? gmailEmails.map(gmailDtoToEmail).map(e => ({
        ...e,
        isCompleted: done.includes(e.id),
        isRead: read.includes(e.id) || e.isRead,
        snoozedUntil: snoozes[e.id] && Date.parse(snoozes[e.id]) > now ? snoozes[e.id] : null,
      }))
    : mockEmails;

  const active = mockEmails.filter(e => !e.isCompleted && !e.snoozedUntil && (e.priority === 'urgent' || e.priority === 'high'));
  const visible = (tab === 'inbox' ? active : baseEmails).filter(e =>
    (filter === 'all' || e.category === filter) &&
    (account === 'all' || e.accountId === account) &&
    (status === 'all' || (status === 'done' ? e.isCompleted : status === 'snoozed' ? !!e.snoozedUntil : !e.isCompleted && !e.snoozedUntil)) &&
    `${e.subject} ${e.senderName} ${e.senderEmail} ${e.snippet}`.toLowerCase().includes(search.toLowerCase())
  );
  const selected = baseEmails.find(e => e.id === location.detail);
  const complete = (id: string) => { setDone(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]); setToast(done.includes(id) ? 'Moved back to your inbox.' : 'Marked done. One less thing on your mind.'); };
  const open = (id: string) => { setRead(ids => ids.includes(id) ? ids : [...ids, id]); window.location.hash = `email/${encodeURIComponent(id)}`; };
  const navigate = (next: Tab) => { setSearch(''); setFilter('all'); setStatus('all'); setAccount('all'); window.location.hash = next; };
  const closeDetail = () => { window.location.hash = 'all'; };
  const snooze = (date: Date) => {
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { setToast('Choose a future time.'); return; }
    setSnoozes(s => ({ ...s, [snoozeId]: date.toISOString() })); setSnoozeId(''); setToast("Snoozed. You'll find it in All Emails until then.");
  };
  const addRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const value = String(form.get('value')).trim(); if (!value) return;
    setRules(r => [...r, { id: newId(), type: String(form.get('type')) as PriorityRuleType, value, enabled: true, weight: 4 }]); setModal(null); setToast('Rule added. Your inbox has been reprioritized.');
  };
  const addPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const name = String(form.get('name')).trim(), email = String(form.get('email')).trim().toLowerCase();
    if (!name || !email) return;
    if (people.some(p => p.email.toLowerCase() === email)) { setToast('This person is already in your VIP list.'); return; }
    setPeople(p => [...p, { id: newId(), name, email, category: String(form.get('category')) }]); setModal(null); setToast('VIP added. Their messages will always stand out.');
  };
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));
  const storageError = rulesError || peopleError || settingsError || doneError || readError || snoozeError;
  const greeting = new Date(now).getHours() < 12 ? 'Good morning' : new Date(now).getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const userName = user?.displayName?.split(' ')[0] ?? 'there';

  const fetchRealEmails = async (accountId: string) => {
    setGmailLoading(true);
    setGmailError('');
    try {
      const result = await fetchGmailMessages(accountId, 20);
      setGmailEmails(result.emails);
      setGmailAccountId(accountId);
      setToast(`Fetched ${result.emails.length} real emails from ${result.accountEmail}.`);
    } catch {
      setGmailError('Could not fetch Gmail messages. Check your connection and try again.');
      setGmailEmails([]);
    } finally {
      setGmailLoading(false);
    }
  };

  const allAccountOptions = [
    ...mockConnectedAccounts,
    ...connectedAccounts.map(a => ({ id: a.id, email: a.email, displayName: a.displayName, isPrimary: a.isPrimary, status: 'connected' as const })),
  ];

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#inbox"><span className="brand-mark"><Icon name="mail" /></span>PriorityMail</a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {user?.avatarUrl
          ? <img src={user.avatarUrl} alt={user.displayName} width={32} height={32} style={{ borderRadius: '50%', cursor: 'pointer' }} referrerPolicy="no-referrer" onClick={() => navigate('settings')} />
          : <button className="profile" aria-label="Open Settings" onClick={() => navigate('settings')}>{(user?.displayName?.[0] ?? 'U').toUpperCase()}</button>
        }
      </div>
    </header>
    <main>
      {!online && <div className="notice">You're offline. Your saved inbox and rules are available.</div>}
      {storageError && <div className="notice" role="alert">Storage is unavailable. Changes will last for this session only.</div>}
      {offlineError && <div className="notice" role="alert">Offline setup failed. Reconnect and reload to try again.</div>}
      {updateReady && <div className="notice">An update is ready. Close all PriorityMail windows and reopen to update.</div>}
      {(tab === 'inbox' || tab === 'all') && <>
        <section className="page-heading"><div className="eyebrow">{tab === 'inbox' ? 'A LITTLE FOCUS. A LOT LESS NOISE.' : 'EVERY ACCOUNT, ONE PLACE'}</div><h1>{tab === 'inbox' ? <>{greeting},<br />{userName} <span className="hello">✦</span></> : 'All Emails'}</h1><p>{tab === 'inbox' ? 'Your important emails, without the noise.' : 'Find what you need. Leave the rest for later.'}</p></section>
        {tab === 'inbox' && <><section className="stats" aria-label="Inbox summary">{[
          ['Needs attention', active.length, 'inbox'], ['Urgent', active.filter(e => e.priority === 'urgent').length, 'bell'], ['Deadlines', active.filter(e => e.deadline).length, 'clock'],
        ].map(([label, count, icon], i) => <div className={`stat stat-${i}`} key={String(label)}><Icon name={icon as IconName} /><strong>{count}</strong><span>{label}</span></div>)}</section><div className="focus-note"><span className="focus-dot" /><p>A calmer inbox starts here.<br /><strong>We've brought the important things forward.</strong></p></div></>}
        <div className="section-title"><h2>{tab === 'inbox' ? 'Your priority list' : 'Your messages'}</h2><span>{visible.length} emails</span></div>
        {tab === 'all' && <label className="search"><Icon name="search" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sender or subject" aria-label="Search emails" /></label>}
        <div className="filter-row" aria-label="Filter category">{['all', 'work', 'college', 'internship', 'academic', 'personal'].map(c => <button key={c} className={`chip ${filter === c ? 'selected' : ''}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c === 'all' ? 'All' : c}</button>)}</div>
        {tab === 'all' && <div className="select-row">
          <label>Account<select value={account} onChange={e => setAccount(e.target.value)}>
            <option value="all">All accounts</option>
            {allAccountOptions.map(a => <option key={a.id} value={a.id}>{a.displayName}{a.status === 'connected' ? ' ✓' : ' (demo)'}</option>)}
          </select></label>
          <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All messages</option><option value="active">Active</option><option value="done">Completed</option><option value="snoozed">Snoozed</option></select></label>
          {connectedAccounts.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, width: '100%' }}>
              <span className="tiny muted" style={{ width: '100%' }}>Fetch real emails from a connected account:</span>
              {connectedAccounts.map(a => (
                <button key={a.id} className="secondary" disabled={gmailLoading} onClick={() => fetchRealEmails(a.id)} aria-busy={gmailLoading && gmailAccountId === a.id} style={{ fontSize: 12 }}>
                  {gmailLoading && gmailAccountId === a.id ? 'Fetching…' : `Load: ${a.email}`}
                </button>
              ))}
              {gmailAccountId && <button className="text-button" onClick={() => { setGmailEmails([]); setGmailAccountId(null); }}>Show mock emails</button>}
            </div>
          )}
          {gmailError && <p className="help" style={{ color: 'var(--danger, #ef4444)', width: '100%' }}>{gmailError}</p>}
        </div>}
        <div className="email-list">{visible.map(email => <EmailCard key={email.id} email={email as import('./types').PriorityEmail} onOpen={() => open(email.id)} onDone={() => complete(email.id)} onSnooze={() => setSnoozeId(email.id)} />)}</div>
        {!visible.length && <EmptyState title="A little breathing room" body="No emails match this view. Try another filter or check All Emails." />}
        {!realEmailsActive && <p className="demo-caption">LOCAL DEMO · THREE ACCOUNTS · ZERO INBOX ACCESS</p>}
        {realEmailsActive && <p className="demo-caption">LIVE GMAIL · PRIORITY ENGINE · READ-ONLY ACCESS</p>}
      </>}
      {tab === 'rules' && <>
        <section className="page-heading"><div className="eyebrow">YOUR INBOX, YOUR CALL</div><h1>Priority rules</h1><p>Teach your inbox what matters to you.</p></section>
        <button className="primary full" onClick={() => setModal('rule')}><Icon name="plus" />Add priority rule</button>
        <div className="section-title"><h2>Your rules</h2><span>{rules.filter(r => r.enabled).length} enabled</span></div>
        {rules.map(rule => <article className="simple-card" key={rule.id}><div className="rule-top"><span className="mini-icon"><Icon name="rules" /></span><div className="grow"><span className="tiny muted">{ruleTypes.find(t => t.value === rule.type)?.label}</span><h3>{rule.value}</h3></div><input className="switch" type="checkbox" aria-label={`Enable ${rule.value}`} checked={rule.enabled} onChange={() => setRules(rs => rs.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))} /></div><div className="rule-bottom"><span className="tiny muted">+{rule.weight ?? 4} priority points</span><button className="text-button danger" onClick={() => setRules(rs => rs.filter(r => r.id !== rule.id))}>Delete rule</button></div></article>)}
        {!rules.length && <EmptyState title="Make it yours" body="Add a sender, label, or keyword to start prioritizing." />}
        <p className="help">Rules are applied immediately and saved on this device. Demo Gmail labels map to email categories.</p>
      </>}
      {tab === 'people' && <>
        <section className="page-heading"><div className="eyebrow">PEOPLE BEFORE EVERYTHING</div><h1>VIP People</h1><p>The people you never want to miss.</p></section>
        <button className="primary full" onClick={() => setModal('person')}><Icon name="plus" />Add a VIP person</button>
        <div className="section-title"><h2>Your inner circle</h2><span>{people.length} people</span></div>
        {people.map(person => <article className="simple-card" key={person.id}><div className="rule-top"><span className="avatar academic">{person.name[0]}</span><div className="grow"><h3>{person.name}</h3><p className="account-label">{person.email}</p><span className="category-tag">{person.category}</span></div></div><div className="rule-bottom"><span className="tiny blue">Always important</span><button className="text-button danger" onClick={() => setPeople(ps => ps.filter(p => p.id !== person.id))}>Remove</button></div></article>)}
        {!people.length && <EmptyState title="Who matters most?" body="Add your mentor, manager, or professor." />}
      </>}
      {tab === 'settings' && <>
        <section className="page-heading"><div className="eyebrow">MAKE ROOM FOR WHAT MATTERS</div><h1>Settings</h1><p>A quieter inbox, on your terms.</p></section>

        {/* Account info */}
        {user && <><h2 className="settings-title">Your account</h2><section className="settings-card"><div className="connected"><span className="avatar">{user.displayName[0]}</span><div className="grow"><strong>{user.displayName}</strong><small>{user.email}</small></div><button className="text-button danger" onClick={async () => { await logout(); setToast('Signed out successfully.'); }}>Sign out</button></div></section></>}

        {/* Real connected Gmail accounts */}
        <h2 className="settings-title">Connected Gmail accounts</h2>
        <ConnectedAccountsList
          accounts={connectedAccounts}
          onAccountAdded={() => getConnectedAccounts().then(setConnectedAccounts)}
          onAccountRemoved={(id) => setConnectedAccounts(prev => prev.filter(a => a.id !== id))}
          onToast={setToast}
        />

        <h2 className="settings-title">Notifications</h2><section className="settings-card"><Toggle label="Notifications" description="Allow local demo alerts" checked={settings.notifications} onChange={v => setting('notifications', v)} /><Toggle label="Deadline alerts" description="A heads-up before time runs out" checked={settings.deadlineAlerts} onChange={v => setting('deadlineAlerts', v)} /><Toggle label="VIP alerts" description="Keep your people close" checked={settings.vipAlerts} onChange={v => setting('vipAlerts', v)} /><button className="secondary full" onClick={() => setToast(mockNotification(settings, 'deadline'))}>Try a demo deadline alert</button><button className="text-button blue full" onClick={async () => setToast(await requestNotificationPermission())}>Enable future system notifications</button><p className="help">Alerts are mocked in-app. No background reminders or push subscriptions are active.</p></section>
        <h2 className="settings-title">Quiet hours</h2><section className="settings-card"><Toggle label="Give yourself a break" description="Silence demo alerts during these hours" checked={settings.quietHours} onChange={v => setting('quietHours', v)} /><div className="select-row"><label>From<input type="time" required value={settings.quietStart} onChange={e => { if (e.target.value) setting('quietStart', e.target.value); }} /></label><label>Until<input type="time" required value={settings.quietEnd} onChange={e => { if (e.target.value) setting('quietEnd', e.target.value); }} /></label></div><p className="help">Uses your phone's local time. Equal times silence alerts all day.</p></section>
        <h2 className="settings-title">Priority assistant</h2><section className="settings-card"><Toggle label="AI classification" description="Saved preference for future AI; local rules run now" checked={settings.aiClassification} onChange={v => setting('aiClassification', v)} /><label className="field">Priority sensitivity<select value={settings.sensitivity} onChange={e => setting('sensitivity', e.target.value as PrioritySensitivity)}>{['Low', 'Balanced', 'High'].map(v => <option key={v}>{v}</option>)}</select></label></section>
        <h2 className="settings-title">Your app, your data</h2><section className="settings-card"><p className="help">Your demo inbox is stored locally. Connected Gmail accounts use OAuth read-only access. Clearing browser data resets your preferences.</p><button className="secondary full" onClick={() => setModal('install')}>Install PriorityMail</button><button className="text-button danger full" onClick={() => setModal('reset')}>Reset local demo data</button></section><p className="demo-caption">PRIORITYMAIL 2.0 · BUILT FOR A CALMER DAY</p>
      </>}
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{tabs.map(([id, label, icon]) => <a key={id} href={`#${id}`} aria-current={tab === id ? 'page' : undefined} onClick={e => { e.preventDefault(); navigate(id); }}><span><Icon name={icon} /></span>{label}</a>)}</nav>
    {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}><Icon name="close" /></button></div>}
    {location.detail && !snoozeId && <Modal title="Email details" onClose={closeDetail}>{selected ? <>
      <PriorityBadge priority={selected.priority} /><div className="detail-sender"><span className="avatar">{selected.senderName[0]}</span><div><strong>{selected.senderName}</strong><small>{selected.senderEmail}</small></div></div>
      <div className="opening-account">Opening with <strong>{selected.accountEmail}</strong></div><h1 className="detail-subject">{selected.subject}</h1><span className="category-tag">{selected.category}</span>{selected.deadline && <div className="deadline"><Icon name="clock" />{selected.deadline}</div>}
      <section className="detail-reasons"><h3>Why PriorityMail flagged this</h3><ul>{selected.reasons.map(r => <li key={r}>{r}</li>)}</ul></section><p className="email-body">{selected.body || selected.snippet}</p>
      <button className="primary full" onClick={() => { try { openEmailInGmail({ accountEmail: selected.accountEmail, threadId: selected.gmailThreadId, messageId: selected.gmailMessageId }); } catch { setToast('Gmail could not open. Try the Gmail web link below.'); } }}>Open in Gmail <Icon name="arrow" /></button>
      <a className="text-button blue full" href={gmailWebUrl({ accountEmail: selected.accountEmail, threadId: selected.gmailThreadId, messageId: selected.gmailMessageId })} target="_blank" rel="noopener noreferrer">Use Gmail web instead</a>
      <div className="select-row"><button className="secondary" onClick={() => complete(selected.id)}><Icon name="check" />{selected.isCompleted ? 'Undo done' : 'Mark done'}</button><button className="secondary" onClick={() => setSnoozeId(selected.id)}><Icon name="clock" />Snooze</button></div>
      {selected.snoozedUntil && <button className="text-button full" onClick={() => setSnoozes(s => { const next = { ...s }; delete next[selected.id]; return next; })}>Unsnooze now</button>}
    </> : <EmptyState title="Email not found" body="This message is not in the current inbox." />}</Modal>}
    {snoozeId && <Modal title="A better time for this" onClose={() => setSnoozeId('')}><p className="help">This email will return to your priority list after the selected time. No background notification is scheduled.</p>{['In 1 hour', 'Tonight · 8 PM', 'Tomorrow · 9 AM'].map((text, i) => <button key={text} className="snooze-option" onClick={() => { const d = new Date(); if (i === 0) d.setHours(d.getHours() + 1); else { if (i === 2) d.setDate(d.getDate() + 1); d.setHours(i === 1 ? 20 : 9, 0, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); } snooze(d); }}><Icon name="clock" />{text}<Icon name="arrow" /></button>)}<form onSubmit={e => { e.preventDefault(); snooze(new Date(String(new FormData(e.currentTarget).get('date')))); }}><label className="field">Choose a date and time<input name="date" type="datetime-local" required /></label><button className="primary full">Snooze until then</button></form></Modal>}
    {modal === 'rule' && <Modal title="Add a priority rule" onClose={() => setModal(null)}><form onSubmit={addRule}><label className="field">Rule type<select name="type">{ruleTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label className="field">Match value<input name="value" required maxLength={120} placeholder="e.g. deadline or manager@company.com" /></label><p className="help">Matching messages receive +4 priority points.</p><button className="primary full">Save rule</button></form></Modal>}
    {modal === 'person' && <Modal title="Add a VIP person" onClose={() => setModal(null)}><form onSubmit={addPerson}><label className="field">Name<input name="name" required maxLength={80} autoComplete="name" placeholder="Professor, mentor, manager…" /></label><label className="field">Email<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="name@example.com" /></label><label className="field">Category<select name="category">{['Mentor', 'Professor', 'Internship Manager', 'Placement Coordinator', 'Personal'].map(c => <option key={c}>{c}</option>)}</select></label><button className="primary full">Add to VIP People</button></form></Modal>}
    {modal === 'install' && <Modal title="Your inbox, one tap away" onClose={() => setModal(null)}><span className="install-mark"><Icon name="mail" /></span><p>Give PriorityMail a place on your Home Screen.</p><ol className="install-steps"><li>Open your deployed HTTPS link in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>Keep Open as Web App enabled if shown, then tap Add.</li><li>Launch PriorityMail from its new icon.</li></ol><p className="help">On Android, use Chrome's Install app or Add to Home screen menu. Offline support activates after the production app loads successfully over HTTPS.</p>{installPrompt && <button className="primary full" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install app</button>}</Modal>}
    {modal === 'reset' && <Modal title="Reset local demo data?" onClose={() => setModal(null)}><p>This restores default rules, VIPs, settings, and all email states for this web app.</p><button className="primary full" onClick={() => { setRules(defaultMockRules); setPeople(defaultVipPeople); setSettings(defaults); setDone([]); setRead([]); setSnoozes({}); setModal(null); setToast('Your demo has been reset.'); }}>Reset demo</button><button className="text-button full" onClick={() => setModal(null)}>Keep my data</button></Modal>}
  </div>;
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
