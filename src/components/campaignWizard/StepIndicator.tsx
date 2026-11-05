import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';
import { WIZARD_STEPS } from './validation';

type StepIndicatorProps = {
  current: number;
  /** Highest step reached so far; steps up to it can be revisited. */
  furthest: number;
  onSelect: (index: number) => void;
};

/** Numbered progress across the wizard steps. Reached steps can be clicked to go back to them. */
export function StepIndicator({ current, furthest, onSelect }: StepIndicatorProps) {
  const { t } = useI18n();
  const steps = WIZARD_STEPS.map((step) => t.campaignForm.steps[step]);

  return (
    <View className="gap-3">
      {/* Steps keep their natural width and the connectors share what is left. Phones show
          bullets only: the "Step 2 of 4" line and the step's heading name the current step. */}
      <View className="flex-row items-center">
        {steps.map((label, index) => {
          // Steps already passed keep their tick after going back (e.g. with Edit on the review).
          const state = index === current ? 'current' : index < furthest ? 'done' : 'upcoming';
          const reachable = index <= furthest && index !== current;
          return (
            <Fragment key={label}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}. ${label}, ${t.campaignForm.stepStatus[state]}`}
                disabled={!reachable}
                onPress={() => onSelect(index)}
                className="shrink flex-row items-center gap-2 rounded-full pr-1"
              >
                <StepBullet index={index} state={state} />
                <Text
                  className={`hidden shrink text-sm font-semibold sm:flex ${
                    state === 'upcoming' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
                  }`}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </PressableScale>
              {index < steps.length - 1 && <Connector filled={index < furthest} />}
            </Fragment>
          );
        })}
      </View>
      <Text className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:hidden">
        {t.campaignForm.stepOf(current + 1, steps.length)}
      </Text>
    </View>
  );
}

function StepBullet({ index, state }: { index: number; state: 'done' | 'current' | 'upcoming' }) {
  if (state === 'done') {
    return (
      <Animated.View
        key="done"
        entering={ZoomIn.springify().damping(14)}
        className="h-8 w-8 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500"
      >
        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
      </Animated.View>
    );
  }
  return (
    <View
      className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
        state === 'current'
          ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/15'
          : 'border-slate-200 bg-white dark:border-white/15 dark:bg-white/5'
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          state === 'current' ? 'text-indigo-700 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {index + 1}
      </Text>
    </View>
  );
}

/** The line between two bullets; it fills in once the step before it is done. */
function Connector({ filled }: { filled: boolean }) {
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(filled ? 1 : 0, { duration: 380 }));
  }, [filled, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View className="mx-1.5 h-0.5 min-w-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <Animated.View className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={fillStyle} />
    </View>
  );
}
