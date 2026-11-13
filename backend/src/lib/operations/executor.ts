import 'server-only';

import { runInBackground } from '@/lib/api/background';
import type { OperationsActionKind, OperationsActionResult, ScheduleInterviewPayload, SendEmailPayload } from '@/lib/contracts';
import { errorCode, GoogleApiError, GoogleConfigError, GoogleReauthRequired, OperationError } from '@/lib/google/errors';
import { googleOpsFor } from '@/lib/google/ops';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/server';

import type { ActionRow } from './actions';
import { isWorkspaceMember } from './auth';
import { recordSuccess } from './bookkeeping';
import { agentFor } from './keys';

export type ExecuteOutcome = 'succeeded' | 'failed' | 'ambiguous' | 'blocked_reauth' | 'paused' | 'rate_limited' | 'skipped';

const HOUR_MS = 3_600_000;

/** Our own cap on agent emails per user per hour, well under Gmail's quotas. */
export function maxSendsPerHour(): number {
  const value = Number(process.env.OPERATIONS_MAX_SENDS_PER_HOUR);
  return Number.isInteger(value) && value > 0 ? value : 20;
}

export async function isPaused(workspaceId: string, agent: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('agent_settings')
    .select('paused')
    .eq('workspace_id', workspaceId)
    .eq('agent_key', agent)
    .maybeSingle();
  if (error) throw error;
  return data?.paused ?? false;
}

/**
 * Sends counted against the cap, including in-flight ones. The check and the claim are separate
 * statements, so two workers claiming at the same instant can exceed the cap by one; acceptable
 * for a safety margin that sits far below Gmail's real limits.
 */
async function sendsInLastHour(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('agent_actions')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', userId)
    .eq('kind', 'send_email')
    .in('status', ['executing', 'succeeded', 'ambiguous'])
    .gte('updated_at', new Date(Date.now() - HOUR_MS).toISOString());
  if (error) throw error;
  return count ?? 0;
}

const SAFE_MESSAGES: Record<string, string> = {
  REAUTH_REQUIRED: 'Reconnect Google to run this action',
  GOOGLE_CONFIG: 'Google is misconfigured on the server; contact the administrator',
  GOOGLE_AUTH_UNAVAILABLE: 'Google sign-in was unavailable; nothing was sent. Retry later',
  INTERNAL: 'Unexpected error',
};

/**
 * Where a failed attempt leaves the action, with a code and a message safe to show users (details
 * are logged). Only the Gmail send request itself can leave an email `ambiguous`: it got no answer
 * or a 5xx, so it may have gone out and is never retried automatically. Token refresh failures
 * happen before anything is sent; calendar inserts reuse a fixed event id. Both are retryable.
 */
function failureOf(row: ActionRow, error: unknown): { status: 'failed' | 'ambiguous' | 'blocked_reauth'; message: string } {
  const code = errorCode(error);
  if (!(error instanceof GoogleReauthRequired || error instanceof OperationError)) {
    console.error(`[operations] action ${row.id} failed (${code})`, error);
  }
  if (error instanceof GoogleReauthRequired) return { status: 'blocked_reauth', message: `${code}: ${SAFE_MESSAGES[code]}` };
  if (error instanceof OperationError) return { status: 'failed', message: `${code}: ${error.message}` };
  if (error instanceof GoogleApiError && row.kind === 'send_email' && error.outcomeUnknown) {
    return {
      status: 'ambiguous',
      message: `${code}: Gmail did not confirm the send. Check the Sent folder; retrying may send it twice`,
    };
  }
  if (error instanceof GoogleApiError && error.phase === 'request') {
    const reason = /^[A-Za-z_]{1,40}$/.test(error.reason) ? ` (${error.reason})` : '';
    return { status: 'failed', message: `${code}${reason}: Google rejected the request` };
  }
  const known = error instanceof GoogleApiError || error instanceof GoogleConfigError;
  return { status: 'failed', message: `${code}: ${SAFE_MESSAGES[known ? code : 'INTERNAL']}` };
}

/** Compare-and-set away from `approved` without running anything. */
async function settleApproved(actionId: string, changes: { status?: 'failed'; error: string }): Promise<void> {
  const { error } = await supabaseAdmin().from('agent_actions').update(changes).eq('id', actionId).eq('status', 'approved');
  if (error) throw error;
}

/**
 * Runs one approved action at most once. The claim is a compare-and-set from `approved` to
 * `executing`, so concurrent workers (after(), cron, retries) cannot both execute it. A paused
 * agent or the hourly cap leaves the action `approved` for a later run.
 */
export async function executeAction(actionId: string): Promise<ExecuteOutcome> {
  const db = supabaseAdmin();
  const { data: pending, error } = await db.from('agent_actions').select('*').eq('id', actionId).maybeSingle();
  if (error) throw error;
  if (!pending || pending.status !== 'approved') return 'skipped';

  const agent = agentFor(pending.kind as OperationsActionKind);
  const [member, paused, sends] = await Promise.all([
    isWorkspaceMember(pending.workspace_id, pending.requested_by),
    isPaused(pending.workspace_id, agent),
    pending.kind === 'send_email' ? sendsInLastHour(pending.requested_by) : Promise.resolve(0),
  ]);
  // A removed member's Google account must not keep acting for the workspace.
  if (!member) {
    await settleApproved(actionId, { status: 'failed', error: 'REQUESTER_NOT_MEMBER: The requester left this workspace' });
    return 'failed';
  }
  if (paused) return 'paused';
  if (sends >= maxSendsPerHour()) {
    await settleApproved(actionId, { error: `RATE_LIMITED: more than ${maxSendsPerHour()} emails in the last hour; will retry later` });
    return 'rate_limited';
  }

  const claim = await db
    .from('agent_actions')
    .update({ status: 'executing', attempts: pending.attempts + 1, error: null })
    .eq('id', actionId)
    .eq('status', 'approved')
    .eq('attempts', pending.attempts)
    .select('*')
    .maybeSingle();
  if (claim.error) throw claim.error;
  if (!claim.data) return 'skipped';
  const row = claim.data;
  // Scoped by workspace so two workspaces with the same key never share a calendar event id.
  const actionKey = `${row.workspace_id}:${row.idempotency_key}`;

  let result: OperationsActionResult;
  let simulated: boolean;
  try {
    const ops = await googleOpsFor(row.requested_by);
    simulated = ops.simulated;
    result =
      row.kind === 'schedule_interview'
        ? await ops.scheduleInterview(actionKey, row.payload as ScheduleInterviewPayload)
        : await ops.sendEmail(actionKey, row.payload as SendEmailPayload);
  } catch (err) {
    const failure = failureOf(row, err);
    const { error: saveError } = await db
      .from('agent_actions')
      .update({ status: failure.status, error: failure.message })
      .eq('id', row.id)
      .eq('status', 'executing');
    if (saveError) throw saveError;
    return failure.status;
  }

  const { error: saveError } = await db
    .from('agent_actions')
    .update({ status: 'succeeded', result: result as Json, provider_ref: result.providerRef ?? null, simulated, error: null })
    .eq('id', row.id)
    .eq('status', 'executing');
  if (saveError) throw saveError;
  await recordSuccess(row, agent, result, simulated);
  return 'succeeded';
}

/** Executes after the response is sent; failures are logged by the background helper. */
export function executeInBackground(actionId: string): void {
  runInBackground('operations:execute', () => executeAction(actionId));
}
