import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { useAppTheme } from '../../theme';
import { PressableScale } from './PressableScale';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Puts the icon after the label, e.g. a forward arrow on "Continue". */
  iconAfter?: boolean;
  /** Shows a spinner in place of the icon and ignores presses. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const VARIANT_CLASSES: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400',
    text: 'text-white',
  },
  secondary: {
    container:
      'border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10',
    text: 'text-slate-700 dark:text-slate-200',
  },
  ghost: {
    container: 'hover:bg-slate-100 active:bg-slate-100 dark:hover:bg-white/5 dark:active:bg-white/10',
    text: 'text-slate-600 dark:text-slate-300',
  },
};

const PRIMARY_SHADOW = '0px 8px 20px -8px rgba(79, 70, 229, 0.65)';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconAfter = false,
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const { palette } = useAppTheme();
  const classes = VARIANT_CLASSES[variant];
  const iconColor =
    variant === 'primary' ? '#FFFFFF' : variant === 'secondary' ? palette.icon.strong : palette.icon.muted;
  const iconElement = loading ? (
    <ActivityIndicator size="small" color={iconColor} />
  ) : icon ? (
    <Ionicons name={icon} size={17} color={iconColor} />
  ) : null;

  return (
    <PressableScale
      accessibilityRole="button"
      aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      className={`h-11 flex-row items-center justify-center gap-1.5 rounded-xl px-4 ${classes.container} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
      style={variant === 'primary' && !disabled ? { boxShadow: PRIMARY_SHADOW } : undefined}
    >
      {!iconAfter && iconElement}
      <Text className={`text-sm font-semibold ${classes.text}`} numberOfLines={1}>
        {label}
      </Text>
      {iconAfter && iconElement}
    </PressableScale>
  );
}
