import { runInBackground } from '@/lib/api/background';
import { route } from '@/lib/api/http';
import { completeConnect, withGoogleResult } from '@/lib/google/connect';
import { requeueBlockedForUser } from '@/lib/operations/actions';
import { executeAction } from '@/lib/operations/executor';

/**
 * Google redirects the browser here (no bearer token: the single-use state row identifies the
 * user). Always answers with a redirect back into the app, except for an unknown/expired state.
 */
export const GET = route(async (req, { timing }) => {
  const outcome = await timing.measure('google', completeConnect(req.nextUrl.searchParams));

  if (outcome.result === 'connected') {
    const { userId } = outcome;
    // Actions that stalled on a dead grant can run again now.
    runInBackground('operations:requeue', async () => {
      const ids = await requeueBlockedForUser(userId);
      // One failing action must not strand the rest.
      for (const id of ids) {
        try {
          await executeAction(id);
        } catch (error) {
          console.error('[operations] re-queued action failed', id, error);
        }
      }
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: withGoogleResult(outcome.returnTo, outcome.result), 'Cache-Control': 'no-store' },
  });
});
