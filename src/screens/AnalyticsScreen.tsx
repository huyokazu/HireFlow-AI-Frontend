import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AgentImpactPanel } from '../components/analytics/AgentImpactPanel';
import { CampaignScopeFilter } from '../components/analytics/CampaignScopeFilter';
import { CampaignTargetsPanel } from '../components/analytics/CampaignTargetsPanel';
import { ChannelPanel } from '../components/analytics/ChannelPanel';
import { FunnelPanel } from '../components/analytics/FunnelPanel';
import { HiringTrendPanel } from '../components/analytics/HiringTrendPanel';
import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { useI18n, type Dictionary } from '../i18n';
import { hoursSavedThisWeek, recruiterDays, type AgentStatsByKey } from '../services/agents';
import {
  buildFunnel,
  fetchHiringAnalytics,
  totalsByChannel,
  withBoardHires,
  type HiringAnalytics,
  type HiringMonth,
} from '../services/analytics';
import type { CampaignDraft } from '../services/campaigns';
import type { DashboardSummary } from '../services/dashboard';
import type { PipelineCandidate } from '../services/pipeline';
import { useWorkspace, type AgentBaseline } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

// Entrance order: header, stats (staggered), then the panels, left column first at each level.
const STATS_DELAY = 80;
const TREND_DELAY = 360;
const TARGETS_DELAY = 420;
const SCOPE_DELAY = 480;
const FUNNEL_DELAY = 520;
const AGENTS_DELAY = 560;
const CHANNELS_DELAY = 600;

/**
 * Analytics: how hiring is going across campaigns and over time. Hires and time to hire by month,
 * the funnel and sourcing channels (for every campaign or one), each campaign against its target,
 * and what the AI agents saved. Live numbers come from the workspace, so they match the other
 * pages; history comes from the analytics service.
 */
