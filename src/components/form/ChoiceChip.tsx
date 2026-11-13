import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` in a pick-one group, `checkbox` in a pick-many group (which also shows a tick). */
  role: 'radio' | 'checkbox';
  icon?: ComponentProps<typeof Ionicons>['name'];
};

/** Pill-shaped option for short choice lists. */
export function ChoiceChip({ label, selected, onPress, role, icon }: ChoiceChipProps) {
  const { palette } = useAppTheme();
  const iconName = role === 'checkbox' && selected ? 'checkmark' : icon;

  return (
    <PressableScale
      accessibilityRole={role}
      aria-checked={selected}
      onPress={onPress}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 ${
        selected
          ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/15 dark:bg-white/5 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/15'
      }`}
    >
      {iconName && <Ionicons name={iconName} size={14} color={selected ? '#FFFFFF' : palette.icon.muted} />}
      <Text
        className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
