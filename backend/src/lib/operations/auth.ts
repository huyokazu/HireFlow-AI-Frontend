import 'server-only';

import { ApiError, type Timing } from '@/lib/api/http';
import { requireFreshUser, requireWorkspace, supabaseAdmin, type WorkspaceContext } from '@/lib/supabase/server';

/**
 * Workspace membership plus a live session check. Actions that make the agent email or book on
 * someone's behalf must not be accepted from a signed-out (revoked) session that still holds an
 * unexpired access token. Both checks run in parallel.
 */
export async function requireFreshWorkspace(req: Request, timing?: Timing): Promise<WorkspaceContext> {
  const [ws] = await Promise.all([requireWorkspace(req, timing), requireFreshUser(req, timing)]);
  return ws;
}

/**
 * Approving or retrying sends Google calls from the requester's account, so only the requester
 * or a workspace owner/admin may do it.
 */
export function assertMayDecide(ws: WorkspaceContext, requestedBy: string): void {
  if (requestedBy !== ws.userId && ws.role === 'member') {
    throw new ApiError(403, 'FORBIDDEN', 'Only the requester or a workspace admin can approve or retry this action');
  }
}

export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
