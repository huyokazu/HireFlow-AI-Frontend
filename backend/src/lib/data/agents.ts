import 'server-only';

import { unwrap, type Timing } from '@/lib/api/http';
import type { AgentEvent, AgentEventInput, AgentKey, PausedAgents } from '@/lib/contracts';
import { recordAgentEvents } from '@/lib/events';
import { supabaseAdmin, type WorkspaceContext } from '@/lib/supabase/server';

import { toPausedAgents } from './mappers';
import { AGENT_KEYS } from './constants';
import { rowsOf } from './result';

/**
 * The activity entries for one pause/resume action, by the app's rules: "every agent" when that is
 * where the change ends up, otherwise one entry per direction naming the agent or counting them.
 */
export function pauseEvents(previous: PausedAgents, next: PausedAgents): AgentEventInput[] {
  const changed = AGENT_KEYS.filter((agent) => previous[agent] !== next[agent]);
  if (changed.length === 0) return [];
  const everyAgentIs = (paused: boolean) => AGENT_KEYS.every((agent) => next[agent] === paused);
  if (changed.length > 1 && everyAgentIs(true)) return [{ kind: 'allPaused', actor: 'orchestrator' }];
  if (changed.length > 1 && everyAgentIs(false)) return [{ kind: 'allResumed', actor: 'orchestrator' }];

  const group = (agents: AgentKey[], paused: boolean): AgentEventInput[] => {
    if (agents.length === 1) return [{ kind: paused ? 'agentPaused' : 'agentResumed', actor: agents[0] }];
    if (agents.length > 1) {
      return [{ kind: paused ? 'agentsPaused' : 'agentsResumed', actor: 'orchestrator', count: agents.length }];
    }
    return [];
  };
  return [
    ...group(changed.filter((agent) => next[agent]), true),
    ...group(changed.filter((agent) => !next[agent]), false),
  ];
}

/** Applies a partial pause change for every campaign and logs it. Unchanged agents are not written. */
export async function setPausedAgents(
  ctx: WorkspaceContext,
  changes: Partial<PausedAgents>,
  timing: Timing,
): Promise<{ paused: PausedAgents; events: AgentEvent[] }> {
  const rows = rowsOf(
    await timing.measure(
      'db',
      ctx.supabase.from('agent_settings').select('agent_key, paused').eq('workspace_id', ctx.workspaceId),
    ),
  );
  const previous = toPausedAgents(rows);
  const next: PausedAgents = { ...previous };
  for (const agent of AGENT_KEYS) {
    const value = changes[agent];
    if (value !== undefined) next[agent] = value;
  }
  const changed = AGENT_KEYS.filter((agent) => previous[agent] !== next[agent]);
  if (changed.length === 0) return { paused: next, events: [] };

  const updatedAt = new Date().toISOString();
  unwrap(
    await timing.measure(
      'db_write',
      // Server write after the membership check, so updated_by is always the caller.
      supabaseAdmin().from('agent_settings').upsert(
        changed.map((agent) => ({
          workspace_id: ctx.workspaceId,
          agent_key: agent,
          paused: next[agent],
          updated_at: updatedAt,
          updated_by: ctx.userId,
        })),
        { onConflict: 'workspace_id,agent_key' },
      ),
    ),
  );
  // Logged only once the change is saved, so the activity log never reports a pause that failed.
  const events = await timing.measure('db_event', recordAgentEvents(ctx.workspaceId, pauseEvents(previous, next)));
  return { paused: next, events };
}
