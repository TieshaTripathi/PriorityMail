// PriorityMail backend — Priority Engine Service
// Backend-local copy of the priority engine.
// Kept in sync with packages/priority-engine/src/index.ts.

export type Priority = 'urgent' | 'high' | 'normal' | 'fyi';

export type Category =
  | 'work'
  | 'internship'
  | 'college'
  | 'academic'
  | 'personal';

export type PriorityRuleType =
  | 'label'
  | 'sender'
  | 'domain'
  | 'keyword'
  | 'subject_keyword'
  | 'vip';

export type PrioritySensitivity = 'Low' | 'Balanced' | 'High';

export interface EngineRule {
  id: string;
  type: PriorityRuleType;
  value: string;
  weight?: number;
  enabled: boolean;
}

export interface EngineVipPerson {
  id: string;
  name: string;
  email: string;
  category: string;
}

export interface EngineEmail {
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body?: string;
  category?: string;
  deadline?: string;
  labelIds?: string[];
}

export interface PriorityCalculationResult {
  priority: Priority;
  category: Category;
  actionRequired: boolean;
  reasons: string[];
  reason: string;
  score: number;
}

// Keep old /api/classify types for backward compat
export interface IncomingEmail {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  labels: string[];
}
export interface Rule {
  type: 'label' | 'sender' | 'domain' | 'keyword';
  value: string;
  enabled: boolean;
}
export interface Classification {
  important: boolean;
  priority: 'urgent' | 'action' | 'normal';
  reason: string;
  category: 'work' | 'college' | 'personal';
}

const ACTION_WORDS_LEGACY = ['deadline','interview','confirm','approval','approve','submit','submission','reply','review','meeting','action required','urgent'];

/** Legacy classify for /api/classify route — kept for backward compat. */
export function classifyEmailLegacy(email: IncomingEmail, rules: Rule[]): Classification {
  const text = `${email.sender} ${email.subject} ${email.snippet}`.toLowerCase();
  const matches = rules.filter((r) => r.enabled).filter((r) => {
    const v = r.value.toLowerCase();
    if (r.type === 'label') return email.labels.some((x) => x.toLowerCase() === v);
    if (r.type === 'sender') return email.sender.toLowerCase().includes(v);
    if (r.type === 'domain') return email.sender.toLowerCase().includes(`@${v.replace(/^@/, '')}`);
    return text.includes(v);
  });
  const action = ACTION_WORDS_LEGACY.find((w) => text.includes(w));
  const important = matches.length > 0 || !!action;
  const urgent = /today|tomorrow|urgent|immediately|deadline/.test(text);
  const category = /college|placement|exam|academic|student/.test(text) ? 'college' : /intern|work|manager|job|career/.test(text) ? 'work' : 'personal';
  return {
    important,
    priority: urgent ? 'urgent' : important ? 'action' : 'normal',
    reason: [...matches.map((m) => `${m.type}: ${m.value}`), action ? `action signal: ${action}` : ''].filter(Boolean).join(' + ') || 'No priority signal',
    category,
  };
}

// ------------------------------------------------------------------
// New engine (used by /api/gmail/* routes)
// ------------------------------------------------------------------

const ACADEMIC_WORDS = /\b(placement cell|internship offer|recommendation letter|lor|professor|dean|registrar|exam schedule|hall ticket|academic advisor)\b/i;
const INTERVIEW_WORDS = /\b(interview|screening call|technical round|hiring manager|onsite schedule|recruiter)\b/i;
const ACTION_PHRASE_WORDS = /\b(action required|confirmation pending|rsvp|accept or decline|review draft|approval required|please respond|action item|needs your review)\b/i;
const DEADLINE_WORDS = /\b(deadline|closes tomorrow|closing tomorrow|due by|due tomorrow|submission deadline|expires|last date)\b/i;
const NOISE_WORDS = /\b(unsubscribe|newsletter|promotional|weekly digest|marketing|deals|no-reply@marketing)\b/i;
const ACTION_WORDS = ['deadline','interview','confirm','confirmation','approval','approve','submit','submission','reply','review','meeting','action required','urgent','rsvp','please respond','needs your review'];

function guessCategory(text: string): Category {
  if (/\b(college|placement|exam|academic|student|professor|dean|lor|campus|hall ticket)\b/i.test(text)) return 'academic';
  if (/\b(intern|internship|stipend|placement|offer letter)\b/i.test(text)) return 'internship';
  if (/\b(work|manager|job|career|sprint|standup|client|project|pull request)\b/i.test(text)) return 'work';
  if (/\b(college|university|campus|department|lecture|course|assignment)\b/i.test(text)) return 'college';
  return 'personal';
}

