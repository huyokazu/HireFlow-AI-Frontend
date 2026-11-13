// Bộ chuyển đổi giữa dữ liệu của BACKEND (nhánh feature/backend-supabase: Next.js + Supabase)
// và đầu vào/đầu ra của các AI agent. Không gọi mạng, không phụ thuộc thư viện.
//
// Kiểu dữ liệu phía backend (xem src/services/*.ts trên nhánh đó):
//   Localized      = { en: string, vi: string }
//   CampaignDraft  = { title, department, location, workMode, seniority, headcount, skills[], minExperience,
//                      salaryMin, salaryMax (NGHÌN USD/NĂM), channels[], agents, targetMatchRate }
//   AlertContent   = { title, campaignName, metric{label,current,target}, rootCause{summary,confidence,factors[]},
//                      suggestedFixes[{ id, actionLabel, description, expectedLift, recommended?, patch? }] }
//                    (cột bottleneck_alerts.content; mọi chữ đều là Localized)
// Hướng dẫn nối vào backend: docs/backend-integration.md

/** Gemini trả lời bằng 1 ngôn ngữ; app cần { en, vi }. Tạm dùng cùng một câu cho cả hai. */
export function toLocalized(text) {
  const value = text == null ? '' : String(text);
  return { en: value, vi: value };
}

/** Lấy chữ từ Localized hoặc string. */
export function pickText(value, language = 'vi') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.vi || value.en || '';
}

const SENIORITY_VI = { junior: 'Junior', mid: 'Middle', senior: 'Senior', lead: 'Lead' };
const WORK_MODE_VI = { onsite: 'Tại văn phòng', hybrid: 'Hybrid', remote: 'Từ xa' };

/**
 * Dữ liệu chiến dịch của backend -> đầu vào cho diagnoseCampaign (Self-Healing).
 * Giữ nguyên đơn vị gốc (lương nghìn USD/năm) để phương án sửa dùng lại được làm `patch`.
 *
 * @param {object} p
 * @param {string|{en,vi}} p.title            campaigns.title
 * @param {number} p.matchRate                 campaigns.match_rate (0-100)
 * @param {number} p.targetMatchRate           campaigns.target_match_rate (0-100)
 * @param {number} [p.applicants]              campaigns.applicants
 * @param {object} [p.setup]                   campaigns.setup (CampaignDraft)
 * @param {{channel,applicants,qualified}[]} [p.channelResults]  campaign_channel_results
 * @param {string} [p.createdAt]               campaigns.created_at (ISO)
 * @param {Date|string} [p.now]                thời điểm hiện tại (để tính số tuần)
 */
export function campaignInputFromBackend({ title, matchRate, targetMatchRate, applicants, setup, channelResults, createdAt, now } = {}) {
  const s = setup || {};
  const input = {
    title: pickText(title) || s.title,
    department: s.department,
    seniority: SENIORITY_VI[s.seniority] || s.seniority,
    location: s.location,
    work_mode: WORK_MODE_VI[s.workMode] || s.workMode,
    headcount: s.headcount,
    skills: s.skills,
    required_years_experience: s.minExperience,
    salary_range_kusd_year: s.salaryMin != null && s.salaryMax != null ? `${s.salaryMin}–${s.salaryMax}` : undefined,
    channels: s.channels,
    target_match_rate_percent: targetMatchRate,
    match_rate_percent: matchRate,
    applicants,
  };
  if (Array.isArray(channelResults) && channelResults.length) {
    input.channel_results = channelResults
      .map((r) => `${r.channel}: ${r.applicants} CV, ${r.qualified} phù hợp`)
      .join('; ');
  }
  if (createdAt) {
    const weeks = Math.floor((new Date(now || Date.now()) - new Date(createdAt)) / (7 * 24 * 3600 * 1000));
    if (Number.isFinite(weeks) && weeks >= 0) input.weeks_running = weeks;
  }
  return input;
}

/**
 * Đoán phương án thuộc loại nào, để backend gắn `patch` (vd từ suggestForecastFixes của Digital Twin)
 * và tính expectedLift (matchRateLift). Trả về 'experience' | 'salary' | 'channels' | 'skills' | 'other'.
 */
