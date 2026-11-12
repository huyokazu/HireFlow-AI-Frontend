# Backend & Integration: Next.js + Supabase API, Gmail/Calendar Operations Agent, latency, Live Demo

Status: implemented and verified locally; the live deploy waits on Supabase, Google Cloud and Vercel accounts · Branch: `feature/backend-supabase` (from `origin/dev`)

## Outcome

The Expo app (`src/`) gets a real backend in `backend/`. The backend is a Next.js 16 App Router API on Supabase and handles:

- user data, sessions and workspaces;
- every screen's data, replacing the mocks;
- an Operations Agent that books Google Calendar interviews with Meet and sends Gmail from the recruiter's account, with an approval and idempotency safety model;
- a latency budget and deploy config for a Vercel `sin1` + Supabase Singapore live demo.

## Constraints

- No Supabase, Google or Vercel accounts exist yet. Everything is verified locally with the Supabase CLI (Docker) and Google `simulated` mode.
- The frontend keeps working with mock data when `EXPO_PUBLIC_API_URL` is unset or the API fails. The demo must never break.
- Frontend service types are the contract. The backend mirrors them in `backend/src/contracts.ts`.
- Secrets are server-side only. Google refresh tokens are AES-256-GCM encrypted.

## Non-goals

- Google OAuth app verification and production Workspace setup. These are documented for the user only.
- UI redesign. Only the sign-in gate, the Google connect control and the operations approval list are added.
- Digital Twin simulation stays client-side, as pure math.

## Acceptance criteria

1. `supabase db reset` applies the migrations and seed cleanly. An RLS test shows user B cannot read workspace A.
2. Every frontend service has an API endpoint returning the exact frontend type. `GET /api/bootstrap` returns the whole workspace in one request.
3. Operations Agent:
   - It proposes actions, auto-approves interviews per workspace setting and requires approval for offers.
   - It executes in `after()` and is idempotent: proposing the same action twice yields one action.
   - It writes `interviewBooked`/`offerSent` agent events.
   - It works in simulated mode, and live mode has unit-tested MIME, crypto and refresh logic.
4. Every response carries a `Server-Timing` header. `scripts/bench.mjs` reports p50/p95. Local warm p95 is under 100 ms for bootstrap.
5. Backend typecheck, lint and tests pass. Frontend `tsc --noEmit` and `expo lint` pass.
6. `docs/backend.md` documents setup, environment and the Live Demo deploy steps.

## Phases

| # | Phase | Owner | Depends |
|---|---|---|---|
| 1 | Foundation: scaffold, schema, RLS, seed, lib | main | — |
| 2 | Data API routes and tests | subagent A | 1 |
| 3 | Google integration and Operations Agent | subagent B | 1 |
| 4 | Frontend API client, auth and realtime wiring | subagent C | 1 (contract) |
| 5 | Latency verification, deploy config, docs, review | main | 2–4 |

All 5 phases are done. The independent review found 3 High, 5 Medium and 10 Low issues; all were fixed with regression tests. Results: 71/71 backend tests, both typechecks and lints clean, `next build` OK, and an end-to-end browser check passed (sign-in → dashboard from the API → moving a candidate books a simulated interview with a Meet link). Operations and deploy guide: `docs/backend.md`.

## Research

- `reports/explore-261111-1553-frontend-domain-model.md`
- `reports/researcher-261111-1555-latency-and-deploy.md`
- `reports/researcher-261111-1556-nextjs-supabase-api-auth.md`
- `reports/researcher-261111-1557-google-gmail-calendar-oauth.md`
