import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { POST as approve } from '@/app/api/operations/actions/[actionId]/approve/route';
import { POST as reject } from '@/app/api/operations/actions/[actionId]/reject/route';
import { POST as retry } from '@/app/api/operations/actions/[actionId]/retry/route';
import { GET as listActions, POST as propose } from '@/app/api/operations/actions/route';
import { GET as runCron, POST as runNow } from '@/app/api/operations/run/route';
import { executeAction } from '@/lib/operations/executor';
import { onStageChanged } from '@/lib/operations/hooks';

import { admin, callRoute, createTestUser, deleteTestUser, type TestUser } from './helpers';
import { actionRow, eventsFor, seedCandidate, waitForStatus } from './operations-fixtures';

describe('operations agent', () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser('ops-a'), createTestUser('ops-b')]);
    process.env.OPERATIONS_REDIRECT_EMAIL = '';
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it('moving a candidate to interview proposes one action and books it (simulated)', async () => {
    const seeded = await seedCandidate(a, 'interview');
    const change = { workspaceId: a.workspaceId, userId: a.id, ...seeded, from: 'screening', to: 'interview' } as const;
    await onStageChanged(change);
    await onStageChanged(change);

    const { data: actions } = await admin.from('agent_actions').select('*').eq('application_id', seeded.applicationId);
    expect(actions).toHaveLength(1);
    const row = await waitForStatus(actions![0].id, ['succeeded']);
    expect(row.idempotency_key).toBe(`interview:${seeded.applicationId}:r1`);
    expect(row.requires_approval).toBe(false);
    expect(row.simulated).toBe(true);
    const result = row.result as { startsAt: string; meetLink: string };
    expect(result.meetLink).toMatch(/^https:\/\/meet\.google\.com\/sim-[a-p]{4}-[a-p]{3}$/);
    expect(new Date(result.startsAt).getTime()).toBeGreaterThan(Date.now());

    const booked = await eventsFor(a.workspaceId, 'interviewBooked');
    expect(booked).toContainEqual(expect.objectContaining({ actionId: row.id, candidateId: seeded.candidateId, simulated: true }));
    const { data: stats } = await admin.from('agent_stats').select('done_today').eq('workspace_id', a.workspaceId).eq('agent_key', 'scheduling').single();
    expect(stats?.done_today).toBeGreaterThanOrEqual(1);
  });

  it('proposing the same action twice returns the same id (201 then 200)', async () => {
    const seeded = await seedCandidate(a, 'interview');
    const body = { kind: 'schedule_interview', candidateId: seeded.candidateId, idempotencyKey: `custom:${seeded.applicationId}` };
    const first = await callRoute(propose, { method: 'POST', token: a.token, body });
    const second = await callRoute(propose, { method: 'POST', token: a.token, body });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(first.body.data.payload).toMatchObject({ candidateName: seeded.name, durationMinutes: 45, timeZone: 'Asia/Ho_Chi_Minh' });
    await waitForStatus(first.body.data.id, ['succeeded']);
  });

  it('an offer email waits for approval, then sends (simulated)', async () => {
    const seeded = await seedCandidate(a, 'offer');
    const proposed = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'send_email', candidateId: seeded.candidateId } });
    expect(proposed.status).toBe(201);
    const action = proposed.body.data;
    expect(action).toMatchObject({ status: 'proposed', requiresApproval: true, kind: 'send_email' });
    expect(action.payload).toMatchObject({ purpose: 'offer', to: 'cand@example.com' });
    expect(await eventsFor(a.workspaceId, 'offerDrafted')).toContainEqual(expect.objectContaining({ actionId: action.id }));

    const approved = await callRoute(approve, { method: 'POST', token: a.token, params: { actionId: action.id } });
    expect(approved.status).toBe(202);
    expect(approved.body.data.status).toBe('approved');
    const row = await waitForStatus(action.id, ['succeeded']);
    expect(row.provider_ref).toMatch(/^sim-msg-[0-9a-f]{16}$/);
    expect(await eventsFor(a.workspaceId, 'offerSent')).toContainEqual(expect.objectContaining({ actionId: action.id, simulated: true }));

    const again = await callRoute(approve, { method: 'POST', token: a.token, params: { actionId: action.id } });
    expect(again.status).toBe(409);
  });

  it('a paused scheduling agent leaves an approved action queued', async () => {
    await admin.from('agent_settings').upsert({ workspace_id: a.workspaceId, agent_key: 'scheduling', paused: true });
    try {
      const seeded = await seedCandidate(a, 'interview');
      const res = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'schedule_interview', candidateId: seeded.candidateId } });
      expect(res.body.data.status).toBe('approved');
      expect(await executeAction(res.body.data.id)).toBe('paused');
      expect((await actionRow(res.body.data.id)).status).toBe('approved');
    } finally {
      await admin.from('agent_settings').upsert({ workspace_id: a.workspaceId, agent_key: 'scheduling', paused: false });
    }
  });

  it('another workspace cannot approve, reject or read the action', async () => {
    const seeded = await seedCandidate(a, 'offer');
    const res = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'send_email', candidateId: seeded.candidateId } });
    const actionId = res.body.data.id;
    expect((await callRoute(approve, { method: 'POST', token: b.token, params: { actionId } })).status).toBe(404);
    const forged = await callRoute(approve, { method: 'POST', token: b.token, params: { actionId }, headers: { 'x-workspace-id': a.workspaceId } });
    expect(forged.status).toBe(403);
    const list = await callRoute(listActions, { token: b.token, path: '/api/operations/actions' });
    expect(list.body.data.map((x: { id: string }) => x.id)).not.toContain(actionId);
    expect((await callRoute(propose, { method: 'POST', token: b.token, body: { kind: 'send_email', candidateId: seeded.candidateId } })).status).toBe(404);

    const rejected = await callRoute(reject, { method: 'POST', token: a.token, params: { actionId } });
    expect(rejected.body.data.status).toBe('rejected');
  });

  it('a candidate without email fails clearly; retry re-queues it; the demo redirect delivers it', async () => {
    const seeded = await seedCandidate(a, 'interview', null);
    const res = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'schedule_interview', candidateId: seeded.candidateId } });
    const failed = await waitForStatus(res.body.data.id, ['failed']);
    expect(failed.error).toMatch(/^MISSING_EMAIL/);
    const retried = await callRoute(retry, { method: 'POST', token: a.token, params: { actionId: failed.id } });
    expect(retried.status).toBe(202);
    expect(retried.body.data.status).toBe('approved');
    await waitForStatus(failed.id, ['failed']);

    process.env.OPERATIONS_REDIRECT_EMAIL = 'demo-inbox@example.com';
    try {
      await callRoute(retry, { method: 'POST', token: a.token, params: { actionId: failed.id } });
      const delivered = await waitForStatus(failed.id, ['succeeded']);
      expect(delivered.result).toMatchObject({ deliveredTo: 'demo-inbox@example.com' });
      expect(delivered.attempts).toBe(3);
    } finally {
      process.env.OPERATIONS_REDIRECT_EMAIL = '';
    }
    expect((await callRoute(retry, { method: 'POST', token: a.token, params: { actionId: randomUUID() } })).status).toBe(404);
  });

  it('validates proposals and list filters', async () => {
    const bad = await callRoute(propose, { method: 'POST', token: a.token, body: { kind: 'send_email', candidateId: 'x', payload: { to: 'nope' } } });
    expect(bad.status).toBe(400);
    const list = await callRoute(listActions, { token: a.token, path: '/api/operations/actions?status=succeeded&limit=5' });
    expect(list.status).toBe(200);
    expect(list.body.data.every((x: { status: string }) => x.status === 'succeeded')).toBe(true);
    expect((await callRoute(listActions, { token: a.token, path: '/api/operations/actions?status=bogus' })).status).toBe(400);
  });

  it('run: the cron GET needs the secret; a member POST catches up their workspace', async () => {
    expect((await callRoute(runCron, { path: '/api/operations/run' })).status).toBe(401);
    expect((await callRoute(runCron, { path: '/api/operations/run', token: a.token })).status).toBe(401);

    const seeded = await seedCandidate(a, 'offer');
    const res = await callRoute(runNow, { method: 'POST', token: a.token, path: '/api/operations/run' });
    expect(res.status).toBe(200);
    expect(res.body.data.proposed).toBeGreaterThanOrEqual(1);
    const { data } = await admin.from('agent_actions').select('status, kind').eq('application_id', seeded.applicationId);
    expect(data).toEqual([{ status: 'proposed', kind: 'send_email' }]);
  });
});
