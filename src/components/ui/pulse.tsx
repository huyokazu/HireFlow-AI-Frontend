import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type PulseGlowProps = {
  /** Shadow colour, ideally semi-transparent (e.g. `rgba(244, 63, 94, 0.55)`). */
  color: string;
  /** Breathes while true; holds a faint static halo otherwise. */
  active: boolean;
  /** Fades the whole glow in or out, so two glows can cross-fade when the state changes. */
  visible?: boolean;
  /** Matches the card above it, so no stray colour shows at the rounded corners. */
  fillColor?: string;
  borderRadius?: number;
};

/** Soft coloured halo placed behind a card, filling the same box. */
export function PulseGlow({
  color,
  active,
  visible = true,
  fillColor = '#FFFFFF',
  borderRadius = 24,
}: PulseGlowProps) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const presence = useSharedValue(visible ? 1 : 0);

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

  useEffect(() => {
    presence.value = withTiming(visible ? 1 : 0, { duration: reduceMotion ? 0 : 600 });
  }, [visible, reduceMotion, presence]);

  const breathStyle = useAnimatedStyle(() => ({
    opacity: presence.value * interpolate(breath.value, [0, 1], [0.45, 1]),
    // A hair of growth makes the halo swell rather than just blink.
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.012]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.fill,
        { borderRadius, backgroundColor: fillColor, boxShadow: `0px 0px 28px 2px ${color}` },
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

const RADAR_CYCLE_MS = 2400;

type RadarPulseProps = {
  color: string;
  active: boolean;
  /** Diameter of the rings at rest, usually the size of the icon or dot they surround. */
  size: number;
  rings?: number;
  /** How far each ring grows before it fades, as a multiple of `size`. */
  reach?: number;
};

/**
 * Rings that ripple out one after another from behind an icon, like a radar: a soft filled wave
 * followed by thin outlines. Fades away while inactive.
 */
export function RadarPulse({ color, active, size, rings = 3, reach = 2.4 }: RadarPulseProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const presence = useSharedValue(active ? 1 : 0);
  const running = active && !reduceMotion;

  useEffect(() => {
    presence.set(withTiming(running ? 1 : 0, { duration: 400 }));
    if (!running) return undefined;
    progress.set(0);
    progress.set(withRepeat(withTiming(1, { duration: RADAR_CYCLE_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [running, presence, progress]);

  return Array.from({ length: rings }, (_, index) => (
    <RadarRing
      key={index}
      progress={progress}
      presence={presence}
      offset={index / rings}
      filled={index === 0}
      color={color}
      size={size}
      reach={reach}
    />
  ));
}

function RadarRing({
  progress,
  presence,
  offset,
  filled,
  color,
  size,
  reach,
}: {
  progress: SharedValue<number>;
  presence: SharedValue<number>;
  offset: number;
  filled: boolean;
  color: string;
  size: number;
  reach: number;
}) {
  const style = useAnimatedStyle(() => {
    const phase = (progress.get() + offset) % 1;
    // Fast at first, slowing as it spreads, like a ripple.
    const spread = 1 - (1 - phase) * (1 - phase);
    return {
      opacity: presence.get() * interpolate(phase, [0, 0.08, 1], [0, filled ? 0.32 : 0.6, 0]),
      transform: [{ scale: interpolate(spread, [0, 1], [1, reach]) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        filled
          ? { width: size, height: size, borderRadius: size / 2, backgroundColor: color }
          : { width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color },
        style,
      ]}
    />
  );
}

type SuccessPulseProps = {
  /** Plays when this turns true; it doesn't play for content that mounts already succeeded. */
  play: boolean;
  /** Ring and glow colour, ideally semi-transparent. */
  color: string;
  borderRadius?: number;
  delay?: number;
};

/** A ring that swells out of its box and fades, twice, to confirm that something worked. */
export function SuccessPulse({ play, color, borderRadius = 16, delay = 0 }: SuccessPulseProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const wasPlaying = useRef(play);

  useEffect(() => {
    const started = play && !wasPlaying.current;
    wasPlaying.current = play;
    if (!started || reduceMotion) return;
    progress.set(0);
    progress.set(
      withDelay(delay, withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }), 2, false)),
    );
    // `progress` is a stable shared value; only `play` turning on should start the pulse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.12, 1], [0, 1, 0]),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [1, 1.05]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.fill,
        { borderRadius, borderWidth: 2, borderColor: color, boxShadow: `0px 0px 18px 2px ${color}` },
        style,
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
    pointerEvents: 'none',
  },
  ring: {
    position: 'absolute',
    pointerEvents: 'none',
  },
});
