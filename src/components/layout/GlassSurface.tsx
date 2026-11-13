import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../theme';

/**
 * Frosted glass behind floating chrome (the phone's top bar and tab bar): the page blurs through a
 * tinted layer. Fill the parent; the parent sets the shape and clips it. Android shows the tint
 * alone, since a real blur there needs the whole page wrapped in a blur target.
 */
export function GlassSurface() {
  const { isDark } = useAppTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      <BlurView intensity={isDark ? 45 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(11, 15, 25, 0.62)' : 'rgba(255, 255, 255, 0.62)' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
});
