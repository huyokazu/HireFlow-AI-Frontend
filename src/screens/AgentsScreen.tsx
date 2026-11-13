import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ActivityFeedPanel } from '../components/agents/ActivityFeedPanel';
import { AgentCard } from '../components/agents/AgentCard';
import { OperationsPanel } from '../components/agents/OperationsPanel';
import { OrchestratorPanel } from '../components/agents/OrchestratorPanel';
import { SummaryStats, type SummaryStat } from '../components/dashboard/SummaryStats';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { STAGGER_MS } from '../components/ui/motion';
import { Toast } from '../components/ui/Toast';
import { useI18n, type Dictionary } from '../i18n';
import {
  AGENT_KEYS,
  ALL_AGENTS_PAUSED,
  hoursSavedThisWeek,
  NO_AGENTS_PAUSED,
  recruiterDays,
  type AgentKey,
  type AgentStatsByKey,
  type PausedAgents,
} from '../services/agents';
import { useAuth } from '../state/AuthProvider';
import { useWorkspace, type AgentBaseline } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

// Entrance order: header, stats (staggered), the Orchestrator, then the agents and the feed.
const STATS_DELAY = 80;
const ORCHESTRATOR_DELAY = 360;
const CARDS_DELAY = 440;
const CARD_STAGGER_MS = STAGGER_MS;
const FEED_DELAY = 520;
const OPERATIONS_DELAY = 600;
/** How often relative times ("2 min ago") refresh. */
const CLOCK_TICK_MS = 30_000;

/** Every pause change can be undone, so the toast keeps the state it replaced. */
type AgentsToast =
  | { key: number; kind: 'paused' | 'resumed'; agent: AgentKey; previous: PausedAgents }
  | { key: number; kind: 'allPaused' | 'allResumed'; previous: PausedAgents };

type ToastInput =
  | { kind: 'paused' | 'resumed'; agent: AgentKey }
  | { kind: 'allPaused' | 'allResumed' };

/**
 * AI Agents: the Orchestrator and the agents it runs. Shows how work flows between them and where
 * it's waiting, today's numbers per agent, and a live log; HR can pause any agent, or all of them.
 */
