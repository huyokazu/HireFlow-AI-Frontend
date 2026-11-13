import type { Localized } from '../i18n/types';
import type { CampaignDraft } from './campaigns';
import { forecastCampaign, matchRateLift, suggestForecastFixes, type ForecastRiskReason } from './digitalTwin';
import type { AlertSeverity, BottleneckAlert, ImpactLevel, RootCauseFactor, SuggestedFix } from './selfHealing';

/**
 * Precomputed AI answers: what the app and the backend show when the live Optimization Agent
 * (Gemini) is slower than the deadline, rate-limited or not configured, so a demo never waits on
 * the network. Both languages are filled in, unlike a live answer, which comes back in the
 * language of the person who asked for it.
 */

/** An alert before it is stored: the backend adds its id, campaign and detection time. */
export type AlertDraft = {
  severity: AlertSeverity;
  content: Omit<BottleneckAlert, 'id' | 'campaignId' | 'severity' | 'detectedAt'>;
};

/** What the Optimization Agent knows about a campaign it diagnoses. */
export type DiagnosisInput = {
  campaignName: Localized;
  setup: CampaignDraft | null;
  /** Percentages, 0–100. */
  matchRate: number;
  targetMatchRate: number;
};

/** Below target by at least this many points, an alert is critical rather than a warning. */
const CRITICAL_GAP = 10;

/**
 * Gemini's diagnosis of the seeded Senior Frontend Engineer campaign (gemini-3.1-flash-lite,
 * 12 Nov 2026, `ai/samples/backend_alert_senior.json`), with the English filled in. The lifts are
 * worked out from the campaign's setup when the alert is built, like a live answer's.
 */
const SENIOR_FRONTEND: AlertDraft = {
  severity: 'critical',
  content: {
    title: { en: 'Candidate match rate is 18 points below target', vi: 'Tỷ lệ ứng viên phù hợp thấp hơn mục tiêu 18 điểm' },
    campaignName: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
    metric: { label: { en: 'Candidate match rate', vi: 'Tỷ lệ ứng viên phù hợp' }, current: 42, target: 60 },
    rootCause: {
      summary: {
        en: 'A 7-year experience requirement is too high for the current skill mix and salary band.',
        vi: 'Yêu cầu kinh nghiệm 7 năm quá cao so với mặt bằng kỹ năng và phân khúc lương hiện tại.',
      },
      confidence: 85,
      factors: [
        {
          id: 'ai_factor_1',
          label: { en: 'High experience requirement', vi: 'Yêu cầu kinh nghiệm cao' },
          detail: {
            en: 'Requiring 7 years of experience sharply shrinks the pool of suitable candidates.',
            vi: 'Yêu cầu 7 năm kinh nghiệm làm giảm đáng kể lượng ứng viên tiềm năng phù hợp.',
          },
          impact: 'high',
        },
        {
          id: 'ai_factor_2',
          label: { en: 'Demanding skill mix', vi: 'Độ phức tạp kỹ năng' },
          detail: {
            en: 'Combining 7 specialist skills makes the screening bar very strict.',
            vi: 'Sự kết hợp giữa 7 kỹ năng chuyên sâu khiến tiêu chuẩn chọn lọc trở nên khắt khe.',
          },
          impact: 'medium',
        },
      ],
    },
    suggestedFixes: [
      {
        id: 'ai_fix_1',
        actionLabel: { en: 'Lower experience to 5 years', vi: 'Giảm kinh nghiệm xuống 5 năm' },
        description: {
          en: 'Lower the experience requirement from 7 to 5 years to widen the candidate pool.',
          vi: 'Điều chỉnh yêu cầu kinh nghiệm từ 7 năm xuống 5 năm để mở rộng nguồn ứng viên.',
        },
        expectedLift: 0,
        recommended: true,
        patch: { minExperience: 5 },
      },
      {
        id: 'ai_fix_2',
        actionLabel: { en: 'Raise the salary budget', vi: 'Tăng ngân sách lương' },
        description: {
          en: 'Move the salary band from 90–110 to 110–130 thousand USD a year to attract senior talent.',
          vi: 'Điều chỉnh dải lương từ 90-110 lên 110-130 nghìn USD/năm để thu hút nhân tài cấp cao.',
        },
        expectedLift: 0,
        recommended: false,
        patch: { salaryMin: 110, salaryMax: 130 },
      },
    ],
  },
};

