import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { Candidate } from '../../services/candidates';
import { useAppTheme } from '../../theme';
import { ActionButton } from '../ui/ActionButton';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Burst } from '../ui/Burst';
import { PressableScale } from '../ui/PressableScale';
import { CandidateCard } from './CandidateCard';
import { DECK_DEPTH, DECK_SLOTS, SwapCard, type ExitVector, type SwapDirection, type SwapEvent } from './SwapCard';

/** How long the Shortlist button says "Shortlisted" after each shortlist. */
const SHORTLIST_FLASH_MS = 750;
const SHORTLIST_PARTICLES = ['#10B981', '#6366F1', '#34D399', '#A78BFA'] as const;

type CandidateCardSwapProps = {
  candidates: Candidate[];
  /** Upper bound; the card shrinks to fit narrower containers. */
  maxCardWidth?: number;
  cardHeight?: number;
  /** Candidates already shortlisted elsewhere (e.g. moved on the board); read once on mount. */
  initialShortlistedIds?: string[];
  onActiveCandidateChange?: (candidate: Candidate, index: number) => void;
  onShortlist?: (candidate: Candidate) => void;
  onSkip?: (candidate: Candidate) => void;
};

/**
 * 3D deck of candidate cards, three drawn at a time. Skip flings the front card off to the left,
 * Shortlist to the right, and the cards behind spring forward into its place.
 */
