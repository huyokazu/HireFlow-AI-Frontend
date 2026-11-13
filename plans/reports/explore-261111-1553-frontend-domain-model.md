# Frontend domain model (origin/dev) — backend data contract

Source: `git show origin/dev:src/services/*.ts`, `src/state/WorkspaceProvider.tsx`.

## Services to back with the API

| Service fn | Mock note says | Backend endpoint |
|---|---|---|
| `fetchDashboardSummary()` | Supabase view/RPC aggregating campaigns | `GET /api/dashboard` |
| `fetchMatchedCandidates(campaignId)` | `campaign_matches` query | `GET /api/campaigns/:id/candidates` |
| `fetchPipeline()` | `applications` + `candidates` join | `GET /api/pipeline` |
| `saveCandidateStage(id, stage)` | update `applications`; orchestrator reacts | `PATCH /api/applications/:id` |
| `launchCampaign(draft)` | insert `campaigns` + orchestrator call | `POST /api/campaigns` |
| `fetchCampaignSetups()` / `updateCampaignSetup()` | select/update `campaigns` | `GET /api/campaigns/setups`, `PUT /api/campaigns/:id/setup` |
| `fetchActiveBottleneckAlerts()` / `fetchHealingHistory()` / `approveSuggestedFix()` | alerts table, action log, orchestrator call | `GET /api/self-healing`, `POST /api/self-healing/alerts/:id/approve` |
| `fetchAgentWorkspace()` / `updatePausedAgents()` / `subscribeToAgentActivity()` | `agent_stats`, `agent_events`, Realtime | `GET /api/agents`, `PATCH /api/agents/paused`, Realtime on `agent_events` |
| `fetchHiringAnalytics()` | views over applications/hires | `GET /api/analytics` |

`digitalTwin.ts` is pure client-side math and stays in the client.

## Key types (verbatim names)

- `Localized<T = string> = Record<'en' | 'vi', T>`. Top-level display fields are stored as `jsonb {en, vi}`.
- `CampaignSummary { id, title: Localized, department: Localized, stage: 'sourcing'|'screening'|'interviewing'|'offer', candidates, matchRate, targetMatchRate, health: 'on_track'|'at_risk'|'blocked' }`
- `CampaignDraft { title, department, location, workMode, seniority, headcount, skills[], minExperience, salaryMin, salaryMax, channels[], agents: Record<'sourcing'|'matching'|'scheduling'|'selfHealing', boolean>, targetMatchRate }`
- `Candidate { id, name, role: Localized, location: Localized, yearsOfExperience, matchScore, skills[], aiAssessment: Localized }`
- `PipelineCandidate = Candidate & { campaignId, stage: 'applied'|'screening'|'interview'|'offer'|'hired', daysInStage }`
- `AgentEvent` is a union of 16 kinds; actors are `sourcing | matching | scheduling | offer | selfHealing | orchestrator`.
- `BottleneckAlert`, `HealingRecord`, `SuggestedFix` are nested bilingual structures.

## Gaps the Operations Agent needs

- `interviewBooked` carries no time, calendar event id, or attendees. `offerDrafted` carries no Gmail id.
- Decision: add `interviews` and `outbound_emails` tables plus an `operations_actions` log. The agent writes `interviewBooked` and `offerDrafted` events with an optional `refId` that points at those rows.

## Risks carried into the plan

1. The provider's `Promise.all(...).then` has no `.catch`. The API client must fall back to mocks on failure.
2. `saveCandidateStage` and `updatePausedAgents` are fire-and-forget. The API returns errors, but the UI does not roll back (out of scope).
3. Client-generated ids (`evt_…`, campaign slug). The server generates ids.
4. Agent stats are re-applied client-side on streamed events. The server returns base stats only; Realtime events are deltas.
5. `CandidateReviewScreen` bypasses the provider (unchanged).
