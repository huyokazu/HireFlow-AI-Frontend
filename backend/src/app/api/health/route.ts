import { ok, route } from '@/lib/api/http';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Liveness plus a database round trip. Used by the daily cron (it also keeps a free Supabase
 * project from pausing) and to warm the function before a demo. `region` confirms co-location.
 */
export const GET = route(async (_req, { timing }) => {
  const { error } = await timing.measure('db', supabaseAdmin().from('workspaces').select('id', { head: true, count: 'exact' }).limit(1));
  return ok({
    status: error ? 'degraded' : 'ok',
    database: error ? 'unreachable' : 'ok',
    region: process.env.VERCEL_REGION ?? 'local',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    time: new Date().toISOString(),
  }, error ? 503 : 200);
});
