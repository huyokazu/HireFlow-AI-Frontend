import { ok, route } from '@/lib/api/http';
import { getPipeline } from '@/lib/data/queries';
import { requireWorkspace } from '@/lib/supabase/server';

export const GET = route(async (req, { timing }) => {
  const { supabase, workspaceId } = await requireWorkspace(req, timing);
  return ok(await timing.measure('db', getPipeline(supabase, workspaceId)));
});
