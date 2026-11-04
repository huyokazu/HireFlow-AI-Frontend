import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getInitials } from '../../utils/formatters';
import { PulseRing } from '../ui/pulse';
import { BrandMark } from './BrandMark';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type NavKey =
  | 'dashboard'
  | 'campaigns'
  | 'candidates'
  | 'agents'
  | 'self-healing'
  | 'digital-twin'
  | 'analytics'
  | 'settings';

type NavItem = { key: NavKey; label: string; icon: IconName; activeIcon: IconName };

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
      { key: 'campaigns', label: 'Campaigns', icon: 'megaphone-outline', activeIcon: 'megaphone' },
      { key: 'candidates', label: 'Candidates', icon: 'people-outline', activeIcon: 'people' },
    ],
  },
  {
    title: 'AI operations',
    items: [
      { key: 'agents', label: 'AI Agents', icon: 'hardware-chip-outline', activeIcon: 'hardware-chip' },
      { key: 'self-healing', label: 'Self-Healing', icon: 'pulse-outline', activeIcon: 'pulse' },
      { key: 'digital-twin', label: 'Digital Twin', icon: 'git-compare-outline', activeIcon: 'git-compare' },
      { key: 'analytics', label: 'Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
    ],
  },
];

const SETTINGS_ITEM: NavItem = {
  key: 'settings',
  label: 'Settings',
  icon: 'settings-outline',
  activeIcon: 'settings',
};

export function getNavLabel(key: NavKey): string {
  const item = [...NAV_SECTIONS.flatMap((section) => section.items), SETTINGS_ITEM].find(
    (navItem) => navItem.key === key,
  );
  return item?.label ?? '';
}

export type NavBadge = { count: number; tone?: 'neutral' | 'alert' };

type SidebarProps = {
  activeKey: NavKey;
  onNavigate: (key: NavKey) => void;
  badges?: Partial<Record<NavKey, NavBadge>>;
  agentsOnline: number;
  user: { name: string; title: string };
};

export function Sidebar({ activeKey, onNavigate, badges = {}, agentsOnline, user }: SidebarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 border-r border-slate-200/70 bg-white/80"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }}
    >
      <View className="px-5">
        <BrandMark />
      </View>

      <ScrollView className="mt-4 flex-1" contentContainerClassName="px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <View key={section.title} className="mt-4">
            <Text className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </Text>
            {section.items.map((item) => (
              <NavRow
                key={item.key}
                item={item}
                active={item.key === activeKey}
                badge={badges[item.key]}
                onPress={() => onNavigate(item.key)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="gap-1 px-3">
        <View className="mb-2 flex-row items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
          <View className="h-2.5 w-2.5 items-center justify-center">
            <PulseRing color="#10B981" active size={10} />
            <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-emerald-900">
              {agentsOnline} AI agents online
            </Text>
            <Text className="text-xs text-emerald-700">Orchestrator is monitoring</Text>
          </View>
        </View>

        <NavRow
          item={SETTINGS_ITEM}
          active={activeKey === 'settings'}
          onPress={() => onNavigate('settings')}
        />

        <View className="mt-2 flex-row items-center gap-3 border-t border-slate-200/70 px-3 pt-4">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-900">
            <Text className="text-xs font-bold text-white">{getInitials(user.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
              {user.name}
            </Text>
            <Text className="text-xs text-slate-500" numberOfLines={1}>
              {user.title}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function NavRow({
  item,
  active,
  badge,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  badge?: NavBadge;
  onPress: () => void;
}) {
  const isAlert = badge?.tone === 'alert';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${
        active ? 'bg-indigo-50' : 'hover:bg-slate-100 active:bg-slate-100'
      }`}
    >
      <Ionicons
        name={active ? item.activeIcon : item.icon}
        size={18}
        color={active ? '#4338CA' : '#64748B'}
      />
      <Text
        className={`flex-1 text-sm ${active ? 'font-semibold text-indigo-700' : 'font-medium text-slate-600'}`}
      >
        {item.label}
      </Text>
      {badge && badge.count > 0 && (
        <View
          className={`min-w-5 items-center rounded-full px-1.5 py-0.5 ${isAlert ? 'bg-rose-500' : 'bg-slate-100'}`}
        >
          <Text className={`text-[11px] font-semibold ${isAlert ? 'text-white' : 'text-slate-600'}`}>
            {badge.count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
