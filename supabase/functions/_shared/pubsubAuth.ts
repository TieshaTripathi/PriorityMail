import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyPubSubSender(req: Request): Promise<void> {
  const header = req.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/i.test(header)) throw new Error('Pub/Sub authentication required');
  const email = Deno.env.get('PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL');
  const audience = Deno.env.get('PUBSUB_PUSH_AUDIENCE') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-pubsub-webhook`;
  if (!email) throw new Error('Pub/Sub sender authentication is not configured');
  const { payload } = await jwtVerify(header.slice(7), googleKeys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'email', 'email_verified'],
  });
  if (payload.email !== email || payload.email_verified !== true) {
    throw new Error('Unexpected Pub/Sub sender');
  }
}

export function parseGmailPush(body: unknown): { emailAddress: string; historyId: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid envelope');
  const envelope = body as Record<string, unknown>;
  if (typeof envelope.subscription !== 'string' ||
      !/^projects\/[^/]+\/subscriptions\/[^/]+$/.test(envelope.subscription)) throw new Error('Invalid subscription');
  const message = envelope.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== 'object' || Array.isArray(message) ||
      typeof message.messageId !== 'string' || !message.messageId ||
      typeof message.data !== 'string' || !message.data ||
      message.data.length > 16384 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(message.data)) {
    throw new Error('Invalid Pub/Sub message');
  }
  const bytes = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
  const event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      typeof event.emailAddress !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(event.emailAddress) ||
      typeof event.historyId !== 'string' || !/^[0-9]+$/.test(event.historyId)) {
    throw new Error('Invalid Gmail notification');
  }
  return { emailAddress: event.emailAddress, historyId: event.historyId };
}
