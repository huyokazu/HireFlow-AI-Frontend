import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { PIPELINE_STAGES, type PipelineCandidate, type PipelineStage } from '../../services/pipeline';
import { useAppTheme } from '../../theme';
import { CandidateCard } from '../CandidateCardSwap';
import { PressableScale } from '../ui/PressableScale';
import { SectionLabel } from '../ui/SectionLabel';
import { STAGE_STYLES } from './stageStyles';

const CARD_HEIGHT = 470;

type CandidateDetailModalProps = {
  /** Open while a candidate is set. */
  candidate: PipelineCandidate | null;
  onMove: (candidate: PipelineCandidate, stage: PipelineStage) => void;
  onClose: () => void;
};

/** Full candidate profile with a stage picker, opened by tapping a board card. */
export function CandidateDetailModal({ candidate, onMove, onClose }: CandidateDetailModalProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();

  return (
    <Modal transparent visible={candidate !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-slate-950/60">
        <ScrollView contentContainerStyle={styles.content}>
          {/* Clicking the dimmed area around the card closes the profile. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.board.close}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          {candidate && (
            <Animated.View entering={ZoomIn.springify().damping(16)} className="w-full max-w-sm gap-3">
              <View style={{ height: CARD_HEIGHT }}>
                <CandidateCard
                  candidate={candidate}
                  accentIndex={PIPELINE_STAGES.indexOf(candidate.stage)}
                  shortlisted={candidate.stage === 'interview' || candidate.stage === 'offer'}
                  maxSkills={6}
                />
              </View>

              <View
                className="rounded-3xl border border-white/80 bg-white p-4 dark:border-white/15 dark:bg-gray-900"
                style={{ boxShadow: palette.shadow.panel }}
              >
                <SectionLabel>{t.board.moveTo}</SectionLabel>
                <View className="mt-2.5 flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                  {PIPELINE_STAGES.map((stage) => {
                    const selected = stage === candidate.stage;
                    return (
                      <PressableScale
                        key={stage}
                        accessibilityRole="radio"
                        aria-checked={selected}
                        accessibilityLabel={
                          selected
                            ? `${t.board.currentStage}: ${t.board.stages[stage]}`
                            : t.board.moveA11y(candidate.name, t.board.stages[stage])
                        }
                        disabled={selected}
                        onPress={() => onMove(candidate, stage)}
                        className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                          selected
                            ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/15 dark:bg-white/5 dark:hover:bg-indigo-500/15'
                        }`}
                      >
                        <View
                          className={`h-2 w-2 rounded-full ${selected ? 'bg-white' : STAGE_STYLES[stage].dotClassName}`}
                        />
                        <Text
                          className={`text-xs font-semibold ${
                            selected ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {t.board.stages[stage]}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
                <PressableScale
                  accessibilityRole="button"
                  onPress={onClose}
                  className="mt-4 h-11 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.board.close}</Text>
                </PressableScale>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
});