export function classifyEmail(
  email: EngineEmail,
  rules: EngineRule[] = [],
  vipPeople: EngineVipPerson[] = [],
  sensitivity: PrioritySensitivity = 'Balanced',
): PriorityCalculationResult {
  let score = 0;
  const reasons: string[] = [];
  let actionRequired = false;

  const contentText = `${email.subject} ${email.snippet} ${email.body ?? ''}`.toLowerCase();
  const senderEmail = email.senderEmail.toLowerCase();
  const senderName = email.senderName.toLowerCase();

  const matchedVip = vipPeople.find(
    (v) => senderEmail === v.email.toLowerCase() || (v.name.trim() !== '' && senderName.includes(v.name.toLowerCase())),
  );

  if (matchedVip) { score += 6; reasons.push(`VIP Contact: ${matchedVip.name} (${matchedVip.category})`); actionRequired = true; }

  for (const rule of rules.filter((r) => r.enabled)) {
    const val = rule.value.toLowerCase().trim();
    if (!val) continue;
    const weight = rule.weight ?? 4;
    switch (rule.type) {
      case 'vip':
        if (senderEmail.includes(val) || senderName.includes(val)) { score += weight; reasons.push(`VIP rule match: "${rule.value}"`); actionRequired = true; }
        break;
      case 'sender':
        if (senderEmail === val) { score += weight; reasons.push(`Sender matched rule: ${rule.value}`); }
        break;
      case 'domain': {
        const d = val.replace(/^@/, '');
        if (senderEmail.split('@')[1] === d) { score += weight; reasons.push(`Domain rule matched: @${d}`); }
        break;
      }
      case 'label': {
        const m = (email.labelIds ?? []).some((l) => l.toLowerCase() === val) || (email.category ?? '').toLowerCase() === val;
        if (m) { score += weight; reasons.push(`Category label matched: ${rule.value}`); }
        break;
      }
      case 'subject_keyword':
        if (email.subject.toLowerCase().includes(val)) { score += weight; reasons.push(`Subject keyword matched: "${rule.value}"`); }
        break;
      case 'keyword':
        if (contentText.includes(val)) { score += weight; reasons.push(`Keyword matched: "${rule.value}"`); }
        break;
    }
  }

  if (Boolean(email.deadline?.trim()) || DEADLINE_WORDS.test(contentText)) { score += 5; reasons.push('Application or task deadline detected'); actionRequired = true; }
  if (INTERVIEW_WORDS.test(contentText)) { score += 4; reasons.push('Interview schedule / hiring stage detected'); actionRequired = true; }
  if (ACTION_PHRASE_WORDS.test(contentText)) { score += 4; reasons.push('Action required: reply, confirmation, or approval pending'); actionRequired = true; }
  else { const aw = ACTION_WORDS.find((w) => contentText.includes(w)); if (aw) { score += 2; reasons.push(`Action signal: ${aw}`); } }
  if (ACADEMIC_WORDS.test(contentText)) { score += 3; reasons.push('College academic or placement department notice'); }
  if (NOISE_WORDS.test(contentText) && !matchedVip) { score -= 5; reasons.push('Automated newsletter / promotional content downweighted'); }

  const category: Category = (email.category as Category | undefined) ?? guessCategory(contentText);

  let priority: Priority;
  if (sensitivity === 'High') {
    priority = score >= 6 ? 'urgent' : score >= 3 ? 'high' : score >= 0 ? 'normal' : 'fyi';
  } else if (sensitivity === 'Low') {
    priority = score >= 10 ? 'urgent' : score >= 6 ? 'high' : score >= 2 ? 'normal' : 'fyi';
  } else {
    priority = score >= 8 ? 'urgent' : score >= 4 ? 'high' : score >= 1 ? 'normal' : 'fyi';
  }

  if (matchedVip && (priority === 'normal' || priority === 'fyi')) priority = 'high';

  const uniqueReasons = Array.from(new Set(reasons));
  if (!uniqueReasons.length) uniqueReasons.push(priority === 'fyi' || priority === 'normal' ? 'Standard informational update' : 'Priority flagged by local email filter');

  return {
    priority,
    category,
    actionRequired: actionRequired || priority === 'urgent',
    reasons: uniqueReasons,
    reason: uniqueReasons.slice(0, 3).join(' • '),
    score,
  };
}
