// Chunking CV / JD cho Vector DB.
// Nguyên tắc giữ ngữ cảnh:
//  1. Cắt theo MỤC (Kinh nghiệm, Kỹ năng, Học vấn...), không cắt mù theo số ký tự.
//  2. Mỗi công việc (khối cách nhau bằng dòng trống) nằm trọn trong 1 chunk.
//  3. Mọi chunk đều có dòng ngữ cảnh ở đầu (tên, chức danh, tổng số năm KN, tên mục)
//     -> kỹ năng và số năm kinh nghiệm luôn đi cùng nhau.
//  4. Email / SĐT bị che trước khi đưa vào vector (không embed dữ liệu liên hệ).

const SECTION_KEYWORDS = {
  cv: [
    ['contact', ['thong tin ca nhan', 'thong tin lien he', 'lien he', 'contact', 'personal information', 'personal details']],
    ['summary', ['muc tieu nghe nghiep', 'muc tieu', 'gioi thieu ban than', 'gioi thieu', 'tom tat', 'summary', 'objective', 'profile', 'about me']],
    ['experience', ['kinh nghiem lam viec', 'kinh nghiem', 'qua trinh lam viec', 'work experience', 'professional experience', 'experience', 'employment', 'kn']],
    ['skills', ['ky nang', 'technical skills', 'skills', 'cong nghe', 'chuyen mon', 'kn mem']],
    ['education', ['trinh do hoc van', 'hoc van', 'education', 'dao tao', 'hv']],
    ['projects', ['du an', 'projects']],
    ['certifications', ['chung chi', 'giai thuong', 'certifications', 'certificates', 'awards', 'cc']],
    ['languages', ['ngoai ngu', 'ngon ngu', 'languages']],
    ['other', ['so thich', 'hoat dong', 'interests', 'activities', 'nguoi tham chieu', 'references']],
  ],
  jd: [
    ['responsibilities', ['mo ta cong viec', 'nhiem vu', 'trach nhiem', 'responsibilities', 'job description']],
    ['requirements', ['yeu cau ung vien', 'yeu cau cong viec', 'yeu cau', 'requirements', 'qualifications']],
    ['benefits', ['quyen loi', 'phuc loi', 'che do dai ngo', 'benefits', 'muc luong', 'luong', 'salary']],
    ['company', ['ve chung toi', 'gioi thieu cong ty', 'about us']],
    ['apply', ['cach thuc ung tuyen', 'ung tuyen', 'how to apply']],
  ],
};

const SECTION_LABELS = {
  header: 'Thông tin chung', contact: 'Liên hệ', summary: 'Giới thiệu', experience: 'Kinh nghiệm',
  skills: 'Kỹ năng', education: 'Học vấn', projects: 'Dự án', certifications: 'Chứng chỉ',
  languages: 'Ngoại ngữ', other: 'Khác', profile: 'Hồ sơ tóm tắt',
  responsibilities: 'Mô tả công việc', requirements: 'Yêu cầu', benefits: 'Quyền lợi',
  company: 'Công ty', apply: 'Ứng tuyển',
};

/** Bỏ dấu tiếng Việt + viết thường, để so khớp tiêu đề mục. */
export function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Dọn rác thường gặp khi bóc text từ PDF. */
export function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ ​\t]/g, ' ')
    .replace(/^[ ]*[●▪■◦•○▸►✓✔*][ ]*/gm, '- ')
    .replace(/^[ ]*(?:page|trang)[ ]*\d+(?:[ ]*\/[ ]*\d+)?[ ]*$/gim, '')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Che email và số điện thoại. */
export function redactPii(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/(?:\+?84|0)(?:[ .-]?\d){8,10}\b/g, '[phone]');
}

/**
 * Nhận diện 1 dòng có phải tiêu đề mục không.
 * @returns {{ section: string, rest: string } | null} rest = nội dung nằm cùng dòng sau dấu ":".
 */
