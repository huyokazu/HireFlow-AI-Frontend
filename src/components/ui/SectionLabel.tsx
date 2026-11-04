import type { ReactNode } from 'react';
import { Text } from 'react-native';

/** Small uppercase caption used above card sections. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {children}
    </Text>
  );
}
