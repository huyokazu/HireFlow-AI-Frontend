import type { Dictionary } from '../../i18n';
import type { Localized } from '../../i18n/types';
import { CHANNEL_NAMES, type CampaignDraft } from '../../services/campaigns';
import type { CampaignForecast, ForecastFix, ForecastRiskReason } from '../../services/digitalTwin';

type Pick = <T>(value: Localized<T>) => T;

/** Why the Digital Twin flags a risk, e.g. "Salary band is 22% under the market median." */
export function describeReason(
  reason: ForecastRiskReason,
  draft: CampaignDraft,
  forecast: CampaignForecast,
  t: Dictionary,
): string {
  switch (reason) {
    case 'salary':
      return t.forecast.reasons.salary(Math.abs(forecast.salaryGapPercent));
    case 'experience':
      return t.forecast.reasons.experience(draft.minExperience, forecast.typicalYears);
    case 'channels':
      return t.forecast.reasons.channels;
    case 'skills':
      return t.forecast.reasons.skills(draft.skills.length);
  }
}

/** What a fix changes, e.g. "Raise the band to $130k–$155k". */
export function describeFix(fix: ForecastFix, draft: CampaignDraft, t: Dictionary, pick: Pick): string {
  const { patch } = fix;
  switch (fix.reason) {
    case 'salary':
      return t.forecast.fixes.salary(patch.salaryMin ?? draft.salaryMin, patch.salaryMax ?? draft.salaryMax);
    case 'experience':
      return t.forecast.fixes.experience(patch.minExperience ?? draft.minExperience);
    case 'channels': {
      const added = (patch.channels ?? []).filter((channel) => !draft.channels.includes(channel));
      return t.forecast.fixes.channels(t.campaignForm.joinList(added.map((channel) => pick(CHANNEL_NAMES[channel]))));
    }
    case 'skills':
      return t.forecast.fixes.skills((patch.skills ?? draft.skills).length);
  }
}
