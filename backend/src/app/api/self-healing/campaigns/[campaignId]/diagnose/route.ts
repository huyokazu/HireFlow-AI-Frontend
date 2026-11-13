import { diagnoseCampaignAlert } from '@/lib/ai/optimization';
import { ok, route } from '@/lib/api/http';
import { idSchema } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/**
 * Asks the Optimization Agent to diagnose a campaign. Answers within about 4 s: Gemini's diagnosis,
 * or the precomputed one when Gemini is late or rate-limited (`source` says which). Returns 201
 * with the stored alert, or 200 with the campaign's open alert or `alert: null`.
 */
export const POST = route<{ campaignId: string }>(async (req, { params, timing }) => {
  const campaignId = idSchema.parse(params.campaignId);
  const ctx = await requireWorkspace(req, timing);
  const result = await diagnoseCampaignAlert(ctx, campaignId, timing);
  return ok(result, result.alert && result.source !== 'existing' ? 201 : 200);
});
