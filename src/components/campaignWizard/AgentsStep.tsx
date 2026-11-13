import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useI18n } from '../../i18n';
import {
  CAMPAIGN_AGENTS,
  CHANNEL_NAMES,
  SOURCING_CHANNELS,
  type CampaignAgent,
  type CampaignDraft,
  type SourcingChannel,
} from '../../services/campaigns';
import { ChoiceChip } from '../form/ChoiceChip';
import { FormField } from '../form/FormField';
import { NumberStepper } from '../form/NumberStepper';
import { ToggleRow } from '../form/ToggleRow';
import { StepHeading } from './StepHeading';
import type { FieldErrors } from './validation';

export const AGENT_ICONS: Record<CampaignAgent, ComponentProps<typeof Ionicons>['name']> = {
  sourcing: 'search',
  matching: 'git-compare-outline',
  scheduling: 'calendar-outline',
  selfHealing: 'pulse',
};

type AgentsStepProps = {
  draft: CampaignDraft;
  update: (patch: Partial<CampaignDraft>) => void;
  errors: FieldErrors;
};

export function AgentsStep({ draft, update, errors }: AgentsStepProps) {
  const { t, pick } = useI18n();
  const copy = t.campaignForm.agents;

  const toggleChannel = (channel: SourcingChannel) => {
    const channels = draft.channels.includes(channel)
      ? draft.channels.filter((item) => item !== channel)
      : [...draft.channels, channel];
    update({ channels });
  };

  return (
    <View>
      <StepHeading title={copy.title} subtitle={copy.subtitle} />
      <View className="gap-6">
        <FormField
          label={copy.channels}
          hint={copy.channelsHint}
          error={errors.channels ? t.campaignForm.errors.channels : null}
        >
          <View role="group" accessibilityLabel={copy.channels} className="flex-row flex-wrap gap-2">
            {SOURCING_CHANNELS.map((channel) => (
              <ChoiceChip
                key={channel}
                role="checkbox"
                label={pick(CHANNEL_NAMES[channel])}
                selected={draft.channels.includes(channel)}
                onPress={() => toggleChannel(channel)}
              />
            ))}
          </View>
        </FormField>

        <FormField label={copy.agents}>
          <View className="gap-2.5 md:flex-row md:flex-wrap">
            {CAMPAIGN_AGENTS.map((agent) => (
              <View key={agent} className="md:w-[49%] md:flex-grow">
                <ToggleRow
                  title={copy.names[agent]}
                  description={copy.descriptions[agent]}
                  icon={AGENT_ICONS[agent]}
                  value={draft.agents[agent]}
                  onValueChange={(on) => update({ agents: { ...draft.agents, [agent]: on } })}
                />
              </View>
            ))}
          </View>
        </FormField>

        <FormField label={copy.targetMatchRate} hint={copy.targetHint}>
          <View className="md:max-w-[260px]">
            <NumberStepper
              value={draft.targetMatchRate}
              onChange={(targetMatchRate) => update({ targetMatchRate })}
              min={30}
              max={95}
              step={5}
              suffix="%"
              label={copy.targetMatchRate}
            />
          </View>
        </FormField>
      </View>
    </View>
  );
}
