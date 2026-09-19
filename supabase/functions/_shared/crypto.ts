// PriorityMail Edge Functions — Token Encryption Helper
// Implements AES-256-GCM encryption compatible with Node.js crypto and Web Crypto.
// Packed layout: [IV (12 bytes)] + [Ciphertext + AuthTag (16 bytes)] -> Base64 string.

function getEncryptionKeyHex(): string {
  const hex =
    Deno.env.get('TOKEN_ENCRYPTION_KEY') ||
    Deno.env.get('ENCRYPTION_KEY');
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[crypto] TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).'
    );
  }
  return hex;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const keyBytes = hexToUint8Array(getEncryptionKeyHex());
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Returns Base64 string containing: 12-byte IV + ciphertext + 16-byte tag.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const packed = new Uint8Array(iv.length + encryptedBytes.length);
  packed.set(iv, 0);
  packed.set(encryptedBytes, iv.length);

  // Convert packed bytes to base64
  let binary = '';
  for (let i = 0; i < packed.length; i++) {
    binary += String.fromCharCode(packed[i]);
  }
  return btoa(binary);
}

/**
 * Decrypts Base64 string produced by `encrypt`.
 */
export async function decrypt(ciphertextBase64: string): Promise<string> {
  const key = await getCryptoKey();
  const binary = atob(ciphertextBase64);
  const packed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    packed[i] = binary.charCodeAt(i);
  }

  const iv = packed.subarray(0, 12);
  const encryptedBytes = packed.subarray(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}
