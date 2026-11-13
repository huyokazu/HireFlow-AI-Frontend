import { useState } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';

/** Sign out on this device, or end every session at once (e.g. after losing a phone). */
export function AccountPanel() {
  const { t } = useI18n();
  const { signOut, signOutEverywhere } = useAuth();
  const copy = t.settingsPage.account;
  const [busy, setBusy] = useState<'local' | 'global' | null>(null);

  // Once signed out, the layout sends the user to the sign-in page.
  const run = (scope: 'local' | 'global') => {
    setBusy(scope);
    void (scope === 'local' ? signOut() : signOutEverywhere()).finally(() => setBusy(null));
  };

  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      <View className="gap-3">
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="secondary"
            icon="log-out-outline"
            label={copy.signOut}
            loading={busy === 'local'}
            disabled={busy !== null}
            onPress={() => run('local')}
          />
          <Button
            variant="ghost"
            icon="power-outline"
            label={copy.signOutEverywhere}
            loading={busy === 'global'}
            disabled={busy !== null}
            onPress={() => run('global')}
          />
        </View>
        <Text className="text-xs text-slate-500 dark:text-slate-400">{copy.signOutEverywhereHint}</Text>
      </View>
    </Panel>
  );
}
