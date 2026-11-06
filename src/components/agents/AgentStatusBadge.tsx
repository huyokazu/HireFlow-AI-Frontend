import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { PulseRing } from '../ui/pulse';
import { STATUS_STYLES, type AgentStatus } from './agentStyles';

type AgentStatusBadgeProps = {
  status: AgentStatus;
  /** Replaces the status name, e.g. "Coordinating 6 campaigns". */
  label?: string;
};

/** A status dot (with a "live" ring while working) and its label. */
export function AgentStatusBadge({ status, label }: AgentStatusBadgeProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const style = STATUS_STYLES[status];

  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 items-center justify-center">
        <PulseRing color={style.color(palette)} active={status === 'working'} size={8} />
        <View className={`h-2 w-2 rounded-full ${style.dotClassName}`} />
      </View>
      <Text className={`shrink text-xs font-semibold ${style.textClassName}`}>{label ?? t.agentsPage.status[status]}</Text>
    </View>
  );
}
