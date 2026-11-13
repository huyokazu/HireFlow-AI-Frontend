import { useState } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { AGENT_KEYS, type AgentStatsByKey } from '../../services/agents';
import type { AgentWeek } from '../../services/analytics';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { STAGGER_MS } from '../ui/motion';
import { Panel, PanelLink } from '../ui/Panel';
import { ColumnChart, PARTIAL_SWATCH_CLASS } from './ColumnChart';
import { GrowBar } from './GrowBar';
import { Readout, ReadoutValue } from './Readout';

const AGREEMENT_STAGGER_MS = STAGGER_MS;
/** The agreement bars start once the weekly columns are mostly in. */
const AGREEMENT_DELAY = 300;

type AgentImpactPanelProps = {
  /** Oldest first; the last one is this week, still running. */
  weeks: AgentWeek[];
  stats: AgentStatsByKey;
  onOpenAgents: () => void;
  enterDelay: number;
};

/** Recruiter hours the agents saved week by week, and how often HR kept each agent's decisions. */
export function AgentImpactPanel({ weeks, stats, onOpenAgents, enterDelay }: AgentImpactPanelProps) {
  const { t } = useI18n();
  const copy = t.analyticsPage.agents;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (weeks.length === 0) return null;

  const lastIndex = weeks.length - 1;
  const shown = weeks[activeIndex ?? lastIndex];
  const dates = weeks.map((week) => new Date(week.start));
  const weekName = (index: number, separator: string) => {
    const name = copy.weekOf(t.date.dayMonth(dates[index]));
    return index === lastIndex ? `${name}${separator}${copy.soFar}` : name;
  };

  return (
    <Panel
      title={copy.title}
      subtitle={copy.subtitle}
      action={<PanelLink label={copy.openAgents} onPress={onOpenAgents} />}
    >
      <View
        role="group"
        aria-label={copy.summary(weeks.length, weeks[0].hoursSaved, weeks[lastIndex].hoursSaved)}
      >
        <Readout label={weekName(activeIndex ?? lastIndex, ' · ')}>
          <ReadoutValue value={shown.hoursSaved} label={copy.hoursUnit} />
        </Readout>
        <Text className="mb-3 mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">{copy.hoursSaved}</Text>
        <ColumnChart
          values={weeks.map((week) => week.hoursSaved)}
          labels={dates.map((date) => t.date.dayMonthNumeric(date))}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          columnLabel={(index) => copy.weekA11y(weekName(index, ', '), weeks[index].hoursSaved)}
          partialLast
          enterDelay={enterDelay}
        />
        <View className="mt-3 flex-row items-center gap-1.5">
          <View className={PARTIAL_SWATCH_CLASS} />
          <Text className="text-xs text-slate-500 dark:text-slate-400">{copy.thisWeekSoFar}</Text>
        </View>
      </View>

      <View className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10">
        <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.agreement}</Text>
        <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{copy.agreementHint}</Text>
        <View className="mt-3 gap-2.5">
          {AGENT_KEYS.map((agent, index) => (
            <View key={agent} className="flex-row items-center gap-3">
              <Text className="w-24 text-xs text-slate-600 dark:text-slate-300" numberOfLines={1}>
                {t.agentsPage.shortNames[agent]}
              </Text>
              {/* One series on a 0–100% track; the value is printed beside it. */}
              <View className="h-2.5 flex-1 flex-row rounded-r bg-slate-100 dark:bg-white/10" aria-hidden>
                <GrowBar
                  percent={stats[agent].agreementRate}
                  className="h-2.5 rounded-r bg-indigo-600 dark:bg-indigo-500"
                  delay={enterDelay + AGREEMENT_DELAY + index * AGREEMENT_STAGGER_MS}
                />
              </View>
              <AnimatedNumber
                value={stats[agent].agreementRate}
                format={(value) => `${value}%`}
                delay={enterDelay + AGREEMENT_DELAY + index * AGREEMENT_STAGGER_MS}
                className="w-10 text-right text-xs font-semibold text-slate-900 dark:text-white"
              />
            </View>
          ))}
        </View>
      </View>
    </Panel>
  );
}
