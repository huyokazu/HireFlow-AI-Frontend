import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { isAllowedReturnTo, withGoogleResult } from '@/lib/google/connect';
import { calendarEventId, open, pkceChallenge, seal } from '@/lib/google/crypto';
import { buildMime, encodeHeaderText, toGmailRaw } from '@/lib/google/mime';
import { defaultInterviewWindow, findFreeSlot } from '@/lib/google/slots';

const key = randomBytes(32);
const USER = '11111111-1111-1111-1111-111111111111';

/** Minimal RFC 2047 B-word decoder, independent of the encoder under test. */
function decodeWords(header: string): string {
  return header
    .replace(/\r\n /g, '')
    .replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g, (_m, b64: string) => Buffer.from(b64, 'base64').toString('utf8'));
}

function headerOf(mime: string, name: string): string {
  const head = mime.split('\r\n\r\n')[0];
  const match = head.match(new RegExp(`^${name}: (.*(?:\\r\\n .*)*)`, 'm'));
  if (!match) throw new Error(`no ${name} header`);
  return match[1];
}

describe('token sealing', () => {
  it('round-trips and never stores the plaintext', () => {
    const sealed = seal('1//refresh-token', USER, key);
    expect(sealed).not.toContain('refresh-token');
    expect(open(sealed, USER, key)).toBe('1//refresh-token');
  });

  it('rejects a tampered value', () => {
    const sealed = seal('secret', USER, key);
    const body = sealed.slice(3);
    const flipped = body.slice(0, -2) + (body.at(-2) === 'A' ? 'B' : 'A') + body.at(-1);
    expect(() => open(`v1.${flipped}`, USER, key)).toThrow();
  });

  it('rejects another user (AAD) and another key', () => {
    const sealed = seal('secret', USER, key);
    expect(() => open(sealed, '22222222-2222-2222-2222-222222222222', key)).toThrow();
    expect(() => open(sealed, USER, randomBytes(32))).toThrow();
  });

  it('derives an S256 PKCE challenge and hex calendar event ids', () => {
    // RFC 7636 appendix B test vector.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    const id = calendarEventId('interview:abc:r1');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(calendarEventId('interview:abc:r1')).toBe(id);
  });
});

describe('MIME builder', () => {
  const subject = 'Thư mời nhận việc – Kỹ sư Backend Go tại HireFlow (Hồ Chí Minh) 🎉';

  it('encodes a Vietnamese subject and name that decode back exactly', () => {
    const mime = buildMime({ to: 'an@example.com', toName: 'Nguyễn Văn An', subject, text: 'Xin chào An' });
    const encoded = headerOf(mime, 'Subject');
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    for (const word of encoded.split('\r\n ')) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeWords(encoded)).toBe(subject);
    expect(decodeWords(headerOf(mime, 'To'))).toBe('Nguyễn Văn An <an@example.com>');
    expect(mime).toContain('Content-Type: multipart/alternative;');
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
  });

  it('keeps plain ASCII headers readable and quotes ASCII names', () => {
    expect(encodeHeaderText('Offer: Backend Engineer')).toBe('Offer: Backend Engineer');
    expect(headerOf(buildMime({ to: 'a@example.com', toName: 'Ann "A" Lee', subject: 's', text: 't' }), 'To')).toBe(
      '"Ann \\"A\\" Lee" <a@example.com>',
    );
  });

  it('blocks CRLF header injection and invalid addresses', () => {
    expect(() => buildMime({ to: 'a@example.com', subject: 'Hi\r\nBcc: evil@example.com', text: 't' })).toThrow(/injection/);
    expect(() => buildMime({ to: 'a@example.com\nBcc: x@example.com', subject: 's', text: 't' })).toThrow(/injection/);
    expect(() => buildMime({ to: 'a@example.com', toName: 'A\rB', subject: 's', text: 't' })).toThrow(/injection/);
    expect(() => buildMime({ to: 'not-an-email', subject: 's', text: 't' })).toThrow(/Invalid email/);
  });

  it('produces an unpadded base64url raw value that decodes to the message', () => {
    const mime = buildMime({ to: 'a@example.com', subject, text: 'Chúc mừng!\nHẹn gặp lại.', html: '<p>Chúc mừng!</p>' });
    const raw = toGmailRaw(mime);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(raw, 'base64url').toString('utf8')).toBe(mime);
    expect(mime.split('\r\n').every((line) => !line.includes('\n'))).toBe(true);
  });
});

