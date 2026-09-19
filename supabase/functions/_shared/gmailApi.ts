// PriorityMail Edge Functions — Gmail REST API Wrapper
// Uses direct fetch calls to https://gmail.googleapis.com/gmail/v1/users/me/...

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

export interface NormalizedEmail {
  connectedAccountId: string;
  accountEmail: string;
  gmailMessageId: string;
  gmailThreadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body?: string;
  receivedAt: string; // ISO-8601
  labelIds: string[];
  isRead: boolean;
}

function parseAddressHeader(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { name: raw.trim(), email: raw.trim() };
}

function getHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string
): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function decodeBase64Url(data: string): string {
  try {
    let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function extractPlainText(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown[] | null;
}): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainText(
        part as { mimeType?: string; body?: { data?: string }; parts?: unknown[] }
      );
      if (text) return text;
    }
  }
  return '';
}

export async function getProfile(accessToken: string): Promise<GmailProfile> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`getProfile failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return {
    emailAddress: data.emailAddress ?? '',
    messagesTotal: data.messagesTotal ?? 0,
    threadsTotal: data.threadsTotal ?? 0,
    historyId: data.historyId ?? '',
  };
}

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`listLabels failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return (data.labels ?? []).map((l: { id?: string; name?: string; type?: string }) => ({
    id: l.id ?? '',
    name: l.name ?? '',
    type: l.type ?? 'user',
  }));
}

export async function listRecentMessages(
  accessToken: string,
  maxResults = 25,
  pageToken?: string
): Promise<{ messageIds: string[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: '-in:spam -in:trash',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`listRecentMessages failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return {
    messageIds: (data.messages ?? []).map((m: { id?: string }) => m.id ?? '').filter(Boolean),
    nextPageToken: data.nextPageToken,
  };
}

export async function getMessage(
  accessToken: string,
  messageId: string,
  connectedAccountId: string,
  accountEmail: string
): Promise<NormalizedEmail> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`getMessage failed for ${messageId} (${res.status}): ${await res.text()}`);
  }
  const msg = await res.json();
  const headers = msg.payload?.headers ?? [];

  const fromRaw = getHeader(headers, 'from');
  const { name: senderName, email: senderEmail } = parseAddressHeader(fromRaw);

  const subject = getHeader(headers, 'subject') || '(no subject)';
  const dateStr = getHeader(headers, 'date');
  const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

  const snippet = msg.snippet ?? '';
  const body = msg.payload ? extractPlainText(msg.payload) : undefined;
  const labelIds = msg.labelIds ?? [];
  const isRead = !labelIds.includes('UNREAD');

  return {
    connectedAccountId,
    accountEmail,
    gmailMessageId: msg.id ?? messageId,
    gmailThreadId: msg.threadId ?? '',
    senderName: senderName || senderEmail,
    senderEmail,
    subject,
    snippet,
    body: body || undefined,
    receivedAt,
    labelIds,
    isRead,
  };
}

export async function listHistory(
  accessToken: string,
  startHistoryId: string
): Promise<{ newMsgIds: string[]; latestHistoryId?: string }> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: 'messageAdded',
  });

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`listHistory failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const histories = data.history || [];
  const newMsgIds: string[] = [];

  for (const h of histories) {
    if (h.messagesAdded) {
      for (const ma of h.messagesAdded) {
        if (ma.message?.id && !newMsgIds.includes(ma.message.id)) {
          newMsgIds.push(ma.message.id);
        }
      }
    }
  }

  return {
    newMsgIds,
    latestHistoryId: data.historyId,
  };
}

export async function registerWatch(
  accessToken: string,
  topicName: string
): Promise<{ historyId: string; expiration: string }> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName,
      labelIds: ['INBOX'],
    }),
  });

  if (!res.ok) {
    throw new Error(`registerWatch failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const expiration = data.expiration
    ? new Date(Number(data.expiration)).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    historyId: data.historyId || '',
    expiration,
  };
}

export async function stopWatch(accessToken: string): Promise<void> {
  try {
    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.warn('[gmailApi] stopWatch error:', err);
  }
}
