import { AGENT_KEYS, type AgentEventInput, type AgentKey, type AgentStatsByKey, type PausedAgents } from '../services/agents';
import type { DashboardSummary } from '../services/dashboard';
import type { AlertDecision, BottleneckAlert } from '../services/selfHealing';

/** The fix HR approved for an alert, and when. */
export type AlertApproval = { fixId: string; at: string };

/**
 * HR's earlier decisions, as the server saved them: approved fixes and dismissals by alert id.
 * Mock alerts carry no decision, so they all start open.
 */
export function decisionsFromAlerts(alerts: (BottleneckAlert & Partial<AlertDecision>)[]): {
  approvals: Record<string, AlertApproval>;
  dismissals: Record<string, string>;
} {
  const approvals: Record<string, AlertApproval> = {};
  const dismissals: Record<string, string> = {};
  for (const alert of alerts) {
    const at = alert.decidedAt ?? alert.detectedAt;
    if (alert.status === 'approved' && alert.approvedFixId) approvals[alert.id] = { fixId: alert.approvedFixId, at };
    if (alert.status === 'dismissed') dismissals[alert.id] = at;
  }
  return { approvals, dismissals };
}

/** What screens show if even the mock data could not load, so none of them waits forever. */
export const EMPTY_SUMMARY: DashboardSummary = {
  activeCampaigns: 0,
  campaignsAtRisk: 0,
  candidatesInPipeline: 0,
  newCandidatesThisWeek: 0,
  averageMatchRate: 0,
  targetMatchRate: 0,
  averageTimeToHireDays: 0,
  timeToHireChangeDays: 0,
  campaigns: [],
};

export function emptyAgentStats(): AgentStatsByKey {
  const at = new Date().toISOString();
  return Object.fromEntries(
    AGENT_KEYS.map((agent) => [agent, { doneToday: 0, queued: 0, agreementRate: 0, medianSeconds: 0, lastActiveAt: at }]),
  ) as AgentStatsByKey;
}

/**
 * What the Orchestrator logs for a pause change, in mock mode where the app logs it: one entry per
 * action, "every agent" when that's where it ends up, else a name or a count.
 */
export function pauseEvents(changed: AgentKey[], next: PausedAgents): AgentEventInput[] {
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
  return [...group(changed.filter((agent) => next[agent]), true), ...group(changed.filter((agent) => !next[agent]), false)];
}
