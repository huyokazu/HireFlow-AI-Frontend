import type { RealtimeChannel } from '@supabase/supabase-js';

import type { AgentEvent } from '../services/agents';
import type { OperationsActionStatus } from '../services/operations';
import { isRecord } from '../services/remote';
import { supabase } from './supabase';

/** What the server broadcasts when an Operations Agent action changes status. */
export type ActionUpdate = {
  id: string;
  kind: string;
  status: OperationsActionStatus;
  simulated: boolean;
  candidateId: string | null;
  updatedAt: string;
};

type Listeners = {
  agentEvent: Set<(event: AgentEvent) => void>;
  actionUpdated: Set<(update: ActionUpdate) => void>;
};

type Subscription = { channel: RealtimeChannel; listeners: Listeners };

// One channel per workspace, shared by every screen that listens, and closed with the last listener.
const subscriptions = new Map<string, Subscription>();

/**
 * Listens to the workspace's private Realtime channel until the returned function is called.
 * Realtime is a live tail only; history comes from the API.
 */
export function subscribeToWorkspace(
  workspaceId: string,
  handlers: { onAgentEvent?: (event: AgentEvent) => void; onActionUpdated?: (update: ActionUpdate) => void },
): () => void {
  const client = supabase;
  if (!client) return () => undefined;

  let subscription = subscriptions.get(workspaceId);
  if (!subscription) {
    const listeners: Listeners = { agentEvent: new Set(), actionUpdated: new Set() };
    const channel = client
      .channel(`workspace:${workspaceId}`, { config: { private: true } })
      .on('broadcast', { event: 'agent_event' }, ({ payload }) => {
        if (isAgentEvent(payload)) listeners.agentEvent.forEach((listener) => listener(payload));
      })
      .on('broadcast', { event: 'action_updated' }, ({ payload }) => {
        if (isActionUpdate(payload)) listeners.actionUpdated.forEach((listener) => listener(payload));
      });
    subscription = { channel, listeners };
    subscriptions.set(workspaceId, subscription);
    // Private channels check the user's token, so it has to be set before joining.
    void client.realtime
      .setAuth()
      .then(() =>
        channel.subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[realtime] workspace channel ${status.toLowerCase()}`, error?.message ?? '');
          }
        }),
      )
      .catch((error: unknown) => console.warn('[realtime] Could not join the workspace channel.', error));
  }

  const { listeners } = subscription;
  if (handlers.onAgentEvent) listeners.agentEvent.add(handlers.onAgentEvent);
  if (handlers.onActionUpdated) listeners.actionUpdated.add(handlers.onActionUpdated);

  return () => {
    if (handlers.onAgentEvent) listeners.agentEvent.delete(handlers.onAgentEvent);
    if (handlers.onActionUpdated) listeners.actionUpdated.delete(handlers.onActionUpdated);
    const current = subscriptions.get(workspaceId);
    if (current && current.listeners.agentEvent.size === 0 && current.listeners.actionUpdated.size === 0) {
      subscriptions.delete(workspaceId);
      void client.removeChannel(current.channel);
    }
  };
}

// Every kind the activity feed can put into words; a newer server's other kinds are skipped.
const EVENT_KINDS: Record<AgentEvent['kind'], true> = {
  cvsImported: true,
  cvsScored: true,
  shortlistHandoff: true,
  interviewBooked: true,
  offerDrafted: true,
  offerSent: true,
  healthCheck: true,
  bottleneckFlagged: true,
  fixApplied: true,
  setupUpdated: true,
  campaignLaunched: true,
  agentPaused: true,
  agentResumed: true,
  agentsPaused: true,
  agentsResumed: true,
  allPaused: true,
  allResumed: true,
};

// Broadcast payloads come from the network, so only well-formed ones reach the app.
function isAgentEvent(value: unknown): value is AgentEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    Object.prototype.hasOwnProperty.call(EVENT_KINDS, value.kind) &&
    typeof value.actor === 'string' &&
    typeof value.at === 'string'
  );
}

function isActionUpdate(value: unknown): value is ActionUpdate {
  return isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';
}
