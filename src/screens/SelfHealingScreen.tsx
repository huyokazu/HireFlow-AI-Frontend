import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { SelfHealingAlertCard } from '../components/SelfHealingAlert';
import { CampaignMonitorPanel, type MonitorStatus } from '../components/selfHealing/CampaignMonitorPanel';
import { DiagnosePanel } from '../components/selfHealing/DiagnosePanel';
import { HealingLogPanel } from '../components/selfHealing/HealingLogPanel';
import { Button } from '../components/ui/Button';
import { STAGGER_MS } from '../components/ui/motion';
import { useI18n, type Dictionary } from '../i18n';
import { PREVIOUS_RESOLUTION_HOURS, type BottleneckAlert, type HealingRecord } from '../services/selfHealing';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

// Entrance order: header, stats (staggered), then the alerts and the side panels.
const STATS_DELAY = 80;
const ALERTS_DELAY = 360;
const ALERT_STAGGER_MS = STAGGER_MS;
const SIDE_DELAYS = { monitor: 440, log: 520 };

/**
 * Self-Healing Recruitment: every bottleneck the Orchestrator found, with its root cause and the
 * fixes to approve; each campaign's live status; and the log of fixes already applied.
 */
export function SelfHealingScreen() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const {
    summary,
    alerts,
    openAlerts,
    approvals,
    healingLog,
    approveFix,
    diagnoseCampaign,
    dismissAlert,
    reopenAlert,
    pausedAgents,
    setPausedAgents,
  } = useWorkspace();
  const campaigns = useMemo(() => summary?.campaigns ?? [], [summary]);

  // Open alerts win over fixes in progress: they're the ones that need a decision.
  const statuses = useMemo(() => {
    const map: Partial<Record<string, MonitorStatus>> = {};
    for (const record of healingLog) {
      if (record.outcome === 'in_progress') map[record.campaignId] = 'fixing';
    }
    for (const alert of openAlerts) map[alert.campaignId] = alert.severity;
    return map;
  }, [healingLog, openAlerts]);

  // What the Optimization Agent can look at: behind target, with nothing flagged or being fixed.
  const diagnosable = useMemo(
    () =>
      campaigns
        .filter(
          (campaign) =>
            campaign.matchRate < campaign.targetMatchRate &&
            !statuses[campaign.id] &&
            !alerts.some((alert) => alert.campaignId === campaign.id),
        )
        .map((campaign) => campaign.id),
    [campaigns, statuses, alerts],
  );

  return (
    <ScreenContainer>
      <AppHeader
        title={t.selfHealingPage.title}
        subtitle={summary ? t.selfHealingPage.subtitle(campaigns.length, openAlerts.length) : ''}
      />
      {!summary ? (
        <ActivityIndicator className="mt-24" color={palette.indigo} />
      ) : (
        <>
          {/* Paused on the AI Agents page: nothing new gets flagged until it runs again. */}
          {pausedAgents.selfHealing && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              exiting={FadeOut.duration(200)}
              className="mt-6 flex-row flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-400/25 dark:bg-amber-500/10"
            >
              <Ionicons name="pause-circle" size={18} color={palette.amber} />
              <Text className="min-w-[200px] flex-1 text-sm text-amber-900 dark:text-amber-100">
                {t.selfHealingPage.monitorPaused}
              </Text>
              <Button
                variant="secondary"
                icon="play"
                label={t.selfHealingPage.resumeMonitor}
                onPress={() => setPausedAgents({ ...pausedAgents, selfHealing: false })}
              />
            </Animated.View>
          )}
          <View className="mt-6">
            <SummaryStats stats={buildStats(openAlerts, healingLog, t)} enterDelay={STATS_DELAY} />
          </View>

          <View className="mt-6 gap-6 xl:flex-row xl:items-start">
            <View className="gap-4 xl:flex-[7]">
              <Animated.View entering={FadeInDown.delay(ALERTS_DELAY - 60).duration(450)} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {t.selfHealingPage.openAlerts}
                  </Text>
                  {openAlerts.length > 0 && (
                    <Animated.View
                      key={openAlerts.length}
                      entering={FadeIn.duration(200)}
                      className="min-w-6 items-center rounded-full bg-rose-500 px-2 py-0.5"
                    >
                      <Text className="text-xs font-bold text-white">{openAlerts.length}</Text>
                    </Animated.View>
                  )}
                </View>
                <Text className="text-sm text-slate-500 dark:text-slate-400">{t.selfHealingPage.openAlertsHint}</Text>
              </Animated.View>

              {!pausedAgents.selfHealing && (
                <Animated.View entering={FadeInDown.delay(ALERTS_DELAY - 30).duration(450)}>
                  <DiagnosePanel campaignIds={diagnosable} onDiagnose={diagnoseCampaign} />
                </Animated.View>
              )}

              {alerts.length === 0 ? (
                <AllClear campaigns={campaigns.length} />
              ) : (
                alerts.map((alert, index) => (
                  <Animated.View
                    key={alert.id}
                    exiting={FadeOut.duration(250)}
                    layout={LinearTransition.duration(300)}
                    // Earlier cards stack above later ones, so a card's glow isn't clipped by the next.
                    style={{ zIndex: alerts.length - index }}
                  >
                    <SelfHealingAlertCard
                      alert={alert}
                      approvedFixId={approvals[alert.id]?.fixId}
                      onApproveFix={approveFix}
                      onDismiss={dismissAlert}
                      enterDelay={ALERTS_DELAY + index * ALERT_STAGGER_MS}
                    />
                  </Animated.View>
                ))
              )}
            </View>

            <View className="gap-6 xl:flex-[5]">
              <Animated.View entering={FadeInDown.delay(SIDE_DELAYS.monitor).duration(550)}>
                <CampaignMonitorPanel
                  campaigns={campaigns}
                  statuses={statuses}
                  onOpenBoard={(campaignId) =>
                    router.navigate({ pathname: '/candidates', params: { campaign: campaignId } })
                  }
                  onSimulate={(campaignId) =>
                    router.navigate({ pathname: '/digital-twin', params: { campaign: campaignId } })
                  }
                />
              </Animated.View>
              <Animated.View
                entering={FadeInDown.delay(SIDE_DELAYS.log).duration(550)}
                layout={LinearTransition.duration(300)}
              >
                <HealingLogPanel records={healingLog} onReopen={reopenAlert} />
              </Animated.View>
            </View>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

function AllClear({ campaigns }: { campaigns: number }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      className="items-center rounded-3xl border border-emerald-200 bg-emerald-50/70 px-6 py-12 dark:border-emerald-400/20 dark:bg-emerald-500/10"
      style={{ boxShadow: palette.shadow.agentGlow }}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
        <Ionicons name="shield-checkmark" size={24} color={palette.emerald} />
      </View>
      <Text className="mt-3 text-base font-semibold text-emerald-900 dark:text-emerald-100">
        {t.selfHealingPage.allClearTitle}
      </Text>
      <Text className="mt-1 max-w-[420px] text-center text-sm text-emerald-800 dark:text-emerald-200/80">
        {t.selfHealingPage.allClearBody(campaigns)}
      </Text>
    </Animated.View>
  );
}

function buildStats(openAlerts: BottleneckAlert[], log: HealingRecord[], t: Dictionary): SummaryStat[] {
  const copy = t.selfHealingPage.stats;
  const critical = openAlerts.filter((alert) => alert.severity === 'critical').length;
  const applied = log.filter((record) => record.outcome !== 'dismissed');
  const inProgress = applied.filter((record) => record.outcome === 'in_progress').length;
  const resolved = log.filter((record) => record.outcome === 'resolved');
  const averageHours = average(resolved.map((record) => record.resolutionHours ?? 0));
  const hoursChange = averageHours - PREVIOUS_RESOLUTION_HOURS;
  const averageLift = average(resolved.map((record) => (record.result ? record.result.after - record.result.before : 0)));

  return [
    {
      key: 'open',
      label: copy.openAlerts,
      value: openAlerts.length,
      format: String,
      icon: 'pulse-outline',
      accent: 'amber',
      delta:
        critical > 0
          ? { text: copy.critical(critical), tone: 'negative', icon: 'alert-circle-outline' }
          : openAlerts.length > 0
            ? { text: copy.noCritical, tone: 'neutral' }
            : { text: copy.allClear, tone: 'positive', icon: 'checkmark-circle-outline' },
    },
    {
      key: 'applied',
      label: copy.fixesApplied,
      value: applied.length,
      format: String,
      icon: 'construct-outline',
      accent: 'indigo',
      delta:
        inProgress > 0
          ? { text: copy.inProgress(inProgress), tone: 'neutral', icon: 'sync-outline' }
          : { text: copy.allVerified, tone: 'positive', icon: 'checkmark-done-outline' },
    },
    {
      key: 'resolution',
      label: copy.resolutionTime,
      value: averageHours,
      format: copy.hours,
      icon: 'time-outline',
      accent: 'violet',
      delta:
        hoursChange <= 0
          ? { text: copy.fasterThanLastMonth(-hoursChange), tone: 'positive', icon: 'trending-down' }
          : { text: copy.slowerThanLastMonth(hoursChange), tone: 'negative', icon: 'trending-up' },
    },
    {
      key: 'lift',
      label: copy.averageLift,
      value: averageLift,
      format: copy.points,
      icon: 'trending-up-outline',
      accent: 'emerald',
      delta: { text: copy.backOnTarget(resolved.length), tone: 'positive', icon: 'checkmark-circle-outline' },
    },
  ];
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
