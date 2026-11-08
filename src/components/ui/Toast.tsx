import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../theme';
import { PressableScale } from './PressableScale';

type ToastProps = {
  /** Changes for every new toast (e.g. a timestamp); `null` hides it. */
  toastKey: number | null;
  message: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

/** Short confirmation pinned to the bottom of the screen, with an optional action such as Undo. */
export function Toast({
  toastKey,
  message,
  icon = 'sparkles',
  actionLabel,
  onAction,
  onDismiss,
  // Long enough to read the message and still reach Undo.
  durationMs = 7000,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();

  useEffect(() => {
    if (toastKey === null) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [toastKey, durationMs, onDismiss]);

  return (
    // Bottom-centre on phones. On wider screens it sits bottom-right, clear of the
    // centre of the page, where the main action usually is (e.g. the wizard's Continue).
    <View
      className="right-4 items-center md:right-8 md:items-end"
      style={[styles.host, { bottom: insets.bottom + 20 }]}
    >
      {toastKey !== null && (
        <Animated.View
          key={toastKey}
          entering={FadeInDown.springify().damping(16)}
          exiting={FadeOutDown.duration(180)}
          accessibilityLiveRegion="polite"
          role="status"
          className="w-full max-w-[460px] flex-row items-center gap-3 rounded-2xl bg-slate-900 py-3 pl-4 pr-2 dark:bg-slate-100 md:max-w-[400px]"
          style={{ boxShadow: '0px 16px 36px -12px rgba(15, 23, 42, 0.45)' }}
        >
          <Ionicons name={icon} size={18} color={isDark ? '#4F46E5' : '#A5B4FC'} />
          <Text className="flex-1 text-sm text-white dark:text-slate-900">{message}</Text>
          {actionLabel && onAction && (
            <PressableScale
              accessibilityRole="button"
              onPress={onAction}
              className="rounded-lg px-3 py-1.5 hover:bg-white/10 active:bg-white/10 dark:hover:bg-slate-900/5 dark:active:bg-slate-900/5"
            >
              <Text className="text-sm font-semibold text-indigo-300 dark:text-indigo-600">{actionLabel}</Text>
            </PressableScale>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    pointerEvents: 'box-none',
  },
});
