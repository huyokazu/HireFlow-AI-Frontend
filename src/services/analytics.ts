import type { SourcingChannel } from './campaigns';
import { fetchDashboardSummary, type CampaignSummary } from './dashboard';
import { PIPELINE_STAGES, type PipelineCandidate, type PipelineStage } from './pipeline';

/** Hiring results for one calendar month. */
export type HiringMonth = {
  /** Midnight on the month's first day, as an ISO timestamp. */
  start: string;
  /** Offers accepted that month, closed campaigns included. */
  hires: number;
  /** Average days from application to accepted offer, for that month's hires. */
  timeToHireDays: number;
};

/** Applicants one sourcing channel brought in, and how many of them passed AI screening. */
export type ChannelResult = {
  channel: SourcingChannel;
  applicants: number;
  qualified: number;
};

/** What happened to a live campaign's applicants, beyond what the board shows. */
export type CampaignResults = {
  campaignId: string;
  /** By the channel each applicant came from; they add up to the campaign's candidates. */
  channels: ChannelResult[];
  /** Candidates who left (declined or withdrew) after an interview or an offer; they're off the board. */
  droppedOut: { afterInterview: number; afterOffer: number };
};

/** Recruiter hours the agents saved in one week. */
export type AgentWeek = {
  /** Midnight on the week's Monday, as an ISO timestamp. */
  start: string;
  hoursSaved: number;
};

export type HiringAnalytics = {
  /**
   * The last six months, oldest first; the last one is the current month. Its hires count closed
   * campaigns only: hires in live campaigns are on the board (see `withBoardHires`).
   */
  months: HiringMonth[];
  /** Hires in the six months before those. */
  hiresPreviousPeriod: number;
  campaigns: CampaignResults[];
  /** The weeks before this one, oldest first. This week's hours come from the agents' live numbers. */
  agentWeeks: AgentWeek[];
  /** Midnight on this week's Monday, as an ISO timestamp. */
  currentWeekStart: string;
};

/** Funnel stages, in order. `qualified` means the Matching Agent passed the CV. */
export const FUNNEL_STAGES = ['applied', 'qualified', 'interview', 'offer', 'hired'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export type FunnelCounts = Record<FunnelStage, number>;

// Each campaign's channels add up to its candidates on the dashboard, and their qualified
// applicants to its match rate (see `qualifiedCandidates`): 248 applicants, 159 qualified, 64%.
// Every channel is one the campaign sources from, and the stories match the Self-Healing alerts.
const MOCK_CAMPAIGN_RESULTS: CampaignResults[] = [
  {
    campaignId: 'senior-frontend-engineer',
    channels: [
      { channel: 'itviec', applicants: 38, qualified: 17 },
      { channel: 'topcv', applicants: 26, qualified: 10 },
    ],
    // A finalist turned the offer down over the salary band.
    droppedOut: { afterInterview: 5, afterOffer: 1 },
  },
  {
    campaignId: 'product-designer',
    channels: [
      { channel: 'linkedin', applicants: 22, qualified: 16 },
      { channel: 'topcv', applicants: 12, qualified: 7 },
      { channel: 'referrals', applicants: 7, qualified: 6 },
    ],
    droppedOut: { afterInterview: 3, afterOffer: 0 },
  },
  {
    // Every applicant so far came from TopCV, and none has reached an interview.
    campaignId: 'data-engineer',
    channels: [{ channel: 'topcv', applicants: 18, qualified: 6 }],
    droppedOut: { afterInterview: 0, afterOffer: 0 },
  },
  {
    campaignId: 'customer-success-lead',
    channels: [
      { channel: 'linkedin', applicants: 11, qualified: 9 },
      { channel: 'vietnamworks', applicants: 7, qualified: 5 },
      { channel: 'referrals', applicants: 5, qualified: 5 },
      { channel: 'topcv', applicants: 4, qualified: 2 },
    ],
    // An offer declined before the remote option was added.
    droppedOut: { afterInterview: 4, afterOffer: 1 },
  },
  {
    // ITviec was the top source of qualified Go applicants; referrals stopped after week one.
    campaignId: 'backend-engineer-go',
    channels: [
      { channel: 'itviec', applicants: 20, qualified: 16 },
      { channel: 'linkedin', applicants: 22, qualified: 14 },
      { channel: 'referrals', applicants: 10, qualified: 8 },
    ],
    droppedOut: { afterInterview: 2, afterOffer: 0 },
  },
  {
    campaignId: 'hr-business-partner',
    channels: [
      { channel: 'linkedin', applicants: 18, qualified: 15 },
      { channel: 'vietnamworks', applicants: 11, qualified: 10 },
      { channel: 'topcv', applicants: 10, qualified: 7 },
      { channel: 'referrals', applicants: 7, qualified: 6 },
    ],
    droppedOut: { afterInterview: 3, afterOffer: 0 },
  },
];

/** Hires five months ago through last month. */
const PAST_MONTH_HIRES = [3, 4, 3, 5, 4];
/** Average time to hire five months ago through two months ago; the dashboard has the last two. */
const EARLIER_TIME_TO_HIRE = [31, 30, 28, 27];
/** Hires this month in campaigns that have since closed. */
const CLOSED_CAMPAIGN_HIRES_THIS_MONTH = 0;
const HIRES_PREVIOUS_PERIOD = 15;
/** Recruiter hours the agents saved five weeks ago through last week. */
const AGENT_HOURS_BY_WEEK = [29, 33, 37, 41, 44];

/**
 * Hiring results over time and per live campaign, for the Analytics page.
 * Mock implementation: replace with Supabase views over the applications and hires tables, and
 * the Orchestrator's weekly agent_stats rollup.
 */
export async function fetchHiringAnalytics(): Promise<HiringAnalytics> {
  // This month's and last month's time to hire are the dashboard's, so the two pages agree.
  const summary = await fetchDashboardSummary();
  const timeToHire = [
    ...EARLIER_TIME_TO_HIRE,
    summary.averageTimeToHireDays - summary.timeToHireChangeDays,
    summary.averageTimeToHireDays,
  ];
  const hires = [...PAST_MONTH_HIRES, CLOSED_CAMPAIGN_HIRES_THIS_MONTH];
  const now = new Date();
  const months = timeToHire.map((timeToHireDays, index) => ({
    start: new Date(now.getFullYear(), now.getMonth() - (timeToHire.length - 1 - index), 1).toISOString(),
    hires: hires[index],
    timeToHireDays,
  }));

  // Weeks start on Monday.
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const agentWeeks = AGENT_HOURS_BY_WEEK.map((hoursSaved, index) => ({
    start: new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() - 7 * (AGENT_HOURS_BY_WEEK.length - index),
    ).toISOString(),
    hoursSaved,
  }));

  return {
    months,
    hiresPreviousPeriod: HIRES_PREVIOUS_PERIOD,
    campaigns: MOCK_CAMPAIGN_RESULTS,
    agentWeeks,
    currentWeekStart: monday.toISOString(),
  };
}

