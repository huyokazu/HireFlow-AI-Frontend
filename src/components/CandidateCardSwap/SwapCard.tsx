import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme } from '../../theme';

export type SwapDirection = 'next' | 'prev';

/** Where the front card flies when it leaves; `velocityX` carries a swipe's momentum. */
export type ExitVector = { x: number; y: number; velocityX?: number };

export type SwapEvent = {
  direction: SwapDirection;
  exit?: ExitVector;
};

type SwapCardProps = {
  /** 0 is the front card; higher slots sit further back. */
  slot: number;
  /** Number of slots that are drawn; deeper cards wait invisibly behind the last one. */
  visibleCount: number;
  /** The swap that produced the current slot assignment. */
  swap: SwapEvent;
  width: number;
  height: number;
  /** How much of each back card shows above the one in front of it. */
  peek: number;
  swipeEnabled: boolean;
  onSwipe: (exit: ExitVector) => void;
  stampLabels: { skip: string; shortlist: string };
  children: ReactNode;
};

/** Each step back in the deck shrinks the card by this much. */
export const SCALE_STEP = 0.06;
const TILT_DEG = 2.5;
const PERSPECTIVE = 1200;
// The card that moves up a slot: a little bounce so it "lands" at the front.
const SETTLE_SPRING = { damping: 14, stiffness: 170, mass: 0.9 };
const RETURN_SPRING = { damping: 16, stiffness: 160, mass: 0.9 };
// Under-damped and clamped, so the fling is quick and ends as soon as it reaches the target.
const FLING_SPRING = { damping: 14, stiffness: 120, mass: 1, overshootClamping: true };
const FALL_SPRING = { damping: 18, stiffness: 90, mass: 1 };
const ARC_LIFT = 44;
const ROTATION_PER_WIDTH = 14;
const MAX_ROTATION_DEG = 24;
const MAX_SWING_DEG = 16;
const SWIPE_DISTANCE_RATIO = 0.28;
const SWIPE_VELOCITY = 800;