export function fixKind(fix) {
  // Xét tên nút trước: mô tả hay nhắc cả yếu tố được GIỮ NGUYÊN ("tăng lương, giữ yêu cầu 3 năm kinh nghiệm").
  return classify(fix.action_label) || classify(fix.description) || 'other';
}

function classify(text) {
  const t = String(text || '').toLowerCase();
  if (/kinh nghiệm|experience/.test(t)) return 'experience';
  if (/lương|salary|thu nhập/.test(t)) return 'salary';
  if (/kênh|channel|linkedin|topcv|itviec|vietnamworks|wellfound|referral|giới thiệu/.test(t)) return 'channels';
  if (/kỹ năng|skill/.test(t)) return 'skills';
  return null;
}

/**
 * Kết quả diagnoseCampaign -> bản ghi cho bảng bottleneck_alerts.
 * Trả null nếu AI kết luận không có điểm nghẽn (status khác 'bottleneck').
 *
 * @param {object} result  data từ diagnoseCampaign
 * @param {object} ctx
 * @param {string|{en,vi}} ctx.campaignName
 * @param {number} ctx.matchRate
 * @param {number} ctx.targetMatchRate
 * @param {string|{en,vi}} [ctx.title]   ghi đè tiêu đề (mặc định: "Tỷ lệ ứng viên phù hợp thấp hơn mục tiêu N điểm")
 * @param {{label,current,target}} [ctx.metric]  ghi đè chỉ số (mặc định: tỷ lệ phù hợp matchRate/targetMatchRate)
 * @param {string} [ctx.idPrefix]       tiền tố id cho factor/fix (mặc định 'ai')
 * @param {(fix, kind) => {expectedLift?: number, patch?: object}|undefined} [ctx.enrichFix]
 *        backend gắn patch + expectedLift. Nên dùng patchFromFix(fix, setup) (đúng số AI ghi trên thẻ)
 *        rồi expectedLift = matchRateLift(setup, patch) của Digital Twin. KHÔNG lấy patch từ
 *        suggestForecastFixes: số của nó khác số AI ghi, HR duyệt sẽ áp số khác với số đã thấy.
 *        Không truyền -> expectedLift = 0, không có patch (nút Duyệt không sửa setup).
 * @returns {{ severity: 'critical'|'warning', content: object, fixKinds: string[] } | null}
 */
export function alertFromDiagnosis(result, { campaignName, matchRate, targetMatchRate, title, metric, idPrefix = 'ai', enrichFix } = {}) {
  if (!result || result.status !== 'bottleneck') return null;
  const localize = (v) => (v && typeof v === 'object' ? v : toLocalized(v));
  const current = Math.round(metric ? metric.current : matchRate ?? 0);
  const target = Math.round(metric ? metric.target : targetMatchRate ?? 0);
  const gap = Math.max(0, target - current);
  const fixKinds = result.suggested_fixes.map(fixKind);

  const content = {
    title: title
      ? localize(title)
      : { en: `Candidate match rate is ${gap} points below target`, vi: `Tỷ lệ ứng viên phù hợp thấp hơn mục tiêu ${gap} điểm` },
    campaignName: localize(campaignName),
    metric: {
      label: metric ? localize(metric.label) : { en: 'Candidate match rate', vi: 'Tỷ lệ ứng viên phù hợp' },
      current,
      target,
    },
    rootCause: {
      summary: toLocalized(result.diagnosis),
      confidence: result.confidence,
      factors: result.root_causes.map((c, i) => ({
        id: `${idPrefix}_factor_${i + 1}`,
        label: toLocalized(c.label),
        detail: toLocalized(c.detail),
        impact: c.impact,
      })),
    },
    suggestedFixes: result.suggested_fixes.map((f, i) => {
      const extra = (enrichFix && enrichFix(f, fixKinds[i])) || {};
      const fix = {
        id: `${idPrefix}_fix_${i + 1}`,
        actionLabel: toLocalized(f.action_label),
        description: toLocalized(f.description),
        expectedLift: Number.isFinite(extra.expectedLift) ? Math.round(extra.expectedLift) : 0,
        recommended: Boolean(f.recommended),
      };
      if (extra.patch && typeof extra.patch === 'object') fix.patch = extra.patch;
      return fix;
    }),
  };
  return { severity: gap >= 10 ? 'critical' : 'warning', content, fixKinds };
}

