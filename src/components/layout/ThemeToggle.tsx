import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

const TRACK_WIDTH = 72;
const KNOB_SIZE = 36;
const INSET = 3;
// Track border (1px each side) + inset on both sides.
const TRAVEL = TRACK_WIDTH - KNOB_SIZE - INSET * 2 - 2;
const SPRING = { damping: 15, stiffness: 220, mass: 0.8 };

/** Light/dark switch: the knob rolls across the track while the sun turns into a moon. */
export function ThemeToggle() {
  const { isDark, palette, toggleTheme } = useAppTheme();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    const target = isDark ? 1 : 0;
    progress.value = reduceMotion ? withTiming(target, { duration: 0 }) : withSpring(target, SPRING);
  }, [isDark, reduceMotion, progress]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * TRAVEL },
      { rotate: `${progress.value * 360}deg` },
    ],
  }));
  const sunStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 0.5], [1, 0.4], Extrapolation.CLAMP) }],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0.5, 1], [0.4, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={isDark ? t.header.switchToLight : t.header.switchToDark}
      accessibilityState={{ checked: isDark }}
      onPress={toggleTheme}
      className="h-11 justify-center rounded-full border border-slate-200 bg-white/80 dark:border-white/15 dark:bg-white/5"
      style={{ width: TRACK_WIDTH, paddingHorizontal: INSET }}
    >
      {/* Faint hints of the other mode, uncovered as the knob moves away. */}
      <View className="absolute inset-0 flex-row items-center justify-between px-3">
        <Ionicons name="sunny-outline" size={14} color={palette.icon.faint} />
        <Ionicons name="moon-outline" size={13} color={palette.icon.faint} />
      </View>

      <Animated.View
        className="items-center justify-center rounded-full bg-white dark:bg-indigo-500"
        style={[
          {
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            boxShadow: isDark
              ? '0px 0px 14px 0px rgba(129, 140, 248, 0.65)'
              : '0px 2px 8px -2px rgba(15, 23, 42, 0.3)',
          },
          knobStyle,
        ]}
      >
        <Animated.View style={[styles.icon, sunStyle]}>
          <Ionicons name="sunny" size={18} color="#F59E0B" />
        </Animated.View>
        <Animated.View style={[styles.icon, moonStyle]}>
          <Ionicons name="moon" size={16} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
  },
});
