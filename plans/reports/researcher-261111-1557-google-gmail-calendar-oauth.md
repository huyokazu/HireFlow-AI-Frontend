# Gmail + Google Calendar for the Operations Agent

Checked against the official Google, Supabase and Expo docs on 2026-11-11.

## Decisions

- **Scopes:**
  - `openid email`
  - `https://www.googleapis.com/auth/gmail.send` (sensitive)
  - `https://www.googleapis.com/auth/calendar.events.owned`
  - `https://www.googleapis.com/auth/calendar.freebusy`

  None of these is restricted. Do not use `gmail.compose`, because it is restricted and triggers a security assessment. Offer drafts live in our DB as proposed actions and are sent with `gmail.send` after approval.
- **Connect flow:** a separate "Connect Google" flow run by Next.js, not Supabase's Google provider.
  - Supabase does not store or refresh provider tokens.
  - Native `signInWithIdToken` returns no refresh token.
  - Flow:
    1. `POST /api/integrations/google/start` (bearer) writes a single-use `oauth_states` row (sha256(state), user, PKCE verifier, return_to, 10 min TTL) and returns the consent URL. The URL uses `access_type=offline`, `prompt=consent`, `S256`, and an allowlisted `returnTo`, which blocks open redirects.
    2. `GET /api/integrations/google/callback` consumes the state row atomically, then exchanges the code using the client secret and the verifier.
    3. It checks that every scope was granted (users can untick boxes) and stores the tokens.
    4. It redirects to `returnTo?google=connected|denied|missing_scopes|error`.
  - Expo native uses `WebBrowser.openAuthSessionAsync`, since Google forbids webviews. The app needs `scheme: "hireflow"`. Expo web does a full-page redirect.
- **Token storage:** app-level AES-256-GCM with a server key (`GOOGLE_TOKEN_ENC_KEY`). The user id is bound as AAD. Tokens go in `google_connections`, which has RLS on and no policies, so only the server can read it. Supabase Vault is the second choice.
- **Library:** plain `fetch` against the REST endpoints. The `googleapis` package is 247 MB and loads in about 1 s; Vercel's limit is 250 MB.
- **MIME:** RFC 2047 encoded-word subject and display names, so Vietnamese text is safe. Body is multipart/alternative base64, sent base64url, with a CRLF injection guard.
- **Calendar:** `events.insert` with `conferenceDataVersion=1` and `sendUpdates=all`, timezone `Asia/Ho_Chi_Minh`. Before insert, check `freeBusy` on `primary`.
  - Event id is `sha256(idempotencyKey)` in hex, which is valid in Google's base32hex id alphabet.
  - A 409 means the event already exists. Fetch it and treat it as success.
- **Refresh:** cache the access token encrypted. Refresh 60 s before expiry. On `invalid_grant`, set status `needs_reauth` and throw `GoogleReauthRequired`. On a 401, retry once.

## Safety model for the autonomous agent

- The agent never calls Google directly. It writes `agent_actions` rows, and the server executes them.
  - Each row has a unique `(workspace, idempotency_key)` built from business identity, e.g. `interview:{applicationId}:r1` or `offer:{applicationId}:v1`.
  - Status flow: `proposed → approved → executing → succeeded | failed | ambiguous | rejected | blocked_reauth`.
- A worker claims an action atomically: `update … where status='approved' returning`.
- **Gmail:** a 4xx means nothing was sent, so retry. A timeout or 5xx after the request went out means `ambiguous`. Never auto-retry those.
- **Approval:** offers require approval. Interview scheduling can be auto-approved per workspace setting.
- **Quotas:** Gmail allows about 60 sends/min/user, and personal Gmail about 500/day. Calendar allows 600 req/min/user. We add our own cap of 20 agent sends per user per hour.

## Demo mode

- `GOOGLE_MODE=live|simulated|auto`. In `auto`, the server falls back to simulated when there is no active connection or a reauth is required, and records `simulated=true`. The UI labels these actions "Simulated".
- `GET /api/integrations/google/health` forces a refresh and runs one freeBusy call. Run it before going on stage.
- Testing status (External): tokens expire 7 days after consent, and there are at most 100 test users. Reconnect the day before the demo. An Internal app (Workspace domain) avoids both limits.

## Unresolved

- Does the team own a Google Workspace domain (Internal app), or will it use External/Testing?
- Will it use personal Gmail (500/day) or Workspace accounts?
- Should availability also be checked on interviewers' calendars? That needs `calendar.events.freebusy`.
