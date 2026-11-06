import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  AGENT_KEYS,
  applyAgentEvent,
  createAgentEvent,
  fetchAgentWorkspace,
  NO_AGENTS_PAUSED,
  subscribeToAgentActivity,
  updatePausedAgents,
  type ActivityContext,
  type AgentEvent,
  type AgentEventInput,
  type AgentKey,
  type AgentStatsByKey,
  type PausedAgents,
} from '../services/agents';
import {
  CAMPAIGN_AGENTS,
  fetchCampaignSetups,
  launchCampaign as launchCampaignRequest,
  updateCampaignSetup,
  type CampaignDraft,
} from '../services/campaigns';
import { fetchMatchedCandidates, type Candidate } from '../services/candidates';
import { fetchDashboardSummary, type CampaignSummary, type DashboardSummary } from '../services/dashboard';
import { calibrationOffset } from '../services/digitalTwin';
import { fetchPipeline, saveCandidateStage, type PipelineCandidate, type PipelineStage } from '../services/pipeline';
import {
  approveSuggestedFix,
  fetchActiveBottleneckAlerts,
  fetchHealingHistory,
  type BottleneckAlert,
  type HealingRecord,
  type SuggestedFix,
} from '../services/selfHealing';

/** The campaign whose matched candidates the dashboard features. */
export const FEATURED_CAMPAIGN_ID = 'senior-frontend-engineer';

/** A stage change, kept so it can be undone. */
export type PipelineMove = {
  candidateId: string;
  from: PipelineStage;
  to: PipelineStage;
  /** Position in the board order before the move, so undo puts the card back where it was. */
  fromIndex: number;
  fromDaysInStage: number;
};

/** The fix HR approved for an alert, and when. */
export type AlertApproval = { fixId: string; at: string };

/** What today's agent numbers are compared with. */
export type AgentBaseline = { tasksYesterday: number; hoursSavedBeforeToday: number };

/** Activity entries kept in memory, newest first. */
const MAX_AGENT_EVENTS = 60;

type Workspace = {
  summary: DashboardSummary | null;
  matchedCandidates: Candidate[] | null;
  pipeline: PipelineCandidate[] | null;
  /** Alerts on screen: open ones, plus approved ones until HR closes them. */
  alerts: BottleneckAlert[];
  /** Alerts still waiting for a decision. */
  openAlerts: BottleneckAlert[];
  /** Approved fixes, by alert id. */
  approvals: Record<string, AlertApproval>;
  /** Fixes and dismissals, newest first: this session's plus the last 30 days'. */
  healingLog: HealingRecord[];
  /** Hides an alert. Without an approved fix, it goes to the log as dismissed. */
  dismissAlert: (alert: BottleneckAlert) => void;
  /** Brings back an alert that was dismissed without a fix. */
  reopenAlert: (alertId: string) => void;
  approveFix: (alert: BottleneckAlert, fix: SuggestedFix) => Promise<void>;
  /** Moves a card to another stage. Returns `null` when nothing changed. */
  moveCandidate: (candidateId: string, to: PipelineStage) => PipelineMove | null;
  undoMove: (move: PipelineMove) => void;
  /** Shortlisting in the matched-candidates deck sends a not-yet-interviewed candidate to interview. */
  shortlistCandidate: (candidateId: string) => PipelineMove | null;
  launchCampaign: (draft: CampaignDraft) => Promise<CampaignSummary>;
  /** How each campaign is set up today, by campaign id. */
  campaignSetups: Record<string, CampaignDraft>;
  /** Match-rate calibration per campaign, so the Digital Twin's baseline matches live results. */
  twinOffsets: Record<string, number>;
  /** Saves a new setup for a campaign, e.g. a Digital Twin scenario. */
  applyCampaignSetup: (campaignId: string, setup: CampaignDraft) => Promise<void>;
  /** Today's numbers for each AI agent; `null` until loaded. */
  agentStats: AgentStatsByKey | null;
  agentBaseline: AgentBaseline | null;
  /** What the agents and the Orchestrator did, newest first. */
  agentEvents: AgentEvent[];
  /** Agents HR paused, on every campaign. */
  pausedAgents: PausedAgents;
  /** Agents not paused, for the sidebar. */
  agentsOnline: number;
  /** Pauses and resumes agents; the change goes to the activity log. */
  setPausedAgents: (next: PausedAgents) => void;
  /** Streams agent activity into the workspace until the returned function is called. */
  watchAgentActivity: () => () => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);