export function CandidateCardSwap({
  candidates,
  maxCardWidth = 360,
  cardHeight = 500,
  initialShortlistedIds,
  onActiveCandidateChange,
  onShortlist,
  onSkip,
}: CandidateCardSwapProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [frontIndex, setFrontIndex] = useState(0);
  const [lastSwap, setLastSwap] = useState<SwapEvent>({ direction: 'next' });
  const [shortlistedIds, setShortlistedIds] = useState<string[]>(initialShortlistedIds ?? []);
  // Each skip or shortlist (by button or by swipe) fires a burst on its button as the card flies off.
  const [skipBursts, setSkipBursts] = useState(0);
  const [shortlistBursts, setShortlistBursts] = useState(0);
  // When the last shortlist happened, so the button can flash "Shortlisted" for a moment.
  const [shortlistedAt, setShortlistedAt] = useState<number | null>(null);

  useEffect(() => {
    if (shortlistedAt === null) return undefined;
    const timer = setTimeout(() => setShortlistedAt(null), SHORTLIST_FLASH_MS);
    return () => clearTimeout(timer);
  }, [shortlistedAt]);

  const total = candidates.length;
  const activeIndex = total > 0 ? frontIndex % total : 0;
  const stackCount = Math.max(Math.min(DECK_SLOTS, total), 1);
  const cardWidth = Math.min(maxCardWidth, containerWidth);
  const canSwap = total > 1;
  const current = candidates[activeIndex];

  const swapTo = useCallback(
    (direction: SwapDirection, exit?: ExitVector) => {
      if (total < 2) return;
      const nextIndex = (activeIndex + (direction === 'next' ? 1 : -1) + total) % total;
      setLastSwap({ direction, exit });
      setFrontIndex(nextIndex);
      onActiveCandidateChange?.(candidates[nextIndex], nextIndex);
    },
    [activeIndex, candidates, onActiveCandidateChange, total],
  );

  const skip = useCallback(
    (exit?: ExitVector) => {
      if (current) onSkip?.(current);
      setSkipBursts((count) => count + 1);
      swapTo('next', exit ?? { x: -1 });
    },
    [current, onSkip, swapTo],
  );

  const shortlist = useCallback(
    (exit?: ExitVector) => {
      if (current) {
        setShortlistedIds((ids) => (ids.includes(current.id) ? ids : [...ids, current.id]));
        onShortlist?.(current);
      }
      setShortlistBursts((count) => count + 1);
      setShortlistedAt(Date.now());
      swapTo('next', exit ?? { x: 1 });
    },
    [current, onShortlist, swapTo],
  );

  // Swipe right to shortlist, left to skip.
  const handleSwipe = useCallback(
    (exit: ExitVector) => (exit.x > 0 ? shortlist(exit) : skip(exit)),
    [shortlist, skip],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  if (total === 0) {
    return (
      <View className="w-full items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 dark:border-white/15 dark:bg-white/5">
        <Ionicons name="people-outline" size={28} color={palette.icon.faint} />
        <Text className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-200">
          {t.deck.emptyTitle}
        </Text>
        <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">{t.deck.emptyBody}</Text>
      </View>
    );
  }

  const shortlistedCount = shortlistedIds.length;

  return (
    <View className="w-full items-center" onLayout={handleLayout}>
      {cardWidth > 0 && (
        <>
          <View
            // Sits above the controls so a flying card passes in front of them.
            style={{ width: cardWidth, height: cardHeight + (stackCount > 1 ? DECK_DEPTH : 0), zIndex: 1 }}
          >
            {candidates.map((candidate, index) => {
              const slot = (index - activeIndex + total) % total;
              // Skip cards buried deep in the queue; keep the last two so their exit can finish.
              if (slot > stackCount && slot < total - 2) return null;
              return (
                <SwapCard
                  key={candidate.id}
                  slot={slot}
                  visibleCount={stackCount}
                  swap={lastSwap}
                  width={cardWidth}
                  height={cardHeight}
                  swipeEnabled={canSwap}
                  onSwipe={handleSwipe}
                  stampLabels={{ skip: t.deck.stampSkip, shortlist: t.deck.stampShortlist }}
                >
                  <CandidateCard
                    candidate={candidate}
                    accentIndex={index}
                    shortlisted={shortlistedIds.includes(candidate.id)}
                  />
                </SwapCard>
              );
            })}
          </View>

          <View
            className="mt-6 gap-2 rounded-2xl border border-white/80 bg-white/70 p-2 dark:border-white/10 dark:bg-white/5"
            style={{ width: cardWidth }}
          >
            <View className="flex-row items-center justify-between gap-3 px-2 pt-1">
              <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {activeIndex + 1}
                <Text className="font-normal text-slate-400 dark:text-slate-500"> / {total}</Text>
              </Text>
              {shortlistedCount > 0 ? (
                <Animated.View
                  entering={ZoomIn.springify()}
                  className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 dark:bg-emerald-500/15"
                >
                  <Ionicons name="checkmark-circle" size={13} color={palette.emerald} />
                  <AnimatedNumber
                    value={shortlistedCount}
                    countUpOnMount={false}
                    format={t.deck.shortlistedCount}
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                  />
                </Animated.View>
              ) : (
                <Text className="shrink text-right text-xs text-slate-400 dark:text-slate-500">
                  {canSwap ? t.deck.hint : t.deck.onlyMatch}
                </Text>
              )}
            </View>

            {/* Thumb-sized (48 px) controls; Shortlist gets the most room. */}
            <View className="flex-row items-center gap-2">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t.deck.previous}
                disabled={!canSwap}
                onPress={() => swapTo('prev')}
                className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white active:bg-slate-100 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:active:bg-white/10"
              >
                <Ionicons name="arrow-undo" size={18} color={palette.icon.strong} />
              </PressableScale>
              <View className="flex-1">
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={current ? t.deck.skipA11y(current.name) : t.deck.skip}
                  disabled={!canSwap}
                  onPress={() => skip()}
                  glowColor="rgba(244, 63, 94, 0.45)"
                  className="h-12 flex-row items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 hover:bg-rose-50 active:bg-rose-50 disabled:opacity-40 dark:border-rose-400/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                >
                  <Ionicons name="close" size={18} color={palette.rose} />
                  <Text className="text-sm font-semibold text-rose-600 dark:text-rose-300" numberOfLines={1}>
                    {t.deck.skip}
                  </Text>
                </PressableScale>
                <Burst trigger={skipBursts} color={palette.rose} />
              </View>
              <View style={{ flex: 1.4 }}>
                <ActionButton
                  tone="emerald"
                  compact
                  icon="checkmark"
                  state={shortlistedAt !== null ? 'success' : 'idle'}
                  label={t.deck.shortlist}
                  loadingLabel={t.deck.shortlist}
                  successLabel={t.deck.shortlisted}
                  accessibilityLabel={current ? t.deck.shortlistA11y(current.name) : t.deck.shortlist}
                  onPress={() => shortlist()}
                />
                <Burst
                  trigger={shortlistBursts}
                  color={palette.emerald}
                  particleColors={SHORTLIST_PARTICLES}
                  particleCount={10}
                />
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
