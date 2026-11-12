import 'server-only';

import { unwrap } from '@/lib/api/http';
import type { CampaignResults, HiringAnalytics, SourcingChannel } from '@/lib/contracts';
import type { Db } from '@/lib/supabase/server';

import { MAX_LIST_ROWS } from './constants';
import { getWorkspaceMetrics } from './queries';
import { rowsOf } from './result';

/** Months on the hiring trend, the current one last. */
const MONTHS = 6;
/** Weeks before the current one on the agent-impact chart (the current week comes from live stats). */
const PAST_WEEKS = 5;
const DAY = 24 * 60 * 60 * 1000;

/** A calendar date stored as `date`, as the midnight ISO timestamp the app expects. */
const dateToIso = (date: string) => `${date}T00:00:00.000Z`;

/** Today's calendar date (YYYY-MM-DD) in the user's time zone; UTC if the zone is unknown. */
function todayIn(timeZone: string, now: Date): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return format(timeZone);
  } catch {
    return format('UTC');
  }
}

/** Monday of the current week (weeks start on Monday) as a calendar date. */
export function currentMonday(timeZone: string, now = new Date()): string {
  const today = new Date(dateToIso(todayIn(timeZone, now)));
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - sinceMonday * DAY).toISOString().slice(0, 10);
}

export async function getAnalytics(db: Db, workspaceId: string, userId: string): Promise<HiringAnalytics> {
  const [months, campaigns, weeks, metrics, profile] = await Promise.all([
    db
      .from('analytics_months')
      .select('month_start, hires, time_to_hire_days')
      .eq('workspace_id', workspaceId)
      .order('month_start', { ascending: false })
      .limit(MONTHS),
    db
      .from('campaigns')
      .select('id, dropped_after_interview, dropped_after_offer, channels:campaign_channel_results(channel, applicants, qualified)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_ROWS),
    db
      .from('agent_weeks')
      .select('week_start, hours_saved')
      .eq('workspace_id', workspaceId)
      .order('week_start', { ascending: false })
      // One extra row in case the rollup already wrote the current week.
      .limit(PAST_WEEKS + 1),
    getWorkspaceMetrics(db, workspaceId),
    db.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
  ]);

  const monday = currentMonday(unwrap(profile)?.timezone ?? 'UTC');
  return {
    months: rowsOf(months)
      .reverse()
      .map((row) => ({ start: dateToIso(row.month_start), hires: row.hires, timeToHireDays: Number(row.time_to_hire_days) })),
    hiresPreviousPeriod: metrics?.hires_previous_period ?? 0,
    campaigns: rowsOf(campaigns).map(
      (row): CampaignResults => ({
        campaignId: row.id,
        channels: row.channels
          .map((channel) => ({
            channel: channel.channel as SourcingChannel,
            applicants: channel.applicants,
            qualified: channel.qualified,
          }))
          .sort((a, b) => b.applicants - a.applicants),
        droppedOut: { afterInterview: row.dropped_after_interview, afterOffer: row.dropped_after_offer },
      }),
    ),
    agentWeeks: rowsOf(weeks)
      .filter((row) => row.week_start < monday)
      .slice(0, PAST_WEEKS)
      .reverse()
      .map((row) => ({ start: dateToIso(row.week_start), hoursSaved: Number(row.hours_saved) })),
    currentWeekStart: dateToIso(monday),
  };
}
