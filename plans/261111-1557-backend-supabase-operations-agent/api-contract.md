# HireFlow API contract (v1)

Base URL: `EXPO_PUBLIC_API_URL`. Locally that is `http://localhost:3000`.

All types referred to here are the app's own types from `src/services/*.ts`. The backend imports them type-only through `@app/*`, and extra shapes live in `backend/src/lib/contracts.ts`.

## Conventions

- **Auth.** Every route except `/api/health` and the Google callback needs `Authorization: Bearer <supabase access_token>`. The app gets the token from supabase-js `getSession()`.
- **Workspace.** Send the optional `X-Workspace-Id` header to pick a workspace. Without it, the user's default workspace is used.
- **Success:** `{ "data": T }`.
- **Error:** `{ "error": { "code": string, "message": string, "details"?: unknown } }`. Codes:

  | Status | Codes |
  |---|---|
  | 400 | `VALIDATION_FAILED`, `INVALID_JSON`, `CHECK_VIOLATION`, `INVALID_INPUT` |
  | 401 | `UNAUTHENTICATED`, `INVALID_TOKEN` |
  | 403 | `NOT_A_MEMBER`, `NO_PROFILE`, `FORBIDDEN` |
  | 404 | `NOT_FOUND` |
  | 409 | `CONFLICT`, `FK_VIOLATION` |
  | 500 | `INTERNAL` |

  Errors the database raises carry a fixed message per code; the raw database message is only logged on the server. No route returns 429: the Operations Agent records a Google rate limit on the action itself.

- **Server-Timing.** Every response carries a `Server-Timing` header. CORS exposes it.
- **Server-created events.** When a mutation creates agent events, the response returns them as `events: AgentEvent[]`, with ids made by the server. The same events also arrive over Realtime, so the app de-duplicates by `id`.
- **Realtime.** The app subscribes to a private channel `workspace:<workspaceId>` (`config: { private: true }`, after `supabase.realtime.setAuth()`) and receives:
  - `agent_event`, whose payload is an `AgentEvent`;
  - `action_updated`, whose payload is `{ id, kind, status, simulated, candidateId, updatedAt }`.

## User and session — owned by Phase 2

| Method | Path | Body | `data` |
|---|---|---|---|
| GET | `/api/me` | — | `Me` |
| PATCH | `/api/me` | `{ displayName?, locale?: 'en'\|'vi', timezone?, defaultWorkspaceId? }` | `Me` |
| GET | `/api/me/sessions` | — | `UserSession[]` (the current one is flagged `current: true`) |
| DELETE | `/api/me/sessions/:sessionId` | — | `{ revoked: boolean }` (re-checks the session with Auth first) |

Sign-in, sign-up and refresh happen in the app with supabase-js directly. Sign-out for "this device" is `supabase.auth.signOut({ scope: 'local' })`.

## Workspace data — owned by Phase 2

