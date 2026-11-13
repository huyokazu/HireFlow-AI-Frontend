import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The line above a chart: what's under the pointer or keyboard focus, or a default (usually the
 * latest period) until then. Every value in it is also in the marks' accessible labels.
 */
export function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
      <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</Text>
      {children}
    </View>
  );
}

/** A value in the readout; the swatch names its series when the chart has more than one. */
export function ReadoutValue({
  value,
  label,
  swatchClassName,
}: {
  value: number | string;
  label: string;
  swatchClassName?: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      {swatchClassName && <View className={`h-2.5 w-2.5 rounded-sm ${swatchClassName}`} />}
      <Text className="text-sm font-bold text-slate-900 dark:text-white">{value}</Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400">{label}</Text>
    </View>
  );
}

/** A line of context under a chart, led by an icon. */
export function ChartNote({ icon, text }: { icon: IconName; text: string }) {
  const { palette } = useAppTheme();
  return (
    <View className="mt-3 flex-row items-start gap-1.5">
      <Ionicons name={icon} size={13} color={palette.icon.muted} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400">{text}</Text>
    </View>
  );
}
