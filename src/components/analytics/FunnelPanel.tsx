import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { FUNNEL_STAGES, type FunnelCounts, type FunnelStage } from '../../services/analytics';
import { useAppTheme } from '../../theme';
import { formatShare, percentOf } from '../../utils/charts';
import { Panel, PanelLink } from '../ui/Panel';
import { GrowBar } from './GrowBar';
import { ChartNote, Readout, ReadoutValue } from './Readout';

const ENTER_STAGGER_MS = 80;

// Ordinal: one hue, a step darker at each stage in light mode and a step lighter in dark mode.
// Validated as an ordinal ramp against the panel surfaces in both modes; every row prints its count.
// Class names are spelled out in full so Tailwind can find them when it scans the source.
const STAGE_BAR_CLASS: Record<FunnelStage, string> = {
  applied: 'bg-indigo-400 dark:bg-indigo-700',
  qualified: 'bg-indigo-500',
  interview: 'bg-indigo-600 dark:bg-indigo-400',
  offer: 'bg-indigo-800 dark:bg-indigo-300',
  hired: 'bg-indigo-950 dark:bg-indigo-200',
};

type FunnelPanelProps = {
  funnel: FunnelCounts;
  /** Offers still waiting for the candidate's answer. */
  offersWaiting: number;
  onOpenBoard: () => void;
  enterDelay: number;
};

/**
 * How many candidates reached each stage, each bar against everyone who applied, with the share
 * that moved on between stages. Hover, focus or tap a stage for its share of applicants.
 */
export function FunnelPanel({ funnel, offersWaiting, onOpenBoard, enterDelay }: FunnelPanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.analyticsPage.funnel;
  const [activeStage, setActiveStage] = useState<FunnelStage | null>(null);
  const shownStage = activeStage ?? 'hired';
  const share = (stage: FunnelStage) => formatShare(funnel[stage], funnel.applied);

  return (
    <Panel
      title={copy.title}
      subtitle={copy.subtitle}
      action={<PanelLink label={copy.openBoard} onPress={onOpenBoard} />}
    >
      <View role="group" aria-label={copy.summary(funnel.applied, funnel.hired)}>
        <Readout label={copy.stages[shownStage]}>
          <ReadoutValue value={funnel[shownStage]} label={copy.share(share(shownStage))} />
        </Readout>

        <View className="mt-3">
          {FUNNEL_STAGES.map((stage, index) => {
            const previous = index > 0 ? funnel[FUNNEL_STAGES[index - 1]] : null;
            return (
              <View key={stage}>
                {previous !== null && (
                  // Between stages: the share of the stage above that got this far.
                  <View className="flex-row items-center gap-1 py-0.5 pl-2">
                    <Ionicons name="arrow-down" size={11} color={palette.icon.faint} />
                    {previous > 0 && (
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                        {copy.movedOn(percentOf(funnel[stage], previous))}
                      </Text>
                    )}
                  </View>
                )}
                <Pressable
                  accessibilityLabel={copy.stageA11y(copy.stages[stage], funnel[stage], share(stage))}
                  onHoverIn={() => setActiveStage(stage)}
                  onHoverOut={() => setActiveStage(null)}
                  onFocus={() => setActiveStage(stage)}
                  onBlur={() => setActiveStage(null)}
                  onPress={() => setActiveStage(stage)}
                  className={`gap-1.5 rounded-xl px-2 py-1.5 ${
                    activeStage === stage ? 'bg-slate-100/80 dark:bg-white/5' : ''
                  }`}
                >
                  <View className="flex-row items-baseline justify-between gap-3">
                    <Text className="shrink text-sm text-slate-600 dark:text-slate-300">{copy.stages[stage]}</Text>
                    <Text className="text-sm font-semibold text-slate-900 dark:text-white">{funnel[stage]}</Text>
                  </View>
                  <View className="flex-row">
                    <GrowBar
                      percent={funnel.applied > 0 ? (funnel[stage] / funnel.applied) * 100 : 0}
                      className={`h-3 rounded-r ${STAGE_BAR_CLASS[stage]}`}
                      delay={enterDelay + index * ENTER_STAGGER_MS}
                    />
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {offersWaiting > 0 && <ChartNote icon="hourglass-outline" text={copy.waiting(offersWaiting)} />}
      </View>
    </Panel>
  );
}