export function SwapCard({
  slot,
  visibleCount,
  swap,
  width,
  height,
  peek,
  swipeEnabled,
  onSwipe,
  stampLabels,
  children,
}: SwapCardProps) {
  const reduceMotion = useReducedMotion();
  const { isDark, palette } = useAppTheme();
  const restSlot = Math.min(slot, visibleCount - 1);
  const targetOpacity = slot < visibleCount ? 1 : 0;
  const isFront = slot === 0;
  const stackDepth = visibleCount - 1;
  // Vertical shift per slot so `peek` px of each back card shows after it is scaled down.
  const stepY = peek + (height * SCALE_STEP) / 2;
  const maxShade = isDark ? 0.45 : 0.22;

  // `depth` drives the resting stack offset; `dragX`/`dragY` add swipe and exit movement on top.
  const depth = useSharedValue(restSlot);
  const opacity = useSharedValue(targetOpacity);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Keeps the card that is flying out (or coming back) above the rest of the deck.
  const lift = useSharedValue(0);
  const previousSlot = useRef(slot);

  useEffect(() => {
    const fromSlot = previousSlot.current;
    previousSlot.current = slot;
    if (fromSlot === slot) return;

    if (reduceMotion) {
      lift.value = 0;
      depth.value = withTiming(restSlot, { duration: 180 });
      opacity.value = withTiming(targetOpacity, { duration: 180 });
      dragX.value = withTiming(0, { duration: 180 });
      dragY.value = withTiming(0, { duration: 180 });
      return;
    }

    if (swap.direction === 'next' && fromSlot === 0) {
      // Leaving front card: arc up and out with spring physics, fade, then tuck in at the back.
      const exit = swap.exit ?? { x: width * 1.5, y: height * 0.1 };
      lift.value = 1;
      dragY.value = withSequence(
        withTiming(dragY.value - ARC_LIFT, { duration: 170, easing: Easing.out(Easing.quad) }),
        withSpring(exit.y, FALL_SPRING),
      );
      opacity.value = withDelay(160, withTiming(0, { duration: 240 }));
      dragX.value = withSpring(
        exit.x,
        { ...FLING_SPRING, velocity: exit.velocityX ?? 0 },
        (finished) => {
          if (!finished) return;
          lift.value = 0;
          dragX.value = 0;
          dragY.value = 0;
          depth.value = restSlot;
          opacity.value = withTiming(targetOpacity, { duration: 320 });
        },
      );
      return;
    }

    if (swap.direction === 'prev' && slot === 0) {
      // Returning card drops back onto the top of the deck.
      lift.value = withSequence(withTiming(1, { duration: 0 }), withDelay(450, withTiming(0, { duration: 0 })));
      depth.value = 0;
      dragX.value = 0;
      dragY.value = withSequence(withTiming(-height * 0.35, { duration: 0 }), withSpring(0, RETURN_SPRING));
      opacity.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 260 }));
      return;
    }

    lift.value = 0;
    if (Math.abs(dragX.value) > width * 0.5) {
      // Still off to the side after a quick double swap: skip the trip back across the screen.
      dragX.value = 0;
      dragY.value = 0;
      depth.value = restSlot;
      opacity.value = withTiming(targetOpacity, { duration: 260 });
      return;
    }
    // Everyone else springs one slot forward (or back), front first, in a short cascade.
    const delay = (swap.direction === 'next' ? 40 : 60) + restSlot * 45;
    depth.value = withDelay(delay, withSpring(restSlot, SETTLE_SPRING));
    opacity.value = withTiming(targetOpacity, { duration: 260 });
    dragX.value = withSpring(0, SETTLE_SPRING);
    dragY.value = withSpring(0, SETTLE_SPRING);
    // Shared values are stable refs; only slot changes should start an animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const pan = usePanGesture({
    enabled: isFront && swipeEnabled,
    activeOffsetX: [-12, 12],
    failOffsetY: [-24, 24],
    // `.set()` instead of `.value =`: the React Compiler lint treats hook results as immutable.
    onUpdate: (event) => {
      dragX.set(event.translationX);
      dragY.set(event.translationY * 0.35);
    },
    onDeactivate: (event) => {
      const flung = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      const dragged = Math.abs(event.translationX) > width * SWIPE_DISTANCE_RATIO;
      if (!event.canceled && (flung || dragged)) {
        const direction = Math.sign(flung ? event.velocityX : event.translationX) || 1;
        scheduleOnRN(onSwipe, {
          x: direction * width * 1.5,
          y: dragY.get() + height * 0.1,
          velocityX: event.velocityX,
        });
        return;
      }
      dragX.set(withSpring(0, SETTLE_SPRING));
      dragY.set(withSpring(0, SETTLE_SPRING));
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const d = depth.value;
    const travel = dragX.value / width;
    const rotation = Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, travel * ROTATION_PER_WIDTH));
    const swing = Math.max(-MAX_SWING_DEG, Math.min(MAX_SWING_DEG, travel * 12));
    return {
      opacity: opacity.value,
      // Depth decides stacking, so a card passes behind its neighbours as it moves back.
      zIndex: Math.round((visibleCount + 1 - d) * 100) + lift.value * 1000,
      transform: [
        { perspective: PERSPECTIVE },
        { translateX: dragX.value },
        { translateY: -d * stepY + dragY.value },
        { scale: 1 - d * SCALE_STEP },
        { rotateX: `${d * TILT_DEG}deg` },
        { rotateY: `${swing}deg` },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(depth.value, [0, Math.max(stackDepth, 1)], [0, maxShade], Extrapolation.CLAMP),
  }));
  const shortlistStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [width * 0.06, width * 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [
      { rotate: '-12deg' },
      { scale: interpolate(dragX.value, [0, width * 0.3], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [-width * 0.3, -width * 0.06], [1, 0], Extrapolation.CLAMP),
    transform: [
      { rotate: '12deg' },
      { scale: interpolate(dragX.value, [-width * 0.3, 0], [1, 0.8], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        aria-hidden={!isFront}
        style={[
          styles.card,
          {
            width,
            height,
            top: stackDepth * peek,
            boxShadow: palette.shadow.deck,
            pointerEvents: isFront ? 'auto' : 'none',
          },
          cardStyle,
        ]}
      >
        {children}
        <Animated.View style={[styles.shade, shadeStyle]} />
        <Animated.View
          className="rounded-xl border-[3px] border-emerald-500 bg-white/90 px-3 py-1 dark:bg-gray-900/90"
          style={[styles.stamp, styles.stampLeft, shortlistStyle]}
        >
          <Text className="text-base font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {stampLabels.shortlist}
          </Text>
        </Animated.View>
        <Animated.View
          className="rounded-xl border-[3px] border-rose-500 bg-white/90 px-3 py-1 dark:bg-gray-900/90"
          style={[styles.stamp, styles.stampRight, skipStyle]}
        >
          <Text className="text-base font-extrabold uppercase tracking-widest text-rose-600 dark:text-rose-400">
            {stampLabels.skip}
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    borderRadius: 24,
  },
  shade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 24,
    backgroundColor: '#020617',
    pointerEvents: 'none',
  },
  stamp: {
    position: 'absolute',
    top: 132,
    pointerEvents: 'none',
  },
  stampLeft: { left: 20 },
  stampRight: { right: 20 },
});
