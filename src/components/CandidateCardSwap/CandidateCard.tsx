import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import type { Candidate } from '../../services/candidates';
import { RUBRIC_MAX, type ProofOfSkill } from '../../services/talent';
import { useAppTheme } from '../../theme';
import { getInitials } from '../../utils/formatters';
import { getMatchTier } from '../../utils/matchScore';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { SectionLabel } from '../ui/SectionLabel';

// Rotated per card so neighbouring cards in the stack stay visually distinct.
const HEADER_GRADIENTS = [
  ['#4F46E5', '#7C3AED'],
  ['#2563EB', '#06B6D4'],
  ['#1E1B4B', '#4338CA'],
  ['#7C3AED', '#C026D3'],
  ['#0F766E', '#2563EB'],
] as const;

type CandidateCardProps = {
  candidate: Candidate;
  /** Picks the header gradient; pass the candidate's position in the list. */
  accentIndex: number;
  maxSkills?: number;
  shortlisted?: boolean;
};

export function CandidateCard({
  candidate,
  accentIndex,
  maxSkills = 5,
  shortlisted = false,
}: CandidateCardProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const tier = getMatchTier(candidate.matchScore);
  const visibleSkills = candidate.skills.slice(0, maxSkills);
  const hiddenSkillCount = candidate.skills.length - visibleSkills.length;
  const gradient = HEADER_GRADIENTS[accentIndex % HEADER_GRADIENTS.length];

  return (
    <View className="flex-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-white/15 dark:bg-gray-900">
      <View className="overflow-hidden px-5 pb-4 pt-4">
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute -right-12 -top-20 h-44 w-44 rounded-full bg-white/10" />
        <View className="absolute -bottom-24 left-16 h-36 w-36 rounded-full bg-white/5" />

        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <View className="h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/20">
              <Text className="text-base font-bold text-white">{getInitials(candidate.name)}</Text>
            </View>
            {shortlisted && (
              <Animated.View
                entering={ZoomIn.springify()}
                className="flex-row items-center gap-1 rounded-full bg-emerald-500 px-2 py-1"
              >
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                  {t.candidate.shortlisted}
                </Text>
              </Animated.View>
            )}
          </View>
          <View className="flex-row items-baseline gap-1 rounded-full border border-white/30 bg-white/15 px-3 py-1">
            <AnimatedNumber
              value={candidate.matchScore}
              format={(value) => `${value}%`}
              delay={300}
              className="text-lg font-bold text-white"
            />
            <Text className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
              {t.candidate.match}
            </Text>
          </View>
        </View>

        <Text className="mt-3 text-lg font-bold text-white" numberOfLines={1}>
          {candidate.name}
        </Text>
        <Text className="text-sm text-white/80" numberOfLines={1}>
          {pick(candidate.role)}
        </Text>
      </View>

      <View className="flex-1 gap-3.5 px-5 pb-5 pt-4">
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <MetaItem icon="location-outline" label={pick(candidate.location)} color={palette.icon.muted} />
          <MetaItem
            icon="briefcase-outline"
            label={t.candidate.yearsOfExperience(candidate.yearsOfExperience)}
            color={palette.icon.muted}
          />
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <SectionLabel>{candidate.proof ? t.candidate.proofOfSkill : t.candidate.matchScore}</SectionLabel>
            <View className={`rounded-full border px-2 py-0.5 ${tier.badgeClassName}`}>
              <Text className={`text-xs font-semibold ${tier.textClassName}`}>
                {t.candidate.tiers[tier.key]}
              </Text>
            </View>
          </View>
          {candidate.proof ? (
            <ProofOfSkillBar proof={candidate.proof} />
          ) : (
            <View className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <View
                className={`h-full rounded-full ${tier.barClassName}`}
                style={{ width: `${Math.max(0, Math.min(100, candidate.matchScore))}%` }}
              />
            </View>
          )}
        </View>

        <View>
          <SectionLabel>{t.candidate.keySkills}</SectionLabel>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <View
                key={skill}
                className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 dark:border-indigo-400/20 dark:bg-indigo-500/10"
              >
                <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{skill}</Text>
              </View>
            ))}
            {hiddenSkillCount > 0 && (
              <View className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/10">
                <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  +{hiddenSkillCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Grows into spare space but never shrinks below its text, which would clip mid-line. */}
        <View
          className="grow rounded-2xl border border-indigo-100/80 bg-indigo-50/40 p-3.5 dark:border-indigo-400/20 dark:bg-indigo-500/10"
          style={{ boxShadow: palette.shadow.aiGlow }}
        >
          <View className="mb-1.5 flex-row items-center gap-1.5">
            <Ionicons name="sparkles" size={14} color={palette.indigo} />
            <Text className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              {t.candidate.aiAssessment}
            </Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" numberOfLines={4}>
            {pick(candidate.aiAssessment)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const RUBRIC_PARTS = [
  { key: 'skills', fill: 'bg-indigo-500 dark:bg-indigo-400', dot: 'bg-indigo-500 dark:bg-indigo-400' },
  { key: 'experience', fill: 'bg-violet-500 dark:bg-violet-400', dot: 'bg-violet-500 dark:bg-violet-400' },
  { key: 'other', fill: 'bg-sky-500 dark:bg-sky-400', dot: 'bg-sky-500 dark:bg-sky-400' },
] as const;

/**
 * The Talent Agent's rubric behind the match score: one track per part, as wide as the points it
 * is worth (50 / 30 / 20), filled to the points the candidate earned, with the numbers underneath.
 */
function ProofOfSkillBar({ proof }: { proof: ProofOfSkill }) {
  const { t } = useI18n();
  const { breakdown } = proof;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={t.candidate.rubricA11y(breakdown.skills, breakdown.experience, breakdown.other)}
    >
      <View className="h-2 flex-row gap-0.5">
        {RUBRIC_PARTS.map((part) => (
          <View
            key={part.key}
            className="h-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
            style={{ flex: RUBRIC_MAX[part.key] }}
          >
            <View
              className={`h-full rounded-full ${part.fill}`}
              style={{ width: `${(100 * breakdown[part.key]) / RUBRIC_MAX[part.key]}%` }}
            />
          </View>
        ))}
      </View>
      <View className="mt-1.5 flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
        {RUBRIC_PARTS.map((part) => (
          <View key={part.key} className="flex-row items-center gap-1">
            <View className={`h-1.5 w-1.5 rounded-full ${part.dot}`} />
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">
              {t.candidate.rubric[part.key]}{' '}
              <Text className="font-semibold text-slate-700 dark:text-slate-200">
                {breakdown[part.key]}/{RUBRIC_MAX[part.key]}
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MetaItem({
  icon,
  label,
  color,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-sm text-slate-500 dark:text-slate-400">{label}</Text>
    </View>
  );
}
