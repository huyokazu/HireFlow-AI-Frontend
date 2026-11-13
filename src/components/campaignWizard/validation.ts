import type { CampaignDraft } from '../../services/campaigns';

export const WIZARD_STEPS = ['role', 'requirements', 'agents', 'review'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type CampaignField = 'title' | 'department' | 'location' | 'skills' | 'salary' | 'channels';
export type FieldErrors = Partial<Record<CampaignField, true>>;

const STEP_FIELDS: Record<WizardStep, readonly CampaignField[]> = {
  role: ['title', 'department', 'location'],
  requirements: ['skills', 'salary'],
  agents: ['channels'],
  review: [],
};

/** Every field that still needs attention before the campaign can launch. */
export function validateDraft(draft: CampaignDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (draft.title.trim().length < 2) errors.title = true;
  if (!draft.department) errors.department = true;
  if (!draft.location.trim()) errors.location = true;
  if (draft.skills.length === 0) errors.skills = true;
  if (draft.salaryMin >= draft.salaryMax) errors.salary = true;
  if (draft.channels.length === 0) errors.channels = true;
  return errors;
}

/** The errors that belong to one step. */
export function errorsForStep(step: WizardStep, errors: FieldErrors): FieldErrors {
  const result: FieldErrors = {};
  for (const field of STEP_FIELDS[step]) {
    if (errors[field]) result[field] = true;
  }
  return result;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The earliest step with something to fix, or null when the draft is ready to launch. */
export function firstInvalidStep(errors: FieldErrors): WizardStep | null {
  return WIZARD_STEPS.find((step) => hasErrors(errorsForStep(step, errors))) ?? null;
}
