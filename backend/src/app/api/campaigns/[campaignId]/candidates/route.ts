import { ApiError, ok, route } from '@/lib/api/http';
import { getMatchedCandidates } from '@/lib/data/queries';
import { idSchema } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

export const GET = route<{ campaignId: string }>(async (req, { params, timing }) => {
  const campaignId = idSchema.parse(params.campaignId);
  const { supabase, workspaceId } = await requireWorkspace(req, timing);
  const candidates = await timing.measure('db', getMatchedCandidates(supabase, workspaceId, campaignId));
  if (!candidates) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
  return ok(candidates);
});
