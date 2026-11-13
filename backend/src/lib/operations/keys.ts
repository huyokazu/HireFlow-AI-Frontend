import type { AgentKey, OperationsActionKind } from '@/lib/contracts';

/**
 * Business identity of an action. Re-proposing (a card moved back and forth, a cron re-run) maps
 * onto the same row via the unique (workspace_id, idempotency_key); bump the suffix to re-plan.
 */
export const interviewKey = (applicationId: string) => `interview:${applicationId}:r1`;
export const offerKey = (applicationId: string) => `offer:${applicationId}:v1`;

export const defaultKey = (kind: OperationsActionKind, applicationId: string) =>
  kind === 'schedule_interview' ? interviewKey(applicationId) : offerKey(applicationId);

/** The agent responsible for (and pausable for) each kind of action. */
export const agentFor = (kind: OperationsActionKind): Extract<AgentKey, 'scheduling' | 'offer'> =>
  kind === 'schedule_interview' ? 'scheduling' : 'offer';
