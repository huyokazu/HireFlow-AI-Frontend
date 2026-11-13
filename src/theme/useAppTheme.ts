import { useColorScheme } from 'nativewind';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { DARK_PALETTE, LIGHT_PALETTE, type Palette } from './palette';

export type AppTheme = {
  isDark: boolean;
  palette: Palette;
  toggleTheme: () => void;
};

const TRANSITION_CLASS = 'theme-transition';
const TRANSITION_MS = 400;
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * On web, colours fade between themes. The transition is switched on only for the moment of
 * the switch so it never slows down hover states or fights Reanimated.
 */
function startWebThemeTransition() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.getElementById('theme-transition-style')) {
    const style = document.createElement('style');
    style.id = 'theme-transition-style';
    style.textContent = `html.${TRANSITION_CLASS} *, html.${TRANSITION_CLASS} *::placeholder {
  transition: background-color ${TRANSITION_MS}ms ease, border-color ${TRANSITION_MS}ms ease,
    color ${TRANSITION_MS}ms ease, box-shadow ${TRANSITION_MS}ms ease !important;
}`;
    document.head.appendChild(style);
  }
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS + 50);
}

/** Current theme plus raw colours for icons, gradients and shadows. */
export function useAppTheme(): AppTheme {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const toggleTheme = useCallback(() => {
    startWebThemeTransition();
    setColorScheme(isDark ? 'light' : 'dark');
  }, [isDark, setColorScheme]);

  return { isDark, palette: isDark ? DARK_PALETTE : LIGHT_PALETTE, toggleTheme };
}
