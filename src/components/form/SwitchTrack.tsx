import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '../../theme';

const TRACK_WIDTH = 42;
const THUMB_SIZE = 18;
const TRACK_PADDING = 3;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2;
const TOGGLE_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

/** The track and thumb of an on/off switch. It only draws: the pressable around it owns the role and the press. */
export function SwitchTrack({ value }: { value: boolean }) {
  const { palette, isDark } = useAppTheme();
  const progress = useSharedValue(value ? 1 : 0);
  const offColor = isDark ? '#334155' : '#CBD5E1';
  const onColor = palette.indigo;

  useEffect(() => {
    progress.set(withSpring(value ? 1 : 0, TOGGLE_SPRING));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
  }));

  return (
    <Animated.View style={[styles.track, trackStyle]}>
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: THUMB_SIZE + TRACK_PADDING * 2,
    borderRadius: (THUMB_SIZE + TRACK_PADDING * 2) / 2,
    padding: TRACK_PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.3)',
  },
});