const PRECOMPUTED: Record<string, AlertDraft> = {
  'senior-frontend-engineer': SENIOR_FRONTEND,
};

const gapTitle = (gap: number): Localized => ({
  en: `Candidate match rate is ${gap} points below target`,
  vi: `Tỷ lệ ứng viên phù hợp thấp hơn mục tiêu ${gap} điểm`,
});

/** Fills in each fix's lift from the setup, as the backend does for a live answer. */
function withLifts(draft: AlertDraft, setup: CampaignDraft | null): AlertDraft {
  if (!setup) return draft;
  return {
    ...draft,
    content: {
      ...draft.content,
      suggestedFixes: draft.content.suggestedFixes.map((fix) =>
        fix.patch ? { ...fix, expectedLift: Math.max(0, matchRateLift(setup, fix.patch)) } : fix,
      ),
    },
  };
}

/**
 * The precomputed diagnosis for a campaign: Gemini's saved answer when there is one, otherwise the
 * Hiring Digital Twin's reading of the setup. `null` when the campaign is on target or the twin
 * finds nothing in its setup to change.
 */
export function precomputedDiagnosis(campaignId: string, input: DiagnosisInput): AlertDraft | null {
  const saved = PRECOMPUTED[campaignId];
  if (saved) {
    const current = Math.round(input.matchRate);
    const target = Math.round(input.targetMatchRate);
    const gap = Math.max(0, target - current);
    // Keeps the saved wording but reports the campaign's numbers as they are now.
    const draft: AlertDraft = gap > 0
      ? {
          severity: gap >= CRITICAL_GAP ? 'critical' : 'warning',
          content: {
            ...saved.content,
            title: gapTitle(gap),
            campaignName: input.campaignName,
            metric: { ...saved.content.metric, current, target },
          },
        }
      : saved;
    return withLifts(draft, input.setup);
  }
  return forecastDiagnosis(input);
}

const REASON_TEXT: Record<ForecastRiskReason, { label: Localized; impact: ImpactLevel }> = {
  salary: { label: { en: 'Salary band below market', vi: 'Khung lương thấp hơn thị trường' }, impact: 'high' },
  experience: { label: { en: 'Experience bar above market', vi: 'Yêu cầu kinh nghiệm cao hơn thị trường' }, impact: 'high' },
  channels: { label: { en: 'Too few sourcing channels', vi: 'Quá ít kênh tìm nguồn' }, impact: 'medium' },
  skills: { label: { en: 'Long must-have skill list', vi: 'Danh sách kỹ năng bắt buộc quá dài' }, impact: 'medium' },
};

/** The Digital Twin's diagnosis of a setup, for campaigns without a saved Gemini answer. */
function forecastDiagnosis({ campaignName, setup, matchRate, targetMatchRate }: DiagnosisInput): AlertDraft | null {
  const current = Math.round(matchRate);
  const target = Math.round(targetMatchRate);
  const gap = target - current;
  if (!setup || gap <= 0) return null;
  const forecast = forecastCampaign(setup);
  const fixes = suggestForecastFixes(setup, forecast);
  if (fixes.length === 0) return null;

  const factors: RootCauseFactor[] = fixes.map(({ reason }, index) => ({
    id: `twin_factor_${index + 1}`,
    label: REASON_TEXT[reason].label,
    detail: factorDetail(reason, setup, forecast.marketMedian, forecast.salaryGapPercent, forecast.typicalYears),
    impact: REASON_TEXT[reason].impact,
  }));
  const ranked = [...fixes].sort((a, b) => b.matchRate - a.matchRate);
  const suggestedFixes: SuggestedFix[] = fixes.map(({ reason, patch }, index) => ({
    id: `twin_fix_${index + 1}`,
    ...fixText(reason, setup, patch),
    expectedLift: Math.max(0, matchRateLift(setup, patch)),
    recommended: ranked[0]?.reason === reason,
    patch,
  }));

  return {
    severity: gap >= CRITICAL_GAP ? 'critical' : 'warning',
    content: {
      title: gapTitle(gap),
      campaignName,
      metric: { label: { en: 'Candidate match rate', vi: 'Tỷ lệ ứng viên phù hợp' }, current, target },
      rootCause: {
        summary: {
          en: `The campaign setup explains most of the gap: ${factors.map((factor) => factor.label.en.toLowerCase()).join(', ')}.`,
          vi: `Phần lớn khoảng cách đến từ thiết lập chiến dịch: ${factors.map((factor) => factor.label.vi.toLowerCase()).join(', ')}.`,
        },
        confidence: 70,
        factors,
      },
      suggestedFixes,
    },
  };
}

