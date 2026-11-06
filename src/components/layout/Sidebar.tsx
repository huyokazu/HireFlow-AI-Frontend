import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n, type Dictionary } from '../../i18n';
import { useAppTheme } from '../../theme';
import { getInitials } from '../../utils/formatters';
import { AnimatedNumber } from '../ui/AnimatedNumber';
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

type NavItem = { key: NavKey; icon: IconName; activeIcon: IconName };

type NavSection = { key: keyof Dictionary['nav']['sections']; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workspace',
    items: [
      { key: 'dashboard', icon: 'grid-outline', activeIcon: 'grid' },
      { key: 'campaigns', icon: 'megaphone-outline', activeIcon: 'megaphone' },
      { key: 'candidates', icon: 'people-outline', activeIcon: 'people' },
    ],
  },
  {
    key: 'aiOperations',
    items: [
      { key: 'agents', icon: 'hardware-chip-outline', activeIcon: 'hardware-chip' },
      { key: 'self-healing', icon: 'pulse-outline', activeIcon: 'pulse' },
      { key: 'digital-twin', icon: 'git-compare-outline', activeIcon: 'git-compare' },
      { key: 'analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
    ],
  },
];

const SETTINGS_ITEM: NavItem = { key: 'settings', icon: 'settings-outline', activeIcon: 'settings' };

export function getNavLabel(key: NavKey, t: Dictionary): string {
  return t.nav.items[key];
}

export type NavBadge = { count: number; tone?: 'neutral' | 'alert' };

type SidebarProps = {
  /** `null` on pages that are not in the navigation, such as "not found". */
  activeKey: NavKey | null;
  onNavigate: (key: NavKey) => void;
  badges?: Partial<Record<NavKey, NavBadge>>;
  agentsOnline: number;
  user: { name: string; title: string };
};

export function Sidebar({ activeKey, onNavigate, badges = {}, agentsOnline, user }: SidebarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { palette } = useAppTheme();

  return (
    <View
      className="flex-1 border-r border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-gray-900/80"
      style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }}
    >
      <View className="px-5">
        <BrandMark />
      </View>

      <ScrollView className="mt-4 flex-1" contentContainerClassName="px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <View key={section.key} className="mt-4">
            <Text className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t.nav.sections[section.key]}
            </Text>
            {section.items.map((item) => (
              <NavRow
                key={item.key}
                item={item}
                label={t.nav.items[item.key]}
                active={item.key === activeKey}
                badge={badges[item.key]}
                onPress={() => onNavigate(item.key)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="gap-1 px-3">
        {/* AI agent status: glows emerald in dark mode so "live" reads at a glance. */}
        {agentsOnline > 0 ? (
          <View
            className="mb-2 flex-row items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-400/25 dark:bg-emerald-500/10"
            style={{ boxShadow: palette.shadow.agentGlow }}
          >
            <View className="h-2.5 w-2.5 items-center justify-center">
              <PulseRing color={palette.emerald} active size={10} />
              <View className="h-2.5 w-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {t.nav.agentsOnline(agentsOnline)}
              </Text>
              <Text className="text-xs text-emerald-700 dark:text-emerald-400/80">
                {t.nav.orchestratorMonitoring}
              </Text>
            </View>
          </View>
        ) : (
          <View className="mb-2 flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-400/25 dark:bg-amber-500/10">
            <Ionicons name="pause-circle" size={16} color={palette.amber} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t.nav.agentsPaused}</Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300/80">{t.nav.resumeInAgents}</Text>
            </View>
          </View>
        )}

        <NavRow
          item={SETTINGS_ITEM}
          label={t.nav.items.settings}
          active={activeKey === 'settings'}
          onPress={() => onNavigate('settings')}
        />

        <View className="mt-2 flex-row items-center gap-3 border-t border-slate-200/70 px-3 pt-4 dark:border-white/10">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-900 dark:bg-indigo-500">
            <Text className="text-xs font-bold text-white">{getInitials(user.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
              {user.name}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
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
  label,
  active,
  badge,
  onPress,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  badge?: NavBadge;
  onPress: () => void;
}) {
  const { isDark, palette } = useAppTheme();
  const isAlert = badge?.tone === 'alert';
  const activeIconColor = isDark ? '#A5B4FC' : '#4338CA';

  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-500/15'
          : 'hover:bg-slate-100 active:bg-slate-100 dark:hover:bg-white/5 dark:active:bg-white/5'
      }`}
    >
      <Ionicons
        name={active ? item.activeIcon : item.icon}
        size={18}
        color={active ? activeIconColor : palette.icon.muted}
      />
      <Text
        className={`flex-1 text-sm ${
          active
            ? 'font-semibold text-indigo-700 dark:text-indigo-200'
            : 'font-medium text-slate-600 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
      {badge && badge.count > 0 && (
        <View
          className={`min-w-5 items-center rounded-full px-1.5 py-0.5 ${
            isAlert ? 'bg-rose-500' : 'bg-slate-100 dark:bg-white/10'
          }`}
        >
          <AnimatedNumber
            value={badge.count}
            countUpOnMount={false}
            className={`text-[11px] font-semibold ${
              isAlert ? 'text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          />
        </View>
      )}
    </Pressable>
  );
}
