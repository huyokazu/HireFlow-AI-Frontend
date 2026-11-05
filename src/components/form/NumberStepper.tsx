import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Text before the number, e.g. `$`. */
  prefix?: string;
  /** Unit after the number, e.g. `k`, `%`, or a function for plural units ("1 year", "3 years"). */
  suffix?: string | ((value: number) => string);
  /** Names the value for screen readers, and the − and + buttons after it. */
  label: string;
  invalid?: boolean;
};

/** A number with − and + buttons. The number itself can also be typed. */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  label,
  invalid = false,
}: NumberStepperProps) {
  const { t } = useI18n();
  // What the user is typing, or null while the field shows the saved value.
  const [typed, setTyped] = useState<string | null>(null);
  const unit = typeof suffix === 'function' ? suffix(value) : suffix;
  // Wide enough for the longest allowed number, so the field doesn't jump as digits change.
  const inputWidth = 14 + String(max).length * 9;

  const commit = (next: number) => {
    const snapped = Math.round(next / step) * step;
    const clamped = Math.min(max, Math.max(min, snapped));
    if (clamped !== value) onChange(clamped);
  };

  const commitTyped = () => {
    if (typed === null) return;
    const parsed = Number.parseInt(typed, 10);
    if (!Number.isNaN(parsed)) commit(parsed);
    setTyped(null);
  };

  return (
    <View
      className={`h-11 flex-row items-center overflow-hidden rounded-xl border bg-white dark:bg-white/5 ${
        invalid ? 'border-rose-400 dark:border-rose-400/70' : 'border-slate-200 dark:border-white/15'
      }`}
    >
      <StepButton
        icon="remove"
        label={t.campaignForm.decrease(label)}
        disabled={value <= min}
        onPress={() => commit(value - step)}
      />
      <View className="flex-1 flex-row items-center justify-center">
        {prefix && <Text className="text-sm font-semibold text-slate-400 dark:text-slate-500">{prefix}</Text>}
        <TextInput
          value={typed ?? String(value)}
          onChangeText={(text) => setTyped(text.replace(/[^0-9]/g, ''))}
          onFocus={() => setTyped(String(value))}
          onBlur={commitTyped}
          onSubmitEditing={commitTyped}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={String(max).length}
          accessibilityLabel={label}
          className="py-0 text-center text-sm font-semibold text-slate-900 outline-none dark:text-slate-100"
          style={{ width: inputWidth }}
        />
        {unit && <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</Text>}
      </View>
      <StepButton
        icon="add"
        label={t.campaignForm.increase(label)}
        disabled={value >= max}
        onPress={() => commit(value + step)}
      />
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.9}
      className={`h-full w-11 items-center justify-center ${
        disabled ? 'opacity-35' : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/5 dark:active:bg-white/10'
      }`}
    >
      <Ionicons name={icon} size={18} color={palette.icon.strong} />
    </PressableScale>
  );
}
