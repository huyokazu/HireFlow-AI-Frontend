import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { SALARY_LIMITS } from '../../services/campaigns';
import { NumberStepper } from '../form/NumberStepper';

const BAND_SPRING = { damping: 20, stiffness: 180, mass: 0.8 };

type SalaryBandFieldProps = {
  min: number;
  max: number;
  /** Market median for the role, in thousands per year; drawn in the middle of the scale. */
  marketMedian: number;
  onChange: (patch: { salaryMin?: number; salaryMax?: number }) => void;
  invalid: boolean;
};

/**
 * Minimum and maximum steppers over a scale running from 0 to twice the market median, so the
 * median always sits in the middle and the band shows at a glance whether it pays under or over.
 */
export function SalaryBandField({ min, max, marketMedian, onChange, invalid }: SalaryBandFieldProps) {
  const { t } = useI18n();
  const copy = t.campaignForm.requirements;
  const scaleMax = marketMedian * 2;
  const start = useSharedValue(toScale(min, scaleMax));
  const end = useSharedValue(toScale(max, scaleMax));

  useEffect(() => {
    start.set(withSpring(toScale(min, scaleMax), BAND_SPRING));
    end.set(withSpring(toScale(max, scaleMax), BAND_SPRING));
  }, [min, max, scaleMax, start, end]);

  const bandStyle = useAnimatedStyle(() => ({
    left: `${start.get() * 100}%`,
    width: `${Math.max(0, end.get() - start.get()) * 100}%`,
  }));

  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.salaryMin}</Text>
          <NumberStepper
            value={min}
            onChange={(salaryMin) => onChange({ salaryMin })}
            min={SALARY_LIMITS.min}
            max={SALARY_LIMITS.max}
            step={SALARY_LIMITS.step}
            prefix="$"
            suffix="k"
            label={copy.salaryMinA11y}
            invalid={invalid}
          />
        </View>
        <View className="flex-1 gap-1.5">
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.salaryMax}</Text>
          <NumberStepper
            value={max}
            onChange={(salaryMax) => onChange({ salaryMax })}
            min={SALARY_LIMITS.min}
            max={SALARY_LIMITS.max}
            step={SALARY_LIMITS.step}
            prefix="$"
            suffix="k"
            label={copy.salaryMaxA11y}
            invalid={invalid}
          />
        </View>
      </View>

      {/* Decorative: the steppers above carry the values for screen readers. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className="gap-2">
        <View className="h-5 justify-center">
          <View className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <Animated.View style={[styles.band, bandStyle]}>
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View className="absolute left-1/2 h-5 w-0.5 rounded-full bg-slate-800 dark:bg-slate-200" />
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <View className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
            <Text className="text-xs text-slate-600 dark:text-slate-300">
              {copy.yourBand} · ${min}k – ${max}k
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-3 w-0.5 rounded-full bg-slate-800 dark:bg-slate-200" />
            <Text className="text-xs text-slate-600 dark:text-slate-300">{copy.marketMedian(marketMedian)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function toScale(value: number, scaleMax: number) {
  return Math.min(1, Math.max(0, value / scaleMax));
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
