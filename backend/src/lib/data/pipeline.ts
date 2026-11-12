import 'server-only';

import { runInBackground } from '@/lib/api/background';
import { ApiError, type Timing } from '@/lib/api/http';
import type { PipelineCandidate, PipelineStage } from '@/lib/contracts';
import { onStageChanged } from '@/lib/operations/hooks';
import type { WorkspaceContext } from '@/lib/supabase/server';

import { APPLICATION_COLUMNS, toPipelineCandidate } from './mappers';
import { rowsOf } from './result';

/**
 * Moves a candidate's application to another stage and restarts its time in stage. A candidate
 * who applied to several campaigns needs `campaignId` to say which card moved.
 */
export async function moveCandidate(
  ctx: WorkspaceContext,
  candidateId: string,
  move: { stage: PipelineStage; campaignId?: string },
  timing: Timing,
): Promise<PipelineCandidate> {
  let lookup = ctx.supabase
    .from('applications')
    .select(APPLICATION_COLUMNS)
    .eq('workspace_id', ctx.workspaceId)
    .eq('candidate_id', candidateId);
  if (move.campaignId) lookup = lookup.eq('campaign_id', move.campaignId);
  const matches = rowsOf(await timing.measure('db', lookup.limit(2)));

  const current = matches[0];
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Candidate not found on the board');
  if (matches.length > 1) {
    throw new ApiError(409, 'CONFLICT', 'The candidate is in several campaigns; send campaignId');
  }
  const from = current.stage as PipelineStage;
  if (from === move.stage) return toPipelineCandidate(current);

  // The stage filter makes the move atomic: a concurrent move of the same card wins or loses whole.
  const updated = rowsOf(
    await timing.measure(
      'db_update',
      ctx.supabase
        .from('applications')
        .update({ stage: move.stage, stage_entered_at: new Date().toISOString() })
        .eq('id', current.id)
        .eq('stage', from)
        .select(APPLICATION_COLUMNS),
    ),
  );
  if (!updated[0]) throw new ApiError(409, 'CONFLICT', 'The candidate was moved by someone else; reload the board');

  runInBackground('stage-change', () =>
    onStageChanged({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      applicationId: current.id,
      candidateId,
      campaignId: current.campaign_id,
      from,
      to: move.stage,
    }),
  );
  return toPipelineCandidate(updated[0]);
}
