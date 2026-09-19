// PriorityMail Edge Functions — Supabase Client Helper
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export function getSupabaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('[supabaseClient] Missing SUPABASE_URL');
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!key) throw new Error('[supabaseClient] Missing SUPABASE_ANON_KEY');
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('[supabaseClient] Missing SUPABASE_SERVICE_ROLE_KEY');
  return key;
}

/**
 * Returns a Supabase client with Service Role privileges.
 * Used internally in Edge Functions to manage credentials and Pub/Sub events.
 */
export function getAdminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Returns a Supabase client with the user's authenticated session JWT.
 * Respects Row Level Security (RLS).
 */
export function getUserClient(authHeader: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extracts and verifies the authenticated User from the Authorization header.
 * Throws an Error if token is missing or invalid.
 */
export async function requireUser(req: Request): Promise<{ user: User; token: string }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const adminClient = getAdminClient();
  const { data: { user }, error } = await adminClient.auth.getUser(token);

  if (error || !user) {
    throw new Error('Unauthorized: ' + (error?.message || 'Invalid user session'));
  }

  return { user, token };
}
