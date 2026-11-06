import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useI18n } from '../../i18n';
import {
  DEPARTMENT_NAMES,
  DEPARTMENTS,
  OPENINGS_LIMITS,
  SENIORITIES,
  WORK_MODES,
  type CampaignDraft,
  type DepartmentKey,
} from '../../services/campaigns';
import { ChoiceChip } from '../form/ChoiceChip';
import { FormField } from '../form/FormField';
import { NumberStepper } from '../form/NumberStepper';
import { SegmentedControl } from '../form/SegmentedControl';
import { TextField } from '../form/TextField';
import { StepHeading } from './StepHeading';
import type { FieldErrors } from './validation';

const DEPARTMENT_ICONS: Record<DepartmentKey, ComponentProps<typeof Ionicons>['name']> = {
  engineering: 'code-slash',
  design: 'color-palette-outline',
  data: 'server-outline',
  product: 'cube-outline',
  operations: 'settings-outline',
  sales: 'briefcase-outline',
};

type StepProps = {
  draft: CampaignDraft;
  update: (patch: Partial<CampaignDraft>) => void;
  errors: FieldErrors;
};

export function RoleStep({ draft, update, errors }: StepProps) {
  const { t, pick } = useI18n();
  const copy = t.campaignForm.role;

  return (
    <View>
      <StepHeading title={copy.title} subtitle={copy.subtitle} />
      <View className="gap-5">
        <FormField label={copy.jobTitle} error={errors.title ? t.campaignForm.errors.title : null}>
          <TextField
            value={draft.title}
            onChangeText={(title) => update({ title })}
            placeholder={copy.jobTitlePlaceholder}
            accessibilityLabel={copy.jobTitle}
            invalid={errors.title}
            autoCapitalize="words"
            returnKeyType="next"
            maxLength={80}
          />
        </FormField>

        <FormField label={copy.department} error={errors.department ? t.campaignForm.errors.department : null}>
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.department} className="flex-row flex-wrap gap-2">
            {DEPARTMENTS.map((department) => (
              <ChoiceChip
                key={department}
                role="radio"
                icon={DEPARTMENT_ICONS[department]}
                label={pick(DEPARTMENT_NAMES[department])}
                selected={draft.department === department}
                onPress={() => update({ department })}
              />
            ))}
          </View>
        </FormField>

        <View className="gap-5 md:flex-row">
          <FormField
            label={copy.location}
            error={errors.location ? t.campaignForm.errors.location : null}
            className="md:flex-1"
          >
            <TextField
              value={draft.location}
              onChangeText={(location) => update({ location })}
              placeholder={copy.locationPlaceholder}
              accessibilityLabel={copy.location}
              invalid={errors.location}
              autoCapitalize="words"
              maxLength={60}
            />
          </FormField>
          <FormField label={copy.workMode} className="md:flex-1">
            <SegmentedControl
              options={WORK_MODES}
              value={draft.workMode}
              onChange={(workMode) => update({ workMode })}
              labelFor={(mode) => copy.workModes[mode]}
              accessibilityLabel={copy.workMode}
            />
          </FormField>
        </View>

        <View className="gap-5 md:flex-row">
          <FormField label={copy.seniority} className="md:flex-[3]">
            <SegmentedControl
              options={SENIORITIES}
              value={draft.seniority}
              onChange={(seniority) => update({ seniority })}
              labelFor={(level) => copy.seniorities[level]}
              accessibilityLabel={copy.seniority}
            />
          </FormField>
          <FormField label={copy.openings} hint={copy.openingsHint} className="md:flex-[2]">
            <NumberStepper
              value={draft.headcount}
              onChange={(headcount) => update({ headcount })}
              min={OPENINGS_LIMITS.min}
              max={OPENINGS_LIMITS.max}
              label={copy.openings}
            />
          </FormField>
        </View>
      </View>
    </View>
  );
}
