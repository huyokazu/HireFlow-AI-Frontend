/**
 * Creates (or refreshes) the demo account and fills its workspace with the same data the Expo app
 * shows in mock mode, read straight from src/services so the two never drift.
 *
 *   npm run seed:demo                         # local stack, uses .env.local
 *   DEMO_EMAIL=... DEMO_PASSWORD=... npm run seed:demo
 *
 * Destructive for the demo workspace only: it deletes that workspace's rows before inserting.
 * Timestamps are relative to "now", so re-run it shortly before a live demo.
 */
import { createClient } from '@supabase/supabase-js';

import { fetchAgentWorkspace, AGENT_KEYS } from '../../src/services/agents';
import { fetchHiringAnalytics } from '../../src/services/analytics';
import { fetchCampaignSetups } from '../../src/services/campaigns';
import { fetchDashboardSummary } from '../../src/services/dashboard';
import { fetchPipeline } from '../../src/services/pipeline';
import { fetchActiveBottleneckAlerts, fetchHealingHistory } from '../../src/services/selfHealing';
import type { Database, Json } from '../src/lib/supabase/database.types';

const DAY = 24 * 60 * 60 * 1000;

const url = need('SUPABASE_URL');
const secret = need('SUPABASE_SECRET_KEY');
const email = process.env.DEMO_EMAIL ?? 'demo@hireflow.local';
const password = process.env.DEMO_PASSWORD ?? 'hireflow-demo-2026';

const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} (run with --env-file=.env.local)`);
  return value;
}

function check<R extends { data: unknown; error: unknown }>(result: R, step: string): NonNullable<R['data']> {
  if (result.error) throw new Error(`${step}: ${JSON.stringify(result.error)}`);
  return result.data as NonNullable<R['data']>;
}

/** The calendar date of a local-midnight ISO timestamp (the mocks build dates in local time). */
function localDate(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Safe, non-routable address (RFC 2606), so a demo never emails a real person by accident. */
function demoEmail(name: string): string {
  const local = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${local}@example.com`;
}

async function findOrCreateUser(): Promise<string> {
  for (let page = 1; ; page += 1) {
    const { users } = check(await admin.auth.admin.listUsers({ page, perPage: 200 }), 'list users');
    const found = users.find((user) => user.email === email);
    if (found) {
      check(await admin.auth.admin.updateUserById(found.id, { password }), 'reset demo password');
      return found.id;
    }
    if (users.length < 200) break;
  }
  const { user } = check(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'HireFlow Demo' },
    }),
    'create demo user',
  );
  if (!user) throw new Error("create demo user returned no user");
  return user.id;
}

