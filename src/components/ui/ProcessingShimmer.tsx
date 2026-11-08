import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../../theme';

const SWEEP_MS = 1300;

type ProcessingShimmerProps = {
  /** Sweeps while true; fades out when the work is done. */
  active: boolean;
};

/**
 * Shows that an AI agent is working on the card it covers: a bar of light runs along the top edge
 * while a soft sheen crosses the surface. Place it last in a card that clips its children.
 */
export function ProcessingShimmer({ active }: ProcessingShimmerProps) {
  const reduceMotion = useReducedMotion();
  const { isDark } = useAppTheme();
  const sweep = useSharedValue(0);
  const presence = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    presence.set(withTiming(active ? 1 : 0, { duration: active ? 200 : 350 }));
    if (!active || reduceMotion) return undefined;
    sweep.set(0);
    sweep.set(withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.cubic) }), -1, false));
    return () => cancelAnimation(sweep);
  }, [active, reduceMotion, presence, sweep]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: presence.get() }));
  // With reduced motion the bar stays put across the whole edge, and the sheen is left out.
  const barStyle = useAnimatedStyle(() =>
    reduceMotion ? { left: '0%', width: '100%' } : { left: `${-35 + sweep.get() * 135}%`, width: '35%' },
  );
  const sheenStyle = useAnimatedStyle(() => ({
    left: `${-60 + sweep.get() * 160}%`,
    opacity: reduceMotion ? 0 : 1,
  }));
  const sheen = isDark ? 'rgba(165, 180, 252, 0.09)' : 'rgba(99, 102, 241, 0.08)';

  return (
    <Animated.View style={[styles.fill, containerStyle]}>
      <Animated.View style={[styles.sheen, sheenStyle]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0)', sheen, 'rgba(255, 255, 255, 0)']}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View className="bg-indigo-500/15" style={styles.track} />
      <Animated.View style={[styles.bar, barStyle]}>
        <LinearGradient
          colors={['rgba(99, 102, 241, 0)', '#6366F1', '#A78BFA', 'rgba(167, 139, 250, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
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
  track: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  bar: {
    position: 'absolute',
    top: 0,
    height: 3,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '60%',
  },
});
