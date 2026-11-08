import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { AGENT_KEYS, type AgentStatsByKey, type PausedAgents } from '../../services/agents';
import { useAppTheme } from '../../theme';
import { AgentStatusBadge } from '../agents/AgentStatusBadge';
import { ACTOR_ICONS, agentStatus } from '../agents/agentStyles';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { staggerDelay } from '../ui/motion';
import { Panel, PanelLink } from '../ui/Panel';
import { RadarPulse } from '../ui/pulse';

type OrchestratorStatusPanelProps = {
  stats: AgentStatsByKey;
  paused: PausedAgents;
  campaigns: number;
  onOpenAgents: () => void;
  enterDelay?: number;
};

/**
 * The dashboard's view of the AI agents: the Orchestrator's radar while it coordinates, today's
 * task count, and what each agent is doing right now. The AI Agents page has the controls.
 */
export function OrchestratorStatusPanel({
  stats,
  paused,
  campaigns,
  onOpenAgents,
  enterDelay = 0,
}: OrchestratorStatusPanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage;
  const running = AGENT_KEYS.filter((agent) => !paused[agent]).length;
  const live = running > 0;
  const tasksToday = AGENT_KEYS.reduce((sum, agent) => sum + stats[agent].doneToday, 0);

  return (
    <Panel
      title={copy.names.orchestrator}
      subtitle={live ? copy.orchestrator.coordinating(campaigns) : copy.orchestrator.holding}
      action={<PanelLink label={t.dashboard.openAgents} onPress={onOpenAgents} />}
    >
      <View className="flex-row items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-400/20 dark:bg-indigo-500/10">
        <View className="h-11 w-11 items-center justify-center">
          <RadarPulse color={palette.indigo} active={live} size={44} reach={1.7} />
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 dark:bg-indigo-500">
            <Ionicons name={ACTOR_ICONS.orchestrator} size={20} color="#FFFFFF" />
          </View>
        </View>
        <View className="flex-1 gap-0.5">
          <AgentStatusBadge
            status={live ? 'working' : 'paused'}
            label={live ? copy.subtitle(running, AGENT_KEYS.length, campaigns) : copy.status.paused}
            radar
          />
          <Text className="text-xs text-slate-500 dark:text-slate-400">{copy.stats.tasksToday}</Text>
        </View>
        <AnimatedNumber value={tasksToday} className="text-2xl font-bold text-slate-900 dark:text-white" />
      </View>

      <View accessibilityLabel={t.dashboard.agentsList} className="mt-3 gap-1">
        {AGENT_KEYS.map((agent, index) => {
          const agentStats = stats[agent];
          const status = agentStatus(agent, agentStats, paused[agent]);
          return (
            <Animated.View
              key={agent}
              entering={FadeInDown.delay(staggerDelay(index, enterDelay + 120)).duration(380)}
              className="flex-row items-center gap-3 rounded-xl px-1 py-1.5"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-xl ${
                  status === 'paused' ? 'bg-slate-100 dark:bg-white/10' : 'bg-indigo-50 dark:bg-indigo-500/15'
                }`}
              >
                <Ionicons
                  name={ACTOR_ICONS[agent]}
                  size={15}
                  color={status === 'paused' ? palette.icon.muted : palette.indigo}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100" numberOfLines={1}>
                  {copy.shortNames[agent]}
                </Text>
                <AgentStatusBadge status={status} />
              </View>
              <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {agentStats.queued > 0 ? copy.orchestrator.queue(agentStats.queued) : copy.orchestrator.today(agentStats.doneToday)}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </Panel>
  );
}
