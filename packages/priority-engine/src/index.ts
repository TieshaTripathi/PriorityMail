// ============================================================
// PriorityMail — Shared Priority Engine
// Pure TypeScript, zero dependencies, works in:
//   - web (Vite + React)
//   - mobile (React Native / Expo)
//   - backend (Node.js)
// ============================================================

// Inline minimal types so this package has no runtime imports.
// (Mirrors packages/types for type-safety without import overhead.)

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
  /** Used for label-type rules (maps to Gmail labelIds or category string) */
  category?: string;
  deadline?: string;
  /** Raw Gmail label IDs for label-type rules */
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

// ------------------------------------------------------------------
// Keyword dictionaries
// ------------------------------------------------------------------

const ACTION_WORDS = [
  'deadline',
  'interview',
  'confirm',
  'confirmation',
  'approval',
  'approve',
  'submit',
  'submission',
  'reply',
  'review',
  'meeting',
  'action required',
  'urgent',
  'rsvp',
  'please respond',
  'needs your review',
];

const ACADEMIC_WORDS =
  /\b(placement cell|internship offer|recommendation letter|lor|professor|dean|registrar|exam schedule|hall ticket|academic advisor)\b/i;

const INTERVIEW_WORDS =
  /\b(interview|screening call|technical round|hiring manager|onsite schedule|recruiter)\b/i;

const ACTION_PHRASE_WORDS =
  /\b(action required|confirmation pending|rsvp|accept or decline|review draft|approval required|please respond|action item|needs your review)\b/i;

const DEADLINE_WORDS =
  /\b(deadline|closes tomorrow|closing tomorrow|due by|due tomorrow|submission deadline|expires|last date)\b/i;

const NOISE_WORDS =
  /\b(unsubscribe|newsletter|promotional|weekly digest|marketing|deals|no-reply@marketing)\b/i;

const URGENCY_WORDS =
  /\b(today|tomorrow|urgent|immediately|deadline)\b/i;

// ------------------------------------------------------------------
// Category classifier
// ------------------------------------------------------------------

function guessCategory(text: string): Category {
  if (/\b(college|placement|exam|academic|student|professor|dean|lor|campus|sies|hall ticket)\b/i.test(text))
    return 'academic';
  if (/\b(intern|internship|stipend|placement|offer letter)\b/i.test(text))
    return 'internship';
  if (/\b(work|manager|job|career|sprint|standup|client|project|pull request)\b/i.test(text))
    return 'work';
  if (/\b(college|university|campus|department|lecture|course|assignment)\b/i.test(text))
    return 'college';
  return 'personal';
}

// ------------------------------------------------------------------
// Main export
// ------------------------------------------------------------------

