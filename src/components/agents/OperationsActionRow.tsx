import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useI18n, type Dictionary } from '../../i18n';
import type { OperationsAction, OperationsActionStatus } from '../../services/operations';
import { useAppTheme, type Palette } from '../../theme';
import { formatRelativeTime } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { OperationsDetailsLine } from './OperationsDetailsLine';

/** What HR can do with an action: decide on a proposal, or send a stuck one again. */
export type ActionCommand = 'approve' | 'reject' | 'retry';

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const AMBER = { chip: 'bg-amber-50 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' };
const INDIGO = { chip: 'bg-indigo-50 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300' };
const ROSE = { chip: 'bg-rose-50 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300' };
const STATUS_CHIPS: Record<OperationsActionStatus, { chip: string; text: string }> = {
  proposed: AMBER,
  approved: INDIGO,
  executing: INDIGO,
  succeeded: { chip: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
  failed: ROSE,
  ambiguous: ROSE,
  rejected: { chip: 'bg-slate-100 dark:bg-white/10', text: 'text-slate-600 dark:text-slate-300' },
  blocked_reauth: AMBER,
};

type OperationsActionRowProps = {
  action: OperationsAction;
  divider: boolean;
  now: number;
  /** The command running on this row, if any. */
  pending: ActionCommand | null;
  onCommand: (action: OperationsAction, command: ActionCommand) => void;
};

/** One interview or email: what it is, where it stands, and the buttons for what HR can do next. */
export function OperationsActionRow({ action, divider, now, pending, onCommand }: OperationsActionRowProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage.operations;
  const { payload, result } = action;
  const interview = action.kind === 'schedule_interview';
  const detail =
    action.kind === 'send_email'
      ? action.status === 'succeeded' && result?.deliveredTo
        ? copy.sentTo(result.deliveredTo)
        : action.payload.subject
      : null;
  const canRetry = action.status === 'failed' || action.status === 'blocked_reauth';

  return (
    <View className={`gap-2 py-3 ${divider ? 'border-t border-slate-100 dark:border-white/10' : ''}`}>
      <View className="flex-row items-start gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/15">
          <Ionicons name={interview ? 'calendar-outline' : 'mail-outline'} size={15} color={iconColor(action, palette)} />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="shrink text-sm font-semibold text-slate-800 dark:text-slate-100">
              {title(action, copy)}
            </Text>
            <View className={`rounded-md px-1.5 py-0.5 ${STATUS_CHIPS[action.status].chip}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-wide ${STATUS_CHIPS[action.status].text}`}>
                {copy.status[action.status]}
              </Text>
            </View>
          </View>
          {detail && (
            <Text className="text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
              {detail}
            </Text>
          )}
          <OperationsDetailsLine
            candidate={payload.candidateName}
            startsAt={interview && action.status === 'succeeded' ? result?.startsAt : undefined}
            meetLink={interview && action.status === 'succeeded' ? result?.meetLink : undefined}
            simulated={action.simulated}
          />
          {action.error && (action.status === 'failed' || action.status === 'ambiguous') && (
            <Text className="text-xs text-rose-600 dark:text-rose-400">{action.error}</Text>
          )}
          <Text className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(action.updatedAt, t.time, now)}</Text>
        </View>
      </View>

      {(action.status === 'proposed' || canRetry) && (
        <View className="flex-row flex-wrap justify-end gap-2">
          {action.status === 'proposed' ? (
            <>
              <Button
                variant="ghost"
                label={copy.reject}
                loading={pending === 'reject'}
                disabled={pending !== null}
                onPress={() => onCommand(action, 'reject')}
              />
              <Button
                icon="checkmark"
                label={copy.approve}
                loading={pending === 'approve'}
                disabled={pending !== null}
                onPress={() => onCommand(action, 'approve')}
              />
            </>
          ) : (
            <Button
              variant="secondary"
              icon="refresh"
              label={copy.retry}
              loading={pending === 'retry'}
              disabled={pending !== null}
              onPress={() => onCommand(action, 'retry')}
            />
          )}
        </View>
      )}
    </View>
  );
}

function title(action: OperationsAction, copy: Dictionary['agentsPage']['operations']): string {
  return action.kind === 'schedule_interview'
    ? copy.interview(action.payload.candidateName)
    : copy.email[action.payload.purpose](action.payload.candidateName);
}

function iconColor(action: OperationsAction, palette: Palette): string {
  if (action.status === 'succeeded') return palette.emerald;
  if (action.status === 'failed' || action.status === 'ambiguous') return palette.rose;
  return palette.indigo;
}
