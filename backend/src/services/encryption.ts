// PriorityMail backend — Encryption Service
// AES-256-GCM symmetric encryption for storing Gmail refresh tokens.
// The ENCRYPTION_KEY env var must be exactly 64 hex characters (32 bytes).
// This module is ONLY used on the server. Encrypted values are NEVER
// sent to the client.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[encryption] TOKEN_ENCRYPTION_KEY (or ENCRYPTION_KEY) must be a 64-character hex string. ' +
      'Generate one with: openssl rand -hex 32',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a UTF-8 plaintext string with AES-256-GCM.
 * Returns a single base64 string encoding: IV | ciphertext | auth-tag.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: [iv (12)] + [ciphertext (variable)] + [tag (16)]
  const packed = Buffer.concat([iv, encrypted, tag]);
  return packed.toString('base64');
}

/**
 * Decrypts a base64 string produced by `encrypt`.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const packed = Buffer.from(ciphertext, 'base64');

  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(packed.length - TAG_BYTES);
  const encrypted = packed.subarray(IV_BYTES, packed.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
