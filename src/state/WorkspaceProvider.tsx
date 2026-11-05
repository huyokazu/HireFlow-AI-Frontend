import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { launchCampaign as launchCampaignRequest, type CampaignDraft } from '../services/campaigns';
import { fetchMatchedCandidates, type Candidate } from '../services/candidates';
import { fetchDashboardSummary, type CampaignSummary, type DashboardSummary } from '../services/dashboard';
import { fetchPipeline, saveCandidateStage, type PipelineCandidate, type PipelineStage } from '../services/pipeline';
import {
  approveSuggestedFix,
  fetchActiveBottleneckAlerts,
  type BottleneckAlert,
  type SuggestedFix,
} from '../services/selfHealing';

/** The campaign whose matched candidates and alerts the dashboard features. */
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

type Workspace = {
  summary: DashboardSummary | null;
  matchedCandidates: Candidate[] | null;
  pipeline: PipelineCandidate[] | null;
  alerts: BottleneckAlert[];
  dismissAlert: (alert: BottleneckAlert) => void;
  approveFix: (alert: BottleneckAlert, fix: SuggestedFix) => Promise<void>;
  /** Moves a card to another stage. Returns `null` when nothing changed. */
  moveCandidate: (candidateId: string, to: PipelineStage) => PipelineMove | null;
  undoMove: (move: PipelineMove) => void;
  /** Shortlisting in the matched-candidates deck sends a not-yet-interviewed candidate to interview. */
  shortlistCandidate: (candidateId: string) => PipelineMove | null;
  launchCampaign: (draft: CampaignDraft) => Promise<CampaignSummary>;
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
  const [alerts, setAlerts] = useState<BottleneckAlert[]>([]);
  // Mirrors `pipeline` so a move can report what it changed without waiting for a re-render.
  const pipelineRef = useRef<PipelineCandidate[] | null>(null);

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
      fetchActiveBottleneckAlerts(FEATURED_CAMPAIGN_ID),
    ]).then(([summaryResult, matched, board, openAlerts]) => {
      if (cancelled) return;
      setSummary(summaryResult);
      setMatchedCandidates(matched);
      setPipeline(board);
      setAlerts(openAlerts);
    });
    return () => {
      cancelled = true;
    };
  }, [setPipeline]);

  const dismissAlert = useCallback((alert: BottleneckAlert) => {
    setAlerts((current) => current.filter((item) => item.id !== alert.id));
  }, []);

  const approveFix = useCallback(
    (alert: BottleneckAlert, fix: SuggestedFix) => approveSuggestedFix(alert.id, fix.id),
    [],
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

  const launchCampaign = useCallback(async (draft: CampaignDraft) => {
    const campaign = await launchCampaignRequest(draft);
    setSummary(
      (current) =>
        current && {
          ...current,
          activeCampaigns: current.activeCampaigns + 1,
          campaigns: [campaign, ...current.campaigns],
        },
    );
    return campaign;
  }, []);

  const value = useMemo<Workspace>(
    () => ({
      summary,
      matchedCandidates,
      pipeline,
      alerts,
      dismissAlert,
      approveFix,
      moveCandidate,
      undoMove,
      shortlistCandidate,
      launchCampaign,
    }),
    [
      summary,
      matchedCandidates,
      pipeline,
      alerts,
      dismissAlert,
      approveFix,
      moveCandidate,
      undoMove,
      shortlistCandidate,
      launchCampaign,
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
