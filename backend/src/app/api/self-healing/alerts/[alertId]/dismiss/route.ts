import { ok, route } from '@/lib/api/http';
import { idSchema } from '@/lib/data/schemas';
import { dismissAlert } from '@/lib/data/self-healing';
import { requireWorkspace } from '@/lib/supabase/server';

export const POST = route<{ alertId: string }>(async (req, { params, timing }) => {
  const alertId = idSchema.parse(params.alertId);
  const ctx = await requireWorkspace(req, timing);
  return ok({ alert: await timing.measure('db', dismissAlert(ctx, alertId)) });
});
