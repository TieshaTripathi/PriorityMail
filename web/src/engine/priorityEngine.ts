import type {
  Priority,
  Category,
  PriorityEmail,
  PriorityRule,
  VipPerson,
  PrioritySensitivity,
} from '../types/index.ts';

export interface PriorityCalculationResult {
  priority: Priority;
  category: Category;
  actionRequired: boolean;
  reasons: string[];
  reason: string;
  score: number;
}

export function calculatePriority(
  email: Pick<
    PriorityEmail,
    'senderName' | 'senderEmail' | 'subject' | 'snippet' | 'body' | 'category' | 'deadline'
  >,
  rules: PriorityRule[] = [],
  vipPeople: VipPerson[] = [],
  sensitivity: PrioritySensitivity = 'Balanced'
): PriorityCalculationResult {
  let score = 0;
  const reasons: string[] = [];
  let actionRequired = false;

  const contentText = `${email.subject} ${email.snippet} ${email.body || ''}`.toLowerCase();
  const senderEmail = email.senderEmail.toLowerCase();
  const senderName = email.senderName.toLowerCase();

  // 1. VIP Contact Match (+6 points)
  const matchedVip = vipPeople.find(
    (v) =>
      senderEmail === v.email.toLowerCase() ||
      (v.name.trim() !== '' && senderName.includes(v.name.toLowerCase()))
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

      case 'label':
        if (email.category.toLowerCase() === val) {
          score += weight;
          reasons.push(`Category label matched: ${rule.value}`);
        }
        break;

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
  const hasExplicitDeadline = Boolean(email.deadline && email.deadline.trim() !== '');
  const hasDeadlineKeyword = /\b(deadline|closes tomorrow|closing tomorrow|due by|due tomorrow|submission deadline|expires|last date)\b/i.test(
    contentText
  );

  if (hasExplicitDeadline || hasDeadlineKeyword) {
    score += 5;
    reasons.push('Application or task deadline detected');
    actionRequired = true;
  }

  // 4. Interview Keywords (+4 points)
  if (/\b(interview|screening call|technical round|hiring manager|onsite schedule)\b/i.test(contentText)) {
    score += 4;
    reasons.push('Interview schedule / hiring stage detected');
    actionRequired = true;
  }

  // 5. Action Items & Verbs (+4 points)
  if (
    /\b(action required|confirmation pending|rsvp|accept or decline|review draft|approval required|please respond|action item|needs your review)\b/i.test(
      contentText
    )
  ) {
    score += 4;
    reasons.push('Action required: reply, confirmation, or approval pending');
    actionRequired = true;
  }

  // 6. Academic / Placement Context (+3 points)
  if (
    /\b(placement cell|internship offer|recommendation letter|lor|professor|dean|registrar|exam schedule|hall ticket)\b/i.test(
      contentText
    )
  ) {
    score += 3;
    reasons.push('College academic or placement department notice');
  }

  // 7. Downweight Noise (-5 points)
  const isNewsletterOrMarketing = /\b(unsubscribe|newsletter|promotional|weekly digest|marketing|deals|no-reply@marketing)\b/i.test(
    contentText
  );

  if (isNewsletterOrMarketing && !matchedVip) {
    score -= 5;
    reasons.push('Automated newsletter / promotional content downweighted');
  }

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

  // VIPs stay important even at Low sensitivity.
  if (matchedVip && (priority === 'normal' || priority === 'fyi')) priority = 'high';

  // Deduplicate reasons
  const uniqueReasons = Array.from(new Set(reasons));
  if (uniqueReasons.length === 0) {
    uniqueReasons.push(
      priority === 'fyi' || priority === 'normal'
        ? 'Standard informational update'
        : 'Priority flagged by local email filter'
    );
  }

  const primaryReason = uniqueReasons.slice(0, 3).join(' • ');

  return {
    priority,
    category: email.category,
    actionRequired: actionRequired || priority === 'urgent',
    reasons: uniqueReasons,
    reason: primaryReason,
    score,
  };
}
