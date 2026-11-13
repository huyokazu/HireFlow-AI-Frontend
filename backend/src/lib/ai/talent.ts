import 'server-only';

import { scoreCv } from '@ai/lib/agents.js';
import {
  jobDescription,
  matchFromBreakdown,
  profileText,
  QUALIFIED_SCORE,
  rubricMatch,
  skillOverlap,
  type TalentMatch,
  type TalentProfile,
  type TalentRole,
} from '@app/services/talent';

import { unwrap } from '@/lib/api/http';
import type { CampaignDraft, Language, Localized } from '@/lib/contracts';
import { MAX_LIST_ROWS } from '@/lib/data/constants';
import { rowsOf } from '@/lib/data/result';
import { recordAgentEvents } from '@/lib/events';
import type { Json, Tables } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/server';

import { promptLanguage, runWithFallback, type AiOutcome } from './runner';

/** What ai/prompts/talentMatching.js returns. */
type GeminiMatch = {
  score: number;
  score_breakdown: { skills: number; experience: number; other: number };
  match_reasons: string[];
  missing_skills: string[];
  summary: string;
};

/** How many people from the talent pool the Talent Agent grades when a campaign launches. */
const MAX_REDISCOVERED = 5;

type PoolRow = Pick<Tables<'candidates'>, 'id' | 'name' | 'role' | 'location' | 'years_of_experience' | 'skills'>;

const toProfile = (row: PoolRow): TalentProfile => ({
  role: row.role as Localized,
  yearsOfExperience: row.years_of_experience,
  skills: row.skills,
});

/** Gemini's text is in one language (the one it was asked for); like ai/lib's toLocalized, it fills both. */
const both = (text: string): Localized => ({ en: text, vi: text });

function fromGemini(role: TalentRole, profile: TalentProfile, data: GeminiMatch): TalentMatch {
  const graded = matchFromBreakdown(role, profile, data.score_breakdown, 'gemini');
  const reasons = data.match_reasons.filter(Boolean).slice(0, 4).map(both);
  return {
    score: graded.score,
    assessment: data.summary ? both(data.summary) : graded.assessment,
    proof: {
      ...graded.proof,
      missingSkills: (data.missing_skills.length > 0 ? data.missing_skills : graded.proof.missingSkills).slice(0, 8),
      reasons: reasons.length > 0 ? reasons : graded.proof.reasons,
    },
  };
}

/**
 * The Talent Agent's score for one candidate against a role: Gemini's rubric when it answers within
 * the deadline, otherwise the precomputed rubric (`rubricMatch`), in the same shape.
 */
export function gradeCandidate(
  role: TalentRole,
  name: string,
  profile: TalentProfile,
  language?: Language,
): Promise<AiOutcome<TalentMatch>> {
  return runWithFallback(
    'talent',
    async (budgetMs) => {
      const { data } = (await scoreCv(
        { jdText: jobDescription(role), cvText: profileText(name, profile), language: promptLanguage(language) },
        // Hedges to the next model early enough to still answer inside the budget.
        { timeoutMs: budgetMs, hedgeAfterMs: Math.min(2000, budgetMs / 2) },
      )) as { data: GeminiMatch };
      return fromGemini(role, profile, data);
    },
    () => rubricMatch(role, profile),
  );
}

/**
 * Runs when a campaign launches with the Matching agent on: the Talent Agent grades the people
 * already in the workspace's talent pool whose skills overlap the new role, adds the best few to
 * the campaign as applicants with their scores and rubric, and updates the campaign's match rate.
 * Every grade has the AI deadline, so this finishes within a few seconds either way. Its event
 * reaches the app over Realtime.
 */
export async function rediscoverTalent(
  workspaceId: string,
  campaignId: string,
  setup: CampaignDraft,
  language?: Language,
): Promise<number> {
  const admin = supabaseAdmin();
  const [pool, applied, settings] = await Promise.all([
    admin
      .from('candidates')
      .select('id, name, role, location, years_of_experience, skills')
      .eq('workspace_id', workspaceId)
      .limit(MAX_LIST_ROWS),
    admin.from('applications').select('candidate_id').eq('workspace_id', workspaceId).eq('campaign_id', campaignId),
    admin
      .from('agent_settings')
      .select('paused')
      .eq('workspace_id', workspaceId)
      .eq('agent_key', 'matching')
      .maybeSingle(),
  ]);
  if (unwrap(settings)?.paused) return 0;

  const taken = new Set(rowsOf(applied).map((row) => row.candidate_id));
  const shortlist = rowsOf(pool)
    .filter((row) => !taken.has(row.id))
    .map((row) => ({ row, overlap: skillOverlap(setup.skills, row.skills).matched.length }))
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.row.years_of_experience - a.row.years_of_experience)
    .slice(0, MAX_REDISCOVERED)
    .map((entry) => entry.row);
  if (shortlist.length === 0) return 0;

  const graded = await Promise.all(
    shortlist.map(async (row) => ({ row, outcome: await gradeCandidate(setup, row.name, toProfile(row), language) })),
  );

  // Agent-owned columns: written with the secret key, after the launch checked membership.
  unwrap(
    await admin.from('applications').upsert(
      graded.map(({ row, outcome }) => ({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        candidate_id: row.id,
        stage: 'applied',
        match_score: outcome.data.score,
        ai_assessment: outcome.data.assessment as NonNullable<Json>,
        ai_details: outcome.data.proof as Json,
      })),
      { onConflict: 'campaign_id,candidate_id', ignoreDuplicates: true },
    ),
  );
  const qualified = graded.filter(({ outcome }) => outcome.data.score >= QUALIFIED_SCORE).length;
  unwrap(
    await admin
      .from('campaigns')
      .update({ applicants: graded.length, match_rate: Math.round((100 * qualified) / graded.length) })
      .eq('workspace_id', workspaceId)
      .eq('id', campaignId),
  );
  await recordAgentEvents(workspaceId, [{ kind: 'cvsScored', actor: 'matching', campaignId, count: graded.length }]);
  return graded.length;
}
