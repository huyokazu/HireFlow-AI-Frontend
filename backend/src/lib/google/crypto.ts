import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM. The user id is bound as additional authenticated data, so a sealed token copied
 * into another user's row fails to open instead of acting as that user.
 * Format: `v1.<base64url(iv | tag | ciphertext)>`.
 */
export function seal(plaintext: string, userId: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`google:${userId}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')}`;
}

/** Throws if the value was tampered with, sealed for another user, or sealed with another key. */
export function open(sealed: string, userId: string, key: Buffer): string {
  const [version, body] = sealed.split('.');
  if (version !== VERSION || !body) throw new Error('Unsupported sealed value');
  const raw = Buffer.from(body, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error('Sealed value is truncated');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(`google:${userId}`, 'utf8'));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}

export const sha256Hex = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** PKCE S256 challenge for a code verifier. */
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier, 'ascii').digest('base64url');

/**
 * Calendar event id for an action. Hex is a subset of Google's base32hex id alphabet, and the id
 * is stable, so re-running an action can never create a second event.
 */
export const calendarEventId = (idempotencyKey: string) => sha256Hex(idempotencyKey);
