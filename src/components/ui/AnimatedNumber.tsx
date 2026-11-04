import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import {
  Easing,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type AnimatedNumberProps = {
  value: number;
  /** Turns the whole number into text, e.g. `(n) => `${n}%``. Can change freely (e.g. on language switch). */
  format?: (value: number) => string;
  className?: string;
  /** Counts up from zero on mount, then glides between later values. */
  countUpOnMount?: boolean;
  duration?: number;
  delay?: number;
};

/** A number that rolls smoothly to its new value instead of jumping. */
export function AnimatedNumber({
  value,
  format = String,
  className,
  countUpOnMount = true,
  duration = 900,
  delay = 0,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const startValue = countUpOnMount && !reduceMotion ? 0 : value;
  const animated = useSharedValue(startValue);
  const [display, setDisplay] = useState(startValue);
  const isFirstRun = useRef(true);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setDisplay, current);
    },
  );

  useEffect(() => {
    // The delay lines the first roll up with an entrance; later changes respond at once.
    const wait = isFirstRun.current ? delay : 0;
    isFirstRun.current = false;
    animated.value = reduceMotion
      ? value
      : withDelay(wait, withTiming(value, { duration, easing: Easing.out(Easing.cubic) }));
    // `animated` is a stable shared value; only a new target should restart the roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  return <Text className={className}>{format(display)}</Text>;
}
