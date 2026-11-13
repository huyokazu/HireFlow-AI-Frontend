import 'server-only';

import type { OperationsActionKind } from '@/lib/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';

import { executeAction } from './executor';
import { agentFor } from './keys';
import { reconcileExpiredLeases } from './leases';
import { proposeAction } from './proposals';

const PROPOSE_LIMIT = 50;
const EXECUTE_LIMIT = 20;
/** Rows scanned to find EXECUTE_LIMIT runnable ones, so skipped rows cannot starve the queue. */
const QUEUE_SCAN = 200;
/** Stop starting new work after this; the function's maxDuration is 60 s. */
const TIME_BUDGET_MS = 40_000;

const KIND_FOR_STAGE: Record<string, OperationsActionKind> = { interview: 'schedule_interview', offer: 'send_email' };

export type RunScope = {
  /** Omit to cover every workspace (cron). */
  workspaceId?: string;
  /** Who requests new proposals; defaults to each workspace's owner. */
  userId?: string;
};

async function ownersOf(workspaceIds: string[]): Promise<Map<string, string>> {
  if (workspaceIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin()
    .from('workspace_members')
    .select('workspace_id, user_id')
    .in('workspace_id', workspaceIds)
    .eq('role', 'owner');
  if (error) throw error;
  return new Map(data.map((m) => [m.workspace_id, m.user_id]));
}

async function proposeMissing(scope: RunScope, outOfTime: () => boolean): Promise<number> {
  const db = supabaseAdmin();
  let apps = db.from('applications').select('id, workspace_id, candidate_id, campaign_id, stage').in('stage', ['interview', 'offer']);
  if (scope.workspaceId) apps = apps.eq('workspace_id', scope.workspaceId);
  const { data: applications, error } = await apps.order('stage_entered_at', { ascending: false }).limit(200);
  if (error) throw error;
  if (applications.length === 0) return 0;

  const { data: existing, error: existingError } = await db
    .from('agent_actions')
    .select('application_id, kind')
    .in('application_id', applications.map((a) => a.id));
  if (existingError) throw existingError;
  const covered = new Set(existing.map((a) => `${a.application_id}:${a.kind}`));
  const missing = applications.filter((a) => !covered.has(`${a.id}:${KIND_FOR_STAGE[a.stage]}`)).slice(0, PROPOSE_LIMIT);
  const owners = scope.userId ? new Map<string, string>() : await ownersOf([...new Set(missing.map((a) => a.workspace_id))]);

  let proposed = 0;
  for (const app of missing) {
    if (outOfTime()) break;
    const userId = scope.userId ?? owners.get(app.workspace_id);
    if (!userId) continue;
    try {
      const proposal = await proposeAction({
        workspaceId: app.workspace_id,
        userId,
        kind: KIND_FOR_STAGE[app.stage],
        candidateId: app.candidate_id,
        campaignId: app.campaign_id,
      });
      if (proposal.created) proposed += 1;
    } catch (err) {
      console.error('[operations] proposal failed', app.id, err);
    }
  }
  return proposed;
}

/** Approved actions oldest first, minus those whose agent is paused in their workspace. */
async function runnableQueue(scope: RunScope) {
  const db = supabaseAdmin();
  let paused = db.from('agent_settings').select('workspace_id, agent_key').eq('paused', true).in('agent_key', ['scheduling', 'offer']);
  let approved = db.from('agent_actions').select('id, workspace_id, kind, requested_by').eq('status', 'approved');
  if (scope.workspaceId) {
    paused = paused.eq('workspace_id', scope.workspaceId);
    approved = approved.eq('workspace_id', scope.workspaceId);
  }
  const [pausedRes, queueRes] = await Promise.all([paused, approved.order('created_at', { ascending: true }).limit(QUEUE_SCAN)]);
  if (pausedRes.error) throw pausedRes.error;
  if (queueRes.error) throw queueRes.error;
  const pausedSet = new Set(pausedRes.data.map((p) => `${p.workspace_id}:${p.agent_key}`));
  return queueRes.data.filter((a) => !pausedSet.has(`${a.workspace_id}:${agentFor(a.kind as OperationsActionKind)}`));
}

/**
 * Catch-up pass: settles expired `executing` leases, proposes actions for candidates already in
 * the interview/offer stage that have none (moved before the agent existed, or a lost background
 * task), then executes approved actions oldest first. Idempotency keys and the atomic claim make
 * overlapping runs harmless; a time budget keeps the run inside the function's limit.
 */
export async function runOperations(scope: RunScope): Promise<{ proposed: number; executed: number }> {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const outOfTime = () => Date.now() > deadline;

  await reconcileExpiredLeases({ workspaceId: scope.workspaceId });
  const proposed = await proposeMissing(scope, outOfTime);

  let executed = 0;
  const rateLimited = new Set<string>();
  for (const action of await runnableQueue(scope)) {
    if (executed >= EXECUTE_LIMIT || outOfTime()) break;
    if (action.kind === 'send_email' && rateLimited.has(action.requested_by)) continue;
    try {
      const outcome = await executeAction(action.id);
      if (outcome === 'rate_limited') rateLimited.add(action.requested_by);
      else if (outcome !== 'paused' && outcome !== 'skipped') executed += 1;
    } catch (err) {
      console.error('[operations] execution failed', action.id, err);
    }
  }
  return { proposed, executed };
}
