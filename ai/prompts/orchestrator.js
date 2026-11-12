// ORCHESTRATOR AGENT - "bộ não" điều phối: đọc yêu cầu/sự kiện rồi chọn agent xử lý.
import { buildSystem, wrapData } from './shared.js';

export const name = 'orchestrator';

/** Biến: {{language}} */
export const TASK_PROMPT = `NHIỆM VỤ (Orchestrator): Đọc yêu cầu của HR hoặc sự kiện hệ thống trong <request> và chọn agent xử lý.

AGENT
- extraction: có CV mới cần đọc thành hồ sơ.
- talent: cần chấm điểm hoặc xếp hạng CV theo JD.
- optimization: chiến dịch chậm KPI, cần chẩn đoán và đề xuất sửa (Self-Healing).
- none: ngoài phạm vi tuyển dụng.

QUY TẮC
- Yêu cầu tự động loại/nhận ứng viên: vẫn chọn talent, nhưng chỉ lập danh sách đề xuất để HR duyệt và nói rõ điều đó trong message_to_hr.
- requires_hr_approval = true nếu kết quả dẫn tới thay đổi JD, lương, trạng thái ứng viên hoặc gửi thông tin ra ngoài.
- reason: 1 câu. message_to_hr: 1 câu cho HR biết bạn sẽ làm gì hoặc vì sao không làm.`;

export const schema = {
  type: 'object',
  properties: {
    agent: { type: 'string', enum: ['extraction', 'talent', 'optimization', 'none'] },
    reason: { type: 'string' },
    requires_hr_approval: { type: 'boolean' },
    message_to_hr: { type: 'string' },
  },
  required: ['agent', 'reason', 'requires_hr_approval', 'message_to_hr'],
};

/**
 * @param {{ request: string, language?: string }} vars
 *   request: câu HR gõ, hoặc mô tả sự kiện hệ thống (vd "Chiến dịch X chỉ đạt 2/20 CV tuần này").
 */
export function build({ request, language } = {}) {
  if (!request) throw new Error('Thiếu biến prompt: request');
  return {
    agent: name,
    system: buildSystem(TASK_PROMPT, language ? { language } : {}),
    input: wrapData('request', request),
    schema,
    modelTier: 'fast',
    thinkingLevel: 'minimal',
    maxOutputTokens: 300,
  };
}
