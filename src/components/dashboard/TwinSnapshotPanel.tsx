import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { CampaignDraft } from '../../services/campaigns';
import type { CampaignSummary } from '../../services/dashboard';
import { forecastCalibrated, hireWeek, projectPipeline, type ForecastRiskLevel } from '../../services/digitalTwin';
import { useAppTheme } from '../../theme';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { SPRINGS, staggerDelay } from '../ui/motion';
import { Panel, PanelLink } from '../ui/Panel';
import { TargetProgressBar } from '../ui/TargetProgressBar';

const CHART_HEIGHT = 64;

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const RISK_STYLES: Record<ForecastRiskLevel, { chip: string; text: string }> = {
  low: { chip: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
  medium: { chip: 'bg-amber-50 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' },
  high: { chip: 'bg-rose-50 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300' },
};

type TwinSnapshotPanelProps = {
  campaign: CampaignSummary;
  setup: CampaignDraft;
  /** The campaign's calibration, so the forecast starts from today's live match rate. */
  offset: number;
  onOpenTwin: () => void;
  enterDelay?: number;
};

/**
 * The Digital Twin's forecast for a campaign as it is set up today: match rate against target,
 * applicants and time to hire, and how the pipeline should fill over the first six weeks.
 */
export function TwinSnapshotPanel({ campaign, setup, offset, onOpenTwin, enterDelay = 0 }: TwinSnapshotPanelProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const forecast = forecastCalibrated(setup, offset);
  const weeks = projectPipeline(forecast);
  const firstHire = hireWeek(forecast);
  const peak = Math.max(1, ...weeks);
  const risk = RISK_STYLES[forecast.risk.level];
  const gap = forecast.matchRate - campaign.targetMatchRate;

  return (
    <Panel
      title={t.dashboard.twinTitle}
      subtitle={t.dashboard.twinSubtitle(pick(campaign.title))}
      action={<PanelLink label={t.dashboard.openTwin} onPress={onOpenTwin} />}
    >
      <View className="flex-row flex-wrap items-end justify-between gap-2">
        <View>
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.forecast.matchRate}</Text>
          <AnimatedNumber
            value={forecast.matchRate}
            format={(value) => `${value}%`}
            delay={enterDelay + 200}
            className="text-3xl font-bold text-slate-900 dark:text-white"
          />
        </View>
        <View className={`rounded-full px-2.5 py-1 ${risk.chip}`}>
          <Text className={`text-xs font-semibold ${risk.text}`}>{t.forecast.risk[forecast.risk.level]}</Text>
        </View>
      </View>
      <View className="mt-2">
        <TargetProgressBar
          value={forecast.matchRate}
          target={campaign.targetMatchRate}
          barClassName={gap >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}
          size="sm"
          delay={enterDelay + 200}
        />
        <Text className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t.forecast.target(campaign.targetMatchRate)} · {t.forecast.gapToTarget(gap)}
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Metric label={t.forecast.applicants} hint={t.forecast.applicantsHint}>
          <AnimatedNumber value={forecast.qualifiedApplicants} delay={enterDelay + 260} className="text-lg font-bold text-slate-900 dark:text-white" />
        </Metric>
        <Metric label={t.forecast.timeToHire}>
          <AnimatedNumber
            value={forecast.timeToHireDays}
            format={t.forecast.days}
            delay={enterDelay + 320}
            className="text-lg font-bold text-slate-900 dark:text-white"
          />
        </Metric>
      </View>

      <View className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.twin.buildUp}</Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="flag" size={11} color={palette.emerald} />
            <Text className="text-xs text-slate-500 dark:text-slate-400">
              {t.twin.firstHire}: {t.twin.firstHireIn(firstHire)}
            </Text>
          </View>
        </View>
        <View
          accessibilityRole="image"
          accessibilityLabel={t.dashboard.twinBuildUpA11y(weeks.join(', '))}
          className="mt-3 flex-row items-end gap-2"
          style={{ height: CHART_HEIGHT }}
        >
          {weeks.map((count, index) => (
            <MiniBar
              key={index}
              ratio={count / peak}
              hire={index + 1 === firstHire}
              delay={staggerDelay(index, enterDelay + 240)}
            />
          ))}
        </View>
        <View className="mt-1.5 flex-row gap-2">
          {weeks.map((_, index) => (
            <Text key={index} className="flex-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
              {t.twin.week(index + 1)}
            </Text>
          ))}
        </View>
      </View>
    </Panel>
  );
}

function Metric({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View className="flex-1 rounded-2xl border border-slate-100 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      {children}
      <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{label}</Text>
      {hint && <Text className="text-[11px] leading-4 text-slate-400 dark:text-slate-500">{hint}</Text>}
    </View>
  );
}

/** One week's bar: grows in on first show, then springs to new heights when the forecast changes. */
function MiniBar({ ratio, hire, delay }: { ratio: number; hire: boolean; delay: number }) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(4, ratio * CHART_HEIGHT);
  const height = useSharedValue(reduceMotion ? target : 0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (reduceMotion) {
      height.set(target);
    } else {
      height.set(withDelay(firstRun.current ? delay : 0, withSpring(target, SPRINGS.value)));
    }
    firstRun.current = false;
  }, [target, delay, reduceMotion, height]);

  const style = useAnimatedStyle(() => ({ height: Math.max(0, height.get()) }));
  return (
    <Animated.View
      className={`flex-1 rounded-t-md ${hire ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-indigo-400/80 dark:bg-indigo-400/60'}`}
      style={style}
    />
  );
}
