import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { HealingOutcome, HealingRecord } from '../../services/selfHealing';
import { useAppTheme, type Palette } from '../../theme';
import { formatRelativeTime } from '../../utils/formatters';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const OUTCOME_STYLES: Record<
  HealingOutcome,
  {
    icon: IconName;
    color: (palette: Palette) => string;
    dotClassName: string;
    chipClassName: string;
    textClassName: string;
  }
> = {
  in_progress: {
    icon: 'sync',
    color: (palette) => palette.indigo,
    dotClassName: 'bg-indigo-50 dark:bg-indigo-500/15',
    chipClassName: 'bg-indigo-50 dark:bg-indigo-500/15',
    textClassName: 'text-indigo-700 dark:text-indigo-200',
  },
  resolved: {
    icon: 'checkmark',
    color: (palette) => palette.emerald,
    dotClassName: 'bg-emerald-50 dark:bg-emerald-500/15',
    chipClassName: 'bg-emerald-50 dark:bg-emerald-500/15',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
  },
  dismissed: {
    icon: 'eye-off-outline',
    color: (palette) => palette.icon.muted,
    dotClassName: 'bg-slate-100 dark:bg-white/10',
    chipClassName: 'bg-slate-100 dark:bg-white/10',
    textClassName: 'text-slate-600 dark:text-slate-300',
  },
};

type HealingLogPanelProps = {
  records: HealingRecord[];
  /** Brings back an alert dismissed in this session. */
  onReopen: (alertId: string) => void;
};

/** Timeline of the fixes the Orchestrator applied and the alerts HR set aside. */
export function HealingLogPanel({ records, onReopen }: HealingLogPanelProps) {
  const { t } = useI18n();
  const copy = t.selfHealingPage.log;
  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      {records.length === 0 ? (
        <Text className="text-sm text-slate-500 dark:text-slate-400">{copy.empty}</Text>
      ) : (
        <View>
          {records.map((record, index) => (
            <Animated.View
              key={record.id}
              entering={FadeInDown.duration(320)}
              layout={LinearTransition.duration(280)}
            >
              <LogEntry record={record} last={index === records.length - 1} onReopen={onReopen} />
            </Animated.View>
          ))}
        </View>
      )}
    </Panel>
  );
}

function LogEntry({
  record,
  last,
  onReopen,
}: {
  record: HealingRecord;
  last: boolean;
  onReopen: (alertId: string) => void;
}) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.selfHealingPage.log;
  const style = OUTCOME_STYLES[record.outcome];
  const issue = pick(record.issue);
  const title = record.fix ? pick(record.fix) : issue;
  const when = formatRelativeTime(record.at, t.time);
  const meta = [pick(record.campaignName), when];
  if (record.resolutionHours) meta.push(copy.resolvedIn(record.resolutionHours));
  const lift = record.result ? record.result.after - record.result.before : 0;

  return (
    <View className="flex-row gap-3">
      {/* The rail: an icon per entry, joined by a line down to the next one. */}
      <View className="items-center">
        <View className={`h-8 w-8 items-center justify-center rounded-full ${style.dotClassName}`}>
          <Ionicons name={style.icon} size={15} color={style.color(palette)} />
        </View>
        {!last && <View className="w-px flex-1 bg-slate-200 dark:bg-white/10" />}
      </View>

      <View className={`flex-1 gap-1 ${last ? '' : 'pb-5'}`}>
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 pt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
          <View className={`mt-1 rounded-full px-2 py-0.5 ${style.chipClassName}`}>
            <Text className={`text-[11px] font-semibold ${style.textClassName}`}>{copy.outcomes[record.outcome]}</Text>
          </View>
        </View>
        {record.fix && <Text className="text-xs leading-4 text-slate-500 dark:text-slate-400">{issue}</Text>}
        <Text className="text-xs text-slate-400 dark:text-slate-500">{meta.join(' · ')}</Text>

        {record.result && (
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {record.outcome === 'in_progress'
                ? copy.forecast(pick(record.result.label), record.result.before, record.result.after)
                : copy.result(pick(record.result.label), record.result.before, record.result.after)}
            </Text>
            {lift > 0 && (
              <View className="rounded-full bg-emerald-50 px-1.5 py-px dark:bg-emerald-500/15">
                <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{copy.lift(lift)}</Text>
              </View>
            )}
          </View>
        )}

        {record.outcome === 'dismissed' && record.alertId && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={copy.reopenA11y(issue)}
            onPress={() => record.alertId && onReopen(record.alertId)}
            className="mt-1 flex-row items-center gap-1 self-start rounded-lg px-2 py-1 hover:bg-indigo-50 active:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:active:bg-indigo-500/10"
          >
            <Ionicons name="arrow-undo-outline" size={13} color={palette.indigo} />
            <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{copy.reopen}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}
