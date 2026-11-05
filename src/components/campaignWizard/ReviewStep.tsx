import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import {
  CAMPAIGN_AGENTS,
  CHANNEL_NAMES,
  DEPARTMENT_NAMES,
  type CampaignDraft,
} from '../../services/campaigns';
import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';
import { StepHeading } from './StepHeading';
import type { WizardStep } from './validation';

type ReviewStepProps = {
  draft: CampaignDraft;
  onEdit: (step: WizardStep) => void;
};

/** Everything entered so far, grouped like the steps, each group with a way back to edit it. */
export function ReviewStep({ draft, onEdit }: ReviewStepProps) {
  const { t, pick } = useI18n();
  const { palette } = useAppTheme();
  const form = t.campaignForm;
  const enabledAgents = CAMPAIGN_AGENTS.filter((agent) => draft.agents[agent]);

  return (
    <View>
      <StepHeading title={form.review.title} subtitle={form.review.subtitle} />
      <View className="gap-3">
        <ReviewSection title={form.steps.role} onEdit={() => onEdit('role')}>
          <ReviewRow label={form.role.jobTitle} value={draft.title.trim()} />
          <ReviewRow
            label={form.role.department}
            value={draft.department ? pick(DEPARTMENT_NAMES[draft.department]) : form.review.none}
          />
          <ReviewRow
            label={form.role.location}
            value={`${draft.location.trim()} · ${form.role.workModes[draft.workMode]}`}
          />
          <ReviewRow
            label={form.role.seniority}
            value={`${form.role.seniorities[draft.seniority]} · ${form.review.openings(draft.headcount)}`}
          />
        </ReviewSection>

        <ReviewSection title={form.steps.requirements} onEdit={() => onEdit('requirements')}>
          <ReviewRow label={form.requirements.skills}>
            <View className="flex-1 flex-row flex-wrap gap-1.5">
              {draft.skills.map((skill) => (
                <View key={skill} className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-white/10">
                  <Text className="text-xs font-medium text-slate-700 dark:text-slate-200">{skill}</Text>
                </View>
              ))}
            </View>
          </ReviewRow>
          <ReviewRow label={form.requirements.minExperience} value={form.review.minYears(draft.minExperience)} />
          <ReviewRow label={form.requirements.salary} value={form.review.salaryBand(draft.salaryMin, draft.salaryMax)} />
        </ReviewSection>

        <ReviewSection title={form.agents.title} onEdit={() => onEdit('agents')}>
          <ReviewRow
            label={form.agents.channels}
            value={form.joinList(draft.channels.map((channel) => pick(CHANNEL_NAMES[channel])))}
          />
          <ReviewRow
            label={form.agents.agents}
            value={
              enabledAgents.length > 0
                ? form.joinList(enabledAgents.map((agent) => form.agents.names[agent]))
                : form.review.none
            }
          />
          <ReviewRow label={form.agents.targetMatchRate} value={`${draft.targetMatchRate}%`} />
        </ReviewSection>

        <View className="mt-1 flex-row items-start gap-2 rounded-2xl bg-indigo-50/70 p-3.5 dark:bg-indigo-500/10">
          <Ionicons name="git-network-outline" size={16} color={palette.indigo} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-sm text-indigo-900 dark:text-indigo-200">{form.review.launchNote}</Text>
        </View>
      </View>
    </View>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <View className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t.campaignForm.review.editA11y(title)}
          onPress={onEdit}
          className="flex-row items-center gap-1 rounded-lg px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        >
          <Ionicons name="create-outline" size={14} color={palette.indigo} />
          <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{t.campaignForm.review.edit}</Text>
        </PressableScale>
      </View>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function ReviewRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <Text className="w-36 text-sm text-slate-500 dark:text-slate-400">{label}</Text>
      {children ?? (
        <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</Text>
      )}
    </View>
  );
}
