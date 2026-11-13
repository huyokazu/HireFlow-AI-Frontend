import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { useI18n, type Dictionary } from '../../i18n';
import { disconnectGoogle, fetchGoogleConnection, startGoogleConnect } from '../../services/operations';
import { useRemoteData } from '../../state/useRemoteData';
import { useAppTheme } from '../../theme';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';

type Outcome = keyof Dictionary['settingsPage']['google']['result'];
const OUTCOMES: readonly Outcome[] = ['connected', 'denied', 'missing_scopes', 'account_mismatch', 'error'];

function asOutcome(value: unknown): Outcome | null {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value) ? (value as Outcome) : null;
}

/**
 * Where Google sends the browser back to. Native apps get a deep link into the app (a route that
 * forwards to Settings); the web build comes back to this page and reads `?google=` on load.
 */
function returnAddress(): string {
  return Platform.OS === 'web' ? `${window.location.origin}/settings` : Linking.createURL('integrations/google');
}

/** The Google account the Operations Agent books and emails through, and its Connect flow. */
export function GooglePanel({ notify }: { notify: (message: string) => void }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ google?: string }>();
  const copy = t.settingsPage.google;
  const connection = useRemoteData(fetchGoogleConnection);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const { reload } = connection;

  // Back from Google on web (or forwarded from the native deep link): say how it went, once.
  const returned = asOutcome(params.google);
  useEffect(() => {
    if (!returned) return;
    notify(copy.result[returned]);
    router.setParams({ google: undefined });
    void reload();
  }, [returned, copy, notify, router, reload]);

  const connect = async () => {
    setBusy('connect');
    try {
      const returnTo = returnAddress();
      const url = await startGoogleConnect(returnTo);
      if (Platform.OS === 'web') {
        // A full-page visit: the page reloads on the way back, so there is nothing more to do here.
        window.location.assign(url);
        return;
      }
      // Google refuses sign-in inside web views, so this opens the system browser's auth session.
      const result = await WebBrowser.openAuthSessionAsync(url, returnTo);
      if (result.type === 'success') {
        const outcome = asOutcome(Linking.parse(result.url).queryParams?.google);
        notify(copy.result[outcome ?? 'error']);
      }
      await reload();
    } catch (error) {
      console.warn('[settings] Could not start connecting Google.', error);
      notify(copy.result.error);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      await disconnectGoogle();
      await reload();
    } catch (error) {
      console.warn('[settings] Could not disconnect Google.', error);
      notify(copy.actionFailed);
    } finally {
      setBusy(null);
    }
  };

  const status = connection.data;
  const needsReauth = status?.status === 'needs_reauth';
  const active = Boolean(status?.connected) && !needsReauth;

  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      {!status ? (
        <View className="items-center gap-3 py-6">
          {connection.failed ? (
            <>
              <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{copy.loadError}</Text>
              <Button variant="secondary" icon="refresh" label={t.settingsPage.retry} onPress={() => void reload()} />
            </>
          ) : (
            <ActivityIndicator color={palette.indigo} />
          )}
        </View>
      ) : (
        <View className="gap-4">
          <View className="flex-row items-start gap-3">
            <View
              className={`h-9 w-9 items-center justify-center rounded-full ${
                active ? 'bg-emerald-50 dark:bg-emerald-500/15' : 'bg-amber-50 dark:bg-amber-500/15'
              }`}
            >
              <Ionicons
                name={active ? 'checkmark-circle-outline' : needsReauth ? 'warning-outline' : 'logo-google'}
                size={18}
                color={active ? palette.emerald : palette.amber}
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {needsReauth
                  ? copy.needsReauth
                  : active
                    ? status.email
                      ? copy.connectedAs(status.email)
                      : copy.connected
                    : copy.notConnected}
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400">{copy.mode[status.mode]}</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {!active && (
              <Button
                icon="logo-google"
                label={needsReauth ? copy.reconnect : copy.connect}
                loading={busy === 'connect'}
                disabled={busy !== null}
                onPress={() => void connect()}
              />
            )}
            {(active || needsReauth) && (
              <Button
                variant="secondary"
                icon="unlink-outline"
                label={copy.disconnect}
                loading={busy === 'disconnect'}
                disabled={busy !== null}
                onPress={() => void disconnect()}
              />
            )}
          </View>
        </View>
      )}
    </Panel>
  );
}
