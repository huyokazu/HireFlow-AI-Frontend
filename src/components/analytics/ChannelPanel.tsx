import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n, type Dictionary } from '../../i18n';
import type { ChannelResult } from '../../services/analytics';
import { CHANNEL_NAMES, type SourcingChannel } from '../../services/campaigns';
import { percentOf } from '../../utils/charts';
import { Panel } from '../ui/Panel';
import { GrowBar } from './GrowBar';
import { ChartNote, Readout, ReadoutValue } from './Readout';

const ENTER_STAGGER_MS = 80;

// Qualified applicants are the accent; the rest of each channel's applicants recede behind them.
// The pair is validated against the panel surfaces, and every row prints its counts.
const QUALIFIED_CLASS = 'bg-indigo-600 dark:bg-indigo-500';
const OTHER_CLASS = 'bg-slate-300 dark:bg-slate-600';

type ChannelPanelProps = {
  /** Most qualified applicants first. */
  channels: ChannelResult[];
  enterDelay: number;
};

/**
 * Applicants per sourcing channel, split into those who passed AI screening and the rest, on one
 * scale so channels compare by size as well as quality. Hover, focus or tap a channel to read it.
 */
export function ChannelPanel({ channels, enterDelay }: ChannelPanelProps) {
  const { t, pick } = useI18n();
  const copy = t.analyticsPage.channels;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const name = (channel: SourcingChannel) => pick(CHANNEL_NAMES[channel]);

  if (channels.length === 0) {
    return (
      <Panel title={copy.title} subtitle={copy.subtitle}>
        <Text className="text-sm text-slate-500 dark:text-slate-400">{copy.empty}</Text>
      </Panel>
    );
  }

  const shown = channels[activeIndex ?? 0];
  const maxApplicants = Math.max(...channels.map((result) => result.applicants));
  const qualified = channels.reduce((total, result) => total + result.qualified, 0);
  const applicants = channels.reduce((total, result) => total + result.applicants, 0);

  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      <View role="group" aria-label={copy.summary(channels.length, qualified, applicants)}>
        {/* Readout and legend in one: names keyed by swatch, values for the active channel. */}
        <Readout label={name(shown.channel)}>
          <ReadoutValue value={shown.qualified} label={copy.qualified} swatchClassName={QUALIFIED_CLASS} />
          <ReadoutValue value={shown.applicants - shown.qualified} label={copy.other} swatchClassName={OTHER_CLASS} />
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {copy.rate(percentOf(shown.qualified, shown.applicants))}
          </Text>
        </Readout>

        <View className="mt-3 gap-1">
          {channels.map((result, index) => {
            const other = result.applicants - result.qualified;
            const delay = enterDelay + index * ENTER_STAGGER_MS;
            return (
              <Pressable
                key={result.channel}
                accessibilityLabel={copy.channelA11y(
                  name(result.channel),
                  result.qualified,
                  result.applicants,
                  percentOf(result.qualified, result.applicants),
                )}
                onHoverIn={() => setActiveIndex(index)}
                onHoverOut={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onPress={() => setActiveIndex(index)}
                className={`gap-1.5 rounded-xl px-2 py-1.5 ${activeIndex === index ? 'bg-slate-100/80 dark:bg-white/5' : ''}`}
              >
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="shrink text-sm text-slate-600 dark:text-slate-300" numberOfLines={1}>
                    {name(result.channel)}
                  </Text>
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white">
                    {copy.ofApplicants(result.qualified, result.applicants)}
                  </Text>
                </View>
                {/* Stacked: qualified from the baseline, a 2px gap, then the rest; the padding keeps room for the gap. */}
                <View className="flex-row pr-0.5">
                  <GrowBar
                    percent={(result.qualified / maxApplicants) * 100}
                    className={`h-3 ${other > 0 ? '' : 'rounded-r'} ${QUALIFIED_CLASS}`}
                    delay={delay}
                  />
                  {other > 0 && (
                    <GrowBar
                      percent={(other / maxApplicants) * 100}
                      className={`ml-0.5 h-3 rounded-r ${OTHER_CLASS}`}
                      delay={delay}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <ChartNote icon="bulb-outline" text={insight(channels, name, copy)} />
      </View>
    </Panel>
  );
}

/** The channel with the best share of qualified applicants, and the one with the most of them. */
function insight(
  channels: ChannelResult[],
  name: (channel: SourcingChannel) => string,
  copy: Dictionary['analyticsPage']['channels'],
): string {
  const rate = (result: ChannelResult) => result.qualified / result.applicants;
  const mostQualified = channels[0];
  if (channels.length === 1) {
    return copy.single(name(mostQualified.channel), percentOf(mostQualified.qualified, mostQualified.applicants));
  }
  const bestRate = channels.reduce((best, result) => (rate(result) > rate(best) ? result : best));
  const bestPercent = percentOf(bestRate.qualified, bestRate.applicants);
  return bestRate.channel === mostQualified.channel
    ? copy.bestBoth(name(bestRate.channel), bestRate.qualified, bestPercent)
    : copy.best(name(bestRate.channel), bestPercent, name(mostQualified.channel), mostQualified.qualified);
}
