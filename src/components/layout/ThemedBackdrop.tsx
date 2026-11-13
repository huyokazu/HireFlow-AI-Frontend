import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DARK_PALETTE, LIGHT_PALETTE, useAppTheme } from '../../theme';

/** Page background. Both gradients stay mounted and cross-fade, since gradients can't tween. */
export function ThemedBackdrop() {
  const { isDark } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const darkness = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    darkness.value = withTiming(isDark ? 1 : 0, { duration: reduceMotion ? 0 : 450 });
  }, [isDark, reduceMotion, darkness]);

  const darkStyle = useAnimatedStyle(() => ({ opacity: darkness.value }));

  return (
    <>
      <LinearGradient
        colors={LIGHT_PALETTE.backdrop}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, darkStyle]}>
        <LinearGradient
          colors={DARK_PALETTE.backdrop}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
}
