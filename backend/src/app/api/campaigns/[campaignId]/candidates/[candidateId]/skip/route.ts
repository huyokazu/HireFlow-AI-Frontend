import { ApiError, ok, route } from '@/lib/api/http';
import { rowsOf } from '@/lib/data/result';
import { idSchema } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/**
 * HR skipped a matched candidate in the review deck: the deck stops offering them for this
 * campaign. Written with the member's token (RLS and the hr_decision column grant apply).
 */
export const POST = route<{ campaignId: string; candidateId: string }>(async (req, { params, timing }) => {
  const campaignId = idSchema.parse(params.campaignId);
  const candidateId = idSchema.parse(params.candidateId);
  const ctx = await requireWorkspace(req, timing);
  const updated = rowsOf(
    await timing.measure(
      'db',
      ctx.supabase
        .from('applications')
        .update({ hr_decision: 'skipped' })
        .eq('workspace_id', ctx.workspaceId)
        .eq('campaign_id', campaignId)
        .eq('candidate_id', candidateId)
        .select('id'),
    ),
  );
  if (updated.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Candidate not found in this campaign');
  return ok({ skipped: true });
});
