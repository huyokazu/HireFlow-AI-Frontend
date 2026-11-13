import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useI18n, type Dictionary } from '../../i18n';
import type { AgentKey, AgentStats } from '../../services/agents';
import { useAppTheme } from '../../theme';
import { formatRelativeTime } from '../../utils/formatters';
import { SwitchTrack } from '../form/SwitchTrack';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { PressableScale } from '../ui/PressableScale';
import { AgentStatusBadge } from './AgentStatusBadge';
import { ACTOR_ICONS, agentStatus, type AgentStatus } from './agentStyles';

const METRIC_VALUE = 'text-lg font-bold text-slate-900 dark:text-white';

type AgentCardProps = {
  agent: AgentKey;
  stats: AgentStats;
  paused: boolean;
  /** Campaigns this agent runs on, out of `campaignsTotal`. */
  campaignsOn: number;
  campaignsTotal: number;
  /** For "Last task 2 min ago"; refreshed by the screen. */
  now: number;
  onTogglePaused: () => void;
  /** Self-Healing monitor only: alerts waiting for HR, with a link to them. */
  openAlerts?: number;
  onOpenAlerts?: () => void;
};

/** One agent: what it does, what it's doing now, today's numbers, and a switch to pause it. */
export function AgentCard({
  agent,
  stats,
  paused,
  campaignsOn,
  campaignsTotal,
  now,
  onTogglePaused,
  openAlerts = 0,
  onOpenAlerts,
}: AgentCardProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage;
  const card = copy.card;
  const name = copy.names[agent];
  const status = agentStatus(agent, stats, paused);

  return (
    <View
      className="flex-1 rounded-3xl border border-white/80 bg-white/70 p-5 dark:border-white/15 dark:bg-gray-900"
      style={{ boxShadow: palette.shadow.panel }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-2xl ${
            paused ? 'bg-slate-100 dark:bg-white/10' : 'bg-indigo-50 dark:bg-indigo-500/15'
          }`}
        >
          <Ionicons name={ACTOR_ICONS[agent]} size={20} color={paused ? palette.icon.muted : palette.indigo} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">{name}</Text>
          <Text className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">{copy.roles[agent]}</Text>
        </View>
        <PressableScale
          accessibilityRole="switch"
          aria-checked={!paused}
          accessibilityLabel={name}
          accessibilityHint={card.switchHint}
          onPress={onTogglePaused}
          hitSlop={8}
          className="h-11 justify-center"
        >
          <SwitchTrack value={!paused} />
        </PressableScale>
      </View>

      <View className="mt-4 flex-row items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
        <AgentStatusBadge status={status} />
        <Text className="text-xs text-slate-300 dark:text-slate-600">·</Text>
        {/* Two lines, so the count at the end ("…for 6 campaigns") isn't cut off on a phone. */}
        <Text className="flex-1 text-xs leading-4 text-slate-600 dark:text-slate-300" numberOfLines={2}>
          {doingLine(agent, status, stats, campaignsOn, card)}
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Metric label={card.done[agent]}>
          <AnimatedNumber value={stats.doneToday} className={METRIC_VALUE} />
        </Metric>
        <Metric label={card.agreement}>
          <AnimatedNumber value={stats.agreementRate} format={(value) => `${value}%`} className={METRIC_VALUE} />
        </Metric>
        <Metric label={card.perItem[agent]}>
          <Text className={METRIC_VALUE}>{card.duration(stats.medianSeconds)}</Text>
        </Metric>
      </View>

      {agent === 'offer' && (
        <View className="mt-3 flex-row items-center gap-1.5">
          <Ionicons name="lock-closed-outline" size={12} color={palette.icon.muted} />
          <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400">{card.offerNote}</Text>
        </View>
      )}
      {openAlerts > 0 && onOpenAlerts && (
        <PressableScale
          accessibilityRole="link"
          onPress={onOpenAlerts}
          className="mt-3 flex-row items-center gap-1.5 self-start rounded-lg px-2 py-1 hover:bg-rose-50 active:bg-rose-50 dark:hover:bg-rose-500/10 dark:active:bg-rose-500/10"
        >
          <Ionicons name="alert-circle-outline" size={14} color={palette.rose} />
          <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300">{card.openAlerts(openAlerts)}</Text>
          <Ionicons name="arrow-forward" size={12} color={palette.rose} />
        </PressableScale>
      )}

      <View className="mt-4 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-3 dark:border-white/10">
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {campaignsOn === campaignsTotal ? card.everyCampaign : card.campaigns(campaignsOn, campaignsTotal)}
        </Text>
        <Text className="text-xs text-slate-400 dark:text-slate-500">
          {card.lastActive(formatRelativeTime(stats.lastActiveAt, t.time, now))}
        </Text>
      </View>
    </View>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-1 gap-0.5">
      {children}
      <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{label}</Text>
    </View>
  );
}

function doingLine(
  agent: AgentKey,
  status: AgentStatus,
  stats: AgentStats,
  campaignsOn: number,
  card: Dictionary['agentsPage']['card'],
): string {
  if (status === 'paused') return card.waiting(stats.queued);
  if (status === 'idle') return card.idle[agent];
  switch (agent) {
    case 'sourcing':
      return card.doing.sourcing(campaignsOn);
    case 'selfHealing':
      return card.doing.selfHealing(campaignsOn);
    default:
      return card.doing[agent](stats.queued);
  }
}
