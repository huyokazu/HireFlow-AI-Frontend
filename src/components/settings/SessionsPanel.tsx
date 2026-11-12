import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { fetchSessions, revokeSession, type UserSession } from '../../services/account';
import { useRemoteData } from '../../state/useRemoteData';
import { useAppTheme } from '../../theme';
import { formatRelativeTime } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';

/** Every device the user is signed in on, this one marked; any other can be signed out. */
export function SessionsPanel({ notify }: { notify: (message: string) => void }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.settingsPage.sessions;
  const sessions = useRemoteData(fetchSessions);
  const [revoking, setRevoking] = useState<string | null>(null);

  const revoke = async (session: UserSession) => {
    setRevoking(session.id);
    try {
      await revokeSession(session.id);
      // Gone either way: revoked now, or it had already ended.
      sessions.setData((current) => current?.filter((item) => item.id !== session.id) ?? null);
    } catch (error) {
      console.warn('[settings] Could not revoke the session.', error);
      notify(copy.revokeFailed);
    } finally {
      setRevoking(null);
    }
  };

  const list = sessions.data;

  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      {!list ? (
        <View className="items-center gap-3 py-6">
          {sessions.failed ? (
            <>
              <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{copy.loadError}</Text>
              <Button
                variant="secondary"
                icon="refresh"
                label={t.settingsPage.retry}
                onPress={() => void sessions.reload()}
              />
            </>
          ) : (
            <ActivityIndicator color={palette.indigo} />
          )}
        </View>
      ) : (
        <View>
          {[...list]
            .sort((a, b) => Number(b.current) - Number(a.current))
            .map((session, index) => {
              const device = deviceName(session.userAgent) ?? copy.unknownDevice;
              return (
                <View
                  key={session.id}
                  className={`flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-slate-100 dark:border-white/10' : ''}`}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/15">
                    <Ionicons name={deviceIcon(session.userAgent)} size={17} color={palette.indigo} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-sm font-semibold text-slate-900 dark:text-slate-50">{device}</Text>
                      {session.current && (
                        <View className="rounded-md bg-emerald-50 px-1.5 py-0.5 dark:bg-emerald-500/15">
                          <Text className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {copy.current}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      {[copy.lastActive(formatRelativeTime(session.refreshedAt ?? session.createdAt, t.time)), session.ip]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {/* This device signs out with the Account buttons below, which also clear it locally. */}
                  {!session.current && (
                    <Button
                      variant="ghost"
                      label={copy.revoke}
                      accessibilityLabel={copy.revokeA11y(device)}
                      loading={revoking === session.id}
                      disabled={revoking !== null}
                      onPress={() => void revoke(session)}
                    />
                  )}
                </View>
              );
            })}
        </View>
      )}
    </Panel>
  );
}

/** "Chrome · Windows" from a user agent; `null` when it says nothing useful. */
function deviceName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const os = /iPhone|iPad|iOS/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  const client = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : /okhttp|CFNetwork|Darwin|Expo/.test(userAgent)
            ? 'HireFlow'
            : null;
  return [client, os].filter(Boolean).join(' · ') || null;
}

function deviceIcon(userAgent: string | null) {
  return userAgent && /iPhone|Android|iOS|Mobile/.test(userAgent)
    ? ('phone-portrait-outline' as const)
    : ('desktop-outline' as const);
}
