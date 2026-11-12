import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { ApiError, type Timing } from '@/lib/api/http';
import { env } from '@/lib/env';

import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

// Module scope: a warm function instance reuses the HTTP agent and the cached JWKS, so verifying a
// token is a local signature check instead of a round trip to Supabase Auth.
let authClient: Db | undefined;
let adminClient: Db | undefined;

function getAuthClient(): Db {
  authClient ??= createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, { auth: noSession });
  return authClient;
}

/** Bypasses RLS. Server-side only: agent writes, Google tokens, operations actions. */
export function supabaseAdmin(): Db {
  adminClient ??= createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, { auth: noSession });
  return adminClient;
}

export type UserContext = {
  /** Runs as the signed-in user, so RLS applies to every query. */
  supabase: Db;
  userId: string;
  email: string | undefined;
  sessionId: string | undefined;
  token: string;
};

function bearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token');
  return token;
}

/**
 * Verifies the Supabase access token sent by the app. With asymmetric signing keys this is a local
 * check against the cached JWKS. It does not see revocations until the token expires (1 h), so
 * sensitive actions should also call {@link requireFreshUser}.
 */
export async function requireUser(req: Request, timing?: Timing): Promise<UserContext> {
  const token = bearerToken(req);
  const verify = () => getAuthClient().auth.getClaims(token);
  const { data, error } = timing ? await timing.measure('auth', verify) : await verify();
  if (error || !data || data.claims.role !== 'authenticated') {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
  const claims = data.claims;
  return {
    supabase: createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: noSession,
    }),
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    sessionId: typeof claims.session_id === 'string' ? claims.session_id : undefined,
    token,
  };
}

/** Like {@link requireUser}, plus a round trip to Auth so a signed-out session is rejected at once. */
export async function requireFreshUser(req: Request, timing?: Timing): Promise<UserContext> {
  const ctx = await requireUser(req, timing);
  const check = () => getAuthClient().auth.getUser(ctx.token);
  const { data, error } = timing ? await timing.measure('auth_fresh', check) : await check();
  if (error || data.user?.id !== ctx.userId) throw new ApiError(401, 'INVALID_TOKEN', 'Session is no longer valid');
  return ctx;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceContext = UserContext & { workspaceId: string; role: WorkspaceRole };

/**
 * Workspace resolutions for reads, per warm instance. Saves one sequential DB round trip on every
 * GET. Safe to serve slightly stale: reads run through the user's RLS-scoped client, so a removed
 * member gets no rows even while their entry is cached. Writes (which may use the secret key after
 * this check) always resolve fresh.
 */
const READ_CACHE_TTL_MS = 30_000;
const READ_CACHE_MAX = 1_000;
const readCache = new Map<string, { workspaceId: string; role: WorkspaceRole; expires: number }>();

/**
 * Resolves the workspace a request acts on: the `X-Workspace-Id` header if the user belongs to it,
 * otherwise the user's default workspace. One query (profile + memberships), cached briefly for GETs.
 */
export async function requireWorkspace(req: Request, timing?: Timing): Promise<WorkspaceContext> {
  const user = await requireUser(req, timing);
  const requested = req.headers.get('x-workspace-id');
  const cacheKey = req.method === 'GET' ? `${user.userId}:${requested ?? ''}` : null;
  const cached = cacheKey ? readCache.get(cacheKey) : undefined;
  if (cached && cached.expires > Date.now()) return { ...user, workspaceId: cached.workspaceId, role: cached.role };

  const resolved = await resolveWorkspace(user, requested, timing);
  if (cacheKey) {
    if (readCache.size >= READ_CACHE_MAX) readCache.clear();
    readCache.set(cacheKey, { ...resolved, expires: Date.now() + READ_CACHE_TTL_MS });
  }
  return { ...user, ...resolved };
}

/** Drops a user's cached workspace resolutions, e.g. after they change their default workspace. */
export function forgetWorkspaceCache(userId: string): void {
  for (const key of readCache.keys()) if (key.startsWith(`${userId}:`)) readCache.delete(key);
}

async function resolveWorkspace(
  user: UserContext,
  requested: string | null,
  timing?: Timing,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const lookup = () =>
    user.supabase
      .from('profiles')
      .select('default_workspace_id, memberships:workspace_members(workspace_id, role)')
      .eq('id', user.userId)
      .single();
  const { data, error } = timing ? await timing.measure('workspace', lookup) : await lookup();
  if (error || !data) throw new ApiError(403, 'NO_PROFILE', 'No profile for this account');

  const memberships = data.memberships as { workspace_id: string; role: WorkspaceRole }[];
  const wanted = requested ?? data.default_workspace_id;
  const membership = memberships.find((m) => m.workspace_id === wanted) ?? (requested ? undefined : memberships[0]);
  if (!membership) throw new ApiError(403, 'NOT_A_MEMBER', 'You are not a member of this workspace');

  return { workspaceId: membership.workspace_id, role: membership.role };
}

/** Allows a scheduled job (Vercel Cron) that presents `Authorization: Bearer $CRON_SECRET`. */
export function isCronRequest(req: Request): boolean {
  const secret = env.cronSecret;
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
}
