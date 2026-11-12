import type { AgentWorkspace, PausedAgents } from './agents';
import type { CampaignDraft } from './campaigns';
import type { Candidate } from './candidates';
import type { DashboardSummary } from './dashboard';
import type { PipelineCandidate } from './pipeline';
import { ApiError, getRemote, isRecord, type RemoteAdapter } from './remote';
import type { AlertDecision, BottleneckAlert, HealingRecord } from './selfHealing';

/** The campaign whose matched candidates the dashboard features. */
export const FEATURED_CAMPAIGN_ID = 'senior-frontend-engineer';

/** Everything the app loads on start, in one request (`GET /api/bootstrap`). */
export type WorkspaceBootstrap = {
  workspaceId: string;
  /** The campaign whose matched candidates are featured; null in an empty workspace. */
  featuredCampaignId: string | null;
  summary: DashboardSummary;
  matchedCandidates: Candidate[];
  pipeline: PipelineCandidate[];
  alerts: (BottleneckAlert & AlertDecision)[];
  history: HealingRecord[];
  campaignSetups: Record<string, CampaignDraft>;
  agents: AgentWorkspace & { paused: PausedAgents };
};

let pending: Promise<WorkspaceBootstrap> | null = null;

/**
 * The workspace in one request, shared by every read that starts the app: one round trip instead of
 * seven. A failure is kept too, so the reads all fall back together instead of retrying one by one;
 * signing in or out starts over (`resetBootstrap`).
 */
export function loadBootstrap(remote: RemoteAdapter): Promise<WorkspaceBootstrap> {
  if (pending) return pending;
  const request = remote
    .request<unknown>(`/api/bootstrap?featured=${encodeURIComponent(FEATURED_CAMPAIGN_ID)}`)
    .then((data) => {
      if (!isBootstrap(data)) throw new ApiError(200, 'INVALID_RESPONSE', 'The bootstrap response is incomplete.');
      // A response for a user who has since signed out must not pick the next user's workspace.
      if (pending === request) remote.setWorkspaceId(data.workspaceId);
      return data;
    });
  pending = request;
  return request;
}

export function resetBootstrap(): void {
  pending = null;
  getRemote()?.setWorkspaceId(null);
}

/** The workspace the API data belongs to, or `null` in mock mode or when the app fell back to mocks. */
export async function fetchWorkspaceId(): Promise<string | null> {
  const remote = getRemote();
  if (!remote) return null;
  try {
    return (await loadBootstrap(remote)).workspaceId;
  } catch {
    return null;
  }
}

function isBootstrap(value: unknown): value is WorkspaceBootstrap {
  return (
    isRecord(value) &&
    typeof value.workspaceId === 'string' &&
    isRecord(value.summary) &&
    Array.isArray(value.summary.campaigns) &&
    Array.isArray(value.matchedCandidates) &&
    Array.isArray(value.pipeline) &&
    Array.isArray(value.alerts) &&
    Array.isArray(value.history) &&
    isRecord(value.campaignSetups) &&
    isRecord(value.agents) &&
    isRecord(value.agents.stats) &&
    Array.isArray(value.agents.events)
  );
}
