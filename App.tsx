import './global.css';
import './src/theme/interop';

import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LanguageProvider } from './src/i18n';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { useAppTheme } from './src/theme';

export default function App() {
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
          <DashboardScreen />
          <ThemedStatusBar />
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
