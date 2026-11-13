import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { formatTick, niceStep } from '../../utils/charts';
import { SPRINGS } from '../ui/motion';

const PLOT_HEIGHT = 136;
/** Column width: thin marks, well under the 24px cap, with a 2px gap between the pair. */
const BAR_WIDTH = 12;
const GRID_INTERVALS = 3;
const ENTER_STAGGER_MS = 50;

// Emphasis: the scenario is the accent, the current setup recedes. Validated as a pair against
// the panel surfaces in both modes; the readout above the plot prints the values beside them.
const SERIES = {
  current: { barClassName: 'bg-slate-400 dark:bg-slate-500', flagColor: { light: '#94A3B8', dark: '#64748B' } },
  scenario: { barClassName: 'bg-indigo-600 dark:bg-indigo-500', flagColor: { light: '#4F46E5', dark: '#6366F1' } },
} as const;

type Series = keyof typeof SERIES;

type PipelineBuildUpChartProps = {
  /** Qualified applicants in the pipeline at the end of each week, one entry per week. */
  current: number[];
  scenario: number[];
  /** Week of the first expected hire (1-based); later than the last week means off the chart. */
  currentHireWeek: number;
  scenarioHireWeek: number;
};

/**
 * Weekly build-up of qualified applicants, current setup against the scenario. Hover, focus or tap
 * a week to read its values; the readout shows the last week until then.
 */
export function PipelineBuildUpChart({
  current,
  scenario,
  currentHireWeek,
  scenarioHireWeek,
}: PipelineBuildUpChartProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const weeks = current.length;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const shownIndex = activeIndex ?? weeks - 1;
  const step = niceStep(Math.max(1, ...current, ...scenario) / GRID_INTERVALS);
  const scaleMax = step * GRID_INTERVALS;
  const ticks = Array.from({ length: GRID_INTERVALS + 1 }, (_, index) => step * (GRID_INTERVALS - index));
  const hireLabel = (week: number) => t.twin.firstHireIn(week);
  const summary = t.twin.chartSummary(
    current[weeks - 1] ?? 0,
    scenario[weeks - 1] ?? 0,
    hireLabel(currentHireWeek),
    hireLabel(scenarioHireWeek),
  );

  return (
    <View role="group" aria-label={summary}>
      {/* Readout and legend in one: names keyed by swatch, values for the active week. */}
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
        <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.twin.weekLong(shownIndex + 1)}</Text>
        <ReadoutItem series="scenario" label={t.twin.scenarioShort} value={scenario[shownIndex] ?? 0} />
        <ReadoutItem series="current" label={t.twin.current} value={current[shownIndex] ?? 0} />
      </View>

      <View className="mt-3 flex-row">
        {/* Y axis: clean ticks, aligned digits. */}
        <View className="mr-2 justify-between" style={{ height: PLOT_HEIGHT }} aria-hidden>
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
          <View style={{ height: PLOT_HEIGHT }}>
            {/* Hairline grid, the baseline one step stronger. */}
            {ticks.map((tick, index) => (
              <View
                key={tick}
                className={`absolute left-0 right-0 h-px ${
                  index === ticks.length - 1 ? 'bg-slate-200 dark:bg-white/15' : 'bg-slate-100 dark:bg-white/5'
                }`}
                style={{ top: (index / GRID_INTERVALS) * PLOT_HEIGHT }}
              />
            ))}
            <View className="absolute inset-0 flex-row">
              {current.map((currentValue, index) => (
                <Pressable
                  key={index}
                  accessibilityLabel={t.twin.weekA11y(index + 1, scenario[index] ?? 0, currentValue)}
                  onHoverIn={() => setActiveIndex(index)}
                  onHoverOut={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  onPress={() => setActiveIndex(index)}
                  className={`flex-1 flex-row items-end justify-center gap-0.5 rounded-lg ${
                    activeIndex === index ? 'bg-slate-100/80 dark:bg-white/5' : ''
                  }`}
                >
                  <Bar series="current" value={currentValue} scaleMax={scaleMax} enterDelay={index * ENTER_STAGGER_MS} />
                  <Bar
                    series="scenario"
                    value={scenario[index] ?? 0}
                    scaleMax={scaleMax}
                    enterDelay={index * ENTER_STAGGER_MS}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* X axis: week labels, then a flag under the week each setup is expected to hire in. */}
          <View className="mt-1.5 flex-row" aria-hidden>
            {current.map((_, index) => {
              const week = index + 1;
              return (
                <View key={week} className="flex-1 items-center gap-1">
                  <Text
                    className={`text-[11px] ${
                      index === shownIndex
                        ? 'font-semibold text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {t.twin.week(week)}
                  </Text>
                  <View className="h-3 flex-row gap-0.5">
                    {currentHireWeek === week && <HireFlag series="current" />}
                    {scenarioHireWeek === week && <HireFlag series="scenario" />}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View className="mt-2 flex-row items-center gap-1.5">
        <Ionicons name="flag-outline" size={13} color={palette.icon.muted} />
        <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400">
          {t.twin.firstHireLine(hireLabel(currentHireWeek), hireLabel(scenarioHireWeek))}
        </Text>
      </View>
    </View>
  );
}

function ReadoutItem({ series, label, value }: { series: Series; label: string; value: number }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`h-2.5 w-2.5 rounded-sm ${SERIES[series].barClassName}`} />
      <Text className="text-sm font-bold text-slate-900 dark:text-white">{value}</Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400">{label}</Text>
    </View>
  );
}

/** One column: grows up from the baseline, rounded at the data end only. */
function Bar({
  series,
  value,
  scaleMax,
  enterDelay,
}: {
  series: Series;
  value: number;
  scaleMax: number;
  enterDelay: number;
}) {
  const reduceMotion = useReducedMotion();
  const target = (Math.max(0, value) / scaleMax) * PLOT_HEIGHT;
  const height = useSharedValue(reduceMotion ? target : 0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const firstRun = isFirstRun.current;
    isFirstRun.current = false;
    // The first grow-in is staggered; a new scenario springs each bar to its new height.
    height.set(
      reduceMotion
        ? target
        : firstRun
          ? withDelay(enterDelay, withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) }))
          : withSpring(target, SPRINGS.value),
    );
    // `height` is a stable shared value; only a new target should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion]);

  const style = useAnimatedStyle(() => ({ height: Math.max(0, height.get()) }));

  return (
    <Animated.View
      className={`rounded-t ${SERIES[series].barClassName}`}
      style={[{ width: BAR_WIDTH }, style]}
    />
  );
}

function HireFlag({ series }: { series: Series }) {
  const { isDark } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const color = isDark ? SERIES[series].flagColor.dark : SERIES[series].flagColor.light;
  // Mounted in the week of the first hire, so it pops in wherever a new scenario moves it.
  return (
    <Animated.View
      entering={reduceMotion ? undefined : ZoomIn.springify().stiffness(320).damping(14)}
      exiting={reduceMotion ? undefined : FadeOut.duration(150)}
    >
      <Ionicons name="flag" size={12} color={color} />
    </Animated.View>
  );
}
