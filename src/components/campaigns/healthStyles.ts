import type { CampaignHealth } from '../../services/dashboard';

// Class names are spelled out in full so Tailwind can find them when it scans the source.
export const HEALTH_STYLES: Record<
  CampaignHealth,
  { chipClassName: string; textClassName: string; barClassName: string }
> = {
  on_track: {
    chipClassName: 'bg-emerald-50 dark:bg-emerald-500/15',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
    barClassName: 'bg-emerald-500 dark:bg-emerald-400',
  },
  at_risk: {
    chipClassName: 'bg-amber-50 dark:bg-amber-500/15',
    textClassName: 'text-amber-700 dark:text-amber-300',
    barClassName: 'bg-amber-500 dark:bg-amber-400',
  },
  blocked: {
    chipClassName: 'bg-rose-50 dark:bg-rose-500/15',
    textClassName: 'text-rose-700 dark:text-rose-300',
    barClassName: 'bg-rose-500 dark:bg-rose-400',
  },
};
