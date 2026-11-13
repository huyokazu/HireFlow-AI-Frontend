import 'server-only';

import { googleConfig, REQUESTED_SCOPES } from './config';
import { GoogleApiError } from './errors';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_TIMEOUT_MS = 10_000;

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  token_type?: string;
};

/** Consent URL: offline access with a forced consent screen, so Google always returns a refresh token. */
export function consentUrl(state: string, codeChallenge: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: googleConfig.clientId,
    redirect_uri: googleConfig.redirectUri,
    response_type: 'code',
    scope: REQUESTED_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // Pre-selects the HireFlow user's own account; the callback still enforces the match.
    ...(loginHint && { login_hint: loginHint }),
  });
  return `${AUTH_URL}?${params}`;
}

/** Token and revoke endpoints act before anything is done on the user's behalf (`auth` phase). */
async function postForm(url: string, form: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch (error) {
    throw GoogleApiError.fromThrown(error, 'auth');
  }
}

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const res = await postForm(TOKEN_URL, {
    client_id: googleConfig.clientId,
    client_secret: googleConfig.clientSecret,
    ...form,
  });
  if (!res.ok) throw await GoogleApiError.fromResponse(res, 'auth');
  const body = (await res.json()) as Partial<TokenResponse>;
  if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
    throw new GoogleApiError(502, 'BAD_TOKEN_RESPONSE', 'Google returned an unexpected token response', 'auth');
  }
  return body as TokenResponse;
}

export const exchangeCode = (code: string, codeVerifier: string) =>
  tokenRequest({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: googleConfig.redirectUri });

export const refreshAccessToken = (refreshToken: string) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

/** Best effort: a failure here must not stop the local disconnect. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await postForm(REVOKE_URL, { token });
    return res.ok;
  } catch {
    return false;
  }
}

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean };

/**
 * Identity claims from the id_token. It came straight from Google's token endpoint over TLS, so
 * OpenID Connect allows skipping signature validation here.
 */
export function idTokenClaims(idToken: string | undefined): GoogleIdentity {
  const payload = idToken?.split('.')[1];
  if (!payload) throw new GoogleApiError(502, 'MISSING_ID_TOKEN', 'Google did not return an id_token', 'auth');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
  };
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
    throw new GoogleApiError(502, 'MISSING_ID_TOKEN', 'The id_token has no subject or email', 'auth');
  }
  return { sub: claims.sub, email: claims.email, emailVerified: claims.email_verified === true || claims.email_verified === 'true' };
}
