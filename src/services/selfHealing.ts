import type { Localized } from '../i18n/types';
import type { AgentEvent } from './agents';
import { loadBootstrap } from './bootstrap';
import { fetchCampaignSetups, type CampaignDraft } from './campaigns';
import { matchRateLift } from './digitalTwin';
import { getRemote, mockDelay, readWithFallback } from './remote';

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
  /**
   * The change to the campaign's setup, for fixes that make one (renewing a job post doesn't).
   * Approving the fix applies it, so Digital Twin scenarios start from the fixed setup.
   */
  patch?: Partial<CampaignDraft>;
};

export type BottleneckAlert = {
  id: string;
  /** The campaign the bottleneck was found in. */
  campaignId: string;
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

/** HR's decision on an alert, saved on the server so approvals and dismissals survive a reload. */
export type AlertDecision = {
  status: 'open' | 'approved' | 'dismissed';
  approvedFixId: string | null;
  /** ISO timestamp of the approval or dismissal. */
  decidedAt: string | null;
};

export type HealingOutcome = 'in_progress' | 'resolved' | 'dismissed';

/** One entry in the Self-Healing log: a fix HR approved, or an alert they set aside. */
export type HealingRecord = {
  id: string;
  /** Set when the alert is still in the workspace, so a dismissal can be undone. */
  alertId?: string;
  campaignId: string;
  campaignName: Localized;
  /** What went wrong, e.g. "Portfolio screen filtered out 60% of applicants". */
  issue: Localized;
  /** The fix that was applied; dismissed alerts have none. */
  fix?: Localized;
  outcome: HealingOutcome;
  /** ISO timestamp of the approval or dismissal. */
  at: string;
  /** The metric before and after the fix. While a fix is in progress, `after` is the forecast. */
  result?: { label: Localized; before: number; after: number };
  /** Hours from detection to resolution, for resolved records. */
  resolutionHours?: number;
};

/** Last month's average time to resolve a bottleneck, to compare this month against. */
export const PREVIOUS_RESOLUTION_HOURS = 46;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MATCH_RATE_LABEL: Localized = { en: 'Candidate match rate', vi: 'Tỷ lệ ứng viên phù hợp' };

/** A fix that changes the setup leaves its lift to the Digital Twin, so the alert and a twin scenario agree. */
type MockFix = Omit<SuggestedFix, 'expectedLift'> & { expectedLift?: number };
type MockAlert = Omit<BottleneckAlert, 'suggestedFixes'> & { suggestedFixes: MockFix[] };

const MOCK_ALERTS: MockAlert[] = [
  {
    id: 'alert_matching_rate',
    campaignId: 'senior-frontend-engineer',
    severity: 'critical',
    title: {
      en: 'Candidate matching rate is 30% below target',
      vi: 'Tỷ lệ ứng viên phù hợp thấp hơn mục tiêu 30%',
    },
    campaignName: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
    detectedAt: new Date(Date.now() - 12 * MINUTE).toISOString(),
    metric: {
      label: MATCH_RATE_LABEL,
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
          en: 'Raise the band from $90k–$110k to $130k–$155k.',
          vi: 'Nâng khung lương từ $90k–$110k lên $130k–$155k.',
        },
        patch: { salaryMin: 130, salaryMax: 155 },
        recommended: true,
      },
      {
        id: 'fix_experience',
        actionLabel: { en: 'Relax Experience Requirement', vi: 'Nới lỏng yêu cầu kinh nghiệm' },
        description: {
          en: 'Lower the requirement from 7+ to 5+ years.',
          vi: 'Giảm yêu cầu từ 7+ năm xuống 5+ năm.',
        },
        patch: { minExperience: 5 },
      },
      {
        id: 'fix_channels',
        actionLabel: { en: 'Add Sourcing Channels', vi: 'Bổ sung kênh tìm nguồn' },
        description: {
          en: 'Publish to LinkedIn and Wellfound in addition to current boards.',
          vi: 'Đăng thêm lên LinkedIn và Wellfound bên cạnh các kênh hiện tại.',
        },
        patch: { channels: ['itviec', 'topcv', 'linkedin', 'wellfound'] },
      },
    ],
  },
  {
    id: 'alert_sourcing_stalled',
    campaignId: 'data-engineer',
    severity: 'critical',
    title: {
      en: 'Sourcing has stalled: no qualified candidates in 9 days',
      vi: 'Tìm nguồn bị đình trệ: 9 ngày chưa có ứng viên đạt chuẩn',
    },
    campaignName: { en: 'Data Engineer', vi: 'Kỹ sư dữ liệu' },
    detectedAt: new Date(Date.now() - 3 * HOUR).toISOString(),
    metric: {
      label: MATCH_RATE_LABEL,
      current: 33,
      target: 55,
    },
    rootCause: {
      summary: {
        en: 'Every applicant so far came from one job board, the salary band sits well under the market, and the long must-have skill list leaves very few data engineers who qualify.',
        vi: 'Toàn bộ hồ sơ đến từ một trang tuyển dụng duy nhất, khung lương thấp hơn nhiều so với thị trường, và danh sách kỹ năng bắt buộc dài khiến rất ít kỹ sư dữ liệu đáp ứng được.',
      },
      confidence: 81,
      factors: [
        {
          id: 'salary',
          label: { en: 'Salary band below market', vi: 'Khung lương thấp hơn thị trường' },
          detail: {
            en: "The band's midpoint is 15% under the market median for senior data engineers.",
            vi: 'Mức giữa của khung lương thấp hơn 15% so với mức trung vị thị trường của kỹ sư dữ liệu cấp cao.',
          },
          impact: 'high',
        },
        {
          id: 'single-channel',
          label: { en: 'Single sourcing channel', vi: 'Chỉ có một kênh tìm nguồn' },
          detail: {
            en: 'All 18 applicants came from TopCV. ITviec and LinkedIn brought the most data hires last quarter.',
            vi: 'Cả 18 hồ sơ đều đến từ TopCV. ITviec và LinkedIn mang lại nhiều kỹ sư dữ liệu nhất trong quý trước.',
          },
          impact: 'medium',
        },
        {
          id: 'skills',
          label: { en: 'Too many must-have skills', vi: 'Quá nhiều kỹ năng bắt buộc' },
          detail: {
            en: 'Only 6% of data engineers in the pool list all eight required skills.',
            vi: 'Chỉ 6% kỹ sư dữ liệu trong nguồn ứng viên có đủ cả tám kỹ năng bắt buộc.',
          },
          impact: 'medium',
        },
      ],
    },
    suggestedFixes: [
      {
        id: 'fix_data_salary',
        actionLabel: { en: 'Raise Salary Band', vi: 'Nâng khung lương' },
        description: {
          en: 'Raise the band from $110k–$130k to $135k–$165k.',
          vi: 'Nâng khung lương từ $110k–$130k lên $135k–$165k.',
        },
        patch: { salaryMin: 135, salaryMax: 165 },
        recommended: true,
      },
      {
        id: 'fix_data_skills',
        actionLabel: { en: 'Trim Must-Have Skills', vi: 'Rút gọn kỹ năng bắt buộc' },
        description: {
          en: 'Keep Spark, Airflow, SQL and Python as must-haves; move the rest to nice-to-have.',
          vi: 'Giữ Spark, Airflow, SQL và Python là bắt buộc; chuyển các kỹ năng còn lại sang ưu tiên.',
        },
        patch: { skills: ['Spark', 'Airflow', 'SQL', 'Python'] },
      },
      {
        id: 'fix_data_channels',
        actionLabel: { en: 'Add Sourcing Channels', vi: 'Bổ sung kênh tìm nguồn' },
        description: {
          en: 'Publish to ITviec and LinkedIn alongside TopCV.',
          vi: 'Đăng thêm lên ITviec và LinkedIn bên cạnh TopCV.',
        },
        patch: { channels: ['topcv', 'itviec', 'linkedin'] },
      },
    ],
  },
  {
    id: 'alert_match_forecast',
    campaignId: 'backend-engineer-go',
    severity: 'warning',
    title: {
      en: 'Match rate is forecast to fall below target within 2 weeks',
      vi: 'Tỷ lệ phù hợp dự báo sẽ xuống dưới mục tiêu trong 2 tuần',
    },
    campaignName: { en: 'Backend Engineer (Go)', vi: 'Kỹ sư Backend (Go)' },
    detectedAt: new Date(Date.now() - 26 * HOUR).toISOString(),
    metric: {
      label: { en: 'Forecast match rate in 14 days', vi: 'Tỷ lệ phù hợp dự báo sau 14 ngày' },
      current: 54,
      target: 60,
    },
    rootCause: {
      // 16 of the campaign's 38 qualified applicants, as on the Analytics page.
      summary: {
        en: 'The ITviec posting expired 3 days ago. It brought in 42% of the qualified Go applicants, and the remaining channels are slowing down.',
        vi: 'Tin đăng trên ITviec đã hết hạn 3 ngày trước. Kênh này mang lại 42% ứng viên Go đạt chuẩn, và các kênh còn lại đang chậm dần.',
      },
      confidence: 72,
      factors: [
        {
          id: 'expired-post',
          label: { en: 'ITviec posting expired', vi: 'Tin đăng ITviec đã hết hạn' },
          detail: {
            en: 'It was the top source of qualified Go applicants this month.',
            vi: 'Đây là nguồn ứng viên Go đạt chuẩn lớn nhất trong tháng.',
          },
          impact: 'high',
        },
        {
          id: 'competition',
          label: { en: 'More competing Go roles', vi: 'Nhiều vị trí Go cạnh tranh hơn' },
          detail: {
            en: '17 new Go roles opened in Ho Chi Minh City in the last 2 weeks.',
            vi: '17 vị trí Go mới được mở tại TP. Hồ Chí Minh trong 2 tuần qua.',
          },
          impact: 'medium',
        },
        {
          id: 'referrals',
          label: { en: 'Referral bonus not promoted', vi: 'Thưởng giới thiệu chưa được truyền thông' },
          detail: {
            en: 'No referrals have come in since the first week of the campaign.',
            vi: 'Chưa có hồ sơ giới thiệu nào kể từ tuần đầu của chiến dịch.',
          },
          impact: 'low',
        },
      ],
    },
    suggestedFixes: [
      {
        id: 'fix_go_repost',
        actionLabel: { en: 'Renew ITviec Posting', vi: 'Gia hạn tin đăng ITviec' },
        description: {
          en: 'Repost the role on ITviec and pin it to the top for 2 weeks.',
          vi: 'Đăng lại vị trí trên ITviec và ghim lên đầu trong 2 tuần.',
        },
        expectedLift: 9,
        recommended: true,
      },
      {
        id: 'fix_go_referrals',
        actionLabel: { en: 'Promote Referral Bonus', vi: 'Truyền thông thưởng giới thiệu' },
        description: {
          en: 'Remind the engineering team about the $1,000 referral bonus.',
          vi: 'Nhắc đội kỹ thuật về khoản thưởng giới thiệu $1,000.',
        },
        expectedLift: 5,
      },
      {
        id: 'fix_go_salary',
        actionLabel: { en: 'Show Salary in Job Post', vi: 'Hiển thị lương trên tin đăng' },
        description: {
          en: 'Publish the salary band so the post stands out from competing roles.',
          vi: 'Công khai khung lương để tin đăng nổi bật hơn các vị trí cạnh tranh.',
        },
        expectedLift: 4,
      },
    ],
  },
];

