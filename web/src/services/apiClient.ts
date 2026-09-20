// PriorityMail Web — Typed API Client
// Connects to Supabase Edge Functions with authenticated Supabase JWT Bearer tokens.
// Falls back to legacy API during transitional migration testing.

import { supabase, isSupabaseConfigured, getSupabaseFunctionsUrl } from './supabaseClient.ts';
import { getApiBaseUrl } from './apiUrl.ts';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Maps legacy /api/* endpoints to Supabase Edge Function endpoints.
 */
function resolveEdgeFunctionUrl(path: string): { url: string; methodOverride?: string } {
  const base = getSupabaseFunctionsUrl();

  // /api/accounts
  if (path === '/api/accounts' || path === '/api/accounts/connected') {
    return { url: `${base}/gmail-accounts` };
  }
  if (path.startsWith('/api/accounts/')) {
    const parts = path.split('/');
    const accountId = parts[3];
    if (accountId === 'connect' || accountId === 'google') {
      return { url: `${base}/gmail-connect` };
    }
    return { url: `${base}/gmail-accounts?accountId=${encodeURIComponent(accountId)}` };
  }

  // /api/gmail
  if (path.startsWith('/api/gmail')) {
    if (path === '/api/gmail/messages' || path === '/api/emails/priority') {
      return { url: `${base}/gmail-messages` };
    }
    if (path === '/api/gmail/sync') {
      return { url: `${base}/gmail-sync` };
    }

    const matchAccountMessages = path.match(/^\/api\/gmail\/([^/]+)\/messages(\?.*)?$/);
    if (matchAccountMessages) {
      const accountId = matchAccountMessages[1];
      const query = matchAccountMessages[2] || '';
      const sep = query ? '&' : '?';
      return { url: `${base}/gmail-messages${query}${sep}accountId=${encodeURIComponent(accountId)}` };
    }

    const matchAccountSync = path.match(/^\/api\/gmail\/([^/]+)\/sync$/);
    if (matchAccountSync) {
      const accountId = matchAccountSync[1];
      return { url: `${base}/gmail-sync?accountId=${encodeURIComponent(accountId)}` };
    }

    const matchLabels = path.match(/^\/api\/gmail\/([^/]+)\/labels$/);
    if (matchLabels) {
      const accountId = matchLabels[1];
      return { url: `${base}/gmail-labels?accountId=${encodeURIComponent(accountId)}` };
    }
  }

  // /api/notifications
  if (path === '/api/notifications/vapid-public-key') {
    return { url: `${base}/notifications-vapid-key` };
  }
  if (path === '/api/notifications/subscribe' || path === '/api/notifications/unsubscribe') {
    return { url: `${base}/notifications-subscribe` };
  }
  if (path === '/api/notifications/register-device') {
    return { url: `${base}/notifications-register-device` };
  }
  if (path === '/api/notifications/test') {
    return { url: `${base}/notifications-test` };
  }

  // /api/settings
  if (path === '/api/settings') {
    return { url: `${base}/user-settings` };
  }

  // Default passthrough
  return { url: `${base}${path.replace(/^\/api\//, '/')}` };
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let targetUrl: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const { url } = resolveEdgeFunctionUrl(path);
    targetUrl = url;
  } else {
    const base = getApiBaseUrl();
    targetUrl = `${base}${path}`;
  }

  const res = await fetch(targetUrl, {
    credentials: isSupabaseConfigured ? 'omit' : 'include',
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errorMessage = body.error;
    } catch {
      /* ignore parse error */
    }
    throw new ApiError(errorMessage, res.status);
  }

  return res.json() as Promise<T>;
}

// ----------------------------------------------------------------
// Auth Types
// ----------------------------------------------------------------

export interface UserDto {
  id: string;
  googleUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export async function getMe(): Promise<UserDto | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    googleUserId: user.user_metadata?.sub || user.id,
    email: user.email || '',
    displayName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'PriorityMail User',
    avatarUrl: user.user_metadata?.avatar_url,
    createdAt: user.created_at,
  };
}

export function getDirectLoginUrl(): string {
  return `${getSupabaseFunctionsUrl()}/gmail-connect`;
}

export async function getLoginUrl(): Promise<string> {
  return getDirectLoginUrl();
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
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

export async function startConnectGmailAccount(): Promise<string> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error('Please sign in before connecting Gmail.');
  }

  const { data, error } = await supabase.functions.invoke('gmail-connect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    // Surface the function's JSON error without displaying headers or tokens.
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      const message = body?.error || body?.message;
      if (typeof message === 'string') throw new Error(message);
    }
    throw error;
  }

  // The repository's gmail-connect function returns { url, state }.
  // Never navigate to the Edge Function itself, including on malformed responses.
  let url: URL;
  try {
    url = new URL(data?.url);
  } catch {
    throw new Error('Gmail connection did not return a valid Google authorization URL.');
  }
  if (url.origin !== 'https://accounts.google.com') {
    throw new Error('Gmail connection returned an unexpected authorization URL.');
  }
  return url.href;
}

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
  isImportant?: boolean;
  isCompleted: boolean;
  snoozedUntil: null;
  priority: 'urgent' | 'high' | 'normal' | 'fyi';
  category: string;
  actionRequired: boolean;
  reason: string;
  reasons: string[];
  score: number;
  deadline?: string;
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

export async function fetchAllGmailMessages(
  max = 30,
): Promise<{ emails: GmailEmailDto[]; accounts: { id: string; email: string }[] }> {
  return apiFetch<{ emails: GmailEmailDto[]; accounts: { id: string; email: string }[] }>(
    `/api/gmail/messages?max=${max}`,
  );
}

export async function syncGmailAccount(
  accountId: string,
): Promise<{ success: boolean; count: number; syncedAt: string; accountEmail?: string }> {
  return apiFetch<{ success: boolean; count: number; syncedAt: string; accountEmail?: string }>(
    `/api/gmail/${encodeURIComponent(accountId)}/sync`,
    { method: 'POST' },
  );
}

export async function syncAllGmailAccounts(): Promise<{ success: boolean; count: number; syncedAt: string }> {
  return apiFetch<{ success: boolean; count: number; syncedAt: string }>(
    '/api/gmail/sync',
    { method: 'POST' },
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

// ----------------------------------------------------------------
// Notifications & Web Push
// ----------------------------------------------------------------

export async function getVapidPublicKey(): Promise<string> {
  const data = await apiFetch<{ publicKey: string }>('/api/notifications/vapid-public-key');
  return data.publicKey;
}

export async function subscribeWebPush(subscription: PushSubscriptionJSON): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: navigator.userAgent,
    }),
  });
  return res.ok;
}

export async function unsubscribeWebPush(endpoint: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/notifications/unsubscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
  return res.ok;
}

export async function sendTestNotificationApi(): Promise<{
  success: boolean;
  pwaSent: number;
  mobileSent: number;
  totalDevices: number;
  message: string;
}> {
  return apiFetch('/api/notifications/test', { method: 'POST' });
}

// ----------------------------------------------------------------
// Settings
// ----------------------------------------------------------------

export interface UserSettingsDto {
  notifications: boolean;
  vipAlerts: boolean;
  deadlineAlerts: boolean;
  actionAlerts: boolean;
  sensitivity: 'Low' | 'Balanced' | 'High';
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
}

export async function getUserSettings(): Promise<UserSettingsDto> {
  return apiFetch<UserSettingsDto>('/api/settings');
}

export async function updateUserSettings(settings: Partial<UserSettingsDto>): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return res.ok;
}
