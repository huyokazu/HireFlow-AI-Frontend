import type { Localized } from '../i18n/types';

export type Candidate = {
  id: string;
  name: string;
  role: Localized;
  location: Localized;
  yearsOfExperience: number;
  /** 0–100, produced by the Matching Agent. */
  matchScore: number;
  /** Technology names, the same in every language. */
  skills: string[];
  aiAssessment: Localized;
};

const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'cand_001',
    name: 'Amelia Chen',
    role: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
    location: { en: 'Singapore', vi: 'Singapore' },
    yearsOfExperience: 7,
    matchScore: 94,
    skills: ['React', 'TypeScript', 'Next.js', 'Design Systems', 'GraphQL', 'Playwright', 'Storybook'],
    aiAssessment: {
      en: 'Led a design-system migration across 12 product teams and cut bundle size by 38%. Strong ownership signals and mentoring history; salary expectation sits inside the approved band.',
      vi: 'Dẫn dắt việc chuyển đổi design system cho 12 nhóm sản phẩm và giảm 38% kích thước bundle. Tinh thần làm chủ và kinh nghiệm mentor rõ nét; mức lương kỳ vọng nằm trong khung đã duyệt.',
    },
  },
  {
    id: 'cand_002',
    name: 'Marcus Okafor',
    role: { en: 'Frontend Engineer II', vi: 'Kỹ sư Frontend bậc II' },
    location: { en: 'Lagos · Remote', vi: 'Lagos · Làm từ xa' },
    yearsOfExperience: 5,
    matchScore: 88,
    skills: ['React Native', 'TypeScript', 'Reanimated', 'Supabase', 'Jest'],
    aiAssessment: {
      en: 'Shipped two consumer apps with 1M+ installs using React Native. Deep animation and performance experience; limited exposure to large B2B dashboards.',
      vi: 'Đã phát hành hai ứng dụng tiêu dùng hơn 1 triệu lượt cài đặt bằng React Native. Am hiểu sâu về animation và hiệu năng; ít kinh nghiệm với các dashboard B2B quy mô lớn.',
    },
  },
  {
    id: 'cand_003',
    name: 'Sofia Martínez',
    role: { en: 'UI Engineer', vi: 'Kỹ sư giao diện (UI)' },
    location: { en: 'Madrid, Spain', vi: 'Madrid, Tây Ban Nha' },
    yearsOfExperience: 6,
    matchScore: 81,
    skills: ['Vue', 'TypeScript', 'Tailwind CSS', 'Accessibility', 'Figma'],
    aiAssessment: {
      en: 'Excellent accessibility track record (WCAG 2.2 audits) and close collaboration with design. Primary framework is Vue, so expect a short ramp-up on React.',
      vi: 'Thành tích xuất sắc về khả năng tiếp cận (kiểm định WCAG 2.2) và phối hợp chặt chẽ với đội thiết kế. Framework chính là Vue nên cần một thời gian ngắn để làm quen với React.',
    },
  },
  {
    id: 'cand_004',
    name: 'Daniel Tran',
    role: { en: 'Full-Stack Engineer', vi: 'Kỹ sư Full-Stack' },
    location: { en: 'Ho Chi Minh City', vi: 'TP. Hồ Chí Minh' },
    yearsOfExperience: 4,
    matchScore: 76,
    skills: ['React', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Docker', 'AWS'],
    aiAssessment: {
      en: 'Balanced full-stack profile with solid React fundamentals. Frontend architecture depth is moderate; a strong fit if the team values backend fluency.',
      vi: 'Hồ sơ full-stack cân bằng với nền tảng React vững chắc. Chiều sâu về kiến trúc frontend ở mức khá; rất phù hợp nếu đội ngũ coi trọng năng lực backend.',
    },
  },
  {
    id: 'cand_005',
    name: 'Priya Raman',
    role: { en: 'Frontend Developer', vi: 'Lập trình viên Frontend' },
    location: { en: 'Bengaluru, India', vi: 'Bengaluru, Ấn Độ' },
    yearsOfExperience: 3,
    matchScore: 68,
    skills: ['React', 'JavaScript', 'Redux', 'CSS'],
    aiAssessment: {
      en: 'Fast learner with consistent delivery on feature work. Below the seniority target for this role; consider for the mid-level pipeline instead.',
      vi: 'Học hỏi nhanh và bàn giao tính năng đều đặn. Chưa đạt mức thâm niên yêu cầu cho vị trí này; nên cân nhắc cho nhóm ứng viên cấp trung.',
    },
  },
  {
    id: 'cand_006',
    name: 'Jonas Becker',
    role: { en: 'Software Engineer', vi: 'Kỹ sư phần mềm' },
    location: { en: 'Berlin, Germany', vi: 'Berlin, Đức' },
    yearsOfExperience: 9,
    matchScore: 52,
    skills: ['Angular', 'Java', 'Spring', 'RxJS'],
    aiAssessment: {
      en: 'Very experienced engineer, but most recent work is Angular and backend-heavy. Low overlap with the React and mobile requirements of this campaign.',
      vi: 'Kỹ sư giàu kinh nghiệm, nhưng công việc gần đây chủ yếu là Angular và backend. Ít trùng khớp với yêu cầu về React và mobile của chiến dịch này.',
    },
  },
];

/**
 * Returns the candidates the Matching Agent ranked for a campaign, best match first.
 * Mock implementation: replace the body with a Supabase query
 * (e.g. `supabase.from('campaign_matches').select('*').eq('campaign_id', campaignId)`).
 */
export async function fetchMatchedCandidates(_campaignId: string): Promise<Candidate[]> {
  return [...MOCK_CANDIDATES].sort((a, b) => b.matchScore - a.matchScore);
}
