// PriorityMail Edge Functions — Google OAuth Helper
// Standard fetch-based Google OAuth implementation for Deno runtime.

export const GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
];

export function getGoogleCredentials() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('[googleAuth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.');
  }
  return { clientId, clientSecret };
}

export function getGmailRedirectUri(): string {
  const custom = Deno.env.get('GOOGLE_GMAIL_REDIRECT_URI');
  if (custom) return custom;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  return `${supabaseUrl}/functions/v1/gmail-callback`;
}

export function getFrontendUrl(): string {
  const url = Deno.env.get('FRONTEND_URL') || 'https://priority-mail-zeta.vercel.app';
  return url.replace(/\/+$/, '');
}

/**
 * Creates an HMAC-signed OAuth state parameter containing the authenticated userId and timestamp.
 */
export async function signOAuthState(userId: string): Promise<string> {
  const { clientSecret } = getGoogleCredentials();
  const timestamp = Date.now();
  const payload = JSON.stringify({ userId, timestamp, nonce: crypto.randomUUID() });
  const payloadB64 = btoa(payload);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies an HMAC-signed OAuth state parameter and returns the original userId.
 */
export async function verifyOAuthState(signedState: string): Promise<{ userId: string }> {
  const parts = signedState.split('.');
  if (parts.length !== 2) throw new Error('Invalid state format');

  const [payloadB64, sigB64] = parts;
  const { clientSecret } = getGoogleCredentials();

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const expectedSigBytes = new Uint8Array(
    atob(sigB64)
      .split('')
      .map((c) => c.charCodeAt(0))
  );

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    expectedSigBytes,
    enc.encode(payloadB64)
  );

  if (!isValid) throw new Error('State signature verification failed');

  const payload = JSON.parse(atob(payloadB64)) as { userId: string; timestamp: number };

  // 15-minute expiration window
  if (Date.now() - payload.timestamp > 15 * 60 * 1000) {
    throw new Error('OAuth state expired. Please try connecting your account again.');
  }

  return { userId: payload.userId };
}

/**
 * Builds the Google OAuth consent URL for connecting a Gmail mailbox.
 */
export function buildGmailAuthUrl(state: string, redirectUri = getGmailRedirectUri()): string {
  const { clientId } = getGoogleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'select_account consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  idToken?: string;
  scope: string;
}

/**
 * Exchanges authorization code for Google tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri = getGmailRedirectUri()
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Google token response did not contain access_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    idToken: data.id_token,
    scope: data.scope || GMAIL_SCOPES.join(' '),
  };
}

/**
 * Refreshes an expired Google access token.
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string }> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
  };
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Fetches user info from Google's OpenID Connect userinfo endpoint.
 */
export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch Google userinfo (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    sub: data.sub,
    email: data.email,
    name: data.name || data.email,
    picture: data.picture,
  };
}

/**
 * Revokes a Google token.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (err) {
    console.warn('[googleAuth] Revoke token failed (non-fatal):', err);
  }
}
