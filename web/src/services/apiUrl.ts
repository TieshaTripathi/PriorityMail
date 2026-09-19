// PriorityMail Web — API URL Helper
// Centralizes resolution of the backend API URL.

import { getSupabaseFunctionsUrl } from './supabaseClient.ts';

/**
 * Returns the configured backend API base URL without a trailing slash.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    (typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_API_URL as string | undefined) ||
        (import.meta.env.VITE_API_BASE_URL as string | undefined)
      : undefined);

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In development against local emulator or dev server
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }

  // Production uses Supabase Edge Functions directly
  return getSupabaseFunctionsUrl();
}

/**
 * Performs a lightweight health check to verify backend reachability.
 */
export async function checkBackendHealth(): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    const base = getSupabaseFunctionsUrl();
    const res = await fetch(`${base}/gmail-accounts`, {
      method: 'OPTIONS',
    });
    return { ok: res.ok || res.status === 204 || res.status === 200, status: 'ok' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not reach server',
    };
  }
}
