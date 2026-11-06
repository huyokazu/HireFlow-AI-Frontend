import type { Localized } from '../i18n/types';

export type CampaignHealth = 'on_track' | 'at_risk' | 'blocked';

export type CampaignStage = 'sourcing' | 'screening' | 'interviewing' | 'offer';

export type CampaignSummary = {
  id: string;
  title: Localized;
  department: Localized;
  /** Current pipeline stage; the label comes from the dictionary. */
  stage: CampaignStage;
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
  campaigns: [
    {
      id: 'senior-frontend-engineer',
      title: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
      department: { en: 'Engineering', vi: 'Kỹ thuật' },
      stage: 'screening',
      candidates: 64,
      matchRate: 42,
      targetMatchRate: 60,
      health: 'at_risk',
    },
    {
      id: 'product-designer',
      title: { en: 'Product Designer', vi: 'Nhà thiết kế sản phẩm' },
      department: { en: 'Design', vi: 'Thiết kế' },
      stage: 'interviewing',
      candidates: 41,
      matchRate: 71,
      targetMatchRate: 60,
      health: 'on_track',
    },
    {
      id: 'data-engineer',
      title: { en: 'Data Engineer', vi: 'Kỹ sư dữ liệu' },
      department: { en: 'Data', vi: 'Dữ liệu' },
      stage: 'sourcing',
      candidates: 18,
      matchRate: 33,
      targetMatchRate: 55,
      health: 'blocked',
    },
    {
      id: 'customer-success-lead',
      title: { en: 'Customer Success Lead', vi: 'Trưởng nhóm Chăm sóc khách hàng' },
      department: { en: 'Operations', vi: 'Vận hành' },
      stage: 'offer',
      candidates: 27,
      matchRate: 78,
      targetMatchRate: 65,
      health: 'on_track',
    },
    {
      id: 'backend-engineer-go',
      title: { en: 'Backend Engineer (Go)', vi: 'Kỹ sư Backend (Go)' },
      department: { en: 'Engineering', vi: 'Kỹ thuật' },
      stage: 'screening',
      candidates: 52,
      matchRate: 74,
      targetMatchRate: 60,
      health: 'on_track',
    },
    {
      id: 'hr-business-partner',
      title: { en: 'HR Business Partner', vi: 'Chuyên viên HRBP' },
      department: { en: 'Operations', vi: 'Vận hành' },
      stage: 'interviewing',
      candidates: 46,
      matchRate: 82,
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
