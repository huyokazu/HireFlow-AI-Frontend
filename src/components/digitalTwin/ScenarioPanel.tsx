import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import {
  CHANNEL_NAMES,
  EXPERIENCE_LIMITS,
  OPENINGS_LIMITS,
  SOURCING_CHANNELS,
  WORK_MODES,
  type CampaignDraft,
} from '../../services/campaigns';
import { useAppTheme } from '../../theme';
import { AGENT_ICONS } from '../campaignWizard/AgentsStep';
import { SalaryBandField } from '../campaignWizard/SalaryBandField';
import { validateDraft } from '../campaignWizard/validation';
import { ChoiceChip } from '../form/ChoiceChip';
import { FormField } from '../form/FormField';
import { NumberStepper } from '../form/NumberStepper';
import { SegmentedControl } from '../form/SegmentedControl';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { changedLevers, SCENARIO_AGENTS, toggleItem, type ScenarioLever } from './scenario';

type ScenarioPanelProps = {
  /** The campaign as it runs today. */
  setup: CampaignDraft;
  scenario: CampaignDraft;
  /** Market median for the role, in thousands per year, for the salary scale. */
  marketMedian: number;
  update: (patch: Partial<CampaignDraft>) => void;
  onReset: () => void;
  /** Match rates for the summary line shown on screens too narrow for the forecast alongside. */
  currentMatchRate: number;
  scenarioMatchRate: number;
};

/** The levers of a Digital Twin scenario, each noting the campaign's current value once it's changed. */
export function ScenarioPanel({
  setup,
  scenario,
  marketMedian,
  update,
  onReset,
  currentMatchRate,
  scenarioMatchRate,
}: ScenarioPanelProps) {
  const { t, pick } = useI18n();
  const copy = t.twin;
  const form = t.campaignForm;
  const changed = new Set(changedLevers(setup, scenario));
  const errors = validateDraft(scenario);
  /** "Now: …" under a lever, once the scenario has moved it away from the current setup. */
  const now = (lever: ScenarioLever, value: string) => (changed.has(lever) ? copy.now(value) : undefined);
  const enabledAgents = SCENARIO_AGENTS.filter((agent) => setup.agents[agent]);

  return (
    <Panel
      title={copy.scenario}
      subtitle={copy.scenarioSubtitle}
      action={changed.size > 0 ? <ResetButton onPress={onReset} /> : undefined}
    >
      <ScenarioStatus
        changes={changed.size}
        currentMatchRate={currentMatchRate}
        scenarioMatchRate={scenarioMatchRate}
      />

      <View className="mt-5 gap-6">
        <FormField
          label={copy.levers.salary}
          labelAccessory={<ChangedDot visible={changed.has('salary')} />}
          hint={now('salary', form.review.salaryBand(setup.salaryMin, setup.salaryMax))}
          error={errors.salary ? form.errors.salary : null}
        >
          <SalaryBandField
            min={scenario.salaryMin}
            max={scenario.salaryMax}
            marketMedian={marketMedian}
            onChange={update}
            invalid={Boolean(errors.salary)}
          />
        </FormField>

        <View className="gap-6 md:flex-row xl:flex-col 2xl:flex-row">
          <FormField
            label={copy.levers.experience}
            labelAccessory={<ChangedDot visible={changed.has('experience')} />}
            hint={now('experience', form.review.minYears(setup.minExperience))}
            className="md:flex-1"
          >
            <NumberStepper
              value={scenario.minExperience}
              onChange={(minExperience) => update({ minExperience })}
              min={EXPERIENCE_LIMITS.min}
              max={EXPERIENCE_LIMITS.max}
              suffix={form.requirements.yearsUnit}
              label={copy.levers.experience}
            />
          </FormField>
          <FormField
            label={copy.levers.openings}
            labelAccessory={<ChangedDot visible={changed.has('openings')} />}
            hint={now('openings', form.review.openings(setup.headcount))}
            className="md:flex-1"
          >
            <NumberStepper
              value={scenario.headcount}
              onChange={(headcount) => update({ headcount })}
              min={OPENINGS_LIMITS.min}
              max={OPENINGS_LIMITS.max}
              label={copy.levers.openings}
            />
          </FormField>
        </View>

        <FormField
          label={copy.levers.skills}
          labelAccessory={<ChangedDot visible={changed.has('skills')} />}
          hint={now('skills', copy.skillsCount(setup.skills.length)) ?? copy.skillsHint}
          error={errors.skills ? copy.skillsError : null}
        >
          <View role="group" accessibilityLabel={copy.levers.skills} className="flex-row flex-wrap gap-2">
            {setup.skills.map((skill) => (
              <ChoiceChip
                key={skill}
                role="checkbox"
                label={skill}
                selected={scenario.skills.includes(skill)}
                onPress={() => update({ skills: toggleItem(scenario.skills, skill, setup.skills) })}
              />
            ))}
          </View>
        </FormField>

        <FormField
          label={copy.levers.workMode}
          labelAccessory={<ChangedDot visible={changed.has('workMode')} />}
          hint={now('workMode', form.role.workModes[setup.workMode])}
        >
          <SegmentedControl
            options={WORK_MODES}
            value={scenario.workMode}
            onChange={(workMode) => update({ workMode })}
            labelFor={(mode) => form.role.workModes[mode]}
            accessibilityLabel={copy.levers.workMode}
          />
        </FormField>

        <FormField
          label={copy.levers.channels}
          labelAccessory={<ChangedDot visible={changed.has('channels')} />}
          hint={now('channels', form.joinList(setup.channels.map((channel) => pick(CHANNEL_NAMES[channel]))))}
          error={errors.channels ? form.errors.channels : null}
        >
          <View role="group" accessibilityLabel={copy.levers.channels} className="flex-row flex-wrap gap-2">
            {SOURCING_CHANNELS.map((channel) => (
              <ChoiceChip
                key={channel}
                role="checkbox"
                label={pick(CHANNEL_NAMES[channel])}
                selected={scenario.channels.includes(channel)}
                onPress={() => update({ channels: toggleItem(scenario.channels, channel, SOURCING_CHANNELS) })}
              />
            ))}
          </View>
        </FormField>

        <FormField
          label={copy.levers.agents}
          labelAccessory={<ChangedDot visible={changed.has('agents')} />}
          hint={now(
            'agents',
            enabledAgents.length > 0
              ? form.joinList(enabledAgents.map((agent) => form.agents.names[agent]))
              : form.review.none,
          )}
        >
          <View role="group" accessibilityLabel={copy.levers.agents} className="flex-row flex-wrap gap-2">
            {SCENARIO_AGENTS.map((agent) => (
              <ChoiceChip
                key={agent}
                role="checkbox"
                icon={AGENT_ICONS[agent]}
                label={form.agents.names[agent]}
                selected={scenario.agents[agent]}
                onPress={() => update({ agents: { ...scenario.agents, [agent]: !scenario.agents[agent] } })}
              />
            ))}
          </View>
        </FormField>
      </View>
    </Panel>
  );
}

