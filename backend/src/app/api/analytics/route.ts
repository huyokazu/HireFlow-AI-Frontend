import { ok, route } from '@/lib/api/http';
import { getAnalytics } from '@/lib/data/analytics';
import { requireWorkspace } from '@/lib/supabase/server';

export const GET = route(async (req, { timing }) => {
  const { supabase, workspaceId, userId } = await requireWorkspace(req, timing);
  return ok(await timing.measure('db', getAnalytics(supabase, workspaceId, userId)));
});
