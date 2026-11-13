/**
 * Domain constants the API validates and builds responses with. The app's service modules also
 * hold client runtime (API client, Expo config), so their values cannot be imported here; instead
 * each list is keyed by the app's own union type, so adding or renaming a member there breaks the
 * backend typecheck until this file follows.
 */
import type {
  AgentKey,
  CampaignAgent,
  DepartmentKey,
  Localized,
  PipelineStage,
  Seniority,
  SourcingChannel,
  WorkMode,
} from '@/lib/contracts';

type NonEmpty<T> = [T, ...T[]];
const keysOf = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as NonEmpty<K>;

export const AGENT_KEYS = keysOf<AgentKey>({ sourcing: 1, matching: 1, scheduling: 1, offer: 1, selfHealing: 1 });
export const PIPELINE_STAGES = keysOf<PipelineStage>({ applied: 1, screening: 1, interview: 1, offer: 1, hired: 1 });
export const CAMPAIGN_AGENTS = keysOf<CampaignAgent>({ sourcing: 1, matching: 1, scheduling: 1, selfHealing: 1 });
export const WORK_MODES = keysOf<WorkMode>({ onsite: 1, hybrid: 1, remote: 1 });
export const SENIORITIES = keysOf<Seniority>({ junior: 1, mid: 1, senior: 1, lead: 1 });
export const SOURCING_CHANNELS = keysOf<SourcingChannel>({
  linkedin: 1,
  topcv: 1,
  itviec: 1,
  vietnamworks: 1,
  wellfound: 1,
  referrals: 1,
});

/** Department names travel with the campaign record (same values as the app's DEPARTMENT_NAMES). */
export const DEPARTMENT_NAMES: Record<DepartmentKey, Localized> = {
  engineering: { en: 'Engineering', vi: 'Kỹ thuật' },
  design: { en: 'Design', vi: 'Thiết kế' },
  data: { en: 'Data', vi: 'Dữ liệu' },
  product: { en: 'Product', vi: 'Sản phẩm' },
  operations: { en: 'Operations', vi: 'Vận hành' },
  sales: { en: 'Sales', vi: 'Kinh doanh' },
};
export const DEPARTMENTS = keysOf(DEPARTMENT_NAMES);

/**
 * Upper bound on every list endpoint. It equals PostgREST's `max_rows` (supabase/config.toml), which
 * would otherwise cut a response short without saying so; the explicit limit plus a stable order
 * makes the cap deliberate and the first page deterministic.
 */
export const MAX_LIST_ROWS = 1000;

// The campaign wizard's limits (the app's SALARY_LIMITS, EXPERIENCE_LIMITS, OPENINGS_LIMITS).
/** Annual salary band, in thousands of USD. */
export const SALARY_LIMITS = { min: 30, max: 300 };
export const EXPERIENCE_LIMITS = { min: 0, max: 15 };
export const OPENINGS_LIMITS = { min: 1, max: 20 };