export function detectHeading(line, kind = 'cv') {
  const raw = line.trim();
  if (!raw) return null;
  const folded = fold(raw)
    .replace(/^[ivx]+[.)]\s+/, '') // "II. Học vấn"
    .replace(/^[^a-z]+/, ''); // "1. ", "## ", "- "
  const colon = folded.indexOf(':');
  const head = (colon >= 0 ? folded.slice(0, colon) : folded).replace(/[\s.:–-]+$/, '').trim();
  if (!head || head.length > 40) return null;
  // Tiêu đề thật thường VIẾT HOA hoặc rất ngắn; câu văn thường thì không.
  const titleLike = raw === raw.toUpperCase() || head.split(/\s+/).length <= 4;

  for (const [section, keywords] of SECTION_KEYWORDS[kind]) {
    for (const kw of keywords) {
      if (head === kw) {
        const rawColon = raw.indexOf(':');
        return { section, rest: colon >= 0 && rawColon >= 0 ? raw.slice(rawColon + 1).trim() : '' };
      }
      // "KINH NGHIỆM LÀM VIỆC", "Kỹ năng chuyên môn": bắt đầu bằng từ khoá, ngắn, không phải câu văn.
      const looksLikeTitle = colon < 0 && titleLike && kw.length > 3 && head.startsWith(`${kw} `) && !/[\d,.;]/.test(head);
      if (looksLikeTitle) return { section, rest: '' };
    }
  }
  return null;
}

