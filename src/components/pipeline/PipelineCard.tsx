import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useI18n } from '../../i18n';
import { STALLED_AFTER_DAYS, type PipelineCandidate } from '../../services/pipeline';
import { useAppTheme } from '../../theme';
import { getInitials } from '../../utils/formatters';
import { getMatchTier } from '../../utils/matchScore';
import { PressableScale } from '../ui/PressableScale';
import { CARD_DRAG_MODE } from './dragMode';
import { STAGE_STYLES } from './stageStyles';

const AVATAR_GRADIENTS = [
  ['#4F46E5', '#7C3AED'],
  ['#2563EB', '#06B6D4'],
  ['#7C3AED', '#C026D3'],
  ['#0F766E', '#2563EB'],
  ['#DB2777', '#F59E0B'],
] as const;
const LIFT_SPRING = { damping: 16, stiffness: 260, mass: 0.7 };
const RETURN_SPRING = { damping: 18, stiffness: 220, mass: 0.8 };
const MAX_SKILLS = 2;

type PipelineCardProps = {
  candidate: PipelineCandidate;
  columnIndex: number;
  columnCount: number;
  /** Column width plus the gap between columns: one step of horizontal travel. */
  columnStep: number;
  /** Column under the card being dragged, or -1. Shared with the board. */
  hoverIndex: SharedValue<number>;
  /** Column the dragged card came from, or -1. Shared with the board. */
  dragFromIndex: SharedValue<number>;
  /** Campaign name, shown when the board mixes campaigns. */
  campaignLabel?: string;
  /** The card was just moved here, so it lands with a pop instead of the usual fade. */
  landed: boolean;
  enterDelay: number;
  /** Next stage's label; omitted in the last column. */
  nextStageLabel?: string;
  onDrop: (candidateId: string, columnIndex: number) => void;
  onAdvance: (candidate: PipelineCandidate) => void;
  onOpen: (candidate: PipelineCandidate) => void;
};

/**
 * Board card. Drag it to another column (mouse drag on web, press-and-hold on touch), tap it for
 * the full profile, or use the arrow to send it to the next stage.
 */
