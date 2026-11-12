import 'server-only';

import type { AgentEventInput, OperationsActionResult, ScheduleInterviewPayload, SendEmailPayload } from '@/lib/contracts';
import { recordAgentEvents } from '@/lib/events';
import { supabaseAdmin } from '@/lib/supabase/server';

import type { ActionRow } from './actions';

/** Counter maintenance for the agents screen. Read-modify-write: a lost update only skews a display counter. */
async function bumpStats(workspaceId: string, agent: 'scheduling' | 'offer'): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('agent_stats')
    .select('done_today, queued')
    .eq('workspace_id', workspaceId)
    .eq('agent_key', agent)
    .maybeSingle();
  if (error) throw error;
  const { error: saveError } = await db.from('agent_stats').upsert({
    workspace_id: workspaceId,
    agent_key: agent,
    done_today: (data?.done_today ?? 0) + 1,
    queued: Math.max(0, (data?.queued ?? 0) - 1),
    last_active_at: new Date().toISOString(),
  });
  if (saveError) throw saveError;
}

function successEvent(row: ActionRow, result: OperationsActionResult, simulated: boolean): AgentEventInput | null {
  const details = {
    ...(row.campaign_id && { campaignId: row.campaign_id }),
    candidateId: row.candidate_id ?? '',
    actionId: row.id,
    startsAt: result.startsAt,
    meetLink: result.meetLink,
    simulated,
  };
  if (row.kind === 'schedule_interview') {
    const payload = row.payload as ScheduleInterviewPayload;
    return { kind: 'interviewBooked', actor: 'scheduling', candidate: payload.candidateName, ...details };
  }
  const payload = row.payload as SendEmailPayload;
  return payload.purpose === 'offer' ? { kind: 'offerSent', actor: 'offer', candidate: payload.candidateName, ...details } : null;
}

/**
 * Activity event and agent counters after a successful action. The side effect already happened,
 * so failures here are logged and never turned into a retry.
 */
export async function recordSuccess(
  row: ActionRow,
  agent: 'scheduling' | 'offer',
  result: OperationsActionResult,
  simulated: boolean,
): Promise<void> {
  try {
    const event = successEvent(row, result, simulated);
    if (event) await recordAgentEvents(row.workspace_id, [event]);
    await bumpStats(row.workspace_id, agent);
  } catch (err) {
    console.error('[operations] post-success bookkeeping failed', err);
  }
}
