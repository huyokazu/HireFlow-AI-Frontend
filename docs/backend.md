# HireFlow AI backend

The `backend/` folder holds the Expo app's API, built with **Next.js 16 App Router** route handlers on **Supabase** (Postgres, Auth and Realtime). It covers:

- user data and sessions;
- every screen's data, replacing the mocks in `src/services`;
- the **Operations Agent**, which books Google Calendar interviews with a Meet link and sends Gmail from the recruiter's account.

The full API contract is in [`plans/261111-1557-backend-supabase-operations-agent/api-contract.md`](../plans/261111-1557-backend-supabase-operations-agent/api-contract.md).

## Architecture

```
Expo app (native / web)
  ├─ supabase-js ── sign-in, token refresh, Realtime (private channel workspace:<id>)
  └─ fetch + Bearer token ──► Next.js API (Vercel, sin1)
                                ├─ getClaims(): JWT checked locally with cached ES256 JWKS
                                ├─ per-request client with the user's token, so RLS applies
                                ├─ secret-key client for system writes (events, actions, tokens)
                                └─ after(): Operations Agent ──► Gmail / Calendar REST
                              Supabase Postgres (ap-southeast-1)
```

- **Tenancy.** Every business row carries a `workspace_id`. Members can read rows in their workspaces through RLS, enforced by the `private.user_workspace_ids()` helper. The signup trigger creates a profile and a personal workspace.
- **Contract.** The backend imports the app's types from `src/services/*.ts` type-only, through the `@app/*` alias. If a type changes, the backend typecheck fails until it is updated.
- **Agent activity.** The server writes agent events to `agent_events`. An insert trigger broadcasts each event on `workspace:<id>`. Mutations also return the events they created, and the app de-duplicates by `id`.
- **Sessions.** `auth.sessions` is the source of truth. `GET /api/me/sessions` lists the caller's sessions and `DELETE /api/me/sessions/:id` revokes one. Signing out on the current device happens in the app with `signOut({ scope: 'local' })`.

## Operations Agent (Gmail and Calendar)

1. **Connect Google.**
   - `POST /api/integrations/google/start` returns Google's consent URL. Its `state` is stored as a hash and expires after 10 minutes. The flow uses PKCE S256 and offline access.
   - `/callback` checks that every required scope was granted, then stores the tokens sealed with **AES-256-GCM** (`GOOGLE_TOKEN_ENC_KEY`, with the user id as AAD) in `google_connections`. That table has no RLS policies, so only the server can read it.
   - Scopes requested: `gmail.send`, `calendar.events.owned` and `calendar.freebusy`. None of them is in Google's "restricted" tier.
   - The Google account must have a verified email equal to the HireFlow account's email. Otherwise the callback revokes the grant and returns `google=account_mismatch`. This stops someone from sending their consent link to another person and capturing that person's Gmail. `GOOGLE_ALLOW_ANY_ACCOUNT=1` lifts the check; only use it when every member is trusted.
2. **Moving a candidate triggers the agent.**
   - Moving to **interview** proposes `schedule_interview`. The action is auto-approved when `workspaces.auto_approve_interviews` is set. The agent then checks freeBusy, picks the first free 30-minute-aligned slot between 09:00 and 18:00 on a weekday, and creates the event with a Meet link and `sendUpdates=all`.
   - Moving to **offer** proposes a `send_email` offer, which always needs approval. HR approves it from the AI Agents screen.
