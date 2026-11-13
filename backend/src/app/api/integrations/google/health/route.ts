import { ok, route } from '@/lib/api/http';
import { freeBusy } from '@/lib/google/client';
import { DEFAULT_TIME_ZONE } from '@/lib/google/config';
import { errorCode } from '@/lib/google/errors';
import { connectionStatus } from '@/lib/google/connect';
import { modeFor } from '@/lib/google/ops';
import { getAccessToken } from '@/lib/google/tokens';
import { requireUser } from '@/lib/supabase/server';

/**
 * Pre-demo check: forces a token refresh and makes one freeBusy call, so a dead grant shows up
 * here instead of on stage. In simulated mode there is nothing to check.
 */
export const GET = route(async (req, { timing }) => {
  const user = await requireUser(req, timing);
  const connection = await timing.measure('db', connectionStatus(user.userId));
  const mode = modeFor(connection.status);
  if (mode === 'simulated') return ok({ ok: true, mode });

  const email = connection.email ?? undefined;
  try {
    await timing.measure('refresh', getAccessToken(user.userId, { force: true }));
    const now = new Date();
    await timing.measure(
      'freebusy',
      freeBusy(user.userId, now.toISOString(), new Date(now.getTime() + 3_600_000).toISOString(), DEFAULT_TIME_ZONE),
    );
    return ok({ ok: true, mode, email });
  } catch (error) {
    console.warn('[google] health check failed', error);
    return ok({ ok: false, mode, email, error: errorCode(error) });
  }
});
