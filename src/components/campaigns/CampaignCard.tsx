import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { CampaignSummary } from '../../services/dashboard';
import { useAppTheme } from '../../theme';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { PressableScale } from '../ui/PressableScale';
import { TargetProgressBar } from '../ui/TargetProgressBar';
import { HEALTH_STYLES } from './healthStyles';

type CampaignCardProps = {
  campaign: CampaignSummary;
  onPress: () => void;
  /** Start of the bar and number roll, to line up with the card's entrance. */
  enterDelay: number;
};

/** One campaign on the Campaigns page; opens its pipeline board. */
export function CampaignCard({ campaign, onPress, enterDelay }: CampaignCardProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const health = HEALTH_STYLES[campaign.health];
  const title = pick(campaign.title);

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={t.campaignsPage.openBoardA11y(title)}
      onPress={onPress}
      pressedScale={0.98}
      hoverScale={1.01}
      className="flex-1 rounded-3xl border border-white/80 bg-white/70 p-5 hover:border-indigo-200 dark:border-white/15 dark:bg-gray-900 dark:hover:border-indigo-400/40"
      style={{ boxShadow: palette.shadow.panel }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {pick(campaign.department)}
          </Text>
          <Text className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50" numberOfLines={1}>
            {title}
          </Text>
          <Text className="mt-0.5 text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
            {t.campaigns.stages[campaign.stage]} · {t.campaigns.candidates(campaign.candidates)}
          </Text>
        </View>
        <View className={`rounded-full px-2 py-0.5 ${health.chipClassName}`}>
          <Text className={`text-xs font-semibold ${health.textClassName}`}>{t.campaigns.health[campaign.health]}</Text>
        </View>
      </View>

      <View className="mt-5 flex-row items-baseline gap-1.5">
        <AnimatedNumber
          value={campaign.matchRate}
          format={(value) => `${value}%`}
          delay={enterDelay}
          className="text-3xl font-bold text-slate-900 dark:text-white"
        />
        <Text className="text-sm text-slate-500 dark:text-slate-400">
          {t.campaignsPage.ofTarget(campaign.targetMatchRate)}
        </Text>
      </View>
      <View className="mt-3">
        <TargetProgressBar
          value={campaign.matchRate}
          target={campaign.targetMatchRate}
          barClassName={health.barClassName}
          delay={enterDelay}
        />
      </View>

      <View className="mt-5 flex-row items-center justify-between border-t border-slate-100 pt-4 dark:border-white/10">
        <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{t.campaignsPage.openBoard}</Text>
        <Ionicons name="arrow-forward" size={16} color={palette.indigo} />
      </View>
    </PressableScale>
  );
}

/** Dashed card at the end of the grid that starts the campaign wizard. */
export function NewCampaignCard({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      pressedScale={0.98}
      hoverScale={1.01}
      className="min-h-[200px] flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 p-5 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-white/15 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/5"
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/15">
        <Ionicons name="add" size={24} color={palette.indigo} />
      </View>
      <Text className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-50">{t.campaignsPage.newTitle}</Text>
      <Text className="mt-1 max-w-[240px] text-center text-sm text-slate-500 dark:text-slate-400">
        {t.campaignsPage.newBody}
      </Text>
    </PressableScale>
  );
}
