import { View } from 'react-native';

type TargetProgressBarProps = {
  /** Percentages, 0–100. */
  value: number;
  target: number;
  /** Fill colour class, e.g. `bg-rose-500`. */
  barClassName: string;
  size?: 'sm' | 'md';
};

/** Progress bar with a vertical marker where the target sits. */
export function TargetProgressBar({ value, target, barClassName, size = 'md' }: TargetProgressBarProps) {
  const trackClassName = size === 'md' ? 'h-2.5' : 'h-2';
  const markerClassName = size === 'md' ? 'h-4' : 'h-3.5';

  return (
    <View
      className={`${trackClassName} justify-center`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
    >
      <View className={`${trackClassName} overflow-hidden rounded-full bg-slate-100`}>
        <View
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${clampPercent(value)}%` }}
        />
      </View>
      <View
        className={`absolute ${markerClassName} w-0.5 rounded-full bg-slate-800`}
        style={{ left: `${clampPercent(target)}%` }}
      />
    </View>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}
