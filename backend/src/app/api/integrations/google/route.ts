import { ok, route } from '@/lib/api/http';
import { connectionStatus, disconnect } from '@/lib/google/connect';
import { requireFreshUser, requireUser } from '@/lib/supabase/server';

/** The signed-in user's Google connection (per user, not per workspace). */
export const GET = route(async (req, { timing }) => {
  const user = await requireUser(req, timing);
  return ok(await timing.measure('db', connectionStatus(user.userId)));
});

/** Revokes the grant at Google (best effort) and deletes the stored tokens. */
export const DELETE = route(async (req, { timing }) => {
  const user = await requireFreshUser(req, timing);
  await timing.measure('google', disconnect(user.userId));
  return ok({ disconnected: true as const });
});
