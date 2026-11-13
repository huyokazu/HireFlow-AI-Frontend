import { createHash } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as callback } from '@/app/api/integrations/google/callback/route';
import { POST as start } from '@/app/api/integrations/google/start/route';
import { POST as retry } from '@/app/api/operations/actions/[actionId]/retry/route';
import { GoogleConfigError, GoogleReauthRequired } from '@/lib/google/errors';
import { resolveMode } from '@/lib/google/ops';
import { getAccessToken } from '@/lib/google/tokens';
import { executeAction } from '@/lib/operations/executor';

import { admin, callRoute, createTestUser, deleteTestUser, type TestUser } from './helpers';

const SCOPES =
  'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send ' +
  'https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.freebusy';
const DAY = 86_400_000;

type Handler = (url: string, init: RequestInit | undefined) => Response | undefined;
const realFetch = globalThis.fetch;
const calls: { url: string; method: string; body: string }[] = [];
let google: Handler = () => undefined;

const json = (body: unknown, status = 200) => Response.json(body, { status });
const tokens = (email: string) =>
  json({
    access_token: 'ya29.access',
    expires_in: 3599,
    refresh_token: '1//refresh',
    scope: SCOPES,
    id_token: `x.${Buffer.from(JSON.stringify({ sub: 'sub-live', email, email_verified: true })).toString('base64url')}.sig`,
  });

