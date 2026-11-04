import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BrandMark } from '../layout/BrandMark';

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
  return (
    <View className="gap-5">
      {onOpenMenu && (
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              onPress={onOpenMenu}
              className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 active:bg-slate-100"
            >
              <Ionicons name="menu" size={20} color="#334155" />
            </Pressable>
            <BrandMark showTagline={false} />
          </View>
          <NotificationButton count={notificationCount} />
        </View>
      )}

      <View className="flex-row flex-wrap items-end justify-between gap-4">
        <View className="min-w-[240px] flex-1">
          <Text className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</Text>
          <Text className="mt-1 text-sm text-slate-500">{subtitle}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="hidden h-11 w-64 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 md:flex">
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput
              accessibilityLabel="Search"
              placeholder="Search candidates or campaigns"
              placeholderTextColor="#94A3B8"
              className="flex-1 text-sm text-slate-900"
            />
          </View>
          {!onOpenMenu && <NotificationButton count={notificationCount} />}
          <Pressable
            accessibilityRole="button"
            onPress={onCreateCampaign}
            className="h-11 flex-row items-center gap-1.5 rounded-xl bg-indigo-600 px-4 hover:bg-indigo-700 active:bg-indigo-700"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-white">New campaign</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function NotificationButton({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-100 active:bg-slate-100"
    >
      <Ionicons name="notifications-outline" size={20} color="#334155" />
      {count > 0 && (
        <View className="absolute right-2 top-2 h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-0.5">
          <Text className="text-[9px] font-bold text-white">{count}</Text>
        </View>
      )}
    </Pressable>
  );
}
