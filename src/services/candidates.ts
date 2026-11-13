import type { Localized } from '../i18n/types';
import { loadBootstrap } from './bootstrap';
import { getRemote, readWithFallback } from './remote';
import { skillOverlap, type ProofOfSkill } from './talent';

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
  /** The Talent Agent's rubric behind `matchScore`; missing for candidates scored before it existed. */
  proof?: ProofOfSkill;
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

/** The featured campaign's required skills (its mock setup), which the demo rubric grades against. */
const FEATURED_SKILLS = ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Testing Library', 'Web Performance', 'Accessibility'];

/**
 * The Talent Agent's rubric for the demo candidates, precomputed: points per part (adding up to
 * each match score) and its reasons, in both languages.
 */
const MOCK_PROOFS: Record<string, { breakdown: ProofOfSkill['breakdown']; reasons: [en: string, vi: string][] }> = {
  cand_001: {
    breakdown: { skills: 46, experience: 30, other: 18 },
    reasons: [
      ['Core stack match: React, TypeScript, Next.js and GraphQL.', 'Khớp stack chính: React, TypeScript, Next.js và GraphQL.'],
      ['Led a design-system migration across 12 product teams.', 'Dẫn dắt chuyển đổi design system cho 12 nhóm sản phẩm.'],
      ['Cut bundle size by 38%: clear web performance evidence.', 'Giảm 38% kích thước bundle: bằng chứng rõ về hiệu năng web.'],
    ],
  },
  cand_002: {
    breakdown: { skills: 42, experience: 26, other: 20 },
    reasons: [
      ['TypeScript and React Native carry straight over to React.', 'TypeScript và React Native áp dụng thẳng cho React.'],
      ['Shipped two consumer apps with 1M+ installs.', 'Đã phát hành hai ứng dụng hơn 1 triệu lượt cài.'],
      ['5 years, two below the 7-year minimum.', '5 năm, thiếu 2 năm so với mức tối thiểu 7 năm.'],
    ],
  },
  cand_003: {
    breakdown: { skills: 34, experience: 27, other: 20 },
    reasons: [
      ['Accessibility specialist with WCAG 2.2 audits.', 'Chuyên gia khả năng tiếp cận, từng kiểm định WCAG 2.2.'],
      ['Works in Vue, so expect a short ramp-up on React.', 'Dùng Vue, cần thời gian ngắn để làm quen React.'],
      ['6 years, close to the 7-year minimum.', '6 năm, gần mức tối thiểu 7 năm.'],
    ],
  },
  cand_004: {
    breakdown: { skills: 34, experience: 24, other: 18 },
    reasons: [
      ['Solid React fundamentals plus backend fluency.', 'Nền tảng React vững cùng năng lực backend.'],
      ['Frontend architecture depth is moderate.', 'Chiều sâu kiến trúc frontend ở mức khá.'],
      ['4 years, below the 7-year minimum.', '4 năm, dưới mức tối thiểu 7 năm.'],
    ],
  },
  cand_005: {
    breakdown: { skills: 32, experience: 18, other: 18 },
    reasons: [
      ['Steady feature delivery with React and Redux.', 'Bàn giao tính năng đều đặn với React và Redux.'],
      ['3 years, well below the 7-year minimum.', '3 năm, thấp hơn nhiều so với mức 7 năm.'],
    ],
  },
  cand_006: {
    breakdown: { skills: 12, experience: 30, other: 10 },
    reasons: [
      ['9 years clears the experience bar.', '9 năm, vượt yêu cầu kinh nghiệm.'],
      ['Angular and Java focus, with little React overlap.', 'Tập trung Angular và Java, ít trùng với React.'],
    ],
  },
};

function withMockProof(candidate: Candidate): Candidate {
  const graded = MOCK_PROOFS[candidate.id];
  if (!graded) return candidate;
  const { matched, missing } = skillOverlap(FEATURED_SKILLS, candidate.skills);
  return {
    ...candidate,
    proof: {
      breakdown: graded.breakdown,
      matchedSkills: matched,
      missingSkills: missing,
      reasons: graded.reasons.map(([en, vi]) => ({ en, vi })),
      source: 'fallback',
    },
  };
}

/**
 * Returns the candidates the Matching Agent ranked for a campaign, best match first. The featured
 * campaign's come with the app's first request; any other campaign's are fetched on their own.
 */
export async function fetchMatchedCandidates(campaignId: string): Promise<Candidate[]> {
  return readWithFallback(
    'matched candidates',
    async (remote) => {
      const bootstrap = await loadBootstrap(remote);
      if (bootstrap.featuredCampaignId === campaignId) return bootstrap.matchedCandidates;
      return remote.request<Candidate[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/candidates`);
    },
    async () => MOCK_CANDIDATES.map(withMockProof).sort((a, b) => b.matchScore - a.matchScore),
  );
}

/**
 * Saves HR's "skip" on a candidate in the review deck, so the deck doesn't offer them again for
 * this campaign. They stay on the pipeline board. Rejects when the skip was not saved.
 */
export async function skipMatchedCandidate(campaignId: string, candidateId: string): Promise<void> {
  const remote = getRemote();
  if (!remote) return;
  await remote.request<{ skipped: boolean }>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/candidates/${encodeURIComponent(candidateId)}/skip`,
    { method: 'POST' },
  );
}
