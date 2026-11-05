import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { STALLED_AFTER_DAYS, type PipelineCandidate, type PipelineStage } from '../../services/pipeline';
import { useAppTheme } from '../../theme';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { PulseRing } from '../ui/pulse';
import { PipelineCard } from './PipelineCard';
import { STAGE_STYLES } from './stageStyles';

const CARD_STAGGER_MS = 45;
const MAX_STAGGERED_CARDS = 6;
/** Narrower columns show the stalled count without its label, so the stage name isn't cut off. */
const FULL_STALLED_LABEL_MIN_WIDTH = 280;

type PipelineColumnProps = {
  stage: PipelineStage;
  index: number;
  columnCount: number;
  width: number;
  /** Column width plus gap: how far a card travels to reach the next column. */
  columnStep: number;
  candidates: PipelineCandidate[];
  hoverIndex: SharedValue<number>;
  dragFromIndex: SharedValue<number>;
  /** Campaign names by id; set when the board shows every campaign. */
  campaignNames?: Record<string, string>;
  landedId: string | null;
  enterDelay: number;
  nextStageLabel?: string;
  onDrop: (candidateId: string, columnIndex: number) => void;
  onAdvance: (candidate: PipelineCandidate) => void;
  onOpen: (candidate: PipelineCandidate) => void;
};

export function PipelineColumn({
  stage,
  index,
  columnCount,
  width,
  columnStep,
  candidates,
  hoverIndex,
  dragFromIndex,
  campaignNames,
  landedId,
  enterDelay,
  nextStageLabel,
  onDrop,
  onAdvance,
  onOpen,
}: PipelineColumnProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const style = STAGE_STYLES[stage];
  const stalledCount =
    stage === 'hired' ? 0 : candidates.filter((candidate) => candidate.daysInStage > STALLED_AFTER_DAYS).length;

  // The column a card is dragged out of sits above its neighbours, so the card passes over them.
  const columnStyle = useAnimatedStyle(() => ({ zIndex: dragFromIndex.get() === index ? 10 : 1 }));
  const dropZoneStyle = useAnimatedStyle(() => {
    const from = dragFromIndex.get();
    const isTarget = from !== -1 && from !== index && hoverIndex.get() === index;
    return { opacity: withTiming(isTarget ? 1 : 0, { duration: 140 }) };
  });

  return (
    <Animated.View
      accessibilityRole="list"
      accessibilityLabel={
        stalledCount > 0 ? `${t.board.stages[stage]}, ${t.board.stalledCount(stalledCount)}` : t.board.stages[stage]
      }
      className="rounded-3xl border border-white/80 bg-white/50 p-2.5 dark:border-white/10 dark:bg-white/5"
      style={[{ width }, columnStyle]}
    >
      <View className="mb-3 flex-row items-center justify-between gap-2 px-1">
        <View className="shrink flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 items-center justify-center">
            {stage !== 'hired' && candidates.length > 0 && (
              <PulseRing color={style.color(palette)} active size={10} />
            )}
            <View className={`h-2.5 w-2.5 rounded-full ${style.dotClassName}`} />
          </View>
          <Text className="shrink text-sm font-semibold text-slate-800 dark:text-slate-100" numberOfLines={1}>
            {t.board.stages[stage]}
          </Text>
          <View className="min-w-6 items-center rounded-full bg-slate-900/5 px-1.5 py-0.5 dark:bg-white/10">
            <AnimatedNumber
              value={candidates.length}
              countUpOnMount={false}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300"
            />
          </View>
        </View>
        {stalledCount > 0 && (
          // Hidden from screen readers: the column's label already says how many are stalled.
          <View
            aria-hidden
            className="flex-row items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 dark:bg-amber-500/15"
          >
            <Ionicons name="warning-outline" size={12} color={palette.amber} />
            <Text className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {width >= FULL_STALLED_LABEL_MIN_WIDTH ? t.board.stalledCount(stalledCount) : stalledCount}
            </Text>
          </View>
        )}
      </View>

      <View className="gap-2.5">
        {candidates.length === 0 ? (
          <View className="h-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-white/15">
            <Text className="text-xs text-slate-400 dark:text-slate-500">{t.board.emptyColumn}</Text>
          </View>
        ) : (
          candidates.map((candidate, cardIndex) => (
            <PipelineCard
              key={candidate.id}
              candidate={candidate}
              columnIndex={index}
              columnCount={columnCount}
              columnStep={columnStep}
              hoverIndex={hoverIndex}
              dragFromIndex={dragFromIndex}
              campaignLabel={campaignNames?.[candidate.campaignId]}
              landed={candidate.id === landedId}
              enterDelay={enterDelay + Math.min(cardIndex, MAX_STAGGERED_CARDS) * CARD_STAGGER_MS}
              nextStageLabel={nextStageLabel}
              onDrop={onDrop}
              onAdvance={onAdvance}
              onOpen={onOpen}
            />
          ))
        )}
      </View>

      {/* Highlights the column a dragged card would land in. */}
      <Animated.View
        className="items-center rounded-3xl border-2 border-dashed border-indigo-400 bg-indigo-500/5 pt-12 dark:border-indigo-400/70 dark:bg-indigo-400/10"
        style={[styles.dropZone, dropZoneStyle]}
      >
        <View className="rounded-full bg-indigo-600 px-3 py-1 dark:bg-indigo-500">
          <Text className="text-xs font-semibold text-white">{t.board.dropHere}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
});
