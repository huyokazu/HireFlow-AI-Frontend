import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { CAMPAIGN_AGENTS, CHANNEL_NAMES, type CampaignDraft } from '../../services/campaigns';
import type { CampaignSummary } from '../../services/dashboard';
import type { CampaignForecast } from '../../services/digitalTwin';
import { useAppTheme } from '../../theme';
import { Button } from '../ui/Button';
import { PulseRing } from '../ui/pulse';
import { SectionLabel } from '../ui/SectionLabel';
import { AGENT_ICONS } from './AgentsStep';

const BADGE_SIZE = 80;

type LaunchSuccessProps = {
  campaign: CampaignSummary;
  /** The draft as launched, for the channels and agents it started. */
  draft: CampaignDraft;
  forecast: CampaignForecast;
  onOpenBoard: () => void;
  onDashboard: () => void;
  onCreateAnother: () => void;
};

/** Confirmation after launch: what is now running, and where to go next. */
export function LaunchSuccess({
  campaign,
  draft,
  forecast,
  onOpenBoard,
  onDashboard,
  onCreateAnother,
}: LaunchSuccessProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.campaignForm.launched;
  const channels = t.campaignForm.joinList(draft.channels.map((channel) => pick(CHANNEL_NAMES[channel])));
  const agents = CAMPAIGN_AGENTS.filter((agent) => draft.agents[agent]);

  return (
    <Animated.View
      entering={FadeInDown.duration(450)}
      className="mt-6 items-center rounded-3xl border border-white/80 bg-white/70 px-6 py-10 dark:border-white/15 dark:bg-gray-900"
      style={{ boxShadow: palette.shadow.panel }}
    >
      <View className="items-center justify-center" style={styles.badge}>
        <PulseRing color={palette.emerald} active size={BADGE_SIZE} />
        <Animated.View
          entering={ZoomIn.delay(120).springify().damping(11)}
          className="items-center justify-center overflow-hidden rounded-full"
          style={styles.badge}
        >
          <LinearGradient
            colors={['#34D399', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="checkmark" size={40} color="#FFFFFF" />
        </Animated.View>
      </View>

      <Text accessibilityRole="header" className="mt-6 text-center text-2xl font-bold text-slate-900 dark:text-white">
        {copy.title}
      </Text>
      <Text className="mt-2 max-w-xl text-center text-sm text-slate-600 dark:text-slate-300">
        {copy.body(pick(campaign.title), channels)}
      </Text>

      {agents.length > 0 && (
        <View className="mt-6 items-center gap-2.5">
          <SectionLabel>{copy.agentsStarted}</SectionLabel>
          <View className="flex-row flex-wrap justify-center gap-2">
            {agents.map((agent, index) => (
              <Animated.View
                key={agent}
                entering={FadeInDown.delay(350 + index * 90).duration(320)}
                className="flex-row items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-400/25 dark:bg-emerald-500/10"
              >
                <Ionicons name={AGENT_ICONS[agent]} size={14} color={palette.emerald} />
                <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  {t.campaignForm.agents.names[agent]}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>
      )}

      <View className="mt-6 flex-row items-center gap-2 rounded-2xl bg-slate-100/80 px-4 py-2.5 dark:bg-white/5">
        <Ionicons name="sparkles" size={14} color={palette.violet} />
        <Text className="shrink text-xs font-medium text-slate-700 dark:text-slate-200">
          {copy.forecastRecap(forecast.matchRate, forecast.qualifiedApplicants, forecast.timeToHireDays)}
        </Text>
      </View>

      <View className="mt-8 w-full max-w-2xl gap-2.5 sm:flex-row sm:justify-center">
        <Button icon="albums-outline" label={copy.openBoard} onPress={onOpenBoard} />
        <Button variant="secondary" icon="grid-outline" label={copy.backToDashboard} onPress={onDashboard} />
        <Button variant="ghost" icon="add" label={copy.createAnother} onPress={onCreateAnother} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { width: BADGE_SIZE, height: BADGE_SIZE },
});
