import 'server-only';

export type GoogleMode = 'live' | 'simulated' | 'auto';

/** Scopes the Operations Agent needs. `openid email` identify the account; Google reports `email` as userinfo.email. */
export const REQUESTED_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.freebusy',
] as const;

/** Users can untick boxes on the consent screen; without these the agent cannot act. */
export const REQUIRED_API_SCOPES = REQUESTED_SCOPES.slice(2);

export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Google configuration, read lazily so routes that never touch Google work without it. */
export const googleConfig = {
  get clientId() {
    return process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  },
  get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  },
  get redirectUri() {
    return process.env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost:3000/api/integrations/google/callback';
  },
  get mode(): GoogleMode {
    const mode = process.env.GOOGLE_MODE?.trim();
    return mode === 'live' || mode === 'simulated' ? mode : 'auto';
  },
  /** Extra allowed `returnTo` prefixes for the connect flow (comma-separated). */
  get returnToAllowlist(): string[] {
    return (process.env.GOOGLE_RETURN_TO_ALLOWLIST ?? '')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter(Boolean);
  },
  /**
   * Lets a user connect a Google account whose email differs from their HireFlow email. Off by
   * default: the check stops a forwarded consent link from attaching someone else's Gmail.
   */
  get allowAnyAccount() {
    return process.env.GOOGLE_ALLOW_ANY_ACCOUNT?.trim() === '1';
  },
  /** Demo safety net: when set, every outbound recipient and attendee is replaced by this address. */
  get redirectEmail() {
    return process.env.OPERATIONS_REDIRECT_EMAIL?.trim() ?? '';
  },
  /** AES-256 key for sealing tokens (base64, 32 bytes). */
  get tokenKey(): Buffer {
    const key = Buffer.from(process.env.GOOGLE_TOKEN_ENC_KEY ?? '', 'base64');
    if (key.length !== 32) throw new Error('GOOGLE_TOKEN_ENC_KEY must be 32 bytes, base64-encoded');
    return key;
  },
};
