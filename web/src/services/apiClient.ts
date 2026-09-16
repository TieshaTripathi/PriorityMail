// PriorityMail Web — Typed API Client
// All requests go to the backend. No secrets live in the frontend bundle.
// Credentials (session cookies) are sent automatically by the browser.

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // send session cookie
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) errorMessage = body.error;
    } catch { /* ignore parse errors */ }
    throw new ApiError(errorMessage, res.status);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// ----------------------------------------------------------------
// Auth
// ----------------------------------------------------------------

export interface UserDto {
  id: string;
  googleUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

/** Fetch the current session user. Returns null if not authenticated. */
export async function getMe(): Promise<UserDto | null> {
  try {
    return await apiFetch<UserDto>('/api/auth/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** Get the Google login URL from the backend. */
export async function getLoginUrl(): Promise<string> {
  const data = await apiFetch<{ url: string }>('/api/auth/google/login');
  return data.url;
}

/** Destroy the current session. */
export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

// ----------------------------------------------------------------
// Connected Gmail Accounts
// ----------------------------------------------------------------

export interface ConnectedAccountDto {
  id: string;
  userId: string;
  googleUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isPrimary: boolean;
  createdAt: string;
}

export async function getConnectedAccounts(): Promise<ConnectedAccountDto[]> {
  return apiFetch<ConnectedAccountDto[]>('/api/accounts');
}

/** Get the URL to start connecting a new Gmail account. */
export async function startConnectGmailAccount(): Promise<string> {
  const data = await apiFetch<{ url: string }>('/api/accounts/connect/start', {
    method: 'POST',
  });
  return data.url;
}

/** Disconnect a Gmail account. */
export async function disconnectAccount(accountId: string): Promise<void> {
  await apiFetch(`/api/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
}

// ----------------------------------------------------------------
// Gmail Messages
// ----------------------------------------------------------------

export interface GmailEmailDto {
  id: string;
  accountId: string;
  accountEmail: string;
  connectedAccountId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body?: string;
  receivedAt: string;
  labelIds: string[];
  isRead: boolean;
  isCompleted: boolean;
  snoozedUntil: null;
  priority: 'urgent' | 'high' | 'normal' | 'fyi';
  category: string;
  actionRequired: boolean;
  reason: string;
  reasons: string[];
  score: number;
}

export interface GmailMessagesResponse {
  emails: GmailEmailDto[];
  accountId: string;
  accountEmail: string;
}

export async function fetchGmailMessages(
  accountId: string,
  max = 20,
): Promise<GmailMessagesResponse> {
  return apiFetch<GmailMessagesResponse>(
    `/api/gmail/${encodeURIComponent(accountId)}/messages?max=${max}`,
  );
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

export async function fetchGmailLabels(accountId: string): Promise<GmailLabel[]> {
  const data = await apiFetch<{ labels: GmailLabel[] }>(
    `/api/gmail/${encodeURIComponent(accountId)}/labels`,
  );
  return data.labels;
}
