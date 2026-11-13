import { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRINGS, useFluidSpan } from './motion';

/** Where a chip sits inside its row (or its wrapping group). */
export type ChipFrame = { x: number; y: number; width: number; height: number };

/** Measures each chip in a group, by key, so a highlight can glide to the selected one. */
export function useChipFrames() {
  const [frames, setFrames] = useState<Record<string, ChipFrame>>({});
  const onChipLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      setFrames((current) => {
        const known = current[key];
        if (known && known.x === x && known.y === y && known.width === width && known.height === height) {
          return current;
        }
        return { ...current, [key]: { x, y, width, height } };
      });
    },
    [],
  );
  return { frames, onChipLayout };
}

type ChipHighlightProps = {
  /** The selected chip's frame; the highlight hides until it is known. */
  frame?: ChipFrame;
  /** Fill and shape, e.g. `rounded-full bg-indigo-600`. */
  className: string;
};

/**
 * The selected chip's background, drawn behind the group: it glides to a newly selected chip,
 * stretching on the way and overshooting a little, even onto another row of a wrapping group.
 * Render it first in the chips' parent, and leave the selected chip's own background clear.
 */
export function ChipHighlight({ frame, className }: ChipHighlightProps) {
  const reduceMotion = useReducedMotion();
  const span = useFluidSpan(frame?.x ?? 0, (frame?.x ?? 0) + (frame?.width ?? 0));
  const top = useSharedValue(frame?.y ?? 0);
  const height = useSharedValue(frame?.height ?? 0);
  const presence = useSharedValue(frame ? 1 : 0);

  useEffect(() => {
    if (!frame) {
      presence.set(withTiming(0, { duration: 150 }));
      return;
    }
    const firstShow = height.get() === 0;
    if (reduceMotion || firstShow) {
      top.set(frame.y);
      height.set(frame.height);
    } else {
      top.set(withSpring(frame.y, SPRINGS.pillLead));
      height.set(withSpring(frame.height, SPRINGS.pillLead));
    }
    presence.set(withTiming(1, { duration: 150 }));
  }, [frame, reduceMotion, top, height, presence]);

  const style = useAnimatedStyle(() => ({
    opacity: presence.get(),
    left: span.start.get(),
    width: Math.max(0, span.end.get() - span.start.get()),
    top: top.get(),
    height: height.get(),
  }));

  return <Animated.View className={`absolute ${className}`} style={[{ pointerEvents: 'none' }, style]} />;
}
