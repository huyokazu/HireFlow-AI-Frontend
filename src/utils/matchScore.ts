export type MatchTierKey = 'excellent' | 'strong' | 'potential' | 'low';

export type MatchTier = {
  /** Look up the label with `t.candidate.tiers[key]`. */
  key: MatchTierKey;
  badgeClassName: string;
  textClassName: string;
  barClassName: string;
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
export function getMatchTier(score: number): MatchTier {
  if (score >= 85) {
    return {
      key: 'excellent',
      badgeClassName: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10',
      textClassName: 'text-emerald-700 dark:text-emerald-300',
      barClassName: 'bg-emerald-500 dark:bg-emerald-400',
    };
  }
  if (score >= 70) {
    return {
      key: 'strong',
      badgeClassName: 'border-indigo-200 bg-indigo-50 dark:border-indigo-400/30 dark:bg-indigo-400/10',
      textClassName: 'text-indigo-700 dark:text-indigo-300',
      barClassName: 'bg-indigo-500 dark:bg-indigo-400',
    };
  }
  if (score >= 55) {
    return {
      key: 'potential',
      badgeClassName: 'border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10',
      textClassName: 'text-amber-700 dark:text-amber-300',
      barClassName: 'bg-amber-500 dark:bg-amber-400',
    };
  }
  return {
    key: 'low',
    badgeClassName: 'border-rose-200 bg-rose-50 dark:border-rose-400/30 dark:bg-rose-400/10',
    textClassName: 'text-rose-700 dark:text-rose-300',
    barClassName: 'bg-rose-500 dark:bg-rose-400',
  };
}
