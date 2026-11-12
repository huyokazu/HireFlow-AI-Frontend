import { ok, parseJson, route } from '@/lib/api/http';
import { approveFixBody, idSchema } from '@/lib/data/schemas';
import { approveFix } from '@/lib/data/self-healing';
import { requireWorkspace } from '@/lib/supabase/server';

export const POST = route<{ alertId: string }>(async (req, { params, timing }) => {
  const alertId = idSchema.parse(params.alertId);
  const ctx = await requireWorkspace(req, timing);
  const { fixId } = approveFixBody.parse(await parseJson(req));
  return ok(await approveFix(ctx, alertId, fixId, timing));
});
