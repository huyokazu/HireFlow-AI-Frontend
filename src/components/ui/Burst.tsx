import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const DURATION_MS = 560;
const PARTICLE_SIZE = 6;

type BurstProps = {
  /** Plays every time this number changes (start it at 0 to stay quiet on mount). */
  trigger: number;
  /** Colour of the pulse ring. */
  color: string;
  /** Particles that pop out from the middle, coloured in turn; none by default. */
  particleColors?: readonly string[];
  particleCount?: number;
  /** Corner radius of the control it covers. */
  borderRadius?: number;
};

/**
 * A one-off burst over a control: a ring pulses out from its edge and, optionally, a handful of
 * particles pop out of its middle. Fill the control with it; it never takes touches.
 */
export function Burst({ trigger, color, particleColors = [], particleCount = 0, borderRadius = 12 }: BurstProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (trigger === 0 || reduceMotion) return;
    progress.set(0);
    progress.set(withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) }));
  }, [trigger, reduceMotion, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: progress.get() < 1 ? 0.9 * (1 - progress.get()) : 0,
    transform: [{ scaleX: 1 + progress.get() * 0.12 }, { scaleY: 1 + progress.get() * 0.5 }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius, borderWidth: 2, borderColor: color }, ringStyle]} />
      {particleColors.length > 0 && (
        <View style={styles.center}>
          {Array.from({ length: particleCount }, (_, index) => (
            <Particle
              key={index}
              progress={progress}
              // Spread round the circle, nudged so the pattern doesn't look stamped.
              angle={(index / particleCount) * Math.PI * 2 + (index % 2 ? 0.25 : -0.1)}
              distance={30 + (index % 3) * 8}
              color={particleColors[index % particleColors.length]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Particle({
  progress,
  angle,
  distance,
  color,
}: {
  progress: SharedValue<number>;
  angle: number;
  distance: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p < 1 ? 1 - p * p : 0,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        // Wider than tall, like the buttons it pops from.
        { translateY: Math.sin(angle) * distance * 0.75 * p },
        { scale: 1 - p * 0.6 },
      ],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  particle: {
    position: 'absolute',
    top: -PARTICLE_SIZE / 2,
    left: -PARTICLE_SIZE / 2,
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    borderRadius: PARTICLE_SIZE / 2,
  },
});
