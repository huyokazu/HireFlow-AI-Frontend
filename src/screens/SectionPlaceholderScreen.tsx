import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { getNavLabel, type NavKey } from '../components/layout/Sidebar';
import { Panel } from '../components/ui/Panel';
import { useI18n } from '../i18n';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

/** Stand-in for sidebar sections that are not built yet. */
export function SectionPlaceholderScreen({ section }: { section: NavKey }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const { summary } = useWorkspace();
  const label = getNavLabel(section, t);
  const today = t.date.long(new Date());

  return (
    <ScreenContainer>
      <AppHeader title={label} subtitle={summary ? t.dashboard.subtitle(today, summary.activeCampaigns) : today} />
      <Animated.View entering={FadeInDown.duration(400)} className="mt-6">
        <Panel title={label} subtitle={t.dashboard.placeholderSubtitle}>
          <View className="items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 dark:border-white/15">
            <Ionicons name="construct-outline" size={28} color={palette.icon.faint} />
            <Text className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
              {t.dashboard.placeholderBody}
            </Text>
          </View>
        </Panel>
      </Animated.View>
    </ScreenContainer>
  );
}
