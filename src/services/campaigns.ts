import type { Language, Localized } from '../i18n/types';
import type { AgentEvent } from './agents';
import { loadBootstrap } from './bootstrap';
import type { CampaignSummary } from './dashboard';
import { getRemote, mockDelay, readWithFallback } from './remote';

export type DepartmentKey = 'engineering' | 'design' | 'data' | 'product' | 'operations' | 'sales';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';
export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';
export type SourcingChannel = 'linkedin' | 'topcv' | 'itviec' | 'vietnamworks' | 'wellfound' | 'referrals';
export type CampaignAgent = 'sourcing' | 'matching' | 'scheduling' | 'selfHealing';

export const DEPARTMENTS: readonly DepartmentKey[] = [
  'engineering',
  'design',
  'data',
  'product',
  'operations',
  'sales',
];
export const WORK_MODES: readonly WorkMode[] = ['onsite', 'hybrid', 'remote'];
export const SENIORITIES: readonly Seniority[] = ['junior', 'mid', 'senior', 'lead'];
export const SOURCING_CHANNELS: readonly SourcingChannel[] = [
  'linkedin',
  'topcv',
  'itviec',
  'vietnamworks',
  'wellfound',
  'referrals',
];
export const CAMPAIGN_AGENTS: readonly CampaignAgent[] = ['sourcing', 'matching', 'scheduling', 'selfHealing'];

/** Department names travel with the campaign record, like the other campaign data. */
export const DEPARTMENT_NAMES: Record<DepartmentKey, Localized> = {
  engineering: { en: 'Engineering', vi: 'Kỹ thuật' },
  design: { en: 'Design', vi: 'Thiết kế' },
  data: { en: 'Data', vi: 'Dữ liệu' },
  product: { en: 'Product', vi: 'Sản phẩm' },
  operations: { en: 'Operations', vi: 'Vận hành' },
  sales: { en: 'Sales', vi: 'Kinh doanh' },
};

/** Job boards keep their brand names; only referrals are translated. */
export const CHANNEL_NAMES: Record<SourcingChannel, Localized> = {
  linkedin: { en: 'LinkedIn', vi: 'LinkedIn' },
  topcv: { en: 'TopCV', vi: 'TopCV' },
  itviec: { en: 'ITviec', vi: 'ITviec' },
  vietnamworks: { en: 'VietnamWorks', vi: 'VietnamWorks' },
  wellfound: { en: 'Wellfound', vi: 'Wellfound' },
  referrals: { en: 'Employee referrals', vi: 'Giới thiệu nội bộ' },
};

export type CampaignDraft = {
  title: string;
  department: DepartmentKey | null;
  location: string;
  workMode: WorkMode;
  seniority: Seniority;
  headcount: number;
  skills: string[];
  minExperience: number;
  /** Annual salary band, in thousands of USD. */
  salaryMin: number;
  salaryMax: number;
  channels: SourcingChannel[];
  agents: Record<CampaignAgent, boolean>;
  /** Percent, 0–100. */
  targetMatchRate: number;
};

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  title: '',
  department: null,
  location: '',
  workMode: 'hybrid',
  seniority: 'senior',
  headcount: 1,
  skills: [],
  minExperience: 3,
  salaryMin: 90,
  salaryMax: 120,
  channels: ['linkedin', 'itviec'],
  agents: { sourcing: true, matching: true, scheduling: true, selfHealing: true },
  targetMatchRate: 60,
};

export const SALARY_LIMITS = { min: 30, max: 300, step: 5 };
/** Years of experience a campaign can ask for. */
export const EXPERIENCE_LIMITS = { min: 0, max: 15 };
/** People one campaign can hire for. */
export const OPENINGS_LIMITS = { min: 1, max: 20 };