export function AgentsScreen() {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const {
    workspaceId,
    summary,
    campaignSetups,
    openAlerts,
    agentStats,
    agentBaseline,
    agentEvents,
    pausedAgents,
    setPausedAgents,
    watchAgentActivity,
  } = useWorkspace();
  const copy = t.agentsPage;
  const [live, setLive] = useState(true);
  const [toast, setToast] = useState<AgentsToast | null>(null);
  const now = useNow(CLOCK_TICK_MS);

  // Activity streams in only while this page is open and HR hasn't paused the updates.
  useEffect(() => {
    if (!live) return undefined;
    return watchAgentActivity();
  }, [live, watchAgentActivity]);

  const campaigns = useMemo(() => summary?.campaigns ?? [], [summary]);
  const campaignTitles = useMemo(
    () => Object.fromEntries(campaigns.map((campaign) => [campaign.id, pick(campaign.title)])),
    [campaigns, pick],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const changePaused = (next: PausedAgents, input: ToastInput) => {
    const previous = pausedAgents;
    setPausedAgents(next);
    // A new key per toast restarts its timer and entrance, even when one is already showing.
    setToast((current) => ({ ...input, key: (current?.key ?? 0) + 1, previous }));
  };

  const toggleAgent = (agent: AgentKey) => {
    const pausing = !pausedAgents[agent];
    changePaused({ ...pausedAgents, [agent]: pausing }, { kind: pausing ? 'paused' : 'resumed', agent });
  };

  const undo = () => {
    if (!toast) return;
    setPausedAgents(toast.previous);
    setToast(null);
  };

  // The Offer Agent steps in on every campaign once a candidate reaches Offer.
  const campaignsOn = (agent: AgentKey) =>
    agent === 'offer'
      ? campaigns.length
      : campaigns.filter((campaign) => campaignSetups[campaign.id]?.agents[agent] !== false).length;

  const ready = summary !== null && agentStats !== null && agentBaseline !== null;
  const running = AGENT_KEYS.filter((agent) => !pausedAgents[agent]).length;

  return (
    <View style={styles.flex}>
      <ScreenContainer>
        <AppHeader
          title={copy.title}
          subtitle={ready ? copy.subtitle(running, AGENT_KEYS.length, campaigns.length) : ''}
        />
        {!ready ? (
          <ActivityIndicator className="mt-24" color={palette.indigo} />
        ) : (
          <>
            <View className="mt-6">
              <SummaryStats stats={buildStats(agentStats, agentBaseline, pausedAgents, t)} enterDelay={STATS_DELAY} />
            </View>

            <Animated.View entering={FadeInDown.delay(ORCHESTRATOR_DELAY).duration(500)} className="mt-6">
              <OrchestratorPanel
                stats={agentStats}
                paused={pausedAgents}
                campaigns={campaigns.length}
                onPauseAll={() => changePaused(ALL_AGENTS_PAUSED, { kind: 'allPaused' })}
                onResumeAll={() => changePaused(NO_AGENTS_PAUSED, { kind: 'allResumed' })}
              />
            </Animated.View>

            <View className="mt-6 gap-6 xl:flex-row xl:items-start">
              {/* Two cards a row where there's room (the last one takes the full row), one beside the feed at xl. */}
              <View className="gap-4 md:flex-row md:flex-wrap xl:flex-[7]">
                {AGENT_KEYS.map((agent, index) => (
                  <Animated.View
                    key={agent}
                    entering={FadeInDown.delay(CARDS_DELAY + index * CARD_STAGGER_MS).duration(500)}
                    className="md:w-[48%] md:flex-grow xl:w-full 2xl:w-[48%]"
                  >
                    <AgentCard
                      agent={agent}
                      stats={agentStats[agent]}
                      paused={pausedAgents[agent]}
                      campaignsOn={campaignsOn(agent)}
                      campaignsTotal={campaigns.length}
                      now={now}
                      onTogglePaused={() => toggleAgent(agent)}
                      openAlerts={agent === 'selfHealing' ? openAlerts.length : 0}
                      onOpenAlerts={agent === 'selfHealing' ? () => router.navigate('/self-healing') : undefined}
                    />
                  </Animated.View>
                ))}
              </View>

              <Animated.View entering={FadeInDown.delay(FEED_DELAY).duration(500)} className="xl:flex-[5]">
                <ActivityFeedPanel
                  events={agentEvents}
                  campaignTitles={campaignTitles}
                  live={live}
                  onToggleLive={() => setLive((current) => !current)}
                  now={now}
                />
              </Animated.View>
            </View>

            {/* Real interviews and emails need the API; mock mode has none to show. */}
            {authStatus !== 'disabled' && (
              <Animated.View entering={FadeInDown.delay(OPERATIONS_DELAY).duration(500)} className="mt-6">
                <OperationsPanel workspaceId={workspaceId} now={now} />
              </Animated.View>
            )}
          </>
        )}
      </ScreenContainer>

      <Toast
        toastKey={toast?.key ?? null}
        message={toastMessage(toast, t)}
        icon={toast?.kind === 'resumed' || toast?.kind === 'allResumed' ? 'play-circle' : 'pause-circle'}
        actionLabel={toast ? copy.toast.undo : undefined}
        onAction={toast ? undo : undefined}
        onDismiss={dismissToast}
      />
    </View>
  );
}

/** The current time, refreshed every `intervalMs`. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function toastMessage(toast: AgentsToast | null, t: Dictionary): string {
  if (!toast) return '';
  const copy = t.agentsPage.toast;
  switch (toast.kind) {
    case 'paused':
      return copy.paused(t.agentsPage.names[toast.agent]);
    case 'resumed':
      return copy.resumed(t.agentsPage.names[toast.agent]);
    case 'allPaused':
      return copy.allPaused;
    case 'allResumed':
      return copy.allResumed;
  }
}

function buildStats(
  stats: AgentStatsByKey,
  baseline: AgentBaseline,
  paused: PausedAgents,
  t: Dictionary,
): SummaryStat[] {
  const copy = t.agentsPage.stats;
  const total = AGENT_KEYS.length;
  const running = AGENT_KEYS.filter((agent) => !paused[agent]).length;
  const tasksToday = AGENT_KEYS.reduce((sum, agent) => sum + stats[agent].doneToday, 0);
  const change =
    baseline.tasksYesterday > 0
      ? Math.round(((tasksToday - baseline.tasksYesterday) / baseline.tasksYesterday) * 100)
      : 0;
  const hours = hoursSavedThisWeek(stats, baseline.hoursSavedBeforeToday);
  const queued = AGENT_KEYS.reduce((sum, agent) => sum + stats[agent].queued, 0);
  const held = AGENT_KEYS.reduce((sum, agent) => sum + (paused[agent] ? stats[agent].queued : 0), 0);

  return [
    {
      key: 'running',
      label: copy.running,
      value: running,
      format: (value) => `${value}/${total}`,
      icon: 'hardware-chip-outline',
      accent: 'emerald',
      delta:
        running === total
          ? { text: copy.allRunning, tone: 'positive', icon: 'checkmark-circle-outline' }
          : { text: copy.paused(total - running), tone: 'negative', icon: 'pause-circle-outline' },
    },
    {
      key: 'tasks',
      label: copy.tasksToday,
      value: tasksToday,
      format: String,
      icon: 'flash-outline',
      accent: 'indigo',
      delta: { text: copy.vsYesterday(change), tone: change >= 0 ? 'positive' : 'negative' },
    },
    {
      key: 'hours',
      label: copy.hoursSaved,
      value: hours,
      format: copy.hours,
      icon: 'time-outline',
      accent: 'violet',
      delta: {
        text: copy.recruiterDays(recruiterDays(hours)),
        tone: 'positive',
        icon: 'people-outline',
      },
    },
    {
      key: 'queued',
      label: copy.queued,
      value: queued,
      format: String,
      icon: 'layers-outline',
      accent: 'amber',
      delta:
        held > 0
          ? { text: copy.held(held), tone: 'negative', icon: 'pause-circle-outline' }
          : { text: copy.flowing, tone: 'positive', icon: 'checkmark-circle-outline' },
    },
  ];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
