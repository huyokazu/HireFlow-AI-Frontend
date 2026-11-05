import '../../global.css';
import '../theme/interop';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from '../components/layout/AppShell';
import { LanguageProvider } from '../i18n';
import { WorkspaceProvider } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

/**
 * Root layout: app-wide providers, then the shell (sidebar, backdrop) around the current route.
 * `Slot` keeps a stack history, so the Android back button and browser back both step back
 * through visited screens.
 */
export default function RootLayout() {
  useEffect(() => {
    // Dark mode follows a class on web, so start from the OS preference explicitly.
    if (Platform.OS === 'web') {
      colorScheme.set(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <WorkspaceProvider>
            <AppShell>
              <Slot />
            </AppShell>
            <ThemedStatusBar />
          </WorkspaceProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
