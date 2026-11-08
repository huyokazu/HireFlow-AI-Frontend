import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';
import { useShell } from './AppShell';
import { LanguageToggle } from './LanguageToggle';
import { NotificationButton } from './NotificationButton';
import { ThemeToggle } from './ThemeToggle';

type AppHeaderProps = {
  title: string;
  subtitle: string;
  /** The "New campaign" button; hidden on the campaign wizard itself. */
  showNewCampaign?: boolean;
};

/**
 * Page title plus the app-wide controls: search, language, theme, notifications, new campaign.
 * On phones the language, theme and notification controls live in the sticky top bar instead.
 */
export function AppHeader({ title, subtitle, showNewCampaign = true }: AppHeaderProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const { device } = useShell();
  const router = useRouter();
  const isPhone = device === 'phone';

  return (
    <Animated.View entering={FadeInDown.duration(450)}>
      <View className="flex-row flex-wrap items-end justify-between gap-4">
        <View className="min-w-[240px] flex-1">
          <Text className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">{title}</Text>
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-2">
          <View className="hidden h-11 w-64 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 dark:border-white/15 dark:bg-white/5 md:flex">
            <Ionicons name="search" size={16} color={palette.icon.faint} />
            <TextInput
              accessibilityLabel={t.header.search}
              placeholder={t.header.searchPlaceholder}
              placeholderTextColor={palette.placeholder}
              className="flex-1 text-sm text-slate-900 dark:text-slate-100"
            />
          </View>
          {!isPhone && (
            <>
              <LanguageToggle />
              <ThemeToggle />
              <NotificationButton />
            </>
          )}
          {showNewCampaign && (
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.navigate('/campaigns/new')}
              glowColor="rgba(79, 70, 229, 0.75)"
              className="h-11 flex-row items-center gap-1.5 rounded-xl bg-indigo-600 px-4 hover:bg-indigo-700 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              style={{ boxShadow: '0px 8px 20px -8px rgba(79, 70, 229, 0.65)' }}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text className="text-sm font-semibold text-white">{t.header.newCampaign}</Text>
            </PressableScale>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
