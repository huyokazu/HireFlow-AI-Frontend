-- HireFlow AI core schema: users, workspaces, recruiting data, agent activity, Operations Agent.
-- Tenancy: every business row carries workspace_id; members of a workspace can read it (RLS).
-- System writes (agent events, operations actions, Google tokens) go through the server's secret key.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Users and workspaces
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  -- Operations Agent: book interviews without waiting for a human approval.
  auto_approve_interviews boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null default '',
  display_name text not null default '' check (char_length(display_name) <= 120),
  locale text not null default 'en' check (locale in ('en', 'vi')),
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) <= 64),
  default_workspace_id uuid references public.workspaces on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Membership helpers. security definer so policies on workspace_members don't recurse;
-- they live in a schema PostgREST does not expose.
create function private.user_workspace_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_members where user_id = (select auth.uid())
$$;

create function private.has_workspace_role(ws uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid()) and role = any (roles)
  )
$$;

revoke execute on function private.user_workspace_ids(), private.has_workspace_role(uuid, text[]) from public, anon;
grant execute on function private.user_workspace_ids(), private.has_workspace_role(uuid, text[]) to authenticated;

-- Every new account gets a profile and a personal workspace it owns.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  handle text := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'My');
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', handle));

  insert into public.workspaces (name) values (left(handle || '''s workspace', 120)) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  update public.profiles set default_workspace_id = ws where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Recruiting data (mirrors src/services/*.ts in the Expo app)
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id text primary key default ('cmp_' || substr(md5(gen_random_uuid()::text), 1, 12)),
  workspace_id uuid not null references public.workspaces on delete cascade,
  title jsonb not null,        -- Localized {en, vi}
  department jsonb not null,   -- Localized {en, vi}
  stage text not null default 'sourcing' check (stage in ('sourcing', 'screening', 'interviewing', 'offer')),
  -- Pipeline metrics maintained by the Sourcing and Matching agents.
  applicants int not null default 0 check (applicants >= 0),
  match_rate int not null default 0 check (match_rate between 0 and 100),
  target_match_rate int not null default 60 check (target_match_rate between 0 and 100),
  health text not null default 'on_track' check (health in ('on_track', 'at_risk', 'blocked')),
  setup jsonb,                 -- CampaignDraft
  dropped_after_interview int not null default 0 check (dropped_after_interview >= 0),
  dropped_after_offer int not null default 0 check (dropped_after_offer >= 0),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index campaigns_workspace_created_idx on public.campaigns (workspace_id, created_at desc);

create table public.candidates (
  id text primary key default ('cand_' || substr(md5(gen_random_uuid()::text), 1, 12)),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  email text check (email is null or email ~ '^[^\s@<>]+@[^\s@<>]+$'),
  role jsonb not null,         -- Localized
  location jsonb not null,     -- Localized
  years_of_experience int not null default 0 check (years_of_experience >= 0),
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index candidates_workspace_idx on public.candidates (workspace_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  campaign_id text not null,
  candidate_id text not null,
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'interview', 'offer', 'hired')),
  stage_entered_at timestamptz not null default now(),
  match_score int not null default 0 check (match_score between 0 and 100),
  ai_assessment jsonb not null default '{"en": "", "vi": ""}',
  created_at timestamptz not null default now(),
  unique (campaign_id, candidate_id),
  foreign key (campaign_id, workspace_id) references public.campaigns (id, workspace_id) on delete cascade,
  foreign key (candidate_id, workspace_id) references public.candidates (id, workspace_id) on delete cascade
);
create index applications_workspace_stage_idx on public.applications (workspace_id, stage_entered_at desc);
create index applications_campaign_score_idx on public.applications (campaign_id, match_score desc);
create index applications_candidate_idx on public.applications (candidate_id);

create table public.campaign_channel_results (
  workspace_id uuid not null,
  campaign_id text not null,
  channel text not null check (channel in ('linkedin', 'topcv', 'itviec', 'vietnamworks', 'wellfound', 'referrals')),
  applicants int not null default 0 check (applicants >= 0),
  qualified int not null default 0 check (qualified >= 0),
  primary key (campaign_id, channel),
  foreign key (campaign_id, workspace_id) references public.campaigns (id, workspace_id) on delete cascade
);
create index campaign_channel_results_workspace_idx on public.campaign_channel_results (workspace_id);

-- Rollups kept by the analytics job (seeded for the demo).
create table public.workspace_metrics (
  workspace_id uuid primary key references public.workspaces on delete cascade,
  new_candidates_this_week int not null default 0,
  average_time_to_hire_days numeric not null default 0,
  time_to_hire_change_days numeric not null default 0,
  hires_previous_period int not null default 0,
  tasks_yesterday int not null default 0,
  hours_saved_before_today numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.analytics_months (
  workspace_id uuid not null references public.workspaces on delete cascade,
  month_start date not null,
  hires int not null default 0,
  time_to_hire_days numeric not null default 0,
  primary key (workspace_id, month_start)
);

create table public.agent_weeks (
  workspace_id uuid not null references public.workspaces on delete cascade,
  week_start date not null,
  hours_saved numeric not null default 0,
  primary key (workspace_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Self-healing
-- ---------------------------------------------------------------------------

create table public.bottleneck_alerts (
  id text primary key default ('alert_' || substr(md5(gen_random_uuid()::text), 1, 12)),
  workspace_id uuid not null,
  campaign_id text not null,
  severity text not null check (severity in ('critical', 'warning')),
  detected_at timestamptz not null default now(),
  -- {title, campaignName, metric, rootCause, suggestedFixes} exactly as the app renders them.
  content jsonb not null,
  status text not null default 'open' check (status in ('open', 'approved', 'dismissed')),
  approved_fix_id text,
  decided_at timestamptz,
  decided_by uuid references public.profiles on delete set null,
  foreign key (campaign_id, workspace_id) references public.campaigns (id, workspace_id) on delete cascade
);
create index bottleneck_alerts_workspace_idx on public.bottleneck_alerts (workspace_id, detected_at desc);

create table public.healing_records (
  id text primary key default ('heal_' || substr(md5(gen_random_uuid()::text), 1, 12)),
  workspace_id uuid not null references public.workspaces on delete cascade,
  campaign_id text not null,
  -- Set when the record documents a decision on a live alert; such records are audit only,
  -- the app rebuilds them from the alert's status.
  alert_id text references public.bottleneck_alerts on delete set null,
  outcome text not null check (outcome in ('in_progress', 'resolved', 'dismissed')),
  content jsonb not null,      -- {campaignName, issue, fix?, result?, resolutionHours?}
  at timestamptz not null default now()
);
create index healing_records_workspace_idx on public.healing_records (workspace_id, at desc);

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------

create table public.agent_settings (
  workspace_id uuid not null references public.workspaces on delete cascade,
  agent_key text not null check (agent_key in ('sourcing', 'matching', 'scheduling', 'offer', 'selfHealing')),
  paused boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null,
  primary key (workspace_id, agent_key)
);

create table public.agent_stats (
  workspace_id uuid not null references public.workspaces on delete cascade,
  agent_key text not null check (agent_key in ('sourcing', 'matching', 'scheduling', 'offer', 'selfHealing')),
  done_today int not null default 0,
  queued int not null default 0,
  agreement_rate int not null default 0 check (agreement_rate between 0 and 100),
  median_seconds int not null default 0,
  last_active_at timestamptz not null default now(),
  primary key (workspace_id, agent_key)
);

create table public.agent_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  campaign_id text,
  kind text not null,
  actor text not null check (actor in ('sourcing', 'matching', 'scheduling', 'offer', 'selfHealing', 'orchestrator')),
  payload jsonb not null default '{}',
  at timestamptz not null default now()
);
create index agent_events_workspace_at_idx on public.agent_events (workspace_id, at desc);

-- ---------------------------------------------------------------------------
-- Operations Agent: Google connection and the action log it executes from
-- ---------------------------------------------------------------------------

create table public.google_connections (
  user_id uuid primary key references public.profiles on delete cascade,
  google_sub text not null,
  google_email text not null,
  scopes text[] not null,
  refresh_token_enc text not null,
  access_token_enc text,
  access_token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'revoked')),
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.oauth_states (
  state_hash text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  code_verifier text not null,
  return_to text not null,
  expires_at timestamptz not null
);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  -- Whose Google account executes the action.
  requested_by uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('schedule_interview', 'send_email')),
  -- Business identity, e.g. interview:<applicationId>:r1. Retries and re-plans collapse onto one row.
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  campaign_id text,
  candidate_id text,
  application_id uuid references public.applications on delete set null,
  payload jsonb not null,
  requires_approval boolean not null default true,
  status text not null default 'proposed' check (status in (
    'proposed', 'approved', 'executing', 'succeeded', 'failed', 'ambiguous', 'rejected', 'blocked_reauth'
  )),
  approved_by uuid references public.profiles on delete set null,
  approved_at timestamptz,
  attempts int not null default 0,
  provider_ref text,
  result jsonb,
  error text,
  simulated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index agent_actions_workspace_idx on public.agent_actions (workspace_id, created_at desc);
create index agent_actions_status_idx on public.agent_actions (workspace_id, status);

create trigger agent_actions_touch before update on public.agent_actions
  for each row execute function private.touch_updated_at();
create trigger google_connections_touch before update on public.google_connections
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.campaign_channel_results enable row level security;
alter table public.workspace_metrics enable row level security;
alter table public.analytics_months enable row level security;
alter table public.agent_weeks enable row level security;
alter table public.bottleneck_alerts enable row level security;
alter table public.healing_records enable row level security;
alter table public.agent_settings enable row level security;
alter table public.agent_stats enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_actions enable row level security;
-- No policies at all: only the server's secret key can touch these.
alter table public.google_connections enable row level security;
alter table public.oauth_states enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (default_workspace_id is null or default_workspace_id in (select private.user_workspace_ids()))
  );

create policy workspaces_select on public.workspaces for select to authenticated
  using (id in (select private.user_workspace_ids()));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.has_workspace_role(id, array['owner', 'admin']))
  with check (private.has_workspace_role(id, array['owner', 'admin']));

create policy workspace_members_select on public.workspace_members for select to authenticated
  using (workspace_id in (select private.user_workspace_ids()));

-- Read access for members on every workspace-scoped table.
do $$
declare t text;
begin
  foreach t in array array[
    'campaigns', 'candidates', 'applications', 'campaign_channel_results', 'workspace_metrics',
    'analytics_months', 'agent_weeks', 'bottleneck_alerts', 'healing_records', 'agent_settings',
    'agent_stats', 'agent_events', 'agent_actions'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (workspace_id in (select private.user_workspace_ids()))',
      t || '_select', t
    );
  end loop;
end
$$;

-- Writes members make directly (HR actions in the app). Agent and system writes use the secret key.
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (workspace_id in (select private.user_workspace_ids()));
create policy campaigns_update on public.campaigns for update to authenticated
  using (workspace_id in (select private.user_workspace_ids()))
  with check (workspace_id in (select private.user_workspace_ids()));
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy applications_update on public.applications for update to authenticated
  using (workspace_id in (select private.user_workspace_ids()))
  with check (workspace_id in (select private.user_workspace_ids()));

create policy bottleneck_alerts_update on public.bottleneck_alerts for update to authenticated
  using (workspace_id in (select private.user_workspace_ids()))
  with check (workspace_id in (select private.user_workspace_ids()));

create policy agent_settings_insert on public.agent_settings for insert to authenticated
  with check (workspace_id in (select private.user_workspace_ids()));
create policy agent_settings_update on public.agent_settings for update to authenticated
  using (workspace_id in (select private.user_workspace_ids()))
  with check (workspace_id in (select private.user_workspace_ids()));

-- ---------------------------------------------------------------------------
-- Sessions: a user can list and revoke their own sign-ins (auth.sessions is the source of truth).
-- ---------------------------------------------------------------------------

create function public.list_my_sessions()
returns table (id uuid, created_at timestamptz, refreshed_at timestamptz, user_agent text, ip text, aal text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at), s.user_agent, host(s.ip), s.aal::text
  from auth.sessions s
  where s.user_id = (select auth.uid())
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at) desc
$$;

create function public.revoke_my_session(session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.sessions where id = session_id and user_id = (select auth.uid());
  return found;
end
$$;

revoke execute on function public.list_my_sessions(), public.revoke_my_session(uuid) from public, anon;
grant execute on function public.list_my_sessions(), public.revoke_my_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard in one round trip (security invoker: RLS still applies).
-- ---------------------------------------------------------------------------

create function public.dashboard_summary(ws uuid) returns json
language sql stable security invoker set search_path = '' as $$
  with c as (select * from public.campaigns where workspace_id = ws)
  select json_build_object(
    'activeCampaigns', (select count(*) from c),
    'campaignsAtRisk', (select count(*) from c where health <> 'on_track'),
    'candidatesInPipeline', (select coalesce(sum(applicants), 0) from c),
    'newCandidatesThisWeek', coalesce(m.new_candidates_this_week, 0),
    'averageMatchRate', coalesce((select round(avg(match_rate))::int from c), 0),
    'targetMatchRate', coalesce((select round(avg(target_match_rate))::int from c), 60),
    'averageTimeToHireDays', coalesce(m.average_time_to_hire_days, 0),
    'timeToHireChangeDays', coalesce(m.time_to_hire_change_days, 0),
    'campaigns', coalesce((
      select json_agg(json_build_object(
        'id', id, 'title', title, 'department', department, 'stage', stage, 'candidates', applicants,
        'matchRate', match_rate, 'targetMatchRate', target_match_rate, 'health', health
      ) order by created_at desc)
      from c
    ), '[]'::json)
  )
  from (select 1) as one
  left join public.workspace_metrics m on m.workspace_id = ws
$$;

grant execute on function public.dashboard_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: private broadcast per workspace (agent activity and operations action updates).
-- ---------------------------------------------------------------------------

create function private.broadcast_agent_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id::text, 'at', new.at, 'campaignId', new.campaign_id,
      'kind', new.kind, 'actor', new.actor
    ) || new.payload,
    'agent_event',
    'workspace:' || new.workspace_id::text,
    true
  );
  return null;
end
$$;

create trigger agent_events_broadcast after insert on public.agent_events
  for each row execute function private.broadcast_agent_event();

create function private.broadcast_agent_action() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'kind', new.kind, 'status', new.status, 'simulated', new.simulated,
                       'candidateId', new.candidate_id, 'updatedAt', new.updated_at),
    'action_updated',
    'workspace:' || new.workspace_id::text,
    true
  );
  return null;
end
$$;

create trigger agent_actions_broadcast after insert or update of status on public.agent_actions
  for each row execute function private.broadcast_agent_action();

create policy workspace_members_receive_broadcasts on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in (
      select 'workspace:' || ws::text from private.user_workspace_ids() as ws
    )
  );
