import { Text, View } from 'react-native';

import type { CampaignHealth, CampaignSummary } from '../../services/dashboard';
import { Panel, PanelLink } from '../ui/Panel';
import { TargetProgressBar } from '../ui/TargetProgressBar';

const HEALTH_STYLES: Record<
  CampaignHealth,
  { label: string; chipClassName: string; textClassName: string; barClassName: string }
> = {
  on_track: {
    label: 'On track',
    chipClassName: 'bg-emerald-50',
    textClassName: 'text-emerald-700',
    barClassName: 'bg-emerald-500',
  },
  at_risk: {
    label: 'At risk',
    chipClassName: 'bg-amber-50',
    textClassName: 'text-amber-700',
    barClassName: 'bg-amber-500',
  },
  blocked: {
    label: 'Blocked',
    chipClassName: 'bg-rose-50',
    textClassName: 'text-rose-700',
    barClassName: 'bg-rose-500',
  },
};

type ActiveCampaignsPanelProps = {
  campaigns: CampaignSummary[];
  onViewAll: () => void;
  className?: string;
};

export function ActiveCampaignsPanel({ campaigns, onViewAll, className }: ActiveCampaignsPanelProps) {
  return (
    <Panel
      title="Active campaigns"
      subtitle="Match rate against each campaign's target"
      action={<PanelLink label="View all" onPress={onViewAll} />}
      className={className}
    >
      <View className="gap-4">
        {campaigns.map((campaign) => {
          const health = HEALTH_STYLES[campaign.health];
          return (
            <View key={campaign.id} className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
                    {campaign.title}
                  </Text>
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {campaign.department} · {campaign.stage} · {campaign.candidates} candidates
                  </Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${health.chipClassName}`}>
                  <Text className={`text-xs font-semibold ${health.textClassName}`}>{health.label}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <TargetProgressBar
                    value={campaign.matchRate}
                    target={campaign.targetMatchRate}
                    barClassName={health.barClassName}
                    size="sm"
                  />
                </View>
                <Text className="w-20 text-right text-xs text-slate-500">
                  <Text className="font-semibold text-slate-900">{campaign.matchRate}%</Text> /{' '}
                  {campaign.targetMatchRate}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}
