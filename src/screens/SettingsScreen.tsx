import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { AccountPanel } from '../components/settings/AccountPanel';
import { GooglePanel } from '../components/settings/GooglePanel';
import { ProfilePanel } from '../components/settings/ProfilePanel';
import { SessionsPanel } from '../components/settings/SessionsPanel';
import { STAGGER_MS } from '../components/ui/motion';
import { Toast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

type Notice = { key: number; message: string };

/** Profile, connected Google account, signed-in devices and sign-out. Needs the HireFlow API. */
export function SettingsScreen() {
  const { t } = useI18n();
  const copy = t.settingsPage;
  const [notice, setNotice] = useState<Notice | null>(null);

  const notify = useCallback((message: string) => setNotice({ key: Date.now(), message }), []);
  const dismiss = useCallback(() => setNotice(null), []);

  const panels = [
    <ProfilePanel key="profile" notify={notify} />,
    <GooglePanel key="google" notify={notify} />,
    <SessionsPanel key="sessions" notify={notify} />,
    <AccountPanel key="account" />,
  ];

  return (
    <View style={styles.flex}>
      <ScreenContainer>
        <AppHeader title={copy.title} subtitle={copy.subtitle} />
        <View className="mt-6 gap-6 lg:flex-row lg:flex-wrap">
          {panels.map((panel, index) => (
            <Animated.View
              key={panel.key}
              entering={FadeInDown.delay(80 + index * STAGGER_MS).duration(450)}
              className="lg:w-[48%] lg:flex-grow"
            >
              {panel}
            </Animated.View>
          ))}
        </View>
      </ScreenContainer>
      <Toast toastKey={notice?.key ?? null} message={notice?.message ?? ''} icon="information-circle" onDismiss={dismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
