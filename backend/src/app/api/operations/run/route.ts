import type { NextRequest } from 'next/server';

import { ApiError, ok, route, type RouteContext } from '@/lib/api/http';
import { runOperations } from '@/lib/operations/run';
import { isCronRequest, requireWorkspace } from '@/lib/supabase/server';

async function run(req: NextRequest, { timing }: RouteContext<Record<string, never>>, cronOnly: boolean) {
  if (isCronRequest(req)) return ok(await timing.measure('run', runOperations({})));
  if (cronOnly) throw new ApiError(401, 'UNAUTHENTICATED', 'This endpoint is for the scheduled job');
  const ws = await requireWorkspace(req, timing);
  return ok(await timing.measure('run', runOperations({ workspaceId: ws.workspaceId, userId: ws.userId })));
}

/** Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`; it covers every workspace. */
export const GET = route((req, ctx) => run(req, ctx, true));

/** The cron, or a member catching up their own workspace. */
export const POST = route((req, ctx) => run(req, ctx, false));
