import type { Localized } from '../i18n/types';
import type { CampaignSummary } from './dashboard';

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

/**
 * Creates the campaign and hands it to the Orchestrator Agent, which starts the enabled agents.
 * Mock implementation: replace with an insert into the campaigns table plus an Orchestrator API call.
 */
export async function launchCampaign(draft: CampaignDraft): Promise<CampaignSummary> {
  await new Promise((resolve) => setTimeout(resolve, 1400));
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

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
