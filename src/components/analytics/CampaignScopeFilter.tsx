import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import type { CampaignSummary } from '../../services/dashboard';
import { PressableScale } from '../ui/PressableScale';

type CampaignScopeFilterProps = {
  campaigns: CampaignSummary[];
  /** `null` for every campaign. */
  selectedId: string | null;
  onSelect: (campaignId: string | null) => void;
};

/**
 * Pick-one row of campaigns, each with its applicants, for the panels below it. Scrolls sideways
 * when it doesn't fit, like the board's filter.
 */
export function CampaignScopeFilter({ campaigns, selectedId, onSelect }: CampaignScopeFilterProps) {
  const { t, pick } = useI18n();
  const copy = t.analyticsPage.scope;
  const applicants = campaigns.reduce((total, campaign) => total + campaign.candidates, 0);

  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" aria-hidden>
        {copy.label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={copy.a11y}
      >
        <ScopeChip
          label={t.board.allCampaigns}
          count={applicants}
          a11yLabel={copy.chipA11y(t.board.allCampaigns, applicants)}
          selected={selectedId === null}
          onPress={() => onSelect(null)}
        />
        {campaigns.map((campaign) => (
          <ScopeChip
            key={campaign.id}
            label={pick(campaign.title)}
            count={campaign.candidates}
            a11yLabel={copy.chipA11y(pick(campaign.title), campaign.candidates)}
            selected={campaign.id === selectedId}
            onPress={() => onSelect(campaign.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ScopeChip({
  label,
  count,
  a11yLabel,
  selected,
  onPress,
}: {
  label: string;
  /** Applicants in the campaign, or in all of them. */
  count: number;
  a11yLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={a11yLabel}
      aria-checked={selected}
      onPress={onPress}
      className={`h-9 flex-row items-center gap-2 rounded-full border px-3.5 ${
        selected
          ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
          : 'border-slate-200 bg-white/80 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      <Text
        className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View className={`min-w-5 items-center rounded-full px-1.5 ${selected ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}>
        <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          {count}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8 },
});
