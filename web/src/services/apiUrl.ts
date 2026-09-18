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

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In production on Vercel, point directly to the Render backend where
  // Google OAuth callbacks land and set session cookies (SameSite=None; Secure).
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host.endsWith('vercel.app')) {
      return 'https://prioritymail-ovda.onrender.com';
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }

  return 'https://prioritymail-ovda.onrender.com';
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