describe('slot finder', () => {
  const zone = 'Asia/Ho_Chi_Minh';
  const base = { durationMinutes: 45, timeZone: zone, busy: [] as { start: string; end: string }[] };

  it('skips the end of Friday and the weekend', () => {
    const slot = findFreeSlot({ ...base, windowStart: '2026-11-13T17:30:00+07:00', windowEnd: '2026-11-20T18:00:00+07:00' });
    expect(slot).toEqual({ start: '2026-11-16T02:00:00.000Z', end: '2026-11-16T02:45:00.000Z' });
  });

  it('moves past busy intervals on 30-minute boundaries', () => {
    const slot = findFreeSlot({
      ...base,
      windowStart: '2026-11-16T09:00:00+07:00',
      windowEnd: '2026-11-16T18:00:00+07:00',
      busy: [{ start: '2026-11-16T09:00:00+07:00', end: '2026-11-16T10:15:00+07:00' }],
    });
    expect(slot?.start).toBe('2026-11-16T03:30:00.000Z');
  });

  it('respects working hours, alignment and the window end', () => {
    expect(findFreeSlot({ ...base, windowStart: '2026-11-16T06:00:00+07:00', windowEnd: '2026-11-17T00:00:00+07:00' })?.start).toBe(
      '2026-11-16T02:00:00.000Z',
    );
    expect(findFreeSlot({ ...base, windowStart: '2026-11-16T09:10:00+07:00', windowEnd: '2026-11-17T00:00:00+07:00' })?.start).toBe(
      '2026-11-16T02:30:00.000Z',
    );
    expect(findFreeSlot({ ...base, windowStart: '2026-11-16T17:30:00+07:00', windowEnd: '2026-11-16T23:59:00+07:00' })).toBeNull();
  });

  it('uses the payload time zone for working hours', () => {
    const slot = findFreeSlot({ ...base, timeZone: 'America/New_York', windowStart: '2026-11-16T00:00:00Z', windowEnd: '2026-11-18T00:00:00Z' });
    expect(slot?.start).toBe('2026-11-16T14:00:00.000Z');
  });

  it('default window runs from the next business day 09:00 for five business days', () => {
    expect(defaultInterviewWindow(new Date('2026-11-13T15:00:00+07:00'), zone)).toEqual({
      start: '2026-11-16T02:00:00.000Z',
      end: '2026-11-23T02:00:00.000Z',
    });
  });
});

describe('connect returnTo allowlist', () => {
  it('allows app schemes and localhost, rejects open redirects', () => {
    expect(isAllowedReturnTo('hireflow://settings/integrations')).toBe(true);
    expect(isAllowedReturnTo('exp://192.168.1.5:8081/--/settings')).toBe(true);
    expect(isAllowedReturnTo('http://localhost:8081/settings')).toBe(true);
    expect(isAllowedReturnTo('https://evil.example.com')).toBe(false);
    expect(isAllowedReturnTo('http://localhost.evil.com/')).toBe(false);
    expect(isAllowedReturnTo('http://user@localhost:8081/')).toBe(false);
    expect(isAllowedReturnTo('hireflow://x\r\nSet-Cookie: a')).toBe(false);
  });

  it('honours configured prefixes only at a boundary', () => {
    process.env.GOOGLE_RETURN_TO_ALLOWLIST = 'https://app.hireflow.ai';
    try {
      expect(isAllowedReturnTo('https://app.hireflow.ai/settings')).toBe(true);
      expect(isAllowedReturnTo('https://app.hireflow.ai.evil.io/')).toBe(false);
    } finally {
      delete process.env.GOOGLE_RETURN_TO_ALLOWLIST;
    }
  });

  it('appends the result without breaking existing queries or fragments', () => {
    expect(withGoogleResult('hireflow://settings', 'connected')).toBe('hireflow://settings?google=connected');
    expect(withGoogleResult('http://localhost:8081/s?tab=1#top', 'denied')).toBe('http://localhost:8081/s?tab=1&google=denied#top');
  });
});
