import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CandidateCardSwap } from '../components/CandidateCardSwap';
import { ActiveCampaignsPanel } from '../components/dashboard/ActiveCampaignsPanel';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { MobileDrawer } from '../components/layout/MobileDrawer';
import { getNavLabel, Sidebar, type NavKey } from '../components/layout/Sidebar';
import { SelfHealingAlertCard } from '../components/SelfHealingAlert';
import { Panel, PanelLink } from '../components/ui/Panel';
import { fetchMatchedCandidates, type Candidate } from '../services/candidates';
import { fetchDashboardSummary, type DashboardSummary } from '../services/dashboard';
import {
  approveSuggestedFix,
  fetchActiveBottleneckAlerts,
  type BottleneckAlert,
  type SuggestedFix,
} from '../services/selfHealing';
import { formatLongDate } from '../utils/formatters';

/** At this width and above the sidebar is always visible; below it lives in a drawer. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;
const SIDEBAR_WIDTH = 264;
const FEATURED_CAMPAIGN_ID = 'senior-frontend-engineer';
// Placeholder until Supabase Auth provides the signed-in user.
const CURRENT_USER = { name: 'Jordan Lee', title: 'Head of Talent' };

export function DashboardScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      user={CURRENT_USER}
      badges={{
        candidates: { count: summary?.candidatesInPipeline ?? 0 },
        'self-healing': { count: alerts.length, tone: 'alert' },
      }}
    />
  );

  const isDashboard = activeNav === 'dashboard';
  const today = formatLongDate(new Date());

  return (
    <View className="flex-1 flex-row bg-slate-50">
      <LinearGradient
        colors={['#EEF2FF', '#F8FAFC', '#F5F3FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

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
            title={isDashboard ? 'Recruitment overview' : getNavLabel(activeNav)}
            subtitle={summary ? `${today} · ${summary.activeCampaigns} active campaigns` : today}
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
            <SectionPlaceholder label={getNavLabel(activeNav)} />
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
  if (!summary) {
    return <ActivityIndicator className="mt-24" color="#4F46E5" />;
  }

  const featuredCampaign = summary.campaigns.find((campaign) => campaign.id === FEATURED_CAMPAIGN_ID);

  return (
    <>
      <View className="mt-6">
        <SummaryStats stats={buildSummaryStats(summary)} />
      </View>

      {/* One column until there is room for two; the card stack takes the wider one. */}
      <View className="mt-6 gap-6 xl:flex-row xl:items-start">
        <Panel
          className="xl:flex-[7]"
          title="Matched candidates"
          subtitle={`${featuredCampaign?.title ?? 'Featured campaign'} · ranked by the Matching Agent`}
          action={<PanelLink label="Open board" onPress={() => onNavigate('candidates')} />}
        >
          <View className="pb-1 pt-6">
            {candidates ? (
              <CandidateCardSwap candidates={candidates} />
            ) : (
              <ActivityIndicator className="my-24" color="#4F46E5" />
            )}
          </View>
        </Panel>

        <View className="gap-6 xl:flex-[5]">
          {alert && (
            <SelfHealingAlertCard
              key={alert.id}
              alert={alert}
              onApproveFix={onApproveFix}
              onDismiss={onDismissAlert}
            />
          )}
          <ActiveCampaignsPanel
            campaigns={summary.campaigns}
            onViewAll={() => onNavigate('campaigns')}
          />
        </View>
      </View>
    </>
  );
}

function SectionPlaceholder({ label }: { label: string }) {
  return (
    <Panel className="mt-6" title={label} subtitle="This workspace is next on the roadmap.">
      <View className="items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16">
        <Ionicons name="construct-outline" size={28} color="#94A3B8" />
        <Text className="mt-3 text-center text-sm text-slate-500">
          Not built yet. Head back to the Dashboard for the live overview.
        </Text>
      </View>
    </Panel>
  );
}

function buildSummaryStats(summary: DashboardSummary): SummaryStat[] {
  const matchGap = summary.averageMatchRate - summary.targetMatchRate;
  const hireChange = summary.timeToHireChangeDays;
  return [
    {
      key: 'campaigns',
      label: 'Active campaigns',
      value: String(summary.activeCampaigns),
      icon: 'megaphone-outline',
      accent: 'indigo',
      delta:
        summary.campaignsAtRisk > 0
          ? { text: `${summary.campaignsAtRisk} need attention`, tone: 'negative', icon: 'alert-circle-outline' }
          : { text: 'All on track', tone: 'positive', icon: 'checkmark-circle-outline' },
    },
    {
      key: 'pipeline',
      label: 'Candidates in pipeline',
      value: String(summary.candidatesInPipeline),
      icon: 'people-outline',
      accent: 'violet',
      delta: { text: `+${summary.newCandidatesThisWeek} this week`, tone: 'positive' },
    },
    {
      key: 'match-rate',
      label: 'Avg. match rate',
      value: `${summary.averageMatchRate}%`,
      icon: 'analytics-outline',
      accent: 'emerald',
      delta: {
        text: `${matchGap >= 0 ? '+' : ''}${matchGap} pts vs target`,
        tone: matchGap >= 0 ? 'positive' : 'negative',
      },
    },
    {
      key: 'time-to-hire',
      label: 'Avg. time to hire',
      value: `${summary.averageTimeToHireDays} days`,
      icon: 'time-outline',
      accent: 'amber',
      delta: {
        text: `${Math.abs(hireChange)} days ${hireChange <= 0 ? 'faster' : 'slower'} than last month`,
        tone: hireChange <= 0 ? 'positive' : 'negative',
        icon: hireChange <= 0 ? 'trending-down' : 'trending-up',
      },
    },
  ];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
