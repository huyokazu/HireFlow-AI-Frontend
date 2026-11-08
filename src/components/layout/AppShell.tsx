import { usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n, type Localized } from '../../i18n';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { BREAKPOINTS } from '../ui/motion';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MARGIN, BottomTabBar } from './BottomTabBar';
import { MobileDrawer } from './MobileDrawer';
import { MobileTopBar, TOP_BAR_HEIGHT } from './MobileTopBar';
import { NAV_HREFS, navKeyForPath } from './navigation';
import { Sidebar, type NavKey } from './Sidebar';
import { RAIL_WIDTH, TabletRail } from './TabletRail';
import { ThemedBackdrop } from './ThemedBackdrop';

const SIDEBAR_WIDTH = 264;
/** Widest the page column grows (see `ScreenContainer`). */
const MAX_CONTENT_WIDTH = 1280;
// Placeholder until Supabase Auth provides the signed-in user.
const CURRENT_USER: { name: string; title: Localized } = {
  name: 'Jordan Lee',
  title: { en: 'Head of Talent', vi: 'Trưởng bộ phận Tuyển dụng' },
};

/** Phone below 768 px, tablet up to 1024 px, desktop from there. */
export type Device = 'phone' | 'tablet' | 'desktop';

export function deviceForWidth(width: number): Device {
  if (width < BREAKPOINTS.tablet) return 'phone';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  return 'desktop';
}

/** Room a page keeps clear around its content, for the app's floating bars and the safe area. */
type PagePadding = { top: number; bottom: number; horizontal: number };

type Shell = {
  device: Device;
  /** Desktop: the full sidebar is always visible. */
  isWide: boolean;
  /** Width of the page column, after the navigation and the page's side padding. */
  contentWidth: number;
  pagePadding: PagePadding;
  /** Distance from the bottom of the screen for things that float over the page, such as toasts. */
  overlayBottom: number;
  /** Opens the menu with every page; only set on phones. */
  openMenu?: () => void;
};

const ShellContext = createContext<Shell>({
  device: 'desktop',
  isWide: true,
  contentWidth: 960,
  pagePadding: { top: 24, bottom: 48, horizontal: 32 },
  overlayBottom: 20,
});

/** Layout facts every screen needs: the kind of device, the room for content, and the chrome to avoid. */
export function useShell(): Shell {
  return useContext(ShellContext);
}

/**
 * The frame around every route. Phones get a sticky top bar and a floating tab bar (the rest of
 * the pages in a slide-in menu), tablets an icon rail that springs open into the sidebar, and
 * desktops the full sidebar. It stays mounted while routes change, so the navigation never flickers.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const safeArea = useSafeAreaInsets();
  const device = deviceForWidth(width);
  const pathname = usePathname();
  const router = useRouter();
  const { t, pick } = useI18n();
  const { pipeline, openAlerts, agentsOnline } = useWorkspace();
  // Which layout's menu is open. Menus belong to one layout, so rotating a tablet or resizing a
  // window past a breakpoint leaves the other layout's menu closed.
  const [menuOpenOn, setMenuOpenOn] = useState<Device | null>(null);
  const drawerOpen = menuOpenOn === 'phone' && device === 'phone';
  const railOpen = menuOpenOn === 'tablet' && device === 'tablet';
  // The Candidates item leads to the board, so its badge counts the board: the candidates the AI agents
  // put in front of HR. The dashboard's "candidates in pipeline" counts every applicant.
  const onBoard = pipeline?.length ?? 0;
  const activeKey = navKeyForPath(pathname);

  const navigate = useCallback(
    (key: NavKey) => {
      setMenuOpenOn(null);
      router.navigate(NAV_HREFS[key]);
    },
    [router],
  );
  const openMenu = useCallback(() => setMenuOpenOn('phone'), []);
  const expandRail = useCallback(() => setMenuOpenOn('tablet'), []);
  const closeMenus = useCallback(() => setMenuOpenOn(null), []);

  const navWidth = device === 'desktop' ? SIDEBAR_WIDTH : device === 'tablet' ? RAIL_WIDTH : 0;
  const horizontal = device === 'desktop' ? 32 : device === 'tablet' ? 24 : 16;
  const shell = useMemo<Shell>(
    () => ({
      device,
      isWide: device === 'desktop',
      contentWidth: Math.min(MAX_CONTENT_WIDTH, width - navWidth - horizontal * 2),
      pagePadding:
        device === 'phone'
          ? {
              top: safeArea.top + TOP_BAR_HEIGHT + 16,
              // Clear of the floating tab bar, with room to spare.
              bottom: safeArea.bottom + BOTTOM_BAR_MARGIN + BOTTOM_BAR_HEIGHT + 24,
              horizontal,
            }
          : { top: safeArea.top + 24, bottom: safeArea.bottom + 48, horizontal },
      overlayBottom:
        device === 'phone' ? safeArea.bottom + BOTTOM_BAR_MARGIN + BOTTOM_BAR_HEIGHT + 12 : safeArea.bottom + 20,
      openMenu: device === 'phone' ? openMenu : undefined,
    }),
    [device, width, navWidth, horizontal, safeArea.top, safeArea.bottom, openMenu],
  );

  const sidebarProps = {
    activeKey,
    onNavigate: navigate,
    agentsOnline,
    user: { name: CURRENT_USER.name, title: pick(CURRENT_USER.title) },
    badges: {
      candidates: { count: onBoard, a11yLabel: t.nav.candidatesA11y(onBoard) },
      'self-healing': { count: openAlerts.length, tone: 'alert' as const },
    },
  };

  return (
    <ShellContext.Provider value={shell}>
      <View className="flex-1 flex-row bg-slate-50 dark:bg-obsidian">
        <ThemedBackdrop />
        {device === 'desktop' && (
          <View style={{ width: SIDEBAR_WIDTH }}>
            <Sidebar {...sidebarProps} />
          </View>
        )}
        {/* The rail draws over the page from its own layer; this keeps its room in the layout. */}
        {device === 'tablet' && <View style={{ width: RAIL_WIDTH }} />}
        <View style={styles.content}>{children}</View>

        {device === 'tablet' && (
          <TabletRail
            {...sidebarProps}
            expanded={railOpen}
            onExpand={expandRail}
            onCollapse={closeMenus}
            expandedWidth={SIDEBAR_WIDTH}
          >
            <Sidebar {...sidebarProps} onCollapse={closeMenus} />
          </TabletRail>
        )}
        {device === 'phone' && (
          <>
            <MobileTopBar />
            <BottomTabBar
              activeKey={activeKey}
              onNavigate={navigate}
              onMore={openMenu}
              alertCount={openAlerts.length}
            />
            <MobileDrawer open={drawerOpen} onClose={closeMenus}>
              <Sidebar {...sidebarProps} />
            </MobileDrawer>
          </>
        )}
      </View>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
