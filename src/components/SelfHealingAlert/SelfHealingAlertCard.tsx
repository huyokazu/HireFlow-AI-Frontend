import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type {
  AlertSeverity,
  BottleneckAlert,
  ImpactLevel,
  SuggestedFix,
} from '../../services/selfHealing';
import { useAppTheme } from '../../theme';
import { formatRelativeTime } from '../../utils/formatters';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { PressableScale } from '../ui/PressableScale';
import { PulseGlow, PulseRing } from '../ui/pulse';
import { SectionLabel } from '../ui/SectionLabel';
import { TargetProgressBar } from '../ui/TargetProgressBar';

type ApprovalStatus = 'idle' | 'approving' | 'approved' | 'error';

type ToneKey = AlertSeverity | 'resolved';

type ThemedValue<T> = { light: T; dark: T };

type Tone = {
  icon: ComponentProps<typeof Ionicons>['name'];
  iconColor: ThemedValue<string>;
  glowColor: ThemedValue<string>;
  wash: ThemedValue<readonly [string, string]>;
  borderClassName: string;
  iconBgClassName: string;
  textClassName: string;
  chipClassName: string;
  barClassName: string;
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const TONES: Record<ToneKey, Tone> = {
  critical: {
    icon: 'alert',
    iconColor: { light: '#E11D48', dark: '#FB7185' },
    glowColor: { light: 'rgba(244, 63, 94, 0.5)', dark: 'rgba(244, 63, 94, 0.6)' },
    wash: { light: ['#FFF1F2', '#FFFFFF'], dark: ['rgba(244, 63, 94, 0.16)', 'rgba(17, 24, 39, 0)'] },
    borderClassName: 'border-rose-200 dark:border-rose-400/30',
    iconBgClassName: 'bg-rose-100 dark:bg-rose-500/15',
    textClassName: 'text-rose-600 dark:text-rose-300',
    chipClassName: 'border-rose-200 bg-rose-50 dark:border-rose-400/30 dark:bg-rose-500/10',
    barClassName: 'bg-rose-500 dark:bg-rose-400',
  },
  warning: {
    icon: 'warning',
    iconColor: { light: '#D97706', dark: '#FBBF24' },
    glowColor: { light: 'rgba(245, 158, 11, 0.45)', dark: 'rgba(245, 158, 11, 0.55)' },
    wash: { light: ['#FFFBEB', '#FFFFFF'], dark: ['rgba(245, 158, 11, 0.14)', 'rgba(17, 24, 39, 0)'] },
    borderClassName: 'border-amber-200 dark:border-amber-400/30',
    iconBgClassName: 'bg-amber-100 dark:bg-amber-500/15',
    textClassName: 'text-amber-700 dark:text-amber-300',
    chipClassName: 'border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10',
    barClassName: 'bg-amber-500 dark:bg-amber-400',
  },
  resolved: {
    icon: 'checkmark',
    iconColor: { light: '#059669', dark: '#34D399' },
    glowColor: { light: 'rgba(16, 185, 129, 0.4)', dark: 'rgba(16, 185, 129, 0.55)' },
    wash: { light: ['#ECFDF5', '#FFFFFF'], dark: ['rgba(16, 185, 129, 0.16)', 'rgba(17, 24, 39, 0)'] },
    borderClassName: 'border-emerald-200 dark:border-emerald-400/30',
    iconBgClassName: 'bg-emerald-100 dark:bg-emerald-500/15',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
    chipClassName: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10',
    barClassName: 'bg-emerald-500 dark:bg-emerald-400',
  },
};

const IMPACT_STYLES: Record<
  ImpactLevel,
  { dotClassName: string; chipClassName: string; textClassName: string }
> = {
  high: {
    dotClassName: 'bg-rose-500 dark:bg-rose-400',
    chipClassName: 'bg-rose-50 dark:bg-rose-500/15',
    textClassName: 'text-rose-700 dark:text-rose-300',
  },
  medium: {
    dotClassName: 'bg-amber-500 dark:bg-amber-400',
    chipClassName: 'bg-amber-50 dark:bg-amber-500/15',
    textClassName: 'text-amber-700 dark:text-amber-300',
  },
  low: {
    dotClassName: 'bg-slate-400 dark:bg-slate-500',
    chipClassName: 'bg-slate-100 dark:bg-white/10',
    textClassName: 'text-slate-600 dark:text-slate-300',
  },
};

const ICON_SIZE = 44;

type SelfHealingAlertCardProps = {
  alert: BottleneckAlert;
  /** Resolve once the Orchestrator Agent accepted the fix; throw to show an error. */
  onApproveFix: (alert: BottleneckAlert, fix: SuggestedFix) => Promise<void>;
  /** Shows the close and "Not now" controls when provided. */
  onDismiss?: (alert: BottleneckAlert) => void;
  /** Entrance delay, for staggering with other widgets. */
  enterDelay?: number;
};

export function SelfHealingAlertCard({
  alert,
  onApproveFix,
  onDismiss,
  enterDelay = 0,
}: SelfHealingAlertCardProps) {
  const { t, pick } = useI18n();
  const { isDark, palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const mode = isDark ? 'dark' : 'light';

  const defaultFix = alert.suggestedFixes.find((fix) => fix.recommended) ?? alert.suggestedFixes[0];
  const [selectedFixId, setSelectedFixId] = useState(defaultFix?.id);
  const [status, setStatus] = useState<ApprovalStatus>('idle');

  const selectedFix = alert.suggestedFixes.find((fix) => fix.id === selectedFixId);
  const isApproved = status === 'approved';
  const isApproving = status === 'approving';
  const isLive = !isApproved;
  const severityTone = TONES[alert.severity];
  const toneKey: ToneKey = isApproved ? 'resolved' : alert.severity;
  const tone = TONES[toneKey];

  const { current, target } = alert.metric;
  const gapPercent = target > 0 ? Math.round((1 - current / target) * 100) : 0;
  const lift = selectedFix?.expectedLift ?? 0;
  // Once approved, the metric rolls from today's rate to the Digital Twin forecast.
  const shownRate = isApproved ? Math.min(100, current + lift) : current;
  const metricTone = isApproved ? TONES.resolved : severityTone;

  // The green wash fades in over the severity wash instead of snapping.
  const resolvedWash = useSharedValue(0);
  useEffect(() => {
    resolvedWash.value = withTiming(isApproved ? 1 : 0, { duration: reduceMotion ? 0 : 600 });
  }, [isApproved, reduceMotion, resolvedWash]);
  const resolvedWashStyle = useAnimatedStyle(() => ({ opacity: resolvedWash.value }));

  const handleApprove = async () => {
    if (!selectedFix || isApproving) return;
    setStatus('approving');
    try {
      await onApproveFix(alert, selectedFix);
      setStatus('approved');
    } catch {
      setStatus('error');
    }
  };

  const dismiss = onDismiss ? () => onDismiss(alert) : undefined;

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(550)} style={styles.wrapper}>
      {/* Two glows cross-fade: severity while the alert is live, emerald once a fix is approved. */}
      <PulseGlow color={severityTone.glowColor[mode]} active={isLive} visible={isLive} fillColor={palette.card} />
      <PulseGlow
        color={TONES.resolved.glowColor[mode]}
        active={false}
        visible={isApproved}
        fillColor={palette.card}
      />

      <Animated.View
        layout={reduceMotion ? undefined : LinearTransition.duration(320)}
        className={`overflow-hidden rounded-3xl border bg-white dark:bg-gray-900 ${tone.borderClassName}`}
      >
        <LinearGradient colors={severityTone.wash[mode]} style={styles.wash} />
        <Animated.View style={[styles.wash, resolvedWashStyle]}>
          <LinearGradient colors={TONES.resolved.wash[mode]} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View className="flex-row items-start gap-3 px-5 pb-4 pt-5" accessibilityRole="alert">
          <View className="items-center justify-center" style={{ width: ICON_SIZE, height: ICON_SIZE }}>
            <PulseRing color={tone.iconColor[mode]} active={isLive} size={ICON_SIZE} />
            <View
              className={`items-center justify-center rounded-full ${tone.iconBgClassName}`}
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
            >
              {/* Keyed so the new icon pops in when the alert resolves. */}
              <Animated.View key={toneKey} entering={reduceMotion ? undefined : ZoomIn.springify()}>
                <Ionicons name={tone.icon} size={22} color={tone.iconColor[mode]} />
              </Animated.View>
            </View>
          </View>

          <View className="flex-1">
            <Text className={`text-xs font-semibold uppercase tracking-wider ${tone.textClassName}`}>
              {t.alert.selfHealing} · {t.alert.eyebrow[toneKey]}
            </Text>
            <Text className="mt-1 text-lg font-bold leading-6 text-slate-900 dark:text-white">
              {pick(alert.title)}
            </Text>
            <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.alert.detected(pick(alert.campaignName), formatRelativeTime(alert.detectedAt, t.time))}
            </Text>
          </View>

          {dismiss && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t.alert.close}
              onPress={dismiss}
              hitSlop={8}
              pressedScale={0.88}
              className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-100 dark:hover:bg-white/10 dark:active:bg-white/10"
            >
              <Ionicons name="close" size={18} color={palette.icon.muted} />
            </PressableScale>
          )}
        </View>

        <View className="mx-5 rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <View className="flex-row items-center justify-between gap-2">
            <SectionLabel>{isApproved ? t.alert.forecastLabel : pick(alert.metric.label)}</SectionLabel>
            <View className={`rounded-full border px-2 py-0.5 ${metricTone.chipClassName}`}>
              <Text className={`text-xs font-semibold ${metricTone.textClassName}`}>
                {isApproved ? t.alert.forecastChip(lift) : t.alert.belowTarget(gapPercent)}
              </Text>
            </View>
          </View>
          <View className="mt-2 flex-row items-baseline gap-1.5">
            <AnimatedNumber
              value={shownRate}
              format={(value) => `${value}%`}
              delay={enterDelay + 200}
              className="text-3xl font-bold text-slate-900 dark:text-white"
            />
            <Text className="text-sm text-slate-500 dark:text-slate-400">{t.alert.vsTarget(target)}</Text>
          </View>
          <View className="mt-3">
            <TargetProgressBar
              value={shownRate}
              target={target}
              barClassName={metricTone.barClassName}
              delay={enterDelay + 200}
            />
          </View>
        </View>

        <View className="px-5 pt-5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="shrink flex-row items-center gap-1.5">
              <Ionicons name="sparkles" size={14} color={palette.indigo} />
              <Text className="shrink text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                {t.alert.rootCause}
              </Text>
            </View>
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.alert.confidence(alert.rootCause.confidence)}
            </Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {pick(alert.rootCause.summary)}
          </Text>

          <View className="mt-3 gap-2">
            {alert.rootCause.factors.map((factor) => {
              const impact = IMPACT_STYLES[factor.impact];
              return (
                <View
                  key={factor.id}
                  className="flex-row gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5"
                >
                  <View className={`mt-1.5 h-2 w-2 rounded-full ${impact.dotClassName}`} />
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {pick(factor.label)}
                      </Text>
                      <View className={`rounded-full px-2 py-0.5 ${impact.chipClassName}`}>
                        <Text className={`text-[11px] font-semibold ${impact.textClassName}`}>
                          {t.alert.impact[factor.impact]}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">
                      {pick(factor.detail)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {isApproved && selectedFix ? (
          <Animated.View key="approved" entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)}>
            <View
              className="mx-5 mt-5 flex-row gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/25 dark:bg-emerald-500/10"
              style={{ boxShadow: palette.shadow.agentGlow }}
            >
              <Animated.View entering={reduceMotion ? undefined : ZoomIn.delay(150).springify()}>
                <Ionicons name="checkmark-circle" size={22} color={palette.emerald} />
              </Animated.View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {t.alert.approvedTitle(pick(selectedFix.actionLabel))}
                </Text>
                <Text className="mt-1 text-sm leading-5 text-emerald-800 dark:text-emerald-300/90">
                  {t.alert.approvedBody(selectedFix.expectedLift)}
                </Text>
              </View>
            </View>
            {dismiss ? (
              <Footer>
                <PressableScale
                  accessibilityRole="button"
                  onPress={dismiss}
                  className="h-11 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 active:bg-slate-800 dark:bg-white/10 dark:active:bg-white/15"
                >
                  <Text className="text-sm font-semibold text-white">{t.alert.done}</Text>
                </PressableScale>
              </Footer>
            ) : (
              <View className="h-5" />
            )}
          </Animated.View>
        ) : (
          <View key="pending">
            <View className="px-5 pt-5">
              <SectionLabel>{t.alert.suggestedFixes}</SectionLabel>
              <View accessibilityRole="radiogroup" className="mt-2 gap-2">
                {alert.suggestedFixes.map((fix) => (
                  <FixOption
                    key={fix.id}
                    fix={fix}
                    selected={fix.id === selectedFixId}
                    disabled={isApproving}
                    onSelect={() => setSelectedFixId(fix.id)}
                  />
                ))}
              </View>
              {status === 'error' && (
                <Animated.Text
                  entering={FadeIn.duration(200)}
                  className="mt-3 text-sm text-rose-600 dark:text-rose-300"
                >
                  {t.alert.error}
                </Animated.Text>
              )}
            </View>

            <Footer>
              {dismiss && (
                <PressableScale
                  accessibilityRole="button"
                  onPress={dismiss}
                  disabled={isApproving}
                  className="h-11 items-center justify-center rounded-xl px-4 hover:bg-slate-200/60 active:bg-slate-200/60 dark:hover:bg-white/10 dark:active:bg-white/10"
                >
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {t.alert.notNow}
                  </Text>
                </PressableScale>
              )}
              <PressableScale
                accessibilityRole="button"
                aria-busy={isApproving}
                onPress={handleApprove}
                disabled={!selectedFix || isApproving}
                className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 hover:bg-indigo-700 active:bg-indigo-700 disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                style={{ boxShadow: '0px 8px 20px -8px rgba(79, 70, 229, 0.65)' }}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
                {/* Wraps rather than truncates on narrow screens: the fix name is the point. */}
                <Animated.Text
                  key={isApproving ? 'approving' : 'idle'}
                  entering={reduceMotion ? undefined : FadeIn.duration(180)}
                  className="shrink text-center text-sm font-semibold text-white"
                  numberOfLines={2}
                >
                  {isApproving
                    ? t.alert.applying
                    : selectedFix
                      ? t.alert.approve(pick(selectedFix.actionLabel))
                      : t.alert.approveFallback}
                </Animated.Text>
              </PressableScale>
            </Footer>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function FixOption({
  fix,
  selected,
  disabled,
  onSelect,
}: {
  fix: SuggestedFix;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      disabled={disabled}
      onPress={onSelect}
      className={`flex-row gap-3 rounded-2xl border p-3.5 disabled:opacity-60 ${
        selected
          ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-400/50 dark:bg-indigo-500/10'
          : 'border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-indigo-600 dark:border-indigo-400' : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {selected && (
          <Animated.View
            entering={ZoomIn.duration(180)}
            className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
          />
        )}
      </View>
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {pick(fix.actionLabel)}
          </Text>
          {fix.recommended && (
            <View className="rounded-full bg-indigo-600 px-2 py-0.5 dark:bg-indigo-500">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                {t.alert.recommended}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">
          {pick(fix.description)}
        </Text>
        <View className="mt-1.5 flex-row flex-wrap items-center gap-1">
          <Ionicons name="trending-up" size={14} color={palette.emerald} />
          <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {t.alert.expectedImpact(fix.expectedLift)}
          </Text>
          <Text className="text-xs text-slate-400 dark:text-slate-500">· {t.alert.forecastSource}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <View className="mt-5 flex-row items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-white/10 dark:bg-black/20">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
});
