import 'server-only';

import { unwrap } from '@/lib/api/http';
import type {
  AgentEvent,
  AgentWorkspaceWithPause,
  AlertWithDecision,
  CampaignDraft,
  Candidate,
  DashboardSummary,
  HealingRecord,
  PipelineCandidate,
} from '@/lib/contracts';
import { EVENT_COLUMNS, toAgentEvent } from '@/lib/events';
import type { Db } from '@/lib/supabase/server';

import {
  ALERT_COLUMNS,
  APPLICATION_COLUMNS,
  compareAlerts,
  HEALING_COLUMNS,
  toAgentStats,
  toAlert,
  toCandidate,
  toHealingRecord,
  toPausedAgents,
  toPipelineCandidate,
  toSetup,
} from './mappers';
import { MAX_LIST_ROWS } from './constants';
import { rowsOf } from './result';

// Every query filters by workspace explicitly even though RLS also scopes rows: a user in two
// workspaces must only see the one the request acts on, and the filter uses the workspace indexes.

/** Decided alerts stay visible (and their records out of the history) for this long. */
const DECISION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Activity entries the app keeps in memory. */
export const RECENT_EVENTS = 60;

const windowStart = () => new Date(Date.now() - DECISION_WINDOW_MS).toISOString();

export async function getDashboard(db: Db, workspaceId: string): Promise<DashboardSummary> {
  // The RPC builds the exact DashboardSummary shape in one round trip.
  return unwrap(await db.rpc('dashboard_summary', { ws: workspaceId })) as unknown as DashboardSummary;
}

/** The hiring board, most recent stage change first. */
export async function getPipeline(db: Db, workspaceId: string): Promise<PipelineCandidate[]> {
  const rows = rowsOf(
    await db
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('stage_entered_at', { ascending: false })
      .order('id')
      .limit(MAX_LIST_ROWS),
  );
  const now = Date.now();
  return rows.map((row) => toPipelineCandidate(row, now));
}

/** A campaign's applicants, best match first; `null` when the campaign is not in the workspace. */
export async function getMatchedCandidates(db: Db, workspaceId: string, campaignId: string): Promise<Candidate[] | null> {
  const [campaign, applications] = await Promise.all([
    db.from('campaigns').select('id').eq('workspace_id', workspaceId).eq('id', campaignId).maybeSingle(),
    db
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaignId)
      .order('match_score', { ascending: false })
      .order('id')
      .limit(MAX_LIST_ROWS),
  ]);
  if (!unwrap(campaign)) return null;
  return rowsOf(applications).map(toCandidate);
}

/** The same ranking as {@link getMatchedCandidates}, from a board already loaded. */
export function rankMatches(pipeline: PipelineCandidate[], campaignId: string): Candidate[] {
  return pipeline
    .filter((item) => item.campaignId === campaignId)
    .sort((a, b) => b.matchScore - a.matchScore)
    .map(({ campaignId: _campaign, stage: _stage, daysInStage: _days, ...candidate }) => candidate);
}

export async function getCampaignSetups(db: Db, workspaceId: string): Promise<Record<string, CampaignDraft>> {
  const rows = rowsOf(
    await db
      .from('campaigns')
      .select('id, setup')
      .eq('workspace_id', workspaceId)
      .not('setup', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_ROWS),
  );
  const setups: Record<string, CampaignDraft> = {};
  for (const row of rows) {
    const setup = toSetup(row.setup);
    if (setup) setups[row.id] = setup;
  }
  return setups;
}

/** Open alerts, plus the ones decided within the decision window. */
export async function getAlerts(db: Db, workspaceId: string): Promise<AlertWithDecision[]> {
  const rows = rowsOf(
    await db
      .from('bottleneck_alerts')
      .select(ALERT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .or(`status.eq.open,decided_at.gte."${windowStart()}"`)
      .order('detected_at', { ascending: false })
      .limit(MAX_LIST_ROWS),
  );
  return rows.map(toAlert).sort(compareAlerts);
}

/**
 * Healing records within the decision window that are not tied to an alert. Records tied to an
 * alert are audit rows: the app rebuilds those entries from the alert's decision.
 */
export async function getHealingHistory(db: Db, workspaceId: string): Promise<HealingRecord[]> {
  const rows = rowsOf(
    await db
      .from('healing_records')
      .select(HEALING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('alert_id', null)
      .gte('at', windowStart())
      .order('at', { ascending: false })
      .limit(MAX_LIST_ROWS),
  );
  return rows.map(toHealingRecord);
}

export async function getWorkspaceMetrics(db: Db, workspaceId: string) {
  return unwrap(await db.from('workspace_metrics').select('*').eq('workspace_id', workspaceId).maybeSingle());
}

/**
 * Activity log page, newest first. Ids are assigned in insertion order and `at` defaults to the
 * insert time, so "older than event X" is `id < X`.
 */
export async function getAgentEvents(
  db: Db,
  workspaceId: string,
  page: { before?: string; limit: number },
): Promise<AgentEvent[]> {
  let query = db.from('agent_events').select(EVENT_COLUMNS).eq('workspace_id', workspaceId);
  if (page.before) query = query.lt('id', Number(page.before));
  const rows = rowsOf(
    await query.order('at', { ascending: false }).order('id', { ascending: false }).limit(page.limit),
  );
  return rows.map(toAgentEvent);
}

export async function getAgentWorkspace(db: Db, workspaceId: string): Promise<AgentWorkspaceWithPause> {
  const [stats, settings, events, metrics] = await Promise.all([
    db
      .from('agent_stats')
      .select('agent_key, done_today, queued, agreement_rate, median_seconds, last_active_at')
      .eq('workspace_id', workspaceId),
    db.from('agent_settings').select('agent_key, paused').eq('workspace_id', workspaceId),
    db
      .from('agent_events')
      .select(EVENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      .limit(RECENT_EVENTS),
    getWorkspaceMetrics(db, workspaceId),
  ]);
  return {
    stats: toAgentStats(rowsOf(stats)),
    paused: toPausedAgents(rowsOf(settings)),
    events: rowsOf(events).map(toAgentEvent),
    tasksYesterday: metrics?.tasks_yesterday ?? 0,
    hoursSavedBeforeToday: Number(metrics?.hours_saved_before_today ?? 0),
  };
}