const MOCK_HISTORY: HealingRecord[] = [
  {
    id: 'heal_portfolio',
    campaignId: 'product-designer',
    campaignName: { en: 'Product Designer', vi: 'Nhà thiết kế sản phẩm' },
    issue: {
      en: 'Portfolio screen filtered out 60% of applicants',
      vi: 'Vòng lọc portfolio loại 60% ứng viên',
    },
    fix: { en: 'Relax Portfolio Requirement', vi: 'Nới lỏng yêu cầu portfolio' },
    outcome: 'resolved',
    at: new Date(Date.now() - 6 * DAY).toISOString(),
    result: { label: MATCH_RATE_LABEL, before: 52, after: 71 },
    resolutionHours: 30,
  },
  {
    id: 'heal_go_screening',
    campaignId: 'backend-engineer-go',
    campaignName: { en: 'Backend Engineer (Go)', vi: 'Kỹ sư Backend (Go)' },
    issue: { en: 'Screening queue building up', vi: 'Hàng chờ sàng lọc đang tăng' },
    outcome: 'dismissed',
    at: new Date(Date.now() - 9 * DAY).toISOString(),
  },
  {
    id: 'heal_cs_remote',
    campaignId: 'customer-success-lead',
    campaignName: { en: 'Customer Success Lead', vi: 'Trưởng nhóm Chăm sóc khách hàng' },
    issue: { en: 'Offer acceptance fell to 40%', vi: 'Tỷ lệ nhận offer giảm còn 40%' },
    fix: { en: 'Add Remote Option', vi: 'Bổ sung lựa chọn làm từ xa' },
    outcome: 'resolved',
    at: new Date(Date.now() - 12 * DAY).toISOString(),
    result: { label: { en: 'Offer acceptance', vi: 'Tỷ lệ nhận offer' }, before: 40, after: 75 },
    resolutionHours: 52,
  },
  {
    id: 'heal_hrbp_channels',
    campaignId: 'hr-business-partner',
    campaignName: { en: 'HR Business Partner', vi: 'Chuyên viên HRBP' },
    issue: {
      en: 'Applicant volume 35% below forecast',
      vi: 'Lượng hồ sơ thấp hơn dự báo 35%',
    },
    fix: { en: 'Add Sourcing Channels', vi: 'Bổ sung kênh tìm nguồn' },
    outcome: 'resolved',
    at: new Date(Date.now() - 20 * DAY).toISOString(),
    result: { label: MATCH_RATE_LABEL, before: 71, after: 82 },
    resolutionHours: 22,
  },
];

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1 };

