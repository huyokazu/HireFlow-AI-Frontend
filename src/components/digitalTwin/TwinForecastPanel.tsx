import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { CampaignDraft } from '../../services/campaigns';
import { hireWeek, projectPipeline, type CampaignForecast, type ForecastFix } from '../../services/digitalTwin';
import { useAppTheme, type Palette } from '../../theme';
import { barClassFor, PredictedBottlenecks } from '../campaignWizard/ForecastPanel';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { ActionButton } from '../ui/ActionButton';
import { Panel } from '../ui/Panel';
import { SectionLabel } from '../ui/SectionLabel';
import { TargetProgressBar } from '../ui/TargetProgressBar';
import { PipelineBuildUpChart } from './PipelineBuildUpChart';

type IconName = ComponentProps<typeof Ionicons>['name'];
/** Which way a metric has to move for the campaign to do better. */
type Better = 'up' | 'down' | 'either';
type Tone = 'good' | 'bad' | 'neutral';

/** A change to the live campaign in flight: applying the scenario, or undoing that. */
export type PendingChange = 'apply' | 'undo' | null;

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const DELTA_STYLES: Record<Tone, { chipClassName: string; textClassName: string; color: (palette: Palette) => string }> =
  {
    good: {
      chipClassName: 'bg-emerald-100 dark:bg-emerald-500/20',
      textClassName: 'text-emerald-700 dark:text-emerald-300',
      color: (palette) => palette.emerald,
    },
    bad: {
      chipClassName: 'bg-rose-100 dark:bg-rose-500/20',
      textClassName: 'text-rose-700 dark:text-rose-300',
      color: (palette) => palette.rose,
    },
    neutral: {
      chipClassName: 'bg-slate-100 dark:bg-white/10',
      textClassName: 'text-slate-600 dark:text-slate-300',
      color: (palette) => palette.icon.muted,
    },
  };

type TwinForecastPanelProps = {
  scenarioDraft: CampaignDraft;
  /** Calibrated forecasts for the current setup and for the scenario. */
  current: CampaignForecast;
  scenario: CampaignForecast;
  fixes: ForecastFix[];
  /** Adds a suggested fix to the scenario (not to the live campaign). */
  onTryFix: (fix: ForecastFix) => void;
  /** The scenario differs from the current setup and has nothing to correct. */
  canApply: boolean;
  pending: PendingChange;
  applyFailed: boolean;
  /** The scenario was just applied: the button shows it for a moment. */
  justApplied?: boolean;
  onApply: () => void;
};

