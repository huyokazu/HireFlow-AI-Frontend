import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CandidateCardSwap } from '../components/CandidateCardSwap';
import { ActiveCampaignsPanel } from '../components/dashboard/ActiveCampaignsPanel';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { MobileDrawer } from '../components/layout/MobileDrawer';
import { getNavLabel, Sidebar, type NavKey } from '../components/layout/Sidebar';
import { ThemedBackdrop } from '../components/layout/ThemedBackdrop';
import { SelfHealingAlertCard } from '../components/SelfHealingAlert';
import { Panel, PanelLink } from '../components/ui/Panel';
import { useI18n, type Dictionary, type Localized } from '../i18n';
import { fetchMatchedCandidates, type Candidate } from '../services/candidates';
import { fetchDashboardSummary, type DashboardSummary } from '../services/dashboard';
import {
  approveSuggestedFix,
  fetchActiveBottleneckAlerts,
  type BottleneckAlert,
  type SuggestedFix,
} from '../services/selfHealing';
import { useAppTheme } from '../theme';

/** At this width and above the sidebar is always visible; below it lives in a drawer. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;
const SIDEBAR_WIDTH = 264;
const FEATURED_CAMPAIGN_ID = 'senior-frontend-engineer';
// Placeholder until Supabase Auth provides the signed-in user.
const CURRENT_USER: { name: string; title: Localized } = {
  name: 'Jordan Lee',
  title: { en: 'Head of Talent', vi: 'Trưởng bộ phận Tuyển dụng' },
};
// Entrance order: header, stats (staggered), then the three panels.
const STATS_DELAY = 80;
const PANEL_DELAYS = { candidates: 360, alert: 440, campaigns: 520 };

export function DashboardScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, pick } = useI18n();
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;

  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [alerts, setAlerts] = useState<BottleneckAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardSummary().then((result) => {
      if (!cancelled) setSummary(result);
    });
    fetchMatchedCandidates(FEATURED_CAMPAIGN_ID).then((result) => {
      if (!cancelled) setCandidates(result);
    });
    fetchActiveBottleneckAlerts(FEATURED_CAMPAIGN_ID).then((result) => {
      if (!cancelled) setAlerts(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = useCallback((key: NavKey) => {
    setActiveNav(key);
    setDrawerOpen(false);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const dismissAlert = useCallback((alert: BottleneckAlert) => {
    setAlerts((current) => current.filter((item) => item.id !== alert.id));
  }, []);

  const sidebar = (
    <Sidebar
      activeKey={activeNav}
      onNavigate={navigate}
      agentsOnline={summary?.agentsOnline ?? 0}
      user={{ name: CURRENT_USER.name, title: pick(CURRENT_USER.title) }}
      badges={{
        candidates: { count: summary?.candidatesInPipeline ?? 0 },
        'self-healing': { count: alerts.length, tone: 'alert' },
      }}
    />
  );

  const isDashboard = activeNav === 'dashboard';
  const today = t.date.long(new Date());

  return (
    <View className="flex-1 flex-row bg-slate-50 dark:bg-obsidian">
      <ThemedBackdrop />

      {isWide && <View style={{ width: SIDEBAR_WIDTH }}>{sidebar}</View>}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: isWide ? 32 : 16,
        }}
      >
        <View className="w-full max-w-[1280px] self-center">
          <DashboardHeader
            title={isDashboard ? t.dashboard.title : getNavLabel(activeNav, t)}
            subtitle={summary ? t.dashboard.subtitle(today, summary.activeCampaigns) : today}
            notificationCount={alerts.length}
            onOpenMenu={isWide ? undefined : () => setDrawerOpen(true)}
            onCreateCampaign={() => navigate('campaigns')}
          />

          {isDashboard ? (
            <DashboardOverview
              summary={summary}
              candidates={candidates}
              alert={alerts[0] ?? null}
              onApproveFix={(alert, fix) => approveSuggestedFix(alert.id, fix.id)}
              onDismissAlert={dismissAlert}
              onNavigate={navigate}
            />
          ) : (
            <SectionPlaceholder label={getNavLabel(activeNav, t)} />
          )}
        </View>
      </ScrollView>

      {!isWide && (
        <MobileDrawer open={drawerOpen} onClose={closeDrawer}>
          {sidebar}
        </MobileDrawer>
      )}
    </View>
  );
}

type DashboardOverviewProps = {
  summary: DashboardSummary | null;
  candidates: Candidate[] | null;
  alert: BottleneckAlert | null;
  onApproveFix: (alert: BottleneckAlert, fix: SuggestedFix) => Promise<void>;
  onDismissAlert: (alert: BottleneckAlert) => void;
  onNavigate: (key: NavKey) => void;
};

function DashboardOverview({
  summary,
  candidates,
  alert,
  onApproveFix,
  onDismissAlert,
  onNavigate,
}: DashboardOverviewProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();

  if (!summary) {
    return <ActivityIndicator className="mt-24" color={palette.indigo} />;
  }

  const featuredCampaign = summary.campaigns.find((campaign) => campaign.id === FEATURED_CAMPAIGN_ID);

  return (
    <>
      <View className="mt-6">
        <SummaryStats stats={buildSummaryStats(summary, t)} enterDelay={STATS_DELAY} />
      </View>

      {/* One column until there is room for two; the card deck takes the wider one. */}
      <View className="mt-6 gap-6 xl:flex-row xl:items-start">
        <Animated.View
          entering={FadeInDown.delay(PANEL_DELAYS.candidates).duration(550)}
          className="xl:flex-[7]"
          // Above the right-hand column, so a card flung to the right flies over it.
          style={{ zIndex: 2 }}
        >
          <Panel
            title={t.dashboard.matchedCandidates}
            subtitle={t.dashboard.matchedSubtitle(
              featuredCampaign ? pick(featuredCampaign.title) : t.dashboard.featuredCampaign,
            )}
            action={<PanelLink label={t.dashboard.openBoard} onPress={() => onNavigate('candidates')} />}
          >
            <View className="pb-1 pt-4">
              {candidates ? (
                <CandidateCardSwap candidates={candidates} />
              ) : (
                <ActivityIndicator className="my-24" color={palette.indigo} />
              )}
            </View>
          </Panel>
        </Animated.View>

        <View className="gap-6 xl:flex-[5]">
          {alert && (
            <Animated.View exiting={FadeOut.duration(250)}>
              <SelfHealingAlertCard
                key={alert.id}
                alert={alert}
                onApproveFix={onApproveFix}
                onDismiss={onDismissAlert}
                enterDelay={PANEL_DELAYS.alert}
              />
            </Animated.View>
          )}
          <Animated.View
            entering={FadeInDown.delay(PANEL_DELAYS.campaigns).duration(550)}
            layout={LinearTransition.duration(300)}
          >
            <ActiveCampaignsPanel
              campaigns={summary.campaigns}
              onViewAll={() => onNavigate('campaigns')}
              enterDelay={PANEL_DELAYS.campaigns}
            />
          </Animated.View>
        </View>
      </View>
    </>
  );
}