3. **Safety.**
   - Each action has an idempotency key derived from the business object, for example `interview:<applicationId>:r1`.
   - A worker claims an action atomically before running it, and does not run actions for paused agents.
   - Sends are capped per user per hour by `OPERATIONS_MAX_SENDS_PER_HOUR`.
   - The calendar event id is `sha256(key)`, so retrying never creates a duplicate event.
   - A Gmail timeout or 5xx marks the action `ambiguous`, and it is never retried automatically.
   - An `invalid_grant` from Google moves the action to `blocked_reauth`. Reconnecting Google re-queues it. In `auto` mode a dead grant also blocks the action; it never falls back to a simulated "success".
   - An action holds a 2-minute lease while it runs. If the function dies mid-run, the next run turns a stuck email into `ambiguous` and puts a stuck interview back in the queue (its event id is fixed, so it can't book twice).
   - Only the requester or a workspace owner/admin can approve or retry an action, and approving re-checks that the session is still valid. A client-supplied payload always needs approval.
   - The database grants members write access only to the columns the app edits, such as `applications.stage`. Columns the agents own, like match scores and campaign metrics, can only be written with the server key.
4. **Modes.** Set with `GOOGLE_MODE`:

   | Mode | Behaviour |
   |---|---|
   | `live` | Always calls Google. |
   | `simulated` | Runs the whole pipeline but never calls Google. |
   | `auto` | Behaves as `live` when the user has an active connection, otherwise as `simulated`. |

   Simulated actions are flagged `simulated: true` and marked in the UI. `OPERATIONS_REDIRECT_EMAIL` sends every outbound email and invite to one inbox, which keeps a live demo safe.
5. **Daily catch-up.** Vercel Cron calls `GET /api/operations/run` every day. It proposes actions that are missing and runs approved ones.

## AI agents (Gemini)

The API calls the prompts and agents in [`ai/`](../ai/README.md) through the `@ai/*` alias, on the server only. `GEMINI_API_KEY` lives in `backend/.env.local` and never reaches the app.

| Agent | Trigger | What it writes |
|---|---|---|
| **Talent** (`scoreCv`) | `POST /api/campaigns` with the Matching agent on, in the background | Grades up to 5 people from the workspace's talent pool whose skills overlap the new role. Adds them as applicants with `match_score`, `ai_assessment` and the rubric in `applications.ai_details` (Proof-of-Skill: skills /50, experience /30, other /20, matched and missing skills, reasons). Updates the campaign's applicants and match rate and logs `cvsScored`. |
| **Optimization** (`diagnoseCampaign`) | `POST /api/self-healing/campaigns/:id/diagnose` ("Run diagnosis" on the Self-Healing screen) | A `bottleneck_alerts` row with each fix's `patch` (the numbers on the card, from `patchFromFix`) and `expectedLift` (Digital Twin), plus a `bottleneckFlagged` event. Returns the campaign's open alert instead if it has one. |

**Fallback.** Every Gemini call runs through `runWithFallback` (`backend/src/lib/ai/runner.ts`). If Gemini takes longer than **4 s**, is rate-limited (429 / `RESOURCE_EXHAUSTED`), is unavailable, returns an invalid schema, or has no key, the agent answers with a precomputed result in the same shape:

- Talent: the deterministic rubric `rubricMatch` (`src/services/talent.ts`).
- Optimization: Gemini's saved diagnosis of the seeded campaign (`src/services/precomputed.ts`, from `ai/samples/backend_alert_senior.json`, with English added), or the Digital Twin's reading of the setup for other campaigns.

Responses and rows record `source: 'gemini' | 'fallback'`. `AI_MODE=precomputed` skips Gemini entirely. On the app side, `withAiFallback` (`src/services/fallback.ts`) waits 5.5 s for an AI route (the server's 4 s plus a database round trip), then uses the same precomputed answer if the API is unreachable or rate-limited. Approving a fix that takes longer than 4 s is shown as applied straight away and taken back if the server refuses it.

**Languages.** Precomputed answers carry English and Vietnamese. A live Talent answer is written in the language of the person who launched the campaign. A live Optimization answer is in Vietnamese, because `patchFromFix` reads the numbers out of Vietnamese text.

**Skips.** Skipping in the review deck calls `POST /api/campaigns/:id/candidates/:candidateId/skip`, which sets `applications.hr_decision = 'skipped'`. The deck stops offering that candidate; they stay on the board. Shortlisting moves the candidate to `interview`, which starts the Operations Agent (Calendar invite with a Meet link).

## Local development

You need Node 20+ and Docker Desktop running.

```bash
cd backend
npm install
npx supabase start          # local stack: API :54321, DB :54322, Studio :54323
npx supabase db reset       # applies supabase/migrations (incl. 20261113090000_ai_agents.sql)
npm run seed:demo           # demo@hireflow.local / hireflow-demo-2026, data mirrors the app mocks
npm run dev                 # http://localhost:3000/api/health
```

- **`.env.local`.** Copy `backend/.env.example` and fill it from `npx supabase status -o env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). Generate the two secrets as follows.
  - `GOOGLE_TOKEN_ENC_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  - `CRON_SECRET`: any long random string.
- **JWT signing key.** `supabase/signing_keys.json` holds the local ES256 key (gitignored). With it, `getClaims()` checks tokens locally just as it does in production. Create it with `npx supabase gen signing-key --algorithm ES256`, wrap the result in a JSON array, then restart the stack.
- **Connecting the app.** Copy the root `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL=http://localhost:3000` plus the Supabase URL and publishable key. On a physical phone, use your PC's LAN IP instead of `localhost`. Without these variables the app runs on mock data, exactly as before.

### Checks

```bash
cd backend && npx tsc --noEmit && npx eslint . && npx vitest run   # integration tests need the local stack
cd .. && npx tsc --noEmit && npx expo lint
```

## Latency

Every response carries a `Server-Timing` header with `auth`, `workspace` and `db_*` phases plus a `total`. Run `npm run bench` (`scripts/bench.mjs`) to get p50, p95 and p99 per endpoint together with the server phases. Under Git Bash, prefix the command with `MSYS_NO_PATHCONV=1`.

| Technique | Effect |
|---|---|
| Vercel function in `sin1` next to Supabase `ap-southeast-1` | Avoids about 220 ms per DB round trip that the default `iad1` region would add for users in Vietnam |
| `getClaims()` with ES256 JWKS cached in module scope | Auth takes about 0.3 ms instead of an Auth round trip |
| `GET /api/bootstrap` with one parallel query batch | The app's 7 startup requests become 1 |
| `dashboard_summary(ws)` SQL RPC | The dashboard is one round trip |
| Workspace lookup cached for 30 s on GETs (RLS still applies) | Removes one sequential round trip per read |
| `after()` for Gmail and Calendar | Moving a card returns before Google is called |
| Plain `fetch` to Google REST instead of `googleapis` (247 MB) | Smaller bundle and faster cold start |

Measured locally against the production build (`next build && next start`) with Supabase in Docker on Windows, n=200:

| Endpoint | Client p50 / p95 (c=1) | Server total (p50) | Notes |
|---|---|---|---|
| `/api/bootstrap` | 26 / 39 ms | 10.7 ms | Replaces 7 startup requests; 6 query groups run in parallel |
| `/api/dashboard` | 31 / 33 ms | 17 ms | One RPC |
| `/api/pipeline` | 30 / 33 ms | 17 ms | One query |
| `/api/bootstrap` (c=10) | 93 / 137 ms | 53 ms | 10 concurrent clients |

The workspace cache cut the server time for bootstrap from 26 ms to 11.5 ms on `next dev`. The flat ~16 ms DB time on the single-query endpoints looks like a Windows Docker networking artefact (the same queries take 7–9 ms inside bootstrap). Confirm on Vercel `sin1` by running `scripts/bench.mjs --base https://<api>`.

Targets for production: warm p50 under 150 ms and p95 under 300 ms from Vietnam, and a cold first request under 1.5 s.

## Deploying the Live Demo

1. **Supabase.**
   - Create a project in **Southeast Asia (Singapore)**. The region cannot be changed later.
   - Under Settings, JWT Keys, make sure the project uses **asymmetric (ES256)** signing keys. Check that `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` returns keys.
   - Under Realtime settings, turn off "Allow public access".
   - Then run from `backend/`:
     ```bash
     npx supabase link --project-ref <ref>
     npx supabase db push --remote        # CLI v3: a bare `db push` only targets the local stack
     SUPABASE_URL=… SUPABASE_SECRET_KEY=… npx tsx scripts/seed-demo.ts
     ```
2. **Google Cloud.**
   - Create an OAuth client of type **Web application** with redirect URI `https://<api-domain>/api/integrations/google/callback`.
   - Enable the Gmail API and the Google Calendar API.
   - The consent screen depends on your Google account:
     - **Internal**, if you have a Workspace domain. There is no warning screen and tokens don't expire after 7 days.
     - **External/Testing** otherwise. Add the demo accounts as test users. Refresh tokens expire **7 days** after consent, so reconnect the day before the demo.
3. **Vercel API project.**
   - Import the repository with **Root Directory `backend`**. Keep "Include files outside the root directory" on, because the API imports `../src` types.
   - `vercel.json` pins the functions to `sin1` and adds the daily cron.
   - Set the environment variables listed in `backend/.env.example`:
     - `GOOGLE_REDIRECT_URI`: the production callback URL.
     - `CORS_ORIGINS`: the web origins, for example `https://hireflow-web.vercel.app,https://hireflow-web-*.vercel.app`.
     - `GOOGLE_RETURN_TO_ALLOWLIST`: the web origin's `/settings`.
   - Turn off Vercel Authentication for previews of this project. The API has its own auth, and protected previews return 401 to CORS preflight requests.
4. **Vercel web project.** Import the same repository at the root. The root `vercel.json` runs `expo export -p web` and serves the SPA. Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. **Before going on stage.**
   - Run `curl https://<api>/api/health` to warm the function and confirm `region: sin1`.
   - Call `GET /api/integrations/google/health` with a bearer token. If it fails, set `GOOGLE_MODE=simulated` so the demo still runs end to end.
   - Re-run the seed so the relative timestamps look fresh.
   - Run `node scripts/bench.mjs --base https://<api>`.
