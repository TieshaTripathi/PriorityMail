// PriorityMail backend — Gmail API Service
// Wraps the Gmail REST API. Returns NormalizedEmail objects that are
// ready to be fed into the priority engine.
// NEVER exposes raw tokens to the caller or to any HTTP response.

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

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
  receivedAt: string;       // ISO-8601
  labelIds: string[];
  isRead: boolean;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function parseAddressHeader(raw: string): { name: string; email: string } {
  // Formats: "Name <email@example.com>" or just "email@example.com"
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { name: raw.trim(), email: raw.trim() };
}

function getHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string,
): string {
  return (
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ''
  );
}

function extractPlainText(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown[] | null;
}): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainText(
        part as { mimeType?: string; body?: { data?: string }; parts?: unknown[] },
      );
      if (text) return text;
    }
  }
  return '';
}

// ------------------------------------------------------------------
// API functions
// ------------------------------------------------------------------

export async function getProfile(
  auth: OAuth2Client,
): Promise<GmailProfile> {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.getProfile({ userId: 'me' });
  return {
    emailAddress: res.data.emailAddress ?? '',
    messagesTotal: res.data.messagesTotal ?? 0,
    threadsTotal: res.data.threadsTotal ?? 0,
    historyId: res.data.historyId ?? '',
  };
}

export async function listLabels(
  auth: OAuth2Client,
): Promise<GmailLabel[]> {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.labels.list({ userId: 'me' });
  return (res.data.labels ?? []).map((l) => ({
    id: l.id ?? '',
    name: l.name ?? '',
    type: l.type ?? 'user',
  }));
}

export async function listRecentMessages(
  auth: OAuth2Client,
  maxResults = 20,
  pageToken?: string,
): Promise<{ messageIds: string[]; nextPageToken?: string }> {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken,
    // Exclude spam and trash by default
    q: '-in:spam -in:trash',
  });
  return {
    messageIds: (res.data.messages ?? []).map((m) => m.id ?? '').filter(Boolean),
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

/**
 * Fetch a single message and normalize it to PriorityMail's email shape.
 */
export async function getMessage(
  auth: OAuth2Client,
  messageId: string,
  connectedAccountId: string,
  accountEmail: string,
): Promise<NormalizedEmail> {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];

  const fromRaw = getHeader(headers, 'from');
  const { name: senderName, email: senderEmail } = parseAddressHeader(fromRaw);

  const subject = getHeader(headers, 'subject') || '(no subject)';
  const dateStr = getHeader(headers, 'date');
  const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

  const snippet = msg.snippet ?? '';
  const body = msg.payload ? extractPlainText(msg.payload as Parameters<typeof extractPlainText>[0]) : undefined;
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

/**
 * Fetch all messages in a thread and normalize them.
 */
export async function getThread(
  auth: OAuth2Client,
  threadId: string,
  connectedAccountId: string,
  accountEmail: string,
): Promise<NormalizedEmail[]> {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const messages = res.data.messages ?? [];
  return messages.map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const fromRaw = getHeader(headers, 'from');
    const { name: senderName, email: senderEmail } = parseAddressHeader(fromRaw);
    const subject = getHeader(headers, 'subject') || '(no subject)';
    const dateStr = getHeader(headers, 'date');
    const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
    const snippet = msg.snippet ?? '';
    const body = msg.payload ? extractPlainText(msg.payload as Parameters<typeof extractPlainText>[0]) : undefined;
    const labelIds = msg.labelIds ?? [];
    const isRead = !labelIds.includes('UNREAD');

    return {
      connectedAccountId,
      accountEmail,
      gmailMessageId: msg.id ?? '',
      gmailThreadId: threadId,
      senderName: senderName || senderEmail,
      senderEmail,
      subject,
      snippet,
      body: body || undefined,
      receivedAt,
      labelIds,
      isRead,
    };
  });
}
