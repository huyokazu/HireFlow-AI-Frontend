/**
 * Raw colour values for the places Tailwind classes can't reach: icon colours, gradients,
 * shadows and native-only props. Surfaces and text use `dark:` classes instead.
 */
export type Palette = {
  backdrop: readonly [string, string, string];
  /** Solid card colour, for fills that sit behind a card (e.g. the glow layer). */
  card: string;
  drawer: string;
  icon: { strong: string; muted: string; faint: string };
  placeholder: string;
  indigo: string;
  violet: string;
  emerald: string;
  rose: string;
  amber: string;
  shadow: { panel: string; stat: string; deck: string; aiGlow: string; agentGlow: string };
};

export const LIGHT_PALETTE: Palette = {
  backdrop: ['#EEF2FF', '#F8FAFC', '#F5F3FF'],
  card: '#FFFFFF',
  drawer: '#FFFFFF',
  icon: { strong: '#334155', muted: '#64748B', faint: '#94A3B8' },
  placeholder: '#94A3B8',
  indigo: '#4F46E5',
  violet: '#7C3AED',
  emerald: '#059669',
  rose: '#E11D48',
  amber: '#D97706',
  shadow: {
    panel: '0px 10px 30px -12px rgba(15, 23, 42, 0.12)',
    stat: '0px 8px 24px -14px rgba(15, 23, 42, 0.18)',
    deck: '0px 18px 40px -12px rgba(15, 23, 42, 0.28)',
    aiGlow: '0px 0px 0px 0px rgba(0, 0, 0, 0)',
    agentGlow: '0px 0px 0px 0px rgba(0, 0, 0, 0)',
  },
};

export const DARK_PALETTE: Palette = {
  // Obsidian with a faint indigo cast in the corners.
  backdrop: ['#11152B', '#0B0F19', '#0E0B1F'],
  card: '#111827',
  drawer: '#111827',
  icon: { strong: '#E2E8F0', muted: '#94A3B8', faint: '#64748B' },
  placeholder: '#64748B',
  indigo: '#818CF8',
  violet: '#A78BFA',
  emerald: '#34D399',
  rose: '#FB7185',
  amber: '#FBBF24',
  shadow: {
    panel: '0px 12px 32px -12px rgba(0, 0, 0, 0.65)',
    stat: '0px 10px 26px -14px rgba(0, 0, 0, 0.7)',
    deck: '0px 22px 44px -12px rgba(0, 0, 0, 0.75)',
    aiGlow: '0px 0px 22px -6px rgba(99, 102, 241, 0.45)',
    agentGlow: '0px 0px 24px -8px rgba(16, 185, 129, 0.55)',
  },
};
