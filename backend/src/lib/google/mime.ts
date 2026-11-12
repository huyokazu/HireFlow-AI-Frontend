import { randomBytes } from 'node:crypto';

export type MimeMessage = {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
};

const CRLF = '\r\n';
const EMAIL = /^[^\s@<>",;()\\[\]]+@[^\s@<>",;()\\[\]]+\.[^\s@<>",;()\\[\]]+$/;
/** UTF-8 bytes per encoded word: 45 bytes -> 60 base64 chars, so `=?UTF-8?B?…?=` stays within 75 (RFC 2047). */
const WORD_BYTES = 45;

/** CR or LF in a header value would let caller-supplied text inject extra headers (e.g. Bcc). */
function guardHeader(value: string, field: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`Header injection blocked in ${field}`);
  return value;
}

export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

/**
 * RFC 2047 B-encoding for non-ASCII header text (Vietnamese subjects and names). Words are split on
 * code point boundaries, so a multi-byte character is never cut in half, and folded with CRLF SP.
 */
export function encodeHeaderText(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const char of value) {
    if (Buffer.byteLength(chunk + char, 'utf8') > WORD_BYTES) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word, 'utf8').toString('base64')}?=`).join(`${CRLF} `);
}

function mailbox(address: string, name?: string): string {
  guardHeader(address, 'address');
  if (!isEmailAddress(address)) throw new Error('Invalid email address');
  if (!name) return address;
  guardHeader(name, 'display name');
  const display = /^[\x20-\x7e]*$/.test(name) ? `"${name.replace(/["\\]/g, '\\$&')}"` : encodeHeaderText(name);
  return `${display} <${address}>`;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Plain text rendered as minimal HTML, so every message carries both alternatives. */
export const textToHtml = (text: string) =>
  `<div style="font-family:sans-serif;line-height:1.5">${escapeHtml(text).replace(/\r?\n/g, '<br>')}</div>`;

const base64Lines = (text: string) => Buffer.from(text, 'utf8').toString('base64').replace(/.{1,76}/g, `$&${CRLF}`);

/** A multipart/alternative message (RFC 5322 + 2045), CRLF line endings, UTF-8 parts in base64. */
export function buildMime(message: MimeMessage): string {
  const boundary = `hf_${randomBytes(12).toString('hex')}`;
  const subject = encodeHeaderText(guardHeader(message.subject, 'subject'));
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, 'Content-Transfer-Encoding: base64', '', base64Lines(body)].join(CRLF);
  return [
    'MIME-Version: 1.0',
    `To: ${mailbox(message.to, message.toName)}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', message.text),
    part('text/html', message.html ?? textToHtml(message.text)),
    `--${boundary}--`,
    '',
  ].join(CRLF);
}

/** Gmail's `raw` field: the whole message in unpadded base64url. */
export const toGmailRaw = (mime: string) => Buffer.from(mime, 'utf8').toString('base64url');
