import { ok, route } from '@/lib/api/http';
import { retryAction, toOperationsAction } from '@/lib/operations/actions';
import { requireFreshWorkspace } from '@/lib/operations/auth';
import { executeInBackground } from '@/lib/operations/executor';

/**
 * failed / blocked_reauth / ambiguous → approved, then executes after the response (202). Only the
 * requester or an owner/admin. Retrying `ambiguous` is the human's call and may send an email twice.
 */
export const POST = route<{ actionId: string }>(async (req, { params, timing }) => {
  const ws = await requireFreshWorkspace(req, timing);
  const row = await timing.measure('db', retryAction(ws, params.actionId));
  executeInBackground(row.id);
  return ok(toOperationsAction(row), 202);
});
