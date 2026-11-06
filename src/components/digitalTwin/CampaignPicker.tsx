import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { CampaignSummary } from '../../services/dashboard';
import { HEALTH_STYLES } from '../campaigns/healthStyles';
import { useShell } from '../layout/AppShell';
import { PressableScale } from '../ui/PressableScale';

type CampaignPickerProps = {
  campaigns: CampaignSummary[];
  selectedId: string;
  onSelect: (campaignId: string) => void;
};

/** Pick-one list of campaigns: wraps on wide screens, scrolls sideways on phones. */
export function CampaignPicker({ campaigns, selectedId, onSelect }: CampaignPickerProps) {
  const { t } = useI18n();
  const { isWide } = useShell();
  const chips = campaigns.map((campaign) => (
    <CampaignChip
      key={campaign.id}
      campaign={campaign}
      selected={campaign.id === selectedId}
      onPress={() => onSelect(campaign.id)}
    />
  ));

  if (isWide) {
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel={t.twin.campaignPicker} className="flex-row flex-wrap gap-2">
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.twin.campaignPicker}
    >
      {chips}
    </ScrollView>
  );
}

function CampaignChip({
  campaign,
  selected,
  onPress,
}: {
  campaign: CampaignSummary;
  selected: boolean;
  onPress: () => void;
}) {
  const { t, pick } = useI18n();
  const title = pick(campaign.title);
  return (
    <PressableScale
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={`${title}, ${t.campaigns.health[campaign.health]}`}
      onPress={onPress}
      className={`h-9 flex-row items-center gap-2 rounded-full border px-3.5 ${
        selected
          ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/15 dark:bg-white/5 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/15'
      }`}
    >
      {/* Health dot: a ring keeps it visible on the selected chip's indigo fill. */}
      <View
        className={`h-2 w-2 rounded-full ${HEALTH_STYLES[campaign.health].barClassName} ${
          selected ? 'border border-white' : ''
        }`}
      />
      <Text
        className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
        numberOfLines={1}
      >
        {title}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
});
