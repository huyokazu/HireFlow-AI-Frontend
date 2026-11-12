import 'server-only';

import { ApiError } from '@/lib/api/http';
import type { GoogleConnectionStatus } from '@/lib/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';

import { googleConfig, REQUIRED_API_SCOPES } from './config';
import { open, pkceChallenge, randomToken, sha256Hex } from './crypto';
import { consentUrl, exchangeCode, type GoogleIdentity, idTokenClaims, revokeToken } from './oauth';
import { saveConnection } from './tokens';

const STATE_TTL_MS = 10 * 60_000;

/** A prefix only matches at a boundary, so `https://app.example.com` does not allow `https://app.example.com.evil.io`. */
function matchesPrefix(value: string, prefix: string): boolean {
  if (!value.startsWith(prefix)) return false;
  const next = value.charAt(prefix.length);
  return /[/?#]$/.test(prefix) || prefix.endsWith('://') || next === '' || '/?#'.includes(next);
}

/** Where the callback may send the browser. Anything else would make the API an open redirect. */
export function isAllowedReturnTo(returnTo: string): boolean {
  if (returnTo.length > 500 || /[\s\x00-\x1f\x7f]/.test(returnTo)) return false;
  if (returnTo.startsWith('hireflow://')) return true;
  if (process.env.NODE_ENV !== 'production' && returnTo.startsWith('exp://')) return true;
  try {
    const url = new URL(returnTo);
    if (url.protocol === 'http:' && url.hostname === 'localhost' && !url.username && !url.password) return true;
  } catch {
    return false;
  }
  return googleConfig.returnToAllowlist.some((prefix) => matchesPrefix(returnTo, prefix));
}

export type ConnectResult = 'connected' | 'denied' | 'missing_scopes' | 'account_mismatch' | 'error';

export function withGoogleResult(returnTo: string, result: ConnectResult): string {
  const [base, fragment] = returnTo.split('#', 2);
  const joined = `${base}${base.includes('?') ? '&' : '?'}google=${result}`;
  return fragment === undefined ? joined : `${joined}#${fragment}`;
}

/** Writes a single-use state row (only its hash is stored) and returns Google's consent URL. */
export async function startConnect(userId: string, email: string | undefined, returnTo: string): Promise<string> {
  if (!googleConfig.clientId || !googleConfig.clientSecret) {
    throw new ApiError(503, 'GOOGLE_NOT_CONFIGURED', 'Google integration is not configured on this server');
  }
  if (!isAllowedReturnTo(returnTo)) throw new ApiError(400, 'VALIDATION_FAILED', 'returnTo is not an allowed app URL');

  const state = randomToken();
  const verifier = randomToken();
  const db = supabaseAdmin();
  // Housekeeping for abandoned flows; runs alongside the insert and never fails the request.
  void db
    .from('oauth_states')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .then(({ error }) => error && console.warn('[google] expired state cleanup failed', error.message));
  const { error } = await db.from('oauth_states').insert({
    state_hash: sha256Hex(state),
    user_id: userId,
    code_verifier: verifier,
    return_to: returnTo,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return consentUrl(state, pkceChallenge(verifier), email);
}

/**
 * The Google account must belong to the HireFlow user who started the flow. Without this, someone
 * could forward their own consent link and capture the recipient's Gmail under their account.
 */
async function isSameAccount(userId: string, identity: GoogleIdentity): Promise<boolean> {
  if (googleConfig.allowAnyAccount) return true;
  if (!identity.emailVerified) return false;
  const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId);
  if (error) throw error;
  const own = data.user?.email?.trim().toLowerCase();
  return Boolean(own) && own === identity.email.trim().toLowerCase();
}

export type CallbackOutcome =
  | { returnTo: string; result: Exclude<ConnectResult, 'connected'> }
  | { returnTo: string; result: 'connected'; userId: string };

/**
 * Consumes the state row atomically (DELETE … RETURNING), so a replayed or forged callback finds
 * nothing. Throws ApiError when no valid state exists, since there is no safe place to redirect.
 */
export async function completeConnect(params: URLSearchParams): Promise<CallbackOutcome> {
  const state = params.get('state');
  if (!state) throw new ApiError(400, 'INVALID_STATE', 'Missing OAuth state');
  const { data: row, error } = await supabaseAdmin()
    .from('oauth_states')
    .delete()
    .eq('state_hash', sha256Hex(state))
    .select('user_id, code_verifier, return_to, expires_at')
    .maybeSingle();
  if (error) throw error;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, 'INVALID_STATE', 'This Google sign-in link expired; start again from the app');
  }

  const returnTo = row.return_to;
  const code = params.get('code');
  if (params.get('error') || !code) return { returnTo, result: params.get('error') === 'access_denied' ? 'denied' : 'error' };

  try {
    const tokens = await exchangeCode(code, row.code_verifier);
    const granted = (tokens.scope ?? '').split(' ').filter(Boolean);
    if (!tokens.refresh_token || REQUIRED_API_SCOPES.some((scope) => !granted.includes(scope))) {
      await revokeToken(tokens.refresh_token ?? tokens.access_token);
      return { returnTo, result: tokens.refresh_token ? 'missing_scopes' : 'error' };
    }
    const identity = idTokenClaims(tokens.id_token);
    if (!(await isSameAccount(row.user_id, identity))) {
      await revokeToken(tokens.refresh_token);
      return { returnTo, result: 'account_mismatch' };
    }
    await saveConnection(row.user_id, identity, { ...tokens, refresh_token: tokens.refresh_token }, granted);
    return { returnTo, result: 'connected', userId: row.user_id };
  } catch (err) {
    console.error('[google] connect callback failed', err);
    return { returnTo, result: 'error' };
  }
}

export async function connectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const { data, error } = await supabaseAdmin()
    .from('google_connections')
    .select('status, google_email, scopes, connected_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    connected: data?.status === 'active',
    status: (data?.status as GoogleConnectionStatus['status']) ?? null,
    email: data?.google_email ?? null,
    scopes: data?.scopes ?? [],
    connectedAt: data?.connected_at ? new Date(data.connected_at).toISOString() : null,
    mode: googleConfig.mode,
  };
}

/** Revokes the grant at Google (best effort) and forgets it locally either way. */
export async function disconnect(userId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from('google_connections').select('refresh_token_enc').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return;
  try {
    await revokeToken(open(data.refresh_token_enc, userId, googleConfig.tokenKey));
  } catch (err) {
    console.warn('[google] revoke skipped', err instanceof Error ? err.message : err);
  }
  const { error: deleteError } = await db.from('google_connections').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
}
