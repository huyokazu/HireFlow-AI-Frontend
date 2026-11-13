import { ok, parseJson, route } from '@/lib/api/http';
import { setPausedAgents } from '@/lib/data/agents';
import { pausedChangesBody } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/** Pauses or resumes agents on every campaign; the change is logged like the app logs it. */
export const PATCH = route(async (req, { timing }) => {
  const ctx = await requireWorkspace(req, timing);
  const { changes } = pausedChangesBody.parse(await parseJson(req));
  return ok(await setPausedAgents(ctx, changes, timing));
});
