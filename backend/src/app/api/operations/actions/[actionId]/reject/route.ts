import { ok, route } from '@/lib/api/http';
import { rejectAction, toOperationsAction } from '@/lib/operations/actions';
import { requireWorkspace } from '@/lib/supabase/server';

export const POST = route<{ actionId: string }>(async (req, { params, timing }) => {
  const ws = await requireWorkspace(req, timing);
  const row = await timing.measure('db', rejectAction(ws, params.actionId));
  return ok(toOperationsAction(row));
});
