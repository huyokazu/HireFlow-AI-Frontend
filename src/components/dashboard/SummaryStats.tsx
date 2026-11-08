import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAppTheme, type Palette } from '../../theme';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { staggerDelay } from '../ui/motion';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Accent = 'indigo' | 'violet' | 'emerald' | 'amber';

export type SummaryStat = {
  key: string;
  label: string;
  /** Rolls up from zero on first show, then glides when it changes. */
  value: number;
  format: (value: number) => string;
  icon: IconName;
  accent: Accent;
  /** `tone` says whether the change is good news, not whether the number went up. */
  delta: { text: string; tone: 'positive' | 'negative' | 'neutral'; icon?: IconName };
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const ACCENT_BG: Record<Accent, string> = {
  indigo: 'bg-indigo-50 dark:bg-indigo-500/15',
  violet: 'bg-violet-50 dark:bg-violet-500/15',
  emerald: 'bg-emerald-50 dark:bg-emerald-500/15',
  amber: 'bg-amber-50 dark:bg-amber-500/15',
};

const DELTA_TONES: Record<
  SummaryStat['delta']['tone'],
  { textClassName: string; color: (palette: Palette) => string; icon: IconName }
> = {
  positive: {
    textClassName: 'text-emerald-600 dark:text-emerald-400',
    color: (palette) => palette.emerald,
    icon: 'trending-up',
  },
  negative: {
    textClassName: 'text-rose-600 dark:text-rose-400',
    color: (palette) => palette.rose,
    icon: 'trending-down',
  },
  neutral: {
    textClassName: 'text-slate-500 dark:text-slate-400',
    color: (palette) => palette.icon.muted,
    icon: 'remove',
  },
};

type SummaryStatsProps = {
  stats: SummaryStat[];
  /** Entrance delay of the first card; the rest follow one after another. */
  enterDelay?: number;
  /** Cards per row (2 for a 2×2 grid, 4 for one row). Without it they wrap as space allows. */
  columns?: 2 | 4;
};

/** Headline numbers; wraps to two columns on phones and one row on wide screens. */
export function SummaryStats({ stats, enterDelay = 0, columns }: SummaryStatsProps) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {stats.map((stat, index) => (
        <StatCard key={stat.key} stat={stat} enterDelay={staggerDelay(index, enterDelay)} columns={columns} />
      ))}
    </View>
  );
}

// A basis a little under 1/n of the row, so n cards (and the gaps between them) fit and grow to fill it.
const COLUMN_BASIS = { 2: '40%', 4: '20%' } as const;

function StatCard({ stat, enterDelay, columns }: { stat: SummaryStat; enterDelay: number; columns?: 2 | 4 }) {
  const { palette } = useAppTheme();
  const delta = DELTA_TONES[stat.delta.tone];

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(500)}
      className={`flex-1 rounded-2xl border border-white/80 bg-white/70 p-4 dark:border-white/15 dark:bg-gray-900 ${
        columns ? '' : 'min-w-[150px]'
      }`}
      style={[{ boxShadow: palette.shadow.stat }, columns ? { flexBasis: COLUMN_BASIS[columns] } : null]}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-medium text-slate-500 dark:text-slate-400" numberOfLines={3}>
          {stat.label}
        </Text>
        <View className={`h-8 w-8 items-center justify-center rounded-lg ${ACCENT_BG[stat.accent]}`}>
          <Ionicons name={stat.icon} size={16} color={palette[stat.accent]} />
        </View>
      </View>
      <AnimatedNumber
        value={stat.value}
        format={stat.format}
        delay={enterDelay + 150}
        className="mt-2 text-2xl font-bold text-slate-900 dark:text-white"
      />
      <View className="mt-1 flex-row items-center gap-1">
        <Ionicons name={stat.delta.icon ?? delta.icon} size={14} color={delta.color(palette)} />
        <Text className={`shrink text-xs font-medium ${delta.textClassName}`}>{stat.delta.text}</Text>
      </View>
    </Animated.View>
  );
}
