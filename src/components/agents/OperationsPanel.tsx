import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { subscribeToWorkspace } from '../../lib/realtime';
import {
  approveOperationsAction,
  fetchOperationsActions,
  rejectOperationsAction,
  retryOperationsAction,
  type OperationsAction,
} from '../../services/operations';
import { useRemoteData } from '../../state/useRemoteData';
import { useAppTheme } from '../../theme';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { OperationsActionRow, type ActionCommand } from './OperationsActionRow';

const LIST_LIMIT = 20;
/** Status changes often come in bursts (approved → executing → succeeded); one reload covers them. */
const REFRESH_DEBOUNCE_MS = 400;

const COMMANDS: Record<ActionCommand, (actionId: string) => Promise<OperationsAction>> = {
  approve: approveOperationsAction,
  reject: rejectOperationsAction,
  retry: retryOperationsAction,
};

const loadActions = () => fetchOperationsActions(LIST_LIMIT);

type OperationsPanelProps = {
  /** The API workspace; `null` when the app fell back to mock data and there is nothing live to show. */
  workspaceId: string | null;
  now: number;
};

/** The Operations Agent's recent interviews and emails, with HR's approvals, live over Realtime. */
export function OperationsPanel({ workspaceId, now }: OperationsPanelProps) {
  const { t } = useI18n();
  const copy = t.agentsPage.operations;
  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      {workspaceId ? (
        <ActionList workspaceId={workspaceId} now={now} />
      ) : (
        <Text className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{copy.offline}</Text>
      )}
    </Panel>
  );
}

function ActionList({ workspaceId, now }: { workspaceId: string; now: number }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const copy = t.agentsPage.operations;
  const actions = useRemoteData(loadActions);
  const [pending, setPending] = useState<{ id: string; command: ActionCommand } | null>(null);
  const [commandFailed, setCommandFailed] = useState(false);
  const { reload, setData } = actions;

  // Realtime says which action changed; the list is fetched again for the full, current rows.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToWorkspace(workspaceId, {
      onActionUpdated: () => {
        clearTimeout(timer);
        timer = setTimeout(() => void reload(), REFRESH_DEBOUNCE_MS);
      },
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [workspaceId, reload]);

  const runCommand = useCallback(
    async (action: OperationsAction, command: ActionCommand) => {
      setPending({ id: action.id, command });
      setCommandFailed(false);
      try {
        const updated = await COMMANDS[command](action.id);
        setData((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      } catch (error) {
        console.warn(`[operations] Could not ${command} the action.`, error);
        setCommandFailed(true);
      } finally {
        setPending(null);
      }
    },
    [setData],
  );

  const list = actions.data;
  if (!list) {
    return actions.failed ? (
      <View className="items-center gap-3 py-6">
        <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{copy.loadError}</Text>
        <Button variant="secondary" icon="refresh" label={copy.tryAgain} onPress={() => void reload()} />
      </View>
    ) : (
      <ActivityIndicator className="py-6" color={palette.indigo} />
    );
  }

  const needsReconnect = list.some((action) => action.status === 'blocked_reauth');

  return (
    <View>
      {needsReconnect && (
        <View className="mb-3 flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-400/25 dark:bg-amber-500/10">
          <Ionicons name="warning-outline" size={18} color={palette.amber} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-amber-900 dark:text-amber-200">{copy.reconnectTitle}</Text>
            <Text className="text-xs text-amber-800 dark:text-amber-300">{copy.reconnectBody}</Text>
          </View>
          <Button variant="secondary" icon="logo-google" label={copy.reconnect} onPress={() => router.navigate('/settings')} />
        </View>
      )}
      {commandFailed && (
        <Text accessibilityLiveRegion="polite" className="mb-2 text-sm text-rose-600 dark:text-rose-400">
          {copy.actionFailed}
        </Text>
      )}
      {list.length === 0 ? (
        <Text className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{copy.empty}</Text>
      ) : (
        list.map((action, index) => (
          <OperationsActionRow
            key={action.id}
            action={action}
            divider={index > 0}
            now={now}
            pending={pending?.id === action.id ? pending.command : null}
            onCommand={(item, command) => void runCommand(item, command)}
          />
        ))
      )}
    </View>
  );
}
