import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type SummaryStat = {
  key: string;
  label: string;
  value: string;
  icon: IconName;
  accent: 'indigo' | 'violet' | 'emerald' | 'amber';
  /** `tone` says whether the change is good news, not whether the number went up. */
  delta: { text: string; tone: 'positive' | 'negative' | 'neutral'; icon?: IconName };
};

const ACCENTS: Record<SummaryStat['accent'], { bgClassName: string; color: string }> = {
  indigo: { bgClassName: 'bg-indigo-50', color: '#4F46E5' },
  violet: { bgClassName: 'bg-violet-50', color: '#7C3AED' },
  emerald: { bgClassName: 'bg-emerald-50', color: '#059669' },
  amber: { bgClassName: 'bg-amber-50', color: '#D97706' },
};

const DELTA_TONES: Record<
  SummaryStat['delta']['tone'],
  { textClassName: string; color: string; icon: IconName }
> = {
  positive: { textClassName: 'text-emerald-600', color: '#059669', icon: 'trending-up' },
  negative: { textClassName: 'text-rose-600', color: '#E11D48', icon: 'trending-down' },
  neutral: { textClassName: 'text-slate-500', color: '#64748B', icon: 'remove' },
};

/** Headline numbers; wraps to two columns on phones and one row on wide screens. */
export function SummaryStats({ stats }: { stats: SummaryStat[] }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {stats.map((stat) => (
        <StatCard key={stat.key} stat={stat} />
      ))}
    </View>
  );
}

function StatCard({ stat }: { stat: SummaryStat }) {
  const accent = ACCENTS[stat.accent];
  const delta = DELTA_TONES[stat.delta.tone];

  return (
    <View
      className="min-w-[150px] flex-1 rounded-2xl border border-white/80 bg-white/70 p-4"
      style={styles.shadow}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-medium text-slate-500" numberOfLines={2}>
          {stat.label}
        </Text>
        <View className={`h-8 w-8 items-center justify-center rounded-lg ${accent.bgClassName}`}>
          <Ionicons name={stat.icon} size={16} color={accent.color} />
        </View>
      </View>
      <Text className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</Text>
      <View className="mt-1 flex-row items-center gap-1">
        <Ionicons name={stat.delta.icon ?? delta.icon} size={14} color={delta.color} />
        <Text className={`shrink text-xs font-medium ${delta.textClassName}`}>{stat.delta.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    boxShadow: '0px 8px 24px -14px rgba(15, 23, 42, 0.18)',
  },
});
