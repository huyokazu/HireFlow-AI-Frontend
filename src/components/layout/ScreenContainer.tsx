import type { ComponentRef, ReactNode, Ref } from 'react';
import { StyleSheet, View, type ScrollView as RNScrollView } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useShell } from './AppShell';

export type ScreenScrollView = ComponentRef<typeof RNScrollView>;

type ScreenContainerProps = {
  /** Lets the page use more of a large monitor, for content that gains from width (the board). */
  wide?: boolean;
  /** For screens that scroll themselves, e.g. back to the top when a wizard moves to its next step. */
  scrollRef?: Ref<ScreenScrollView>;
  children: ReactNode;
};

/** Scrolling page body with the app's standard padding and a centred max-width column. */
export function ScreenContainer({ wide = false, scrollRef, children }: ScreenContainerProps) {
  const { pagePadding } = useShell();
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      // Phones leave room for the sticky top bar and the floating tab bar.
      contentContainerStyle={{
        paddingTop: pagePadding.top,
        paddingBottom: pagePadding.bottom,
        paddingHorizontal: pagePadding.horizontal,
      }}
    >
      <View className={`w-full self-center ${wide ? 'max-w-[1680px]' : 'max-w-[1280px]'}`}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
