import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as agents } from '@/app/api/agents/route';
import { GET as agentEvents } from '@/app/api/agents/events/route';
import { PATCH as pauseAgents } from '@/app/api/agents/paused/route';
import { GET as analytics } from '@/app/api/analytics/route';
import { GET as bootstrap } from '@/app/api/bootstrap/route';
import { POST as launch } from '@/app/api/campaigns/route';
import { GET as candidates } from '@/app/api/campaigns/[campaignId]/candidates/route';
import { PUT as putSetup } from '@/app/api/campaigns/[campaignId]/setup/route';
import { GET as setups } from '@/app/api/campaigns/setups/route';
import { GET as dashboard } from '@/app/api/dashboard/route';
import { GET as me, PATCH as patchMe } from '@/app/api/me/route';
import { GET as sessions } from '@/app/api/me/sessions/route';
import { DELETE as revokeSession } from '@/app/api/me/sessions/[sessionId]/route';
import { GET as pipeline } from '@/app/api/pipeline/route';
import { PATCH as movePipeline } from '@/app/api/pipeline/[candidateId]/route';
import { POST as approve } from '@/app/api/self-healing/alerts/[alertId]/approve/route';
import { POST as dismiss } from '@/app/api/self-healing/alerts/[alertId]/dismiss/route';
import { POST as reopen } from '@/app/api/self-healing/alerts/[alertId]/reopen/route';
import { GET as history } from '@/app/api/self-healing/history/route';
import type { CampaignDraft } from '@/lib/contracts';
import { currentMonday } from '@/lib/data/analytics';
import type { Json } from '@/lib/supabase/database.types';

import { admin, callRoute, createTestUser, deleteTestUser, type TestUser } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const tag = randomUUID().slice(0, 8);
const ids = {
  fe: `fe-${tag}`,
  design: `design-${tag}`,
  amelia: `amelia-${tag}`,
  bao: `bao-${tag}`,
  chi: `chi-${tag}`,
  salaryAlert: `alert-salary-${tag}`,
  sourceAlert: `alert-source-${tag}`,
};
const loc = (en: string) => ({ en, vi: en });

const FE_SETUP: CampaignDraft = {
  title: 'Frontend Engineer',
  department: 'engineering',
  location: 'Hanoi',
  workMode: 'hybrid',
  seniority: 'senior',
  headcount: 1,
  skills: ['React', 'TypeScript'],
  minExperience: 3,
  salaryMin: 90,
  salaryMax: 110,
  channels: ['itviec'],
  agents: { sourcing: true, matching: true, scheduling: true, selfHealing: true },
  targetMatchRate: 60,
};

const alertContent = (title: string, fixes: Json[]) => ({
  title: loc(title),
  campaignName: loc('Frontend Engineer'),
  metric: { label: loc('Match rate'), current: 40, target: 60 },
  rootCause: { summary: loc('Salary below market'), confidence: 80, factors: [] },
  suggestedFixes: fixes,
});

