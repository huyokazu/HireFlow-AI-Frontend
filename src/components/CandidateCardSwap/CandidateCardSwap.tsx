import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import type { Candidate } from '../../services/candidates';
import { CandidateCard } from './CandidateCard';
import { SwapCard, type ExitVector, type SwapDirection, type SwapEvent } from './SwapCard';

type CandidateCardSwapProps = {
  candidates: Candidate[];
  /** Upper bound; the card shrinks to fit narrower containers. */
  maxCardWidth?: number;
  cardHeight?: number;
  /** How many cards are drawn in the stack, including the front one. */
  visibleCount?: number;
  /** Horizontal and vertical step between stacked cards. */
  offsetX?: number;
  offsetY?: number;
  skewDeg?: number;
  onActiveCandidateChange?: (candidate: Candidate, index: number) => void;
};

export function CandidateCardSwap({
  candidates,
  maxCardWidth = 360,
  cardHeight = 500,
  visibleCount = 4,
  offsetX = 22,
  offsetY = 26,
  skewDeg = 3,
  onActiveCandidateChange,
}: CandidateCardSwapProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [frontIndex, setFrontIndex] = useState(0);
  const [lastSwap, setLastSwap] = useState<SwapEvent>({ direction: 'next' });

  const total = candidates.length;
  const activeIndex = total > 0 ? frontIndex % total : 0;
  const stackCount = Math.max(Math.min(visibleCount, total), 1);
  const stackDepth = stackCount - 1;
  // Tighten the fan on narrow screens so the front card keeps most of the width.
  const stepX = Math.min(offsetX, containerWidth * 0.05);
  const cardWidth = Math.min(maxCardWidth, containerWidth - stackDepth * stepX);
  const canSwap = total > 1;

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

  const handleSwipe = useCallback((exit: ExitVector) => swapTo('next', exit), [swapTo]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  if (total === 0) {
    return (
      <View className="w-full items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12">
        <Ionicons name="people-outline" size={28} color="#94A3B8" />
        <Text className="mt-3 text-base font-semibold text-slate-700">No matched candidates yet</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">
          The Matching Agent will surface CVs here as soon as they are screened.
        </Text>
      </View>
    );
  }

  return (
    <View className="w-full items-center" onLayout={handleLayout}>
      {cardWidth > 0 && (
        <>
          <View
            // Sits above the controls so a dropping card passes in front of them.
            style={{
              width: cardWidth + stackDepth * stepX,
              height: cardHeight + stackDepth * offsetY,
              zIndex: 1,
            }}
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
                  offsetX={stepX}
                  offsetY={offsetY}
                  skewDeg={skewDeg}
                  swipeEnabled={canSwap}
                  onSwipe={handleSwipe}
                >
                  <CandidateCard candidate={candidate} accentIndex={index} />
                </SwapCard>
              );
            })}
          </View>

          <View
            className="mt-8 flex-row items-center justify-between rounded-2xl border border-white/80 bg-white/70 p-2"
            style={{ width: cardWidth + stackDepth * stepX }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous candidate"
              disabled={!canSwap}
              onPress={() => swapTo('prev')}
              className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white active:bg-slate-100 disabled:opacity-40"
            >
              <Ionicons name="arrow-back" size={18} color="#334155" />
            </Pressable>

            <View className="items-center">
              <Text className="text-sm font-semibold text-slate-900">
                {activeIndex + 1}
                <Text className="font-normal text-slate-400"> / {total}</Text>
              </Text>
              <Text className="text-xs text-slate-400">{canSwap ? 'Swipe or tap Next' : 'Only match'}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next candidate"
              disabled={!canSwap}
              onPress={() => swapTo('next')}
              className="h-11 flex-row items-center gap-1.5 rounded-xl bg-indigo-600 px-5 active:bg-indigo-700 disabled:opacity-40"
            >
              <Text className="text-sm font-semibold text-white">Next</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
