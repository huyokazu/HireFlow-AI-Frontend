import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type PulseGlowProps = {
  /** Shadow colour, ideally semi-transparent (e.g. `rgba(244, 63, 94, 0.55)`). */
  color: string;
  /** Breathes while true; holds a faint static halo otherwise. */
  active: boolean;
  borderRadius?: number;
};

/** Soft coloured halo placed behind a card, filling the same box. */
export function PulseGlow({ color, active, borderRadius = 24 }: PulseGlowProps) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (active && !reduceMotion) {
      breath.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(breath);
  }, [active, reduceMotion, breath]);

  const breathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.45, 1]),
  }));

  return (
    <Animated.View
      style={[
        styles.fill,
        { borderRadius, boxShadow: `0px 0px 28px 2px ${color}` },
        breathStyle,
      ]}
    />
  );
}

type PulseRingProps = {
  color: string;
  active: boolean;
  size: number;
};

/** Expanding ring behind an icon, like a "live" beacon. Invisible while inactive. */
export function PulseRing({ color, active, size }: PulseRingProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active && !reduceMotion) {
      progress.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [active, reduceMotion, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.9]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ringStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Opaque so native platforms always cast the shadow; the card on top hides it.
    backgroundColor: '#FFFFFF',
    pointerEvents: 'none',
  },
  ring: {
    position: 'absolute',
    pointerEvents: 'none',
  },
});
