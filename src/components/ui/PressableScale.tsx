import { cssInterop } from 'nativewind';
import { useEffect, useRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { HOVER_LIFT, HOVER_SCALE, PRESSED_SCALE, SPRINGS } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: 'style' });

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Scale while the finger (or mouse button) is down. */
  pressedScale?: number;
  /** Scale while a pointer hovers; 1 turns the hover growth off for large surfaces. */
  hoverScale?: number;
};

/**
 * Pressable with tactile physics: it lifts slightly under a hovering pointer, dips while pressed,
 * and springs back on release.
 */
export function PressableScale({
  pressedScale = PRESSED_SCALE,
  hoverScale = HOVER_SCALE,
  style,
  disabled,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const hovered = useRef(false);
  const animate = !reduceMotion && !disabled;

  // A control that becomes disabled under the pointer settles back instead of staying lifted.
  useEffect(() => {
    if (!disabled) return;
    hovered.current = false;
    scale.set(withSpring(1, SPRINGS.press));
    lift.set(withSpring(0, SPRINGS.press));
  }, [disabled, scale, lift]);

  const settle = () => {
    const raised = hovered.current && animate;
    scale.set(withSpring(raised ? hoverScale : 1, SPRINGS.press));
    lift.set(withSpring(raised ? HOVER_LIFT : 0, SPRINGS.press));
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }, { scale: scale.get() }],
  }));

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
          scale.set(withSpring(pressedScale, SPRINGS.press));
          lift.set(withSpring(0, SPRINGS.press));
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        settle();
        onPressOut?.(event);
      }}
      style={[style, pressStyle]}
    />
  );
}
