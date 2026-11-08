import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { SPRINGS } from './motion';
import { PressableScale } from './PressableScale';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Waiting for a press, working on it, or done. */
export type ActionState = 'idle' | 'loading' | 'success';

type Tone = 'indigo' | 'emerald';

const TONES: Record<Tone, { colors: readonly [string, string]; glow: string }> = {
  indigo: { colors: ['#4F46E5', '#7C3AED'], glow: 'rgba(79, 70, 229, 0.75)' },
  emerald: { colors: ['#059669', '#10B981'], glow: 'rgba(16, 185, 129, 0.75)' },
};
const SUCCESS_COLORS = ['#059669', '#10B981'] as const;
const RADIUS = 12;
const BORDER = 1.5;
/** The width morphs with the same spring as the cards around it. */
const MORPH = LinearTransition.springify()
  .stiffness(SPRINGS.morph.stiffness)
  .damping(SPRINGS.morph.damping)
  .mass(SPRINGS.morph.mass);

type ActionButtonProps = {
  state: ActionState;
  label: string;
  loadingLabel: string;
  successLabel: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  /** Layout classes for the outer wrapper, e.g. `flex-1`. */
  className?: string;
  accessibilityLabel?: string;
  /** Lines the label may wrap to before it is cut off. */
  numberOfLines?: number;
  /** Tighter side padding, for buttons sharing a narrow row. */
  compact?: boolean;
};

/**
 * Primary action that shows its own progress. Idle, it is a gradient with a light that runs round
 * its border under a hovering pointer. Pressed, its content cross-fades to a spinning AI orb and
 * "Applying…" while its width springs to fit. Done, it flashes emerald, draws a checkmark and
 * sends a ripple out from the middle.
 */
