import { ok, route } from '@/lib/api/http';
import { approveAction, toOperationsAction } from '@/lib/operations/actions';
import { requireFreshWorkspace } from '@/lib/operations/auth';
import { executeInBackground } from '@/lib/operations/executor';

/** proposed → approved, then executes after the response (202). Only the requester or an owner/admin. */
export const POST = route<{ actionId: string }>(async (req, { params, timing }) => {
  const ws = await requireFreshWorkspace(req, timing);
  const row = await timing.measure('db', approveAction(ws, params.actionId));
  executeInBackground(row.id);
  return ok(toOperationsAction(row), 202);
});
