import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { PipelineStage } from '../../services/pipeline';
import type { Palette } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type StageStyle = {
  /** Colour dot in the column header. */
  dotClassName: string;
  /** Icon for the agent working on candidates in this stage. */
  icon: IconName;
  color: (palette: Palette) => string;
};

// Class names are spelled out in full so Tailwind can find them when it scans the source.
export const STAGE_STYLES: Record<PipelineStage, StageStyle> = {
  applied: {
    dotClassName: 'bg-slate-400 dark:bg-slate-500',
    icon: 'document-text-outline',
    color: (palette) => palette.icon.muted,
  },
  screening: {
    dotClassName: 'bg-indigo-500 dark:bg-indigo-400',
    icon: 'sparkles-outline',
    color: (palette) => palette.indigo,
  },
  interview: {
    dotClassName: 'bg-violet-500 dark:bg-violet-400',
    icon: 'calendar-outline',
    color: (palette) => palette.violet,
  },
  offer: {
    dotClassName: 'bg-amber-500 dark:bg-amber-400',
    icon: 'document-attach-outline',
    color: (palette) => palette.amber,
  },
  hired: {
    dotClassName: 'bg-emerald-500 dark:bg-emerald-400',
    icon: 'checkmark-circle-outline',
    color: (palette) => palette.emerald,
  },
};
