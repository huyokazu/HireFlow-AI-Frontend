import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { getInitials } from '../../utils/formatters';
import { SPRINGS, useFluidSpan, useMicroBounce } from '../ui/motion';
import { PressableScale } from '../ui/PressableScale';
import { RadarPulse } from '../ui/pulse';
import { BrandMark } from './BrandMark';
import { NAV_SECTIONS, SETTINGS_ITEM, type NavBadge, type NavItem, type NavKey } from './Sidebar';

/** Width the rail keeps in the layout; it opens over the page, so the page never reflows. */
export const RAIL_WIDTH = 72;
const ITEM_SIZE = 44;
const ITEM_GAP = 4;
/** Space between the two groups of pages, with a short rule in the middle. */
const SECTION_GAP = 21;

/** Where each list item sits, worked out once: the items are all the same size. */
const ITEM_TOPS: Partial<Record<NavKey, number>> = {};
NAV_SECTIONS.reduce((top, section, sectionIndex) => {
  let y = top + (sectionIndex > 0 ? SECTION_GAP : 0);
  section.items.forEach((item, index) => {
    ITEM_TOPS[item.key] = y;
    y += ITEM_SIZE + (index < section.items.length - 1 ? ITEM_GAP : 0);
  });
  return y;
}, 0);

type TabletRailProps = {
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  activeKey: NavKey | null;
  onNavigate: (key: NavKey) => void;
  badges: Partial<Record<NavKey, NavBadge>>;
  agentsOnline: number;
  user: { name: string; title: string };
  /** The full sidebar, shown once the rail opens. */
  children: ReactNode;
  /** Width of the open rail. */
  expandedWidth: number;
};

/**
 * Tablet navigation: a slim rail of icons that springs open into the full sidebar, over the page,
 * when its menu button is tapped. Tapping the page (or a page in the menu) closes it again.
 */
export function TabletRail({
  expanded,
  onExpand,
  onCollapse,
  activeKey,
  onNavigate,
  badges,
  agentsOnline,
  user,
  children,
  expandedWidth,
}: TabletRailProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    const target = expanded ? 1 : 0;
    progress.set(reduceMotion ? target : withSpring(target, SPRINGS.drawer));
  }, [expanded, reduceMotion, progress]);

  useEffect(() => {
    if (!expanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCollapse();
      return true;
    });
    return () => subscription.remove();
  }, [expanded, onCollapse]);

  const panelStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [RAIL_WIDTH, expandedWidth]),
  }));
  const railStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.25, 0.8], [0, 1], Extrapolation.CLAMP),
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  const activeTop = activeKey ? ITEM_TOPS[activeKey] : undefined;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.scrim, { pointerEvents: expanded ? 'auto' : 'none' }, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.nav.collapse}
          onPress={onCollapse}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        className="border-r border-slate-200/70 dark:border-white/10"
        style={[
          styles.panel,
          { backgroundColor: palette.drawer, boxShadow: '10px 0px 30px -18px rgba(15, 23, 42, 0.45)' },
          panelStyle,
        ]}
      >
        {/* The open sidebar, laid out at full width and uncovered as the panel grows. */}
        <Animated.View
          style={[styles.full, { width: expandedWidth, pointerEvents: expanded ? 'auto' : 'none' }, fullStyle]}
          aria-hidden={!expanded}
        >
          {children}
        </Animated.View>

        <Animated.View
          style={[
            styles.rail,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16, pointerEvents: expanded ? 'none' : 'auto' },
            railStyle,
          ]}
          aria-hidden={expanded}
        >
          <BrandMark markOnly />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t.nav.expand}
            aria-expanded={expanded}
            onPress={onExpand}
            className="mt-3 h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <Ionicons name="chevron-forward" size={18} color={palette.icon.strong} />
          </PressableScale>

          <ScrollView className="mt-4 flex-1 self-stretch" contentContainerClassName="items-center pb-4 pt-2">
            <View>
              {activeTop !== undefined && <RailPill top={activeTop} />}
              {NAV_SECTIONS.map((section, sectionIndex) => (
                <Fragment key={section.key}>
                  {sectionIndex > 0 && (
                    <View className="items-center justify-center" style={{ height: SECTION_GAP }}>
                      <View className="h-px w-5 bg-slate-200 dark:bg-white/10" />
                    </View>
                  )}
                  <View style={{ gap: ITEM_GAP }}>
                    {section.items.map((item) => (
                      <RailItem
                        key={item.key}
                        item={item}
                        label={t.nav.items[item.key]}
                        active={item.key === activeKey}
                        badge={badges[item.key]}
                        onPress={() => onNavigate(item.key)}
                      />
                    ))}
                  </View>
                </Fragment>
              ))}
            </View>
          </ScrollView>

          <View className="items-center gap-2">
            <View
              accessibilityRole="text"
              accessibilityLabel={agentsOnline > 0 ? t.nav.agentsOnline(agentsOnline) : t.nav.agentsPaused}
              className={`h-11 w-11 items-center justify-center rounded-xl border ${
                agentsOnline > 0
                  ? 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-500/10'
                  : 'border-amber-200 bg-amber-50/80 dark:border-amber-400/25 dark:bg-amber-500/10'
              }`}
            >
              {agentsOnline > 0 ? (
                <View className="h-2.5 w-2.5 items-center justify-center">
                  <RadarPulse color={palette.emerald} active size={10} />
                  <View className="h-2.5 w-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </View>
              ) : (
                <Ionicons name="pause-circle" size={16} color={palette.amber} />
              )}
            </View>
            <RailItem
              item={SETTINGS_ITEM}
              label={t.nav.items.settings}
              active={activeKey === 'settings'}
              onPress={() => onNavigate('settings')}
              highlight
            />
            <View
              accessibilityRole="text"
              accessibilityLabel={`${user.name}, ${user.title}`}
              className="mt-1 h-9 w-9 items-center justify-center rounded-full bg-slate-900 dark:bg-indigo-500"
            >
              <Text className="text-xs font-bold text-white">{getInitials(user.name)}</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** The active icon's background: it glides (and stretches) from one icon to the next. */
