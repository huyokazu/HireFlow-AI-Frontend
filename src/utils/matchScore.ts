export type MatchTier = {
  label: string;
  badgeClassName: string;
  textClassName: string;
  barClassName: string;
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
export function getMatchTier(score: number): MatchTier {
  if (score >= 85) {
    return {
      label: 'Excellent match',
      badgeClassName: 'border-emerald-200 bg-emerald-50',
      textClassName: 'text-emerald-700',
      barClassName: 'bg-emerald-500',
    };
  }
  if (score >= 70) {
    return {
      label: 'Strong match',
      badgeClassName: 'border-indigo-200 bg-indigo-50',
      textClassName: 'text-indigo-700',
      barClassName: 'bg-indigo-500',
    };
  }
  if (score >= 55) {
    return {
      label: 'Potential match',
      badgeClassName: 'border-amber-200 bg-amber-50',
      textClassName: 'text-amber-700',
      barClassName: 'bg-amber-500',
    };
  }
  return {
    label: 'Low match',
    badgeClassName: 'border-rose-200 bg-rose-50',
    textClassName: 'text-rose-700',
    barClassName: 'bg-rose-500',
  };
}
