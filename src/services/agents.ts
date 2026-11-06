import type { Localized } from '../i18n/types';
import type { CampaignDraft, SourcingChannel } from './campaigns';
import type { CampaignSummary } from './dashboard';
import type { PipelineCandidate, PipelineStage } from './pipeline';
import { fetchActiveBottleneckAlerts } from './selfHealing';

/** The specialist agents the Orchestrator runs. HR can pause any of them. */
export type AgentKey = 'sourcing' | 'matching' | 'scheduling' | 'offer' | 'selfHealing';
/** Who an activity entry is about: one of the agents, or the Orchestrator itself. */
export type AgentActor = AgentKey | 'orchestrator';

export const AGENT_KEYS: readonly AgentKey[] = ['sourcing', 'matching', 'scheduling', 'offer', 'selfHealing'];
/** Agents that pass candidates down the hiring pipeline, in order. The Self-Healing monitor watches them all. */
export const FLOW_AGENTS: readonly AgentKey[] = ['sourcing', 'matching', 'scheduling', 'offer'];

export type AgentStats = {
  /** Items finished today: CVs imported, CVs scored, interviews booked, offers drafted or checks run. */
  doneToday: number;
  /** Items handed over by the agent before this one, waiting to be picked up. */
  queued: number;
  /** Share of this agent's work HR kept as it was, in percent. */
  agreementRate: number;
  /** Median time per item, in seconds. */
  medianSeconds: number;
  /** ISO timestamp of the last item the agent finished. */
  lastActiveAt: string;
};

export type AgentStatsByKey = Record<AgentKey, AgentStats>;
export type PausedAgents = Record<AgentKey, boolean>;

type EventBase = { id: string; at: string; campaignId?: string };

/** One thing an agent (or the Orchestrator) did. The dictionary turns it into a sentence. */
export type AgentEvent = EventBase &
  (
    | { kind: 'cvsImported'; actor: 'sourcing'; count: number; channel: SourcingChannel }
    | { kind: 'cvsScored'; actor: 'matching'; count: number }
    | { kind: 'shortlistHandoff'; actor: 'orchestrator'; count: number }
    | { kind: 'interviewBooked'; actor: 'scheduling'; candidateId: string; candidate: string }
    | { kind: 'offerDrafted'; actor: 'offer'; candidateId: string; candidate: string }
    | { kind: 'healthCheck'; actor: 'selfHealing'; campaigns: number }
    | { kind: 'bottleneckFlagged'; actor: 'selfHealing'; issue: Localized }
    | { kind: 'fixApplied'; actor: 'orchestrator'; fix: Localized }
    | { kind: 'setupUpdated'; actor: 'orchestrator' }
    | { kind: 'campaignLaunched'; actor: 'orchestrator'; agents: number }
    | { kind: 'agentPaused' | 'agentResumed'; actor: AgentKey }
    | { kind: 'agentsPaused' | 'agentsResumed'; actor: 'orchestrator'; count: number }
    | { kind: 'allPaused' | 'allResumed'; actor: 'orchestrator' }
  );

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before it has an id and a time. */
export type AgentEventInput = DistributiveOmit<AgentEvent, 'id' | 'at'>;

export type AgentWorkspace = {
  stats: AgentStatsByKey;
  /** Newest first. */
  events: AgentEvent[];
  /** Tasks the agents had finished by this time yesterday, to compare today with. */
  tasksYesterday: number;
  /** Recruiter hours the agents saved earlier this week, before today. */
  hoursSavedBeforeToday: number;
};

/** What the activity stream needs to know to say what happens next. */
export type ActivityContext = {
  stats: AgentStatsByKey;
  paused: PausedAgents;
  campaigns: CampaignSummary[];
  setups: Record<string, CampaignDraft>;
  candidates: PipelineCandidate[];
  events: AgentEvent[];
};

export const NO_AGENTS_PAUSED: PausedAgents = {
  sourcing: false,
  matching: false,
  scheduling: false,
  offer: false,
  selfHealing: false,
};

export const ALL_AGENTS_PAUSED: PausedAgents = {
  sourcing: true,
  matching: true,
  scheduling: true,
  offer: true,
  selfHealing: true,
};

/** Minutes a recruiter would spend on one item by hand. */
const MANUAL_MINUTES: Record<AgentKey, number> = {
  sourcing: 6,
  matching: 10,
  scheduling: 20,
  offer: 45,
  selfHealing: 1,
};

/** Recruiter hours the agents saved with today's work. */
export function hoursSavedToday(stats: AgentStatsByKey): number {
  return AGENT_KEYS.reduce((sum, agent) => sum + (stats[agent].doneToday * MANUAL_MINUTES[agent]) / 60, 0);
}

let eventCount = 0;

export function createAgentEvent(input: AgentEventInput, at: Date = new Date()): AgentEvent {
  eventCount += 1;
  return { ...input, id: `evt_${at.getTime().toString(36)}_${eventCount}`, at: at.toISOString() };
}

/**
 * How an event changes the agents' numbers: finished work counts up, and a hand-off fills the
 * queue of the agent that picks the work up next.
 */
