import { usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useI18n, type Localized } from '../../i18n';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { MobileDrawer } from './MobileDrawer';
import { NAV_HREFS, navKeyForPath } from './navigation';
import { Sidebar, type NavKey } from './Sidebar';
import { ThemedBackdrop } from './ThemedBackdrop';

/** At this width and above the sidebar is always visible; below it lives in a drawer. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;
const SIDEBAR_WIDTH = 264;
// Placeholder until Supabase Auth provides the signed-in user.
const CURRENT_USER: { name: string; title: Localized } = {
  name: 'Jordan Lee',
  title: { en: 'Head of Talent', vi: 'Trưởng bộ phận Tuyển dụng' },
};

type Shell = {
  isWide: boolean;
  /** Opens the navigation drawer; only set on narrow screens, where the sidebar is hidden. */
  openMenu?: () => void;
};

const ShellContext = createContext<Shell>({ isWide: true });

/** Layout facts every screen needs: how wide the window is and how to open the menu. */
export function useShell(): Shell {
  return useContext(ShellContext);
}

/**
 * The frame around every route: backdrop, the sidebar (or the drawer on narrow screens) and the
 * current screen. It stays mounted while routes change, so the sidebar never flickers.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const pathname = usePathname();
  const router = useRouter();
  const { t, pick } = useI18n();
  const { pipeline, openAlerts, agentsOnline } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The Candidates item leads to the board, so its badge counts the board: the candidates the AI agents
  // put in front of HR. The dashboard's "candidates in pipeline" counts every applicant.
  const onBoard = pipeline?.length ?? 0;

  const navigate = useCallback(
    (key: NavKey) => {
      setDrawerOpen(false);
      router.navigate(NAV_HREFS[key]);
    },
    [router],
  );
  const openMenu = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const shell = useMemo<Shell>(() => ({ isWide, openMenu: isWide ? undefined : openMenu }), [isWide, openMenu]);

  const sidebar = (
    <Sidebar
      activeKey={navKeyForPath(pathname)}
      onNavigate={navigate}
      agentsOnline={agentsOnline}
      user={{ name: CURRENT_USER.name, title: pick(CURRENT_USER.title) }}
      badges={{
        candidates: { count: onBoard, a11yLabel: t.nav.candidatesA11y(onBoard) },
        'self-healing': { count: openAlerts.length, tone: 'alert' },
      }}
    />
  );

  return (
    <ShellContext.Provider value={shell}>
      <View className="flex-1 flex-row bg-slate-50 dark:bg-obsidian">
        <ThemedBackdrop />
        {isWide && <View style={{ width: SIDEBAR_WIDTH }}>{sidebar}</View>}
        <View style={styles.content}>{children}</View>
        {!isWide && (
          <MobileDrawer open={drawerOpen} onClose={closeDrawer}>
            {sidebar}
          </MobileDrawer>
        )}
      </View>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
