import { fetchCampaignSetups } from '@app/services/campaigns';
import { matchRateLift } from '@app/services/digitalTwin';
import { precomputedDiagnosis } from '@app/services/precomputed';
import { rubricMatch, type TalentProfile, type TalentRole } from '@app/services/talent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fallbackReason, runWithFallback } from '@/lib/ai/runner';
import { gradeCandidate } from '@/lib/ai/talent';

// Unit tests only: no Supabase stack, no Gemini key, no network.

const ROLE: TalentRole = {
  title: 'Senior Frontend Engineer',
  seniority: 'senior',
  skills: ['React', 'TypeScript', 'GraphQL', 'Accessibility'],
  minExperience: 5,
};
const PROFILE: TalentProfile = {
  role: { en: 'Frontend Engineer', vi: 'Kỹ sư Frontend' },
  yearsOfExperience: 6,
  skills: ['react', 'TypeScript', 'Vue'],
};

describe('AI fallback runner', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_MODE', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps a live answer that arrives inside the deadline', async () => {
    const outcome = await runWithFallback('test', async () => 'live', () => 'precomputed', { deadlineMs: 200 });
    expect(outcome).toMatchObject({ data: 'live', source: 'gemini' });
  });

  it('answers with the precomputed result once the deadline passes', async () => {
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 500));
    const started = Date.now();
    const outcome = await runWithFallback('test', slow, () => 'precomputed', { deadlineMs: 50 });
    expect(outcome).toMatchObject({ data: 'precomputed', source: 'fallback', reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(400);
  });

  it('falls back when Gemini is rate-limited', async () => {
    const limited = () => Promise.reject(Object.assign(new Error('Gemini trả lỗi HTTP 429: RESOURCE_EXHAUSTED'), { status: 429 }));
    const outcome = await runWithFallback('test', limited, () => 'precomputed');
    expect(outcome).toMatchObject({ data: 'precomputed', source: 'fallback', reason: 'rate_limited' });
  });

  it('never calls Gemini without a key or in precomputed mode', async () => {
    const live = vi.fn(async () => 'live');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await runWithFallback('test', live, () => 'precomputed')).toMatchObject({ reason: 'not_configured' });
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_MODE', 'precomputed');
    expect(await runWithFallback('test', live, () => 'precomputed')).toMatchObject({ reason: 'disabled' });
    expect(live).not.toHaveBeenCalled();
  });

  it('classifies Gemini failures', () => {
    expect(fallbackReason(Object.assign(new Error('x'), { status: 503 }))).toBe('unavailable');
    expect(fallbackReason(Object.assign(new Error('Gemini không phản hồi sau 4000ms (timeout)'), { status: 408 }))).toBe('timeout');
    expect(fallbackReason(new Error('Gemini trả sai schema'))).toBe('invalid_output');
  });
});

describe('Talent Agent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('grades skills, experience and the rest out of 50 / 30 / 20, in both languages', () => {
    const match = rubricMatch(ROLE, PROFILE);
    // 2 of 4 skills → 25; 6 years against 5 → 30; "frontend" and "engineer" shared with the title → 8 + 8.
    expect(match.proof.breakdown).toEqual({ skills: 25, experience: 30, other: 16 });
    expect(match.score).toBe(71);
    expect(match.proof.matchedSkills).toEqual(['React', 'TypeScript']);
    expect(match.proof.missingSkills).toEqual(['GraphQL', 'Accessibility']);
    expect(match.proof.source).toBe('fallback');
    expect(match.assessment.en).toMatch(/^Good fit for Senior Frontend Engineer/);
    expect(match.assessment.vi).toMatch(/^Phù hợp với vị trí Senior Frontend Engineer/);
  });

  it('uses the precomputed rubric when Gemini is not configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const outcome = await gradeCandidate(ROLE, 'Lan Nguyen', PROFILE, 'vi');
    expect(outcome.source).toBe('fallback');
    expect(outcome.data).toEqual(rubricMatch(ROLE, PROFILE));
  });
});

describe('precomputed Optimization Agent answers', () => {
  it('serves the saved Gemini diagnosis for the seeded campaign, in both languages, with live lifts', async () => {
    const setups = await fetchCampaignSetups();
    const setup = setups['senior-frontend-engineer'];
    const draft = precomputedDiagnosis('senior-frontend-engineer', {
      campaignName: { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' },
      setup,
      matchRate: 42,
      targetMatchRate: 60,
    });
    expect(draft?.severity).toBe('critical');
    expect(draft?.content.title.en).toBe('Candidate match rate is 18 points below target');
    expect(draft?.content.rootCause.summary.en).not.toBe(draft?.content.rootCause.summary.vi);
    const [fewerYears] = draft?.content.suggestedFixes ?? [];
    expect(fewerYears.patch).toEqual({ minExperience: 5 });
    expect(fewerYears.expectedLift).toBe(Math.max(0, matchRateLift(setup, { minExperience: 5 })));
  });

  it("reads other campaigns' setups with the Digital Twin, and stays quiet on target", async () => {
    const setups = await fetchCampaignSetups();
    const setup = { ...setups['senior-frontend-engineer'], salaryMin: 60, salaryMax: 70, channels: ['itviec' as const] };
    const input = { campaignName: { en: 'Platform Engineer', vi: 'Kỹ sư nền tảng' }, setup, matchRate: 30, targetMatchRate: 60 };
    const draft = precomputedDiagnosis('platform-engineer', input);
    expect(draft?.content.suggestedFixes.length).toBeGreaterThan(0);
    expect(draft?.content.suggestedFixes.filter((fix) => fix.recommended)).toHaveLength(1);
    for (const fix of draft?.content.suggestedFixes ?? []) {
      expect(fix.patch).toBeDefined();
      expect(fix.actionLabel.en).not.toBe(fix.actionLabel.vi);
    }
    expect(precomputedDiagnosis('platform-engineer', { ...input, matchRate: 64 })).toBeNull();
  });
});
