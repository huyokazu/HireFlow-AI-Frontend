import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import type { BottleneckAlert, SuggestedFix } from '../../services/selfHealing';
import { SelfHealingAlertCard } from './SelfHealingAlertCard';

type SelfHealingAlertPopupProps = {
  /** The popup is open while an alert is set. */
  alert: BottleneckAlert | null;
  onClose: () => void;
  onApproveFix: (alert: BottleneckAlert, fix: SuggestedFix) => Promise<void>;
};

// Tapping the backdrop deliberately does nothing: a bottleneck alert should be closed on purpose.
export function SelfHealingAlertPopup({ alert, onClose, onApproveFix }: SelfHealingAlertPopupProps) {
  return (
    <Modal
      transparent
      visible={alert !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-slate-950/50">
        <ScrollView contentContainerStyle={styles.content}>
          <View className="w-full max-w-lg">
            {alert && (
              <SelfHealingAlertCard
                key={alert.id}
                alert={alert}
                onApproveFix={onApproveFix}
                onDismiss={onClose}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
});
