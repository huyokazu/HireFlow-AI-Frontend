// TALENT AGENT - chấm điểm mức độ phù hợp CV so với JD (Matching Score).
import { buildSystem, wrapData } from './shared.js';

export const name = 'talent_matching';

/** Biến: {{language}} */
export const TASK_PROMPT = `NHIỆM VỤ: Chấm mức độ phù hợp của CV với JD để HR ưu tiên xem xét (không phải quyết định tuyển hay loại).

THANG ĐIỂM (tổng 100)
- skills (0–50): tỷ lệ kỹ năng bắt buộc của JD mà CV có bằng chứng.
- experience (0–30): số năm và mức liên quan so với yêu cầu JD.
- other (0–20): học vấn, chứng chỉ, ngoại ngữ, yêu cầu khác của JD.

QUY TẮC
- Tiêu chí nào CV không có bằng chứng → 0 điểm tiêu chí đó, không suy diễn.
- Tên gọi khác của cùng một kỹ năng tính là có (ReactJS = React, FB Ads = Facebook Ads).
- score = skills + experience + other.
- match_reasons: tối đa 4 ý, mỗi ý nêu bằng chứng cụ thể từ CV.
- missing_skills: kỹ năng/yêu cầu JD nêu mà CV không có; không thêm thứ JD không yêu cầu.
- summary: 1–2 câu cho HR.
- CV rác hoặc không phải CV: mọi điểm = 0, match_reasons = [].`;

const points = (max) => ({ type: 'integer', minimum: 0, maximum: max });

export const schema = {
  type: 'object',
  properties: {
    // Đặt breakdown trước để model chấm từng phần rồi mới cộng tổng.
    score_breakdown: {
      type: 'object',
      properties: { skills: points(50), experience: points(30), other: points(20) },
      required: ['skills', 'experience', 'other'],
    },
    score: points(100),
    match_reasons: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    missing_skills: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['score_breakdown', 'score', 'match_reasons', 'missing_skills', 'summary'],
};

/**
 * @param {{ jdText: string, cvText: string, language?: string }} vars
 */
export function build({ jdText, cvText, language } = {}) {
  if (!jdText) throw new Error('Thiếu biến prompt: jdText');
  if (!cvText) throw new Error('Thiếu biến prompt: cvText');
  return {
    agent: name,
    system: buildSystem(TASK_PROMPT, language ? { language } : {}),
    input: `${wrapData('jd', jdText)}\n\n${wrapData('cv', cvText)}`,
    schema,
    modelTier: 'smart',
    thinkingLevel: 'low',
    maxOutputTokens: 800,
  };
}