// Keyword rules (English and Vietnamese titles) standing in for the AI skill suggester;
// skills from earlier rules come first.
const TITLE_SKILLS: { pattern: RegExp; skills: string[] }[] = [
  {
    pattern: /mobile|ios|android|react native|di động/i,
    skills: ['React Native', 'TypeScript', 'Reanimated', 'Expo'],
  },
  {
    pattern: /front|web|ui engineer|giao diện/i,
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Accessibility'],
  },
  {
    pattern: /back|api|platform|node|java|golang|máy chủ/i,
    skills: ['Node.js', 'PostgreSQL', 'REST APIs', 'Docker', 'AWS'],
  },
  {
    pattern: /data|analytics|machine learning|\bml\b|dữ liệu|phân tích|học máy/i,
    skills: ['Python', 'SQL', 'dbt', 'Airflow', 'Spark'],
  },
  { pattern: /design|ux|\bui\b|thiết kế/i, skills: ['Figma', 'Prototyping', 'Design Systems', 'User Research'] },
  { pattern: /product manager|\bpm\b|quản lý sản phẩm/i, skills: ['Roadmapping', 'Product Discovery', 'Analytics'] },
  {
    pattern: /success|support|account|chăm sóc khách hàng|hỗ trợ/i,
    skills: ['SaaS Onboarding', 'Churn Analysis', 'HubSpot', 'Salesforce'],
  },
  { pattern: /sales|business development|kinh doanh|bán hàng/i, skills: ['B2B Sales', 'Negotiation', 'CRM'] },
];

const DEPARTMENT_SKILLS: Record<DepartmentKey, string[]> = {
  engineering: ['TypeScript', 'System Design', 'Code Review', 'CI/CD'],
  design: ['Figma', 'Prototyping', 'Design Systems'],
  data: ['SQL', 'Python', 'Data Modelling'],
  product: ['Roadmapping', 'Product Discovery', 'Analytics'],
  operations: ['Process Improvement', 'Stakeholder Management', 'Reporting'],
  sales: ['B2B Sales', 'Negotiation', 'CRM'],
};

/**
 * Skills the AI suggests for this role, minus the ones already added.
 * Mock implementation: replace with a call to the Orchestrator Agent's job-description helper.
 */
export function suggestSkills(title: string, department: DepartmentKey | null, existing: string[]): string[] {
  const taken = new Set(existing.map((skill) => skill.toLowerCase()));
  // NFC, so Vietnamese typed with combining accents still matches the patterns.
  const normalizedTitle = title.normalize('NFC');
  const fromTitle = TITLE_SKILLS.filter((rule) => rule.pattern.test(normalizedTitle)).flatMap((rule) => rule.skills);
  const fromDepartment = department ? DEPARTMENT_SKILLS[department] : [];
  const suggestions: string[] = [];
  for (const skill of [...fromTitle, ...fromDepartment]) {
    const key = skill.toLowerCase();
    if (!taken.has(key)) {
      taken.add(key);
      suggestions.push(skill);
    }
  }
  return suggestions.slice(0, 6);
}

/** A new campaign, and what the Orchestrator logged about it (`null` in mock mode, where the app logs it). */
export type LaunchResult = { campaign: CampaignSummary; events: AgentEvent[] | null };

/** Creates the campaign and hands it to the Orchestrator Agent, which starts the enabled agents. */
export async function launchCampaign(draft: CampaignDraft): Promise<CampaignSummary> {
  return (await launchCampaignWithEvents(draft)).campaign;
}

/**
 * Like {@link launchCampaign}, with the Orchestrator's events. On the server the Talent Agent then
 * scores the workspace's talent pool against the new role in the background, writing its reasons in
 * `language`; its results arrive over Realtime.
 */
export async function launchCampaignWithEvents(draft: CampaignDraft, language?: Language): Promise<LaunchResult> {
  const remote = getRemote();
  if (remote) {
    return remote.request<{ campaign: CampaignSummary; events: AgentEvent[] }>('/api/campaigns', {
      method: 'POST',
      body: language ? { draft, language } : { draft },
    });
  }
  return { campaign: await mockLaunch(draft), events: null };
}

async function mockLaunch(draft: CampaignDraft): Promise<CampaignSummary> {
  await mockDelay(1400);
  const title = draft.title.trim();
  return {
    id: `${slugify(title) || 'campaign'}-${Date.now().toString(36)}`,
    // A title typed by HR is shown as written in both languages.
    title: { en: title, vi: title },
    department: DEPARTMENT_NAMES[draft.department ?? 'engineering'],
    stage: 'sourcing',
    candidates: 0,
    matchRate: 0,
    targetMatchRate: draft.targetMatchRate,
    health: 'on_track',
  };
}

const ALL_AGENTS: Record<CampaignAgent, boolean> = {
  sourcing: true,
  matching: true,
  scheduling: true,
  selfHealing: true,
};