/**
 * How far the scenario has moved from the current setup. Below the two-column layout it also
 * carries the match rate, since the forecast is further down the page.
 */
function ScenarioStatus({
  changes,
  currentMatchRate,
  scenarioMatchRate,
}: {
  changes: number;
  currentMatchRate: number;
  scenarioMatchRate: number;
}) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const lift = scenarioMatchRate - currentMatchRate;
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-slate-100/80 px-3.5 py-2.5 dark:bg-white/5"
    >
      <View className="flex-row items-center gap-1.5">
        <Ionicons
          name={changes > 0 ? 'git-branch-outline' : 'checkmark-circle-outline'}
          size={14}
          color={changes > 0 ? palette.indigo : palette.icon.muted}
        />
        <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {changes > 0 ? t.twin.changes(changes) : t.twin.noChanges}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5 xl:hidden">
        <Ionicons name="sparkles" size={14} color={palette.violet} />
        <Text className="text-xs text-slate-500 dark:text-slate-400">{t.twin.metrics.matchRate}</Text>
        <Text className="text-xs font-bold text-slate-900 dark:text-white">
          {lift === 0 ? `${scenarioMatchRate}%` : `${currentMatchRate}% → ${scenarioMatchRate}%`}
        </Text>
        {lift !== 0 && (
          <View
            className={`rounded-full px-1.5 py-px ${
              lift > 0 ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'
            }`}
          >
            <Text
              className={`text-[11px] font-bold ${
                lift > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {t.twin.delta.points(lift)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Marks a lever the scenario has changed; the "Now: …" hint underneath says it in words. */
function ChangedDot({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={ZoomIn.duration(200)}
      exiting={FadeOut.duration(150)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
    />
  );
}

function ResetButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t.twin.resetA11y}
        onPress={onPress}
        className="flex-row items-center gap-1 rounded-lg px-2 py-1 hover:bg-indigo-50 active:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:active:bg-indigo-500/10"
      >
        <Ionicons name="refresh" size={14} color={palette.indigo} />
        <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{t.twin.reset}</Text>
      </PressableScale>
    </Animated.View>
  );
}