export function classifyEmail(
  email: EngineEmail,
  rules: EngineRule[] = [],
  vipPeople: EngineVipPerson[] = [],
  sensitivity: PrioritySensitivity = 'Balanced',
): PriorityCalculationResult {
  let score = 0;
  const reasons: string[] = [];
  let actionRequired = false;

  const contentText =
    `${email.subject} ${email.snippet} ${email.body ?? ''}`.toLowerCase();
  const senderEmail = email.senderEmail.toLowerCase();
  const senderName = email.senderName.toLowerCase();

  // 1. VIP Contact Match (+6 points)
  const matchedVip = vipPeople.find(
    (v) =>
      senderEmail === v.email.toLowerCase() ||
      (v.name.trim() !== '' &&
        senderName.includes(v.name.toLowerCase())),
  );

  if (matchedVip) {
    score += 6;
    reasons.push(`VIP Contact: ${matchedVip.name} (${matchedVip.category})`);
    actionRequired = true;
  }

  // 2. Active User Rules
  const activeRules = rules.filter((r) => r.enabled);
  for (const rule of activeRules) {
    const val = rule.value.toLowerCase().trim();
    if (!val) continue;
    const weight = rule.weight ?? 4;

    switch (rule.type) {
      case 'vip':
        if (senderEmail.includes(val) || senderName.includes(val)) {
          score += weight;
          reasons.push(`VIP rule match: "${rule.value}"`);
          actionRequired = true;
        }
        break;

      case 'sender':
        if (senderEmail === val) {
          score += weight;
          reasons.push(`Sender matched rule: ${rule.value}`);
        }
        break;

      case 'domain': {
        const cleanDomain = val.replace(/^@/, '');
        if (senderEmail.split('@')[1] === cleanDomain) {
          score += weight;
          reasons.push(`Domain rule matched: @${cleanDomain}`);
        }
        break;
      }

      case 'label': {
        // Match against Gmail labelIds array (real) or category string (mock)
        const labelMatch =
          (email.labelIds ?? []).some(
            (l) => l.toLowerCase() === val,
          ) ||
          (email.category ?? '').toLowerCase() === val;
        if (labelMatch) {
          score += weight;
          reasons.push(`Category label matched: ${rule.value}`);
        }
        break;
      }

      case 'subject_keyword':
        if (email.subject.toLowerCase().includes(val)) {
          score += weight;
          reasons.push(`Subject keyword matched: "${rule.value}"`);
        }
        break;

      case 'keyword':
        if (contentText.includes(val)) {
          score += weight;
          reasons.push(`Keyword matched: "${rule.value}"`);
        }
        break;
    }
  }

  // 3. Deadline Heuristics (+5 points)
  const hasExplicitDeadline = Boolean(
    email.deadline && email.deadline.trim() !== '',
  );
  const hasDeadlineKeyword = DEADLINE_WORDS.test(contentText);
  if (hasExplicitDeadline || hasDeadlineKeyword) {
    score += 5;
    reasons.push('Application or task deadline detected');
    actionRequired = true;
  }

  // 4. Interview Keywords (+4 points)
  if (INTERVIEW_WORDS.test(contentText)) {
    score += 4;
    reasons.push('Interview schedule / hiring stage detected');
    actionRequired = true;
  }

  // 5. Action Items & Verbs (+4 points)
  if (ACTION_PHRASE_WORDS.test(contentText)) {
    score += 4;
    reasons.push('Action required: reply, confirmation, or approval pending');
    actionRequired = true;
  } else {
    // Lighter action-word signal (+2 points)
    const actionWord = ACTION_WORDS.find((w) => contentText.includes(w));
    if (actionWord) {
      score += 2;
      reasons.push(`Action signal: ${actionWord}`);
    }
  }

  // 6. Academic / Placement Context (+3 points)
  if (ACADEMIC_WORDS.test(contentText)) {
    score += 3;
    reasons.push('College academic or placement department notice');
  }

  // 7. Downweight Noise (-5 points)
  if (NOISE_WORDS.test(contentText) && !matchedVip) {
    score -= 5;
    reasons.push('Automated newsletter / promotional content downweighted');
  }

  // Infer category (use provided or guess from text)
  const category: Category =
    (email.category as Category | undefined) ?? guessCategory(contentText);

  // Sensitivity Thresholds
  let priority: Priority;
  if (sensitivity === 'High') {
    if (score >= 6) priority = 'urgent';
    else if (score >= 3) priority = 'high';
    else if (score >= 0) priority = 'normal';
    else priority = 'fyi';
  } else if (sensitivity === 'Low') {
    if (score >= 10) priority = 'urgent';
    else if (score >= 6) priority = 'high';
    else if (score >= 2) priority = 'normal';
    else priority = 'fyi';
  } else {
    // Balanced
    if (score >= 8) priority = 'urgent';
    else if (score >= 4) priority = 'high';
    else if (score >= 1) priority = 'normal';
    else priority = 'fyi';
  }

  // VIPs stay important even at Low sensitivity
  if (matchedVip && (priority === 'normal' || priority === 'fyi'))
    priority = 'high';

  // Deduplicate reasons
  const uniqueReasons = Array.from(new Set(reasons));
  if (uniqueReasons.length === 0) {
    uniqueReasons.push(
      priority === 'fyi' || priority === 'normal'
        ? 'Standard informational update'
        : 'Priority flagged by local email filter',
    );
  }

  const primaryReason = uniqueReasons.slice(0, 3).join(' • ');

  return {
    priority,
    category,
    actionRequired: actionRequired || priority === 'urgent',
    reasons: uniqueReasons,
    reason: primaryReason,
    score,
  };
}
