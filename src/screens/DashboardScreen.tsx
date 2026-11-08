import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { CandidateCardSwap } from '../components/CandidateCardSwap';
import { ActiveCampaignsPanel } from '../components/dashboard/ActiveCampaignsPanel';
import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { SelfHealingAlertCard } from '../components/SelfHealingAlert';
import { staggerDelay } from '../components/ui/motion';
import { Panel, PanelLink } from '../components/ui/Panel';
import { useI18n, type Dictionary } from '../i18n';
import type { DashboardSummary } from '../services/dashboard';
import type { PipelineStage } from '../services/pipeline';
import { FEATURED_CAMPAIGN_ID, useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

// Entrance order: header, stats (staggered), then the three panels.
const STATS_DELAY = 80;
// The panels cascade in right after the four stats, one stagger step apart.
const PANELS_DELAY = staggerDelay(4, STATS_DELAY) + 40;
const PANEL_DELAYS = {
  candidates: staggerDelay(0, PANELS_DELAY),
  alert: staggerDelay(1, PANELS_DELAY),
  campaigns: staggerDelay(2, PANELS_DELAY),
};
/** The dashboard previews a few campaigns; the Campaigns page lists them all. */
const MAX_DASHBOARD_CAMPAIGNS = 4;
/** Candidates at these stages have already been shortlisted. */
const SHORTLISTED_STAGES: readonly PipelineStage[] = ['interview', 'offer', 'hired'];

export function DashboardScreen() {
  const { t } = useI18n();
  const { summary } = useWorkspace();
  const today = t.date.long(new Date());

  return (
    <ScreenContainer>
      <AppHeader
        title={t.dashboard.title}
        subtitle={summary ? t.dashboard.subtitle(today, summary.activeCampaigns) : today}
      />
      <DashboardOverview />
    </ScreenContainer>
  );
}

function DashboardOverview() {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const { summary, matchedCandidates, pipeline, alerts, approvals, approveFix, dismissAlert, shortlistCandidate } =
    useWorkspace();

  // Shortlisting moves a candidate on the board, so the deck marks its cards already past screening.
  const shortlistedIds = useMemo(() => {
    const advanced = new Set(
      pipeline?.filter((candidate) => SHORTLISTED_STAGES.includes(candidate.stage)).map((candidate) => candidate.id),
    );
    return matchedCandidates?.filter((candidate) => advanced.has(candidate.id)).map((candidate) => candidate.id) ?? [];
  }, [matchedCandidates, pipeline]);

  if (!summary) {
    return <ActivityIndicator className="mt-24" color={palette.indigo} />;
  }

  const featuredCampaign = summary.campaigns.find((campaign) => campaign.id === FEATURED_CAMPAIGN_ID);
  const alert = alerts[0] ?? null;

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
            action={
              <PanelLink
                label={t.dashboard.openBoard}
                onPress={() =>
                  router.navigate({ pathname: '/candidates', params: { campaign: FEATURED_CAMPAIGN_ID } })
                }
              />
            }
          >
            <View className="pb-1 pt-4">
              {matchedCandidates && pipeline ? (
                <CandidateCardSwap
                  candidates={matchedCandidates}
                  initialShortlistedIds={shortlistedIds}
                  onShortlist={(candidate) => shortlistCandidate(candidate.id)}
                />
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
                approvedFixId={approvals[alert.id]?.fixId}
                onApproveFix={approveFix}
                onDismiss={dismissAlert}
                enterDelay={PANEL_DELAYS.alert}
              />
            </Animated.View>
          )}
          {/* The dashboard shows the most urgent alert; the rest wait on the Self-Healing page. */}
          {alerts.length > 1 && (
            <Animated.View entering={FadeIn.delay(PANEL_DELAYS.alert).duration(300)} className="-mt-3 items-end">
              <PanelLink
                label={t.dashboard.moreAlerts(alerts.length - 1)}
                onPress={() => router.navigate('/self-healing')}
              />
            </Animated.View>
          )}
          <Animated.View
            entering={FadeInDown.delay(PANEL_DELAYS.campaigns).duration(550)}
            layout={LinearTransition.duration(300)}
          >
            <ActiveCampaignsPanel
              campaigns={summary.campaigns.slice(0, MAX_DASHBOARD_CAMPAIGNS)}
              onViewAll={() => router.navigate('/campaigns')}
              enterDelay={PANEL_DELAYS.campaigns}
            />
          </Animated.View>
        </View>
      </View>
    </>
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
