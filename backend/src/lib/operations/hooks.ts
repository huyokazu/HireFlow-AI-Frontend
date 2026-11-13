import 'server-only';

import type { PipelineStage } from '@/lib/contracts';

import { executeAction } from './executor';
import { proposeAction, shouldExecute } from './proposals';

export type StageChange = {
  workspaceId: string;
  /** The recruiter who moved the card; their Google account executes what the agent proposes. */
  userId: string;
  applicationId: string;
  candidateId: string;
  campaignId: string;
  from: PipelineStage;
  to: PipelineStage;
};

/**
 * Called (inside `after()`, so the response is not delayed) whenever HR moves a candidate to
 * another pipeline stage. The Operations Agent reacts: interview → propose a calendar booking,
 * offer → draft an offer email for approval. An auto-approved booking runs right here, since this
 * is already background work.
 *
 * Must never throw: failures are logged, and the cron run (`/api/operations/run`) catches up.
 */
export async function onStageChanged(change: StageChange): Promise<void> {
  if (change.from === change.to) return;
  const kind = change.to === 'interview' ? 'schedule_interview' : change.to === 'offer' ? 'send_email' : null;
  if (!kind) return;
  try {
    const proposal = await proposeAction({
      workspaceId: change.workspaceId,
      userId: change.userId,
      kind,
      candidateId: change.candidateId,
      campaignId: change.campaignId,
    });
    if (shouldExecute(proposal)) await executeAction(proposal.action.id);
  } catch (error) {
    console.error('[operations] reacting to stage change failed', { applicationId: change.applicationId, to: change.to }, error);
  }
}