/** Tách văn bản thành các mục. Phần trước tiêu đề đầu tiên là mục "header". */
export function splitSections(text, kind = 'cv') {
  const sections = [{ section: 'header', lines: [] }];
  for (const line of normalizeText(text).split('\n')) {
    const heading = detectHeading(line, kind);
    if (heading) {
      sections.push({ section: heading.section, lines: heading.rest ? [heading.rest] : [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }
  return sections
    .map((s) => ({ section: s.section, body: s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
    .filter((s) => s.body);
}

/** Cắt 1 khối quá dài theo dòng -> câu, có gối đầu (overlap) để không đứt ngữ cảnh. */
function splitLongBlock(block, maxChars, overlapChars) {
  const units = block
    .split('\n')
    .flatMap((line) => (line.length > maxChars ? line.split(/(?<=[.!?;])\s+/) : [line]))
    .flatMap((u) => (u.length > maxChars ? u.match(new RegExp(`.{1,${maxChars}}`, 'gs')) : [u]))
    .filter((u) => u.trim());
  const pieces = [];
  let current = [];
  let size = 0;
  for (const unit of units) {
    if (current.length && size + unit.length + 1 > maxChars) {
      pieces.push(current.join('\n'));
      const last = current[current.length - 1];
      current = last.length <= overlapChars && last.length + unit.length + 1 <= maxChars ? [last] : [];
      size = current.reduce((n, u) => n + u.length + 1, 0);
    }
    current.push(unit);
    size += unit.length + 1;
  }
  if (current.length) pieces.push(current.join('\n'));
  return pieces;
}

/** Gom các khối (đoạn cách nhau bằng dòng trống) vào chunk, không xé đôi một khối. */
function packBlocks(body, maxChars, overlapChars) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .flatMap((b) => (b.length > maxChars ? splitLongBlock(b, maxChars, overlapChars) : [b]));
  const chunks = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > maxChars) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${block}` : block;
  }
  if (current) chunks.push(current);
  return chunks;
}

function contextLine(parts, section) {
  return [...parts.filter(Boolean), `Mục: ${SECTION_LABELS[section] || section}`].join(' | ');
}

function cleanMetadata(meta) {
  // Vector DB không nhận null/undefined trong metadata -> bỏ hẳn khoá đó.
  return Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

function makeChunk({ docType, docId, section, index, context, body, extra }) {
  const text = `${context}\n${redactPii(body)}`;
  return {
    id: `${docType}:${docId}#${section}-${index}`,
    text,
    metadata: cleanMetadata({ doc_type: docType, doc_id: docId, section, chunk_index: index, ...extra, text }),
  };
}

/**
 * Chunk CV từ TEXT THÔ (dùng khi chưa chạy bước trích xuất).
 * @param {string} text
 * @param {{ candidateId: string, candidateName?: string, currentTitle?: string,
 *           yearsOfExperience?: number, campaignId?: string, maxChars?: number, overlapChars?: number }} opts
 */
export function chunkCvText(text, opts) {
  const { candidateId, candidateName, currentTitle, yearsOfExperience, campaignId, maxChars = 1000, overlapChars = 150 } = opts;
  const head = [
    'CV',
    candidateName,
    currentTitle,
    yearsOfExperience != null ? `Tổng kinh nghiệm: ${yearsOfExperience} năm` : null,
  ];
  const extra = { candidate_id: candidateId, campaign_id: campaignId, years_of_experience: yearsOfExperience };
  const chunks = [];
  for (const { section, body } of splitSections(text, 'cv')) {
    packBlocks(body, maxChars, overlapChars).forEach((piece) => {
      const index = chunks.filter((c) => c.metadata.section === section).length;
      chunks.push(makeChunk({ docType: 'cv', docId: candidateId, section, index, context: contextLine(head, section), body: piece, extra }));
    });
  }
  return chunks;
}

/**
 * Chunk CV từ JSON ĐÃ TRÍCH XUẤT (khuyên dùng - sạch và ổn định hơn text thô).
 * Chunk "profile" gộp TẤT CẢ kỹ năng kèm số năm + tổng số năm kinh nghiệm vào cùng 1 chunk.
 * @param {object} profile  Kết quả của extractCv()
 * @param {{ candidateId: string, campaignId?: string }} opts
 */
export function chunkCvProfile(profile, { candidateId, campaignId }) {
  const years = profile.years_of_experience;
  const skillNames = (profile.skills || []).map((s) => s.name);
  const head = ['CV', profile.full_name, profile.current_title, years != null ? `Tổng kinh nghiệm: ${years} năm` : null];
  const extra = { candidate_id: candidateId, campaign_id: campaignId, years_of_experience: years, skills: skillNames };
  const chunks = [];
  const add = (section, body) => {
    const index = chunks.filter((c) => c.metadata.section === section).length;
    chunks.push(makeChunk({ docType: 'cv', docId: candidateId, section, index, context: contextLine(head, section), body, extra }));
  };

  const skillLine = (profile.skills || [])
    .map((s) => (s.years != null ? `${s.name} (${s.years} năm)` : s.name))
    .join(', ');
  const profileLines = [
    profile.current_title ? `Vị trí gần nhất: ${profile.current_title}` : null,
    years != null ? `Tổng số năm kinh nghiệm: ${years}` : null,
    skillLine ? `Kỹ năng: ${skillLine}` : null,
    profile.location ? `Địa điểm: ${profile.location}` : null,
  ].filter(Boolean);
  if (profileLines.length) add('profile', profileLines.join('\n'));

  for (const job of profile.work_experience || []) {
    const period = [job.start_date, job.end_date].filter(Boolean).join(' – ');
    const title = [job.title, job.company ? `tại ${job.company}` : null, period ? `(${period})` : null].filter(Boolean).join(' ');
    const body = [title, job.description].filter(Boolean).join('\n');
    if (body) add('experience', body);
  }
  for (const edu of profile.education || []) {
    const body = [edu.degree, edu.major, edu.school, edu.graduation_year].filter(Boolean).join(', ');
    if (body) add('education', body);
  }
  return chunks;
}

/**
 * Chunk JD.
 * @param {string} text
 * @param {{ campaignId: string, title?: string, maxChars?: number, overlapChars?: number }} opts
 */
export function chunkJdText(text, { campaignId, title, maxChars = 1000, overlapChars = 150 }) {
  const head = ['JD', title];
  const extra = { campaign_id: campaignId, title };
  const chunks = [];
  for (const { section, body } of splitSections(text, 'jd')) {
    packBlocks(body, maxChars, overlapChars).forEach((piece) => {
      const index = chunks.filter((c) => c.metadata.section === section).length;
      chunks.push(makeChunk({ docType: 'jd', docId: campaignId, section, index, context: contextLine(head, section), body: piece, extra }));
    });
  }
  return chunks;
}
