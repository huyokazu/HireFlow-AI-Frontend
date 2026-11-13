import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { GestureDetector, useHoverGesture, usePanGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme } from '../../theme';
import { SPRINGS } from '../ui/motion';

export type SwapDirection = 'next' | 'prev';

/** Which side the front card leaves to (the sign of `x`); `velocityX` carries a swipe's momentum. */
export type ExitVector = { x: number; velocityX?: number };

export type SwapEvent = {
  direction: SwapDirection;
  exit?: ExitVector;
};

/** How each of the three drawn cards rests, front to back: smaller, lower and fainter. */
const STACK = {
  scale: [1, 0.95, 0.9],
  y: [0, 14, 28],
  opacity: [1, 0.75, 0.45],
  zIndex: [30, 20, 10],
};
const SLOTS = [0, 1, 2];
/** Number of cards drawn in the deck, the front one included. */
export const DECK_SLOTS = SLOTS.length;
/** How far the back card peeks out below the front one. */
export const DECK_DEPTH = STACK.y[STACK.y.length - 1];

/** The front card's exit: a curve up and out to one side, turning and fading as it goes. */
const EXIT = { x: 380, y: -40, rotate: 14, duration: 460 };
/** How far the card tilts towards the pointer, in degrees. */
const TILT = { x: 6, y: 8 };
const PERSPECTIVE = 900;
const SWIPE_DISTANCE_RATIO = 0.28;
const SWIPE_VELOCITY = 800;
const RADIUS = 24;

type SwapCardProps = {
  /** 0 is the front card; higher slots sit further back. */
  slot: number;
  /** Slots that are drawn (at most three); deeper cards wait invisibly behind the last one. */
  visibleCount: number;
  /** The swap that produced the current slot assignment. */
  swap: SwapEvent;
  width: number;
  height: number;
  swipeEnabled: boolean;
  onSwipe: (exit: ExitVector) => void;
  stampLabels: { skip: string; shortlist: string };
  children: ReactNode;
};

