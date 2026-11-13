import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { CampaignSummary } from '../../services/dashboard';
import { HEALTH_STYLES } from '../campaigns/healthStyles';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Panel, PanelLink } from '../ui/Panel';
import { TargetProgressBar } from '../ui/TargetProgressBar';

type ActiveCampaignsPanelProps = {
  campaigns: CampaignSummary[];
  onViewAll: () => void;
  className?: string;
  /** Start of the bars' grow-in, to line up with the panel's entrance. */
  enterDelay?: number;
};

export function ActiveCampaignsPanel({
  campaigns,
  onViewAll,
  className,
  enterDelay = 0,
}: ActiveCampaignsPanelProps) {
  const { t, pick } = useI18n();

  return (
    <Panel
      title={t.campaigns.title}
      subtitle={t.campaigns.subtitle}
      action={<PanelLink label={t.campaigns.viewAll} onPress={onViewAll} />}
      className={className}
    >
      <View className="gap-4">
        {campaigns.map((campaign, index) => {
          const health = HEALTH_STYLES[campaign.health];
          return (
            <View key={campaign.id} className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
                    {pick(campaign.title)}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
                    {pick(campaign.department)} · {t.campaigns.stages[campaign.stage]} ·{' '}
                    {t.campaigns.candidates(campaign.candidates)}
                  </Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${health.chipClassName}`}>
                  <Text className={`text-xs font-semibold ${health.textClassName}`}>
                    {t.campaigns.health[campaign.health]}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <TargetProgressBar
                    value={campaign.matchRate}
                    target={campaign.targetMatchRate}
                    barClassName={health.barClassName}
                    size="sm"
                    delay={enterDelay + index * 90}
                  />
                </View>
                <View className="w-20 flex-row items-baseline justify-end">
                  <AnimatedNumber
                    value={campaign.matchRate}
                    format={(value) => `${value}%`}
                    delay={enterDelay + index * 90}
                    className="text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {' '}
                    / {campaign.targetMatchRate}%
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}
