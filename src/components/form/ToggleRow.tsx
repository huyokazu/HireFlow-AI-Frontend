import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';
import { SwitchTrack } from './SwitchTrack';

type ToggleRowProps = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  value: boolean;
  onValueChange: (value: boolean) => void;
};

/** A setting row that works as one big switch: tap anywhere on it to turn the setting on or off. */
export function ToggleRow({ title, description, icon, value, onValueChange }: ToggleRowProps) {
  const { palette } = useAppTheme();

  return (
    <PressableScale
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={() => onValueChange(!value)}
      pressedScale={0.98}
      hoverScale={1}
      className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${
        value
          ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-400/30 dark:bg-indigo-500/10'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${
          value ? 'bg-indigo-100 dark:bg-indigo-500/20' : 'bg-slate-100 dark:bg-white/10'
        }`}
      >
        <Ionicons name={icon} size={18} color={value ? palette.indigo : palette.icon.muted} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
        <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</Text>
      </View>
      <SwitchTrack value={value} />
    </PressableScale>
  );
}
