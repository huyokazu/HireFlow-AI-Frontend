import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';
import { WorkspaceProvider } from '../../state/WorkspaceProvider';
import { useAppTheme } from '../../theme';
import { AppShell } from './AppShell';
import { ThemedBackdrop } from './ThemedBackdrop';

/**
 * Everything a signed-in page sits in: the workspace data and the shell. With a backend it first
 * waits for the saved session, and sends anyone signed out to the sign-in page. In mock mode there
 * is no sign-in, so it goes straight to the workspace.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <SessionSplash />;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}

function SessionSplash() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-slate-50 dark:bg-obsidian">
      <ThemedBackdrop />
      <ActivityIndicator color={palette.indigo} />
      <Text className="text-sm text-slate-500 dark:text-slate-400">{t.auth.loading}</Text>
    </View>
  );
}
