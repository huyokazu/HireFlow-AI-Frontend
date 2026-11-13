import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { SPRINGS, useFluidSpan } from '../ui/motion';
import { PressableScale } from '../ui/PressableScale';

const TRACK_WIDTH = 72;
const KNOB_SIZE = 36;
const INSET = 3;
// Track border (1px each side) + inset on both sides.
const TRAVEL = TRACK_WIDTH - KNOB_SIZE - INSET * 2 - 2;
/** The icon dips and springs back as it turns, like a coin flipped over. */
const POP_SPRING = { stiffness: 320, damping: 14, mass: 0.8 };

/**
 * Light/dark switch: the knob glides across the track, stretching as it goes, while its icon turns
 * half a circle from sun to moon with a springy pop.
 */
export function ThemeToggle() {
  const { isDark, palette, toggleTheme } = useAppTheme();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const offset = isDark ? TRAVEL : 0;
  const knob = useFluidSpan(offset, offset + KNOB_SIZE);
  const turn = useSharedValue(isDark ? 1 : 0);
  const pop = useSharedValue(1);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const target = isDark ? 1 : 0;
    if (reduceMotion) {
      turn.set(target);
      return;
    }
    turn.set(withSpring(target, SPRINGS.pillLead));
    pop.set(withSequence(withTiming(0.55, { duration: 110 }), withSpring(1, POP_SPRING)));
  }, [isDark, reduceMotion, turn, pop]);

  const knobStyle = useAnimatedStyle(() => ({
    left: INSET + knob.start.get(),
    width: knob.end.get() - knob.start.get(),
  }));
  // Both icons turn with the same half circle: the sun rolls out as the moon rolls in.
  const sunStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turn.get(), [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ rotate: `${turn.get() * 180}deg` }, { scale: pop.get() }],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turn.get(), [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: `${(turn.get() - 1) * 180}deg` }, { scale: pop.get() }],
  }));

  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={isDark ? t.header.switchToLight : t.header.switchToDark}
      aria-checked={isDark}
      onPress={toggleTheme}
      className="h-11 justify-center rounded-full border border-slate-200 bg-white/80 dark:border-white/15 dark:bg-white/5"
      style={{ width: TRACK_WIDTH }}
    >
      {/* Faint hints of the other mode, uncovered as the knob moves away. */}
      <View className="absolute inset-0 flex-row items-center justify-between px-3">
        <Ionicons name="sunny-outline" size={14} color={palette.icon.faint} />
        <Ionicons name="moon-outline" size={13} color={palette.icon.faint} />
      </View>

      <Animated.View
        className="items-center justify-center rounded-full bg-white dark:bg-indigo-500"
        style={[
          styles.knob,
          {
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
  knob: {
    position: 'absolute',
    top: (44 - 2 - KNOB_SIZE) / 2,
    height: KNOB_SIZE,
  },
  icon: {
    position: 'absolute',
  },
});