/** The Digital Twin's forecast for the scenario, next to the current setup's, and the way to apply it. */
export function TwinForecastPanel({
  scenarioDraft,
  current,
  scenario,
  fixes,
  onTryFix,
  canApply,
  pending,
  applyFailed,
  justApplied = false,
  onApply,
}: TwinForecastPanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.twin;
  const target = scenarioDraft.targetMatchRate;

  return (
    <Panel title={copy.forecast} subtitle={copy.forecastSubtitle}>
      <View className="gap-3">
        <View className="flex-row gap-3">
          <ComparisonTile
            icon="analytics-outline"
            label={copy.metrics.matchRate}
            value={scenario.matchRate}
            previous={current.matchRate}
            format={(value) => `${value}%`}
            formatDelta={copy.delta.points}
            better="up"
          >
            <View className="mt-2.5">
              <TargetProgressBar
                value={scenario.matchRate}
                target={target}
                barClassName={barClassFor(scenario.matchRate, target)}
                size="sm"
              />
              <Text className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{copy.target(target)}</Text>
            </View>
          </ComparisonTile>
          <ComparisonTile
            icon="people-outline"
            label={copy.metrics.applicants}
            value={scenario.qualifiedApplicants}
            previous={current.qualifiedApplicants}
            format={String}
            formatDelta={copy.delta.count}
            better="up"
            hint={copy.metrics.applicantsHint}
          />
        </View>
        <View className="flex-row gap-3">
          <ComparisonTile
            icon="time-outline"
            label={copy.metrics.timeToHire}
            value={scenario.timeToHireDays}
            previous={current.timeToHireDays}
            format={t.forecast.days}
            formatDelta={copy.delta.days}
            better="down"
          />
          <ComparisonTile
            icon="cash-outline"
            label={copy.metrics.salaryVsMarket}
            value={scenario.salaryGapPercent}
            previous={current.salaryGapPercent}
            format={t.forecast.gap}
            formatDelta={copy.delta.points}
            // Paying more helps hiring but costs more, so neither direction counts as better.
            better="either"
            hint={t.forecast.marketMedian(scenario.marketMedian)}
          />
        </View>
      </View>

      <View className="mt-6">
        <SectionLabel>{copy.buildUp}</SectionLabel>
        <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.buildUpSubtitle}</Text>
        <View className="mt-3">
          <PipelineBuildUpChart
            current={projectPipeline(current)}
            scenario={projectPipeline(scenario)}
            currentHireWeek={hireWeek(current)}
            scenarioHireWeek={hireWeek(scenario)}
          />
        </View>
      </View>

      <View className="mt-6">
        <PredictedBottlenecks
          draft={scenarioDraft}
          forecast={scenario}
          fixes={fixes}
          onApplyFix={onTryFix}
          applyLabel={copy.tryFix}
          applyA11y={copy.tryFixA11y}
        />
      </View>

      {applyFailed && (
        <Animated.View
          entering={FadeIn.duration(200)}
          accessibilityLiveRegion="polite"
          className="mt-5 flex-row items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 dark:bg-rose-500/10"
        >
          <Ionicons name="alert-circle" size={16} color={palette.rose} />
          <Text className="flex-1 text-sm text-rose-700 dark:text-rose-300">{copy.applyError}</Text>
        </Animated.View>
      )}

      <View className="mt-6 flex-row flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
        <View className="min-w-[180px] flex-1 flex-row items-center gap-1.5">
          <Ionicons name="git-branch-outline" size={13} color={palette.icon.faint} />
          <Text className="flex-1 text-xs text-slate-400 dark:text-slate-500">{t.forecast.source}</Text>
        </View>
        <ActionButton
          icon="checkmark-done"
          state={pending !== null ? 'loading' : justApplied ? 'success' : 'idle'}
          label={copy.apply}
          loadingLabel={pending === 'undo' ? copy.reverting : copy.applying}
          successLabel={copy.appliedShort}
          // Stays at full strength while busy, so the orb reads clearly.
          disabled={!canApply && pending === null && !justApplied}
          onPress={onApply}
        />
      </View>
    </Panel>
  );
}

function ComparisonTile({
  icon,
  label,
  value,
  previous,
  format,
  formatDelta,
  better,
  hint,
  children,
}: {
  icon: IconName;
  label: string;
  /** The scenario's value… */
  value: number;
  /** …and the current setup's. */
  previous: number;
  format: (value: number) => string;
  formatDelta: (difference: number) => string;
  better: Better;
  hint?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const difference = value - previous;
  const tone: Tone =
    difference === 0 || better === 'either' ? 'neutral' : difference > 0 === (better === 'up') ? 'good' : 'bad';
  const delta = DELTA_STYLES[tone];
  const footnote = [hint, difference === 0 ? t.twin.delta.none : t.twin.was(format(previous))]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white/60 p-3.5 dark:border-white/10 dark:bg-white/5">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={palette.icon.muted} />
        <Text className="flex-1 text-xs font-medium text-slate-500 dark:text-slate-400" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <AnimatedNumber value={value} format={format} className="text-xl font-bold text-slate-900 dark:text-white" />
        {difference !== 0 && (
          <Animated.View
            key={tone}
            entering={FadeIn.duration(200)}
            className={`flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5 ${delta.chipClassName}`}
          >
            <Ionicons name={difference > 0 ? 'arrow-up' : 'arrow-down'} size={11} color={delta.color(palette)} />
            <Text className={`text-[11px] font-bold ${delta.textClassName}`}>{formatDelta(difference)}</Text>
          </Animated.View>
        )}
      </View>
      <Text className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{footnote}</Text>
      {children}
    </View>
  );
}
