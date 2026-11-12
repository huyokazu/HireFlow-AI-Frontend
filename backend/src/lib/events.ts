import 'server-only';

import type { Json, Tables } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/server';

import type { AgentEvent, AgentEventInput } from './contracts';

type EventRow = Pick<Tables<'agent_events'>, 'id' | 'at' | 'campaign_id' | 'kind' | 'actor' | 'payload'>;

export const EVENT_COLUMNS = 'id, at, campaign_id, kind, actor, payload' as const;

/** A stored event in the app's `AgentEvent` shape (payload fields flattened, id as a string). */
export function toAgentEvent(row: EventRow): AgentEvent {
  return {
    ...(row.payload as Record<string, unknown>),
    id: String(row.id),
    at: new Date(row.at).toISOString(),
    ...(row.campaign_id ? { campaignId: row.campaign_id } : {}),
    kind: row.kind,
    actor: row.actor,
  } as AgentEvent;
}

/**
 * Appends to the workspace's activity log. The insert trigger broadcasts the event to everyone
 * in the workspace over Realtime, so callers only return it to the requester.
 */
export async function recordAgentEvents(workspaceId: string, inputs: AgentEventInput[]): Promise<AgentEvent[]> {
  if (inputs.length === 0) return [];
  const rows = inputs.map((input) => {
    const { kind, actor, campaignId, ...payload } = input as AgentEventInput & { campaignId?: string };
    return { workspace_id: workspaceId, kind, actor, campaign_id: campaignId ?? null, payload: payload as NonNullable<Json> };
  });
  const { data, error } = await supabaseAdmin().from('agent_events').insert(rows).select(EVENT_COLUMNS);
  if (error) throw error;
  return data.map(toAgentEvent);
}