describe('Google live mode', () => {
  let user: TestUser;
  let stranger: TestUser;

  async function connect() {
    const started = await callRoute(start, { method: 'POST', token: user.token, body: { returnTo: 'hireflow://settings' } });
    const state = new URL(started.body.data.url).searchParams.get('state');
    return callRoute(callback, { path: `/api/integrations/google/callback?state=${state}&code=c` });
  }

  async function insertAction(kind: 'send_email' | 'schedule_interview', key: string) {
    const payload =
      kind === 'send_email'
        ? { candidateName: 'Lê Văn Bình', to: 'binh@example.com', subject: 'Thư mời', text: 'Xin chào', purpose: 'general' }
        : {
            candidateName: 'Lê Văn Bình',
            candidateEmail: 'binh@example.com',
            interviewers: [],
            title: 'Interview',
            description: '',
            durationMinutes: 45,
            windowStart: new Date(Date.now() + DAY).toISOString(),
            windowEnd: new Date(Date.now() + 8 * DAY).toISOString(),
            timeZone: 'Asia/Ho_Chi_Minh',
          };
    const { data, error } = await admin
      .from('agent_actions')
      .insert({ workspace_id: user.workspaceId, requested_by: user.id, kind, idempotency_key: key, status: 'approved', payload })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  const row = async (id: string) => (await admin.from('agent_actions').select('*').eq('id', id).single()).data!;
  const expireCachedToken = () =>
    admin.from('google_connections').update({ access_token_expires_at: new Date(0).toISOString() }).eq('user_id', user.id);

  beforeAll(async () => {
    [user, stranger] = await Promise.all([createTestUser('live'), createTestUser('live-none')]);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!/^https:\/\/([a-z0-9]+\.)?(googleapis\.com|google\.com)\//.test(url)) return realFetch(input, init);
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body === undefined ? '' : String(init.body) });
      const res = google(url, init);
      if (!res) throw new Error(`unexpected Google call: ${url}`);
      return res;
    });
  });

  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.GOOGLE_MODE = 'auto';
    google = (url) => (url.endsWith('/token') ? tokens(user.email) : undefined);
    expect((await connect()).headers.get('location')).toBe('hireflow://settings?google=connected');
    calls.length = 0;
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GOOGLE_MODE = 'simulated';
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await Promise.all([deleteTestUser(user), deleteTestUser(stranger)]);
  });

  it('auto mode is simulated only without OAuth config or without any connection', async () => {
    expect(await resolveMode(stranger.id)).toBe('simulated');
    expect(await resolveMode(user.id)).toBe('live');
    await admin.from('google_connections').update({ status: 'needs_reauth' }).eq('user_id', user.id);
    expect(await resolveMode(user.id)).toBe('live');
    process.env.GOOGLE_CLIENT_ID = '';
    expect(await resolveMode(user.id)).toBe('simulated');
  });

  it('invalid_grant → needs_reauth; auto mode then blocks instead of faking; reconnect re-runs it', async () => {
    await expireCachedToken();
    google = (url) => (url.endsWith('/token') ? json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400) : undefined);
    await expect(getAccessToken(user.id)).rejects.toBeInstanceOf(GoogleReauthRequired);
    const { data } = await admin.from('google_connections').select('status, last_error').eq('user_id', user.id).single();
    expect(data).toEqual({ status: 'needs_reauth', last_error: 'Token has been expired or revoked.' });

    const id = await insertAction('send_email', 'test:blocked');
    expect(await executeAction(id)).toBe('blocked_reauth');
    expect((await row(id)).simulated).toBe(false);

    google = (url) => (url.endsWith('/token') ? tokens(user.email) : url.includes('/messages/send') ? json({ id: 'gmail-msg-1' }) : undefined);
    await connect();
    for (let i = 0; i < 50 && (await row(id)).status !== 'succeeded'; i += 1) await new Promise((r) => setTimeout(r, 100));
    expect(await row(id)).toMatchObject({ status: 'succeeded', provider_ref: 'gmail-msg-1', simulated: false });
    const mime = Buffer.from(JSON.parse(calls.find((c) => c.url.includes('/messages/send'))!.body).raw, 'base64url').toString('utf8');
    expect(mime).toContain('To: =?UTF-8?B?');
  });

  it('a token refresh failure is retryable; only a Gmail send failure is ambiguous', async () => {
    await expireCachedToken();
    google = (url) => (url.endsWith('/token') ? json({ error: 'backend_error' }, 503) : undefined);
    const first = await insertAction('send_email', 'test:refresh-503');
    expect(await executeAction(first)).toBe('failed');
    expect((await row(first)).error).toMatch(/^GOOGLE_AUTH_UNAVAILABLE: /);

    google = (url) =>
      url.endsWith('/token') ? tokens(user.email) : url.includes('/messages/send') ? json({ error: { message: 'internal detail x' } }, 500) : undefined;
    const second = await insertAction('send_email', 'test:gmail-500');
    expect(await executeAction(second)).toBe('ambiguous');
    const ambiguous = await row(second);
    expect(ambiguous.error).toMatch(/^GOOGLE_500: Gmail did not confirm the send/);
    expect(ambiguous.error).not.toContain('internal detail');

    const retried = await callRoute(retry, { method: 'POST', token: user.token, params: { actionId: second } });
    expect(retried.status).toBe(202);
    expect(retried.body.data.status).toBe('approved');
  });

  it('calendar ids are scoped by workspace, and a cancelled existing event is a failure', async () => {
    google = (url, init) => {
      if (url.endsWith('/freeBusy')) return json({ calendars: { primary: { busy: [] } } });
      if (url.includes('/events?') && init?.method === 'POST') return json({ error: { status: 'duplicate' } }, 409);
      if (url.includes('/events/')) return json({ id: url.split('/').pop(), status: 'cancelled' });
      return undefined;
    };
    const id = await insertAction('schedule_interview', 'test:cancelled');
    expect(await executeAction(id)).toBe('failed');
    expect((await row(id)).error).toMatch(/^EVENT_CANCELLED: /);
    const insert = calls.find((c) => c.method === 'POST' && c.url.includes('/events?'))!;
    const expected = createHash('sha256').update(`${user.workspaceId}:test:cancelled`).digest('hex');
    expect(JSON.parse(insert.body).id).toBe(expected);
    expect(insert.url).toContain('conferenceDataVersion=1&sendUpdates=all');
  });

  it('an undecryptable token is a config error and leaves the grant intact', async () => {
    const before = (await admin.from('google_connections').select('refresh_token_enc').eq('user_id', user.id).single()).data!;
    await admin.from('google_connections').update({ refresh_token_enc: 'v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', access_token_enc: null }).eq('user_id', user.id);
    await expect(getAccessToken(user.id)).rejects.toBeInstanceOf(GoogleConfigError);
    const { data } = await admin.from('google_connections').select('status, refresh_token_enc').eq('user_id', user.id).single();
    expect(data).toEqual({ status: 'active', refresh_token_enc: 'v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    await admin.from('google_connections').update({ refresh_token_enc: before.refresh_token_enc }).eq('user_id', user.id);
  });
});
