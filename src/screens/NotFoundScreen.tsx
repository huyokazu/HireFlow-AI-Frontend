import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { PressableScale } from '../components/ui/PressableScale';
import { useI18n } from '../i18n';
import { useAppTheme } from '../theme';

export function NotFoundScreen() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();

  return (
    <ScreenContainer>
      <AppHeader title={t.notFound.title} subtitle={t.notFound.body} />
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="mt-6 items-center rounded-3xl border border-dashed border-slate-300 px-6 py-16 dark:border-white/15"
      >
        <Ionicons name="compass-outline" size={32} color={palette.icon.faint} />
        <Text className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">{t.notFound.body}</Text>
        <PressableScale
          accessibilityRole="link"
          onPress={() => router.replace('/')}
          className="mt-5 h-11 flex-row items-center gap-1.5 rounded-xl bg-indigo-600 px-4 hover:bg-indigo-700 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
          <Text className="text-sm font-semibold text-white">{t.notFound.backHome}</Text>
        </PressableScale>
      </Animated.View>
    </ScreenContainer>
  );
}
