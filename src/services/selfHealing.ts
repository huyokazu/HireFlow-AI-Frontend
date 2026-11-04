import type { Localized } from '../i18n/types';

export type AlertSeverity = 'critical' | 'warning';

export type ImpactLevel = 'high' | 'medium' | 'low';

export type RootCauseFactor = {
  id: string;
  label: Localized;
  detail: Localized;
  impact: ImpactLevel;
};

export type SuggestedFix = {
  id: string;
  /** Short verb phrase used on the approve button, e.g. "Expand Salary Range". */
  actionLabel: Localized;
  description: Localized;
  /** Hiring Digital Twin forecast: percentage points added to the match rate. */
  expectedLift: number;
  recommended?: boolean;
};

export type BottleneckAlert = {
  id: string;
  severity: AlertSeverity;
  title: Localized;
  campaignName: Localized;
  /** ISO timestamp. */
  detectedAt: string;
  metric: {
    label: Localized;
    /** Percentages, 0–100. */
    current: number;
    target: number;
  };
  rootCause: {
    summary: Localized;
    /** 0–100. */
    confidence: number;
    factors: RootCauseFactor[];
  };
  suggestedFixes: SuggestedFix[];
};

const MOCK_ALERTS: BottleneckAlert[] = [
  {
    id: 'alert_matching_rate',
    severity: 'critical',
    title: {
      en: 'Candidate matching rate is 30% below target',
      vi: 'Tỷ lệ ứng viên phù hợp thấp hơn mục tiêu 30%',
    },
    campaignName: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
    detectedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    metric: {
      label: { en: 'Candidate match rate', vi: 'Tỷ lệ ứng viên phù hợp' },
      current: 42,
      target: 60,
    },
    rootCause: {
      summary: {
        en: 'Strong applicants are dropping out at the offer-fit stage. The salary band and experience bar are filtering out most of the qualified pool.',
        vi: 'Các ứng viên tốt đang rời quy trình ở bước đánh giá mức độ phù hợp với offer. Khung lương và yêu cầu kinh nghiệm đang loại phần lớn nguồn ứng viên đủ tiêu chuẩn.',
      },
      confidence: 87,
      factors: [
        {
          id: 'salary',
          label: { en: 'Salary range below market', vi: 'Khung lương thấp hơn thị trường' },
          detail: {
            en: 'Top of band is 18% under the median for this role and region.',
            vi: 'Mức trần của khung lương thấp hơn 18% so với mức trung vị của vị trí và khu vực này.',
          },
          impact: 'high',
        },
        {
          id: 'experience',
          label: { en: 'Experience requirement too strict', vi: 'Yêu cầu kinh nghiệm quá khắt khe' },
          detail: {
            en: '"7+ years" removes 45% of otherwise qualified applicants.',
            vi: 'Điều kiện "7+ năm" loại bỏ 45% ứng viên vốn đủ tiêu chuẩn.',
          },
          impact: 'medium',
        },
        {
          id: 'channels',
          label: { en: 'Limited sourcing channels', vi: 'Kênh tìm nguồn còn hạn chế' },
          detail: {
            en: 'The job is live on 2 of the 5 channels that performed best last quarter.',
            vi: 'Tin tuyển dụng mới có mặt trên 2 trong 5 kênh hiệu quả nhất quý trước.',
          },
          impact: 'low',
        },
      ],
    },
    suggestedFixes: [
      {
        id: 'fix_salary',
        actionLabel: { en: 'Expand Salary Range', vi: 'Mở rộng khung lương' },
        description: {
          en: 'Raise the band from $115k–$135k to $130k–$155k.',
          vi: 'Nâng khung lương từ $115k–$135k lên $130k–$155k.',
        },
        expectedLift: 22,
        recommended: true,
      },
      {
        id: 'fix_experience',
        actionLabel: { en: 'Relax Experience Requirement', vi: 'Nới lỏng yêu cầu kinh nghiệm' },
        description: {
          en: 'Lower the requirement from 7+ to 5+ years.',
          vi: 'Giảm yêu cầu từ 7+ năm xuống 5+ năm.',
        },
        expectedLift: 15,
      },
      {
        id: 'fix_channels',
        actionLabel: { en: 'Add Sourcing Channels', vi: 'Bổ sung kênh tìm nguồn' },
        description: {
          en: 'Publish to LinkedIn and Wellfound in addition to current boards.',
          vi: 'Đăng thêm lên LinkedIn và Wellfound bên cạnh các kênh hiện tại.',
        },
        expectedLift: 8,
      },
    ],
  },
];

/**
 * Open alerts raised by the Self-Healing monitor for a campaign.
 * Mock implementation: replace with a Supabase query, or subscribe to inserts on the alerts
 * table with Realtime so new bottlenecks pop up as soon as the Orchestrator Agent detects them.
 */
export async function fetchActiveBottleneckAlerts(_campaignId: string): Promise<BottleneckAlert[]> {
  return MOCK_ALERTS;
}

/**
 * Tells the Orchestrator Agent to apply the fix HR approved.
 * Mock implementation: replace with a call to the Orchestrator Agent API.
 */
export async function approveSuggestedFix(_alertId: string, _fixId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
}
