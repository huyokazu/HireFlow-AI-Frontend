import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import type {
  AlertSeverity,
  BottleneckAlert,
  ImpactLevel,
  SuggestedFix,
} from '../../services/selfHealing';
import { formatRelativeTime } from '../../utils/formatters';
import { SectionLabel } from '../ui/SectionLabel';
import { TargetProgressBar } from '../ui/TargetProgressBar';
import { PulseGlow, PulseRing } from '../ui/pulse';

type ApprovalStatus = 'idle' | 'approving' | 'approved' | 'error';

type Tone = {
  eyebrow: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  glowColor: string;
  wash: readonly [string, string];
  borderClassName: string;
  iconBgClassName: string;
  textClassName: string;
  chipClassName: string;
  barClassName: string;
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const TONES: Record<AlertSeverity | 'resolved', Tone> = {
  critical: {
    eyebrow: 'Bottleneck detected',
    icon: 'alert',
    iconColor: '#E11D48',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    wash: ['#FFF1F2', '#FFFFFF'],
    borderClassName: 'border-rose-200',
    iconBgClassName: 'bg-rose-100',
    textClassName: 'text-rose-600',
    chipClassName: 'border-rose-200 bg-rose-50',
    barClassName: 'bg-rose-500',
  },
  warning: {
    eyebrow: 'Bottleneck risk',
    icon: 'warning',
    iconColor: '#D97706',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    wash: ['#FFFBEB', '#FFFFFF'],
    borderClassName: 'border-amber-200',
    iconBgClassName: 'bg-amber-100',
    textClassName: 'text-amber-700',
    chipClassName: 'border-amber-200 bg-amber-50',
    barClassName: 'bg-amber-500',
  },
  resolved: {
    eyebrow: 'Fix in progress',
    icon: 'checkmark',
    iconColor: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    wash: ['#ECFDF5', '#FFFFFF'],
    borderClassName: 'border-emerald-200',
    iconBgClassName: 'bg-emerald-100',
    textClassName: 'text-emerald-700',
    chipClassName: 'border-emerald-200 bg-emerald-50',
    barClassName: 'bg-emerald-500',
  },
};

const IMPACT_STYLES: Record<
  ImpactLevel,
  { label: string; dotClassName: string; chipClassName: string; textClassName: string }
> = {
  high: {
    label: 'High impact',
    dotClassName: 'bg-rose-500',
    chipClassName: 'bg-rose-50',
    textClassName: 'text-rose-700',
  },
  medium: {
    label: 'Medium impact',
    dotClassName: 'bg-amber-500',
    chipClassName: 'bg-amber-50',
    textClassName: 'text-amber-700',
  },
  low: {
    label: 'Low impact',
    dotClassName: 'bg-slate-400',
    chipClassName: 'bg-slate-100',
    textClassName: 'text-slate-600',
  },
};

const ICON_SIZE = 44;

type SelfHealingAlertCardProps = {
  alert: BottleneckAlert;
  /** Resolve once the Orchestrator Agent accepted the fix; throw to show an error. */
  onApproveFix: (alert: BottleneckAlert, fix: SuggestedFix) => Promise<void>;
  /** Shows the close and "Not now" controls when provided. */
  onDismiss?: (alert: BottleneckAlert) => void;
};

export function SelfHealingAlertCard({ alert, onApproveFix, onDismiss }: SelfHealingAlertCardProps) {
  const defaultFix = alert.suggestedFixes.find((fix) => fix.recommended) ?? alert.suggestedFixes[0];
  const [selectedFixId, setSelectedFixId] = useState(defaultFix?.id);
  const [status, setStatus] = useState<ApprovalStatus>('idle');

  const selectedFix = alert.suggestedFixes.find((fix) => fix.id === selectedFixId);
  const severityTone = TONES[alert.severity];
  const tone = status === 'approved' ? TONES.resolved : severityTone;
  const isLive = status !== 'approved';
  const isApproving = status === 'approving';
  const { current, target } = alert.metric;
  const gapPercent = target > 0 ? Math.round((1 - current / target) * 100) : 0;

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
    <Animated.View entering={FadeInDown.duration(450)} style={styles.wrapper}>
      <PulseGlow color={tone.glowColor} active={isLive} />

      <View className={`overflow-hidden rounded-3xl border bg-white ${tone.borderClassName}`}>
        <LinearGradient colors={tone.wash} style={styles.wash} />

        <View className="flex-row items-start gap-3 px-5 pb-4 pt-5" accessibilityRole="alert">
          <View className="items-center justify-center" style={{ width: ICON_SIZE, height: ICON_SIZE }}>
            <PulseRing color={tone.iconColor} active={isLive} size={ICON_SIZE} />
            <View
              className={`items-center justify-center rounded-full ${tone.iconBgClassName}`}
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
            >
              <Ionicons name={tone.icon} size={22} color={tone.iconColor} />
            </View>
          </View>

          <View className="flex-1">
            <Text className={`text-xs font-semibold uppercase tracking-wider ${tone.textClassName}`}>
              Self-healing · {tone.eyebrow}
            </Text>
            <Text className="mt-1 text-lg font-bold leading-6 text-slate-900">{alert.title}</Text>
            <Text className="mt-1 text-sm text-slate-500">
              {alert.campaignName} · Detected {formatRelativeTime(alert.detectedAt)}
            </Text>
          </View>

          {dismiss && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close alert"
              onPress={dismiss}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full active:bg-slate-100"
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </Pressable>
          )}
        </View>

        <View className="mx-5 rounded-2xl border border-slate-200/70 bg-white/80 p-4">
          <View className="flex-row items-center justify-between gap-2">
            <SectionLabel>{alert.metric.label}</SectionLabel>
            <View className={`rounded-full border px-2 py-0.5 ${severityTone.chipClassName}`}>
              <Text className={`text-xs font-semibold ${severityTone.textClassName}`}>
                {gapPercent}% below target
              </Text>
            </View>
          </View>
          <View className="mt-2 flex-row items-baseline gap-1.5">
            <Text className="text-3xl font-bold text-slate-900">{current}%</Text>
            <Text className="text-sm text-slate-500">vs {target}% target</Text>
          </View>
          <View className="mt-3">
            <TargetProgressBar value={current} target={target} barClassName={severityTone.barClassName} />
          </View>
        </View>

        <View className="px-5 pt-5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="sparkles" size={14} color="#6366F1" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                AI root cause analysis
              </Text>
            </View>
            <Text className="text-xs font-medium text-slate-500">
              {alert.rootCause.confidence}% confidence
            </Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-slate-600">{alert.rootCause.summary}</Text>

          <View className="mt-3 gap-2">
            {alert.rootCause.factors.map((factor) => {
              const impact = IMPACT_STYLES[factor.impact];
              return (
                <View
                  key={factor.id}
                  className="flex-row gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <View className={`mt-1.5 h-2 w-2 rounded-full ${impact.dotClassName}`} />
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <Text className="text-sm font-semibold text-slate-800">{factor.label}</Text>
                      <View className={`rounded-full px-2 py-0.5 ${impact.chipClassName}`}>
                        <Text className={`text-[11px] font-semibold ${impact.textClassName}`}>
                          {impact.label}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-0.5 text-sm leading-5 text-slate-500">{factor.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {status === 'approved' && selectedFix ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <View className="mx-5 mt-5 flex-row gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <Ionicons name="checkmark-circle" size={22} color="#059669" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-emerald-900">
                  Fix approved: {selectedFix.actionLabel}
                </Text>
                <Text className="mt-1 text-sm leading-5 text-emerald-800">
                  The Orchestrator Agent is applying the change and will re-run matching. Forecast:{' '}
                  {selectedFix.expectedImpact}.
                </Text>
              </View>
            </View>
            {dismiss ? (
              <Footer>
                <Pressable
                  accessibilityRole="button"
                  onPress={dismiss}
                  className="h-11 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 active:bg-slate-800"
                >
                  <Text className="text-sm font-semibold text-white">Done</Text>
                </Pressable>
              </Footer>
            ) : (
              <View className="h-5" />
            )}
          </Animated.View>
        ) : (
          <>
            <View className="px-5 pt-5">
              <SectionLabel>Suggested fixes</SectionLabel>
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
                <Text className="mt-3 text-sm text-rose-600">
                  Couldn't apply the fix. Please try again.
                </Text>
              )}
            </View>

            <Footer>
              {dismiss && (
                <Pressable
                  accessibilityRole="button"
                  onPress={dismiss}
                  disabled={isApproving}
                  className="h-11 items-center justify-center rounded-xl px-4 active:bg-slate-200/60"
                >
                  <Text className="text-sm font-semibold text-slate-600">Not now</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: isApproving, disabled: !selectedFix || isApproving }}
                onPress={handleApprove}
                disabled={!selectedFix || isApproving}
                className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 active:bg-indigo-700 disabled:opacity-70"
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
                {/* Wraps rather than truncates on narrow screens: the fix name is the point. */}
                <Text className="shrink text-center text-sm font-semibold text-white" numberOfLines={2}>
                  {isApproving ? 'Applying fix…' : `Approve: ${selectedFix?.actionLabel ?? 'fix'}`}
                </Text>
              </Pressable>
            </Footer>
          </>
        )}
      </View>
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
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      className={`flex-row gap-3 rounded-2xl border p-3.5 ${
        selected ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white active:bg-slate-50'
      }`}
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-indigo-600' : 'border-slate-300'
        }`}
      >
        {selected && <View className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
      </View>
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-slate-900">{fix.actionLabel}</Text>
          {fix.recommended && (
            <View className="rounded-full bg-indigo-600 px-2 py-0.5">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                Recommended
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 text-sm leading-5 text-slate-500">{fix.description}</Text>
        <View className="mt-1.5 flex-row items-center gap-1">
          <Ionicons name="trending-up" size={14} color="#059669" />
          <Text className="text-xs font-semibold text-emerald-700">{fix.expectedImpact}</Text>
          <Text className="text-xs text-slate-400">· Digital Twin forecast</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <View className="mt-5 flex-row items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
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
