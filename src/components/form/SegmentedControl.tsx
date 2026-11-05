import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '../../theme';

const TRACK_PADDING = 4;
const SLIDE_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor: (value: T) => string;
  accessibilityLabel: string;
};

/** Pick-one control for a few short options; the highlight slides to the chosen one. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelFor,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { palette } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const position = useSharedValue(selectedIndex);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  useEffect(() => {
    position.set(withSpring(selectedIndex, SLIDE_SPRING));
  }, [selectedIndex, position]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: position.get() * segmentWidth }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      className="flex-row rounded-xl bg-slate-100 p-1 dark:bg-white/5"
    >
      {segmentWidth > 0 && (
        <Animated.View
          className="rounded-lg bg-white dark:bg-indigo-500"
          style={[styles.indicator, { boxShadow: palette.shadow.stat }, indicatorStyle]}
        />
      )}
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            aria-checked={selected}
            onPress={() => onChange(option)}
            className="h-9 flex-1 items-center justify-center px-2"
          >
            <Text
              className={`text-sm font-semibold ${
                selected ? 'text-indigo-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
              numberOfLines={1}
            >
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
  },
});