function RailPill({ top }: { top: number }) {
  const { start, end } = useFluidSpan(top, top + ITEM_SIZE);
  const style = useAnimatedStyle(() => ({ top: start.get(), height: Math.max(0, end.get() - start.get()) }));
  return (
    <Animated.View
      className="absolute left-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/15"
      style={[{ width: ITEM_SIZE, pointerEvents: 'none' }, style]}
    />
  );
}

function RailItem({
  item,
  label,
  active,
  badge,
  onPress,
  highlight = false,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  badge?: NavBadge;
  onPress: () => void;
  /** Draws its own active background, for items outside the list the pill glides through. */
  highlight?: boolean;
}) {
  const { isDark, palette } = useAppTheme();
  const bounce = useMicroBounce(active);
  const showBadge = badge !== undefined && badge.count > 0;
  const isAlert = badge?.tone === 'alert';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={showBadge && badge.a11yLabel ? badge.a11yLabel : label}
      aria-current={active ? 'page' : undefined}
      onPress={onPress}
      pressedScale={0.9}
      hoverScale={1.06}
      className={`items-center justify-center rounded-xl ${
        active && highlight
          ? 'bg-indigo-50 dark:bg-indigo-500/15'
          : active
            ? ''
            : 'hover:bg-slate-100 dark:hover:bg-white/5'
      }`}
      style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
    >
      <Animated.View style={bounce}>
        <Ionicons
          name={active ? item.activeIcon : item.icon}
          size={20}
          color={active ? (isDark ? '#A5B4FC' : '#4338CA') : palette.icon.muted}
        />
      </Animated.View>
      {showBadge && (
        <View
          className={`absolute right-0.5 top-0.5 h-4 min-w-4 items-center justify-center rounded-full border-2 px-0.5 ${
            isAlert
              ? 'border-white bg-rose-500 dark:border-gray-900'
              : 'border-white bg-slate-200 dark:border-gray-900 dark:bg-slate-600'
          }`}
        >
          <Text className={`text-[9px] font-bold ${isAlert ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>
            {badge.count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: RAIL_WIDTH,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  full: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
});
