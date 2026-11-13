-- Column-level write privileges. RLS decides which rows a member may write, not which columns, and
-- Supabase grants every column to `authenticated` by default. A member holding their own token
-- could otherwise PostgREST-update agent-owned columns (match scores, campaign health, alert
-- content) or forge audit columns (decided_by, created_by, profile email).
--
-- Members keep exactly the column writes the API makes with their token. Every other write goes
-- through the server's secret key, after the API has checked membership.

revoke insert, update on
  public.profiles, public.workspaces, public.campaigns, public.applications,
  public.bottleneck_alerts, public.agent_settings
from anon, authenticated;

-- PATCH /api/me. Email mirrors auth.users and is not editable here.
grant update (display_name, locale, timezone, default_workspace_id) on public.profiles to authenticated;

-- PUT /api/campaigns/:id/setup. Launching a campaign is a server write (created_by is trusted there).
grant update (setup, target_match_rate) on public.campaigns to authenticated;

-- PATCH /api/pipeline/:candidateId. Scores and assessments belong to the Matching Agent.
grant update (stage, stage_entered_at) on public.applications to authenticated;

-- Dismiss and reopen. The trigger below makes the decision columns tamper-proof.
grant update (status, approved_fix_id, decided_at, decided_by) on public.bottleneck_alerts to authenticated;

-- agent_settings and workspaces: no member writes (pausing agents is a server write).

-- With their token a member can only dismiss an open alert or reopen a dismissed one (approving
-- goes through approve_alert_fix). The decision is always recorded as theirs, at the database's
-- clock, whatever the request sent.
create function private.stamp_alert_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if (old.status, new.status) not in (('open', 'dismissed'), ('dismissed', 'open')) then
      raise exception 'Members can only dismiss or reopen alerts' using errcode = '42501';
    end if;
    new.approved_fix_id := null;
    if new.status = 'open' then
      new.decided_at := null;
      new.decided_by := null;
    else
      new.decided_at := now();
      new.decided_by := (select auth.uid());
    end if;
  end if;
  return new;
end
$$;

create trigger bottleneck_alerts_stamp_decision before update on public.bottleneck_alerts
  for each row execute function private.stamp_alert_decision();

-- ---------------------------------------------------------------------------
-- Approving a fix, as one transaction: decide the alert (only if still open), apply the fix's
-- setup change, write the audit record and log `fixApplied`. Either all of it happens or none.
-- Server-only: the API checks membership and validates the patched setup before calling it.
-- ---------------------------------------------------------------------------

create function public.approve_alert_fix(
  ws uuid,
  alert_id text,
  fix_id text,
  fix_label jsonb,
  setup_patch jsonb,
  record jsonb,
  actor uuid
) returns json
language plpgsql security definer set search_path = '' as $$
declare
  alert public.bottleneck_alerts;
  event public.agent_events;
begin
  update public.bottleneck_alerts
  set status = 'approved', approved_fix_id = fix_id, decided_at = now(), decided_by = actor
  where id = alert_id and workspace_id = ws and status = 'open'
  returning * into alert;
  -- Missing or already decided: the caller tells the two apart.
  if not found then
    return null;
  end if;

  if setup_patch is not null then
    -- Top-level merge, like `{ ...setup, ...patch }`; a campaign without a setup keeps none.
    update public.campaigns
    set setup = setup || setup_patch,
        target_match_rate = coalesce((setup_patch ->> 'targetMatchRate')::int, target_match_rate)
    where id = alert.campaign_id and workspace_id = ws and setup is not null;
  end if;

  insert into public.healing_records (workspace_id, campaign_id, alert_id, outcome, content, at)
  values (ws, alert.campaign_id, alert.id, 'in_progress', record, alert.decided_at);

  insert into public.agent_events (workspace_id, campaign_id, kind, actor, payload)
  values (ws, alert.campaign_id, 'fixApplied', 'orchestrator', jsonb_build_object('fix', fix_label))
  returning * into event;

  return json_build_object('alert', to_json(alert), 'event', to_json(event));
end
$$;

revoke execute on function public.approve_alert_fix(uuid, text, text, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.approve_alert_fix(uuid, text, text, jsonb, jsonb, jsonb, uuid) to service_role;
