import { ok, parseJson, route } from '@/lib/api/http';
import { updateCampaignSetup } from '@/lib/data/campaigns';
import { idSchema, updateSetupBody } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

export const PUT = route<{ campaignId: string }>(async (req, { params, timing }) => {
  const campaignId = idSchema.parse(params.campaignId);
  const ctx = await requireWorkspace(req, timing);
  const { setup } = updateSetupBody.parse(await parseJson(req));
  return ok(await updateCampaignSetup(ctx, campaignId, setup, timing));
});
