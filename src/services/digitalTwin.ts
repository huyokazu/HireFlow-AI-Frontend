import type { CampaignDraft, DepartmentKey, Seniority, SourcingChannel, WorkMode } from './campaigns';

export type ForecastRiskReason = 'salary' | 'experience' | 'channels' | 'skills';
export type ForecastRiskLevel = 'low' | 'medium' | 'high';

export type CampaignForecast = {
  /** Qualified applicants expected in the first 30 days. */
  qualifiedApplicants: number;
  /** Percent, 0–100. */
  matchRate: number;
  timeToHireDays: number;
  /** Market median for this role, in thousands of USD per year. */
  marketMedian: number;
  /** Salary band midpoint against the market median, in percent (−12 means 12% under). */
  salaryGapPercent: number;
  /** Years of experience the market expects at this seniority. */
  typicalYears: number;
  risk: { level: ForecastRiskLevel; reasons: ForecastRiskReason[] };
};

/** A change the Digital Twin proposes for one risk, with the match rate it would lead to. */
export type ForecastFix = {
  reason: ForecastRiskReason;
  patch: Partial<CampaignDraft>;
  matchRate: number;
};

const MARKET_MEDIAN: Record<Seniority, number> = { junior: 70, mid: 100, senior: 135, lead: 165 };
const DEPARTMENT_PAY: Record<DepartmentKey, number> = {
  engineering: 1,
  data: 1.05,
  product: 1.05,
  design: 0.9,
  sales: 0.8,
  operations: 0.75,
};
const BASE_APPLICANTS: Record<DepartmentKey, number> = {
  engineering: 120,
  design: 80,
  data: 60,
  product: 70,
  operations: 90,
  sales: 110,
};
const SENIORITY_POOL: Record<Seniority, number> = { junior: 1.6, mid: 1.2, senior: 0.8, lead: 0.5 };
const EXPECTED_YEARS: Record<Seniority, number> = { junior: 1, mid: 3, senior: 5, lead: 8 };
const WORK_MODE_REACH: Record<WorkMode, number> = { onsite: 1, hybrid: 1.15, remote: 1.5 };
/** Channels the twin adds first when a campaign sources from too few. */
const CHANNEL_PRIORITY: readonly SourcingChannel[] = [
  'linkedin',
  'itviec',
  'topcv',
  'vietnamworks',
  'referrals',
  'wellfound',
];
const RECOMMENDED_CHANNELS = 3;
const MAX_FOCUSED_SKILLS = 6;

/**
 * Hiring Digital Twin: predicts how a campaign will perform before it goes live, so HR can fix
 * a bottleneck (like a below-market salary band) before it costs weeks.
 * Mock implementation: a small deterministic model; replace with the Digital Twin simulation API.
 */
export function forecastCampaign(draft: CampaignDraft): CampaignForecast {
  const department = draft.department ?? 'engineering';
  const marketMedian = Math.round(MARKET_MEDIAN[draft.seniority] * DEPARTMENT_PAY[department]);
  const competitiveness = (draft.salaryMin + draft.salaryMax) / 2 / marketMedian;
  const excessYears = Math.max(0, draft.minExperience - EXPECTED_YEARS[draft.seniority]);
  const channels = draft.channels.length;
  const extraSkills = Math.max(0, draft.skills.length - 5);

  const pool =
    BASE_APPLICANTS[department] *
    SENIORITY_POOL[draft.seniority] *
    WORK_MODE_REACH[draft.workMode] *
    (0.4 + 0.22 * channels) *
    Math.pow(clamp(competitiveness, 0.6, 1.4), 1.5) *
    (draft.agents.sourcing ? 1.25 : 1) /
    (1 + 0.18 * excessYears) /
    (1 + 0.08 * extraSkills);

  const matchRate =
    50 +
    (clamp(competitiveness, 0.7, 1.3) - 1) * 70 -
    excessYears * 4 -
    extraSkills * 2 +
    Math.min(channels, 5) * 1.5 +
    (draft.agents.matching ? 8 : 0);

  const timeToHire =
    34 -
    (draft.agents.scheduling ? 6 : 0) -
    (draft.agents.sourcing ? 3 : 0) -
    Math.min(channels, 5) * 1.2 +
    excessYears * 2.5 +
    (competitiveness < 0.95 ? 6 : 0) +
    (draft.headcount - 1) * 2.5;

  const reasons: ForecastRiskReason[] = [];
  if (competitiveness < 0.95) reasons.push('salary');
  if (excessYears >= 2) reasons.push('experience');
  if (channels < 2) reasons.push('channels');
  if (draft.skills.length > 7) reasons.push('skills');
  const level: ForecastRiskLevel =
    reasons.length === 0 ? 'low' : competitiveness < 0.85 || reasons.length >= 3 ? 'high' : 'medium';

  return {
    qualifiedApplicants: Math.max(0, Math.round(pool)),
    matchRate: Math.round(clamp(matchRate, 12, 94)),
    timeToHireDays: Math.round(clamp(timeToHire, 10, 75)),
    marketMedian,
    salaryGapPercent: Math.round((competitiveness - 1) * 100),
    typicalYears: EXPECTED_YEARS[draft.seniority],
    risk: { level, reasons },
  };
}

