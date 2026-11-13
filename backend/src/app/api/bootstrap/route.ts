import { ok, route } from '@/lib/api/http';
import type { WorkspaceBootstrap } from '@/lib/contracts';
import {
  getAgentWorkspace,
  getAlerts,
  getCampaignSetups,
  getDashboard,
  getHealingHistory,
  getPipeline,
  rankMatches,
} from '@/lib/data/queries';
import { bootstrapQuery } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/**
 * Everything the app loads on start. Latency budget: one token check, one workspace lookup, then
 * one parallel batch. Matched candidates come from the board already loaded, not another query.
 */
export const GET = route(async (req, { timing }) => {
  const query = bootstrapQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { supabase: db, workspaceId } = await requireWorkspace(req, timing);

  const [summary, pipeline, alerts, history, campaignSetups, agents] = await Promise.all([
    timing.measure('db_summary', getDashboard(db, workspaceId)),
    timing.measure('db_pipeline', getPipeline(db, workspaceId)),
    timing.measure('db_alerts', getAlerts(db, workspaceId)),
    timing.measure('db_history', getHealingHistory(db, workspaceId)),
    timing.measure('db_setups', getCampaignSetups(db, workspaceId)),
    timing.measure('db_agents', getAgentWorkspace(db, workspaceId)),
  ]);

  // An unknown featured campaign (e.g. the app's default in a new workspace) falls back to the newest.
  const featuredCampaignId =
    summary.campaigns.find((campaign) => campaign.id === query.featured)?.id ?? summary.campaigns[0]?.id ?? null;

  const data: WorkspaceBootstrap = {
    workspaceId,
    featuredCampaignId,
    summary,
    matchedCandidates: featuredCampaignId ? rankMatches(pipeline, featuredCampaignId) : [],
    pipeline,
    alerts,
    history,
    campaignSetups,
    agents,
  };
  return ok(data);
});
