import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { AgentsStep } from '../components/campaignWizard/AgentsStep';
import { ForecastPanel, ForecastStrip } from '../components/campaignWizard/ForecastPanel';
import { describeFix } from '../components/campaignWizard/forecastCopy';
import { LaunchSuccess } from '../components/campaignWizard/LaunchSuccess';
import { RequirementsStep } from '../components/campaignWizard/RequirementsStep';
import { ReviewStep } from '../components/campaignWizard/ReviewStep';
import { RoleStep } from '../components/campaignWizard/RoleStep';
import { StepIndicator } from '../components/campaignWizard/StepIndicator';
import {
  errorsForStep,
  firstInvalidStep,
  hasErrors,
  validateDraft,
  WIZARD_STEPS,
  type WizardStep,
} from '../components/campaignWizard/validation';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer, type ScreenScrollView } from '../components/layout/ScreenContainer';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { EMPTY_CAMPAIGN_DRAFT, type CampaignDraft } from '../services/campaigns';
import type { CampaignSummary } from '../services/dashboard';
import {
  forecastCampaign,
  suggestForecastFixes,
  type CampaignForecast,
  type ForecastFix,
} from '../services/digitalTwin';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

type Launched = { campaign: CampaignSummary; draft: CampaignDraft; forecast: CampaignForecast };
/** An applied Digital Twin fix, kept so it can be undone. */
type FixToast = { key: number; fix: ForecastFix; before: CampaignDraft; previous: Partial<CampaignDraft> };

