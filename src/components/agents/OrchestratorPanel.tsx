import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import {
  AGENT_KEYS,
  FLOW_AGENTS,
  type AgentKey,
  type AgentStats,
  type AgentStatsByKey,
  type PausedAgents,
} from '../../services/agents';
import { useAppTheme } from '../../theme';
import { Button } from '../ui/Button';
import { RadarPulse } from '../ui/pulse';
import { AgentStatusBadge } from './AgentStatusBadge';
import { ACTOR_ICONS, agentStatus } from './agentStyles';
import { FlowConnector, FlowLink } from './FlowConnector';

const ORCHESTRATOR_GLOW = '0px 10px 24px -10px rgba(79, 70, 229, 0.7)';

type OrchestratorPanelProps = {
  stats: AgentStatsByKey;
  paused: PausedAgents;
  campaigns: number;
  onPauseAll: () => void;
  onResumeAll: () => void;
};

/**
 * The Orchestrator and the pipeline it runs: each agent hands candidates to the next, and the
 * queue between two agents shows where work is piling up. The Self-Healing monitor watches it all.
 */
export function OrchestratorPanel({ stats, paused, campaigns, onPauseAll, onResumeAll }: OrchestratorPanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage;
  const allPaused = AGENT_KEYS.every((agent) => paused[agent]);

  return (
    <View
      className="rounded-3xl border border-white/80 bg-white/70 p-5 dark:border-white/15 dark:bg-gray-900"
      style={{ boxShadow: palette.shadow.panel }}
    >
      <View className="gap-4 md:flex-row md:items-start">
        <View className="flex-1 flex-row items-start gap-4">
          <View className="h-12 w-12 items-center justify-center">
            <RadarPulse color={palette.indigo} active={!allPaused} size={48} reach={1.9} />
            <View
              className={`h-12 w-12 items-center justify-center rounded-2xl ${
                allPaused ? 'bg-slate-400 dark:bg-slate-600' : 'bg-indigo-600 dark:bg-indigo-500'
              }`}
              style={allPaused ? undefined : { boxShadow: ORCHESTRATOR_GLOW }}
            >
              <Ionicons name={ACTOR_ICONS.orchestrator} size={22} color="#FFFFFF" />
            </View>
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">{copy.names.orchestrator}</Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400">{copy.roles.orchestrator}</Text>
            <View className="mt-1">
              <AgentStatusBadge
                radar
                status={allPaused ? 'paused' : 'working'}
                label={allPaused ? copy.orchestrator.holding : copy.orchestrator.coordinating(campaigns)}
              />
            </View>
          </View>
        </View>
        <Button
          variant="secondary"
          icon={allPaused ? 'play' : 'pause'}
          label={allPaused ? copy.orchestrator.resumeAll : copy.orchestrator.pauseAll}
          accessibilityLabel={allPaused ? copy.orchestrator.resumeAllA11y : copy.orchestrator.pauseAllA11y}
          onPress={allPaused ? onResumeAll : onPauseAll}
          className="self-start"
        />
      </View>

      {/* The Orchestrator dispatches work to the first agent. */}
      <View className="mt-3">
        <FlowLink flowing={!allPaused && !paused[FLOW_AGENTS[0]]} tone="indigo" height={24} />
      </View>

      {/* A column on narrow screens; one row from xl up, where the nodes fit side by side. */}
      <View role="group" aria-label={copy.orchestrator.flowA11y} className="xl:flex-row xl:items-center">
        {FLOW_AGENTS.map((agent, index) => {
          const connector = (vertical: boolean) => (
            <FlowConnector
              vertical={vertical}
              flowing={!paused[FLOW_AGENTS[index - 1]]}
              queued={stats[agent].queued}
              held={paused[agent]}
              accessibilityLabel={copy.orchestrator.queueA11y(stats[agent].queued, copy.names[agent])}
            />
          );
          return (
            <Fragment key={agent}>
              {index > 0 && (
                <>
                  <View className="xl:hidden">{connector(true)}</View>
                  <View className="hidden flex-1 xl:flex">{connector(false)}</View>
                </>
              )}
              <FlowNode agent={agent} stats={stats[agent]} paused={paused[agent]} />
            </Fragment>
          );
        })}
      </View>

      {/* Every stage reports to the Self-Healing monitor. */}
      <FlowLink flowing={!paused.selfHealing} tone="emerald" height={20} />
      <WatcherBand stats={stats.selfHealing} paused={paused.selfHealing} />
    </View>
  );
}

function FlowNode({ agent, stats, paused }: { agent: AgentKey; stats: AgentStats; paused: boolean }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage;
  const status = agentStatus(agent, stats, paused);
  const today = copy.orchestrator.today(stats.doneToday);

  return (
    <View
      role="img"
      aria-label={copy.orchestrator.nodeA11y(copy.names[agent], copy.status[status], stats.doneToday)}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5 xl:w-[168px]"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${
          paused ? 'bg-slate-100 dark:bg-white/10' : 'bg-indigo-50 dark:bg-indigo-500/15'
        }`}
      >
        <Ionicons name={ACTOR_ICONS[agent]} size={18} color={paused ? palette.icon.muted : palette.indigo} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
          {copy.shortNames[agent]}
        </Text>
        <AgentStatusBadge status={status} />
        {/* Under the status in the narrow xl nodes; at the row's end everywhere else. */}
        <Text className="hidden text-xs text-slate-500 dark:text-slate-400 xl:flex">{today}</Text>
      </View>
      <Text className="text-xs font-medium text-slate-500 dark:text-slate-400 xl:hidden">{today}</Text>
    </View>
  );
}

function WatcherBand({ stats, paused }: { stats: AgentStats; paused: boolean }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage;
  const status = agentStatus('selfHealing', stats, paused);

  return (
    <View
      role="img"
      aria-label={`${copy.orchestrator.nodeA11y(copy.names.selfHealing, copy.status[status], stats.doneToday)}. ${copy.orchestrator.watcher}`}
      className="flex-row items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-3 dark:border-white/15"
    >
      <Ionicons name={ACTOR_ICONS.selfHealing} size={16} color={paused ? palette.icon.muted : palette.emerald} />
      <View className="flex-1 gap-0.5 md:flex-row md:items-center md:gap-2">
        <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.names.selfHealing}</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400">{copy.orchestrator.watcher}</Text>
      </View>
      <AgentStatusBadge status={status} />
    </View>
  );
}
