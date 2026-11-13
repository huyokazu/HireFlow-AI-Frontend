/**
 * API response shapes. The Expo app's service types are the contract, so they are imported from
 * `src/services` (type-only) instead of copied: a change there breaks the backend typecheck.
 */
export type { Localized, Language } from '@app/i18n/types';
export type { CampaignHealth, CampaignStage, CampaignSummary, DashboardSummary } from '@app/services/dashboard';
export type { Candidate } from '@app/services/candidates';
export type { AiSource, ProofOfSkill } from '@app/services/talent';
export type { PipelineCandidate, PipelineStage } from '@app/services/pipeline';
export type {
  CampaignAgent,
  CampaignDraft,
  DepartmentKey,
  Seniority,
  SourcingChannel,
  WorkMode,
} from '@app/services/campaigns';
export type {
  AgentEvent,
  AgentEventInput,
  AgentKey,
  AgentStats,
  AgentStatsByKey,
  AgentWorkspace,
  PausedAgents,
} from '@app/services/agents';
export type {
  BottleneckAlert,
  HealingOutcome,
  HealingRecord,
  SuggestedFix,
} from '@app/services/selfHealing';
export type { CampaignResults, ChannelResult, HiringAnalytics, HiringMonth, AgentWeek } from '@app/services/analytics';
export type {
  GoogleConnectionStatus,
  OperationsAction,
  OperationsActionKind,
  OperationsActionResult,
  OperationsActionStatus,
  ScheduleInterviewPayload,
  SendEmailPayload,
} from '@app/services/operations';

import type { AgentWorkspace, PausedAgents } from '@app/services/agents';
import type { CampaignDraft } from '@app/services/campaigns';
import type { Candidate } from '@app/services/candidates';
import type { DashboardSummary } from '@app/services/dashboard';
import type { PipelineCandidate } from '@app/services/pipeline';
import type { BottleneckAlert, HealingRecord } from '@app/services/selfHealing';

/** An alert plus HR's decision on it, so the app can rebuild approvals and dismissals after a reload. */
export type AlertWithDecision = BottleneckAlert & {
  status: 'open' | 'approved' | 'dismissed';
  approvedFixId: string | null;
  decidedAt: string | null;
};

export type AgentWorkspaceWithPause = AgentWorkspace & { paused: PausedAgents };

/** Everything the app loads on start, in one request. */
export type WorkspaceBootstrap = {
  workspaceId: string;
  /** The campaign whose matched candidates are featured; null in an empty workspace. */
  featuredCampaignId: string | null;
  summary: DashboardSummary;
  matchedCandidates: Candidate[];
  pipeline: PipelineCandidate[];
  alerts: AlertWithDecision[];
  history: HealingRecord[];
  campaignSetups: Record<string, CampaignDraft>;
  agents: AgentWorkspaceWithPause;
};

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  locale: 'en' | 'vi';
  timezone: string;
  defaultWorkspaceId: string | null;
};

export type WorkspaceMembership = {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  autoApproveInterviews: boolean;
};

export type Me = {
  profile: Profile;
  workspaces: WorkspaceMembership[];
  /** Session id from the access token, so the app can mark "this device" in the session list. */
  currentSessionId: string | null;
};

export type UserSession = {
  id: string;
  createdAt: string;
  refreshedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  aal: string | null;
  current: boolean;
};
