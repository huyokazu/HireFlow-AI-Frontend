import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/server';

import { googleConfig } from './config';
import { open, seal } from './crypto';
import { GoogleApiError, GoogleConfigError, GoogleReauthRequired } from './errors';
import { refreshAccessToken, type TokenResponse } from './oauth';

/** Refresh this long before Google's expiry, so a token never expires mid-request. */
const EXPIRY_MARGIN_MS = 60_000;

const expiresAt = (tokens: TokenResponse) => new Date(Date.now() + tokens.expires_in * 1000).toISOString();

/** Stores a fresh grant from the connect flow (tokens sealed, bound to the user). */
export async function saveConnection(
  userId: string,
  identity: { sub: string; email: string },
  tokens: TokenResponse & { refresh_token: string },
  scopes: string[],
): Promise<void> {
  const key = googleConfig.tokenKey;
  const { error } = await supabaseAdmin()
    .from('google_connections')
    .upsert({
      user_id: userId,
      google_sub: identity.sub,
      google_email: identity.email,
      scopes,
      refresh_token_enc: seal(tokens.refresh_token, userId, key),
      access_token_enc: seal(tokens.access_token, userId, key),
      access_token_expires_at: expiresAt(tokens),
      status: 'active',
      last_error: null,
      connected_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function markNeedsReauth(userId: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('google_connections')
    .update({ status: 'needs_reauth', last_error: reason.slice(0, 500), access_token_enc: null, access_token_expires_at: null })
    .eq('user_id', userId);
  if (error) console.error('[google] could not mark needs_reauth', error);
}

/**
 * A valid access token for the user's Google account. The cached token is reused until 60 s
 * before expiry; `force` skips the cache (after a 401). Only a dead grant (`invalid_grant`) flips
 * the connection to `needs_reauth`; an undecryptable token is a server config problem.
 */
export async function getAccessToken(userId: string, options: { force?: boolean } = {}): Promise<string> {
  const { data: row, error } = await supabaseAdmin()
    .from('google_connections')
    .select('status, refresh_token_enc, access_token_enc, access_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!row || row.status !== 'active') throw new GoogleReauthRequired('Google is not connected for this account');

  const key = googleConfig.tokenKey;
  const cachedUntil = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (!options.force && row.access_token_enc && cachedUntil - EXPIRY_MARGIN_MS > Date.now()) {
    try {
      return open(row.access_token_enc, userId, key);
    } catch {
      // Unreadable cache (e.g. rotated key): fall through to a refresh.
    }
  }

  let refreshToken: string;
  try {
    refreshToken = open(row.refresh_token_enc, userId, key);
  } catch (err) {
    // Almost always a changed GOOGLE_TOKEN_ENC_KEY: keep the grant so restoring the key fixes it.
    console.error('[google] stored refresh token does not decrypt; check GOOGLE_TOKEN_ENC_KEY', err);
    throw new GoogleConfigError('Stored Google credentials cannot be decrypted with the current key');
  }

  let tokens: TokenResponse;
  try {
    tokens = await refreshAccessToken(refreshToken);
  } catch (err) {
    if (err instanceof GoogleApiError && err.reason === 'invalid_grant') {
      await markNeedsReauth(userId, err.message);
      throw new GoogleReauthRequired('Google access was revoked or expired; reconnect Google');
    }
    throw err;
  }

  const { error: saveError } = await supabaseAdmin()
    .from('google_connections')
    .update({ access_token_enc: seal(tokens.access_token, userId, key), access_token_expires_at: expiresAt(tokens), last_error: null })
    .eq('user_id', userId);
  if (saveError) console.error('[google] could not cache access token', saveError);
  return tokens.access_token;
}