/** A small workspace shaped like the demo data, written with the secret key like the seed script. */
async function seedWorkspace(ws: string) {
  const now = Date.now();
  const at = (ms: number) => new Date(now - ms).toISOString();
  const check = ({ error }: { error: unknown }) => {
    if (error) throw error;
  };
  check(
    await admin.from('campaigns').insert([
      { id: ids.fe, workspace_id: ws, title: loc('Frontend Engineer'), department: loc('Engineering'), stage: 'screening',
        applicants: 10, match_rate: 40, health: 'at_risk', setup: FE_SETUP, created_at: at(DAY) },
      { id: ids.design, workspace_id: ws, title: loc('Designer'), department: loc('Design'), applicants: 4, match_rate: 75,
        created_at: at(2 * DAY) },
    ], { defaultToNull: false }),
  );
  check(
    await admin.from('candidates').insert(
      [ids.amelia, ids.bao, ids.chi].map((id) => ({
        id, workspace_id: ws, name: id, role: loc('Engineer'), location: loc('Hanoi'), years_of_experience: 5, skills: ['React'],
      })),
    ),
  );
  check(
    await admin.from('applications').insert([
      { workspace_id: ws, campaign_id: ids.fe, candidate_id: ids.amelia, stage: 'screening', stage_entered_at: at(3 * DAY + 60_000),
        match_score: 70, ai_assessment: loc('Solid') },
      { workspace_id: ws, campaign_id: ids.fe, candidate_id: ids.bao, stage: 'applied', stage_entered_at: at(60 * 60_000),
        match_score: 90, ai_assessment: loc('Great') },
      { workspace_id: ws, campaign_id: ids.fe, candidate_id: ids.chi, stage: 'interview', stage_entered_at: at(5 * DAY),
        match_score: 50 },
      { workspace_id: ws, campaign_id: ids.design, candidate_id: ids.chi, stage: 'applied', stage_entered_at: at(2 * DAY),
        match_score: 80 },
    ], { defaultToNull: false }),
  );
  check(
    await admin.from('bottleneck_alerts').insert([
      { id: ids.salaryAlert, workspace_id: ws, campaign_id: ids.fe, severity: 'warning', detected_at: at(60_000),
        content: alertContent('Salary too low', [
          { id: 'raise', actionLabel: loc('Expand Salary Range'), description: loc('Raise it'), expectedLift: 12,
            patch: { salaryMin: 100, salaryMax: 130 } },
          { id: 'renew', actionLabel: loc('Renew Job Post'), description: loc('Renew it'), expectedLift: 4 },
        ]) },
      { id: ids.sourceAlert, workspace_id: ws, campaign_id: ids.fe, severity: 'critical', detected_at: at(DAY),
        content: alertContent('One channel only', []) },
    ]),
  );
  check(
    await admin.from('healing_records').insert({
      workspace_id: ws, campaign_id: ids.fe, outcome: 'resolved', at: at(6 * DAY),
      content: { campaignName: loc('Frontend Engineer'), issue: loc('Old issue'), fix: loc('Old fix') },
    }),
  );
  const monday = new Date(`${currentMonday('Asia/Ho_Chi_Minh')}T00:00:00.000Z`).getTime();
  const week = (n: number) => new Date(monday - n * 7 * DAY).toISOString().slice(0, 10);
  check(await admin.from('agent_stats').insert({ workspace_id: ws, agent_key: 'sourcing', done_today: 8, queued: 2, agreement_rate: 90 }));
  check(await admin.from('workspace_metrics').insert({ workspace_id: ws, tasks_yesterday: 12, hours_saved_before_today: 7.5, hires_previous_period: 9 }));
  check(await admin.from('analytics_months').insert([
    { workspace_id: ws, month_start: '2026-10-01', hires: 3, time_to_hire_days: 25 },
    { workspace_id: ws, month_start: '2026-11-01', hires: 1, time_to_hire_days: 21.5 },
  ]));
  check(await admin.from('agent_weeks').insert([0, 1, 2].map((n) => ({ workspace_id: ws, week_start: week(n), hours_saved: 10 + n }))));
  check(await admin.from('campaign_channel_results').insert({ workspace_id: ws, campaign_id: ids.fe, channel: 'itviec', applicants: 10, qualified: 4 }));
  check(await admin.from('agent_events').insert([
    { workspace_id: ws, kind: 'healthCheck', actor: 'selfHealing', payload: { campaigns: 2 }, at: at(10 * 60_000) },
    { workspace_id: ws, kind: 'cvsScored', actor: 'matching', campaign_id: ids.fe, payload: { count: 3 }, at: at(60_000) },
  ]));
}