export function SwapCard({
  slot,
  visibleCount,
  swap,
  width,
  height,
  swipeEnabled,
  onSwipe,
  stampLabels,
  children,
}: SwapCardProps) {
  const reduceMotion = useReducedMotion();
  const { isDark, palette } = useAppTheme();
  const restSlot = Math.min(slot, visibleCount - 1);
  const targetPresence = slot < visibleCount ? 1 : 0;
  const isFront = slot === 0;
  const glareStrength = isDark ? 0.55 : 0.85;

  // `depth` places the card in the stack; `dragX`/`dragY` add swipe and exit movement on top.
  const depth = useSharedValue(restSlot);
  const presence = useSharedValue(targetPresence);
  const fade = useSharedValue(1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Keeps the card that is flying out (or coming back) above the rest of the deck.
  const lift = useSharedValue(0);
  // Pointer position over the card, from -1 to 1 on each axis, and how strongly it shows.
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const hover = useSharedValue(0);
  const press = useSharedValue(0);
  const previousSlot = useRef(slot);

  useEffect(() => {
    const fromSlot = previousSlot.current;
    previousSlot.current = slot;
    if (fromSlot === slot) return;

    if (reduceMotion) {
      lift.set(0);
      fade.set(1);
      depth.set(withTiming(restSlot, { duration: 180 }));
      presence.set(withTiming(targetPresence, { duration: 180 }));
      dragX.set(withTiming(0, { duration: 180 }));
      dragY.set(withTiming(0, { duration: 180 }));
      return;
    }

    if (swap.direction === 'next' && fromSlot === 0) {
      // Leaving card: sideways it accelerates, upwards it eases out, so it travels on a curve.
      const side = Math.sign(swap.exit?.x ?? 1) || 1;
      const travelled = Math.min(1, Math.abs(dragX.get()) / EXIT.x);
      const momentum = Math.min(Math.abs(swap.exit?.velocityX ?? 0) / 3000, 0.5);
      const duration = Math.max(200, EXIT.duration * (1 - travelled) * (1 - momentum));
      lift.set(1);
      tiltX.set(withTiming(0, { duration }));
      tiltY.set(withTiming(0, { duration }));
      hover.set(withTiming(0, { duration }));
      dragX.set(withTiming(side * EXIT.x, { duration, easing: Easing.in(Easing.quad) }));
      dragY.set(withTiming(EXIT.y, { duration, easing: Easing.out(Easing.cubic) }));
      fade.set(
        withTiming(0, { duration, easing: Easing.in(Easing.quad) }, (finished) => {
          if (!finished) return;
          // Tuck in at the back of the deck, out of sight, then fade in if that slot is drawn.
          lift.set(0);
          dragX.set(0);
          dragY.set(0);
          depth.set(restSlot);
          presence.set(targetPresence);
          fade.set(withTiming(1, { duration: 280 }));
        }),
      );
      return;
    }

    if (swap.direction === 'prev' && slot === 0) {
      // Returning card swings back in from the left, along the same curve in reverse.
      lift.set(1);
      depth.set(0);
      presence.set(1);
      dragX.set(-EXIT.x);
      dragY.set(EXIT.y);
      fade.set(0);
      fade.set(withTiming(1, { duration: 240 }));
      dragY.set(withSpring(0, SPRINGS.deck));
      dragX.set(
        withSpring(0, SPRINGS.deck, (finished) => {
          if (finished) lift.set(0);
        }),
      );
      return;
    }

    if (lift.get() > 0) {
      // Still flying after a quick double swap: skip the rest of the trip.
      lift.set(0);
      dragX.set(0);
      dragY.set(0);
      fade.set(withTiming(1, { duration: 220 }));
    }
    // The rest of the deck springs one slot forward (or back), all at once.
    depth.set(withSpring(restSlot, SPRINGS.deck));
    presence.set(withTiming(targetPresence, { duration: 260 }));
    dragX.set(withSpring(0, SPRINGS.deck));
    dragY.set(withSpring(0, SPRINGS.deck));
    // Shared values are stable refs; only slot changes should start an animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const pan = usePanGesture({
    enabled: isFront && swipeEnabled,
    activeOffsetX: [-12, 12],
    failOffsetY: [-24, 24],
    // A press tilts the card towards the finger, as if pushing on that corner.
    onBegin: (event) => {
      if (reduceMotion) return;
      press.set(withSpring(1, SPRINGS.press));
      tiltX.set(withSpring((event.x / width) * 2 - 1, SPRINGS.press));
      tiltY.set(withSpring((event.y / height) * 2 - 1, SPRINGS.press));
    },
    onUpdate: (event) => {
      dragX.set(event.translationX);
      dragY.set(event.translationY * 0.35);
    },
    onDeactivate: (event) => {
      const flung = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      const dragged = Math.abs(event.translationX) > width * SWIPE_DISTANCE_RATIO;
      if (!event.canceled && (flung || dragged)) {
        const direction = Math.sign(flung ? event.velocityX : event.translationX) || 1;
        scheduleOnRN(onSwipe, { x: direction, velocityX: event.velocityX });
        return;
      }
      dragX.set(withSpring(0, SPRINGS.deck));
      dragY.set(withSpring(0, SPRINGS.deck));
    },
    onFinalize: () => {
      press.set(withSpring(0, SPRINGS.press));
      if (hover.get() === 0) {
        tiltX.set(withSpring(0, SPRINGS.press));
        tiltY.set(withSpring(0, SPRINGS.press));
      }
    },
  });

  // A pointer over the front card tilts it in 3D, with a glare that follows the pointer.
  const hoverGesture = useHoverGesture({
    enabled: isFront && !reduceMotion,
    onBegin: () => {
      hover.set(withTiming(1, { duration: 200 }));
    },
    onUpdate: (event) => {
      tiltX.set(withSpring((event.x / width) * 2 - 1, SPRINGS.press));
      tiltY.set(withSpring((event.y / height) * 2 - 1, SPRINGS.press));
    },
    onFinalize: () => {
      hover.set(withTiming(0, { duration: 260 }));
      tiltX.set(withSpring(0, SPRINGS.deck));
      tiltY.set(withSpring(0, SPRINGS.deck));
    },
  });
  const gesture = useSimultaneousGestures(pan, hoverGesture);

  const cardStyle = useAnimatedStyle(() => {
    const d = depth.get();
    return {
      opacity: interpolate(d, SLOTS, STACK.opacity, Extrapolation.CLAMP) * presence.get() * fade.get(),
      zIndex: Math.round(interpolate(d, SLOTS, STACK.zIndex, Extrapolation.CLAMP)) + lift.get() * 100,
      transform: [
        { translateX: dragX.get() },
        { translateY: interpolate(d, SLOTS, STACK.y, Extrapolation.CLAMP) + dragY.get() },
        { scale: interpolate(d, SLOTS, STACK.scale, Extrapolation.CLAMP) },
        {
          rotate: `${interpolate(dragX.get(), [-EXIT.x, 0, EXIT.x], [-EXIT.rotate, 0, EXIT.rotate], Extrapolation.CLAMP)}deg`,
        },
      ],
    };
  });

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { rotateX: `${-tiltY.get() * TILT.x}deg` },
      { rotateY: `${tiltX.get() * TILT.y}deg` },
      { scale: 1 - press.get() * 0.015 },
    ],
  }));

  // The glare sits opposite the tilt, like light catching the raised edge.
  const glareStyle = useAnimatedStyle(() => ({
    opacity: Math.max(hover.get(), press.get() * 0.6) * glareStrength,
    transform: [{ translateX: tiltX.get() * width * 0.35 }, { translateY: tiltY.get() * height * 0.35 }],
  }));

  const shortlistStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.get(), [width * 0.06, width * 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [
      { rotate: '-12deg' },
      { scale: interpolate(dragX.get(), [0, width * 0.3], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.get(), [-width * 0.3, -width * 0.06], [1, 0], Extrapolation.CLAMP),
    transform: [
      { rotate: '12deg' },
      { scale: interpolate(dragX.get(), [-width * 0.3, 0], [1, 0.8], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        aria-hidden={!isFront}
        style={[
          styles.card,
          { width, height, boxShadow: palette.shadow.deck, pointerEvents: isFront ? 'auto' : 'none' },
          cardStyle,
        ]}
      >
        <Animated.View style={[styles.tilt, tiltStyle]}>
          {children}
          <Animated.View style={[styles.glare, { width: width * 2, height: height * 2 }, glareStyle]}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.32)', 'rgba(255, 255, 255, 0)']}
              locations={[0.3, 0.5, 0.7]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
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
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: RADIUS,
    // Scaled from the bottom edge, so each card behind peeks out below the one in front.
    transformOrigin: 'center bottom',
  },
  tilt: {
    flex: 1,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  glare: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
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
