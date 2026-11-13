import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { Sourced } from '../../services/fallback';
import type { DiagnosisResult } from '../../services/selfHealing';
import { useAppTheme } from '../../theme';
import { ActionButton, type ActionState } from '../ui/ActionButton';

/** How long the button shows "Diagnosed" before it can run again. */
const DONE_HOLD_MS = 1400;

type Outcome = { found: number; fallback: boolean } | 'failed';

type DiagnosePanelProps = {
  /** Campaigns behind target with no open alert and no fix in progress. */
  campaignIds: string[];
  onDiagnose: (campaignId: string) => Promise<Sourced<DiagnosisResult>>;
};

/**
 * Runs the Optimization Agent on every campaign that is behind target but has no alert yet. Each
 * diagnosis answers within a few seconds, live or precomputed, and the panel says which.
 */
export function DiagnosePanel({ campaignIds, onDiagnose }: DiagnosePanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.selfHealingPage.diagnose;
  const [state, setState] = useState<ActionState>('idle');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (state !== 'success') return;
    const timer = setTimeout(() => setState('idle'), DONE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const run = async () => {
    setState('loading');
    setOutcome(null);
    try {
      const results = await Promise.all(campaignIds.map(onDiagnose));
      setOutcome({
        found: results.filter(({ data }) => data.alert && data.source !== 'existing').length,
        fallback: results.some(({ source, data }) => source === 'fallback' || data.source === 'fallback'),
      });
      setState('success');
    } catch (error) {
      console.warn('[self-healing] The diagnosis failed.', error);
      setOutcome('failed');
      setState('idle');
    }
  };

  return (
    <View className="gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-400/20 dark:bg-indigo-500/10">
      <View className="flex-row flex-wrap items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500">
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
        </View>
        <View className="min-w-[180px] flex-1">
          <Text className="text-sm font-semibold text-slate-900 dark:text-slate-50">{copy.title}</Text>
          <Text className="text-xs text-slate-600 dark:text-slate-300">{copy.body(campaignIds.length)}</Text>
        </View>
        <ActionButton
          state={state}
          label={copy.action}
          loadingLabel={copy.running}
          successLabel={copy.done}
          icon="pulse"
          onPress={run}
          disabled={campaignIds.length === 0}
          compact
        />
      </View>
      {outcome && (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="flex-row items-start gap-2">
          <Ionicons
            name={outcome === 'failed' ? 'alert-circle' : outcome.fallback ? 'flash' : 'cloud-done'}
            size={14}
            color={outcome === 'failed' ? palette.rose : outcome.fallback ? palette.amber : palette.emerald}
            style={{ marginTop: 2 }}
          />
          <Text className="flex-1 text-xs text-slate-600 dark:text-slate-300">
            {outcome === 'failed'
              ? copy.failed
              : outcome.fallback
                ? copy.resultFallback(outcome.found)
                : copy.resultLive(outcome.found)}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
