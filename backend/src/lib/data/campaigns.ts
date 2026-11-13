import 'server-only';

import { randomBytes } from 'node:crypto';

import { CAMPAIGN_AGENTS, DEPARTMENT_NAMES } from './constants';

import { ApiError, unwrap, type Timing } from '@/lib/api/http';
import type { AgentEvent, CampaignDraft, CampaignSummary, SourcingChannel } from '@/lib/contracts';
import { recordAgentEvents } from '@/lib/events';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseAdmin, type WorkspaceContext } from '@/lib/supabase/server';

import { CAMPAIGN_COLUMNS, toCampaignSummary } from './mappers';
import { rowOf, rowsOf } from './result';

/** The app's campaign slug: ASCII, lowercase, dash-separated (Vietnamese accents folded). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Readable and unique across workspaces (campaign ids are a global key). */
export function newCampaignId(title: string): string {
  const suffix = randomBytes(4).toString('hex');
  return `${slugify(title) || 'campaign'}-${suffix}`;
}

/**
 * Zero result rows for each channel a campaign sources from, so analytics lists the channel before
 * its first applicant arrives. Existing results are never touched. System table: secret key.
 */
export async function ensureChannelRows(workspaceId: string, campaignId: string, channels: SourcingChannel[]) {
  if (channels.length === 0) return;
  const rows = channels.map((channel) => ({ workspace_id: workspaceId, campaign_id: campaignId, channel }));
  unwrap(
    await supabaseAdmin()
      .from('campaign_channel_results')
      .upsert(rows, { onConflict: 'campaign_id,channel', ignoreDuplicates: true }),
  );
}

export async function launchCampaign(
  ctx: WorkspaceContext,
  draft: CampaignDraft,
  timing: Timing,
): Promise<{ campaign: CampaignSummary; events: AgentEvent[] }> {
  const title = draft.title.trim();
  const row = rowOf(
    await timing.measure(
      'db',
      // Server write after the membership check: workspace_id and created_by come from the verified
      // request context, never from the body.
      supabaseAdmin()
        .from('campaigns')
        .insert({
          id: newCampaignId(title),
          workspace_id: ctx.workspaceId,
          // A title typed by HR is shown as written in both languages.
          title: { en: title, vi: title },
          department: DEPARTMENT_NAMES[draft.department ?? 'engineering'],
          stage: 'sourcing',
          target_match_rate: draft.targetMatchRate,
          setup: draft as Json,
          created_by: ctx.userId,
        })
        .select(CAMPAIGN_COLUMNS)
        .single(),
    ),
  );
  const [events] = await timing.measure(
    'db_after',
    Promise.all([
      recordAgentEvents(ctx.workspaceId, [
        {
          kind: 'campaignLaunched',
          actor: 'orchestrator',
          campaignId: row.id,
          agents: CAMPAIGN_AGENTS.filter((agent) => draft.agents[agent]).length,
        },
      ]),
      ensureChannelRows(ctx.workspaceId, row.id, draft.channels),
    ]),
  );
  return { campaign: toCampaignSummary(row), events };
}

/**
 * Replaces a campaign's setup. The setup's target match rate is the campaign's target, so the
 * dashboard follows it.
 */
export async function saveCampaignSetup(ctx: WorkspaceContext, campaignId: string, setup: CampaignDraft) {
  const updated = rowsOf(
    await ctx.supabase
      .from('campaigns')
      .update({ setup: setup as Json, target_match_rate: setup.targetMatchRate })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', campaignId)
      .select('id'),
  );
  if (updated.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
  await ensureChannelRows(ctx.workspaceId, campaignId, setup.channels);
}

export async function updateCampaignSetup(
  ctx: WorkspaceContext,
  campaignId: string,
  setup: CampaignDraft,
  timing: Timing,
): Promise<{ events: AgentEvent[] }> {
  await timing.measure('db', saveCampaignSetup(ctx, campaignId, setup));
  const events = await timing.measure(
    'db_event',
    recordAgentEvents(ctx.workspaceId, [{ kind: 'setupUpdated', actor: 'orchestrator', campaignId }]),
  );
  return { events };
}