/** Four-step campaign wizard with the Digital Twin forecasting the result as the form is filled in. */
export function CampaignCreationScreen() {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const { launchCampaign } = useWorkspace();
  const scrollRef = useRef<ScreenScrollView>(null);

  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_CAMPAIGN_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Steps where Continue was pressed: only these show their validation errors.
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<WizardStep>>(() => new Set());
  const [launching, setLaunching] = useState(false);
  const [launchFailed, setLaunchFailed] = useState(false);
  const [launched, setLaunched] = useState<Launched | null>(null);
  const [toast, setToast] = useState<FixToast | null>(null);

  // A small deterministic model, so it simply re-runs on every edit.
  const forecast = forecastCampaign(draft);
  const fixes = suggestForecastFixes(draft, forecast);
  const errors = validateDraft(draft);
  const step = WIZARD_STEPS[stepIndex];
  const visibleErrors = checkedSteps.has(step) ? errorsForStep(step, errors) : {};

  const update = useCallback((patch: Partial<CampaignDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const goToStep = (index: number) => {
    setDirection(index >= stepIndex ? 1 : -1);
    setStepIndex(index);
    setFurthest((current) => Math.max(current, index));
    setLaunchFailed(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const markChecked = (target: WizardStep) => setCheckedSteps((current) => new Set(current).add(target));

  const handleContinue = () => {
    if (hasErrors(errorsForStep(step, errors))) {
      markChecked(step);
      return;
    }
    goToStep(stepIndex + 1);
  };

  const handleLaunch = async () => {
    const invalidStep = firstInvalidStep(errors);
    if (invalidStep) {
      markChecked(invalidStep);
      goToStep(WIZARD_STEPS.indexOf(invalidStep));
      return;
    }
    setLaunching(true);
    setLaunchFailed(false);
    try {
      const campaign = await launchCampaign(draft);
      setToast(null);
      setLaunched({ campaign, draft, forecast });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch {
      setLaunchFailed(true);
    } finally {
      setLaunching(false);
    }
  };

  const handleApplyFix = (fix: ForecastFix) => {
    const previous: Partial<CampaignDraft> = {};
    for (const key of Object.keys(fix.patch) as (keyof CampaignDraft)[]) {
      Object.assign(previous, { [key]: draft[key] });
    }
    setToast({ key: Date.now(), fix, before: draft, previous });
    update(fix.patch);
  };

  const handleUndoFix = () => {
    if (!toast) return;
    update(toast.previous);
    setToast(null);
  };

  const dismissToast = useCallback(() => setToast(null), []);

  const handleCancel = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/campaigns');
  };

  const startOver = () => {
    setDraft(EMPTY_CAMPAIGN_DRAFT);
    setStepIndex(0);
    setFurthest(0);
    setDirection(1);
    setCheckedSteps(new Set());
    setLaunched(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const StepEntering = direction > 0 ? FadeInRight : FadeInLeft;
  const showFixPrompt = hasErrors(visibleErrors);

  return (
    <View style={styles.flex}>
      <ScreenContainer scrollRef={scrollRef}>
        <AppHeader title={t.campaignForm.title} subtitle={t.campaignForm.subtitle} showNewCampaign={false} />

        {launched ? (
          <LaunchSuccess
            campaign={launched.campaign}
            draft={launched.draft}
            forecast={launched.forecast}
            onOpenBoard={() =>
              router.navigate({ pathname: '/candidates', params: { campaign: launched.campaign.id } })
            }
            onDashboard={() => router.navigate('/')}
            onCreateAnother={startOver}
          />
        ) : (
          <View className="mt-6 gap-6 xl:flex-row xl:items-start">
            <Animated.View entering={FadeInDown.delay(80).duration(450)} className="xl:flex-[7]">
              <View
                className="rounded-3xl border border-white/80 bg-white/70 p-5 dark:border-white/15 dark:bg-gray-900 md:p-6"
                style={{ boxShadow: palette.shadow.panel }}
              >
                <StepIndicator current={stepIndex} furthest={furthest} onSelect={goToStep} />
                <View className="mt-4 xl:hidden">
                  <ForecastStrip draft={draft} forecast={forecast} />
                </View>
                <View className="my-5 h-px bg-slate-100 dark:bg-white/10" />

                <Animated.View key={step} entering={StepEntering.duration(280)}>
                  {step === 'role' && <RoleStep draft={draft} update={update} errors={visibleErrors} />}
                  {step === 'requirements' && (
                    <RequirementsStep
                      draft={draft}
                      update={update}
                      errors={visibleErrors}
                      marketMedian={forecast.marketMedian}
                    />
                  )}
                  {step === 'agents' && <AgentsStep draft={draft} update={update} errors={visibleErrors} />}
                  {step === 'review' && (
                    <ReviewStep draft={draft} onEdit={(target) => goToStep(WIZARD_STEPS.indexOf(target))} />
                  )}
                </Animated.View>

                {(showFixPrompt || launchFailed) && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    accessibilityLiveRegion="polite"
                    className="mt-5 flex-row items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 dark:bg-rose-500/10"
                  >
                    <Ionicons name="alert-circle" size={16} color={palette.rose} />
                    <Text className="flex-1 text-sm text-rose-700 dark:text-rose-300">
                      {launchFailed ? t.campaignForm.launchError : t.campaignForm.fixErrors}
                    </Text>
                  </Animated.View>
                )}

                <View className="mt-6 flex-row items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-white/10">
                  {stepIndex === 0 ? (
                    <Button variant="ghost" label={t.campaignForm.cancel} onPress={handleCancel} />
                  ) : (
                    <Button
                      variant="secondary"
                      icon="arrow-back"
                      label={t.campaignForm.back}
                      onPress={() => goToStep(stepIndex - 1)}
                    />
                  )}
                  {step === 'review' ? (
                    <Button
                      icon="rocket-outline"
                      label={launching ? t.campaignForm.launching : t.campaignForm.launch}
                      loading={launching}
                      onPress={handleLaunch}
                    />
                  ) : (
                    <Button
                      icon="arrow-forward"
                      iconAfter
                      label={t.campaignForm.continue}
                      onPress={handleContinue}
                    />
                  )}
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).duration(450)} className="xl:flex-[5]">
              <ForecastPanel draft={draft} forecast={forecast} fixes={fixes} onApplyFix={handleApplyFix} />
            </Animated.View>
          </View>
        )}
      </ScreenContainer>

      <Toast
        toastKey={toast?.key ?? null}
        message={toast ? t.forecast.applied(describeFix(toast.fix, toast.before, t, pick)) : ''}
        icon="sparkles"
        actionLabel={t.board.undo}
        onAction={handleUndoFix}
        onDismiss={dismissToast}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
