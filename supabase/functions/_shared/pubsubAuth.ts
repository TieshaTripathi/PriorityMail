import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export class PubSubValidationError extends Error {
  constructor(public stage: string, public reason: string, message: string) {
    super(message);
  }
}

type StageLog = (stage: string, metadata?: Record<string, unknown>) => void;
function fail(stage: string, reason: string, message: string): never {
  throw new PubSubValidationError(stage, reason, message);
}

export async function verifyPubSubSender(req: Request, log: StageLog = () => {}): Promise<void> {
  const header = req.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/i.test(header)) fail('jwt-verification', 'missing-or-malformed-bearer', 'Pub/Sub authentication required');
  const email = Deno.env.get('PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL');
  const audience = Deno.env.get('PUBSUB_PUSH_AUDIENCE') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-pubsub-webhook`;
  if (!email) fail('jwt-verification', 'sender-email-not-configured', 'Pub/Sub sender authentication is not configured');
  try {
    const { payload } = await jwtVerify(header.slice(7), googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email', 'email_verified'],
    });
    if (payload.email !== email || payload.email_verified !== true) {
      fail('jwt-verification', 'sender-email-mismatch-or-unverified', 'Unexpected Pub/Sub sender');
    }
    log('authenticated-pubsub-sender');
  } catch (error) {
    if (error instanceof PubSubValidationError) throw error;
    // Only library-defined codes/claim names are mapped; never log errors or JWT claims.
    const code = (error as { code?: string })?.code;
    const claim = (error as { claim?: string })?.claim;
    const reason = code === 'ERR_JWT_EXPIRED' ? 'token-expired'
      : code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ? 'invalid-signature'
      : code === 'ERR_JWT_CLAIM_VALIDATION_FAILED'
        ? ({ aud: 'audience-mismatch', iss: 'issuer-mismatch', exp: 'invalid-expiry',
             iat: 'invalid-issued-at', sub: 'invalid-subject', email: 'missing-email',
             email_verified: 'missing-email-verification' } as Record<string, string>)[claim || ''] || 'invalid-required-claim'
      : 'google-jwt-verification-failed';
    fail('jwt-verification', reason, 'Pub/Sub sender verification failed');
  }
}

export function normalizeHistoryId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^[0-9]+$/.test(trimmed) ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

export function parseGmailPush(body: unknown, log: StageLog = () => {}): { emailAddress: string; historyId: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('parse-envelope', 'body-not-object', 'Invalid envelope');
  const envelope = body as Record<string, unknown>;
  if (typeof envelope.subscription !== 'string' ||
      !/^projects\/[^/]+\/subscriptions\/[^/]+$/.test(envelope.subscription)) fail('parse-envelope', 'subscription-missing-or-invalid', 'Invalid subscription');
  const message = envelope.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    fail('parse-envelope', 'message-missing-or-not-object', 'Invalid Pub/Sub message');
  }
  if (typeof message.messageId !== 'string' || !message.messageId) {
    fail('parse-envelope', 'message-id-missing-or-not-string', 'Invalid Pub/Sub message');
  }
  if (typeof message.data !== 'string' || !message.data) {
    fail('parse-envelope', 'message-data-missing-or-not-string', 'Invalid Pub/Sub message');
  }
  if (message.data.length > 16384) {
    fail('parse-envelope', 'message-data-exceeds-limit', 'Invalid Pub/Sub message');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(message.data)) {
    fail('decode-message', 'invalid-base64-encoding', 'Invalid Pub/Sub message');
  }
  log('pubsub-envelope-parsed');
  let event;
  let decoded: string;
  try {
    const bytes = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('decode-message', 'invalid-base64-or-utf8', 'Invalid Pub/Sub message');
  }
  try {
    event = JSON.parse(decoded);
  } catch {
    fail('decode-message', 'decoded-data-not-json', 'Invalid Gmail notification');
  }
  log('gmail-payload-decoded', {
    historyIdType: typeof event?.historyId,
    historyIdPresent: event?.historyId != null,
  });
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    fail('gmail-payload-validation', 'gmail-payload-not-object', 'Invalid Gmail notification');
  }
  if (typeof event.emailAddress !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(event.emailAddress)) {
    fail('gmail-payload-validation', 'email-address-missing-or-invalid', 'Invalid Gmail notification');
  }
  const historyId = normalizeHistoryId(event.historyId);
  if (historyId === null) {
    fail('gmail-payload-validation', 'history-id-missing-or-invalid-or-unsafe', 'Invalid Gmail notification');
  }
  return { emailAddress: event.emailAddress, historyId };
}
