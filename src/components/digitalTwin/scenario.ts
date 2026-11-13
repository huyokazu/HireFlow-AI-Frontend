import type { CampaignAgent, CampaignDraft } from '../../services/campaigns';

/** What a Digital Twin scenario can change about a live campaign. */
export type ScenarioLever = 'salary' | 'experience' | 'skills' | 'workMode' | 'channels' | 'agents' | 'openings';

/** Agents that change the forecast when switched off. The Self-Healing monitor only watches. */
export const SCENARIO_AGENTS: readonly CampaignAgent[] = ['sourcing', 'matching', 'scheduling'];

/** The levers set differently in the scenario than in the campaign's current setup. */
export function changedLevers(setup: CampaignDraft, scenario: CampaignDraft): ScenarioLever[] {
  const changed: ScenarioLever[] = [];
  if (setup.salaryMin !== scenario.salaryMin || setup.salaryMax !== scenario.salaryMax) changed.push('salary');
  if (setup.minExperience !== scenario.minExperience) changed.push('experience');
  if (!sameItems(setup.skills, scenario.skills)) changed.push('skills');
  if (setup.workMode !== scenario.workMode) changed.push('workMode');
  if (!sameItems(setup.channels, scenario.channels)) changed.push('channels');
  if (SCENARIO_AGENTS.some((agent) => setup.agents[agent] !== scenario.agents[agent])) changed.push('agents');
  if (setup.headcount !== scenario.headcount) changed.push('openings');
  return changed;
}

/** Toggles one item of a list, keeping the order of `reference` so a ticked-back item returns to its place. */
export function toggleItem<T>(items: readonly T[], item: T, reference: readonly T[]): T[] {
  if (items.includes(item)) return items.filter((current) => current !== item);
  const next = new Set([...items, item]);
  const ordered = reference.filter((current) => next.has(current));
  // Anything not in the reference list (none today) goes last rather than being dropped.
  return [...ordered, ...[...next].filter((current) => !reference.includes(current))];
}

function sameItems<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((item) => b.includes(item));
}
