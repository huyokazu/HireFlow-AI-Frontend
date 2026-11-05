import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

const TRACK_WIDTH = 42;
const THUMB_SIZE = 18;
const TRACK_PADDING = 3;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2;
const TOGGLE_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

type ToggleRowProps = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  value: boolean;
  onValueChange: (value: boolean) => void;
};

/** A setting row that works as one big switch: tap anywhere on it to turn the setting on or off. */
export function ToggleRow({ title, description, icon, value, onValueChange }: ToggleRowProps) {
  const { palette, isDark } = useAppTheme();
  const progress = useSharedValue(value ? 1 : 0);
  const offColor = isDark ? '#334155' : '#CBD5E1';
  const onColor = palette.indigo;

  useEffect(() => {
    progress.set(withSpring(value ? 1 : 0, TOGGLE_SPRING));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
  }));

  return (
    <PressableScale
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={() => onValueChange(!value)}
      pressedScale={0.98}
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
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: THUMB_SIZE + TRACK_PADDING * 2,
    borderRadius: (THUMB_SIZE + TRACK_PADDING * 2) / 2,
    padding: TRACK_PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.3)',
  },
});
