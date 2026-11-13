// Các hàm cấp cao để Backend gọi: build prompt -> gọi Gemini -> kiểm tra schema -> hậu xử lý.
import { cvExtraction, talentMatching, selfHealing, orchestrator, PROMPT_VERSION } from '../prompts/index.js';
import { generateJson } from './gemini.js';
import { validate } from './validate.js';

async function run(req, opts = {}) {
  const call = opts.generate || generateJson; // cho phép thay bằng hàm giả khi test
  const { data, usage, latencyMs, model, fallbacks = [] } = await call(req, opts);
  const errors = validate(data, req.schema);
  if (errors.length) throw new Error(`[${req.agent}] Gemini trả sai schema: ${errors.join('; ')}`);
  const warnings = fallbacks.map((f) => `Model ${f.model} lỗi (${f.error}) -> đã chuyển model dự phòng`);
  return {
    data,
    meta: { agent: req.agent, promptVersion: PROMPT_VERSION, model, latencyMs, usage, source: 'gemini', warnings },
  };
}

const digits = (s) => String(s || '').replace(/\D/g, '');
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Chốt chặn chống ảo giác bằng code: họ tên / email / SĐT mà model trả về
 * phải thực sự xuất hiện trong CV gốc. Không thấy -> đổi thành null + ghi cảnh báo.
 */
export function groundExtraction(profile, cvText) {
  const warnings = [];
  const out = { ...profile };
  const source = fold(cvText);
  const check = (field, found) => {
    if (out[field] !== null && out[field] !== undefined && !found) {
      warnings.push(`${field} "${out[field]}" không có trong CV gốc -> đặt null`);
      out[field] = null;
    }
  };
  check('email', source.includes(fold(out.email)));
  check('phone', digits(out.phone).length >= 8 && digits(cvText).includes(digits(out.phone).replace(/^84/, '').replace(/^0/, '')));
  check('full_name', source.includes(fold(out.full_name)));
  return { profile: out, warnings };
}

/** Trích xuất CV -> JSON. Truyền { cvText } hoặc { pdfBase64 }. */
export async function extractCv(vars, opts) {
  const result = await run(cvExtraction.build(vars), { hedgeAfterMs: 4000, ...opts });
  if (vars.cvText) {
    const { profile, warnings } = groundExtraction(result.data, vars.cvText);
    result.data = profile;
    result.meta.warnings.push(...warnings);
  }
  return result;
}

/** Chấm điểm CV theo JD. Kết quả luôn ở trạng thái chờ HR duyệt. */
export async function scoreCv(vars, opts) {
  const result = await run(talentMatching.build(vars), { hedgeAfterMs: 5000, ...opts });
  const b = result.data.score_breakdown;
  const sum = b.skills + b.experience + b.other;
  if (sum !== result.data.score) {
    result.meta.warnings.push(`score ${result.data.score} khác tổng breakdown ${sum} -> dùng ${sum}`);
    result.data.score = sum;
  }
  // Human-in-the-loop được ép bằng code, không phụ thuộc vào model.
  result.data.decision = 'pending_hr_review';
  return result;
}

/**
 * Self-Healing: chẩn đoán chiến dịch.
 * Mặc định tổng 4500ms, gửi song song: model chính chưa trả lời sau 1500ms thì gửi luôn tới model dự phòng, lấy câu trả lời về trước.
 * opts.fallback: object kết quả dự phòng; nếu mọi model đều lỗi / quá giờ thì trả fallback
 * với meta.source = 'fallback' để demo không bị đơ.
 */
export async function diagnoseCampaign(vars, opts = {}) {
  const req = selfHealing.build(vars);
  try {
    const result = await run(req, { timeoutMs: 4500, hedgeAfterMs: 1500, ...opts });
    const fixes = result.data.suggested_fixes;
    if (fixes.length && fixes.filter((f) => f.recommended).length !== 1) {
      fixes.forEach((f, i) => { f.recommended = i === 0; });
      result.meta.warnings.push('Số phương án recommended khác 1 -> chọn phương án đầu');
    }
    result.data.requires_hr_approval = true;
    return result;
  } catch (err) {
    if (!opts.fallback) throw err;
    return {
      data: { ...opts.fallback, requires_hr_approval: true },
      meta: { agent: req.agent, promptVersion: PROMPT_VERSION, model: null, latencyMs: null, usage: null, source: 'fallback', warnings: [String(err.message)] },
    };
  }
}

/** Orchestrator: chọn agent cho một yêu cầu/sự kiện. */
export async function routeRequest(vars, opts) {
  return run(orchestrator.build(vars), { hedgeAfterMs: 3000, ...opts });
}
