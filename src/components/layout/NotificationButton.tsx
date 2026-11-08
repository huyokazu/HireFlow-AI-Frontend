import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

/** The bell. Self-Healing alerts are the only notifications so far, so it opens their page. */
export function NotificationButton() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const { openAlerts } = useWorkspace();
  const router = useRouter();
  const count = openAlerts.length;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? t.header.notificationsUnread(count) : t.header.notifications}
      onPress={() => router.navigate('/self-healing')}
      className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-100 active:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <Ionicons name="notifications-outline" size={20} color={palette.icon.strong} />
      {count > 0 && (
        <View className="absolute right-2 top-2 h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-0.5 dark:border-gray-900">
          <Text className="text-[9px] font-bold text-white">{count}</Text>
        </View>
      )}
    </PressableScale>
  );
}
