import { randomUUID } from 'node:crypto';

import { admin, type TestUser } from './helpers';

/** Shared data setup for the Operations Agent integration tests. */

export type Seeded = { campaignId: string; candidateId: string; applicationId: string; name: string };

/** One campaign + candidate + application in the given stage. */
export async function seedCandidate(user: TestUser, stage: 'screening' | 'interview' | 'offer', email: string | null = 'cand@example.com') {
  const tag = randomUUID().slice(0, 8);
  const campaignId = `ops-${tag}`;
  const candidateId = `cand-ops-${tag}`;
  const name = `Trần Thị ${tag}`;
  const campaign = await admin.from('campaigns').insert({
    id: campaignId,
    workspace_id: user.workspaceId,
    title: { en: 'Backend Engineer (Go)', vi: 'Kỹ sư Backend (Go)' },
    department: { en: 'Engineering', vi: 'Kỹ thuật' },
  });
  if (campaign.error) throw campaign.error;
  const candidate = await admin.from('candidates').insert({
    id: candidateId,
    workspace_id: user.workspaceId,
    name,
    email,
    role: { en: 'Engineer', vi: 'Kỹ sư' },
    location: { en: 'HCMC', vi: 'TP.HCM' },
  });
  if (candidate.error) throw candidate.error;
  const app = await admin
    .from('applications')
    .insert({ workspace_id: user.workspaceId, campaign_id: campaignId, candidate_id: candidateId, stage })
    .select('id')
    .single();
  if (app.error) throw app.error;
  return { campaignId, candidateId, applicationId: app.data.id, name } satisfies Seeded;
}

export async function actionRow(id: string) {
  const { data, error } = await admin.from('agent_actions').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Background execution runs detached in tests; poll until it settles. */
export async function waitForStatus(id: string, statuses: string[], timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await actionRow(id);
    if (statuses.includes(row.status)) return row;
    if (Date.now() > deadline) throw new Error(`action ${id} stuck in ${row.status}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function eventsFor(workspaceId: string, kind: string) {
  const { data, error } = await admin.from('agent_events').select('payload').eq('workspace_id', workspaceId).eq('kind', kind);
  if (error) throw error;
  return data.map((e) => e.payload as Record<string, unknown>);
}
