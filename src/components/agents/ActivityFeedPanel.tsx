import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useI18n, type Dictionary, type Localized } from '../../i18n';
import type { AgentActor, AgentEvent } from '../../services/agents';
import { CHANNEL_NAMES } from '../../services/campaigns';
import { useAppTheme, type Palette } from '../../theme';
import { formatRelativeTime } from '../../utils/formatters';
import { ChoiceChip } from '../form/ChoiceChip';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { PulseRing } from '../ui/pulse';
import { ACTOR_ICONS, type IconName } from './agentStyles';

type Filter = AgentActor | 'all';

const FILTERS: readonly Filter[] = ['all', 'orchestrator', 'sourcing', 'matching', 'scheduling', 'offer', 'selfHealing'];
const PAGE_SIZE = 10;

type ActivityFeedPanelProps = {
  /** Newest first. */
  events: AgentEvent[];
  /** Campaign titles by id, in the current language. */
  campaignTitles: Record<string, string>;
  /** Whether new activity is streaming in; HR can pause it to read in peace. */
  live: boolean;
  onToggleLive: () => void;
  /** For the relative times; refreshed by the screen. */
  now: number;
};

/** Everything the agents and the Orchestrator did, newest first, filterable by agent. */
export function ActivityFeedPanel({ events, campaignTitles, live, onToggleLive, now }: ActivityFeedPanelProps) {
  const { t } = useI18n();
  const copy = t.agentsPage.activity;
  const [filter, setFilter] = useState<Filter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const filtered = filter === 'all' ? events : events.filter((event) => event.actor === filter);
  const visible = filtered.slice(0, visibleCount);

  const selectFilter = (next: Filter) => {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <Panel title={copy.title} subtitle={copy.subtitle} action={<LiveToggle live={live} onPress={onToggleLive} />}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerStyle={styles.filters}
      >
        <View role="radiogroup" aria-label={copy.filterA11y} className="flex-row gap-2">
          {FILTERS.map((key) => (
            <ChoiceChip
              key={key}
              role="radio"
              label={key === 'all' ? copy.all : t.agentsPage.shortNames[key]}
              selected={filter === key}
              onPress={() => selectFilter(key)}
            />
          ))}
        </View>
      </ScrollView>

      <View className="mt-2">
        {visible.length === 0 ? (
          <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{copy.empty}</Text>
        ) : (
          visible.map((event, index) => (
            <Animated.View key={event.id} entering={FadeInDown.duration(320)} layout={LinearTransition.duration(260)}>
              <ActivityRow
                event={event}
                divider={index > 0}
                campaignTitle={event.campaignId ? campaignTitles[event.campaignId] : undefined}
                now={now}
              />
            </Animated.View>
          ))
        )}
      </View>

      {filtered.length > visibleCount && (
        <Button
          variant="ghost"
          icon="chevron-down"
          label={copy.showMore}
          onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="mt-1 self-center"
        />
      )}
    </Panel>
  );
}

function LiveToggle({ live, onPress }: { live: boolean; onPress: () => void }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage.activity;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={live ? copy.pauseA11y : copy.resumeA11y}
      onPress={onPress}
      hitSlop={6}
      className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 ${
        live
          ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      {live ? (
        <View className="h-2 w-2 items-center justify-center">
          <PulseRing color={palette.emerald} active size={8} />
          <View className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        </View>
      ) : (
        <Ionicons name="pause" size={11} color={palette.icon.muted} />
      )}
      <Text
        className={`text-xs font-semibold ${live ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}
      >
        {live ? copy.live : copy.paused}
      </Text>
    </PressableScale>
  );
}

function ActivityRow({
  event,
  divider,
  campaignTitle,
  now,
}: {
  event: AgentEvent;
  divider: boolean;
  campaignTitle?: string;
  now: number;
}) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const look = rowLook(event, palette);
  const meta = [t.agentsPage.shortNames[event.actor], campaignTitle, formatRelativeTime(event.at, t.time, now)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className={`flex-row gap-3 py-3 ${divider ? 'border-t border-slate-100 dark:border-white/10' : ''}`}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${look.circleClassName}`}>
        <Ionicons name={look.icon} size={15} color={look.color} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm leading-5 text-slate-800 dark:text-slate-100">{describeEvent(event, t, pick)}</Text>
        <Text className="text-xs text-slate-400 dark:text-slate-500">{meta}</Text>
      </View>
    </View>
  );
}

// Class names are spelled out in full so Tailwind can find them when it scans the source.
function rowLook(event: AgentEvent, palette: Palette): { icon: IconName; color: string; circleClassName: string } {
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
    default:
      return {
        icon: ACTOR_ICONS[event.actor],
        color: palette.indigo,
        circleClassName: 'bg-indigo-50 dark:bg-indigo-500/15',
      };
  }
}

/** The event as a sentence in the current language. */
function describeEvent(event: AgentEvent, t: Dictionary, pick: <T>(value: Localized<T>) => T): string {
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

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 20 },
});