| Method | Path | Body | `data` |
|---|---|---|---|
| GET | `/api/bootstrap?featured=<campaignId>` | — | `WorkspaceBootstrap`: everything the WorkspaceProvider loads, in one request |
| GET | `/api/dashboard` | — | `DashboardSummary` |
| GET | `/api/campaigns/:campaignId/candidates` | — | `Candidate[]`, best match first |
| GET | `/api/pipeline` | — | `PipelineCandidate[]`, most recent stage change first |
| PATCH | `/api/pipeline/:candidateId` | `{ stage: PipelineStage, campaignId?: string }` | `PipelineCandidate`. The Operations Agent then reacts in the background. |
| GET | `/api/campaigns/setups` | — | `Record<campaignId, CampaignDraft>` |
| POST | `/api/campaigns` | `{ draft: CampaignDraft }` | `{ campaign: CampaignSummary, events: AgentEvent[] }` (`campaignLaunched`). Returns 201. |
| PUT | `/api/campaigns/:campaignId/setup` | `{ setup: CampaignDraft }` | `{ events: AgentEvent[] }` (`setupUpdated`) |
| GET | `/api/self-healing/alerts` | — | `AlertWithDecision[]`. Covers open alerts, plus approved or dismissed alerts decided in the last 30 days. |
| GET | `/api/self-healing/history` | — | `HealingRecord[]`, only records not tied to a returned alert |
| POST | `/api/self-healing/alerts/:alertId/approve` | `{ fixId }` | `{ alert: AlertWithDecision, events: AgentEvent[] }` (`fixApplied`). Merges the fix's `patch` into the campaign setup. |
| POST | `/api/self-healing/alerts/:alertId/dismiss` | — | `{ alert: AlertWithDecision }` |
| POST | `/api/self-healing/alerts/:alertId/reopen` | — | `{ alert: AlertWithDecision }` |
| GET | `/api/agents` | — | `AgentWorkspaceWithPause` |
| PATCH | `/api/agents/paused` | `{ changes: Partial<PausedAgents> }` | `{ paused: PausedAgents, events: AgentEvent[] }`. Events follow the app's rules: one agent gives `agentPaused` / `agentResumed`, several give `agentsPaused` / `agentsResumed`, all of them give `allPaused` / `allResumed`. |
| GET | `/api/agents/events?before=<id>&limit=<1..100>` | — | `AgentEvent[]`, newest first |
| GET | `/api/analytics` | — | `HiringAnalytics` |

## Google and the Operations Agent — owned by Phase 3

| Method | Path | Body | `data` |
|---|---|---|---|
| GET | `/api/integrations/google` | — | `GoogleConnectionStatus` |
| POST | `/api/integrations/google/start` | `{ returnTo: string }` | `{ url }`. Open it in the system browser, or redirect the page on web. |
| GET | `/api/integrations/google/callback` | (Google redirect) | Redirects to `returnTo?google=connected\|denied\|missing_scopes\|account_mismatch\|error`. `account_mismatch` means the Google account's verified email differs from the HireFlow account's email; this check can be turned off with `GOOGLE_ALLOW_ANY_ACCOUNT=1`. |
| DELETE | `/api/integrations/google` | — | `{ disconnected: true }`. Revokes the token at Google. |
| GET | `/api/integrations/google/health` | — | `{ ok, mode, email?, error? }`. Forces a token refresh and makes one freeBusy call. |
| GET | `/api/operations/actions?status=<s>&limit=` | — | `OperationsAction[]`, newest first |
| POST | `/api/operations/actions` | `{ kind, candidateId, campaignId?, payload?: Partial<…Payload>, idempotencyKey? }` | `OperationsAction`. Returns 201 when new, 200 when the idempotency key already existed. Returns 409 if the key is reused for a different kind or candidate. Client keys are stored as `client:<key>`, and keys starting with `interview:` or `offer:` are reserved (400). A client-supplied `payload` always needs approval, and client `html` is not accepted. |
| POST | `/api/operations/actions/:actionId/approve` | — | `OperationsAction` with status `approved`. Returns 202 and executes in the background. Only the requester or a workspace owner/admin may approve; anyone else gets 403 `FORBIDDEN`. |
| POST | `/api/operations/actions/:actionId/reject` | — | `OperationsAction`. Allowed from `proposed`, `approved`, `ambiguous`, and from `executing` once its 2-minute lease has expired. |
| POST | `/api/operations/actions/:actionId/retry` | — | `OperationsAction` (`failed`, `blocked_reauth` or `ambiguous` → `approved`). Returns 202. Retrying an `ambiguous` email may send it twice, so check Sent first. Requester or owner/admin only. |
| POST | `/api/operations/run` | — | `{ proposed: number, executed: number }`. Called by the cron (`Bearer CRON_SECRET`) or by a member for their own workspace. |

Agent events written by the Operations Agent:

| Event | Actor | When |
|---|---|---|
| `interviewBooked` | `scheduling` | The interview is booked |
| `offerDrafted` | `offer` | An offer email is proposed |
| `offerSent` | `offer` | The offer email is sent |

All three carry `candidateId`, `candidate` (the name), `actionId`, `startsAt?`, `meetLink?` and `simulated`.