export function applyAgentEvent(stats: AgentStatsByKey, event: AgentEvent): AgentStatsByKey {
  switch (event.kind) {
    case 'cvsImported':
      return adjust(adjust(stats, 'sourcing', { done: event.count, at: event.at }), 'matching', { queued: event.count });
    case 'cvsScored':
      return adjust(stats, 'matching', { done: event.count, queued: -event.count, at: event.at });
    case 'shortlistHandoff':
      return adjust(stats, 'scheduling', { queued: event.count });
    case 'interviewBooked':
      return adjust(stats, 'scheduling', { done: 1, queued: -1, at: event.at });
    case 'offerDrafted':
      return adjust(stats, 'offer', { done: 1, queued: -1, at: event.at });
    case 'healthCheck':
      return adjust(stats, 'selfHealing', { done: 1, at: event.at });
    default:
      return stats;
  }
}

function adjust(
  stats: AgentStatsByKey,
  agent: AgentKey,
  change: { done?: number; queued?: number; at?: string },
): AgentStatsByKey {
  const current = stats[agent];
  return {
    ...stats,
    [agent]: {
      ...current,
      doneToday: current.doneToday + (change.done ?? 0),
      queued: Math.max(0, current.queued + (change.queued ?? 0)),
      lastActiveAt: change.at ?? current.lastActiveAt,
    },
  };
}

const MINUTE = 60 * 1000;

/**
 * Today's numbers for every agent and what they did recently.
 * Mock implementation: replace with selects on the Orchestrator's agent_stats and agent_events tables.
 */
export async function fetchAgentWorkspace(): Promise<AgentWorkspace> {
  const alerts = await fetchActiveBottleneckAlerts();
  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * MINUTE);
  const recent: AgentEvent[] = [
    createAgentEvent({ kind: 'cvsScored', actor: 'matching', campaignId: 'senior-frontend-engineer', count: 3 }, ago(1)),
    createAgentEvent({ kind: 'healthCheck', actor: 'selfHealing', campaigns: 6 }, ago(3)),
    createAgentEvent(
      { kind: 'cvsImported', actor: 'sourcing', campaignId: 'senior-frontend-engineer', count: 2, channel: 'itviec' },
      ago(4),
    ),
    createAgentEvent(
      {
        kind: 'interviewBooked',
        actor: 'scheduling',
        campaignId: 'hr-business-partner',
        candidateId: 'cand_602',
        candidate: 'Isabel Ruiz',
      },
      ago(9),
    ),
    createAgentEvent({ kind: 'shortlistHandoff', actor: 'orchestrator', campaignId: 'product-designer', count: 2 }, ago(14)),
    createAgentEvent({ kind: 'cvsScored', actor: 'matching', campaignId: 'product-designer', count: 4 }, ago(21)),
    createAgentEvent(
      {
        kind: 'offerDrafted',
        actor: 'offer',
        campaignId: 'hr-business-partner',
        candidateId: 'cand_601',
        candidate: 'Thu Nguyen',
      },
      ago(35),
    ),
    createAgentEvent(
      { kind: 'cvsImported', actor: 'sourcing', campaignId: 'backend-engineer-go', count: 3, channel: 'linkedin' },
      ago(48),
    ),
    createAgentEvent(
      {
        kind: 'interviewBooked',
        actor: 'scheduling',
        campaignId: 'backend-engineer-go',
        candidateId: 'cand_501',
        candidate: 'Lukas Novak',
      },
      ago(70),
    ),
  ];
  // The monitor raised every open Self-Healing alert, at the moment it was detected.
  const flagged = alerts.map((alert) =>
    createAgentEvent(
      { kind: 'bottleneckFlagged', actor: 'selfHealing', campaignId: alert.campaignId, issue: alert.title },
      new Date(alert.detectedAt),
    ),
  );
  const events = [...recent, ...flagged].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const lastActive = (minutes: number) => ago(minutes).toISOString();

  return {
    stats: {
      sourcing: { doneToday: 18, queued: 0, agreementRate: 91, medianSeconds: 40, lastActiveAt: lastActive(4) },
      matching: { doneToday: 24, queued: 5, agreementRate: 94, medianSeconds: 12, lastActiveAt: lastActive(1) },
      scheduling: { doneToday: 6, queued: 3, agreementRate: 97, medianSeconds: 95, lastActiveAt: lastActive(9) },
      offer: { doneToday: 1, queued: 2, agreementRate: 88, medianSeconds: 280, lastActiveAt: lastActive(35) },
      selfHealing: { doneToday: 96, queued: 0, agreementRate: 80, medianSeconds: 8, lastActiveAt: lastActive(3) },
    },
    events,
    tasksYesterday: 131,
    hoursSavedBeforeToday: 38,
  };
}

/**
 * Pauses or resumes agents for every campaign. A paused agent's work waits in its queue.
 * Mock implementation: replace with an Orchestrator API call.
 */
export async function updatePausedAgents(_changes: Partial<PausedAgents>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
}

const STREAM_MIN_DELAY_MS = 5000;
const STREAM_MAX_DELAY_MS = 9000;
/** CVs the Matching Agent scores before the Orchestrator hands a shortlist to the Scheduling Agent. */
const SCORED_PER_SHORTLIST = 3;

