import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '../../theme';
import { PressableScale } from './PressableScale';

type PanelProps = {
  title: string;
  subtitle?: string;
  /** Rendered at the top right, e.g. a `PanelLink`. */
  action?: ReactNode;
  /** Extra layout classes for the outer container (flex, width…). */
  className?: string;
  children: ReactNode;
};

/** Frosted-glass container for a dashboard section; a solid #111827 card in dark mode. */
export function Panel({ title, subtitle, action, className = '', children }: PanelProps) {
  const { palette } = useAppTheme();
  return (
    <View
      className={`rounded-3xl border border-white/80 bg-white/70 p-5 dark:border-white/15 dark:bg-gray-900 ${className}`}
      style={{ boxShadow: palette.shadow.panel }}
    >
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</Text>
          {subtitle && (
            <Text className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</Text>
          )}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function PanelLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="link"
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-lg px-2 py-1 hover:bg-indigo-50 active:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:active:bg-indigo-500/10"
    >
      <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{label}</Text>
      <Ionicons name="arrow-forward" size={14} color={palette.indigo} />
    </PressableScale>
  );
}
