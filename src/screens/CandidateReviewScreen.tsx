import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CandidateCardSwap } from '../components/CandidateCardSwap';
import { ThemedBackdrop } from '../components/layout/ThemedBackdrop';
import { SelfHealingAlertPopup } from '../components/SelfHealingAlert';
import { useI18n, type Localized } from '../i18n';
import { fetchMatchedCandidates, type Candidate } from '../services/candidates';
import {
  approveSuggestedFix,
  fetchActiveBottleneckAlerts,
  type BottleneckAlert,
  type SuggestedFix,
} from '../services/selfHealing';
import { useAppTheme } from '../theme';

const CAMPAIGN_ID = 'senior-frontend-engineer';
const CAMPAIGN_NAME: Localized = { en: 'Senior Frontend Engineer', vi: 'Kỹ sư Frontend cấp cao' };

export function CandidateReviewScreen() {
  const insets = useSafeAreaInsets();
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [openAlert, setOpenAlert] = useState<BottleneckAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMatchedCandidates(CAMPAIGN_ID).then((result) => {
      if (!cancelled) setCandidates(result);
    });
    fetchActiveBottleneckAlerts(CAMPAIGN_ID).then(([latest]) => {
      if (!cancelled && latest) setOpenAlert(latest);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-obsidian">
      <ThemedBackdrop />
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 48,
        }}
      >
        <View className="w-full max-w-md">
          <View className="mb-3 self-start rounded-full border border-indigo-200 bg-white/70 px-3 py-1 dark:border-indigo-400/30 dark:bg-indigo-500/10">
            <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              {pick(CAMPAIGN_NAME)}
            </Text>
          </View>
          <Text className="text-3xl font-bold text-slate-900 dark:text-white">{t.review.title}</Text>
          <Text className="mt-2 text-base leading-6 text-slate-500 dark:text-slate-400">{t.review.subtitle}</Text>

          <View className="mt-8">
            {candidates === null ? (
              <ActivityIndicator className="mt-24" color={palette.indigo} />
            ) : (
              <CandidateCardSwap candidates={candidates} />
            )}
          </View>
        </View>
      </ScrollView>

      <SelfHealingAlertPopup
        alert={openAlert}
        onClose={() => setOpenAlert(null)}
        onApproveFix={(alert: BottleneckAlert, fix: SuggestedFix) => approveSuggestedFix(alert.id, fix.id)}
      />
    </View>
  );
}
