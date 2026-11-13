import { rediscoverTalent } from '@/lib/ai/talent';
import { runInBackground } from '@/lib/api/background';
import { ok, parseJson, route } from '@/lib/api/http';
import { launchCampaign } from '@/lib/data/campaigns';
import { launchCampaignBody } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/**
 * Launches a campaign from the wizard's draft; the server picks the id. With the Matching agent on,
 * the Talent Agent then grades the workspace's talent pool against the role in the background
 * (reasons written in `language`); its results reach the app over Realtime.
 */
export const POST = route(async (req, { timing }) => {
  const ctx = await requireWorkspace(req, timing);
  const { draft, language } = launchCampaignBody.parse(await parseJson(req));
  const launched = await launchCampaign(ctx, draft, timing);
  if (draft.agents.matching) {
    runInBackground('talent-agent', () => rediscoverTalent(ctx.workspaceId, launched.campaign.id, draft, language));
  }
  return ok(launched, 201);
});
