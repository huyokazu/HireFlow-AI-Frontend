import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { CampaignSummary } from '../../services/dashboard';
import { useAppTheme, type Palette } from '../../theme';
import { HEALTH_STYLES } from '../campaigns/healthStyles';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { TargetProgressBar } from '../ui/TargetProgressBar';

/** What the Self-Healing monitor says about a campaign right now. */
export type MonitorStatus = 'monitoring' | 'critical' | 'warning' | 'fixing';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Class names are spelled out in full so Tailwind can find them when it scans the source.
const STATUS_STYLES: Record<
  MonitorStatus,
  { chipClassName: string; textClassName: string; icon: IconName; color: (palette: Palette) => string }
> = {
  monitoring: {
    chipClassName: 'bg-emerald-50 dark:bg-emerald-500/10',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
    icon: 'radio-button-on',
    color: (palette) => palette.emerald,
  },
  critical: {
    chipClassName: 'bg-rose-50 dark:bg-rose-500/15',
    textClassName: 'text-rose-700 dark:text-rose-300',
    icon: 'alert-circle',
    color: (palette) => palette.rose,
  },
  warning: {
    chipClassName: 'bg-amber-50 dark:bg-amber-500/15',
    textClassName: 'text-amber-700 dark:text-amber-300',
    icon: 'warning',
    color: (palette) => palette.amber,
  },
  fixing: {
    chipClassName: 'bg-indigo-50 dark:bg-indigo-500/15',
    textClassName: 'text-indigo-700 dark:text-indigo-200',
    icon: 'sync',
    color: (palette) => palette.indigo,
  },
};

type CampaignMonitorPanelProps = {
  campaigns: CampaignSummary[];
  /** Campaigns without an entry are being monitored with nothing to report. */
  statuses: Partial<Record<string, MonitorStatus>>;
  onOpenBoard: (campaignId: string) => void;
  onSimulate: (campaignId: string) => void;
};

/** Every live campaign with its match rate and what the Self-Healing monitor sees in it. */
export function CampaignMonitorPanel({ campaigns, statuses, onOpenBoard, onSimulate }: CampaignMonitorPanelProps) {
  const { t } = useI18n();
  const copy = t.selfHealingPage.monitor;
  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      <View className="-mx-2">
        {campaigns.map((campaign, index) => (
          <MonitorRow
            key={campaign.id}
            campaign={campaign}
            status={statuses[campaign.id] ?? 'monitoring'}
            divider={index > 0}
            onOpenBoard={() => onOpenBoard(campaign.id)}
            onSimulate={() => onSimulate(campaign.id)}
          />
        ))}
      </View>
    </Panel>
  );
}

function MonitorRow({
  campaign,
  status,
  divider,
  onOpenBoard,
  onSimulate,
}: {
  campaign: CampaignSummary;
  status: MonitorStatus;
  divider: boolean;
  onOpenBoard: () => void;
  onSimulate: () => void;
}) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.selfHealingPage.monitor;
  const style = STATUS_STYLES[status];
  const title = pick(campaign.title);

  return (
    <View
      className={`flex-row items-center gap-1 ${divider ? 'border-t border-slate-100 dark:border-white/10' : ''}`}
    >
      {/* Siblings, not nested: one button can't hold another. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.openBoardA11y(title)}, ${copy.status[status]}`}
        onPress={onOpenBoard}
        className="flex-1 gap-2 rounded-xl px-2 py-3 hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-white/5 dark:active:bg-white/5"
      >
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
            {title}
          </Text>
          <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${style.chipClassName}`}>
            <Ionicons name={style.icon} size={11} color={style.color(palette)} />
            <Text className={`text-[11px] font-semibold ${style.textClassName}`} numberOfLines={1}>
              {copy.status[status]}
            </Text>
          </View>
        </View>
        <TargetProgressBar
          value={campaign.matchRate}
          target={campaign.targetMatchRate}
          barClassName={HEALTH_STYLES[campaign.health].barClassName}
          size="sm"
        />
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {campaign.matchRate}% {t.campaignsPage.ofTarget(campaign.targetMatchRate)}
        </Text>
      </Pressable>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copy.simulateA11y(title)}
        onPress={onSimulate}
        hitSlop={4}
        className="h-9 w-9 items-center justify-center rounded-lg hover:bg-violet-50 active:bg-violet-50 dark:hover:bg-violet-500/15 dark:active:bg-violet-500/15"
      >
        <Ionicons name="git-compare-outline" size={17} color={palette.violet} />
      </PressableScale>
    </View>
  );
}
