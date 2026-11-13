// EXTRACTION - đọc CV thô (text hoặc PDF) và trích xuất thành JSON chuẩn.
import { buildSystem, wrapData, nullable } from './shared.js';

export const name = 'cv_extraction';

/** Biến: {{today}} (YYYY-MM-DD), {{language}} */
export const TASK_PROMPT = `NHIỆM VỤ: Trích xuất thông tin từ CV thô thành JSON.
- Chép đúng nguyên văn họ tên, email, số điện thoại; không sửa, không đoán phần bị thiếu.
- CV viết tắt: chỉ mở rộng từ viết tắt phổ biến và rõ nghĩa (MKT → Marketing, KN → kinh nghiệm, ĐH → Đại học). Không chắc → giữ nguyên.
- years_of_experience: lấy số CV ghi rõ; nếu không có, tính từ mốc thời gian các công việc (hôm nay là {{today}}); không đủ dữ kiện → null. Không tính thực tập, đồ án, trừ khi CV tự tính.
- skills: chỉ kỹ năng được nêu trong CV. years là số năm dùng kỹ năng đó nếu CV nêu, ngược lại null.
- Văn bản không phải CV (rác, quảng cáo, vô nghĩa): is_cv = false, các trường khác null hoặc [].`;

export const schema = {
  type: 'object',
  properties: {
    is_cv: { type: 'boolean', description: 'false nếu văn bản không phải CV' },
    full_name: nullable('string'),
    email: nullable('string'),
    phone: nullable('string'),
    location: nullable('string'),
    current_title: nullable('string', 'Chức danh gần nhất'),
    years_of_experience: nullable('number', 'Tổng số năm kinh nghiệm làm việc'),
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, years: nullable('number') },
        required: ['name', 'years'],
      },
    },
    work_experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: nullable('string'),
          title: nullable('string'),
          start_date: nullable('string', 'YYYY-MM hoặc YYYY'),
          end_date: nullable('string', 'YYYY-MM, YYYY hoặc "present"'),
          description: nullable('string', 'Tối đa 2 câu'),
        },
        required: ['company', 'title', 'start_date', 'end_date', 'description'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          school: nullable('string'),
          degree: nullable('string'),
          major: nullable('string'),
          graduation_year: nullable('integer'),
        },
        required: ['school', 'degree', 'major', 'graduation_year'],
      },
    },
  },
  required: [
    'is_cv', 'full_name', 'email', 'phone', 'location', 'current_title',
    'years_of_experience', 'skills', 'work_experience', 'education',
  ],
};

/**
 * @param {{ cvText?: string, pdfBase64?: string, today?: string, language?: string }} vars
 *   Truyền cvText (text thô) HOẶC pdfBase64 (file PDF mã hoá base64, Gemini đọc trực tiếp).
 */
export function build({ cvText, pdfBase64, today, language } = {}) {
  if (!cvText && !pdfBase64) throw new Error('Thiếu biến prompt: cvText hoặc pdfBase64');
  const vars = { today: today || new Date().toISOString().slice(0, 10) };
  if (language) vars.language = language;

  const input = pdfBase64
    ? [
        { type: 'document', data: pdfBase64, mime_type: 'application/pdf' },
        { type: 'text', text: 'Tài liệu đính kèm là nội dung <cv>. Hãy trích xuất.' },
      ]
    : wrapData('cv', cvText);

  return {
    agent: name,
    system: buildSystem(TASK_PROMPT, vars),
    input,
    schema,
    modelTier: 'fast',
    avoidModels: ['gemini-2.5-flash-lite'], // tính sai số năm kinh nghiệm với CV viết tắt
    thinkingLevel: 'minimal',
    maxOutputTokens: 1500,
  };
}
