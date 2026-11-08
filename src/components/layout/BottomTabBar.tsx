import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { useFluidSpan, useMicroBounce } from '../ui/motion';
import { PressableScale } from '../ui/PressableScale';
import { GlassSurface } from './GlassSurface';
import type { NavKey } from './Sidebar';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabKey = NavKey | 'more';

type Tab = { key: TabKey; icon: IconName; activeIcon: IconName };

/** The pages a recruiter opens most; the rest sit behind More, in the slide-in menu. */
const TABS: readonly Tab[] = [
  { key: 'dashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'campaigns', icon: 'megaphone-outline', activeIcon: 'megaphone' },
  { key: 'candidates', icon: 'people-outline', activeIcon: 'people' },
  { key: 'self-healing', icon: 'pulse-outline', activeIcon: 'pulse' },
  { key: 'more', icon: 'ellipsis-horizontal-circle-outline', activeIcon: 'ellipsis-horizontal-circle' },
];
const MORE_INDEX = TABS.length - 1;

export const BOTTOM_BAR_HEIGHT = 64;
/** Gap between the floating bar and the bottom of the screen (above the home indicator). */
export const BOTTOM_BAR_MARGIN = 12;
const BAR_SIDE = 16;
const BAR_MAX_WIDTH = 480;
const BAR_PADDING = 6;
const DOT_SIZE = 5;

type BottomTabBarProps = {
  /** `null` on pages that are not in the navigation, such as "not found". */
  activeKey: NavKey | null;
  onNavigate: (key: NavKey) => void;
  /** Opens the menu with every page. */
  onMore: () => void;
  /** Open Self-Healing alerts, shown on that tab. */
  alertCount: number;
};

/**
 * Phone navigation: a floating bar of frosted glass with the main pages. A dot glides (and
 * stretches) to the active tab, whose icon pops as it lands.
 */
export function BottomTabBar({ activeKey, onNavigate, onMore, alertCount }: BottomTabBarProps) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barWidth = Math.min(width - BAR_SIDE * 2, BAR_MAX_WIDTH);
  const tabWidth = (barWidth - BAR_PADDING * 2) / TABS.length;

  const directIndex = TABS.findIndex((tab) => tab.key === activeKey);
  // Pages without a tab of their own (AI Agents, Digital Twin…) light up More.
  const activeIndex = directIndex >= 0 ? directIndex : activeKey ? MORE_INDEX : -1;
  const dotCenter = BAR_PADDING + tabWidth * (Math.max(activeIndex, 0) + 0.5);
  const dot = useFluidSpan(dotCenter - DOT_SIZE / 2, dotCenter + DOT_SIZE / 2);
  const dotPresence = useSharedValue(activeIndex >= 0 ? 1 : 0);

  useEffect(() => {
    dotPresence.set(withTiming(activeIndex >= 0 ? 1 : 0, { duration: 180 }));
  }, [activeIndex, dotPresence]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotPresence.get(),
    left: dot.start.get(),
    width: Math.max(DOT_SIZE, dot.end.get() - dot.start.get()),
  }));

  return (
    <View style={[styles.host, { bottom: insets.bottom + BOTTOM_BAR_MARGIN }]}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t.nav.tabsLabel}
        className="flex-row overflow-hidden rounded-[26px] border border-white/80 dark:border-white/10"
        style={{
          width: barWidth,
          height: BOTTOM_BAR_HEIGHT,
          paddingHorizontal: BAR_PADDING,
          boxShadow: '0px 18px 40px -16px rgba(15, 23, 42, 0.45)',
        }}
      >
        <GlassSurface />
        {TABS.map((tab, index) => (
          <TabButton
            key={tab.key}
            tab={tab}
            label={tab.key === 'more' ? t.nav.more : t.nav.items[tab.key]}
            accessibilityLabel={tab.key === 'more' ? t.nav.moreA11y : undefined}
            active={index === activeIndex}
            badge={tab.key === 'self-healing' ? alertCount : 0}
            onPress={() => (tab.key === 'more' ? onMore() : onNavigate(tab.key))}
          />
        ))}
        <Animated.View className="bg-indigo-600 dark:bg-indigo-400" style={[styles.dot, dotStyle]} />
      </View>
    </View>
  );
}

function TabButton({
  tab,
  label,
  accessibilityLabel,
  active,
  badge,
  onPress,
}: {
  tab: Tab;
  label: string;
  accessibilityLabel?: string;
  active: boolean;
  badge: number;
  onPress: () => void;
}) {
  const { isDark, palette } = useAppTheme();
  const bounce = useMicroBounce(active);
  const activeColor = isDark ? '#A5B4FC' : '#4F46E5';

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-selected={active}
      onPress={onPress}
      pressedScale={0.88}
      hoverScale={1.04}
      className="flex-1 items-center justify-center gap-0.5 pb-1.5"
    >
      <Animated.View style={bounce}>
        <Ionicons name={active ? tab.activeIcon : tab.icon} size={21} color={active ? activeColor : palette.icon.muted} />
        {badge > 0 && (
          <View className="absolute -right-2.5 -top-1.5 h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-0.5 dark:border-gray-900">
            <Text className="text-[9px] font-bold text-white">{badge}</Text>
          </View>
        )}
      </Animated.View>
      <Text
        className={`text-[10px] ${
          active ? 'font-bold text-indigo-700 dark:text-indigo-200' : 'font-medium text-slate-500 dark:text-slate-400'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
    pointerEvents: 'box-none',
  },
  dot: {
    position: 'absolute',
    bottom: 6,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    pointerEvents: 'none',
  },
});
