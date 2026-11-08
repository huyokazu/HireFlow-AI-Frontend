import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { CandidateDetailModal } from '../components/pipeline/CandidateDetailModal';
import { CARD_DRAG_MODE } from '../components/pipeline/dragMode';
import { PipelineBoard } from '../components/pipeline/PipelineBoard';
import { STAGE_STYLES } from '../components/pipeline/stageStyles';
import { PressableScale } from '../components/ui/PressableScale';
import { PulseRing } from '../components/ui/pulse';
import { Toast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import type { PipelineStage } from '../services/pipeline';
import { useWorkspace, type PipelineMove } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

/** How long a just-moved card keeps its "landing" entrance, in case it re-mounts. */
const LANDING_MS = 900;

type MoveToast = { key: number; move: PipelineMove; name: string };

/** Kanban CV board: every candidate by hiring stage, filterable by campaign via `?campaign=`. */
export function PipelineBoardScreen() {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ campaign?: string }>();
  const { summary, pipeline, moveCandidate, undoMove } = useWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<MoveToast | null>(null);

  // A handful of cards, so these are cheap enough to derive on every render.
  const campaigns = summary?.campaigns ?? [];
  const activeCampaign = campaigns.find((campaign) => campaign.id === params.campaign) ?? null;
  const activeCampaignId = activeCampaign?.id ?? null;
  const visible = (pipeline ?? []).filter(
    (candidate) => !activeCampaignId || candidate.campaignId === activeCampaignId,
  );
  // Cards name their campaign only when the board mixes campaigns.
  const campaignNames = activeCampaignId
    ? undefined
    : Object.fromEntries(campaigns.map((campaign) => [campaign.id, pick(campaign.title)]));
  const countByCampaign: Record<string, number> = {};
  for (const candidate of pipeline ?? []) {
    countByCampaign[candidate.campaignId] = (countByCampaign[candidate.campaignId] ?? 0) + 1;
  }

  useEffect(() => {
    if (!landedId) return;
    const timer = setTimeout(() => setLandedId(null), LANDING_MS);
    return () => clearTimeout(timer);
  }, [landedId]);

  const handleMove = useCallback(
    (candidateId: string, stage: PipelineStage) => {
      const name = pipeline?.find((candidate) => candidate.id === candidateId)?.name ?? '';
      const move = moveCandidate(candidateId, stage);
      if (!move) return;
      setLandedId(candidateId);
      setToast({ key: Date.now(), move, name });
    },
    [moveCandidate, pipeline],
  );

  const handleUndo = useCallback(() => {
    if (!toast) return;
    undoMove(toast.move);
    setLandedId(toast.move.candidateId);
    setToast(null);
  }, [toast, undoMove]);

  const dismissToast = useCallback(() => setToast(null), []);

  const selectCampaign = (campaignId: string | null) => router.setParams({ campaign: campaignId ?? undefined });

  const openCandidate = pipeline?.find((candidate) => candidate.id === openId) ?? null;
  // The board holds the candidates the AI agents put in front of HR, while the dashboard counts every
  // applicant, so the header says how many of those are on the board.
  const subtitle =
    !pipeline || !summary
      ? ''
      : activeCampaign
        ? `${pick(activeCampaign.title)} · ${t.board.subtitle(visible.length, activeCampaign.candidates)}`
        : t.board.subtitle(pipeline.length, summary.candidatesInPipeline);

  return (
    <View style={styles.flex}>
      <ScreenContainer wide>
        <AppHeader title={t.board.title} subtitle={subtitle} />

        {!pipeline || !summary ? (
          <ActivityIndicator className="mt-24" color={palette.indigo} />
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(80).duration(450)} className="mt-6 gap-3">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                accessibilityRole="radiogroup"
                accessibilityLabel={t.board.filterLabel}
              >
                <FilterChip
                  label={t.board.allCampaigns}
                  count={pipeline.length}
                  selected={!activeCampaign}
                  onPress={() => selectCampaign(null)}
                />
                {campaigns.map((campaign) => (
                  <FilterChip
                    key={campaign.id}
                    label={pick(campaign.title)}
                    count={countByCampaign[campaign.id] ?? 0}
                    selected={campaign.id === activeCampaignId}
                    onPress={() => selectCampaign(campaign.id)}
                  />
                ))}
              </ScrollView>
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="hand-left-outline" size={14} color={palette.icon.faint} />
                <Text className="shrink text-xs text-slate-500 dark:text-slate-400">
                  {CARD_DRAG_MODE === 'mouse'
                    ? t.board.dragHint
                    : CARD_DRAG_MODE === 'hold'
                      ? t.board.holdHint
                      : t.board.tapHint}
                </Text>
              </View>
            </Animated.View>

            {activeCampaign && visible.length === 0 && (
              <Animated.View
                entering={FadeIn.duration(300)}
                className="mt-4 flex-row items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-400/20 dark:bg-indigo-500/10"
              >
                <View className="h-2.5 w-2.5 items-center justify-center">
                  <PulseRing color={palette.indigo} active size={10} />
                  <View className="h-2.5 w-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                </View>
                <Text className="flex-1 text-sm text-indigo-900 dark:text-indigo-200">{t.board.newCampaignEmpty}</Text>
              </Animated.View>
            )}

            <View className="mt-4">
              <PipelineBoard
                candidates={visible}
                campaignNames={campaignNames}
                landedId={landedId}
                enterDelay={160}
                onMove={handleMove}
                onOpen={(candidate) => setOpenId(candidate.id)}
              />
            </View>
          </>
        )}
      </ScreenContainer>

      <Toast
        toastKey={toast?.key ?? null}
        message={toast ? t.board.moved[toast.move.to](toast.name) : ''}
        icon={toast ? STAGE_STYLES[toast.move.to].icon : undefined}
        actionLabel={t.board.undo}
        onAction={handleUndo}
        onDismiss={dismissToast}
      />

      <CandidateDetailModal
        candidate={openCandidate}
        onClose={() => setOpenId(null)}
        onMove={(candidate, stage) => {
          setOpenId(null);
          handleMove(candidate.id, stage);
        }}
      />
    </View>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="radio"
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
        <Text
          className={`text-xs font-semibold ${selected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {count}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { gap: 8 },
});
