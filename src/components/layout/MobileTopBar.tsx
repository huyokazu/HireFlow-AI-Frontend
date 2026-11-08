import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { GlassSurface } from './GlassSurface';
import { LanguageToggle } from './LanguageToggle';
import { NotificationButton } from './NotificationButton';
import { ThemeToggle } from './ThemeToggle';

/** Height of the bar below the status bar; pages leave this much room at the top. */
export const TOP_BAR_HEIGHT = 60;

/**
 * Phone header that stays put while the page scrolls under it: the logo, then the language,
 * theme and notification controls on frosted glass.
 */
export function MobileTopBar() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="border-b border-slate-200/70 dark:border-white/10"
      style={[styles.bar, { paddingTop: insets.top }]}
    >
      <GlassSurface />
      <View className="flex-row items-center justify-between gap-2 px-4" style={{ height: TOP_BAR_HEIGHT }}>
        <BrandMark showTagline={false} collapseNameOnPhones />
        <View className="flex-row items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <NotificationButton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    overflow: 'hidden',
  },
});
