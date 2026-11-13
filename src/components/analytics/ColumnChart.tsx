import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { formatTick, niceStep } from '../../utils/charts';

const GRID_INTERVALS = 3;
/** Thin marks, well under the 24px cap. */
const BAR_WIDTH = 16;
const ENTER_STAGGER_MS = 50;

// One series, so one colour: finished periods in the accent. The period still running is drawn
// outlined in it, so it reads as unfinished; the outline keeps over 3:1 against the panel in both
// modes, and the readout prints its value. Validated against the panel surfaces.
const COLUMN_CLASS = {
  complete: 'rounded-t bg-indigo-600 dark:bg-indigo-500',
  partial: 'rounded-t border-2 border-b-0 border-indigo-600 bg-indigo-100 dark:border-indigo-400 dark:bg-indigo-500/20',
} as const;

/** Swatch for the note that explains the outlined column. */
export const PARTIAL_SWATCH_CLASS =
  'h-3 w-3 rounded-sm border-2 border-indigo-600 bg-indigo-100 dark:border-indigo-400 dark:bg-indigo-500/20';

type ColumnChartProps = {
  values: number[];
  /** X-axis label per column. */
  labels: string[];
  /** The column under the pointer or focus; shared with the readout that prints its values. */
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
  /** Accessible name per column, values included. */
  columnLabel: (index: number) => string;
  /** The last period isn't over yet: drawn outlined. */
  partialLast?: boolean;
  /**
   * False when another chart already gives keyboards and screen readers the same columns (two
   * charts sharing one readout); this one then follows the pointer only.
   */
  focusable?: boolean;
  plotHeight?: number;
  /** Wait before the first column grows in. */
  enterDelay?: number;
};

/**
 * Columns for one measure over time, with clean ticks and a hairline grid. Hover, focus or tap a
 * column to make it active; its x label turns bold, and the active one defaults to the last.
 */
export function ColumnChart({
  values,
  labels,
  activeIndex,
  onActiveChange,
  columnLabel,
  partialLast = false,
  focusable = true,
  plotHeight = 120,
  enterDelay = 0,
}: ColumnChartProps) {
  const shownIndex = activeIndex ?? values.length - 1;
  const step = niceStep(Math.max(1, ...values) / GRID_INTERVALS);
  const scaleMax = step * GRID_INTERVALS;
  const ticks = Array.from({ length: GRID_INTERVALS + 1 }, (_, index) => step * (GRID_INTERVALS - index));

  return (
    <View className="flex-row">
      {/* Y axis: clean ticks, aligned digits. */}
      <View className="mr-2 justify-between" style={{ height: plotHeight }} aria-hidden>
        {ticks.map((tick) => (
          <Text
            key={tick}
            className="-my-1.5 text-right text-[10px] leading-3 text-slate-400 dark:text-slate-500"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatTick(tick)}
          </Text>
        ))}
      </View>

      <View className="flex-1">
        <View style={{ height: plotHeight }}>
          {/* Hairline grid, the baseline one step stronger. */}
          {ticks.map((tick, index) => (
            <View
              key={tick}
              className={`absolute left-0 right-0 h-px ${
                index === ticks.length - 1 ? 'bg-slate-200 dark:bg-white/15' : 'bg-slate-100 dark:bg-white/5'
              }`}
              style={{ top: (index / GRID_INTERVALS) * plotHeight }}
            />
          ))}
          <View className="absolute inset-0 flex-row">
            {values.map((value, index) => (
              <Pressable
                key={index}
                accessibilityLabel={focusable ? columnLabel(index) : undefined}
                aria-hidden={!focusable}
                focusable={focusable}
                onHoverIn={() => onActiveChange(index)}
                onHoverOut={() => onActiveChange(null)}
                onFocus={() => onActiveChange(index)}
                onBlur={() => onActiveChange(null)}
                onPress={() => onActiveChange(index)}
                className={`flex-1 items-center justify-end rounded-lg ${
                  activeIndex === index ? 'bg-slate-100/80 dark:bg-white/5' : ''
                }`}
              >
                <Column
                  value={value}
                  scaleMax={scaleMax}
                  plotHeight={plotHeight}
                  partial={partialLast && index === values.length - 1}
                  enterDelay={enterDelay + index * ENTER_STAGGER_MS}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-1.5 flex-row" aria-hidden>
          {labels.map((label, index) => (
            <Text
              key={index}
              numberOfLines={1}
              className={`flex-1 text-center text-[11px] ${
                index === shownIndex
                  ? 'font-semibold text-slate-700 dark:text-slate-200'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

/** One column: grows up from the baseline, rounded at the data end only. */
function Column({
  value,
  scaleMax,
  plotHeight,
  partial,
  enterDelay,
}: {
  value: number;
  scaleMax: number;
  plotHeight: number;
  partial: boolean;
  enterDelay: number;
}) {
  const reduceMotion = useReducedMotion();
  const target = (Math.max(0, value) / scaleMax) * plotHeight;
  const height = useSharedValue(reduceMotion ? target : 0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Only the first grow-in is staggered; later changes respond at once.
    const wait = isFirstRun.current ? enterDelay : 0;
    isFirstRun.current = false;
    height.set(
      reduceMotion ? target : withDelay(wait, withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) })),
    );
    // `height` is a stable shared value; only a new target should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion]);

  const style = useAnimatedStyle(() => ({ height: height.get() }));

  return (
    <Animated.View
      className={partial ? COLUMN_CLASS.partial : COLUMN_CLASS.complete}
      style={[{ width: BAR_WIDTH }, style]}
    />
  );
}
