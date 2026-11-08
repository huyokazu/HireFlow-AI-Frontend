import { useEffect } from 'react';
import { useReducedMotion, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

/** Spring presets shared by every animated control, so the motion reads as one system. */
export const SPRINGS = {
  /** Candidate deck: the cards behind spring forward when the front one leaves. */
  deck: { stiffness: 320, damping: 26, mass: 0.9 },
  /** Hover lift and press dip on buttons. */
  press: { stiffness: 420, damping: 24, mass: 0.6 },
  /** A sliding pill's leading edge… */
  pillLead: { stiffness: 420, damping: 34, mass: 0.7 },
  /** …and its trailing edge, a little slower, so the pill stretches while it travels. */
  pillTrail: { stiffness: 230, damping: 26, mass: 0.8 },
  /** Bars and progress fills gliding to a new value; a touch of overshoot. */
  value: { stiffness: 170, damping: 19, mass: 1 },
  /** Cards that change height between states. */
  morph: { stiffness: 240, damping: 28, mass: 0.9 },
} as const;

/** Delay between siblings in an entrance cascade. */
export const STAGGER_MS = 60;

/** Entrance delay of the `index`th item in a cascade that starts after `start` ms. */
export function staggerDelay(index: number, start = 0): number {
  return start + index * STAGGER_MS;
}

/** Hover and press physics for anything actionable. */
export const HOVER_SCALE = 1.02;
export const HOVER_LIFT = -1;
export const PRESSED_SCALE = 0.96;

/**
 * A highlight that glides to the span [from, to] along one axis, like a sliding pill under the
 * selected tab. Its leading edge springs faster than its trailing edge, so it stretches while it
 * travels and settles back to its size. The first real span (e.g. after measuring) is taken as is.
 */
export function useFluidSpan(from: number, to: number): { start: SharedValue<number>; end: SharedValue<number> } {
  const reduceMotion = useReducedMotion();
  const start = useSharedValue(from);
  const end = useSharedValue(to);

  useEffect(() => {
    const unset = end.get() - start.get() <= 0;
    if (reduceMotion || unset) {
      start.set(from);
      end.set(to);
      return;
    }
    const forward = from > start.get();
    start.set(withSpring(from, forward ? SPRINGS.pillTrail : SPRINGS.pillLead));
    end.set(withSpring(to, forward ? SPRINGS.pillLead : SPRINGS.pillTrail));
    // `start` and `end` are stable shared values; only a new span should move the pill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, reduceMotion]);

  return { start, end };
}