describe('data API', () => {
  let a: TestUser;
  let b: TestUser;
  const as = (user: TestUser) => ({ token: user.token });

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser('data-a'), createTestUser('data-b')]);
    await seedWorkspace(a.workspaceId);
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it('rejects missing and invalid tokens', async () => {
    expect((await callRoute(bootstrap)).body.error.code).toBe('UNAUTHENTICATED');
    const bad = await callRoute(dashboard, { token: 'not-a-jwt' });
    expect([bad.status, bad.body.error.code]).toEqual([401, 'INVALID_TOKEN']);
  });

  it('forbids acting on another workspace', async () => {
    const res = await callRoute(bootstrap, { ...as(b), headers: { 'x-workspace-id': a.workspaceId } });
    expect([res.status, res.body.error.code]).toEqual([403, 'NOT_A_MEMBER']);
    const own = await callRoute(candidates, { ...as(b), params: { campaignId: ids.fe } });
    expect(own.status).toBe(404);
  });

  it('bootstraps the whole workspace in one request', async () => {
    const res = await callRoute(bootstrap, { ...as(a), path: `/api/bootstrap?featured=${ids.fe}` });
    expect(res.status).toBe(200);
    expect(res.headers.get('server-timing')).toMatch(/auth;.*workspace;.*db_.*total;/);
    const data = res.body.data;
    expect(data.workspaceId).toBe(a.workspaceId);
    expect(data.featuredCampaignId).toBe(ids.fe);
    expect(data.summary).toMatchObject({ activeCampaigns: 2, campaignsAtRisk: 1, candidatesInPipeline: 14 });
    expect(data.summary.campaigns.map((c: { id: string }) => c.id)).toEqual([ids.fe, ids.design]);
    expect(data.matchedCandidates.map((c: { matchScore: number }) => c.matchScore)).toEqual([90, 70, 50]);
    expect(data.matchedCandidates[0]).toEqual({
      id: ids.bao, name: ids.bao, role: loc('Engineer'), location: loc('Hanoi'), yearsOfExperience: 5, matchScore: 90,
      skills: ['React'], aiAssessment: loc('Great'),
    });
    expect(data.pipeline.map((c: { id: string; daysInStage: number }) => [c.id, c.daysInStage])).toEqual([
      [ids.bao, 0], [ids.chi, 2], [ids.amelia, 3], [ids.chi, 5],
    ]);
    expect(data.alerts.map((alert: { id: string }) => alert.id)).toEqual([ids.sourceAlert, ids.salaryAlert]);
    expect(data.alerts[1]).toMatchObject({ campaignId: ids.fe, status: 'open', approvedFixId: null, decidedAt: null });
    expect(data.history).toHaveLength(1);
    expect(data.history[0]).toMatchObject({ campaignId: ids.fe, outcome: 'resolved', issue: loc('Old issue') });
    expect(data.campaignSetups).toEqual({ [ids.fe]: FE_SETUP });
    expect(Object.keys(data.agents.stats).sort()).toEqual(['matching', 'offer', 'scheduling', 'selfHealing', 'sourcing']);
    expect(data.agents.stats.sourcing).toMatchObject({ doneToday: 8, queued: 2, agreementRate: 90 });
    expect(data.agents.stats.offer).toMatchObject({ doneToday: 0, queued: 0 });
    expect(data.agents.paused.offer).toBe(false);
    expect(data.agents.events.map((e: { kind: string }) => e.kind)).toEqual(['cvsScored', 'healthCheck']);
    expect(data.agents.events[0]).toMatchObject({ actor: 'matching', campaignId: ids.fe, count: 3 });
    expect(data.agents).toMatchObject({ tasksYesterday: 12, hoursSavedBeforeToday: 7.5 });

    const fallback = await callRoute(bootstrap, { ...as(a), path: '/api/bootstrap?featured=unknown' });
    expect(fallback.body.data.featuredCampaignId).toBe(ids.fe);
    const empty = await callRoute(bootstrap, as(b));
    expect(empty.body.data).toMatchObject({ featuredCampaignId: null, matchedCandidates: [], pipeline: [] });
  });

  it('moves a pipeline card and persists the new stage', async () => {
    const res = await callRoute(movePipeline, { ...as(a), method: 'PATCH', params: { candidateId: ids.amelia }, body: { stage: 'interview' } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: ids.amelia, campaignId: ids.fe, stage: 'interview', daysInStage: 0, matchScore: 70 });
    const board = await callRoute(pipeline, as(a));
    expect(board.body.data[0]).toMatchObject({ id: ids.amelia, stage: 'interview', daysInStage: 0 });

    const ambiguous = await callRoute(movePipeline, { ...as(a), method: 'PATCH', params: { candidateId: ids.chi }, body: { stage: 'offer' } });
    expect(ambiguous.status).toBe(409);
    const chosen = await callRoute(movePipeline, {
      ...as(a), method: 'PATCH', params: { candidateId: ids.chi }, body: { stage: 'screening', campaignId: ids.design },
    });
    expect(chosen.body.data).toMatchObject({ campaignId: ids.design, stage: 'screening' });
    const invalid = await callRoute(movePipeline, { ...as(a), method: 'PATCH', params: { candidateId: ids.bao }, body: { stage: 'lost' } });
    expect([invalid.status, invalid.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
  });

  it('launches a campaign that shows up on the dashboard', async () => {
    const draft = { ...FE_SETUP, title: 'Kỹ sư Dữ liệu', department: 'data', channels: ['topcv', 'linkedin'],
      agents: { ...FE_SETUP.agents, scheduling: false }, targetMatchRate: 55 };
    const res = await callRoute(launch, { ...as(a), method: 'POST', body: { draft } });
    expect(res.status).toBe(201);
    const { campaign, events } = res.body.data;
    expect(campaign).toMatchObject({ title: loc('Kỹ sư Dữ liệu'), department: { en: 'Data', vi: 'Dữ liệu' }, stage: 'sourcing',
      candidates: 0, matchRate: 0, targetMatchRate: 55, health: 'on_track' });
    expect(campaign.id).toMatch(/^ky-su-du-lieu-[0-9a-f]{8}$/);
    expect(events).toEqual([expect.objectContaining({ kind: 'campaignLaunched', actor: 'orchestrator', campaignId: campaign.id, agents: 3 })]);

    const summary = (await callRoute(dashboard, as(a))).body.data;
    expect(summary.activeCampaigns).toBe(3);
    expect(summary.campaigns[0]).toEqual(campaign);
    expect((await callRoute(setups, as(a))).body.data[campaign.id]).toEqual(draft);
    const channels = await admin.from('campaign_channel_results').select('channel, applicants').eq('campaign_id', campaign.id);
    expect(channels.data?.map((row) => row.channel).sort()).toEqual(['linkedin', 'topcv']);

    const bad = await callRoute(launch, { ...as(a), method: 'POST', body: { draft: { ...draft, headcount: 0 } } });
    expect(bad.status).toBe(400);
  });

  it('saves a new setup and logs setupUpdated', async () => {
    const setup = { ...FE_SETUP, minExperience: 2 };
    const res = await callRoute(putSetup, { ...as(a), method: 'PUT', params: { campaignId: ids.fe }, body: { setup } });
    expect(res.body.data.events).toEqual([expect.objectContaining({ kind: 'setupUpdated', campaignId: ids.fe })]);
    const missing = await callRoute(putSetup, { ...as(a), method: 'PUT', params: { campaignId: 'nope' }, body: { setup } });
    expect(missing.status).toBe(404);
  });

  it('approves a fix: merges its patch, audits it and logs fixApplied', async () => {
    const unknownFix = await callRoute(approve, { ...as(a), method: 'POST', params: { alertId: ids.salaryAlert }, body: { fixId: 'nope' } });
    expect(unknownFix.status).toBe(400);

    const res = await callRoute(approve, { ...as(a), method: 'POST', params: { alertId: ids.salaryAlert }, body: { fixId: 'raise' } });
    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({ id: ids.salaryAlert, status: 'approved', approvedFixId: 'raise' });
    expect(res.body.data.alert.decidedAt).toEqual(expect.any(String));
    expect(res.body.data.events).toEqual([
      expect.objectContaining({ kind: 'fixApplied', actor: 'orchestrator', campaignId: ids.fe, fix: loc('Expand Salary Range') }),
    ]);
    const setup = (await callRoute(setups, as(a))).body.data[ids.fe];
    expect(setup).toMatchObject({ salaryMin: 100, salaryMax: 130, minExperience: 2 });

    const audit = await admin.from('healing_records').select('outcome, content').eq('alert_id', ids.salaryAlert).single();
    expect(audit.data).toMatchObject({ outcome: 'in_progress', content: { result: { before: 40, after: 52 } } });
    expect((await callRoute(history, as(a))).body.data).toHaveLength(1);

    const again = await callRoute(approve, { ...as(a), method: 'POST', params: { alertId: ids.salaryAlert }, body: { fixId: 'raise' } });
    expect(again.status).toBe(409);
  });

  it('dismisses and reopens an alert', async () => {
    const params = { alertId: ids.sourceAlert };
    const dismissed = await callRoute(dismiss, { ...as(a), method: 'POST', params });
    expect(dismissed.body.data.alert).toMatchObject({ status: 'dismissed', approvedFixId: null });
    expect((await callRoute(dismiss, { ...as(a), method: 'POST', params })).status).toBe(409);
    const reopened = await callRoute(reopen, { ...as(a), method: 'POST', params });
    expect(reopened.body.data.alert).toMatchObject({ status: 'open', decidedAt: null });
    expect((await callRoute(reopen, { ...as(a), method: 'POST', params })).status).toBe(409);
    expect((await callRoute(reopen, { ...as(a), method: 'POST', params: { alertId: 'missing' } })).status).toBe(404);
  });

  it('members cannot write agent-owned or audit columns directly', async () => {
    const asA = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${a.token}` } },
      auth: { persistSession: false },
    });
    const denied = async (query: PromiseLike<{ error: { code: string } | null }>) => (await query).error?.code;

    expect(await denied(asA.from('campaigns').update({ match_rate: 99 }).eq('id', ids.fe))).toBe('42501');
    expect(await denied(asA.from('applications').update({ match_score: 99 }).eq('campaign_id', ids.fe))).toBe('42501');
    expect(await denied(asA.from('profiles').update({ email: 'forged@example.com' }).eq('id', a.id))).toBe('42501');
    expect(await denied(asA.from('agent_settings').upsert({ workspace_id: a.workspaceId, agent_key: 'offer', paused: true }))).toBe('42501');
    expect(
      await denied(asA.from('campaigns').insert({ workspace_id: a.workspaceId, title: loc('x'), department: loc('x'), created_by: b.id })),
    ).toBe('42501');
    // Approving needs the API (patch, audit and event in one transaction), not a status flip.
    expect(await denied(asA.from('bottleneck_alerts').update({ status: 'approved' }).eq('id', ids.sourceAlert))).toBe('42501');
    expect(await denied(asA.rpc('approve_alert_fix', {
      ws: a.workspaceId, alert_id: ids.sourceAlert, fix_id: 'x', fix_label: loc('x'), setup_patch: null, record: {}, actor: a.id,
    }))).toBe('42501');

    // A forged decider is replaced by the caller.
    const dismissed = await asA
      .from('bottleneck_alerts')
      .update({ status: 'dismissed', decided_by: b.id, decided_at: '2000-01-01T00:00:00Z' })
      .eq('id', ids.sourceAlert)
      .select('decided_by, decided_at')
      .single();
    expect(dismissed.data?.decided_by).toBe(a.id);
    expect(new Date(dismissed.data!.decided_at!).getFullYear()).toBeGreaterThan(2000);
    await callRoute(reopen, { ...as(a), method: 'POST', params: { alertId: ids.sourceAlert } });

    const scores = await admin.from('applications').select('match_score').eq('campaign_id', ids.fe);
    expect(scores.data?.map((row) => row.match_score).sort()).toEqual([50, 70, 90]);
    expect((await admin.from('campaigns').select('match_rate').eq('id', ids.fe).single()).data?.match_rate).toBe(40);
  });

  it('an approval that fails part-way leaves nothing applied', async () => {
    const before = (await callRoute(setups, as(a))).body.data[ids.fe];
    const events = await admin.from('agent_events').select('id', { count: 'exact', head: true }).eq('workspace_id', a.workspaceId);
    // A null audit record violates a NOT NULL column after the alert was already marked approved.
    const failed = await admin.rpc('approve_alert_fix', {
      ws: a.workspaceId, alert_id: ids.sourceAlert, fix_id: 'x', fix_label: loc('x'), setup_patch: { salaryMin: 95 }, record: null, actor: a.id,
    });
    expect(failed.error?.code).toBe('23502');

    const alert = await admin.from('bottleneck_alerts').select('status, decided_by').eq('id', ids.sourceAlert).single();
    expect(alert.data).toEqual({ status: 'open', decided_by: null });
    expect((await callRoute(setups, as(a))).body.data[ids.fe]).toEqual(before);
    const after = await admin.from('agent_events').select('id', { count: 'exact', head: true }).eq('workspace_id', a.workspaceId);
    expect(after.count).toBe(events.count);
  });

  it('records the caller as the creator of a launched campaign', async () => {
    const res = await callRoute(launch, { ...as(b), method: 'POST', body: { draft: { ...FE_SETUP } } });
    expect(res.status).toBe(201);
    const { data } = await admin.from('campaigns').select('created_by').eq('id', res.body.data.campaign.id).single();
    expect(data?.created_by).toBe(b.id);
  });

  it('pauses and resumes agents with the app event rules', async () => {
    const pause = (changes: Record<string, boolean>) => callRoute(pauseAgents, { ...as(a), method: 'PATCH', body: { changes } });
    const kinds = (res: { body: { data: { events: { kind: string; actor: string; count?: number }[] } } }) =>
      res.body.data.events.map(({ kind, actor, count }) => ({ kind, actor, ...(count !== undefined && { count }) }));

    expect(kinds(await pause({ offer: true }))).toEqual([{ kind: 'agentPaused', actor: 'offer' }]);
    expect(kinds(await pause({ sourcing: true, matching: true, offer: true }))).toEqual([
      { kind: 'agentsPaused', actor: 'orchestrator', count: 2 },
    ]);
    expect(kinds(await pause({ offer: true }))).toEqual([]);
    const all = await pause({ scheduling: true, selfHealing: true });
    expect(kinds(all)).toEqual([{ kind: 'allPaused', actor: 'orchestrator' }]);
    expect(Object.values(all.body.data.paused).every(Boolean)).toBe(true);
    const resumed = await pause({ sourcing: false, matching: false, scheduling: false, offer: false, selfHealing: false });
    expect(kinds(resumed)).toEqual([{ kind: 'allResumed', actor: 'orchestrator' }]);
    expect((await callRoute(agents, as(a))).body.data.paused.offer).toBe(false);
  });

  it('pages through agent events, newest first', async () => {
    const first = await callRoute(agentEvents, { ...as(a), path: '/api/agents/events?limit=2' });
    expect(first.body.data).toHaveLength(2);
    const next = await callRoute(agentEvents, { ...as(a), path: `/api/agents/events?limit=100&before=${first.body.data[1].id}` });
    expect(next.body.data.every((e: { id: string }) => Number(e.id) < Number(first.body.data[1].id))).toBe(true);
    expect(next.body.data.at(-1).kind).toBe('healthCheck');
    expect((await callRoute(agentEvents, { ...as(a), path: '/api/agents/events?limit=500' })).status).toBe(400);
  });

  it('returns hiring analytics', async () => {
    const data = (await callRoute(analytics, as(a))).body.data;
    const monday = `${currentMonday('Asia/Ho_Chi_Minh')}T00:00:00.000Z`;
    expect(data.months).toEqual([
      { start: '2026-10-01T00:00:00.000Z', hires: 3, timeToHireDays: 25 },
      { start: '2026-11-01T00:00:00.000Z', hires: 1, timeToHireDays: 21.5 },
    ]);
    expect(data.currentWeekStart).toBe(monday);
    expect(data.agentWeeks.map((w: { hoursSaved: number }) => w.hoursSaved)).toEqual([12, 11]);
    expect(data.hiresPreviousPeriod).toBe(9);
    expect(data.campaigns.find((c: { campaignId: string }) => c.campaignId === ids.fe)).toEqual({
      campaignId: ids.fe, channels: [{ channel: 'itviec', applicants: 10, qualified: 4 }], droppedOut: { afterInterview: 0, afterOffer: 0 },
    });
  });

  it('reads and updates the profile', async () => {
    const res = await callRoute(me, as(a));
    expect(res.body.data.profile).toMatchObject({ id: a.id, email: a.email, locale: 'en', defaultWorkspaceId: a.workspaceId });
    expect(res.body.data.workspaces).toEqual([expect.objectContaining({ id: a.workspaceId, role: 'owner', autoApproveInterviews: true })]);
    expect(res.body.data.currentSessionId).toEqual(expect.any(String));

    const updated = await callRoute(patchMe, { ...as(a), method: 'PATCH', body: { displayName: 'Recruiter A', locale: 'vi' } });
    expect(updated.body.data.profile).toMatchObject({ displayName: 'Recruiter A', locale: 'vi' });
    const foreign = await callRoute(patchMe, { ...as(a), method: 'PATCH', body: { defaultWorkspaceId: b.workspaceId } });
    expect([foreign.status, foreign.body.error.code]).toEqual([403, 'NOT_A_MEMBER']);
    expect((await callRoute(patchMe, { ...as(a), method: 'PATCH', body: { timezone: 'Mars/Base' } })).status).toBe(400);
  });

  it('lists sessions, flags the current one and revokes another', async () => {
    const other = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const listed = await callRoute(sessions, as(b));
    expect(listed.body.data).toEqual([expect.objectContaining({ current: true })]);

    // A second device: the admin API issues a sign-in link, which the other client redeems.
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: b.email });
    const second = await other.auth.verifyOtp({ token_hash: link.data.properties!.hashed_token, type: 'magiclink' });
    const payload = second.data.session!.access_token.split('.')[1];
    const secondId = JSON.parse(Buffer.from(payload, 'base64url').toString()).session_id;
    expect((await callRoute(sessions, as(b))).body.data).toHaveLength(2);

    const revoked = await callRoute(revokeSession, { ...as(b), method: 'DELETE', params: { sessionId: secondId } });
    expect(revoked.body.data).toEqual({ revoked: true });
    expect((await callRoute(sessions, as(b))).body.data).toHaveLength(1);
    const unknown = await callRoute(revokeSession, { ...as(b), method: 'DELETE', params: { sessionId: randomUUID() } });
    expect(unknown.body.data).toEqual({ revoked: false });
  });
});
