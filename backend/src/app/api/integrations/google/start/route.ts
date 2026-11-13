import { z } from 'zod';

import { ok, parseJson, route } from '@/lib/api/http';
import { startConnect } from '@/lib/google/connect';
import { requireFreshUser } from '@/lib/supabase/server';

const bodySchema = z.object({ returnTo: z.string().trim().min(1).max(500) });

/** Starts the Connect Google flow; the app opens the returned consent URL in the system browser. */
export const POST = route(async (req, { timing }) => {
  const user = await requireFreshUser(req, timing);
  const { returnTo } = bodySchema.parse(await parseJson(req));
  const url = await timing.measure('db', startConnect(user.userId, user.email, returnTo));
  return ok({ url });
});
