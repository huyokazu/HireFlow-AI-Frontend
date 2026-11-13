import { z } from 'zod';

import type { AgentKey, CampaignAgent, CampaignDraft, PausedAgents } from '@/lib/contracts';

import {
  AGENT_KEYS,
  CAMPAIGN_AGENTS,
  DEPARTMENTS,
  EXPERIENCE_LIMITS,
  OPENINGS_LIMITS,
  PIPELINE_STAGES,
  SALARY_LIMITS,
  SENIORITIES,
  SOURCING_CHANNELS,
  WORK_MODES,
} from './constants';

/** Path ids (campaign, candidate, alert, fix): opaque text keys. */
export const idSchema = z.string().trim().min(1).max(100);

const unique = (values: readonly string[]) => new Set(values.map((value) => value.toLowerCase())).size === values.length;

export const campaignDraftSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    department: z.enum(DEPARTMENTS).nullable(),
    location: z.string().trim().max(120),
    workMode: z.enum(WORK_MODES),
    seniority: z.enum(SENIORITIES),
    headcount: z.int().min(OPENINGS_LIMITS.min).max(OPENINGS_LIMITS.max),
    skills: z.array(z.string().trim().min(1).max(60)).max(30).refine(unique, 'Skills must be unique'),
    minExperience: z.int().min(EXPERIENCE_LIMITS.min).max(EXPERIENCE_LIMITS.max),
    salaryMin: z.number().min(SALARY_LIMITS.min).max(SALARY_LIMITS.max),
    salaryMax: z.number().min(SALARY_LIMITS.min).max(SALARY_LIMITS.max),
    channels: z.array(z.enum(SOURCING_CHANNELS)).max(SOURCING_CHANNELS.length).refine(unique, 'Channels must be unique'),
    agents: z.strictObject(
      Object.fromEntries(CAMPAIGN_AGENTS.map((agent) => [agent, z.boolean()])) as Record<CampaignAgent, z.ZodBoolean>,
    ),
    targetMatchRate: z.int().min(0).max(100),
  })
  .refine((draft) => draft.salaryMin <= draft.salaryMax, {
    message: 'salaryMin must not exceed salaryMax',
    path: ['salaryMax'],
  }) satisfies z.ZodType<CampaignDraft>;

export const languageSchema = z.enum(['en', 'vi']);

export const launchCampaignBody = z.strictObject({ draft: campaignDraftSchema, language: languageSchema.optional() });
export const updateSetupBody = z.strictObject({ setup: campaignDraftSchema });

export const moveCandidateBody = z.strictObject({
  stage: z.enum(PIPELINE_STAGES),
  campaignId: idSchema.optional(),
});

export const approveFixBody = z.strictObject({ fixId: idSchema });

export const pausedChangesBody = z.strictObject({
  changes: z.strictObject(
    Object.fromEntries(AGENT_KEYS.map((agent) => [agent, z.boolean().optional()])) as Record<
      AgentKey,
      z.ZodOptional<z.ZodBoolean>
    >,
  ),
}) satisfies z.ZodType<{ changes: Partial<PausedAgents> }>;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const updateMeBody = z.strictObject({
  displayName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(['en', 'vi']).optional(),
  timezone: z.string().max(64).refine(isTimeZone, 'Unknown IANA time zone').optional(),
  defaultWorkspaceId: z.uuid().optional(),
});

export const eventsQuery = z.strictObject({
  /** Event id cursor: returns events older than this one. */
  before: z.string().regex(/^\d{1,18}$/, 'Must be an event id').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
});

export const bootstrapQuery = z.strictObject({ featured: idSchema.optional() });