/**
 * One fix per risk the forecast found, each re-simulated so HR can see what it is worth.
 * `offset` is the campaign's calibration offset, for forecasts of live campaigns.
 * Mock implementation: replace with the Digital Twin's what-if endpoint.
 */
export function suggestForecastFixes(draft: CampaignDraft, forecast: CampaignForecast, offset = 0): ForecastFix[] {
  return forecast.risk.reasons.map((reason) => {
    const patch = fixFor(reason, draft, forecast);
    return { reason, patch, matchRate: forecastCalibrated({ ...draft, ...patch }, offset).matchRate };
  });
}

/**
 * Points to add to the model's match rate so a live campaign's current setup forecasts exactly
 * the match rate it has today. Scenarios for that campaign then shift by the same amount.
 */
export function calibrationOffset(setup: CampaignDraft, liveMatchRate: number): number {
  return liveMatchRate - forecastCampaign(setup).matchRate;
}

/**
 * Match-rate points a change to a campaign's setup is forecast to add. A campaign's calibration
 * offset shifts both forecasts alike, so it cancels out.
 */
export function matchRateLift(setup: CampaignDraft, patch: Partial<CampaignDraft>): number {
  return forecastCampaign({ ...setup, ...patch }).matchRate - forecastCampaign(setup).matchRate;
}

/** The forecast for a setup, with the match rate shifted by the campaign's calibration offset. */
export function forecastCalibrated(setup: CampaignDraft, offset: number): CampaignForecast {
  const forecast = forecastCampaign(setup);
  return { ...forecast, matchRate: Math.round(clamp(forecast.matchRate + offset, 5, 98)) };
}

/** Share of the first 30 days' qualified applicants in by the end of each week; sourcing slows after that. */
const WEEKLY_BUILD_UP = [0.2, 0.45, 0.68, 0.88, 1.03, 1.14];

/** Qualified applicants in the pipeline at the end of each of the first six weeks. */
export function projectPipeline(forecast: CampaignForecast): number[] {
  return WEEKLY_BUILD_UP.map((share) => Math.round(forecast.qualifiedApplicants * share));
}

/** The week the first hire is expected in, counting from launch (1 = the first week). */
export function hireWeek(forecast: CampaignForecast): number {
  return Math.max(1, Math.ceil(forecast.timeToHireDays / 7));
}

function fixFor(reason: ForecastRiskReason, draft: CampaignDraft, forecast: CampaignForecast): Partial<CampaignDraft> {
  switch (reason) {
    case 'salary':
      // A band around the market median: just under it to just over it.
      return {
        salaryMin: roundTo(forecast.marketMedian * 0.95, 5),
        salaryMax: roundTo(forecast.marketMedian * 1.15, 5),
      };
    case 'experience':
      return { minExperience: forecast.typicalYears };
    case 'channels': {
      const missing = CHANNEL_PRIORITY.filter((channel) => !draft.channels.includes(channel));
      return { channels: [...draft.channels, ...missing.slice(0, RECOMMENDED_CHANNELS - draft.channels.length)] };
    }
    case 'skills':
      return { skills: draft.skills.slice(0, MAX_FOCUSED_SKILLS) };
  }
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
