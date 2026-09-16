// PriorityMail backend — Google Auth Service
// Handles all OAuth 2.0 server-side flows.
// NEVER exposes client_secret or refresh tokens to the client.

import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  sub: string;          // Google unique user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;  // ISO-8601
  idToken?: string;
  scope: string;
}

/** Scopes for PriorityMail *login* only (identity — no Gmail access). */
export const LOGIN_SCOPES = [
  'openid',
  'email',
  'profile',
];

/** Scopes for *Gmail account connection* (read-only, no send/delete). */
export const GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
];

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      '[googleAuth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.',
    );
  }
  return { clientId, clientSecret };
}

export function getLoginRedirectUri(): string {
  return (
    process.env.GOOGLE_AUTH_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:4000/api/auth/google/callback'
  );
}

export function getGmailRedirectUri(): string {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
    process.env.GMAIL_REDIRECT_URI ||
    'http://localhost:4000/api/accounts/google/callback'
  );
}

/**
 * Build an OAuth2 URL for user login (identity scopes only).
 */
export function buildLoginAuthUrl(state: string): string {
  const { clientId, clientSecret } = getClientCredentials();
  const redirectUri = getLoginRedirectUri();

  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: LOGIN_SCOPES,
    state,
    prompt: 'select_account consent',
  });
}

/**
 * Build an OAuth2 URL for connecting a Gmail account (Gmail read scopes).
 */
export function buildGmailAuthUrl(state: string): string {
  const { clientId, clientSecret } = getClientCredentials();
  const redirectUri = getGmailRedirectUri();

  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state,
    prompt: 'select_account consent',  // Force account picker so user can add a different account
    include_granted_scopes: false,
  });
}

/**
 * Exchange an authorization code for tokens (login flow).
 */
export async function exchangeLoginCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const redirectUri = getLoginRedirectUri();
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);

  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error('[googleAuth] No access_token in response.');

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
    idToken: tokens.id_token ?? undefined,
    scope: tokens.scope ?? LOGIN_SCOPES.join(' '),
  };
}

/**
 * Exchange an authorization code for tokens (Gmail connection flow).
 */
export async function exchangeGmailCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const redirectUri = getGmailRedirectUri();
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);

  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error('[googleAuth] No access_token in response.');
  if (!tokens.refresh_token) {
    throw new Error(
      '[googleAuth] No refresh_token returned. ' +
      'Ensure access_type=offline and prompt=consent in the auth URL.',
    );
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
    idToken: tokens.id_token ?? undefined,
    scope: tokens.scope ?? GMAIL_SCOPES.join(' '),
  };
}

/**
 * Verify a Google ID token and extract the user profile.
 */
export async function verifyIdToken(idToken: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = getClientCredentials();
  const client = new OAuth2Client(clientId, clientSecret);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('[googleAuth] Invalid ID token payload.');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified ?? false,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}

/**
 * Build an authenticated OAuth2Client for a connected Gmail account,
 * using stored (decrypted) tokens. Automatically refreshes if expired.
 */
export function buildOAuth2Client(
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
): OAuth2Client {
  const { clientId, clientSecret } = getClientCredentials();
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: new Date(expiresAt).getTime(),
  });
  return client;
}

/**
 * Refresh the access token for a connected account and return the new token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string }> {
  const { clientId, clientSecret } = getClientCredentials();
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('[googleAuth] Token refresh failed.');
  }
  return {
    accessToken: credentials.access_token,
    expiresAt: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}
