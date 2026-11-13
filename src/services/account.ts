import type { Language } from '../i18n/types';
import { requireRemote } from './remote';

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  locale: Language;
  timezone: string;
  defaultWorkspaceId: string | null;
};

export type WorkspaceMembership = {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  autoApproveInterviews: boolean;
};

/** The signed-in user (`GET /api/me`). */
export type Me = {
  profile: Profile;
  workspaces: WorkspaceMembership[];
  /** Session id from the access token, so "this device" can be marked in the session list. */
  currentSessionId: string | null;
};

/** A device or browser the user is signed in on. */
export type UserSession = {
  id: string;
  createdAt: string;
  refreshedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  aal: string | null;
  current: boolean;
};

export type ProfileChanges = Partial<Pick<Profile, 'displayName' | 'locale' | 'timezone' | 'defaultWorkspaceId'>>;

export function fetchMe(): Promise<Me> {
  return requireRemote().request<Me>('/api/me');
}

export function updateMe(changes: ProfileChanges): Promise<Me> {
  return requireRemote().request<Me>('/api/me', { method: 'PATCH', body: changes });
}

export function fetchSessions(): Promise<UserSession[]> {
  return requireRemote().request<UserSession[]>('/api/me/sessions');
}

/** Signs a device out. Resolves `false` when the session had already ended. */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const { revoked } = await requireRemote().request<{ revoked: boolean }>(`/api/me/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  return revoked;
}
