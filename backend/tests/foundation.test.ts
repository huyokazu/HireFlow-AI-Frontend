import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as health } from '@/app/api/health/route';

import { admin, callRoute, createTestUser, deleteTestUser, type TestUser } from './helpers';

describe('foundation', () => {
  let a: TestUser | undefined;
  let b: TestUser | undefined;

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser('rls-a'), createTestUser('rls-b')]);
    await admin.from('campaigns').insert({
      id: `rls-${a.workspaceId.slice(0, 8)}`,
      workspace_id: a.workspaceId,
      title: { en: 'Secret role', vi: 'Vị trí bí mật' },
      department: { en: 'Engineering', vi: 'Kỹ thuật' },
    });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it('health reports the database and a Server-Timing header', async () => {
    const res = await callRoute(health);
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('ok');
    expect(res.headers.get('server-timing')).toMatch(/db;dur=.*total;dur=/);
  });

  it('gives every new account a profile and an owned workspace', async () => {
    const { data } = await admin.from('workspace_members').select('role').eq('user_id', a!.id).single();
    expect(data?.role).toBe('owner');
  });

  it('RLS: a user cannot read another workspace', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const asUser = (token: string) =>
      createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
    const own = await asUser(a!.token).from('campaigns').select('id').eq('workspace_id', a!.workspaceId);
    const other = await asUser(b!.token).from('campaigns').select('id').eq('workspace_id', a!.workspaceId);
    expect(own.data).toHaveLength(1);
    expect(other.data).toHaveLength(0);

    const forged = await asUser(b!.token)
      .from('campaigns')
      .insert({ workspace_id: a!.workspaceId, title: { en: 'x', vi: 'x' }, department: { en: 'x', vi: 'x' } });
    expect(forged.error?.code).toBe('42501');
  });

  it('RLS: Google tokens are invisible to signed-in users', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${a!.token}` } },
      auth: { persistSession: false },
    });
    const { data } = await client.from('google_connections').select('*');
    expect(data).toEqual([]);
  });
});
