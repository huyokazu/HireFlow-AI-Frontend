import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';

const DOT_SIZE = 6;
const DOT_COUNT = 3;
const TRACK_THICKNESS = 8;
const LINE_THICKNESS = 2;
/** Time for one dot to cross the connector. */
const CYCLE_MS = 2400;

type FlowConnectorProps = {
  /** Work is coming in: the agent before the connector is running. */
  flowing: boolean;
  queued: number;
  /** The agent after the connector is paused, so its queue can only grow. */
  held: boolean;
  /** Runs down the page on narrow screens and across it on wide ones. */
  vertical: boolean;
  accessibilityLabel: string;
};

/** The hand-off between two agents: a line with work moving along it, and the queue waiting at its end. */
export function FlowConnector({ flowing, queued, held, vertical, accessibilityLabel }: FlowConnectorProps) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [length, setLength] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLength(vertical ? height : width);
  };

  const track = (
    <View onLayout={onLayout} style={vertical ? styles.verticalTrack : styles.horizontalTrack}>
      <View
        className="rounded-full bg-slate-200 dark:bg-white/15"
        style={vertical ? styles.verticalLine : styles.horizontalLine}
      />
      {flowing && !reduceMotion && length > DOT_SIZE && <FlowDots travel={length - DOT_SIZE} vertical={vertical} />}
    </View>
  );

  if (vertical) {
    // The line sits under the centre of the node icons above and below it.
    return (
      <View role="img" aria-label={accessibilityLabel} className="flex-row items-center gap-3" style={styles.verticalRow}>
        {track}
        <QueueChip queued={queued} held={held} />
      </View>
    );
  }

  return (
    <View role="img" aria-label={accessibilityLabel} className="flex-1 items-center gap-1.5 px-1">
      <QueueChip queued={queued} held={held} />
      <View className="w-full flex-row items-center">
        {track}
        <Ionicons name="chevron-forward" size={12} color={palette.icon.faint} style={styles.arrow} />
      </View>
    </View>
  );
}

function QueueChip({ queued, held }: { queued: number; held: boolean }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage.orchestrator;

  if (queued === 0) {
    return <Text className="py-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">{copy.clear}</Text>;
  }
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${
        held ? 'bg-amber-50 dark:bg-amber-500/15' : 'bg-indigo-50 dark:bg-indigo-500/15'
      }`}
    >
      {held && <Ionicons name="pause" size={10} color={palette.amber} />}
      <Text
        className={`text-[11px] font-semibold ${
          held ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-700 dark:text-indigo-200'
        }`}
        numberOfLines={1}
      >
        {held ? copy.held(queued) : copy.queue(queued)}
      </Text>
    </View>
  );
}

function FlowDots({ travel, vertical }: { travel: number; vertical: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [progress]);

  return (
    <>
      {Array.from({ length: DOT_COUNT }, (_, index) => (
        <FlowDot key={index} progress={progress} offset={index / DOT_COUNT} travel={travel} vertical={vertical} />
      ))}
    </>
  );
}

function FlowDot({
  progress,
  offset,
  travel,
  vertical,
}: {
  progress: SharedValue<number>;
  offset: number;
  travel: number;
  vertical: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const position = (progress.get() + offset) % 1;
    const distance = position * travel;
    return {
      // Fades in as it leaves one agent and out as it reaches the next.
      opacity: interpolate(position, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
      transform: vertical ? [{ translateY: distance }] : [{ translateX: distance }],
    };
  });

  return (
    <Animated.View
      className="bg-indigo-500 dark:bg-indigo-400"
      style={[styles.dot, vertical ? styles.verticalDot : styles.horizontalDot, style]}
    />
  );
}

const styles = StyleSheet.create({
  horizontalTrack: { flex: 1, height: TRACK_THICKNESS, justifyContent: 'center' },
  verticalTrack: { width: TRACK_THICKNESS, height: 40, alignItems: 'center' },
  horizontalLine: { height: LINE_THICKNESS },
  verticalLine: { width: LINE_THICKNESS, flex: 1 },
  // Node icons are 40 wide, inside a 1px border and 12px of padding, so their centre is 33px in.
  verticalRow: { paddingLeft: 33 - TRACK_THICKNESS / 2 },
  arrow: { marginLeft: -3 },
  dot: { position: 'absolute', width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  horizontalDot: { left: 0, top: (TRACK_THICKNESS - DOT_SIZE) / 2 },
  verticalDot: { top: 0, left: (TRACK_THICKNESS - DOT_SIZE) / 2 },
});
