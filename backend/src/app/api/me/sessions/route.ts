import { ok, route } from '@/lib/api/http';
import { listSessions } from '@/lib/data/me';
import { requireUser } from '@/lib/supabase/server';

export const GET = route(async (req, { timing }) => {
  const user = await requireUser(req, timing);
  return ok(await timing.measure('db', listSessions(user)));
});