export function ActionButton({
  state,
  label,
  loadingLabel,
  successLabel,
  icon,
  onPress,
  disabled = false,
  tone = 'indigo',
  className = '',
  accessibilityLabel,
  numberOfLines = 1,
  compact = false,
}: ActionButtonProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const success = useSharedValue(state === 'success' ? 1 : 0);
  const glow = useSharedValue(0);
  const colors = TONES[tone];
  const glowing = hovered && state === 'idle' && !disabled;

  useEffect(() => {
    const target = state === 'success' ? 1 : 0;
    success.set(reduceMotion ? target : withTiming(target, { duration: target ? 220 : 400 }));
  }, [state, reduceMotion, success]);

  useEffect(() => {
    glow.set(withTiming(glowing ? 1 : 0, { duration: 180 }));
  }, [glowing, glow]);

  const successStyle = useAnimatedStyle(() => ({ opacity: success.get() }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const text = state === 'loading' ? loadingLabel : state === 'success' ? successLabel : label;

  return (
    <Animated.View layout={reduceMotion ? undefined : MORPH} className={className}>
      {/* Glows behind the button: brighter under a hovering pointer, emerald on success. The button
          clips its border shimmer, so these sit outside it. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.passThrough,
          { borderRadius: RADIUS, boxShadow: `0px 14px 30px -8px ${colors.glow}` },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.passThrough,
          { borderRadius: RADIUS, boxShadow: '0px 0px 26px 2px rgba(16, 185, 129, 0.65)' },
          successStyle,
        ]}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        aria-busy={state === 'loading'}
        aria-disabled={disabled}
        // Busy while loading; a done button can be pressed again (the next candidate, say).
        disabled={disabled || state === 'loading'}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[styles.ring, disabled && styles.disabled]}
      >
        <BorderShimmer active={glowing && !reduceMotion} />
        <View style={styles.fill}>
          <LinearGradient colors={colors.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Animated.View style={[StyleSheet.absoluteFill, successStyle]}>
            <LinearGradient colors={SUCCESS_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Ripple play={state === 'success' && !reduceMotion} />
          <View
            className={`min-h-12 flex-row items-center justify-center py-2.5 ${compact ? 'gap-1.5 px-3' : 'gap-2 px-4'}`}
          >
            <Animated.View key={`icon-${state}`} entering={reduceMotion ? undefined : FadeIn.duration(180)}>
              {state === 'loading' ? (
                <AiOrb animate={!reduceMotion} />
              ) : state === 'success' ? (
                <DrawnCheck animate={!reduceMotion} />
              ) : (
                <Ionicons name={icon} size={17} color="#FFFFFF" />
              )}
            </Animated.View>
            <Animated.View key={`label-${state}`} entering={reduceMotion ? undefined : FadeIn.duration(200)} className="shrink">
              <Text className="text-center text-sm font-semibold text-white" numberOfLines={numberOfLines}>
                {text}
              </Text>
            </Animated.View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** A soft band of light that runs along the border, left to right, again and again. */
function BorderShimmer({ active }: { active: boolean }) {
  const sweep = useSharedValue(0);
  const presence = useSharedValue(0);

  useEffect(() => {
    presence.set(withTiming(active ? 1 : 0, { duration: active ? 180 : 260 }));
    if (!active) return undefined;
    sweep.set(0);
    sweep.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }), -1, false));
    return () => cancelAnimation(sweep);
  }, [active, sweep, presence]);

  const style = useAnimatedStyle(() => ({
    opacity: presence.get(),
    left: `${-45 + sweep.get() * 145}%`,
  }));

  return (
    <Animated.View style={[styles.shimmer, style]}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** The AI at work: a glowing orb that spins while a halo pulses out from it. */
function AiOrb({ animate }: { animate: boolean }) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!animate) return undefined;
    spin.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false));
    pulse.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }), -1, false));
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [animate, spin, pulse]);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: animate ? 0.7 * (1 - pulse.get()) : 0,
    transform: [{ scale: 1 + pulse.get() * 0.9 }],
  }));

  return (
    <View style={styles.orbBox}>
      <Animated.View style={[styles.orbHalo, haloStyle]} />
      <Animated.View style={[styles.orb, orbStyle]}>
        <LinearGradient
          colors={['#FFFFFF', '#C7D2FE', '#67E8F9', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Length of the checkmark's stroke, a little over its true length so it starts fully hidden. */
const CHECK_LENGTH = 22;

/** A checkmark that draws itself, stroke by stroke. */
function DrawnCheck({ animate }: { animate: boolean }) {
  const drawn = useSharedValue(animate ? 0 : 1);
  const pop = useSharedValue(animate ? 0.6 : 1);

  useEffect(() => {
    if (!animate) return;
    drawn.set(withDelay(60, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })));
    pop.set(withSequence(withTiming(1.2, { duration: 160 }), withTiming(1, { duration: 160 })));
  }, [animate, drawn, pop]);

  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - drawn.get()) }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Animated.View style={popStyle}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <AnimatedPath
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={CHECK_LENGTH}
          animatedProps={pathProps}
        />
      </Svg>
    </Animated.View>
  );
}

/** A ring of light that spreads from the middle of the button and fades. */
function Ripple({ play }: { play: boolean }) {
  const progress = useSharedValue(0);
  const wasPlaying = useRef(false);

  useEffect(() => {
    if (play && !wasPlaying.current) {
      progress.set(0);
      progress.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    }
    wasPlaying.current = play;
  }, [play, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.get() > 0 && progress.get() < 1 ? 0.55 * (1 - progress.get()) : 0,
    transform: [{ scale: 0.05 + progress.get() }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.rippleBox]}>
      <Animated.View style={[styles.ripple, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
  ring: {
    borderRadius: RADIUS,
    padding: BORDER,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  disabled: { opacity: 0.55 },
  fill: {
    borderRadius: RADIUS - BORDER,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
    pointerEvents: 'none',
  },
  orbBox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    boxShadow: '0px 0px 10px 1px rgba(199, 210, 254, 0.9)',
  },
  orbHalo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  rippleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  ripple: {
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(209, 250, 229, 0.9)',
  },
});
