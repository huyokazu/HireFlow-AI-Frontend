import { ok, parseJson, route } from '@/lib/api/http';
import { launchCampaign } from '@/lib/data/campaigns';
import { launchCampaignBody } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/** Launches a campaign from the wizard's draft; the server picks the id. */
export const POST = route(async (req, { timing }) => {
  const ctx = await requireWorkspace(req, timing);
  const { draft } = launchCampaignBody.parse(await parseJson(req));
  return ok(await launchCampaign(ctx, draft, timing), 201);
});