export function AnalyticsScreen() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const { summary, pipeline, campaignSetups, agentStats, agentBaseline } = useWorkspace();
  const copy = t.analyticsPage;
  const [analytics, setAnalytics] = useState<HiringAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHiringAnalytics().then(
      (result) => {
        if (!cancelled) setAnalytics(result);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = summary !== null && pipeline !== null && agentStats !== null && agentBaseline !== null;

  return (
    <View style={styles.flex}>
      <ScreenContainer>
        <AppHeader
          title={copy.title}
          subtitle={ready && analytics ? copy.subtitle(summary.campaigns.length) : ''}
        />
        {failed ? (
          <Text className="mt-24 text-center text-sm text-slate-500 dark:text-slate-400">{copy.loadError}</Text>
        ) : !ready || !analytics ? (
          <ActivityIndicator className="mt-24" color={palette.indigo} />
        ) : (
          <AnalyticsContent
            analytics={analytics}
            summary={summary}
            board={pipeline}
            setups={campaignSetups}
            agentStats={agentStats}
            agentBaseline={agentBaseline}
          />
        )}
      </ScreenContainer>
    </View>
  );
}

type AnalyticsContentProps = {
  analytics: HiringAnalytics;
  summary: DashboardSummary;
  board: PipelineCandidate[];
  setups: Record<string, CampaignDraft>;
  agentStats: AgentStatsByKey;
  agentBaseline: AgentBaseline;
};

function AnalyticsContent({ analytics, summary, board, setups, agentStats, agentBaseline }: AnalyticsContentProps) {
  const { t } = useI18n();
  const router = useRouter();
  /** The campaign the funnel and channels are showing; `null` for all of them. */
  const [scopeId, setScopeId] = useState<string | null>(null);

  const campaigns = summary.campaigns;
  const scope = campaigns.find((campaign) => campaign.id === scopeId) ?? null;
  const scoped = scope ? [scope] : campaigns;
  const scopedIds = scoped.map((campaign) => campaign.id);
  const funnel = buildFunnel(scoped, board, analytics.campaigns);
  const channels = totalsByChannel(analytics.campaigns, scopedIds);
  const offersWaiting = board.filter(
    (candidate) => candidate.stage === 'offer' && scopedIds.includes(candidate.campaignId),
  ).length;

  const months = withBoardHires(analytics.months, board);
  const hours = hoursSavedThisWeek(agentStats, agentBaseline.hoursSavedBeforeToday);
  const weeks = [...analytics.agentWeeks, { start: analytics.currentWeekStart, hoursSaved: hours }];
  const qualified = buildFunnel(campaigns, board, analytics.campaigns).qualified;
  const targetRows = campaigns.map((campaign) => ({
    campaign,
    hired: board.filter((candidate) => candidate.campaignId === campaign.id && candidate.stage === 'hired').length,
    openings: setups[campaign.id]?.headcount ?? 0,
  }));

  const openBoard = (campaignId: string | null) =>
    campaignId
      ? router.navigate({ pathname: '/candidates', params: { campaign: campaignId } })
      : router.navigate('/candidates');

  return (
    <>
      <View className="mt-6">
        <SummaryStats
          stats={buildStats(months, analytics.hiresPreviousPeriod, summary, qualified, hours, t)}
          enterDelay={STATS_DELAY}
        />
      </View>

      <View className="mt-6 gap-6 xl:flex-row xl:items-start">
        <View className="gap-6 xl:flex-[7]">
          <Animated.View entering={FadeInDown.delay(TREND_DELAY).duration(500)}>
            <HiringTrendPanel months={months} enterDelay={TREND_DELAY + 200} />
          </Animated.View>

          {/* The campaign filter sits right above the two panels it scopes. */}
          <Animated.View entering={FadeInDown.delay(SCOPE_DELAY).duration(500)}>
            <CampaignScopeFilter campaigns={campaigns} selectedId={scopeId} onSelect={setScopeId} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(FUNNEL_DELAY).duration(500)}>
            <FunnelPanel
              funnel={funnel}
              offersWaiting={offersWaiting}
              onOpenBoard={() => openBoard(scopeId)}
              enterDelay={FUNNEL_DELAY + 200}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(CHANNELS_DELAY).duration(500)}>
            <ChannelPanel channels={channels} enterDelay={CHANNELS_DELAY + 200} />
          </Animated.View>
        </View>

        <View className="gap-6 xl:flex-[5]">
          <Animated.View entering={FadeInDown.delay(TARGETS_DELAY).duration(500)}>
            <CampaignTargetsPanel rows={targetRows} onOpenBoard={openBoard} enterDelay={TARGETS_DELAY + 200} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(AGENTS_DELAY).duration(500)}>
            <AgentImpactPanel
              weeks={weeks}
              stats={agentStats}
              onOpenAgents={() => router.navigate('/agents')}
              enterDelay={AGENTS_DELAY + 200}
            />
          </Animated.View>
        </View>
      </View>
    </>
  );
}

function buildStats(
  months: HiringMonth[],
  previousHires: number,
  summary: DashboardSummary,
  qualified: number,
  hours: number,
  t: Dictionary,
): SummaryStat[] {
  const copy = t.analyticsPage.stats;
  const hires = months.reduce((total, month) => total + month.hires, 0);
  const hiresChange = hires - previousHires;
  // Time to hire and match rate are the dashboard's numbers, with its wording.
  const hireChange = summary.timeToHireChangeDays;
  const matchGap = summary.averageMatchRate - summary.targetMatchRate;

  return [
    {
      key: 'hires',
      label: copy.hires,
      value: hires,
      format: String,
      icon: 'person-add-outline',
      accent: 'indigo',
      delta: {
        text: copy.vsPrevious(hiresChange),
        tone: hiresChange > 0 ? 'positive' : hiresChange < 0 ? 'negative' : 'neutral',
      },
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
    {
      key: 'qualified',
      label: copy.qualified,
      value: qualified,
      format: String,
      icon: 'ribbon-outline',
      accent: 'emerald',
      delta: {
        text: copy.matchRate(summary.averageMatchRate, summary.targetMatchRate),
        tone: matchGap >= 0 ? 'positive' : 'negative',
        icon: matchGap >= 0 ? 'checkmark-circle-outline' : 'alert-circle-outline',
      },
    },
    {
      key: 'hours',
      label: copy.hoursSaved,
      value: hours,
      format: t.agentsPage.stats.hours,
      icon: 'sparkles-outline',
      accent: 'violet',
      delta: { text: t.agentsPage.stats.recruiterDays(recruiterDays(hours)), tone: 'positive', icon: 'people-outline' },
    },
  ];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
