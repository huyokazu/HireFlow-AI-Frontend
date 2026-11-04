export type Candidate = {
  id: string;
  name: string;
  role: string;
  location: string;
  yearsOfExperience: number;
  /** 0–100, produced by the Matching Agent. */
  matchScore: number;
  skills: string[];
  aiAssessment: string;
};

const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'cand_001',
    name: 'Amelia Chen',
    role: 'Senior Frontend Engineer',
    location: 'Singapore',
    yearsOfExperience: 7,
    matchScore: 94,
    skills: ['React', 'TypeScript', 'Next.js', 'Design Systems', 'GraphQL', 'Playwright', 'Storybook'],
    aiAssessment:
      'Led a design-system migration across 12 product teams and cut bundle size by 38%. Strong ownership signals and mentoring history; salary expectation sits inside the approved band.',
  },
  {
    id: 'cand_002',
    name: 'Marcus Okafor',
    role: 'Frontend Engineer II',
    location: 'Lagos · Remote',
    yearsOfExperience: 5,
    matchScore: 88,
    skills: ['React Native', 'TypeScript', 'Reanimated', 'Supabase', 'Jest'],
    aiAssessment:
      'Shipped two consumer apps with 1M+ installs using React Native. Deep animation and performance experience; limited exposure to large B2B dashboards.',
  },
  {
    id: 'cand_003',
    name: 'Sofia Martínez',
    role: 'UI Engineer',
    location: 'Madrid, Spain',
    yearsOfExperience: 6,
    matchScore: 81,
    skills: ['Vue', 'TypeScript', 'Tailwind CSS', 'Accessibility', 'Figma'],
    aiAssessment:
      'Excellent accessibility track record (WCAG 2.2 audits) and close collaboration with design. Primary framework is Vue, so expect a short ramp-up on React.',
  },
  {
    id: 'cand_004',
    name: 'Daniel Tran',
    role: 'Full-Stack Engineer',
    location: 'Ho Chi Minh City',
    yearsOfExperience: 4,
    matchScore: 76,
    skills: ['React', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Docker', 'AWS'],
    aiAssessment:
      'Balanced full-stack profile with solid React fundamentals. Frontend architecture depth is moderate; a strong fit if the team values backend fluency.',
  },
  {
    id: 'cand_005',
    name: 'Priya Raman',
    role: 'Frontend Developer',
    location: 'Bengaluru, India',
    yearsOfExperience: 3,
    matchScore: 68,
    skills: ['React', 'JavaScript', 'Redux', 'CSS'],
    aiAssessment:
      'Fast learner with consistent delivery on feature work. Below the seniority target for this role; consider for the mid-level pipeline instead.',
  },
  {
    id: 'cand_006',
    name: 'Jonas Becker',
    role: 'Software Engineer',
    location: 'Berlin, Germany',
    yearsOfExperience: 9,
    matchScore: 52,
    skills: ['Angular', 'Java', 'Spring', 'RxJS'],
    aiAssessment:
      'Very experienced engineer, but most recent work is Angular and backend-heavy. Low overlap with the React and mobile requirements of this campaign.',
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
