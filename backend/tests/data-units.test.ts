import { describe, expect, it } from 'vitest';

import { toErrorResponse } from '@/lib/api/http';
import type { PausedAgents } from '@/lib/contracts';
import { pauseEvents } from '@/lib/data/agents';
import { currentMonday } from '@/lib/data/analytics';
import { newCampaignId, slugify } from '@/lib/data/campaigns';
import { campaignDraftSchema, pausedChangesBody } from '@/lib/data/schemas';

const NONE: PausedAgents = { sourcing: false, matching: false, scheduling: false, offer: false, selfHealing: false };
const ALL: PausedAgents = { sourcing: true, matching: true, scheduling: true, offer: true, selfHealing: true };

describe('pause events follow the app rules', () => {
  it('names a single agent', () => {
    expect(pauseEvents(NONE, { ...NONE, offer: true })).toEqual([{ kind: 'agentPaused', actor: 'offer' }]);
    expect(pauseEvents({ ...NONE, offer: true }, NONE)).toEqual([{ kind: 'agentResumed', actor: 'offer' }]);
  });

  it('counts several agents', () => {
    expect(pauseEvents(NONE, { ...NONE, sourcing: true, matching: true })).toEqual([
      { kind: 'agentsPaused', actor: 'orchestrator', count: 2 },
    ]);
  });

  it('says "all" when every agent ends up paused or running', () => {
    expect(pauseEvents(NONE, ALL)).toEqual([{ kind: 'allPaused', actor: 'orchestrator' }]);
    expect(pauseEvents({ ...ALL, offer: false }, NONE)).toEqual([{ kind: 'allResumed', actor: 'orchestrator' }]);
  });

  it('a single change that completes "all" still names the agent', () => {
    expect(pauseEvents({ ...ALL, offer: false }, ALL)).toEqual([{ kind: 'agentPaused', actor: 'offer' }]);
  });

  it('logs both directions of a mixed change, and nothing for no change', () => {
    expect(pauseEvents({ ...NONE, sourcing: true }, { ...NONE, matching: true })).toEqual([
      { kind: 'agentPaused', actor: 'matching' },
      { kind: 'agentResumed', actor: 'sourcing' },
    ]);
    expect(pauseEvents(NONE, NONE)).toEqual([]);
  });
});

describe('campaign ids', () => {
  it('slugifies Vietnamese and punctuation', () => {
    expect(slugify('Kỹ sư Đám mây (Go)')).toBe('ky-su-dam-may-go');
    expect(newCampaignId('Data Engineer')).toMatch(/^data-engineer-[0-9a-f]{8}$/);
    expect(newCampaignId('!!!')).toMatch(/^campaign-[0-9a-f]{8}$/);
  });
});

describe('week start', () => {
  it('is the Monday of the current week in the user time zone', () => {
    // Monday 2026-11-09 00:30 in Bangkok is still Sunday in UTC.
    const now = new Date('2026-11-08T17:30:00.000Z');
    expect(currentMonday('Asia/Bangkok', now)).toBe('2026-11-09');
    expect(currentMonday('UTC', now)).toBe('2026-11-02');
    expect(currentMonday('Not/AZone', now)).toBe('2026-11-02');
  });
});

describe('validation', () => {
  const draft = {
    title: 'Engineer',
    department: null,
    location: '',
    workMode: 'remote',
    seniority: 'mid',
    headcount: 1,
    skills: [],
    minExperience: 0,
    salaryMin: 50,
    salaryMax: 60,
    channels: ['linkedin'],
    agents: { sourcing: true, matching: false, scheduling: true, selfHealing: true },
    targetMatchRate: 60,
  };

  it('accepts a complete draft and rejects bad ones', () => {
    expect(campaignDraftSchema.safeParse(draft).success).toBe(true);
    expect(campaignDraftSchema.safeParse({ ...draft, salaryMin: 90 }).success).toBe(false);
    expect(campaignDraftSchema.safeParse({ ...draft, title: '   ' }).success).toBe(false);
    expect(campaignDraftSchema.safeParse({ ...draft, extra: 1 }).success).toBe(false);
    expect(campaignDraftSchema.safeParse({ ...draft, channels: ['linkedin', 'linkedin'] }).success).toBe(false);
  });

  it('rejects unknown agents in a pause change', () => {
    expect(pausedChangesBody.safeParse({ changes: { offer: true } }).success).toBe(true);
    expect(pausedChangesBody.safeParse({ changes: { orchestrator: true } }).success).toBe(false);
  });
});

describe('database errors', () => {
  it('reach the client as a fixed message, never the raw database text', async () => {
    const raw = { code: '23505', message: 'duplicate key value violates unique constraint "campaigns_pkey"' };
    const original = console.error;
    console.error = () => {};
    try {
      const res = toErrorResponse(raw);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: { code: 'CONFLICT', message: 'Conflict with existing data' } });
    } finally {
      console.error = original;
    }
  });
});
