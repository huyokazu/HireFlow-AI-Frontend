import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { BrandMark } from '../layout/BrandMark';
import { LanguageToggle } from '../layout/LanguageToggle';
import { ThemeToggle } from '../layout/ThemeToggle';
import { PressableScale } from '../ui/PressableScale';

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  notificationCount: number;
  /** Provided on narrow screens, where the sidebar lives in a drawer behind a menu button. */
  onOpenMenu?: () => void;
  onCreateCampaign: () => void;
};

export function DashboardHeader({
  title,
  subtitle,
  notificationCount,
  onOpenMenu,
  onCreateCampaign,
}: DashboardHeaderProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();

  return (
    <Animated.View entering={FadeInDown.duration(450)} className="gap-5">
      {onOpenMenu && (
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2.5">
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t.header.openMenu}
              onPress={onOpenMenu}
              className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 active:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:active:bg-white/10"
            >
              <Ionicons name="menu" size={20} color={palette.icon.strong} />
            </PressableScale>
            <BrandMark showTagline={false} collapseNameOnPhones />
          </View>
          <View className="flex-row items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <NotificationButton count={notificationCount} />
          </View>
        </View>
      )}

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
          {!onOpenMenu && (
            <>
              <LanguageToggle />
              <ThemeToggle />
              <NotificationButton count={notificationCount} />
            </>
          )}
          <PressableScale
            accessibilityRole="button"
            onPress={onCreateCampaign}
            className="h-11 flex-row items-center gap-1.5 rounded-xl bg-indigo-600 px-4 hover:bg-indigo-700 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            style={{ boxShadow: '0px 8px 20px -8px rgba(79, 70, 229, 0.65)' }}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-white">{t.header.newCampaign}</Text>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
}

function NotificationButton({ count }: { count: number }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? t.header.notificationsUnread(count) : t.header.notifications}
      className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-100 active:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <Ionicons name="notifications-outline" size={20} color={palette.icon.strong} />
      {count > 0 && (
        <View className="absolute right-2 top-2 h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-0.5 dark:border-gray-900">
          <Text className="text-[9px] font-bold text-white">{count}</Text>
        </View>
      )}
    </PressableScale>
  );
}
