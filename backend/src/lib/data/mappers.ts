import type {
  AgentKey,
  AgentStats,
  AgentStatsByKey,
  AlertWithDecision,
  BottleneckAlert,
  CampaignDraft,
  CampaignSummary,
  Candidate,
  HealingRecord,
  Localized,
  PausedAgents,
  PipelineCandidate,
  PipelineStage,
  ProofOfSkill,
} from '@/lib/contracts';
import type { Json, Tables } from '@/lib/supabase/database.types';

import { AGENT_KEYS } from './constants';

const DAY = 24 * 60 * 60 * 1000;

// Column lists live next to the mappers that read them, so a select and its mapper never drift.
// Single string literals: supabase-js infers the row type from them.
export const APPLICATION_COLUMNS =
  'id, campaign_id, stage, stage_entered_at, match_score, ai_assessment, ai_details, hr_decision, candidate:candidates(id, name, role, location, years_of_experience, skills)';
export const ALERT_COLUMNS = 'id, campaign_id, severity, detected_at, content, status, approved_fix_id, decided_at';
export const HEALING_COLUMNS = 'id, campaign_id, outcome, at, content';
export const CAMPAIGN_COLUMNS = 'id, title, department, stage, applicants, match_rate, target_match_rate, health';

type CandidateRow = Pick<Tables<'candidates'>, 'id' | 'name' | 'role' | 'location' | 'years_of_experience' | 'skills'>;
export type ApplicationRow = Pick<
  Tables<'applications'>,
  'id' | 'campaign_id' | 'stage' | 'stage_entered_at' | 'match_score' | 'ai_assessment' | 'ai_details' | 'hr_decision'
> & { candidate: CandidateRow };
type AlertRow = Pick<
  Tables<'bottleneck_alerts'>,
  'id' | 'campaign_id' | 'severity' | 'detected_at' | 'content' | 'status' | 'approved_fix_id' | 'decided_at'
>;
type HealingRow = Pick<Tables<'healing_records'>, 'id' | 'campaign_id' | 'outcome' | 'at' | 'content'>;
type CampaignRow = Pick<
  Tables<'campaigns'>,
  'id' | 'title' | 'department' | 'stage' | 'applicants' | 'match_rate' | 'target_match_rate' | 'health'
>;
type StatsRow = Pick<
  Tables<'agent_stats'>,
  'agent_key' | 'done_today' | 'queued' | 'agreement_rate' | 'median_seconds' | 'last_active_at'
>;

/** What `bottleneck_alerts.content` holds: the alert fields that are not columns. */
export type AlertContent = Omit<BottleneckAlert, 'id' | 'campaignId' | 'severity' | 'detectedAt'>;
/** What `healing_records.content` holds. */
export type HealingContent = Omit<HealingRecord, 'id' | 'alertId' | 'campaignId' | 'outcome' | 'at'>;

const localized = (value: Json): Localized => value as Localized;
const iso = (value: string) => new Date(value).toISOString();

export function toCandidate(row: ApplicationRow): Candidate {
  const { candidate } = row;
  return {
    id: candidate.id,
    name: candidate.name,
    role: localized(candidate.role),
    location: localized(candidate.location),
    yearsOfExperience: candidate.years_of_experience,
    // The score and assessment belong to this application, not to the person.
    matchScore: row.match_score,
    skills: candidate.skills,
    aiAssessment: localized(row.ai_assessment),
    ...(isProof(row.ai_details) && { proof: row.ai_details }),
  };
}

/** `applications.ai_details` as the Talent Agent writes it; older rows have none. */
function isProof(value: Json | null): value is Json & ProofOfSkill {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const breakdown = (value as Record<string, unknown>).breakdown;
  return typeof breakdown === 'object' && breakdown !== null && Array.isArray((value as Record<string, unknown>).reasons);
}

export function toPipelineCandidate(row: ApplicationRow, now = Date.now()): PipelineCandidate {
  return {
    ...toCandidate(row),
    campaignId: row.campaign_id,
    stage: row.stage as PipelineStage,
    daysInStage: Math.max(0, Math.floor((now - new Date(row.stage_entered_at).getTime()) / DAY)),
    ...(row.hr_decision === 'skipped' && { skipped: true }),
  };
}

export function toCampaignSummary(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    title: localized(row.title),
    department: localized(row.department),
    stage: row.stage as CampaignSummary['stage'],
    candidates: row.applicants,
    matchRate: row.match_rate,
    targetMatchRate: row.target_match_rate,
    health: row.health as CampaignSummary['health'],
  };
}

export function toAlert(row: AlertRow): AlertWithDecision {
  return {
    ...(row.content as AlertContent),
    id: row.id,
    campaignId: row.campaign_id,
    severity: row.severity as BottleneckAlert['severity'],
    detectedAt: iso(row.detected_at),
    status: row.status as AlertWithDecision['status'],
    approvedFixId: row.approved_fix_id,
    decidedAt: row.decided_at ? iso(row.decided_at) : null,
  };
}

const SEVERITY_ORDER: Record<BottleneckAlert['severity'], number> = { critical: 0, warning: 1 };

/** The app's alert order: critical first, then the most recently detected. */
export function compareAlerts(a: BottleneckAlert, b: BottleneckAlert): number {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

export function toHealingRecord(row: HealingRow): HealingRecord {
  return {
    ...(row.content as HealingContent),
    id: row.id,
    campaignId: row.campaign_id,
    outcome: row.outcome as HealingRecord['outcome'],
    at: iso(row.at),
  };
}

/** Every agent's numbers; an agent with no row yet has done nothing. */
export function toAgentStats(rows: StatsRow[], now = new Date()): AgentStatsByKey {
  const byKey = new Map(rows.map((row) => [row.agent_key, row]));
  const entries = AGENT_KEYS.map((agent): [AgentKey, AgentStats] => {
    const row = byKey.get(agent);
    return [
      agent,
      {
        doneToday: row?.done_today ?? 0,
        queued: row?.queued ?? 0,
        agreementRate: row?.agreement_rate ?? 0,
        medianSeconds: row?.median_seconds ?? 0,
        lastActiveAt: row ? iso(row.last_active_at) : now.toISOString(),
      },
    ];
  });
  return Object.fromEntries(entries) as AgentStatsByKey;
}

/** An agent with no settings row is running. */
export function toPausedAgents(rows: Pick<Tables<'agent_settings'>, 'agent_key' | 'paused'>[]): PausedAgents {
  const paused = new Set(rows.filter((row) => row.paused).map((row) => row.agent_key));
  return Object.fromEntries(AGENT_KEYS.map((agent) => [agent, paused.has(agent)])) as PausedAgents;
}

export const toSetup = (value: Json | null): CampaignDraft | null => (value as CampaignDraft | null) ?? null;
