import { useState } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { HiringMonth } from '../../services/analytics';
import { Panel } from '../ui/Panel';
import { ColumnChart, PARTIAL_SWATCH_CLASS } from './ColumnChart';
import { Readout, ReadoutValue } from './Readout';

type HiringTrendPanelProps = {
  /** Oldest first; the last one is the current month, still running. */
  months: HiringMonth[];
  enterDelay: number;
};

/**
 * Hires and average time to hire per month. Two measures on different scales, so two charts
 * rather than two axes; they share the active month and one readout.
 */
export function HiringTrendPanel({ months, enterDelay }: HiringTrendPanelProps) {
  const { t } = useI18n();
  const copy = t.analyticsPage.trend;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (months.length === 0) return null;

  const lastIndex = months.length - 1;
  const shown = months[activeIndex ?? lastIndex];
  const dates = months.map((month) => new Date(month.start));
  const labels = dates.map((date) => t.date.monthShort(date));
  const monthName = (index: number, separator: string) =>
    index === lastIndex ? `${t.date.monthYear(dates[index])}${separator}${copy.soFar}` : t.date.monthYear(dates[index]);
  const columnLabel = (index: number) =>
    copy.monthA11y(monthName(index, ', '), months[index].hires, months[index].timeToHireDays);
  const totalHires = months.reduce((total, month) => total + month.hires, 0);

  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      <View
        role="group"
        aria-label={copy.summary(totalHires, months.length, months[0].timeToHireDays, months[lastIndex].timeToHireDays)}
      >
        <Readout label={monthName(activeIndex ?? lastIndex, ' · ')}>
          <ReadoutValue value={shown.hires} label={copy.hiresUnit(shown.hires)} />
          <ReadoutValue value={shown.timeToHireDays} label={copy.daysUnit(shown.timeToHireDays)} />
        </Readout>

        <View className="mt-4 gap-5 md:flex-row md:gap-6">
          <View className="md:flex-1">
            <Text className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">{copy.hires}</Text>
            <ColumnChart
              values={months.map((month) => month.hires)}
              labels={labels}
              activeIndex={activeIndex}
              onActiveChange={setActiveIndex}
              columnLabel={columnLabel}
              partialLast
              enterDelay={enterDelay}
            />
          </View>
          <View className="md:flex-1">
            <Text className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">{copy.timeToHire}</Text>
            <ColumnChart
              values={months.map((month) => month.timeToHireDays)}
              labels={labels}
              activeIndex={activeIndex}
              onActiveChange={setActiveIndex}
              columnLabel={columnLabel}
              partialLast
              focusable={false}
              enterDelay={enterDelay}
            />
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-1.5">
          <View className={PARTIAL_SWATCH_CLASS} />
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {copy.partialNote(t.date.month(dates[lastIndex]))}
          </Text>
        </View>
      </View>
    </Panel>
  );
}
