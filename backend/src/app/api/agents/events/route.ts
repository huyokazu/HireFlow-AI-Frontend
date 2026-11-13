import { ok, route } from '@/lib/api/http';
import { getAgentEvents } from '@/lib/data/queries';
import { eventsQuery } from '@/lib/data/schemas';
import { requireWorkspace } from '@/lib/supabase/server';

/** Older activity, for scrolling past what the app has in memory. */
export const GET = route(async (req, { timing }) => {
  const page = eventsQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { supabase, workspaceId } = await requireWorkspace(req, timing);
  return ok(await timing.measure('db', getAgentEvents(supabase, workspaceId, page)));
});
