import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * `executing` is a lease that starts at the claim (`updated_at` is touched by trigger on every
 * update). One execution makes a few Google calls with 10 s timeouts, so a row still executing
 * after this long belongs to a worker that died (function timeout, crash).
 */
export const LEASE_MS = 2 * 60_000;

export const leaseCutoff = () => new Date(Date.now() - LEASE_MS).toISOString();

/**
 * Settles expired leases. An email may or may not have gone out, so it becomes `ambiguous` for a
 * human to check. A calendar booking reuses a fixed event id, so it is safe to re-queue.
 */
export async function reconcileExpiredLeases(scope: { workspaceId?: string; actionId?: string } = {}): Promise<number> {
  const db = supabaseAdmin();
  const expired = (kind: 'send_email' | 'schedule_interview', status: 'ambiguous' | 'approved', error: string) => {
    let query = db
      .from('agent_actions')
      .update({ status, error })
      .eq('status', 'executing')
      .eq('kind', kind)
      .lt('updated_at', leaseCutoff());
    if (scope.workspaceId) query = query.eq('workspace_id', scope.workspaceId);
    if (scope.actionId) query = query.eq('id', scope.actionId);
    return query.select('id');
  };
  const [emails, interviews] = await Promise.all([
    expired('send_email', 'ambiguous', 'LEASE_EXPIRED: outcome unknown; check the Gmail Sent folder before retrying'),
    expired('schedule_interview', 'approved', 'LEASE_EXPIRED: re-queued'),
  ]);
  if (emails.error) throw emails.error;
  if (interviews.error) throw interviews.error;
  return emails.data.length + interviews.data.length;
}
