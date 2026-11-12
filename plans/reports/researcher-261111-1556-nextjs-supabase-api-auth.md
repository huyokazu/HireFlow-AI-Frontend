# Next.js 16 + Supabase API, auth and sessions

Checked against the npm registry, the official docs and library source on 2026-11-11.

## Versions

| Package | Version |
|---|---|
| next | 16.4.6 |
| @supabase/supabase-js | 2.119.0 |
| supabase CLI | 3.1.0 |
| zod | 4.6.7 |
| expo-secure-store | 58.0.2 |

## Decisions

- **Route handlers.** They run on the Node runtime with no `runtime` export, because the edge runtime is deprecated. `params` is a Promise. Route handlers are not cached by default.
- **`proxy.ts`.** In Next 16 this replaces `middleware.ts`. We use it only for CORS on `/api/*`. Auth is checked inside each handler.
- **Bearer auth.**
  - The Expo app signs in with supabase-js and sends `Authorization: Bearer <access_token>`.
  - The API verifies the token with `getClaims(token)`. With asymmetric keys, the default for new projects, this is local verification with a JWKS that is cached module-globally for 10 minutes. HS256 or a missing `kid` falls back to a network `getUser()`.
  - For each request, `createClient(url, publishableKey, { global: { headers: { Authorization } } })` is created so that RLS applies.
  - `supabaseAdmin` uses `sb_secret_` and is server-only. It is used for agent writes and for Google tokens.
- **Keys.** We use `sb_publishable_…` and `sb_secret_…`. The legacy anon and service_role keys are deprecated at the end of 2026.
- **Sessions.**
  - The supabase-js session is stored in `LargeSecureStore` on native: an AES key in SecureStore and the ciphertext in AsyncStorage. On web it uses localStorage.
  - Access tokens last 1 hour. Refresh tokens are single-use, with a 10 s reuse grace period.
  - `signOut()` defaults to signing out on all devices. Use `{ scope: 'local' }` for "this device".
  - We don't need a custom sessions table. Each JWT's `session_id` maps to `auth.sessions`. A `security definer` RPC lists the user's sessions for a devices view.
- **Multi-tenancy.**
  - We use `workspaces` and `workspace_members(role)`, with helpers `private.user_workspace_ids()` and `private.has_workspace_role()`. Both are `security definer`, set `search_path=''` and live in a schema that is not exposed.
  - Policies are written `to authenticated` with `workspace_id in (select private.user_workspace_ids())`.
  - Every policy column is indexed.
  - Composite FKs `(campaign_id, workspace_id)` stop the tenant from drifting.
- **Realtime.**
  - Broadcast from the DB uses a trigger that calls `realtime.send(..., topic => 'workspace:<id>:agent_events', private => true)`.
  - A SELECT policy on `realtime.messages` checks the topic against membership.
  - Clients call `supabase.realtime.setAuth()` and subscribe with `config.private = true`.
  - Realtime is a live tail only, so history is loaded over REST.
- **CLI v3.**
  - A bare `db push` targets **local**. Use `db push --remote` to push to the hosted project.
  - Run `supabase gen types --lang typescript`.
  - Docker is required on Windows.
- **Errors.**
  - Responses use the envelope `{ data }` or `{ error: { code, message, details? } }`.
  - Zod 4 errors are returned through `z.flattenError`.
  - PG codes map to HTTP statuses: PGRST116 → 404, 42501 → 403, 23505 → 409, 23503 → 409.

## Risks

- **Unexecuted SQL.** The SQL was not executed during research because Docker was down. Implementation must run `supabase db reset` and test RLS with two users.
- **Revocation lag.** `getClaims` does not check revocation. Sensitive actions such as Google connect also call `getUser()`.