/** A campaign's match rate as a number of candidates: the ones who passed AI screening. */
export function qualifiedCandidates(campaign: CampaignSummary): number {
  return Math.round((campaign.candidates * campaign.matchRate) / 100);
}

/**
 * How many of these campaigns' candidates reached each stage, counting those who dropped out later.
 * Mock implementation: the Orchestrator would count this from the applications table. Here it comes
 * from the campaigns' numbers, the board (live, so moving a card shows up at once) and the drop-outs.
 */
export function buildFunnel(
  campaigns: CampaignSummary[],
  board: PipelineCandidate[],
  results: CampaignResults[],
): FunnelCounts {
  const ids = new Set(campaigns.map((campaign) => campaign.id));
  const onBoard = board.filter((candidate) => ids.has(candidate.campaignId));
  const reached = (stage: PipelineStage) =>
    onBoard.filter((candidate) => PIPELINE_STAGES.indexOf(candidate.stage) >= PIPELINE_STAGES.indexOf(stage)).length;
  const dropped = results.filter((result) => ids.has(result.campaignId));
  const afterInterview = sum(dropped.map((result) => result.droppedOut.afterInterview));
  const afterOffer = sum(dropped.map((result) => result.droppedOut.afterOffer));

  return {
    applied: sum(campaigns.map((campaign) => campaign.candidates)),
    qualified: sum(campaigns.map(qualifiedCandidates)),
    interview: reached('interview') + afterInterview + afterOffer,
    offer: reached('offer') + afterOffer,
    hired: reached('hired'),
  };
}

/** Applicants and qualified applicants per channel across these campaigns, most qualified first. */
export function totalsByChannel(results: CampaignResults[], campaignIds: string[]): ChannelResult[] {
  const ids = new Set(campaignIds);
  const totals = new Map<SourcingChannel, ChannelResult>();
  for (const result of results) {
    if (!ids.has(result.campaignId)) continue;
    for (const { channel, applicants, qualified } of result.channels) {
      const total = totals.get(channel) ?? { channel, applicants: 0, qualified: 0 };
      totals.set(channel, {
        channel,
        applicants: total.applicants + applicants,
        qualified: total.qualified + qualified,
      });
    }
  }
  return [...totals.values()]
    .filter((total) => total.applicants > 0)
    .sort((a, b) => b.qualified - a.qualified || b.qualified / b.applicants - a.qualified / a.applicants);
}

/**
 * The months with the board's hires added to the current one. The board is the live record of
 * hires in running campaigns; they all happened in the last few days, and a card moved to Hired
 * lands today.
 */
export function withBoardHires(months: HiringMonth[], board: PipelineCandidate[]): HiringMonth[] {
  const hiredOnBoard = board.filter((candidate) => candidate.stage === 'hired').length;
  return months.map((month, index) =>
    index === months.length - 1 ? { ...month, hires: month.hires + hiredOnBoard } : month,
  );
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
