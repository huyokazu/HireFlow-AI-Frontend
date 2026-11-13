import 'server-only';

import { diagnoseCampaign } from '@ai/lib/agents.js';
import { alertFromDiagnosis, campaignInputFromBackend, patchFromFix } from '@ai/lib/backend.js';
import { matchRateLift } from '@app/services/digitalTwin';
import { precomputedDiagnosis, type AlertDraft, type DiagnosisInput } from '@app/services/precomputed';

import { ApiError, unwrap, type Timing } from '@/lib/api/http';
import type { AgentEvent, AiSource, AlertWithDecision, CampaignDraft, Localized } from '@/lib/contracts';
import { ALERT_COLUMNS, toAlert, toSetup } from '@/lib/data/mappers';
import { rowOf, rowsOf } from '@/lib/data/result';
import { recordAgentEvents } from '@/lib/events';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseAdmin, type WorkspaceContext } from '@/lib/supabase/server';

import { runWithFallback, type FallbackReason } from './runner';

export type DiagnosisResponse = {
  /** The new alert, the campaign's alert that was already open, or `null` when nothing is wrong. */
  alert: AlertWithDecision | null;
  events: AgentEvent[];
  /** `existing` when an open alert was returned instead of running the agent. */
  source: AiSource | 'existing';
  reason?: FallbackReason;
};

/**
 * The live Optimization Agent: Gemini's diagnosis, turned into the app's alert shape. Each fix gets
 * the setup change its own text names (`patchFromFix`, so approving applies the numbers HR read on
 * the card) and the Digital Twin's forecast of what that change is worth.
 *
 * The prompt is left in its default language (Vietnamese): `patchFromFix` reads the numbers out of
 * Vietnamese text. The precomputed answers have English too.
 */
async function liveDiagnosis(
  input: DiagnosisInput,
  extra: { applicants: number; createdAt: string; channelResults: { channel: string; applicants: number; qualified: number }[] },
  budgetMs: number,
): Promise<AlertDraft | null> {
  const { campaignName, setup, matchRate, targetMatchRate } = input;
  const { data } = await diagnoseCampaign(
    {
      campaign: campaignInputFromBackend({
        title: campaignName.vi,
        matchRate,
        targetMatchRate,
        applicants: extra.applicants,
        setup: setup ?? undefined,
        channelResults: extra.channelResults,
        createdAt: extra.createdAt,
      }),
    },
    { timeoutMs: budgetMs },
  );
  const draft = alertFromDiagnosis(data, {
    campaignName,
    matchRate,
    targetMatchRate,
    enrichFix: setup
      ? (fix: unknown) => {
          const patch = patchFromFix(fix, setup) as Partial<CampaignDraft> | undefined;
          return patch ? { patch, expectedLift: Math.max(0, matchRateLift(setup, patch)) } : undefined;
        }
      : undefined,
  }) as { severity: AlertDraft['severity']; content: AlertDraft['content'] } | null;
  return draft && { severity: draft.severity, content: draft.content };
}

/**
 * Diagnoses a campaign with the Optimization Agent and stores what it finds as a Self-Healing
 * alert. Answers within about 4 s: past that, or when Gemini is rate-limited or unavailable, it
 * uses the precomputed diagnosis. A campaign that already has an open alert gets that alert back.
 */
export async function diagnoseCampaignAlert(
  ctx: WorkspaceContext,
  campaignId: string,
  timing: Timing,
): Promise<DiagnosisResponse> {
  const [campaignResult, openResult, channelResult, settingsResult] = await timing.measure(
    'db',
    Promise.all([
      ctx.supabase
        .from('campaigns')
        .select('id, title, applicants, match_rate, target_match_rate, setup, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', campaignId)
        .maybeSingle(),
      ctx.supabase
        .from('bottleneck_alerts')
        .select(ALERT_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('campaign_id', campaignId)
        .eq('status', 'open')
        .order('detected_at', { ascending: false })
        .limit(1),
      ctx.supabase
        .from('campaign_channel_results')
        .select('channel, applicants, qualified')
        .eq('workspace_id', ctx.workspaceId)
        .eq('campaign_id', campaignId),
      ctx.supabase
        .from('agent_settings')
        .select('paused')
        .eq('workspace_id', ctx.workspaceId)
        .eq('agent_key', 'selfHealing')
        .maybeSingle(),
    ]),
  );
  const campaign = unwrap(campaignResult);
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
  const open = rowsOf(openResult)[0];
  if (open) return { alert: toAlert(open), events: [], source: 'existing' };
  if (unwrap(settingsResult)?.paused) throw new ApiError(409, 'AGENT_PAUSED', 'The Self-Healing agent is paused');

  const input: DiagnosisInput = {
    campaignName: campaign.title as Localized,
    setup: toSetup(campaign.setup),
    matchRate: campaign.match_rate,
    targetMatchRate: campaign.target_match_rate,
  };
  const extra = { applicants: campaign.applicants, createdAt: campaign.created_at, channelResults: rowsOf(channelResult) };
  const outcome = await timing.measure(
    'ai',
    runWithFallback(
      'optimization',
      (budgetMs) => liveDiagnosis(input, extra, budgetMs),
      () => precomputedDiagnosis(campaignId, input),
    ),
  );
  const found = outcome.data;
  if (!found) return { alert: null, events: [], source: outcome.source, reason: outcome.reason };

  // Agent-owned table: written with the secret key, after the membership check above.
  const row = rowOf(
    await timing.measure(
      'db_insert',
      supabaseAdmin()
        .from('bottleneck_alerts')
        .insert({
          workspace_id: ctx.workspaceId,
          campaign_id: campaignId,
          severity: found.severity,
          content: found.content as NonNullable<Json>,
        })
        .select(ALERT_COLUMNS)
        .single(),
    ),
  );
  const events = await timing.measure(
    'db_event',
    recordAgentEvents(ctx.workspaceId, [
      { kind: 'bottleneckFlagged', actor: 'selfHealing', campaignId, issue: found.content.title },
    ]),
  );
  return { alert: toAlert(row), events, source: outcome.source, reason: outcome.reason };
}
