export type CampaignHealth = 'on_track' | 'at_risk' | 'blocked';

export type CampaignSummary = {
  id: string;
  title: string;
  department: string;
  /** Current pipeline stage, e.g. "Screening". */
  stage: string;
  candidates: number;
  /** Percentages, 0–100. */
  matchRate: number;
  targetMatchRate: number;
  health: CampaignHealth;
};

export type DashboardSummary = {
  activeCampaigns: number;
  campaignsAtRisk: number;
  candidatesInPipeline: number;
  newCandidatesThisWeek: number;
  averageMatchRate: number;
  targetMatchRate: number;
  averageTimeToHireDays: number;
  /** Negative means faster than last month. */
  timeToHireChangeDays: number;
  agentsOnline: number;
  campaigns: CampaignSummary[];
};

const MOCK_SUMMARY: DashboardSummary = {
  activeCampaigns: 6,
  campaignsAtRisk: 2,
  candidatesInPipeline: 248,
  newCandidatesThisWeek: 32,
  averageMatchRate: 64,
  targetMatchRate: 60,
  averageTimeToHireDays: 23,
  timeToHireChangeDays: -3,
  agentsOnline: 4,
  campaigns: [
    {
      id: 'senior-frontend-engineer',
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      stage: 'Screening',
      candidates: 64,
      matchRate: 42,
      targetMatchRate: 60,
      health: 'at_risk',
    },
    {
      id: 'product-designer',
      title: 'Product Designer',
      department: 'Design',
      stage: 'Interviewing',
      candidates: 41,
      matchRate: 71,
      targetMatchRate: 60,
      health: 'on_track',
    },
    {
      id: 'data-engineer',
      title: 'Data Engineer',
      department: 'Data',
      stage: 'Sourcing',
      candidates: 18,
      matchRate: 33,
      targetMatchRate: 55,
      health: 'blocked',
    },
    {
      id: 'customer-success-lead',
      title: 'Customer Success Lead',
      department: 'Operations',
      stage: 'Offer',
      candidates: 27,
      matchRate: 78,
      targetMatchRate: 65,
      health: 'on_track',
    },
  ],
};

/**
 * Headline numbers and active campaigns for the dashboard.
 * Mock implementation: replace with a Supabase view or RPC that aggregates the campaigns table.
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return MOCK_SUMMARY;
}
