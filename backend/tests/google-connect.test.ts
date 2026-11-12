import { createHash } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { GET as callback } from '@/app/api/integrations/google/callback/route';
import { GET as health } from '@/app/api/integrations/google/health/route';
import { DELETE as disconnect, GET as status } from '@/app/api/integrations/google/route';
import { POST as start } from '@/app/api/integrations/google/start/route';

import { admin, callRoute, createTestUser, deleteTestUser, type TestUser } from './helpers';

const ALL_SCOPES =
  'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send ' +
  'https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.freebusy';

type Call = { url: string; body: string };
type Handler = (url: string, body: string) => Response | undefined;

const realFetch = globalThis.fetch;
const calls: Call[] = [];
let google: Handler = () => undefined;

const json = (body: unknown, status = 200) => Response.json(body, { status });
const idToken = (email: string, verified = true) =>
  `x.${Buffer.from(JSON.stringify({ sub: 'google-sub-1', email, email_verified: verified })).toString('base64url')}.sig`;
/** Google's token response; the account defaults to the HireFlow user's own email (upper-cased: compared case-insensitively). */
const tokenResponse = (email: string, scope = ALL_SCOPES, verified = true) =>
  json({ access_token: 'ya29.access', expires_in: 3599, refresh_token: '1//refresh', scope, id_token: idToken(email, verified) });

/** Starts the flow and returns the state Google would send back. */
async function beginFlow(user: TestUser, returnTo = 'hireflow://settings'): Promise<string> {
  const res = await callRoute(start, { method: 'POST', token: user.token, body: { returnTo } });
  expect(res.status).toBe(200);
  return new URL(res.body.data.url).searchParams.get('state')!;
}

const finish = (query: string) => callRoute(callback, { path: `/api/integrations/google/callback?${query}` });

describe('Google connect flow', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser('google');
    // Google endpoints are answered by `google`; everything else (Supabase) passes through.
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!/^https:\/\/([a-z0-9]+\.)?(googleapis\.com|google\.com)\//.test(url)) return realFetch(input, init);
      const body = init?.body === undefined ? '' : String(init.body);
      calls.push({ url, body });
      const res = google(url, body);
      if (!res) throw new Error(`unexpected Google call: ${url}`);
      return res;
    });
  });

  afterEach(() => {
    calls.length = 0;
    google = () => undefined;
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GOOGLE_MODE = 'simulated';
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await deleteTestUser(user);
  });

  const configure = () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  };

  it('start returns 503 when Google is not configured', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    const res = await callRoute(start, { method: 'POST', token: user.token, body: { returnTo: 'hireflow://settings' } });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
  });

  it('start builds an offline PKCE consent URL and stores only the state hash', async () => {
    configure();
    expect((await callRoute(start, { method: 'POST', token: user.token, body: { returnTo: 'https://evil.example.com' } })).status).toBe(400);
    const res = await callRoute(start, { method: 'POST', token: user.token, body: { returnTo: 'hireflow://settings' } });
    const url = new URL(res.body.data.url);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const p = url.searchParams;
    expect([p.get('access_type'), p.get('prompt'), p.get('include_granted_scopes'), p.get('code_challenge_method')]).toEqual([
      'offline', 'consent', 'true', 'S256',
    ]);
    expect(p.get('scope')).toContain('https://www.googleapis.com/auth/gmail.send');
    expect(p.get('login_hint')).toBe(user.email);
    const hash = createHash('sha256').update(p.get('state')!).digest('hex');
    const { data } = await admin.from('oauth_states').select('user_id, return_to').eq('state_hash', hash).single();
    expect(data).toEqual({ user_id: user.id, return_to: 'hireflow://settings' });
  });

  it('callback handles denial, missing scopes, and a forged state', async () => {
    configure();
    expect((await finish(`state=${await beginFlow(user)}&error=access_denied`)).headers.get('location')).toBe(
      'hireflow://settings?google=denied',
    );

    google = (url) =>
      url.endsWith('/token')
        ? tokenResponse(user.email, 'openid https://www.googleapis.com/auth/gmail.send')
        : url.endsWith('/revoke')
          ? json({})
          : undefined;
    const partial = await finish(`state=${await beginFlow(user)}&code=abc`);
    expect(partial.headers.get('location')).toBe('hireflow://settings?google=missing_scopes');
    expect(calls.some((c) => c.url.endsWith('/revoke'))).toBe(true);

    expect((await finish('state=forged&code=abc')).status).toBe(400);
  });

  it('callback refuses a Google account that is not the HireFlow user (forwarded consent link)', async () => {
    configure();
    for (const [email, verified] of [['victim@example.com', true], [user.email, false]] as const) {
      google = (url) => (url.endsWith('/token') ? tokenResponse(email, ALL_SCOPES, verified) : url.endsWith('/revoke') ? json({}) : undefined);
      const res = await finish(`state=${await beginFlow(user)}&code=victim-code`);
      expect(res.headers.get('location')).toBe('hireflow://settings?google=account_mismatch');
      expect(calls.some((c) => c.url.endsWith('/revoke') && new URLSearchParams(c.body).get('token') === '1//refresh')).toBe(true);
      calls.length = 0;
    }
    const { data } = await admin.from('google_connections').select('user_id').eq('user_id', user.id);
    expect(data).toEqual([]);
  });

  it('callback stores sealed tokens once; replaying the state fails', async () => {
    configure();
    google = (url) => (url.endsWith('/token') ? tokenResponse(user.email.toUpperCase()) : undefined);
    const state = await beginFlow(user);
    const res = await finish(`state=${state}&code=good-code`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('hireflow://settings?google=connected');
    const exchange = new URLSearchParams(calls[0].body);
    expect(exchange.get('grant_type')).toBe('authorization_code');
    expect(exchange.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { data } = await admin.from('google_connections').select('*').eq('user_id', user.id).single();
    expect(data).toMatchObject({ status: 'active', google_email: user.email.toUpperCase() });
    expect(data!.refresh_token_enc).not.toContain('refresh');
    expect((await finish(`state=${state}&code=good-code`)).status).toBe(400);

    const current = await callRoute(status, { token: user.token });
    expect(current.body.data).toMatchObject({ connected: true, status: 'active', email: user.email.toUpperCase() });
  });

  it('a 401 forces one refresh; health reports live status; delete revokes', async () => {
    configure();
    process.env.GOOGLE_MODE = 'live';
    let freeBusyCalls = 0;
    google = (url) => {
      if (url.endsWith('/token')) return tokenResponse(user.email);
      if (url.endsWith('/revoke')) return json({});
      if (url.endsWith('/freeBusy')) return ++freeBusyCalls === 1 ? json({ error: { status: 'UNAUTHENTICATED' } }, 401) : json({ calendars: { primary: { busy: [] } } });
      return undefined;
    };
    const res = await callRoute(health, { token: user.token });
    expect(res.body.data).toEqual({ ok: true, mode: 'live', email: user.email.toUpperCase() });
    expect(freeBusyCalls).toBe(2);

    const removed = await callRoute(disconnect, { method: 'DELETE', token: user.token });
    expect(removed.body.data).toEqual({ disconnected: true });
    expect(calls.some((c) => c.url.endsWith('/revoke') && new URLSearchParams(c.body).get('token') === '1//refresh')).toBe(true);
    expect((await callRoute(status, { token: user.token })).body.data).toMatchObject({ connected: false, status: null });
  });
});
