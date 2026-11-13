import { z } from 'zod';

import { ok, route } from '@/lib/api/http';
import { revokeSession } from '@/lib/data/me';
import { requireFreshUser } from '@/lib/supabase/server';

/** Signs out a device. Re-checks the caller's own session with Auth first. */
export const DELETE = route<{ sessionId: string }>(async (req, { params, timing }) => {
  const user = await requireFreshUser(req, timing);
  const sessionId = z.uuid().parse(params.sessionId);
  return ok({ revoked: await timing.measure('db', revokeSession(user, sessionId)) });
});
