import { createHash, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { POST as approve } from '@/app/api/operations/actions/[actionId]/approve/route';
import { POST as reject } from '@/app/api/operations/actions/[actionId]/reject/route';
import { POST as propose } from '@/app/api/operations/actions/route';
import { POST as runNow } from '@/app/api/operations/run/route';

import { admin, callRoute, createTestUser, deleteTestUser, type TestUser } from './helpers';
import { actionRow, seedCandidate, waitForStatus } from './operations-fixtures';

const DAY = 86_400_000;
const interviewPayload = () => ({
  candidateName: 'Phạm Minh',
  candidateEmail: 'minh@example.com',
  interviewers: [],
  title: 'Interview',
  description: '',
  durationMinutes: 45,
  windowStart: new Date(Date.now() + DAY).toISOString(),
  windowEnd: new Date(Date.now() + 8 * DAY).toISOString(),
  timeZone: 'Asia/Ho_Chi_Minh',
});
const emailPayload = { candidateName: 'Phạm Minh', to: 'minh@example.com', subject: 'Hello', text: 'Hi', purpose: 'general' };

describe('operations safety', () => {
  let a: TestUser;
  let b: TestUser;

  /** A raw action row; `updatedAt` in the past simulates a worker that died mid-execution. */
  async function insertAction(kind: 'send_email' | 'schedule_interview', status: 'approved' | 'executing', updatedAt?: Date) {
    const { data, error } = await admin
      .from('agent_actions')
      .insert({
        workspace_id: a.workspaceId,
        requested_by: a.id,
        kind,
        idempotency_key: `test:${randomUUID()}`,
        status,
        payload: kind === 'send_email' ? emailPayload : interviewPayload(),
        ...(updatedAt && { updated_at: updatedAt.toISOString() }),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser('safe-a'), createTestUser('safe-b')]);
    process.env.OPERATIONS_REDIRECT_EMAIL = '';
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it('expired executing leases: emails become ambiguous, bookings re-run, both rejectable', async () => {
    const stale = new Date(Date.now() - 5 * 60_000);
    const stuckEmail = await insertAction('send_email', 'executing', stale);
    const stuckInterview = await insertAction('schedule_interview', 'executing', stale);
    const live = await insertAction('send_email', 'executing');

    const res = await callRoute(runNow, { method: 'POST', token: a.token, path: '/api/operations/run' });
    expect(res.status).toBe(200);
    expect(await actionRow(stuckEmail)).toMatchObject({ status: 'ambiguous', error: expect.stringMatching(/^LEASE_EXPIRED: outcome unknown/) });
    expect((await actionRow(stuckInterview)).status).toBe('succeeded');
    expect((await actionRow(live)).status).toBe('executing');

    // A worker still inside its lease cannot be pulled out from under it.
    expect((await callRoute(reject, { method: 'POST', token: a.token, params: { actionId: live } })).status).toBe(409);
    expect((await callRoute(reject, { method: 'POST', token: a.token, params: { actionId: stuckEmail } })).body.data.status).toBe('rejected');
    const expired = await insertAction('send_email', 'executing', stale);
    expect((await callRoute(reject, { method: 'POST', token: a.token, params: { actionId: expired } })).body.data.status).toBe('rejected');
  });

  it('a paused agent does not block other runnable actions in the queue', async () => {
    await admin.from('agent_settings').upsert({ workspace_id: a.workspaceId, agent_key: 'scheduling', paused: true });
    try {
      const interview = await insertAction('schedule_interview', 'approved');
      const email = await insertAction('send_email', 'approved');
      const res = await callRoute(runNow, { method: 'POST', token: a.token, path: '/api/operations/run' });
      expect(res.body.data.executed).toBeGreaterThanOrEqual(1);
      expect((await actionRow(email)).status).toBe('succeeded');
      expect((await actionRow(interview)).status).toBe('approved');
    } finally {
      await admin.from('agent_settings').upsert({ workspace_id: a.workspaceId, agent_key: 'scheduling', paused: false });
    }
  });

  it('only the requester or an owner/admin may approve; a departed requester cannot act', async () => {
    await admin.from('workspace_members').insert({ workspace_id: a.workspaceId, user_id: b.id, role: 'member' });
    const asB = { 'x-workspace-id': a.workspaceId };
    const seeded = await seedCandidate(a, 'offer');

    const ownAction = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'send_email', candidateId: seeded.candidateId } });
    const denied = await callRoute(approve, { method: 'POST', token: b.token, headers: asB, params: { actionId: ownAction.body.data.id } });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const bAction = await callRoute(propose, {
      method: 'POST',
      token: b.token,
      headers: asB,
      body: { kind: 'send_email', candidateId: seeded.candidateId, idempotencyKey: 'b-offer' },
    });
    expect(bAction.status).toBe(201);
    await admin.from('workspace_members').delete().eq('workspace_id', a.workspaceId).eq('user_id', b.id);
    const approved = await callRoute(approve, { method: 'POST', token: a.token, params: { actionId: bAction.body.data.id } });
    expect(approved.status).toBe(202);
    const failed = await waitForStatus(bAction.body.data.id, ['failed']);
    expect(failed.error).toMatch(/^REQUESTER_NOT_MEMBER/);
  });

  it('a signed-out session cannot propose even with an unexpired token', async () => {
    const c = await createTestUser('safe-c');
    try {
      const { error } = await admin.auth.admin.signOut(c.token, 'global');
      expect(error).toBeNull();
      const res = await callRoute(propose, { method: 'POST', token: c.token, body: { kind: 'send_email', candidateId: 'x' } });
      expect(res.status).toBe(401);
    } finally {
      await deleteTestUser(c);
    }
  });

  it('client input: edited payloads need approval, keys are namespaced, html is dropped', async () => {
    const seeded = await seedCandidate(a, 'interview');
    const edited = await callRoute(propose, {
      method: 'POST',
      token: a.token,
      body: { kind: 'schedule_interview', candidateId: seeded.candidateId, idempotencyKey: 'k1', payload: { durationMinutes: 30 } },
    });
    expect(edited.status).toBe(201);
    expect(edited.body.data).toMatchObject({ status: 'proposed', requiresApproval: true });
    expect((await actionRow(edited.body.data.id)).idempotency_key).toBe('client:k1');

    const reserved = await callRoute(propose, {
      method: 'POST',
      token: a.token,
      body: { kind: 'schedule_interview', candidateId: seeded.candidateId, idempotencyKey: `interview:${seeded.applicationId}:r1` },
    });
    expect(reserved.status).toBe(400);

    const otherKind = await callRoute(propose, {
      method: 'POST',
      token: a.token,
      body: { kind: 'send_email', candidateId: seeded.candidateId, idempotencyKey: 'k1' },
    });
    expect(otherKind.status).toBe(409);

    const html = await callRoute(propose, {
      method: 'POST',
      token: a.token,
      body: { kind: 'send_email', candidateId: seeded.candidateId, idempotencyKey: 'k2', payload: { html: '<img src=x>' } },
    });
    expect(html.status).toBe(201);
    expect(html.body.data.payload).not.toHaveProperty('html');
  });

  it('simulated calendar ids are scoped by workspace', async () => {
    const seeded = await seedCandidate(a, 'interview');
    const res = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'schedule_interview', candidateId: seeded.candidateId } });
    const done = await waitForStatus(res.body.data.id, ['succeeded']);
    const key = `${a.workspaceId}:interview:${seeded.applicationId}:r1`;
    expect(done.provider_ref).toBe(createHash('sha256').update(key).digest('hex'));
  });
});
