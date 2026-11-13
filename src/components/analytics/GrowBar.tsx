import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** Keeps a value above zero visible, however small next to the largest one. */
const MIN_VISIBLE_WIDTH = 3;

type GrowBarProps = {
  /** Share of the row's width, 0–100. */
  percent: number;
  /** Colour, height and corner classes, spelled out in full. */
  className: string;
  /** Wait before the first grow-in, for staggered entrances. */
  delay?: number;
};

/** A horizontal bar that grows out from its baseline, then glides to new values. */
export function GrowBar({ percent, className, delay = 0 }: GrowBarProps) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(0, Math.min(100, percent));
  const width = useSharedValue(reduceMotion ? target : 0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Only the first grow-in waits for the entrance; later changes respond at once.
    const wait = isFirstRun.current ? delay : 0;
    isFirstRun.current = false;
    width.set(
      reduceMotion ? target : withDelay(wait, withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) })),
    );
    // `width` is a stable shared value; only a new target should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion]);

  const style = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return <Animated.View className={className} style={[{ minWidth: target > 0 ? MIN_VISIBLE_WIDTH : 0 }, style]} />;
}
