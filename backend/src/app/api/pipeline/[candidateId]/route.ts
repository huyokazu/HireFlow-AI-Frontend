import { ok, parseJson, route } from '@/lib/api/http';
import { moveCandidate } from '@/lib/data/pipeline';
import { idSchema, moveCandidateBody } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/** Moves a card on the board. The Operations Agent reacts to the new stage after the response. */
export const PATCH = route<{ candidateId: string }>(async (req, { params, timing }) => {
  const candidateId = idSchema.parse(params.candidateId);
  const ctx = await requireWorkspace(req, timing);
  const move = moveCandidateBody.parse(await parseJson(req));
  return ok(await moveCandidate(ctx, candidateId, move, timing));
});
