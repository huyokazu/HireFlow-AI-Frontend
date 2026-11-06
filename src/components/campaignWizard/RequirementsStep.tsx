import { View } from 'react-native';

import { useI18n } from '../../i18n';
import { EXPERIENCE_LIMITS, suggestSkills, type CampaignDraft } from '../../services/campaigns';
import { FormField } from '../form/FormField';
import { NumberStepper } from '../form/NumberStepper';
import { SalaryBandField } from './SalaryBandField';
import { SkillsInput } from './SkillsInput';
import { StepHeading } from './StepHeading';
import type { FieldErrors } from './validation';

type RequirementsStepProps = {
  draft: CampaignDraft;
  update: (patch: Partial<CampaignDraft>) => void;
  errors: FieldErrors;
  /** From the Digital Twin, for the salary scale. */
  marketMedian: number;
};

export function RequirementsStep({ draft, update, errors, marketMedian }: RequirementsStepProps) {
  const { t } = useI18n();
  const copy = t.campaignForm.requirements;
  const suggestions = suggestSkills(draft.title, draft.department, draft.skills);

  return (
    <View>
      <StepHeading title={copy.title} subtitle={copy.subtitle} />
      <View className="gap-6">
        <FormField
          label={copy.skills}
          hint={copy.skillsHint}
          error={errors.skills ? t.campaignForm.errors.skills : null}
        >
          <SkillsInput
            skills={draft.skills}
            onChange={(skills) => update({ skills })}
            suggestions={suggestions}
            invalid={Boolean(errors.skills)}
          />
        </FormField>

        <FormField label={copy.minExperience}>
          <View className="md:max-w-[260px]">
            <NumberStepper
              value={draft.minExperience}
              onChange={(minExperience) => update({ minExperience })}
              min={EXPERIENCE_LIMITS.min}
              max={EXPERIENCE_LIMITS.max}
              suffix={copy.yearsUnit}
              label={copy.minExperience}
            />
          </View>
        </FormField>

        <FormField
          label={copy.salary}
          hint={copy.salaryHint}
          error={errors.salary ? t.campaignForm.errors.salary : null}
        >
          <SalaryBandField
            min={draft.salaryMin}
            max={draft.salaryMax}
            marketMedian={marketMedian}
            onChange={update}
            invalid={Boolean(errors.salary)}
          />
        </FormField>
      </View>
    </View>
  );
}
