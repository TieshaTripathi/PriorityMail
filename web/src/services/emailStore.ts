import { supabase } from './supabaseClient.ts';
import type { GmailEmailDto } from './apiClient.ts';

export interface EmailMetadata {
  id: string; user_id: string; connected_account_id: string;
  gmail_message_id: string; gmail_thread_id: string;
  sender_name: string; sender_email: string; subject: string; snippet: string;
  received_at: string; label_ids: string[]; is_read: boolean; is_important: boolean;
  is_completed: boolean; snoozed_until: null; priority: GmailEmailDto['priority'];
  category: string; action_required: boolean; reasons: string[]; score: number; deadline: string | null;
  connected_google_accounts: { email: string };
}

export function metadataToEmail(row: EmailMetadata): GmailEmailDto {
  return {
    id: row.id, accountId: row.connected_account_id, connectedAccountId: row.connected_account_id,
    accountEmail: row.connected_google_accounts.email,
    gmailMessageId: row.gmail_message_id, gmailThreadId: row.gmail_thread_id,
    senderName: row.sender_name || row.sender_email || 'Unknown sender', senderEmail: row.sender_email || '',
    subject: row.subject || '(No Subject)', snippet: row.snippet || '', receivedAt: row.received_at,
    labelIds: row.label_ids || [], isRead: row.is_read, isImportant: row.is_important,
    isCompleted: row.is_completed, snoozedUntil: row.snoozed_until,
    priority: row.priority || 'normal', category: row.category || 'personal',
    actionRequired: row.action_required, reasons: row.reasons || [], reason: row.reasons?.[0] || '',
    score: row.score || 0, deadline: row.deadline || undefined,
  };
}

export function newestFirst(emails: GmailEmailDto[]): GmailEmailDto[] {
  return [...new Map(emails.map(email => [email.id, email])).values()]
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
}

async function ownedQuery(client: typeof supabase) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Please sign in to view email.');
  // RLS enforces ownership server-side; this filter also scopes every query explicitly.
  return { query: client.from('email_metadata').select('*, connected_google_accounts!inner(email)')
    .eq('user_id', user.id) };
}

export async function loadLatestEmails(accountId = 'all', client = supabase): Promise<GmailEmailDto[]> {
  let { query } = await ownedQuery(client);
  if (accountId !== 'all') query = query.eq('connected_account_id', accountId);
  const { data, error } = await query.order('received_at', { ascending: false }).limit(100);
  if (error) throw error;
  return newestFirst(((data || []) as unknown as EmailMetadata[]).map(metadataToEmail));
}

export async function loadEmailById(id: string, client = supabase): Promise<GmailEmailDto | null> {
  // Invalid or old Gmail IDs never become unscoped queries.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { query } = await ownedQuery(client);
  const { data, error } = await query.eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? metadataToEmail(data as unknown as EmailMetadata) : null;
}

export function plainEmailPreview(text: string): string {
  // Always rendered as React text, never HTML. Remove basic Markdown presentation markers.
  return text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}