/**
 * Alerts raised by the Self-Healing monitor across all campaigns: critical first, then the most
 * recent. From the API they also carry HR's decision: open ones, plus those approved or dismissed in
 * the last 30 days. The mock has open ones only.
 */
export async function fetchActiveBottleneckAlerts(): Promise<(BottleneckAlert & Partial<AlertDecision>)[]> {
  return readWithFallback('alerts', async (remote) => (await loadBootstrap(remote)).alerts, mockAlerts);
}

async function mockAlerts(): Promise<BottleneckAlert[]> {
  const setups = await fetchCampaignSetups();
  return MOCK_ALERTS.map((alert) => withForecastLifts(alert, setups[alert.campaignId])).sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
  );
}

/** Asks the Digital Twin what each setup change adds; other fixes keep the lift they came with. */
function withForecastLifts(alert: MockAlert, setup: CampaignDraft | undefined): BottleneckAlert {
  return {
    ...alert,
    suggestedFixes: alert.suggestedFixes.map((fix) => ({
      ...fix,
      expectedLift: fix.patch && setup ? matchRateLift(setup, fix.patch) : (fix.expectedLift ?? 0),
    })),
  };
}

/**
 * Fixes applied and alerts dismissed over the last 30 days, newest first. From the API, only the
 * records whose alert is not among the alerts above.
 */
