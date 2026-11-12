# Latency and Live Demo deployment

Verified against official docs on 2026-11-11.

## Decisions

- **The API runs on Vercel Hobby, pinned to `sin1`, with Fluid compute.** The region is set in `vercel.json` with `"regions": ["sin1"]`. Next.js 16 deprecates `preferredRegion`.
- **Supabase runs in `ap-southeast-1` (Singapore).** The region cannot be changed later.
  - Measured RTT from Vietnam: Singapore 38 ms, us-east-1 260 ms.
  - Vercel's default `iad1` region combined with a Singapore database costs about 220 ms for every DB round trip.
- **Expo web is a separate static Vercel project.** Build command: `expo export -p web`, output directory `dist`. Native clients and web both send `Authorization: Bearer <supabase access token>`.
- **CORS is handled in `proxy.ts`.** Next.js 16 renamed `middleware.ts` to `proxy.ts`. The allow list is `WEB_ORIGIN`, the `hireflow-web-*.vercel.app` previews and `http://localhost:8081`.

## Latency techniques, in order of impact

1. **Co-locate the function and the database.** This is roughly a 10x gain.
2. **Verify JWTs locally.**
   - `supabase.auth.getClaims(token)` verifies locally only when the project uses asymmetric signing keys (ES256). Otherwise it makes a network call, the same as `getUser()`.
   - We use `jose` `createRemoteJWKSet` at module scope so the result is deterministic.
3. **One round trip per screen.**
   - The dashboard is built by one SQL RPC.
   - Independent reads use `Promise.all`.
4. **Use supabase-js over PostgREST (HTTP keep-alive).** We don't need a pooler connection. On the Free plan the direct DB connection is IPv6-only.
5. **Index the RLS predicate columns and the FKs.** Write policies as `(select auth.uid())`.
6. **Run Gmail and Calendar side effects in `after()`.**
   - The handler writes a queued row and returns 202. A Realtime subscription delivers the final status.
   - `after()` is limited by `maxDuration`, which is 300 s on Hobby.
7. **Keep the bundle small.**
   - Avoid `googleapis`, which is 247 MB.
   - Use plain `fetch` against the Gmail and Calendar REST APIs, or `@googleapis/gmail` / `@googleapis/calendar`, which are about 1 MB each.
8. **Return a `Server-Timing` header** with `auth`, `db` and `total` on every response.
9. **The Vercel CDN does not cache requests that carry `Authorization`.** Only public endpoints can use `s-maxage`.

## Targets for the demo

| Request | Target |
|---|---|
| Warm read | p50 < 150 ms, p95 < 300 ms |
| Mutation | p95 < 300 ms |
| Cold first request | < 1.5 s |

Measure with `backend/scripts/bench.mjs` (n=100 c=1, then c=10).

## Demo checklist

- **Environment variables.**
  - API: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `WEB_ORIGIN`, `GOOGLE_DRY_RUN`.
  - Web: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Database setup.** Run `supabase link`, then `supabase db push --remote --include-seed`. Seed data mirrors the frontend mocks.
- **Google OAuth.** Register an exact redirect URI for the production domain and one for localhost.
  - Refresh tokens issued while the app is in Testing status expire after 7 days, so reconnect the day before the demo.
  - Scopes are limited to `gmail.send` (sensitive) and calendar scopes. Restricted scopes are not used.
- **Health checks.**
  - `GET /api/health` uses `no-store` and reports region, commit and a DB ping.
  - A daily cron calls it, which keeps the Supabase free project from pausing after 7 days.
- **Preview deployments.** Turn off Vercel Authentication for previews of the API project. Otherwise preflight requests and the Expo client get a 401.
- **Fallbacks.**
  - Server side: `GOOGLE_DRY_RUN=1`.
  - Client side: mock data when `EXPO_PUBLIC_API_URL` is unset or a request fails or times out (3 s).

## Unresolved

- Whether a competition demo counts as non-commercial use under the Vercel Hobby plan.
- Whether judges will use the native app or the web build. Both work with bearer auth.
