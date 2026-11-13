// OPTIMIZATION AGENT (Self-Healing) - chẩn đoán điểm nghẽn chiến dịch và đề xuất sửa.
// ĐÂY LÀ TÍNH NĂNG DEMO: prompt được giữ ngắn để phản hồi < 5 giây.
import { buildSystem, wrapData, nullable } from './shared.js';

export const name = 'self_healing';

/** Biến: {{language}} */
export const TASK_PROMPT = `NHIỆM VỤ (Self-Healing): Chẩn đoán vì sao chiến dịch tuyển dụng trong <campaign> chưa đạt KPI và đề xuất cách sửa để HR phê duyệt.

QUY TẮC
- status: "on_track" nếu thực tế ≥ KPI; "insufficient_data" nếu thiếu KPI hoặc số thực tế; còn lại "bottleneck".
- Chỉ dùng số liệu trong <campaign>. Không bịa số liệu thị trường; nếu không có, lập luận từ tương quan giữa lương, yêu cầu và kết quả thực tế.
- Nếu <campaign> không có lương thị trường, phương án tăng lương chỉ tăng tối đa 20% lương hiện tại (làm tròn đến triệu).
- diagnosis: 1 câu nêu NGUYÊN NHÂN chính (không nhắc lại việc thiếu CV), dạng "<điều kiện tuyển dụng> thấp/cao so với <điều kiện khác>", ví dụ "Mức lương thấp so với yêu cầu 3 năm kinh nghiệm".
- Phương án giảm yêu cầu kinh nghiệm: hạ xuống mức thấp nhất còn hợp lý với cấp bậc (vị trí chuyên viên: 1 năm; vị trí senior 7 năm: 5 năm).
- root_causes: 1–3 nguyên nhân, impact giảm dần.
- suggested_fixes: 1–3 phương án, đúng 1 phương án recommended = true. Ưu tiên recommended là phương án không tăng chi phí (giảm yêu cầu) nếu có. expected_impact là ước tính định tính, không bịa phần trăm.
- proposed_action: 1 câu, các phương án nối bằng "HOẶC", phương án recommended đứng đầu, có con số cụ thể.
- updated_jd_draft: bản nháp JD (tối đa 120 từ) đã áp dụng phương án recommended, giữ nguyên các thông tin khác.
- status khác "bottleneck": root_causes = [], suggested_fixes = [], proposed_action = null, updated_jd_draft = null.`;

export const schema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['bottleneck', 'on_track', 'insufficient_data'] },
    diagnosis: { type: 'string' },
    confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Độ tin cậy của chẩn đoán' },
    root_causes: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Tối đa 8 từ' },
          detail: { type: 'string', description: '1 câu' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['label', 'detail', 'impact'],
      },
    },
    proposed_action: nullable('string'),
    suggested_fixes: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          action_label: { type: 'string', description: 'Cụm động từ ngắn cho nút bấm, tối đa 5 từ' },
          description: { type: 'string', description: '1 câu, có con số' },
          expected_impact: { type: 'string', description: 'Tối đa 8 từ' },
          recommended: { type: 'boolean' },
        },
        required: ['action_label', 'description', 'expected_impact', 'recommended'],
      },
    },
    updated_jd_draft: nullable('string'),
  },
  required: [
    'status', 'diagnosis', 'confidence', 'root_causes',
    'proposed_action', 'suggested_fixes', 'updated_jd_draft',
  ],
};

const FIELD_LABELS = {
  title: 'Chiến dịch',
  kpi_cv_per_week: 'KPI (CV/tuần)',
  actual_cv_per_week: 'Thực tế (CV/tuần)',
  salary_million_vnd: 'Lương hiện tại (triệu VND/tháng)',
  required_years_experience: 'Yêu cầu kinh nghiệm (năm)',
  weeks_running: 'Số tuần đã chạy',
  channels: 'Kênh đăng tuyển',
  location: 'Địa điểm',
  market_salary_million_vnd: 'Lương thị trường (triệu VND/tháng)',
  jd_text: 'JD hiện tại',
  // Các khoá dưới đây đến từ dữ liệu backend (xem lib/backend.js, campaignInputFromBackend).
  department: 'Phòng ban',
  seniority: 'Cấp bậc',
  work_mode: 'Hình thức làm việc',
  headcount: 'Số lượng cần tuyển',
  skills: 'Kỹ năng yêu cầu',
  target_match_rate_percent: 'KPI tỷ lệ CV phù hợp (%)',
  match_rate_percent: 'Thực tế tỷ lệ CV phù hợp (%)',
  applicants: 'Số CV đã nhận',
  salary_range_kusd_year: 'Khoảng lương (nghìn USD/năm)',
  channel_results: 'Kết quả theo kênh',
};

/** Đổi object chiến dịch thành các dòng "Nhãn: giá trị" (ít token hơn JSON). */
export function formatCampaign(campaign) {
  if (typeof campaign === 'string') return campaign;
  return Object.entries(campaign)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
}

/**
 * @param {{ campaign: string | object, language?: string }} vars
 *   campaign: câu mô tả tự do, hoặc object với các khoá trong FIELD_LABELS.
 */
export function build({ campaign, language } = {}) {
  if (!campaign) throw new Error('Thiếu biến prompt: campaign');
  return {
    agent: name,
    system: buildSystem(TASK_PROMPT, language ? { language } : {}),
    input: wrapData('campaign', formatCampaign(campaign)),
    schema,
    modelTier: 'fast',
    avoidModels: ['gemini-2.5-flash-lite'], // bỏ qua quy tắc (không có con số, 3 phương án) -> thà dùng kết quả soạn sẵn
    thinkingLevel: 'minimal',
    maxOutputTokens: 900,
  };
}
