import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { AgentActor, AgentKey, AgentStats } from '../../services/agents';
import type { Palette } from '../../theme';
import { AGENT_ICONS } from '../campaignWizard/AgentsStep';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const ACTOR_ICONS: Record<AgentActor, IconName> = {
  ...AGENT_ICONS,
  offer: 'document-text-outline',
  orchestrator: 'git-network-outline',
};

/** Paused by HR, busy with work, or waiting for some. */
export type AgentStatus = 'working' | 'idle' | 'paused';

/** Sourcing and the monitor always have campaigns to work on; the others work through a queue. */
export function agentStatus(agent: AgentKey, stats: AgentStats, paused: boolean): AgentStatus {
  if (paused) return 'paused';
  if (agent === 'sourcing' || agent === 'selfHealing') return 'working';
  return stats.queued > 0 ? 'working' : 'idle';
}

// Class names are spelled out in full so Tailwind can find them when it scans the source.
export const STATUS_STYLES: Record<
  AgentStatus,
  { dotClassName: string; textClassName: string; color: (palette: Palette) => string }
> = {
  working: {
    dotClassName: 'bg-emerald-500 dark:bg-emerald-400',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
    color: (palette) => palette.emerald,
  },
  idle: {
    dotClassName: 'bg-slate-400 dark:bg-slate-500',
    textClassName: 'text-slate-500 dark:text-slate-400',
    color: (palette) => palette.icon.faint,
  },
  paused: {
    dotClassName: 'bg-amber-500 dark:bg-amber-400',
    textClassName: 'text-amber-700 dark:text-amber-300',
    color: (palette) => palette.amber,
  },
};