function SectionPlaceholder({ label }: { label: string }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <Animated.View entering={FadeInDown.duration(400)} className="mt-6">
      <Panel title={label} subtitle={t.dashboard.placeholderSubtitle}>
        <View className="items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 dark:border-white/15">
          <Ionicons name="construct-outline" size={28} color={palette.icon.faint} />
          <Text className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.dashboard.placeholderBody}
          </Text>
        </View>
      </Panel>
    </Animated.View>
  );
}

function buildSummaryStats(summary: DashboardSummary, t: Dictionary): SummaryStat[] {
  const matchGap = summary.averageMatchRate - summary.targetMatchRate;
  const hireChange = summary.timeToHireChangeDays;
  return [
    {
      key: 'campaigns',
      label: t.stats.activeCampaigns,
      value: summary.activeCampaigns,
      format: String,
      icon: 'megaphone-outline',
      accent: 'indigo',
      delta:
        summary.campaignsAtRisk > 0
          ? { text: t.stats.needAttention(summary.campaignsAtRisk), tone: 'negative', icon: 'alert-circle-outline' }
          : { text: t.stats.allOnTrack, tone: 'positive', icon: 'checkmark-circle-outline' },
    },
    {
      key: 'pipeline',
      label: t.stats.pipeline,
      value: summary.candidatesInPipeline,
      format: String,
      icon: 'people-outline',
      accent: 'violet',
      delta: { text: t.stats.newThisWeek(summary.newCandidatesThisWeek), tone: 'positive' },
    },
    {
      key: 'match-rate',
      label: t.stats.matchRate,
      value: summary.averageMatchRate,
      format: (value) => `${value}%`,
      icon: 'analytics-outline',
      accent: 'emerald',
      delta: { text: t.stats.vsTarget(matchGap), tone: matchGap >= 0 ? 'positive' : 'negative' },
    },
    {
      key: 'time-to-hire',
      label: t.stats.timeToHire,
      value: summary.averageTimeToHireDays,
      format: t.stats.days,
      icon: 'time-outline',
      accent: 'amber',
      delta: {
        text:
          hireChange <= 0
            ? t.stats.fasterThanLastMonth(Math.abs(hireChange))
            : t.stats.slowerThanLastMonth(hireChange),
        tone: hireChange <= 0 ? 'positive' : 'negative',
        icon: hireChange <= 0 ? 'trending-down' : 'trending-up',
      },
    },
  ];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
