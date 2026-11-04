import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CandidateCardSwap } from '../components/CandidateCardSwap';
import { SelfHealingAlertPopup } from '../components/SelfHealingAlert';
import { fetchMatchedCandidates, type Candidate } from '../services/candidates';
import {
  approveSuggestedFix,
  fetchActiveBottleneckAlerts,
  type BottleneckAlert,
  type SuggestedFix,
} from '../services/selfHealing';

const CAMPAIGN_ID = 'senior-frontend-engineer';

export function CandidateReviewScreen() {
  const insets = useSafeAreaInsets();
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
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#EEF2FF', '#F8FAFC', '#F5F3FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 48,
        }}
      >
        <View className="w-full max-w-md">
          <View className="mb-3 self-start rounded-full border border-indigo-200 bg-white/70 px-3 py-1">
            <Text className="text-xs font-semibold text-indigo-700">Senior Frontend Engineer</Text>
          </View>
          <Text className="text-3xl font-bold text-slate-900">Review matched candidates</Text>
          <Text className="mt-2 text-base leading-6 text-slate-500">
            Ranked by the Matching Agent against this campaign's requirements.
          </Text>

          <View className="mt-8">
            {candidates === null ? (
              <ActivityIndicator className="mt-24" color="#4F46E5" />
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
