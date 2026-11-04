import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
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

export type SwapDirection = 'next' | 'prev';

/** Where the front card travels before it tucks in behind the stack. */
export type ExitVector = { x: number; y: number };

export type SwapEvent = {
  direction: SwapDirection;
  /** Set when the swap came from a swipe; button presses drop the card straight down. */
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
  offsetX: number;
  offsetY: number;
  skewDeg: number;
  swipeEnabled: boolean;
  onSwipe: (exit: ExitVector) => void;
  children: ReactNode;
};

const SPRING = { damping: 15, stiffness: 140, mass: 0.9 };
const EXIT_DURATION = 340;
const EXIT_TIMING = { duration: EXIT_DURATION, easing: Easing.inOut(Easing.cubic) };
const SCALE_STEP = 0.05;
const MAX_ROTATION_DEG = 12;
const MAX_DEPTH_SHADE = 0.22;
// Extra drop below the card's own height so it fully clears the stack before changing depth.
const DROP_CLEARANCE = 48;
const SWIPE_DISTANCE_RATIO = 0.28;
const SWIPE_VELOCITY = 800;

export function SwapCard({
  slot,
  visibleCount,
  swap,
  width,
  height,
  offsetX,
  offsetY,
  skewDeg,
  swipeEnabled,
  onSwipe,
  children,
}: SwapCardProps) {
  const reduceMotion = useReducedMotion();
  const restSlot = Math.min(slot, visibleCount - 1);
  const targetOpacity = slot < visibleCount ? 1 : 0;
  const isFront = slot === 0;

  // `depth` drives the resting stack offset; `dragX`/`dragY` add swipe and exit movement on top.
  const depth = useSharedValue(restSlot);
  const opacity = useSharedValue(targetOpacity);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const previousSlot = useRef(slot);

  useEffect(() => {
    const fromSlot = previousSlot.current;
    previousSlot.current = slot;
    if (fromSlot === slot) return;

    if (reduceMotion) {
      depth.value = withTiming(restSlot, { duration: 180 });
      opacity.value = withTiming(targetOpacity, { duration: 180 });
      dragX.value = withTiming(0, { duration: 180 });
      dragY.value = withTiming(0, { duration: 180 });
      return;
    }

    const dropDistance = height + DROP_CLEARANCE;

    if (swap.direction === 'next' && fromSlot === 0) {
      // Leaving front card: fly out, then slide in behind the stack while springing back up.
      const exit = swap.exit ?? { x: 0, y: dropDistance };
      dragX.value = withSequence(withTiming(exit.x, EXIT_TIMING), withSpring(0, SPRING));
      dragY.value = withSequence(withTiming(exit.y, EXIT_TIMING), withSpring(0, SPRING));
      depth.value = withDelay(
        EXIT_DURATION,
        withTiming(restSlot, { duration: 520, easing: Easing.out(Easing.cubic) }),
      );
      opacity.value = withDelay(EXIT_DURATION, withTiming(targetOpacity, { duration: 320 }));
      return;
    }

    if (swap.direction === 'prev' && slot === 0) {
      // Returning card: the reverse trip — drop out from behind, move to the front slot, rise.
      dragY.value = withSequence(
        withTiming(dropDistance, EXIT_TIMING),
        withDelay(200, withSpring(0, SPRING)),
      );
      depth.value = withDelay(
        EXIT_DURATION,
        withTiming(0, { duration: 220, easing: Easing.inOut(Easing.cubic) }),
      );
      opacity.value = withDelay(EXIT_DURATION, withTiming(1, { duration: 160 }));
      return;
    }

    // Everyone else shuffles one slot forward or back, slightly after the swap starts.
    depth.value = withDelay(swap.direction === 'next' ? 120 : 260, withSpring(restSlot, SPRING));
    opacity.value = withTiming(targetOpacity, { duration: 260 });
    // A card can still be mid-flight if the user swaps quickly; bring it home.
    dragX.value = withSpring(0, SPRING);
    dragY.value = withSpring(0, SPRING);
    // Shared values are stable refs; only slot changes should start an animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const pan = usePanGesture({
    enabled: isFront && swipeEnabled,
    activeOffsetX: [-12, 12],
    failOffsetY: [-24, 24],
    onUpdate: (event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY * 0.35;
    },
    onDeactivate: (event) => {
      const flung = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      const dragged = Math.abs(event.translationX) > width * SWIPE_DISTANCE_RATIO;
      if (!event.canceled && (flung || dragged)) {
        const direction = Math.sign(flung ? event.velocityX : event.translationX) || 1;
        scheduleOnRN(onSwipe, { x: direction * width * 1.3, y: dragY.value });
        return;
      }
      dragX.value = withSpring(0, SPRING);
      dragY.value = withSpring(0, SPRING);
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const d = depth.value;
    const rotation = interpolate(
      dragX.value,
      [-width, 0, width],
      [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG],
      Extrapolation.CLAMP,
    );
    return {
      opacity: opacity.value,
      // Depth decides stacking, so a card passes behind its neighbours as it moves back.
      zIndex: Math.round((visibleCount + 1 - d) * 100),
      transform: [
        { translateX: d * offsetX + dragX.value },
        { translateY: -d * offsetY + dragY.value },
        { scale: 1 - d * SCALE_STEP },
        { rotate: `${rotation}deg` },
        { skewY: `${skewDeg}deg` },
      ],
    };
  });

  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      depth.value,
      [0, Math.max(visibleCount - 1, 1)],
      [0, MAX_DEPTH_SHADE],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        aria-hidden={!isFront}
        style={[
          styles.card,
          { width, height, top: (visibleCount - 1) * offsetY, pointerEvents: isFront ? 'auto' : 'none' },
          cardStyle,
        ]}
      >
        {children}
        <Animated.View style={[styles.shade, shadeStyle]} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    borderRadius: 24,
    boxShadow: '0px 18px 40px -12px rgba(15, 23, 42, 0.28)',
  },
  shade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    pointerEvents: 'none',
  },
});
