import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { CampaignHealth, CampaignSummary } from '../../services/dashboard';
import { useAppTheme, type Palette } from '../../theme';
import { niceStep } from '../../utils/charts';
import { HEALTH_STYLES } from '../campaigns/healthStyles';
import { Panel } from '../ui/Panel';
import { GrowBar } from './GrowBar';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ENTER_STAGGER_MS = 70;

// Health is a status: its colour always comes with an icon and the label, never alone.
const HEALTH_ICONS: Record<CampaignHealth, { icon: IconName; color: (palette: Palette) => string }> = {
  on_track: { icon: 'checkmark-circle', color: (palette) => palette.emerald },
  at_risk: { icon: 'warning', color: (palette) => palette.amber },
  blocked: { icon: 'alert-circle', color: (palette) => palette.rose },
};

export type CampaignTargetRow = {
  campaign: CampaignSummary;
  /** Candidates hired in this campaign so far. */
  hired: number;
  openings: number;
};

type CampaignTargetsPanelProps = {
  rows: CampaignTargetRow[];
  onOpenBoard: (campaignId: string) => void;
  enterDelay: number;
};

/**
 * Each campaign's match rate against its own target, as a gap either side of the target line,
 * furthest below first. A row opens the campaign's board.
 */
export function CampaignTargetsPanel({ rows, onOpenBoard, enterDelay }: CampaignTargetsPanelProps) {
  const { t } = useI18n();
  const copy = t.analyticsPage.targets;
  const filled = rows.reduce((total, row) => total + Math.min(row.hired, row.openings), 0);
  const openings = rows.reduce((total, row) => total + row.openings, 0);
  // Campaigns without candidates have no match rate yet; they go last, without a bar.
  const sorted = [...rows].sort(
    (a, b) =>
      Number(a.campaign.candidates === 0) - Number(b.campaign.candidates === 0) || gapOf(a.campaign) - gapOf(b.campaign),
  );
  const largestGap = Math.max(
    1,
    ...rows.filter((row) => row.campaign.candidates > 0).map((row) => Math.abs(gapOf(row.campaign))),
  );
  const scale = niceStep(largestGap);

  return (
    <Panel title={copy.title} subtitle={copy.subtitle(filled, openings)}>
      {/* Which side is which; the line between the halves is each campaign's target. */}
      <View className="flex-row px-2" aria-hidden>
        <View className="flex-1 flex-row justify-between gap-2">
          <Text className="text-[11px] text-slate-400 dark:text-slate-500">← {copy.below}</Text>
          <Text className="text-right text-[11px] text-slate-400 dark:text-slate-500">{copy.above} →</Text>
        </View>
        <View className="w-[72px]" />
      </View>

      <View className="mt-1">
        {sorted.map((row, index) => (
          <TargetRow
            key={row.campaign.id}
            row={row}
            scale={scale}
            divider={index > 0}
            onPress={() => onOpenBoard(row.campaign.id)}
            delay={enterDelay + index * ENTER_STAGGER_MS}
          />
        ))}
      </View>
    </Panel>
  );
}

function TargetRow({
  row,
  scale,
  divider,
  onPress,
  delay,
}: {
  row: CampaignTargetRow;
  /** Points of gap that fill half the track. */
  scale: number;
  divider: boolean;
  onPress: () => void;
  delay: number;
}) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.analyticsPage.targets;
  const { campaign, hired, openings } = row;
  const health = HEALTH_STYLES[campaign.health];
  const healthIcon = HEALTH_ICONS[campaign.health];
  const healthLabel = t.campaigns.health[campaign.health];
  const title = pick(campaign.title);
  const gap = gapOf(campaign);
  const hasCandidates = campaign.candidates > 0;
  const barPercent = (Math.min(Math.abs(gap), scale) / scale) * 100;

  return (
    <View className={divider ? 'border-t border-slate-100 dark:border-white/10' : ''}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasCandidates
            ? copy.openA11y(title, healthLabel, campaign.matchRate, campaign.targetMatchRate)
            : `${title}, ${copy.noCandidates}. ${t.campaignsPage.openBoardA11y(title)}`
        }
        onPress={onPress}
        className="gap-2 rounded-xl px-2 py-3 hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-white/5 dark:active:bg-white/5"
      >
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
            {title}
          </Text>
          <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${health.chipClassName}`}>
            <Ionicons name={healthIcon.icon} size={11} color={healthIcon.color(palette)} />
            <Text className={`text-[11px] font-semibold ${health.textClassName}`} numberOfLines={1}>
              {healthLabel}
            </Text>
          </View>
        </View>

        {hasCandidates ? (
          <>
            <View className="flex-row items-center">
              {/* Diverging from the target line: below target grows left, above grows right. */}
              <View className="h-4 flex-1 flex-row items-center">
                <View className="flex-1 flex-row justify-end">
                  {gap < 0 && <GrowBar percent={barPercent} className={`h-3 rounded-l ${health.barClassName}`} delay={delay} />}
                </View>
                <View className="h-4 w-0.5 rounded-full bg-slate-800 dark:bg-slate-200" />
                <View className="flex-1 flex-row">
                  {gap > 0 && <GrowBar percent={barPercent} className={`h-3 rounded-r ${health.barClassName}`} delay={delay} />}
                </View>
              </View>
              <Text className="w-[72px] text-right text-sm font-semibold text-slate-900 dark:text-white">
                {copy.gap(gap)}
              </Text>
            </View>
            <Text className="text-xs text-slate-500 dark:text-slate-400">
              {copy.meta(campaign.matchRate, campaign.targetMatchRate, hired, openings)}
            </Text>
          </>
        ) : (
          <Text className="text-xs text-slate-500 dark:text-slate-400">{copy.noCandidates}</Text>
        )}
      </Pressable>
    </View>
  );
}

/** Match rate minus target, in points: below zero is below target. */
function gapOf(campaign: CampaignSummary): number {
  return campaign.matchRate - campaign.targetMatchRate;
}
