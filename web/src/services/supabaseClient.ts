// PriorityMail Web — Supabase Client
// Centralized Supabase client for Authentication, Storage, and Edge Functions.

import { createClient } from '@supabase/supabase-js';

const getEnvVar = (name: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[name] as string | undefined;
  }
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
  if (proc?.env) {
    return proc.env[name];
  }
  return undefined;
};

const rawSupabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const rawSupabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(rawSupabaseUrl && rawSupabaseAnonKey);

const supabaseUrl = rawSupabaseUrl?.trim() || 'https://placeholder-project.supabase.co';
const supabaseAnonKey =
  rawSupabaseAnonKey?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseFunctionsUrl(): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;
}
