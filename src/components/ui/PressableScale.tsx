import { cssInterop } from 'nativewind';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  HOVER_LIFT,
  HOVER_SCALE,
  PRESS_IN_MS,
  PRESSED_SCALE,
  PRESSED_SINK,
  RELEASE_SCALE,
  SPRINGS,
} from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: 'style' });

/** Large surfaces (cards, rows) squish less, so the page doesn't wobble. */
const SURFACE_PRESSED_SCALE = 0.98;

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Scale while the finger (or mouse button) is down. */
  pressedScale?: number;
  /** Scale while a pointer hovers; 1 turns the hover growth (and lift) off for large surfaces. */
  hoverScale?: number;
  /** Colour of the glow that brightens under a hovering pointer, for filled buttons. */
  glowColor?: string;
  /** Corner radius of that glow; match the button's. */
  glowRadius?: number;
};

/**
 * Pressable with tactile physics: it lifts under a hovering pointer (with a brighter glow when it
 * has one), squishes down and sinks a pixel while pressed, then bounces back through a slight
 * overshoot on release.
 */
export function PressableScale({
  pressedScale,
  hoverScale = HOVER_SCALE,
  glowColor,
  glowRadius = 12,
  style,
  disabled,
  children,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const glow = useSharedValue(0);
  const hovered = useRef(false);
  const animate = !reduceMotion && !disabled;
  const pressed = pressedScale ?? (hoverScale < HOVER_SCALE ? SURFACE_PRESSED_SCALE : PRESSED_SCALE);
  // The lift follows the hover growth: none for surfaces that don't grow.
  const hoverLift = HOVER_LIFT * Math.min(1, Math.max(0, (hoverScale - 1) / (HOVER_SCALE - 1)));
  // The bounce on release overshoots in proportion to the squish.
  const overshoot = 1 + (1 - pressed) * ((RELEASE_SCALE - 1) / (1 - PRESSED_SCALE));

  // A control that becomes disabled under the pointer settles back instead of staying lifted.
  useEffect(() => {
    if (!disabled) return;
    hovered.current = false;
    scale.set(withSpring(1, SPRINGS.press));
    lift.set(withSpring(0, SPRINGS.press));
    glow.set(withTiming(0, { duration: 150 }));
  }, [disabled, scale, lift, glow]);

  const restScale = () => (hovered.current && animate ? hoverScale : 1);
  const restLift = () => (hovered.current && animate ? hoverLift : 0);

  const settle = () => {
    scale.set(withSpring(restScale(), SPRINGS.press));
    lift.set(withSpring(restLift(), SPRINGS.press));
    glow.set(withTiming(hovered.current && animate ? 1 : 0, { duration: 180 }));
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }, { scale: scale.get() }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onHoverIn={(event) => {
        hovered.current = true;
        settle();
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        hovered.current = false;
        settle();
        onHoverOut?.(event);
      }}
      onPressIn={(event) => {
        if (animate) {
          const squish = { duration: PRESS_IN_MS, easing: Easing.out(Easing.quad) };
          scale.set(withTiming(pressed, squish));
          lift.set(withTiming(PRESSED_SINK, squish));
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (animate) {
          // Springs back through a slight overshoot, then settles where the pointer leaves it.
          scale.set(
            withSequence(
              withTiming(Math.max(overshoot, restScale()), { duration: 110, easing: Easing.out(Easing.quad) }),
              withSpring(restScale(), SPRINGS.release),
            ),
          );
          lift.set(withSpring(restLift(), SPRINGS.release));
          glow.set(withTiming(hovered.current ? 1 : 0, { duration: 180 }));
        } else {
          settle();
        }
        onPressOut?.(event);
      }}
      style={[style, pressStyle]}
    >
      {(state) => (
        <>
          {glowColor && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.glow,
                { borderRadius: glowRadius, boxShadow: `0px 14px 30px -8px ${glowColor}` },
                glowStyle,
              ]}
            />
          )}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  glow: {
    pointerEvents: 'none',
  },
});