async function main() {
  const userId = await findOrCreateUser();
  const profile = check(
    await admin.from('profiles').select('default_workspace_id').eq('id', userId).single(),
    'load profile',
  );
  const ws = profile.default_workspace_id;
  if (!ws) throw new Error('Demo user has no workspace');

  check(await admin.from('workspaces').update({ name: 'HireFlow Demo', auto_approve_interviews: true }).eq('id', ws), 'name workspace');

  // Clear the demo workspace (campaign deletes cascade to applications, alerts, channel results).
  for (const table of [
    'agent_actions', 'agent_events', 'agent_stats', 'agent_settings', 'healing_records', 'analytics_months',
    'agent_weeks', 'workspace_metrics', 'campaigns', 'candidates',
  ] as const) {
    check(await admin.from(table).delete().eq('workspace_id', ws), `clear ${table}`);
  }

  const [summary, setups, analytics, pipeline, alerts, history, agents] = await Promise.all([
    fetchDashboardSummary(),
    fetchCampaignSetups(),
    fetchHiringAnalytics(),
    fetchPipeline(),
    fetchActiveBottleneckAlerts(),
    fetchHealingHistory(),
    fetchAgentWorkspace(),
  ]);
  const now = Date.now();
  const results = new Map(analytics.campaigns.map((result) => [result.campaignId, result]));

  check(
    await admin.from('campaigns').insert(
      summary.campaigns.map((campaign, index) => ({
        id: campaign.id,
        workspace_id: ws,
        title: campaign.title,
        department: campaign.department,
        stage: campaign.stage,
        applicants: campaign.candidates,
        match_rate: campaign.matchRate,
        target_match_rate: campaign.targetMatchRate,
        health: campaign.health,
        setup: (setups[campaign.id] ?? null) as Json,
        dropped_after_interview: results.get(campaign.id)?.droppedOut.afterInterview ?? 0,
        dropped_after_offer: results.get(campaign.id)?.droppedOut.afterOffer ?? 0,
        created_by: userId,
        // Keeps the mock's order: the first campaign is the newest.
        created_at: new Date(now - (index + 1) * DAY).toISOString(),
      })),
    ),
    'insert campaigns',
  );

  check(
    await admin.from('campaign_channel_results').insert(
      analytics.campaigns.flatMap((result) =>
        result.channels.map((channel) => ({
          workspace_id: ws,
          campaign_id: result.campaignId,
          channel: channel.channel,
          applicants: channel.applicants,
          qualified: channel.qualified,
        })),
      ),
    ),
    'insert channel results',
  );

  const candidates = new Map(pipeline.map((candidate) => [candidate.id, candidate]));
  check(
    await admin.from('candidates').insert(
      [...candidates.values()].map((candidate) => ({
        id: candidate.id,
        workspace_id: ws,
        name: candidate.name,
        email: demoEmail(candidate.name),
        role: candidate.role,
        location: candidate.location,
        years_of_experience: candidate.yearsOfExperience,
        skills: candidate.skills,
      })),
    ),
    'insert candidates',
  );
  check(
    await admin.from('applications').insert(
      pipeline.map((candidate, index) => ({
        workspace_id: ws,
        campaign_id: candidate.campaignId,
        candidate_id: candidate.id,
        stage: candidate.stage,
        // Seconds keep the mock's board order among cards with the same days in stage.
        stage_entered_at: new Date(now - candidate.daysInStage * DAY - index * 1000).toISOString(),
        match_score: candidate.matchScore,
        ai_assessment: candidate.aiAssessment,
      })),
    ),
    'insert applications',
  );

  check(
    await admin.from('bottleneck_alerts').insert(
      alerts.map(({ id, campaignId, severity, detectedAt, ...content }) => ({
        id,
        workspace_id: ws,
        campaign_id: campaignId,
        severity,
        detected_at: detectedAt,
        content: content as NonNullable<Json>,
      })),
    ),
    'insert alerts',
  );
  check(
    await admin.from('healing_records').insert(
      history.map(({ id, campaignId, outcome, at, alertId: _alertId, ...content }) => ({
        id,
        workspace_id: ws,
        campaign_id: campaignId,
        outcome,
        at,
        content: content as NonNullable<Json>,
      })),
    ),
    'insert healing history',
  );

  check(
    await admin.from('agent_stats').insert(
      AGENT_KEYS.map((agent) => ({
        workspace_id: ws,
        agent_key: agent,
        done_today: agents.stats[agent].doneToday,
        queued: agents.stats[agent].queued,
        agreement_rate: agents.stats[agent].agreementRate,
        median_seconds: agents.stats[agent].medianSeconds,
        last_active_at: agents.stats[agent].lastActiveAt,
      })),
    ),
    'insert agent stats',
  );
  check(
    await admin.from('agent_settings').insert(AGENT_KEYS.map((agent) => ({ workspace_id: ws, agent_key: agent, paused: false }))),
    'insert agent settings',
  );
  check(
    await admin.from('agent_events').insert(
      [...agents.events].reverse().map(({ id: _id, at, kind, actor, campaignId, ...payload }) => ({
        workspace_id: ws,
        at,
        kind,
        actor,
        campaign_id: campaignId ?? null,
        payload: payload as NonNullable<Json>,
      })),
    ),
    'insert agent events',
  );

  check(
    await admin.from('workspace_metrics').insert({
      workspace_id: ws,
      new_candidates_this_week: summary.newCandidatesThisWeek,
      average_time_to_hire_days: summary.averageTimeToHireDays,
      time_to_hire_change_days: summary.timeToHireChangeDays,
      hires_previous_period: analytics.hiresPreviousPeriod,
      tasks_yesterday: agents.tasksYesterday,
      hours_saved_before_today: agents.hoursSavedBeforeToday,
    }),
    'insert metrics',
  );
  check(
    await admin.from('analytics_months').insert(
      analytics.months.map((month) => ({
        workspace_id: ws,
        month_start: localDate(month.start),
        hires: month.hires,
        time_to_hire_days: month.timeToHireDays,
      })),
    ),
    'insert analytics months',
  );
  check(
    await admin.from('agent_weeks').insert(
      analytics.agentWeeks.map((week) => ({ workspace_id: ws, week_start: localDate(week.start), hours_saved: week.hoursSaved })),
    ),
    'insert agent weeks',
  );

  console.log(
    `Seeded workspace ${ws} for ${email}: ${summary.campaigns.length} campaigns, ${candidates.size} candidates, ` +
      `${pipeline.length} applications, ${alerts.length} alerts, ${agents.events.length} events.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