// Giống CHECK của cột candidates.email (core_schema.sql): sai định dạng thì insert bị từ chối.
const EMAIL_CHECK = /^[^\s@<>]+@[^\s@<>]+$/;

/** Email AI chép nguyên văn từ CV ("abc @gmail.com", "abc[at]gmail.com") -> null nếu không hợp lệ. */
export function cleanEmail(email) {
  const value = String(email ?? '').trim();
  return EMAIL_CHECK.test(value) ? value : null;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNum = (s) => Number(String(s).replace(',', '.'));

/**
 * Dựng `patch` (Partial<CampaignDraft>) từ CHÍNH con số AI ghi trong phương án, để khi HR duyệt
 * thì backend áp đúng số đã hiện trên thẻ. Chỉ nhận dạng chắc chắn; không chắc -> undefined.
 *  - experience: "... xuống (còn) 5 năm"            -> { minExperience: 5 }
 *  - salary:     "... 110-132 nghìn USD/năm"         -> { salaryMin: 110, salaryMax: 132 }
 *                "... lên 132 nghìn USD/năm"         -> { salaryMax: 132 } (chỉ khi > salaryMin hiện tại)
 * Lương chỉ nhận đơn vị nghìn USD/năm (đơn vị của CampaignDraft); triệu VND -> không tạo patch.
 * Backend nên kiểm tra lại { ...setup, ...patch } bằng campaignDraftSchema trước khi lưu.
 */
export function patchFromFix(fix, setup = {}) {
  const kind = fixKind(fix);
  const text = `${fix.action_label || ''} ${fix.description || ''}`;
  if (kind === 'experience') {
    const m = text.match(new RegExp(String.raw`xuống(?:\s+còn)?\s+${NUM}\s*năm`, 'i'));
    if (!m) return undefined;
    const years = Math.round(toNum(m[1]));
    if (!(years >= 0) || (setup.minExperience != null && years >= setup.minExperience)) return undefined;
    return { minExperience: years };
  }
  if (kind === 'salary') {
    // Lấy khoảng CUỐI CÙNG: câu thường là "từ 90-110 nghìn USD lên 110-130 nghìn USD".
    const range = [...text.matchAll(new RegExp(String.raw`${NUM}\s*[-–]\s*${NUM}\s*(?:nghìn|k)\s*USD`, 'gi'))].pop();
    if (range) {
      const [min, max] = [Math.round(toNum(range[1])), Math.round(toNum(range[2]))];
      return min > 0 && max >= min ? { salaryMin: min, salaryMax: max } : undefined;
    }
    const single = text.match(new RegExp(String.raw`lên(?:\s+(?:khoảng|mức))?\s+${NUM}\s*(?:nghìn|k)\s*USD`, 'i'));
    if (single) {
      const max = Math.round(toNum(single[1]));
      if (setup.salaryMin == null || max > setup.salaryMin) return { salaryMax: max };
    }
  }
  return undefined;
}

/**
 * Kết quả extractCv + scoreCv -> dữ liệu chèn vào bảng candidates và applications.
 * Thiếu workspace_id / campaign_id / candidate_id: backend tự thêm khi insert.
 */
export function candidateRowsFromAi(profile, match) {
  return {
    candidate: {
      name: String(profile.full_name || 'Chưa rõ tên').trim().slice(0, 200), // CHECK: 1-200 ký tự
      email: cleanEmail(profile.email),
      role: toLocalized(profile.current_title || ''),
      location: toLocalized(profile.location || ''),
      years_of_experience: Math.max(0, Math.round(profile.years_of_experience ?? 0)),
      skills: (profile.skills || []).map((s) => s.name),
    },
    application: {
      stage: 'applied',
      match_score: match.score,
      ai_assessment: toLocalized(match.summary),
    },
  };
}
