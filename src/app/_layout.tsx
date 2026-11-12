import '../../global.css';
import '../theme/interop';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LanguageProvider } from '../i18n';
import { registerApiRemote } from '../lib/api';
import { AuthProvider } from '../state/AuthProvider';
import { useAppTheme } from '../theme';

// With a backend configured, the services read from the API from the first request on.
registerApiRemote();

/**
 * Root layout: app-wide providers around the current route. Signed-in pages get the workspace and
 * the shell (sidebar, backdrop) from the `(app)` group's layout; the sign-in page stands alone.
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
          <AuthProvider>
            <Slot />
            <ThemedStatusBar />
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