export function PipelineCard({
  candidate,
  columnIndex,
  columnCount,
  columnStep,
  hoverIndex,
  dragFromIndex,
  campaignLabel,
  landed,
  enterDelay,
  nextStageLabel,
  onDrop,
  onAdvance,
  onOpen,
}: PipelineCardProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);
  // Set while a drag is under way, so the click that ends a mouse drag doesn't open the profile.
  const dragged = useSharedValue(false);

  const tier = getMatchTier(candidate.matchScore);
  const stage = STAGE_STYLES[candidate.stage];
  const isHired = candidate.stage === 'hired';
  const isStalled = !isHired && candidate.daysInStage > STALLED_AFTER_DAYS;
  const visibleSkills = candidate.skills.slice(0, MAX_SKILLS);
  const hiddenSkills = candidate.skills.length - visibleSkills.length;
  const gradient = AVATAR_GRADIENTS[hashId(candidate.id) % AVATAR_GRADIENTS.length];

  const pan = usePanGesture({
    // A mouse can drag straight away; native touch holds first, so swipes still scroll the board;
    // touch browsers don't drag at all (see dragMode.ts).
    // (Plain keys, not a spread: the worklets Babel plugin can't transform spreads in this config.)
    enabled: CARD_DRAG_MODE !== 'none',
    minDistance: CARD_DRAG_MODE === 'mouse' ? 6 : undefined,
    activateAfterLongPress: CARD_DRAG_MODE === 'hold' ? 220 : undefined,
    activeCursor: 'grabbing',
    onActivate: () => {
      dragged.set(true);
      lifted.set(withSpring(1, LIFT_SPRING));
      dragFromIndex.set(columnIndex);
      hoverIndex.set(columnIndex);
    },
    onUpdate: (event) => {
      translateX.set(event.translationX);
      translateY.set(event.translationY);
      const target = Math.min(columnCount - 1, Math.max(0, columnIndex + Math.round(event.translationX / columnStep)));
      if (hoverIndex.get() !== target) hoverIndex.set(target);
    },
    onDeactivate: (event) => {
      const target = hoverIndex.get();
      hoverIndex.set(-1);
      if (!event.canceled && target >= 0 && target !== columnIndex) {
        // The board moves the candidate, which re-mounts this card in its new column.
        scheduleOnRN(onDrop, candidate.id, target);
        return;
      }
      dragFromIndex.set(-1);
      translateX.set(withSpring(0, RETURN_SPRING));
      translateY.set(withSpring(0, RETURN_SPRING));
      lifted.set(withSpring(0, LIFT_SPRING));
    },
  });

  // Stacking lives on the outer view (a sibling of the other cards); movement on the inner one,
  // so the drag transform never fights the layout animation.
  const stackStyle = useAnimatedStyle(() => ({ zIndex: lifted.get() > 0.01 ? 10 : 0 }));
  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: 1 + lifted.get() * 0.04 },
      { rotate: `${lifted.get() * 2}deg` },
    ],
  }));
  const liftShadowStyle = useAnimatedStyle(() => ({ opacity: lifted.get() }));

  return (
    <Animated.View
      entering={
        landed
          ? ZoomIn.springify().damping(14).stiffness(180)
          : FadeInDown.delay(enterDelay).duration(320)
      }
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.springify().damping(18).stiffness(170)}
      style={stackStyle}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={dragStyle}>
          <Animated.View style={[styles.liftShadow, { boxShadow: palette.shadow.deck }, liftShadowStyle]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.board.openDetails(candidate.name)}
            onPressIn={() => dragged.set(false)}
            onPress={() => {
              if (!dragged.get()) onOpen(candidate);
            }}
            // Opaque in both themes: a lifted card must hide the cards it passes over.
            className="rounded-2xl border border-slate-200/80 bg-white p-3 hover:border-indigo-200 dark:border-white/15 dark:bg-[#1c2333] dark:hover:border-indigo-400/40"
            style={{ boxShadow: palette.shadow.stat }}
          >
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text className="text-xs font-bold text-white">{getInitials(candidate.name)}</Text>
              </View>
              {/* The name gets the whole line (columns are narrow); the score shares the role's line. */}
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-slate-900 dark:text-slate-50" numberOfLines={1}>
                  {candidate.name}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
                    {pick(candidate.role)}
                  </Text>
                  <View className={`rounded-full border px-1.5 py-px ${tier.badgeClassName}`}>
                    <Text className={`text-[11px] font-bold ${tier.textClassName}`}>{candidate.matchScore}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {campaignLabel && (
              <Text
                className="mt-2 text-[11px] font-medium text-indigo-600 dark:text-indigo-300"
                numberOfLines={1}
              >
                {campaignLabel}
              </Text>
            )}

            <View className="mt-2 flex-row flex-wrap gap-1">
              {visibleSkills.map((skill) => (
                <View key={skill} className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-white/10">
                  <Text className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{skill}</Text>
                </View>
              ))}
              {hiddenSkills > 0 && (
                <View className="rounded-md px-1 py-0.5">
                  <Text className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    +{hiddenSkills}
                  </Text>
                </View>
              )}
            </View>

            <View className="mt-3 flex-row items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-white/10">
              <Ionicons name={stage.icon} size={13} color={stage.color(palette)} />
              <Text className="flex-1 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
                {t.board.agentStatus[candidate.stage]}
              </Text>
            </View>

            {/* Right padding keeps the chip clear of the advance arrow, which sits over this row. */}
            <View className={`mt-2 min-h-7 flex-row items-center ${nextStageLabel ? 'pr-9' : ''}`}>
              {isHired ? (
                <View className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 dark:bg-emerald-500/15">
                  <Ionicons name="checkmark" size={12} color={palette.emerald} />
                  <Text className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {t.board.stages.hired}
                  </Text>
                </View>
              ) : (
                <View
                  className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${
                    isStalled ? 'bg-amber-50 dark:bg-amber-500/15' : 'bg-slate-100 dark:bg-white/10'
                  }`}
                >
                  <Ionicons
                    name={isStalled ? 'warning-outline' : 'time-outline'}
                    size={12}
                    color={isStalled ? palette.amber : palette.icon.muted}
                  />
                  <Text
                    className={`text-[11px] font-semibold ${
                      isStalled ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isStalled ? t.board.stalled(candidate.daysInStage) : t.board.daysInStage(candidate.daysInStage)}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
          {/* A sibling laid over the card rather than a child of it: one button can't hold another. */}
          {nextStageLabel && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t.board.moveA11y(candidate.name, nextStageLabel)}
              onPressIn={() => dragged.set(false)}
              onPress={() => {
                if (!dragged.get()) onAdvance(candidate);
              }}
              hitSlop={6}
              className="h-7 w-7 items-center justify-center rounded-lg bg-slate-100 hover:bg-indigo-100 dark:bg-white/10 dark:hover:bg-indigo-500/25"
              style={styles.advance}
            >
              <Ionicons name="arrow-forward" size={14} color={palette.indigo} />
            </PressableScale>
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/** Stable small number per id, so a candidate keeps the same avatar colours everywhere. */
function hashId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const styles = StyleSheet.create({
  liftShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    pointerEvents: 'none',
  },
  // Lines up with the footer row inside the card's 12px padding.
  advance: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
});
