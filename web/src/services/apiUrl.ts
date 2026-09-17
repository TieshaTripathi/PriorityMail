// PriorityMail Web — API URL Helper
// Centralizes resolution of the backend API URL.

/**
 * Returns the configured backend API base URL without a trailing slash.
 * Defaults to 'http://localhost:4000' during local development.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined);

  // In browser environments on Vercel or localhost, prefer same-origin relative URLs ('')
  // so API requests go through the same origin (Vercel proxy / Vite dev proxy),
  // ensuring session cookies are treated as 1st-party on iOS Safari and PWA mode.
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host.endsWith('vercel.app') || host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }

  const url = (envUrl && envUrl.trim().length > 0) ? envUrl.trim() : '';
  return url.replace(/\/+$/, '');
}

/**
 * Performs a lightweight health check to verify backend reachability.
 */
export async function checkBackendHealth(): Promise<{ ok: boolean; status?: string; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `Backend returned HTTP ${res.status}` };
    }
    const data = (await res.json()) as { status?: string; ok?: boolean };
    return { ok: true, status: data.status || 'ok' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not reach server',
    };
  }
}
