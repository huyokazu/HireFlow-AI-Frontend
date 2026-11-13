import 'server-only';

import { ApiError } from '@/lib/api/http';
import type { OperationsAction, OperationsActionResult, OperationsActionStatus } from '@/lib/contracts';
import type { Tables, TablesUpdate } from '@/lib/supabase/database.types';
import { type Db, supabaseAdmin, type WorkspaceContext } from '@/lib/supabase/server';

import { assertMayDecide } from './auth';
import { reconcileExpiredLeases } from './leases';

export type ActionRow = Tables<'agent_actions'>;

export const ACTION_STATUSES = [
  'proposed', 'approved', 'executing', 'succeeded', 'failed', 'ambiguous', 'rejected', 'blocked_reauth',
] as const satisfies readonly OperationsActionStatus[];

export function toOperationsAction(row: ActionRow): OperationsAction {
  return {
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    status: row.status as OperationsActionStatus,
    requiresApproval: row.requires_approval,
    campaignId: row.campaign_id,
    candidateId: row.candidate_id,
    simulated: row.simulated,
    result: (row.result as OperationsActionResult | null) ?? null,
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  } as OperationsAction;
}

/** Reads through the caller's RLS-scoped client, so the database enforces workspace membership too. */
export async function listActions(db: Db, workspaceId: string, status: OperationsActionStatus | undefined, limit: number) {
  let query = db.from('agent_actions').select('*').eq('workspace_id', workspaceId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data.map(toOperationsAction);
}

/**
 * Compare-and-set on status, scoped to the workspace: the update only applies while the row is in
 * one of `from`, so concurrent approvals or a racing executor cannot both win. 404 when the action
 * is not in this workspace, 409 when it is in another state.
 */
export async function transition(
  workspaceId: string,
  actionId: string,
  from: OperationsActionStatus[],
  changes: TablesUpdate<'agent_actions'>,
): Promise<ActionRow> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('agent_actions')
    .update(changes)
    .eq('id', actionId)
    .eq('workspace_id', workspaceId)
    .in('status', from)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: existing, error: readError } = await db
    .from('agent_actions')
    .select('status')
    .eq('id', actionId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  throw new ApiError(409, 'CONFLICT', `Action is ${existing.status}; expected ${from.join(' or ')}`);
}

/** Loads the action for a decision that runs Google calls, and checks the caller may make it. */
async function authorizeDecision(ws: WorkspaceContext, actionId: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from('agent_actions')
    .select('requested_by')
    .eq('id', actionId)
    .eq('workspace_id', ws.workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  assertMayDecide(ws, data.requested_by);
}

export async function approveAction(ws: WorkspaceContext, actionId: string): Promise<ActionRow> {
  await authorizeDecision(ws, actionId);
  return transition(ws.workspaceId, actionId, ['proposed'], {
    status: 'approved',
    approved_by: ws.userId,
    approved_at: new Date().toISOString(),
  });
}

/**
 * Anything not yet executed, or needing a human (`ambiguous`), can be dropped. A row stuck in
 * `executing` past its lease is settled first, so it becomes rejectable too.
 */
export async function rejectAction(ws: WorkspaceContext, actionId: string): Promise<ActionRow> {
  await reconcileExpiredLeases({ workspaceId: ws.workspaceId, actionId });
  return transition(ws.workspaceId, actionId, ['proposed', 'approved', 'failed', 'blocked_reauth', 'ambiguous'], {
    status: 'rejected',
  });
}

/**
 * Re-queues a failed or blocked action. Retrying an `ambiguous` email is an explicit human
 * decision (they checked it was not sent): it may deliver the email a second time.
 */
export async function retryAction(ws: WorkspaceContext, actionId: string): Promise<ActionRow> {
  await authorizeDecision(ws, actionId);
  return transition(ws.workspaceId, actionId, ['failed', 'blocked_reauth', 'ambiguous'], { status: 'approved', error: null });
}

/** After the user reconnects Google, their actions that were blocked on it go back in the queue. */
export async function requeueBlockedForUser(userId: string): Promise<string[]> {
  const db = supabaseAdmin();
  // Only workspaces the user still belongs to; elsewhere their account must not act any more.
  const { data: memberships, error: memberError } = await db.from('workspace_members').select('workspace_id').eq('user_id', userId);
  if (memberError) throw memberError;
  if (memberships.length === 0) return [];
  const { data, error } = await db
    .from('agent_actions')
    .update({ status: 'approved', error: null })
    .eq('requested_by', userId)
    .eq('status', 'blocked_reauth')
    .in('workspace_id', memberships.map((m) => m.workspace_id))
    .select('id');
  if (error) throw error;
  return data.map((row) => row.id);
}
