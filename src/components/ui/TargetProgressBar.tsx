import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type TargetProgressBarProps = {
  /** Percentages, 0–100. */
  value: number;
  target: number;
  /** Fill colour class, e.g. `bg-rose-500`. */
  barClassName: string;
  size?: 'sm' | 'md';
  /** Wait before the fill grows in, for staggered entrances. */
  delay?: number;
};

/** Progress bar with a vertical marker where the target sits. The fill glides to new values. */
export function TargetProgressBar({
  value,
  target,
  barClassName,
  size = 'md',
  delay = 0,
}: TargetProgressBarProps) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(reduceMotion ? clampPercent(value) : 0);
  const isFirstRun = useRef(true);
  const trackClassName = size === 'md' ? 'h-2.5' : 'h-2';
  const markerClassName = size === 'md' ? 'h-4' : 'h-3.5';

  useEffect(() => {
    const next = clampPercent(value);
    // Only the first grow-in waits for the entrance; later changes respond at once.
    const wait = isFirstRun.current ? delay : 0;
    isFirstRun.current = false;
    fill.value = reduceMotion
      ? next
      : withDelay(wait, withTiming(next, { duration: 900, easing: Easing.out(Easing.cubic) }));
    // `fill` is a stable shared value; only a new value should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  return (
    <View
      className={`${trackClassName} justify-center`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
    >
      <View className={`${trackClassName} overflow-hidden rounded-full bg-slate-100 dark:bg-white/10`}>
        <Animated.View className={`h-full rounded-full ${barClassName}`} style={fillStyle} />
      </View>
      <View
        className={`absolute ${markerClassName} w-0.5 rounded-full bg-slate-800 dark:bg-slate-200`}
        style={{ left: `${clampPercent(target)}%` }}
      />
    </View>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}