/** How each live campaign is set up today: the starting point for Digital Twin scenarios. */
const MOCK_SETUPS: Record<string, CampaignDraft> = {
  'senior-frontend-engineer': {
    title: 'Senior Frontend Engineer',
    department: 'engineering',
    location: 'Ho Chi Minh City',
    workMode: 'hybrid',
    seniority: 'senior',
    headcount: 2,
    skills: ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Testing Library', 'Web Performance', 'Accessibility'],
    minExperience: 7,
    salaryMin: 90,
    salaryMax: 110,
    channels: ['itviec', 'topcv'],
    agents: ALL_AGENTS,
    targetMatchRate: 60,
  },
  'product-designer': {
    title: 'Product Designer',
    department: 'design',
    location: 'Ho Chi Minh City',
    workMode: 'hybrid',
    seniority: 'mid',
    headcount: 1,
    skills: ['Figma', 'Prototyping', 'Design Systems', 'User Research'],
    minExperience: 3,
    salaryMin: 90,
    salaryMax: 110,
    channels: ['linkedin', 'topcv', 'referrals'],
    agents: ALL_AGENTS,
    targetMatchRate: 60,
  },
  'data-engineer': {
    title: 'Data Engineer',
    department: 'data',
    location: 'Ho Chi Minh City',
    workMode: 'onsite',
    seniority: 'senior',
    headcount: 1,
    skills: ['Spark', 'Kafka', 'Airflow', 'dbt', 'Scala', 'SQL', 'Python', 'AWS'],
    minExperience: 7,
    salaryMin: 110,
    salaryMax: 130,
    channels: ['topcv'],
    agents: ALL_AGENTS,
    targetMatchRate: 55,
  },
  'customer-success-lead': {
    title: 'Customer Success Lead',
    department: 'operations',
    location: 'Hanoi',
    workMode: 'hybrid',
    seniority: 'lead',
    headcount: 1,
    skills: ['SaaS Onboarding', 'Churn Analysis', 'HubSpot', 'Salesforce'],
    minExperience: 6,
    salaryMin: 135,
    salaryMax: 160,
    channels: ['linkedin', 'vietnamworks', 'referrals', 'topcv'],
    agents: ALL_AGENTS,
    targetMatchRate: 65,
  },
  'backend-engineer-go': {
    title: 'Backend Engineer (Go)',
    department: 'engineering',
    location: 'Ho Chi Minh City',
    workMode: 'hybrid',
    seniority: 'senior',
    headcount: 2,
    skills: ['Go', 'PostgreSQL', 'gRPC', 'Kubernetes', 'Docker'],
    minExperience: 4,
    salaryMin: 140,
    salaryMax: 165,
    channels: ['itviec', 'linkedin', 'referrals'],
    agents: ALL_AGENTS,
    targetMatchRate: 60,
  },
  'hr-business-partner': {
    title: 'HR Business Partner',
    department: 'operations',
    location: 'Ho Chi Minh City',
    workMode: 'onsite',
    seniority: 'senior',
    headcount: 1,
    skills: ['Employee Relations', 'HR Analytics', 'Labor Law', 'Coaching'],
    minExperience: 5,
    salaryMin: 115,
    salaryMax: 135,
    channels: ['linkedin', 'vietnamworks', 'topcv', 'referrals'],
    agents: ALL_AGENTS,
    targetMatchRate: 65,
  },
};

/** The current setup of every live campaign, keyed by campaign id. */
export async function fetchCampaignSetups(): Promise<Record<string, CampaignDraft>> {
  return readWithFallback(
    'campaign setups',
    async (remote) => (await loadBootstrap(remote)).campaignSetups,
    async () => MOCK_SETUPS,
  );
}

/**
 * Saves a new setup for a live campaign. The Orchestrator Agent then updates the job posts,
 * channels and agents to match. Resolves with what it logged (`null` in mock mode).
 */
export async function updateCampaignSetup(campaignId: string, setup: CampaignDraft): Promise<AgentEvent[] | null> {
  const remote = getRemote();
  if (!remote) {
    await mockDelay(900);
    return null;
  }
  const { events } = await remote.request<{ events: AgentEvent[] }>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/setup`,
    { method: 'PUT', body: { setup } },
  );
  return events;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
