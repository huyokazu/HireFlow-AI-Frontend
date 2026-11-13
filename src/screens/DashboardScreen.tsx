import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { CandidateCardSwap } from '../components/CandidateCardSwap';
import { ActiveCampaignsPanel } from '../components/dashboard/ActiveCampaignsPanel';
import { OrchestratorStatusPanel } from '../components/dashboard/OrchestratorStatusPanel';
import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { TwinSnapshotPanel } from '../components/dashboard/TwinSnapshotPanel';
import { AppHeader } from '../components/layout/AppHeader';
import { useShell, type Device } from '../components/layout/AppShell';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { SelfHealingAlertCard } from '../components/SelfHealingAlert';
import { staggerDelay } from '../components/ui/motion';
import { Panel, PanelLink } from '../components/ui/Panel';
import { useI18n, type Dictionary } from '../i18n';
import type { DashboardSummary } from '../services/dashboard';
import type { PipelineStage } from '../services/pipeline';
import { FEATURED_CAMPAIGN_ID, useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

// Entrance order: header, stats (staggered), then the panels.
const STATS_DELAY = 80;
// The panels cascade in right after the four stats, one stagger step apart.
const PANELS_DELAY = staggerDelay(4, STATS_DELAY) + 40;
const PANEL_DELAYS = {
  candidates: staggerDelay(0, PANELS_DELAY),
  orchestrator: staggerDelay(1, PANELS_DELAY),
  alert: staggerDelay(2, PANELS_DELAY),
  twin: staggerDelay(3, PANELS_DELAY),
  campaigns: staggerDelay(4, PANELS_DELAY),
};
/** The dashboard previews a few campaigns; the Campaigns page lists them all. */
const MAX_DASHBOARD_CAMPAIGNS = 4;
/** Candidates at these stages have already been shortlisted. */
const SHORTLISTED_STAGES: readonly PipelineStage[] = ['interview', 'offer', 'hired'];
/** Room the page column needs for the wide layout: the deck beside a column of panels. */
const BENTO_MIN_WIDTH = 860;
/** Room for the four stats in one row. */
const STATS_ROW_MIN_WIDTH = 680;

/**
 * How the dashboard arranges its panels:
 * - `stack`: one column, on phones.
 * - `split`: two equal columns, the deck on the left and the alert and Digital Twin on the right
 *   (tablets, and desktop windows too narrow for `bento`).
 * - `bento`: a 12-column grid with the stats across the top, the deck in 7 columns on the left,
 *   and the Orchestrator, the alert and the Digital Twin in 5 columns on the right.
 */
type DashboardLayout = 'stack' | 'split' | 'bento';

function layoutFor(device: Device, contentWidth: number): DashboardLayout {
  if (device === 'phone') return 'stack';
  if (device === 'tablet' || contentWidth < BENTO_MIN_WIDTH) return 'split';
  return 'bento';
}

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
  const { device, contentWidth } = useShell();
  const {
    summary,
    matchedCandidates,
    pipeline,
    alerts,
    approvals,
    approveFix,
    dismissAlert,
    shortlistCandidate,
    skipCandidate,
    agentStats,
    pausedAgents,
    campaignSetups,
    twinOffsets,
  } = useWorkspace();

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

  const layout = layoutFor(device, contentWidth);
  const featuredCampaign = summary.campaigns.find((campaign) => campaign.id === FEATURED_CAMPAIGN_ID);
  const featuredSetup = campaignSetups[FEATURED_CAMPAIGN_ID];
  const alert = alerts[0] ?? null;

  const deck = (
    <Animated.View entering={FadeInDown.delay(PANEL_DELAYS.candidates).duration(550)}>
      <Panel
        title={t.dashboard.matchedCandidates}
        subtitle={t.dashboard.matchedSubtitle(
          featuredCampaign ? pick(featuredCampaign.title) : t.dashboard.featuredCampaign,
        )}
        action={
          <PanelLink
            label={t.dashboard.openBoard}
            onPress={() => router.navigate({ pathname: '/candidates', params: { campaign: FEATURED_CAMPAIGN_ID } })}
          />
        }
      >
        <View className="pb-1 pt-4">
          {matchedCandidates && pipeline ? (
            <CandidateCardSwap
              candidates={matchedCandidates}
              initialShortlistedIds={shortlistedIds}
              onShortlist={(candidate) => shortlistCandidate(candidate.id)}
              onSkip={(candidate) => skipCandidate(candidate.id)}
            />
          ) : (
            <ActivityIndicator className="my-24" color={palette.indigo} />
          )}
        </View>
      </Panel>
    </Animated.View>
  );

  const orchestrator = agentStats && (
    <Animated.View entering={FadeInDown.delay(PANEL_DELAYS.orchestrator).duration(550)}>
      <OrchestratorStatusPanel
        stats={agentStats}
        paused={pausedAgents}
        campaigns={summary.campaigns.length}
        onOpenAgents={() => router.navigate('/agents')}
        enterDelay={PANEL_DELAYS.orchestrator}
      />
    </Animated.View>
  );

  const alertBlock = alert && (
    <View className="gap-3">
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
      {/* The dashboard shows the most urgent alert; the rest wait on the Self-Healing page. */}
      {alerts.length > 1 && (
        <Animated.View entering={FadeIn.delay(PANEL_DELAYS.alert).duration(300)} className="items-end">
          <PanelLink
            label={t.dashboard.moreAlerts(alerts.length - 1)}
            onPress={() => router.navigate('/self-healing')}
          />
        </Animated.View>
      )}
    </View>
  );

  const twin = featuredCampaign && featuredSetup && (
    <Animated.View entering={FadeInDown.delay(PANEL_DELAYS.twin).duration(550)}>
      <TwinSnapshotPanel
        campaign={featuredCampaign}
        setup={featuredSetup}
        offset={twinOffsets[FEATURED_CAMPAIGN_ID] ?? 0}
        onOpenTwin={() =>
          router.navigate({ pathname: '/digital-twin', params: { campaign: FEATURED_CAMPAIGN_ID } })
        }
        enterDelay={PANEL_DELAYS.twin}
      />
    </Animated.View>
  );

  const campaigns = (
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
  );

  return (
    <>
      <View className="mt-6">
        <SummaryStats
          stats={buildSummaryStats(summary, t)}
          enterDelay={STATS_DELAY}
          columns={contentWidth >= STATS_ROW_MIN_WIDTH ? 4 : 2}
        />
      </View>

      {layout === 'stack' ? (
        <View className="mt-6 gap-6">
          {deck}
          {alertBlock}
          {orchestrator}
          {twin}
          {campaigns}
        </View>
      ) : (
        <View className="mt-6 flex-row items-start gap-6">
          <Column span={layout === 'bento' ? 7 : 6} front>
            {deck}
            {layout === 'split' && orchestrator}
            {campaigns}
          </Column>
          <Column span={layout === 'bento' ? 5 : 6}>
            {layout === 'bento' && orchestrator}
            {alertBlock}
            {twin}
          </Column>
        </View>
      )}
    </>
  );
}

/**
 * A column of the dashboard grid, `span` of 12 wide. The deck's column sits in front, so a card
 * flung to the right flies over the panels beside it.
 */
function Column({ span, front = false, children }: { span: number; front?: boolean; children: ReactNode }) {
  return (
    <View className="min-w-0 gap-6" style={{ flex: span, zIndex: front ? 2 : 1 }}>
      {children}
    </View>
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
