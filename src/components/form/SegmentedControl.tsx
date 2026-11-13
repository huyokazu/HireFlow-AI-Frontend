import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useAppTheme } from '../../theme';
import { useFluidSpan, useMicroBounce } from '../ui/motion';
import { PressableScale } from '../ui/PressableScale';

const TRACK_PADDING = 4;

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor: (value: T) => string;
  accessibilityLabel: string;
};

/** Pick-one control for a few short options; the highlight glides (and stretches) to the chosen one. */
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
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;
  const { start, end } = useFluidSpan(selectedIndex * segmentWidth, (selectedIndex + 1) * segmentWidth);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: TRACK_PADDING + start.get(),
    width: end.get() - start.get(),
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
      {options.map((option) => (
        <Segment
          key={option}
          label={labelFor(option)}
          selected={option === value}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const bounce = useMicroBounce(selected);
  return (
    <PressableScale
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={onPress}
      pressedScale={0.92}
      hoverScale={1.03}
      className="h-9 flex-1 items-center justify-center px-2"
    >
      <Animated.Text
        className={`text-sm font-semibold ${
          selected ? 'text-indigo-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'
        }`}
        style={bounce}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
  },
});
