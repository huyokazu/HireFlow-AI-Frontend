import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

import type { Database } from '@/lib/supabase/database.types';

const url = process.env.SUPABASE_URL!;
const noSession = { persistSession: false, autoRefreshToken: false } as const;

export const admin = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, { auth: noSession });

export type TestUser = { id: string; email: string; token: string; workspaceId: string };

/** Creates a confirmed user (the signup trigger gives them an empty workspace) and signs in. */
export async function createTestUser(label = 'user'): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.hireflow.local`;
  const password = `pw-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient<Database>(url, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: noSession });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const profile = await admin.from('profiles').select('default_workspace_id').eq('id', created.data.user.id).single();
  if (profile.error || !profile.data.default_workspace_id) throw profile.error ?? new Error('no workspace');
  return {
    id: created.data.user.id,
    email,
    token: signedIn.data.session.access_token,
    workspaceId: profile.data.default_workspace_id,
  };
}

export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  await admin.from('workspaces').delete().eq('id', user.workspaceId);
  await admin.auth.admin.deleteUser(user.id);
}

type Handler<P> = (req: NextRequest, segment: { params: Promise<P> }) => Promise<Response>;

/** Calls a route handler in-process, like Next.js would. */
export async function callRoute<P = Record<string, never>>(
  handler: Handler<P>,
  options: {
    method?: string;
    path?: string;
    token?: string;
    body?: unknown;
    params?: P;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const req = new NextRequest(`http://localhost:3000${options.path ?? '/api/test'}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve((options.params ?? {}) as P) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}
