import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { PIPELINE_STAGES, type PipelineCandidate, type PipelineStage } from '../../services/pipeline';
import { PipelineColumn } from './PipelineColumn';

/** Columns never get narrower than this; below it the board scrolls sideways instead. */
const MIN_COLUMN_WIDTH = 212;
const COLUMN_GAP = 10;
const COLUMN_STAGGER_MS = 70;

type PipelineBoardProps = {
  candidates: PipelineCandidate[];
  /** Campaign names by id; pass when the board shows more than one campaign. */
  campaignNames?: Record<string, string>;
  /** Most recently moved card, which gets a landing animation in its new column. */
  landedId: string | null;
  enterDelay?: number;
  onMove: (candidateId: string, stage: PipelineStage) => void;
  onOpen: (candidate: PipelineCandidate) => void;
};

/** Kanban board: one column per hiring stage, cards draggable between them. */
export function PipelineBoard({
  candidates,
  campaignNames,
  landedId,
  enterDelay = 0,
  onMove,
  onOpen,
}: PipelineBoardProps) {
  const { t } = useI18n();
  const [boardWidth, setBoardWidth] = useState(0);
  // Drag state shared with every column and card, read on the UI thread while a card moves.
  const hoverIndex = useSharedValue(-1);
  const dragFromIndex = useSharedValue(-1);

  const columnCount = PIPELINE_STAGES.length;
  const columnWidth = Math.max(MIN_COLUMN_WIDTH, (boardWidth - COLUMN_GAP * (columnCount - 1)) / columnCount);
  const columnStep = columnWidth + COLUMN_GAP;

  const handleDrop = useCallback(
    (candidateId: string, columnIndex: number) => {
      dragFromIndex.set(-1);
      onMove(candidateId, PIPELINE_STAGES[columnIndex]);
    },
    [dragFromIndex, onMove],
  );

  const handleAdvance = useCallback(
    (candidate: PipelineCandidate) => {
      const next = PIPELINE_STAGES[PIPELINE_STAGES.indexOf(candidate.stage) + 1];
      if (next) onMove(candidate.id, next);
    },
    [onMove],
  );

  const handleLayout = (event: LayoutChangeEvent) => setBoardWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={handleLayout}>
      {boardWidth > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: COLUMN_GAP, alignItems: 'stretch' }}
        >
          {PIPELINE_STAGES.map((stage, index) => {
            const nextStage = PIPELINE_STAGES[index + 1];
            return (
              <PipelineColumn
                key={stage}
                stage={stage}
                index={index}
                columnCount={columnCount}
                width={columnWidth}
                columnStep={columnStep}
                candidates={candidates.filter((candidate) => candidate.stage === stage)}
                hoverIndex={hoverIndex}
                dragFromIndex={dragFromIndex}
                campaignNames={campaignNames}
                landedId={landedId}
                enterDelay={enterDelay + index * COLUMN_STAGGER_MS}
                nextStageLabel={nextStage ? t.board.stages[nextStage] : undefined}
                onDrop={handleDrop}
                onAdvance={handleAdvance}
                onOpen={onOpen}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
