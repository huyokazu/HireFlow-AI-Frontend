import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PanelProps = {
  title: string;
  subtitle?: string;
  /** Rendered at the top right, e.g. a `PanelLink`. */
  action?: ReactNode;
  /** Extra layout classes for the outer container (flex, width…). */
  className?: string;
  children: ReactNode;
};

/** Frosted-glass container for a dashboard section. */
export function Panel({ title, subtitle, action, className = '', children }: PanelProps) {
  return (
    <View
      className={`rounded-3xl border border-white/80 bg-white/70 p-5 ${className}`}
      style={styles.shadow}
    >
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900">{title}</Text>
          {subtitle && <Text className="mt-0.5 text-sm text-slate-500">{subtitle}</Text>}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function PanelLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-lg px-2 py-1 hover:bg-indigo-50 active:bg-indigo-50"
    >
      <Text className="text-sm font-semibold text-indigo-600">{label}</Text>
      <Ionicons name="arrow-forward" size={14} color="#4F46E5" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    boxShadow: '0px 10px 30px -12px rgba(15, 23, 42, 0.12)',
  },
});