export async function fetchHealingHistory(): Promise<HealingRecord[]> {
  return readWithFallback(
    'healing history',
    async (remote) => (await loadBootstrap(remote)).history,
    async () => MOCK_HISTORY,
  );
}

/**
 * Tells the Orchestrator Agent to apply the fix HR approved; it also merges the fix's change into the
 * campaign's setup. Resolves with what it logged (`null` in mock mode, where the app logs it).
 */
export async function approveSuggestedFix(alertId: string, fixId: string): Promise<AgentEvent[] | null> {
  const remote = getRemote();
  if (!remote) {
    await mockDelay(1200);
    return null;
  }
  const { events } = await remote.request<{ events: AgentEvent[] }>(
    `/api/self-healing/alerts/${encodeURIComponent(alertId)}/approve`,
    { method: 'POST', body: { fixId } },
  );
  return events;
}

/**
 * Sets an open alert aside without a fix. Only the API keeps it; the mock forgets it on reload.
 * Closing an approved alert is not a dismissal, so it is never sent here.
 */
export async function dismissBottleneckAlert(alertId: string): Promise<void> {
  const remote = getRemote();
  if (!remote) return;
  await remote.request(`/api/self-healing/alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST' });
}

/** Brings back an alert that was dismissed without a fix. */
export async function reopenBottleneckAlert(alertId: string): Promise<void> {
  const remote = getRemote();
  if (!remote) return;
  await remote.request(`/api/self-healing/alerts/${encodeURIComponent(alertId)}/reopen`, { method: 'POST' });
}
