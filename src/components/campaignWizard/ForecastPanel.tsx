import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { CampaignDraft } from '../../services/campaigns';
import type { CampaignForecast, ForecastFix, ForecastRiskLevel } from '../../services/digitalTwin';
import { useAppTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { PulseRing } from '../ui/pulse';
import { SectionLabel } from '../ui/SectionLabel';
import { TargetProgressBar } from '../ui/TargetProgressBar';
import { describeFix, describeReason } from './forecastCopy';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const RISK_STYLES: Record<
  ForecastRiskLevel,
  { chipClassName: string; textClassName: string; icon: IconName; color: (palette: Palette) => string }
> = {
  low: {
    chipClassName: 'bg-emerald-50 dark:bg-emerald-500/15',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
    icon: 'shield-checkmark-outline',
    color: (palette) => palette.emerald,
  },
  medium: {
    chipClassName: 'bg-amber-50 dark:bg-amber-500/15',
    textClassName: 'text-amber-700 dark:text-amber-300',
    icon: 'warning-outline',
    color: (palette) => palette.amber,
  },
  high: {
    chipClassName: 'bg-rose-50 dark:bg-rose-500/15',
    textClassName: 'text-rose-700 dark:text-rose-300',
    icon: 'alert-circle-outline',
    color: (palette) => palette.rose,
  },
};

/** Fill colour for the forecast bar: on target, within 10 points of it, or further off. */
export function barClassFor(matchRate: number, target: number) {
  if (matchRate >= target) return 'bg-emerald-500 dark:bg-emerald-400';
  if (matchRate >= target - 10) return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-rose-500 dark:bg-rose-400';
}

type ForecastPanelProps = {
  draft: CampaignDraft;
  forecast: CampaignForecast;
  fixes: ForecastFix[];
  onApplyFix: (fix: ForecastFix) => void;
};

/** The Hiring Digital Twin's live prediction for the campaign being set up, with one-tap fixes. */
export function ForecastPanel({ draft, forecast, fixes, onApplyFix }: ForecastPanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const risk = RISK_STYLES[forecast.risk.level];
  const gap = forecast.matchRate - draft.targetMatchRate;
  const isRough = !draft.title.trim() || !draft.department;
  const midpoint = Math.round((draft.salaryMin + draft.salaryMax) / 2);
  const salaryGap = forecast.salaryGapPercent;

  return (
    <Panel title={t.forecast.title} subtitle={t.forecast.subtitle} action={<LivePill />}>
      {isRough && (
        <View className="mb-4 flex-row items-start gap-2 rounded-xl bg-slate-100/80 p-3 dark:bg-white/5">
          <Ionicons name="information-circle-outline" size={16} color={palette.icon.muted} />
          <Text className="flex-1 text-xs text-slate-600 dark:text-slate-300">{t.forecast.roughEstimate}</Text>
        </View>
      )}

      <View className="flex-row items-start justify-between gap-3">
        <View>
          <SectionLabel>{t.forecast.matchRate}</SectionLabel>
          <AnimatedNumber
            value={forecast.matchRate}
            format={(value) => `${value}%`}
            className="mt-1 text-4xl font-bold text-slate-900 dark:text-white"
          />
        </View>
        <Animated.View
          key={forecast.risk.level}
          entering={ZoomIn.springify().damping(14)}
          className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${risk.chipClassName}`}
        >
          <Ionicons name={risk.icon} size={14} color={risk.color(palette)} />
          <Text className={`text-xs font-semibold ${risk.textClassName}`}>{t.forecast.risk[forecast.risk.level]}</Text>
        </Animated.View>
      </View>
      <View className="mt-3">
        <TargetProgressBar
          value={forecast.matchRate}
          target={draft.targetMatchRate}
          barClassName={barClassFor(forecast.matchRate, draft.targetMatchRate)}
        />
      </View>
      <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {t.forecast.target(draft.targetMatchRate)} · {t.forecast.gapToTarget(gap)}
      </Text>

      <View className="mt-5 flex-row gap-3">
        <MetricTile
          icon="people-outline"
          label={t.forecast.applicants}
          value={forecast.qualifiedApplicants}
          format={String}
          hint={t.forecast.applicantsHint}
        />
        <MetricTile
          icon="time-outline"
          label={t.forecast.timeToHire}
          value={forecast.timeToHireDays}
          format={t.forecast.days}
        />
      </View>

      <View className="mt-5 gap-1.5">
        <View className="flex-row items-center justify-between gap-2">
          <SectionLabel>{t.forecast.salaryVsMarket}</SectionLabel>
          <Text
            className={`text-xs font-bold ${
              salaryGap < -5
                ? 'text-rose-600 dark:text-rose-400'
                : salaryGap > 5
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.forecast.gap(salaryGap)}
          </Text>
        </View>
        <Text className="text-sm text-slate-700 dark:text-slate-200">
          {t.forecast.yourMidpoint(midpoint)} · {t.forecast.marketMedian(forecast.marketMedian)}
        </Text>
      </View>

      <View className="mt-5">
        <PredictedBottlenecks draft={draft} forecast={forecast} fixes={fixes} onApplyFix={onApplyFix} />
      </View>

      <View className="mt-5 flex-row items-center gap-1.5 border-t border-slate-100 pt-4 dark:border-white/10">
        <Ionicons name="git-branch-outline" size={13} color={palette.icon.faint} />
        <Text className="text-xs text-slate-400 dark:text-slate-500">{t.forecast.source}</Text>
      </View>
    </Panel>
  );
}

/** One-line version of the forecast, shown above the form where the full panel sits further down. */
export function ForecastStrip({ draft, forecast }: { draft: CampaignDraft; forecast: CampaignForecast }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const risk = RISK_STYLES[forecast.risk.level];

  return (
    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-slate-100/80 px-3.5 py-2.5 dark:bg-white/5">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="sparkles" size={14} color={palette.violet} />
        <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.forecast.matchRate}</Text>
        <AnimatedNumber
          value={forecast.matchRate}
          format={(value) => `${value}%`}
          className="text-xs font-bold text-slate-900 dark:text-white"
        />
        <Text className="text-xs text-slate-500 dark:text-slate-400">/ {draft.targetMatchRate}%</Text>
      </View>
      <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${risk.chipClassName}`}>
        <Ionicons name={risk.icon} size={12} color={risk.color(palette)} />
        <Text className={`text-[11px] font-semibold ${risk.textClassName}`}>{t.forecast.risk[forecast.risk.level]}</Text>
      </View>
    </View>
  );
}

type PredictedBottlenecksProps = {
  draft: CampaignDraft;
  forecast: CampaignForecast;
  fixes: ForecastFix[];
  onApplyFix: (fix: ForecastFix) => void;
  /** Button text, for where a plain "Apply" could be mistaken for changing the live campaign. */
  applyLabel?: string;
  applyA11y?: (fix: string) => string;
};

/** The risks the Digital Twin predicts for a setup, each with a fix and the match rate it adds. */
export function PredictedBottlenecks({
  draft,
  forecast,
  fixes,
  onApplyFix,
  applyLabel,
  applyA11y,
}: PredictedBottlenecksProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  return (
    <View>
      <SectionLabel>{t.forecast.bottlenecks}</SectionLabel>
      <View className="mt-2.5 gap-2.5">
        {fixes.length === 0 ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            className="flex-row items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-400/20 dark:bg-emerald-500/10"
          >
            <Ionicons name="checkmark-circle" size={18} color={palette.emerald} />
            <Text className="flex-1 text-sm text-emerald-900 dark:text-emerald-100">{t.forecast.noBottlenecks}</Text>
          </Animated.View>
        ) : (
          fixes.map((fix) => (
            <FixRow
              key={fix.reason}
              reason={describeReason(fix.reason, draft, forecast, t)}
              fix={describeFix(fix, draft, t, pick)}
              lift={fix.matchRate - forecast.matchRate}
              applyLabel={applyLabel ?? t.forecast.apply}
              applyA11y={applyA11y ?? t.forecast.applyA11y}
              onApply={() => onApplyFix(fix)}
            />
          ))
        )}
      </View>
    </View>
  );
}

function LivePill() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-500/15">
      <View className="h-2 w-2 items-center justify-center">
        <PulseRing color={palette.emerald} active size={8} />
        <View className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      </View>
      <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t.forecast.live}</Text>
    </View>
  );
}

function MetricTile({
  icon,
  label,
  value,
  format,
  hint,
}: {
  icon: IconName;
  label: string;
  value: number;
  format: (value: number) => string;
  hint?: string;
}) {
  const { palette } = useAppTheme();
  return (
    <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white/60 p-3.5 dark:border-white/10 dark:bg-white/5">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={palette.icon.muted} />
        <Text className="flex-1 text-xs font-medium text-slate-500 dark:text-slate-400" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <AnimatedNumber value={value} format={format} className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white" />
      {hint && <Text className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</Text>}
    </View>
  );
}

function FixRow({
  reason,
  fix,
  lift,
  applyLabel,
  applyA11y,
  onApply,
}: {
  reason: string;
  fix: string;
  /** Match-rate points the fix is forecast to add. */
  lift: number;
  applyLabel: string;
  applyA11y: (fix: string) => string;
  onApply: () => void;
}) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOut.duration(180)}
      layout={LinearTransition.springify().damping(18)}
      className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-400/20 dark:bg-amber-500/10"
    >
      <View className="flex-row items-start gap-2">
        <Ionicons name="warning-outline" size={16} color={palette.amber} />
        <Text className="flex-1 text-sm text-slate-800 dark:text-slate-100">{reason}</Text>
      </View>
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-[150px] flex-1 flex-row items-center gap-1.5">
          <Ionicons name="sparkles" size={14} color={palette.violet} />
          <Text className="flex-1 text-sm font-medium text-violet-800 dark:text-violet-200">{fix}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {lift > 0 && (
            <View className="rounded-full bg-emerald-100 px-2 py-0.5 dark:bg-emerald-500/20">
              <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t.forecast.lift(lift)}</Text>
            </View>
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={applyA11y(fix)}
            onPress={onApply}
            className="h-8 items-center justify-center rounded-lg bg-indigo-600 px-3 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Text className="text-xs font-semibold text-white">{applyLabel}</Text>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
}
