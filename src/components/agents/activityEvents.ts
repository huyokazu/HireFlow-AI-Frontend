import type { Dictionary, Localized } from '../../i18n';
import type { AgentEvent } from '../../services/agents';
import { CHANNEL_NAMES } from '../../services/campaigns';
import type { Palette } from '../../theme';
import { ACTOR_ICONS, type IconName } from './agentStyles';

// Class names are spelled out in full so Tailwind can find them when it scans the source.
export function rowLook(event: AgentEvent, palette: Palette): { icon: IconName; color: string; circleClassName: string } {
  switch (event.kind) {
    case 'agentPaused':
    case 'agentsPaused':
    case 'allPaused':
      return { icon: 'pause', color: palette.amber, circleClassName: 'bg-amber-50 dark:bg-amber-500/15' };
    case 'agentResumed':
    case 'agentsResumed':
    case 'allResumed':
      return { icon: 'play', color: palette.emerald, circleClassName: 'bg-emerald-50 dark:bg-emerald-500/15' };
    case 'bottleneckFlagged':
      return { icon: 'alert-circle-outline', color: palette.rose, circleClassName: 'bg-rose-50 dark:bg-rose-500/15' };
    case 'fixApplied':
      return {
        icon: 'checkmark-done-outline',
        color: palette.emerald,
        circleClassName: 'bg-emerald-50 dark:bg-emerald-500/15',
      };
    case 'offerSent':
      return { icon: 'paper-plane-outline', color: palette.emerald, circleClassName: 'bg-emerald-50 dark:bg-emerald-500/15' };
    default:
      return {
        icon: ACTOR_ICONS[event.actor],
        color: palette.indigo,
        circleClassName: 'bg-indigo-50 dark:bg-indigo-500/15',
      };
  }
}

/** The event as a sentence in the current language. */
export function describeEvent(event: AgentEvent, t: Dictionary, pick: <T>(value: Localized<T>) => T): string {
  const copy = t.agentsPage.activity.events;
  const names = t.agentsPage.names;
  switch (event.kind) {
    case 'cvsImported':
      return copy.cvsImported(event.count, pick(CHANNEL_NAMES[event.channel]));
    case 'cvsScored':
      return copy.cvsScored(event.count);
    case 'shortlistHandoff':
      return copy.shortlistHandoff(event.count, names.scheduling);
    case 'interviewBooked':
      return copy.interviewBooked(event.candidate);
    case 'offerDrafted':
      return copy.offerDrafted(event.candidate);
    case 'offerSent':
      return copy.offerSent(event.candidate);
    case 'healthCheck':
      return copy.healthCheck(event.campaigns);
    case 'bottleneckFlagged':
      return copy.bottleneckFlagged(pick(event.issue));
    case 'fixApplied':
      return copy.fixApplied(pick(event.fix));
    case 'setupUpdated':
      return copy.setupUpdated;
    case 'campaignLaunched':
      return copy.campaignLaunched(event.agents);
    case 'agentPaused':
      return copy.agentPaused(names[event.actor]);
    case 'agentResumed':
      return copy.agentResumed(names[event.actor]);
    case 'agentsPaused':
      return copy.agentsPaused(event.count);
    case 'agentsResumed':
      return copy.agentsResumed(event.count);
    case 'allPaused':
      return copy.allPaused;
    case 'allResumed':
      return copy.allResumed;
  }
}
