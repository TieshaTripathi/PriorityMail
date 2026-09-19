// PriorityMail Web — Supabase Client
// Centralized Supabase client for Authentication, Storage, and Edge Functions.

import { createClient } from '@supabase/supabase-js';

// Static references so Vite replaces them at build time
const envSupabaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    : undefined;
const envSupabaseAnonKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    : undefined;

// Fallback for Node/test environments
const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
const nodeSupabaseUrl = proc?.env?.VITE_SUPABASE_URL;
const nodeSupabaseAnonKey = proc?.env?.VITE_SUPABASE_ANON_KEY;

// Production project fallback for PriorityMail Supabase project
const defaultSupabaseUrl = 'https://hcakoyjungekkjoowovx.supabase.co';

const rawSupabaseUrl = (envSupabaseUrl || nodeSupabaseUrl || defaultSupabaseUrl).trim();
const rawSupabaseAnonKey = (envSupabaseAnonKey || nodeSupabaseAnonKey)?.trim();

export const isSupabaseConfigured = Boolean(rawSupabaseAnonKey && rawSupabaseAnonKey !== 'placeholder');

const supabaseUrl = rawSupabaseUrl;
const supabaseAnonKey =
  rawSupabaseAnonKey ||
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

