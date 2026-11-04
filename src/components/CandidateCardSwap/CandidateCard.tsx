import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Candidate } from '../../services/candidates';
import { formatYearsOfExperience, getInitials } from '../../utils/formatters';
import { getMatchTier } from '../../utils/matchScore';
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
};

export function CandidateCard({ candidate, accentIndex, maxSkills = 5 }: CandidateCardProps) {
  const tier = getMatchTier(candidate.matchScore);
  const visibleSkills = candidate.skills.slice(0, maxSkills);
  const hiddenSkillCount = candidate.skills.length - visibleSkills.length;
  const gradient = HEADER_GRADIENTS[accentIndex % HEADER_GRADIENTS.length];

  return (
    <View className="flex-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
      <View className="overflow-hidden px-5 pb-4 pt-4">
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute -right-12 -top-20 h-44 w-44 rounded-full bg-white/10" />
        <View className="absolute -bottom-24 left-16 h-36 w-36 rounded-full bg-white/5" />

        <View className="flex-row items-center justify-between">
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/20">
            <Text className="text-base font-bold text-white">{getInitials(candidate.name)}</Text>
          </View>
          <View className="flex-row items-baseline gap-1 rounded-full border border-white/30 bg-white/15 px-3 py-1">
            <Text className="text-lg font-bold text-white">{candidate.matchScore}%</Text>
            <Text className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
              Match
            </Text>
          </View>
        </View>

        <Text className="mt-3 text-lg font-bold text-white" numberOfLines={1}>
          {candidate.name}
        </Text>
        <Text className="text-sm text-white/80" numberOfLines={1}>
          {candidate.role}
        </Text>
      </View>

      <View className="flex-1 gap-3.5 px-5 pb-5 pt-4">
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <MetaItem icon="location-outline" label={candidate.location} />
          <MetaItem
            icon="briefcase-outline"
            label={formatYearsOfExperience(candidate.yearsOfExperience)}
          />
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <SectionLabel>Match score</SectionLabel>
            <View className={`rounded-full border px-2 py-0.5 ${tier.badgeClassName}`}>
              <Text className={`text-xs font-semibold ${tier.textClassName}`}>{tier.label}</Text>
            </View>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-slate-100">
            <View
              className={`h-full rounded-full ${tier.barClassName}`}
              style={{ width: `${Math.max(0, Math.min(100, candidate.matchScore))}%` }}
            />
          </View>
        </View>

        <View>
          <SectionLabel>Key skills</SectionLabel>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <View key={skill} className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1">
                <Text className="text-xs font-medium text-indigo-700">{skill}</Text>
              </View>
            ))}
            {hiddenSkillCount > 0 && (
              <View className="rounded-full bg-slate-100 px-2.5 py-1">
                <Text className="text-xs font-medium text-slate-500">+{hiddenSkillCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Grows into spare space but never shrinks below its text, which would clip mid-line. */}
        <View className="grow rounded-2xl border border-indigo-100/80 bg-indigo-50/40 p-3.5">
          <View className="mb-1.5 flex-row items-center gap-1.5">
            <Ionicons name="sparkles" size={14} color="#6366F1" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              AI assessment
            </Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600" numberOfLines={4}>
            {candidate.aiAssessment}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MetaItem({
  icon,
  label,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} color="#64748B" />
      <Text className="text-sm text-slate-500">{label}</Text>
    </View>
  );
}
