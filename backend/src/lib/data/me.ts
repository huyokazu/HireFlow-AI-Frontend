import 'server-only';

import type { z } from 'zod';

import { ApiError, unwrap } from '@/lib/api/http';
import type { Me, UserSession, WorkspaceMembership } from '@/lib/contracts';
import type { Tables } from '@/lib/supabase/database.types';
import type { UserContext } from '@/lib/supabase/server';

import { MAX_LIST_ROWS } from './constants';
import { rowsOf } from './result';
import type { updateMeBody } from './schemas';

const ME_COLUMNS =
  'id, email, display_name, locale, timezone, default_workspace_id, memberships:workspace_members(role, workspace:workspaces(id, name, auto_approve_interviews))';

type ProfileRow = Pick<Tables<'profiles'>, 'id' | 'email' | 'display_name' | 'locale' | 'timezone' | 'default_workspace_id'> & {
  memberships: {
    role: string;
    workspace: Pick<Tables<'workspaces'>, 'id' | 'name' | 'auto_approve_interviews'> | null;
  }[];
};

function toMe(row: ProfileRow, sessionId: string | undefined): Me {
  const workspaces = row.memberships.flatMap(({ role, workspace }): WorkspaceMembership[] =>
    workspace
      ? [
          {
            id: workspace.id,
            name: workspace.name,
            role: role as WorkspaceMembership['role'],
            autoApproveInterviews: workspace.auto_approve_interviews,
          },
        ]
      : [],
  );
  return {
    profile: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      locale: row.locale as Me['profile']['locale'],
      timezone: row.timezone,
      defaultWorkspaceId: row.default_workspace_id,
    },
    workspaces: workspaces.sort((a, b) => a.name.localeCompare(b.name)),
    currentSessionId: sessionId ?? null,
  };
}

export async function getMe(user: UserContext): Promise<Me> {
  const row = await user.supabase.from('profiles').select(ME_COLUMNS).eq('id', user.userId).maybeSingle();
  const profile = unwrap(row);
  if (!profile) throw new ApiError(404, 'NOT_FOUND', 'No profile for this account');
  return toMe(profile, user.sessionId);
}

export async function updateMe(user: UserContext, changes: z.infer<typeof updateMeBody>): Promise<Me> {
  const patch = {
    ...(changes.displayName !== undefined && { display_name: changes.displayName }),
    ...(changes.locale !== undefined && { locale: changes.locale }),
    ...(changes.timezone !== undefined && { timezone: changes.timezone }),
    ...(changes.defaultWorkspaceId !== undefined && { default_workspace_id: changes.defaultWorkspaceId }),
  };
  if (Object.keys(patch).length === 0) return getMe(user);

  const { data, error } = await user.supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.userId)
    .select(ME_COLUMNS)
    .maybeSingle();
  // The update policy only accepts a default workspace the user belongs to.
  if (error?.code === '42501') throw new ApiError(403, 'NOT_A_MEMBER', 'You are not a member of that workspace');
  if (error) throw error;
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'No profile for this account');
  return toMe(data, user.sessionId);
}

export async function listSessions(user: UserContext): Promise<UserSession[]> {
  const rows = rowsOf(await user.supabase.rpc('list_my_sessions').limit(MAX_LIST_ROWS));
  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    refreshedAt: row.refreshed_at ? new Date(row.refreshed_at).toISOString() : null,
    userAgent: row.user_agent || null,
    ip: row.ip || null,
    aal: row.aal || null,
    current: row.id === user.sessionId,
  }));
}

export async function revokeSession(user: UserContext, sessionId: string): Promise<boolean> {
  return Boolean(unwrap(await user.supabase.rpc('revoke_my_session', { session_id: sessionId })));
}