function factorDetail(
  reason: ForecastRiskReason,
  setup: CampaignDraft,
  marketMedian: number,
  salaryGapPercent: number,
  typicalYears: number,
): Localized {
  switch (reason) {
    case 'salary':
      return {
        en: `The band's midpoint sits ${Math.abs(salaryGapPercent)}% under the ${marketMedian}k USD market median.`,
        vi: `Điểm giữa khung lương thấp hơn ${Math.abs(salaryGapPercent)}% so với mức trung vị ${marketMedian}k USD của thị trường.`,
      };
    case 'experience':
      return {
        en: `${setup.minExperience} years are required; the market expects about ${typicalYears} at this level.`,
        vi: `Yêu cầu ${setup.minExperience} năm, trong khi thị trường thường cần khoảng ${typicalYears} năm ở cấp này.`,
      };
    case 'channels':
      return {
        en: `Only ${setup.channels.length} sourcing ${setup.channels.length === 1 ? 'channel reaches' : 'channels reach'} candidates.`,
        vi: `Chỉ có ${setup.channels.length} kênh tìm nguồn tiếp cận ứng viên.`,
      };
    case 'skills':
      return {
        en: `${setup.skills.length} must-have skills screen out most applicants.`,
        vi: `${setup.skills.length} kỹ năng bắt buộc loại phần lớn ứng viên.`,
      };
  }
}

function fixText(
  reason: ForecastRiskReason,
  setup: CampaignDraft,
  patch: Partial<CampaignDraft>,
): Pick<SuggestedFix, 'actionLabel' | 'description'> {
  switch (reason) {
    case 'salary': {
      const band = `${patch.salaryMin ?? setup.salaryMin}–${patch.salaryMax ?? setup.salaryMax}k`;
      return {
        actionLabel: { en: `Raise salary to ${band}`, vi: `Nâng lương lên ${band}` },
        description: {
          en: `Move the band from ${setup.salaryMin}–${setup.salaryMax}k to ${band} USD a year, in line with the market.`,
          vi: `Điều chỉnh khung lương từ ${setup.salaryMin}–${setup.salaryMax}k lên ${band} USD/năm, sát với thị trường.`,
        },
      };
    }
    case 'experience': {
      const years = patch.minExperience ?? setup.minExperience;
      return {
        actionLabel: { en: `Lower experience to ${years} years`, vi: `Giảm kinh nghiệm xuống ${years} năm` },
        description: {
          en: `Lower the minimum from ${setup.minExperience} to ${years} years to widen the pool.`,
          vi: `Giảm yêu cầu từ ${setup.minExperience} xuống ${years} năm để mở rộng nguồn ứng viên.`,
        },
      };
    }
    case 'channels': {
      const added = (patch.channels ?? []).filter((channel) => !setup.channels.includes(channel)).length;
      return {
        actionLabel: { en: 'Add sourcing channels', vi: 'Thêm kênh tìm nguồn' },
        description: {
          en: `Post on ${added} more channel${added === 1 ? '' : 's'} so more candidates see the role.`,
          vi: `Đăng thêm trên ${added} kênh để nhiều ứng viên thấy vị trí hơn.`,
        },
      };
    }
    case 'skills': {
      const count = patch.skills?.length ?? setup.skills.length;
      return {
        actionLabel: { en: `Trim to ${count} core skills`, vi: `Rút gọn còn ${count} kỹ năng cốt lõi` },
        description: {
          en: `Keep ${count} must-have skills and move the rest to nice-to-have.`,
          vi: `Giữ ${count} kỹ năng bắt buộc, chuyển phần còn lại sang ưu tiên.`,
        },
      };
    }
  }
}
