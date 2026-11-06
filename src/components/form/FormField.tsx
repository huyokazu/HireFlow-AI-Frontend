import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useAppTheme } from '../../theme';

type FormFieldProps = {
  label: string;
  /** Shown under the control until there is an error to show instead. */
  hint?: string;
  error?: string | null;
  /** Extra layout classes for the outer container. */
  className?: string;
  /** Shown right after the label, e.g. a dot marking a changed value. */
  labelAccessory?: ReactNode;
  children: ReactNode;
};

/** A label, its control, and a hint or validation message underneath. */
export function FormField({ label, hint, error, className = '', labelAccessory, children }: FormFieldProps) {
  const { palette } = useAppTheme();
  const labelText = <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</Text>;
  return (
    <View className={`gap-2 ${className}`}>
      {labelAccessory ? (
        <View className="flex-row items-center gap-2">
          {labelText}
          {labelAccessory}
        </View>
      ) : (
        labelText
      )}
      {children}
      {error ? (
        <Animated.View entering={FadeIn.duration(180)} className="flex-row items-center gap-1.5">
          <Ionicons name="alert-circle" size={14} color={palette.rose} />
          <Text className="flex-1 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</Text>
        </Animated.View>
      ) : hint ? (
        <Text className="text-xs text-slate-500 dark:text-slate-400">{hint}</Text>
      ) : null}
    </View>
  );
}
