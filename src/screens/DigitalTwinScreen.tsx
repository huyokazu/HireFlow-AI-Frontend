import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { hasErrors, validateDraft } from '../components/campaignWizard/validation';
import { CampaignPicker } from '../components/digitalTwin/CampaignPicker';
import { changedLevers } from '../components/digitalTwin/scenario';
import { ScenarioPanel } from '../components/digitalTwin/ScenarioPanel';
import { TwinForecastPanel, type PendingChange } from '../components/digitalTwin/TwinForecastPanel';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { Toast } from '../components/ui/Toast';
import { useI18n, type Localized } from '../i18n';
import type { CampaignDraft } from '../services/campaigns';
import type { CampaignSummary } from '../services/dashboard';
import { forecastCalibrated, suggestForecastFixes } from '../services/digitalTwin';
import { FEATURED_CAMPAIGN_ID, useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

type TwinToast =
  | { key: number; kind: 'applied'; campaignId: string; title: Localized; previous: CampaignDraft }
  | { key: number; kind: 'reverted'; title: Localized };

/**
 * Hiring Digital Twin: try changes on a copy of a live campaign, compare the forecast with the
 * current setup, and apply the scenario once it looks right. The campaign comes from `?campaign=`.
 */
export function DigitalTwinScreen() {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ campaign?: string }>();
  const { summary, campaignSetups, twinOffsets, applyCampaignSetup } = useWorkspace();
  // Scenarios by campaign id, so switching campaigns and back keeps the one in progress.
  const [scenarios, setScenarios] = useState<Record<string, CampaignDraft>>({});
  const [pending, setPending] = useState<PendingChange>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  const [toast, setToast] = useState<TwinToast | null>(null);

  const campaigns = (summary?.campaigns ?? []).filter((campaign) => campaignSetups[campaign.id]);
  const campaign =
    campaigns.find((item) => item.id === params.campaign) ??
    campaigns.find((item) => item.id === FEATURED_CAMPAIGN_ID) ??
    campaigns[0] ??
    null;

  const update = useCallback(
    (patch: Partial<CampaignDraft>) => {
      if (!campaign) return;
      const base = campaignSetups[campaign.id];
      setScenarios((current) => ({ ...current, [campaign.id]: { ...(current[campaign.id] ?? base), ...patch } }));
    },
    [campaign, campaignSetups],
  );

  const resetScenario = useCallback((campaignId: string) => {
    setScenarios((current) => {
      const next = { ...current };
      delete next[campaignId];
      return next;
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const selectCampaign = (campaignId: string) => {
    setApplyFailed(false);
    router.setParams({ campaign: campaignId });
  };

  const handleApply = async (target: CampaignSummary, previous: CampaignDraft, next: CampaignDraft) => {
    setPending('apply');
    setApplyFailed(false);
    setToast(null);
    try {
      await applyCampaignSetup(target.id, next);
      // The scenario is now the campaign's setup, so there is nothing left to compare.
      resetScenario(target.id);
      setToast({ key: Date.now(), kind: 'applied', campaignId: target.id, title: target.title, previous });
    } catch {
      setApplyFailed(true);
    } finally {
      setPending(null);
    }
  };

  const handleUndo = async () => {
    if (toast?.kind !== 'applied' || pending) return;
    const { campaignId, title, previous } = toast;
    setToast(null);
    setPending('undo');
    setApplyFailed(false);
    try {
      await applyCampaignSetup(campaignId, previous);
      setToast({ key: Date.now(), kind: 'reverted', title });
    } catch {
      setApplyFailed(true);
    } finally {
      setPending(null);
    }
  };

  const ready = summary !== null && Object.keys(campaignSetups).length > 0;
  const setup = campaign ? campaignSetups[campaign.id] : undefined;
  const model = campaign && setup ? buildModel(setup, scenarios[campaign.id] ?? setup, twinOffsets[campaign.id] ?? 0) : null;

  return (
    <View style={styles.flex}>
      <ScreenContainer>
        <AppHeader title={t.twin.title} subtitle={t.twin.subtitle} />

        {!ready ? (
          <ActivityIndicator className="mt-24" color={palette.indigo} />
        ) : !campaign || !setup || !model ? (
          <Text className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">{t.twin.noCampaigns}</Text>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(80).duration(450)} className="mt-6 gap-3">
              <CampaignPicker campaigns={campaigns} selectedId={campaign.id} onSelect={selectCampaign} />
              {/* Live results exist once the campaign has candidates; a brand-new one runs on the model alone. */}
              <View className="flex-row items-center gap-1.5">
                <Ionicons
                  name={campaign.candidates > 0 ? 'pulse-outline' : 'information-circle-outline'}
                  size={14}
                  color={palette.icon.muted}
                />
                <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400">
                  {campaign.candidates > 0 ? t.twin.calibrated(campaign.matchRate) : t.twin.uncalibrated}
                </Text>
              </View>
            </Animated.View>

            {/* One column until there is room for two; the forecast takes the wider one. */}
            <View className="mt-6 gap-6 xl:flex-row xl:items-start">
              <Animated.View entering={FadeInDown.delay(160).duration(450)} className="xl:flex-[5]">
                <ScenarioPanel
                  setup={setup}
                  scenario={model.scenario}
                  marketMedian={model.scenarioForecast.marketMedian}
                  update={update}
                  onReset={() => resetScenario(campaign.id)}
                  currentMatchRate={model.currentForecast.matchRate}
                  scenarioMatchRate={model.scenarioForecast.matchRate}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(240).duration(450)} className="xl:flex-[7]">
                <TwinForecastPanel
                  scenarioDraft={model.scenario}
                  current={model.currentForecast}
                  scenario={model.scenarioForecast}
                  fixes={model.fixes}
                  onTryFix={(fix) => update(fix.patch)}
                  canApply={model.canApply}
                  pending={pending}
                  applyFailed={applyFailed}
                  onApply={() => {
                    if (model.canApply && !pending) void handleApply(campaign, setup, model.scenario);
                  }}
                />
              </Animated.View>
            </View>
          </>
        )}
      </ScreenContainer>

      <Toast
        toastKey={toast?.key ?? null}
        message={
          toast?.kind === 'applied'
            ? t.twin.applied(pick(toast.title))
            : toast?.kind === 'reverted'
              ? t.twin.reverted(pick(toast.title))
              : ''
        }
        icon={toast?.kind === 'reverted' ? 'arrow-undo' : 'checkmark-done'}
        actionLabel={toast?.kind === 'applied' ? t.twin.undo : undefined}
        onAction={toast?.kind === 'applied' ? handleUndo : undefined}
        onDismiss={dismissToast}
      />
    </View>
  );
}

/**
 * Everything the page shows for one campaign. The model is small and deterministic, so it simply
 * re-runs on every change to the scenario.
 */
function buildModel(setup: CampaignDraft, scenario: CampaignDraft, offset: number) {
  const currentForecast = forecastCalibrated(setup, offset);
  const scenarioForecast = forecastCalibrated(scenario, offset);
  return {
    scenario,
    currentForecast,
    scenarioForecast,
    fixes: suggestForecastFixes(scenario, scenarioForecast, offset),
    canApply: changedLevers(setup, scenario).length > 0 && !hasErrors(validateDraft(scenario)),
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
