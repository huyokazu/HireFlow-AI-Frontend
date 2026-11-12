import { ok, parseJson, route } from '@/lib/api/http';
import { getMe, updateMe } from '@/lib/data/me';
import { updateMeBody } from '@/lib/data/schemas';
import { forgetWorkspaceCache, requireUser } from '@/lib/supabase/server';

export const GET = route(async (req, { timing }) => {
  const user = await requireUser(req, timing);
  return ok(await timing.measure('db', getMe(user)));
});

export const PATCH = route(async (req, { timing }) => {
  const user = await requireUser(req, timing);
  const changes = updateMeBody.parse(await parseJson(req));
  const me = await timing.measure('db', updateMe(user, changes));
  forgetWorkspaceCache(user.userId);
  return ok(me);
});
