import { Ionicons } from '@expo/vector-icons';
import { Linking, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

type OperationsDetailsLineProps = {
  candidate: string;
  /** ISO start of the booked interview. */
  startsAt?: string;
  meetLink?: string;
  /** Google was not called; the booking or email only happened in the app. */
  simulated?: boolean;
};

/** Under an interview or offer: when it is, the Meet link, and whether it was only simulated. */
export function OperationsDetailsLine({ candidate, startsAt, meetLink, simulated }: OperationsDetailsLineProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.agentsPage.activity.details;
  const start = startsAt ? new Date(startsAt) : null;
  const when = start && !Number.isNaN(start.getTime()) ? t.date.dayMonthTime(start) : null;
  // Only web links: the URL comes from the server and is opened outside the app.
  const meetUrl = meetLink && /^https:\/\//.test(meetLink) ? meetLink : null;
  if (!when && !meetUrl && !simulated) return null;

  return (
    <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
      {when && (
        <View className="flex-row items-center gap-1">
          <Ionicons name="calendar-outline" size={12} color={palette.icon.muted} />
          <Text className="text-xs text-slate-600 dark:text-slate-300">{copy.interviewAt(when)}</Text>
        </View>
      )}
      {meetUrl && (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={copy.joinMeetA11y(candidate)}
          onPress={() => void Linking.openURL(meetUrl).catch(() => undefined)}
          hitSlop={6}
          className="flex-row items-center gap-1 rounded-md px-1 py-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        >
          <Ionicons name="videocam-outline" size={12} color={palette.indigo} />
          <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{copy.joinMeet}</Text>
        </PressableScale>
      )}
      {simulated && <SimulatedBadge label={copy.simulated} a11yLabel={copy.simulatedA11y} />}
    </View>
  );
}

/** Marks work that never reached Google, so nobody mistakes a demo booking for a real one. */
export function SimulatedBadge({ label, a11yLabel }: { label: string; a11yLabel: string }) {
  return (
    <View
      accessibilityLabel={a11yLabel}
      className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 dark:border-amber-400/30 dark:bg-amber-500/10"
    >
      <Text className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{label}</Text>
    </View>
  );
}
