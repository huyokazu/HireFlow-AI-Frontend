import type { Localized } from '../i18n/types';
import type { CampaignDraft } from './campaigns';

/**
 * The Talent Agent's scoring rubric, shared by the app and the backend: the backend asks Gemini for
 * it (`ai/prompts/talentMatching.js`) and falls back to {@link rubricMatch} when Gemini is slow,
 * rate-limited or not configured, so a score always comes back in the same shape. Like every
 * service, this module stays free of React Native so the backend can import it.
 */

/** Points available per rubric part; they add up to the 0–100 match score. */
export const RUBRIC_MAX = { skills: 50, experience: 30, other: 20 } as const;

/** A score at or above this counts the candidate as qualified for the campaign's match rate. */
export const QUALIFIED_SCORE = 70;

/** Where a score came from: Gemini, or the precomputed rubric used when Gemini can't answer in time. */
export type AiSource = 'gemini' | 'fallback';

/** The evidence behind a match score, part by part, as the Talent Agent graded it. */
export type ProofOfSkill = {
  /** Points per rubric part, out of {@link RUBRIC_MAX}; they add up to the match score. */
  breakdown: { skills: number; experience: number; other: number };
  /** Required skills the candidate shows, as the campaign spells them. */
  matchedSkills: string[];
  /** Required skills the candidate doesn't show. */
  missingSkills: string[];
  /** Up to four short reasons for the score. */
  reasons: Localized[];
  source: AiSource;
};

/** What the rubric needs to know about a candidate. */
export type TalentProfile = {
  role: Localized;
  yearsOfExperience: number;
  skills: string[];
};

/** What the rubric needs to know about the role. */
export type TalentRole = Pick<CampaignDraft, 'title' | 'seniority' | 'skills' | 'minExperience'> &
  Partial<Pick<CampaignDraft, 'location' | 'workMode' | 'salaryMin' | 'salaryMax'>>;

export type TalentMatch = { score: number; assessment: Localized; proof: ProofOfSkill };

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();

/** Splits the role's skills into the ones the candidate shows and the ones they don't. */
export function skillOverlap(required: readonly string[], have: readonly string[]) {
  const owned = new Set(have.map(fold));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of required) (owned.has(fold(skill)) ? matched : missing).push(skill);
  return { matched, missing };
}

/** The job description the Talent Agent scores against, built from the campaign's setup. */
export function jobDescription(role: TalentRole): string {
  const lines = [
    `Role: ${role.title} (${role.seniority}).`,
    `Requires at least ${role.minExperience} years of experience.`,
    `Required skills: ${role.skills.join(', ') || 'not specified'}.`,
  ];
  if (role.location) lines.push(`Location: ${role.location}${role.workMode ? ` (${role.workMode})` : ''}.`);
  if (role.salaryMin !== undefined && role.salaryMax !== undefined) {
    lines.push(`Salary band: ${role.salaryMin}-${role.salaryMax} thousand USD per year.`);
  }
  return lines.join('\n');
}

/** A short CV, built from a stored profile, for candidates already in the talent pool. */
export function profileText(name: string, profile: TalentProfile): string {
  return [
    name,
    `Current role: ${profile.role.en}.`,
    `Experience: ${profile.yearsOfExperience} years.`,
    `Skills: ${profile.skills.join(', ')}.`,
  ].join('\n');
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

/**
 * Grades a candidate against the role without a model: the share of required skills they show,
 * their years against the minimum, and how close their current role is to this one. It is the
 * precomputed answer when Gemini can't respond, and it explains itself in both languages.
 */
export function rubricMatch(role: TalentRole, profile: TalentProfile): TalentMatch {
  const { matched, missing } = skillOverlap(role.skills, profile.skills);
  const skills = role.skills.length === 0 ? RUBRIC_MAX.skills / 2 : (RUBRIC_MAX.skills * matched.length) / role.skills.length;
  const experience =
    role.minExperience <= 0
      ? RUBRIC_MAX.experience
      : RUBRIC_MAX.experience * Math.min(1, profile.yearsOfExperience / role.minExperience);
  const titleWords = new Set(fold(role.title).split(' ').filter((word) => word.length > 2));
  const sharedWords = fold(profile.role.en)
    .split(' ')
    .filter((word) => titleWords.has(word)).length;
  const other = 8 + Math.min(12, sharedWords * 4);
  return matchFromBreakdown(role, profile, { skills, experience, other }, 'fallback', { matched, missing });
}

/**
 * Turns rubric points into a match with its evidence. Used for the precomputed rubric and for demo
 * candidates whose points were graded ahead of time.
 */
export function matchFromBreakdown(
  role: TalentRole,
  profile: TalentProfile,
  points: ProofOfSkill['breakdown'],
  source: AiSource,
  overlap = skillOverlap(role.skills, profile.skills),
): TalentMatch {
  const breakdown = {
    skills: clamp(points.skills, RUBRIC_MAX.skills),
    experience: clamp(points.experience, RUBRIC_MAX.experience),
    other: clamp(points.other, RUBRIC_MAX.other),
  };
  const score = breakdown.skills + breakdown.experience + breakdown.other;
  const { matched, missing } = overlap;
  const years = profile.yearsOfExperience;

  const reasons: Localized[] = [];
  if (role.skills.length > 0) {
    const shown = matched.slice(0, 3).join(', ');
    reasons.push({
      en: `Shows ${matched.length} of ${role.skills.length} required skills${shown ? `: ${shown}` : ''}.`,
      vi: `Có ${matched.length}/${role.skills.length} kỹ năng yêu cầu${shown ? `: ${shown}` : ''}.`,
    });
  }
  reasons.push(
    years >= role.minExperience
      ? { en: `${years} years of experience meets the ${role.minExperience}-year minimum.`, vi: `${years} năm kinh nghiệm, đạt mức tối thiểu ${role.minExperience} năm.` }
      : { en: `${years} years of experience, below the ${role.minExperience}-year minimum.`, vi: `${years} năm kinh nghiệm, dưới mức tối thiểu ${role.minExperience} năm.` },
  );
  if (missing.length > 0) {
    const gaps = missing.slice(0, 3).join(', ');
    reasons.push({ en: `To verify in interview: ${gaps}.`, vi: `Cần kiểm tra khi phỏng vấn: ${gaps}.` });
  }

  const verdict: Localized =
    score >= 85
      ? { en: 'Strong fit for', vi: 'Rất phù hợp với' }
      : score >= QUALIFIED_SCORE
        ? { en: 'Good fit for', vi: 'Phù hợp với' }
        : { en: 'Partial fit for', vi: 'Phù hợp một phần với' };
  const assessment: Localized = {
    en: `${verdict.en} ${role.title}: ${reasons.map((reason) => reason.en).join(' ')}`,
    vi: `${verdict.vi} vị trí ${role.title}: ${reasons.map((reason) => reason.vi).join(' ')}`,
  };

  return {
    score,
    assessment,
    proof: { breakdown, matchedSkills: matched, missingSkills: missing, reasons: reasons.slice(0, 4), source },
  };
}