/**
 * Calls `onEvent` with each thing the agents do, as they do it, until the returned function is called.
 * Mock implementation: invents a plausible next step every few seconds from the current numbers;
 * replace with a Supabase Realtime subscription to the agent_events table.
 */
export function subscribeToAgentActivity(
  getContext: () => ActivityContext | null,
  onEvent: (event: AgentEvent) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scoredSinceShortlist = 0;

  const scheduleNext = () => {
    const delay = STREAM_MIN_DELAY_MS + Math.random() * (STREAM_MAX_DELAY_MS - STREAM_MIN_DELAY_MS);
    timer = setTimeout(() => {
      const context = getContext();
      const input = context ? nextMockEvent(context, scoredSinceShortlist) : null;
      if (input) {
        if (input.kind === 'cvsScored') scoredSinceShortlist += input.count;
        if (input.kind === 'shortlistHandoff') scoredSinceShortlist = 0;
        onEvent(createAgentEvent(input));
      }
      scheduleNext();
    }, delay);
  };

  scheduleNext();
  return () => clearTimeout(timer);
}

type MockOption = { weight: number; make: () => AgentEventInput | null };

function nextMockEvent(context: ActivityContext, scoredSinceShortlist: number): AgentEventInput | null {
  const { stats, paused, campaigns, setups, candidates, events } = context;
  const running = (agent: AgentKey) => !paused[agent];
  // Campaigns that run this agent. A blocked campaign has nothing new to import.
  const campaignsFor = (agent: 'sourcing' | 'matching') =>
    campaigns.filter(
      (campaign) => setups[campaign.id]?.agents[agent] !== false && (agent !== 'sourcing' || campaign.health !== 'blocked'),
    );
  const options: MockOption[] = [];

  if (running('sourcing')) {
    options.push({
      weight: 3,
      make: () => {
        const campaign = randomItem(campaignsFor('sourcing'));
        if (!campaign) return null;
        const channel = randomItem(setups[campaign.id]?.channels ?? []) ?? 'linkedin';
        return { kind: 'cvsImported', actor: 'sourcing', campaignId: campaign.id, count: randomInt(1, 3), channel };
      },
    });
  }
  if (running('matching') && stats.matching.queued > 0) {
    options.push({
      weight: 4,
      make: () => ({
        kind: 'cvsScored',
        actor: 'matching',
        campaignId: randomItem(campaignsFor('matching'))?.id,
        count: Math.min(stats.matching.queued, randomInt(1, 4)),
      }),
    });
  }
  if (scoredSinceShortlist >= SCORED_PER_SHORTLIST) {
    options.push({
      weight: 2,
      make: () => ({
        kind: 'shortlistHandoff',
        actor: 'orchestrator',
        campaignId: randomItem(campaignsFor('matching'))?.id,
        count: randomInt(1, 2),
      }),
    });
  }
  if (running('scheduling') && stats.scheduling.queued > 0) {
    options.push({
      weight: 2,
      make: () => {
        // A candidate who just reached Interview comes first; otherwise the next round for someone already in the loop.
        const booked = idsFrom(events, 'interviewBooked');
        const candidate = nextCandidate(candidates, 'interview', booked) ?? randomItem(inStage(candidates, 'interview'));
        if (!candidate) return null;
        return {
          kind: 'interviewBooked',
          actor: 'scheduling',
          campaignId: candidate.campaignId,
          candidateId: candidate.id,
          candidate: candidate.name,
        };
      },
    });
  }
  if (running('offer') && stats.offer.queued > 0) {
    options.push({
      weight: 1,
      make: () => {
        const candidate = nextCandidate(candidates, 'offer', idsFrom(events, 'offerDrafted'));
        if (!candidate) return null;
        return {
          kind: 'offerDrafted',
          actor: 'offer',
          campaignId: candidate.campaignId,
          candidateId: candidate.id,
          candidate: candidate.name,
        };
      },
    });
  }
  if (running('selfHealing') && campaigns.length > 0) {
    options.push({
      weight: 1,
      make: () => ({ kind: 'healthCheck', actor: 'selfHealing', campaigns: campaigns.length }),
    });
  }

  return pickWeighted(options)?.make() ?? null;
}

function inStage(candidates: PipelineCandidate[], stage: PipelineStage) {
  return candidates.filter((candidate) => candidate.stage === stage);
}

/** The candidate who entered the stage most recently and hasn't been handled yet. */
function nextCandidate(candidates: PipelineCandidate[], stage: PipelineStage, handled: Set<string>) {
  return inStage(candidates, stage)
    .filter((candidate) => !handled.has(candidate.id))
    .sort((a, b) => a.daysInStage - b.daysInStage)[0];
}

function idsFrom(events: AgentEvent[], kind: 'interviewBooked' | 'offerDrafted'): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind === kind) ids.add(event.candidateId);
  }
  return ids;
}

function pickWeighted(options: MockOption[]): MockOption | undefined {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll < 0) return option;
  }
  return options[options.length - 1];
}

function randomItem<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