/**
 * App-wide recruiting data. Screens read from here instead of fetching on their own, so a change
 * made on one screen (a shortlist, a new campaign) is already there on the next.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [matchedCandidates, setMatchedCandidates] = useState<Candidate[] | null>(null);
  const [pipeline, setPipelineState] = useState<PipelineCandidate[] | null>(null);
  const [allAlerts, setAllAlerts] = useState<BottleneckAlert[]>([]);
  const [approvals, setApprovals] = useState<Record<string, AlertApproval>>({});
  // Alert id → when it was hidden.
  const [dismissals, setDismissals] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HealingRecord[]>([]);
  const [campaignSetups, setCampaignSetups] = useState<Record<string, CampaignDraft>>({});
  const [twinOffsets, setTwinOffsets] = useState<Record<string, number>>({});
  const [agentStats, setAgentStats] = useState<AgentStatsByKey | null>(null);
  const [agentBaseline, setAgentBaseline] = useState<AgentBaseline | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [pausedAgents, setPausedAgentsState] = useState<PausedAgents>(NO_AGENTS_PAUSED);
  // Mirrors `pipeline` so a move can report what it changed without waiting for a re-render.
  const pipelineRef = useRef<PipelineCandidate[] | null>(null);
  // Mirrors `pausedAgents`, so a change can be compared with the state it replaces.
  const pausedRef = useRef<PausedAgents>(NO_AGENTS_PAUSED);
  // What the activity stream reads to decide what happens next.
  const activityContextRef = useRef<ActivityContext | null>(null);

  const setPipeline = useCallback((next: PipelineCandidate[]) => {
    pipelineRef.current = next;
    setPipelineState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDashboardSummary(),
      fetchMatchedCandidates(FEATURED_CAMPAIGN_ID),
      fetchPipeline(),
      fetchActiveBottleneckAlerts(),
      fetchHealingHistory(),
      fetchCampaignSetups(),
      fetchAgentWorkspace(),
    ]).then(([summaryResult, matched, board, openAlerts, pastRecords, setups, agents]) => {
      if (cancelled) return;
      setSummary(summaryResult);
      setMatchedCandidates(matched);
      setPipeline(board);
      setAllAlerts(openAlerts);
      setHistory(pastRecords);
      setCampaignSetups(setups);
      setAgentStats(agents.stats);
      setAgentEvents(agents.events);
      setAgentBaseline({ tasksYesterday: agents.tasksYesterday, hoursSavedBeforeToday: agents.hoursSavedBeforeToday });
      // Calibrated once, against today's live match rates.
      const offsets: Record<string, number> = {};
      for (const campaign of summaryResult.campaigns) {
        const setup = setups[campaign.id];
        if (setup) offsets[campaign.id] = calibrationOffset(setup, campaign.matchRate);
      }
      setTwinOffsets(offsets);
    });
    return () => {
      cancelled = true;
    };
  }, [setPipeline]);

  const alerts = useMemo(() => allAlerts.filter((alert) => !dismissals[alert.id]), [allAlerts, dismissals]);
  const openAlerts = useMemo(() => alerts.filter((alert) => !approvals[alert.id]), [alerts, approvals]);

  const healingLog = useMemo(() => {
    const thisSession: HealingRecord[] = [];
    for (const alert of allAlerts) {
      const approval = approvals[alert.id];
      const base = {
        alertId: alert.id,
        campaignId: alert.campaignId,
        campaignName: alert.campaignName,
        issue: alert.title,
      };
      if (approval) {
        const fix = alert.suggestedFixes.find((item) => item.id === approval.fixId);
        const { current, label } = alert.metric;
        thisSession.push({
          ...base,
          id: `approved_${alert.id}`,
          fix: fix?.actionLabel,
          outcome: 'in_progress',
          at: approval.at,
          result: { label, before: current, after: Math.min(100, current + (fix?.expectedLift ?? 0)) },
        });
      } else if (dismissals[alert.id]) {
        thisSession.push({ ...base, id: `dismissed_${alert.id}`, outcome: 'dismissed', at: dismissals[alert.id] });
      }
    }
    return [...thisSession, ...history].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [allAlerts, approvals, dismissals, history]);

  const recordAgentEvent = useCallback((event: AgentEvent) => {
    setAgentEvents((current) => [event, ...current].slice(0, MAX_AGENT_EVENTS));
    setAgentStats((current) => current && applyAgentEvent(current, event));
  }, []);

  // What the Orchestrator logs on the server when HR acts; the mock adds it here.
  const logAgentEvent = useCallback(
    (input: AgentEventInput) => recordAgentEvent(createAgentEvent(input)),
    [recordAgentEvent],
  );

  useEffect(() => {
    activityContextRef.current =
      summary && agentStats
        ? {
            stats: agentStats,
            paused: pausedAgents,
            campaigns: summary.campaigns,
            setups: campaignSetups,
            candidates: pipeline ?? [],
            events: agentEvents,
          }
        : null;
  }, [summary, agentStats, pausedAgents, campaignSetups, pipeline, agentEvents]);

  const watchAgentActivity = useCallback(
    () => subscribeToAgentActivity(() => activityContextRef.current, recordAgentEvent),
    [recordAgentEvent],
  );

  const setPausedAgents = useCallback(
    (next: PausedAgents) => {
      const previous = pausedRef.current;
      const changed = AGENT_KEYS.filter((agent) => previous[agent] !== next[agent]);
      if (changed.length === 0) return;
      pausedRef.current = next;
      setPausedAgentsState(next);
      // One log entry per action: "every agent" when that's where it ends up, else a name or a count.
      const everyAgentIs = (paused: boolean) => AGENT_KEYS.every((agent) => next[agent] === paused);
      const logGroup = (agents: AgentKey[], paused: boolean) => {
        if (agents.length === 1) {
          logAgentEvent({ kind: paused ? 'agentPaused' : 'agentResumed', actor: agents[0] });
        } else if (agents.length > 1) {
          logAgentEvent({ kind: paused ? 'agentsPaused' : 'agentsResumed', actor: 'orchestrator', count: agents.length });
        }
      };
      if (changed.length > 1 && everyAgentIs(true)) {
        logAgentEvent({ kind: 'allPaused', actor: 'orchestrator' });
      } else if (changed.length > 1 && everyAgentIs(false)) {
        logAgentEvent({ kind: 'allResumed', actor: 'orchestrator' });
      } else {
        logGroup(changed.filter((agent) => next[agent]), true);
        logGroup(changed.filter((agent) => !next[agent]), false);
      }
      void updatePausedAgents(Object.fromEntries(changed.map((agent) => [agent, next[agent]])));
    },
    [logAgentEvent],
  );

  const agentsOnline = useMemo(() => AGENT_KEYS.filter((agent) => !pausedAgents[agent]).length, [pausedAgents]);

  const dismissAlert = useCallback((alert: BottleneckAlert) => {
    setDismissals((current) => ({ ...current, [alert.id]: new Date().toISOString() }));
  }, []);

  const reopenAlert = useCallback((alertId: string) => {
    setDismissals((current) => {
      const next = { ...current };
      delete next[alertId];
      return next;
    });
  }, []);

  const approveFix = useCallback(
    async (alert: BottleneckAlert, fix: SuggestedFix) => {
      await approveSuggestedFix(alert.id, fix.id);
      setApprovals((current) => ({ ...current, [alert.id]: { fixId: fix.id, at: new Date().toISOString() } }));
      // The Orchestrator applied the change, so the campaign's setup (and the Digital Twin's baseline) follows.
      const { patch } = fix;
      if (patch) {
        setCampaignSetups((current) => {
          const setup = current[alert.campaignId];
          return setup ? { ...current, [alert.campaignId]: { ...setup, ...patch } } : current;
        });
      }
      logAgentEvent({ kind: 'fixApplied', actor: 'orchestrator', campaignId: alert.campaignId, fix: fix.actionLabel });
    },
    [logAgentEvent],
  );

  const moveCandidate = useCallback(
    (candidateId: string, to: PipelineStage): PipelineMove | null => {
      const list = pipelineRef.current;
      if (!list) return null;
      const fromIndex = list.findIndex((item) => item.id === candidateId);
      const candidate = list[fromIndex];
      if (!candidate || candidate.stage === to) return null;
      // The card lands at the top of its new column, where it is easy to spot.
      setPipeline([
        { ...candidate, stage: to, daysInStage: 0 },
        ...list.filter((item) => item.id !== candidateId),
      ]);
      void saveCandidateStage(candidateId, to);
      return { candidateId, from: candidate.stage, to, fromIndex, fromDaysInStage: candidate.daysInStage };
    },
    [setPipeline],
  );

  const undoMove = useCallback(
    (move: PipelineMove) => {
      const list = pipelineRef.current;
      const candidate = list?.find((item) => item.id === move.candidateId);
      if (!list || !candidate) return;
      const rest = list.filter((item) => item.id !== move.candidateId);
      rest.splice(Math.min(move.fromIndex, rest.length), 0, {
        ...candidate,
        stage: move.from,
        daysInStage: move.fromDaysInStage,
      });
      setPipeline(rest);
      void saveCandidateStage(move.candidateId, move.from);
    },
    [setPipeline],
  );

  const shortlistCandidate = useCallback(
    (candidateId: string) => {
      const candidate = pipelineRef.current?.find((item) => item.id === candidateId);
      if (!candidate || (candidate.stage !== 'applied' && candidate.stage !== 'screening')) return null;
      return moveCandidate(candidateId, 'interview');
    },
    [moveCandidate],
  );

  const launchCampaign = useCallback(
    async (draft: CampaignDraft) => {
      const campaign = await launchCampaignRequest(draft);
      setSummary(
        (current) =>
          current && {
            ...current,
            activeCampaigns: current.activeCampaigns + 1,
            campaigns: [campaign, ...current.campaigns],
          },
      );
      // A new campaign has no live results yet, so the Digital Twin uses the model as it is.
      setCampaignSetups((current) => ({ ...current, [campaign.id]: draft }));
      setTwinOffsets((current) => ({ ...current, [campaign.id]: 0 }));
      logAgentEvent({
        kind: 'campaignLaunched',
        actor: 'orchestrator',
        campaignId: campaign.id,
        agents: CAMPAIGN_AGENTS.filter((agent) => draft.agents[agent]).length,
      });
      return campaign;
    },
    [logAgentEvent],
  );

  const applyCampaignSetup = useCallback(
    async (campaignId: string, setup: CampaignDraft) => {
      await updateCampaignSetup(campaignId, setup);
      setCampaignSetups((current) => ({ ...current, [campaignId]: setup }));
      logAgentEvent({ kind: 'setupUpdated', actor: 'orchestrator', campaignId });
    },
    [logAgentEvent],
  );

  const value = useMemo<Workspace>(
    () => ({
      summary,
      matchedCandidates,
      pipeline,
      alerts,
      openAlerts,
      approvals,
      healingLog,
      dismissAlert,
      reopenAlert,
      approveFix,
      moveCandidate,
      undoMove,
      shortlistCandidate,
      launchCampaign,
      campaignSetups,
      twinOffsets,
      applyCampaignSetup,
      agentStats,
      agentBaseline,
      agentEvents,
      pausedAgents,
      agentsOnline,
      setPausedAgents,
      watchAgentActivity,
    }),
    [
      summary,
      matchedCandidates,
      pipeline,
      alerts,
      openAlerts,
      approvals,
      healingLog,
      dismissAlert,
      reopenAlert,
      approveFix,
      moveCandidate,
      undoMove,
      shortlistCandidate,
      launchCampaign,
      campaignSetups,
      twinOffsets,
      applyCampaignSetup,
      agentStats,
      agentBaseline,
      agentEvents,
      pausedAgents,
      agentsOnline,
      setPausedAgents,
      watchAgentActivity,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used inside a WorkspaceProvider');
  }
  return context;
}
