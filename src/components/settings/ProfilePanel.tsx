import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { LANGUAGES, useI18n, type Language } from '../../i18n';
import type { Profile } from '../../services/account';
import { useAuth } from '../../state/AuthProvider';
import { useAppTheme } from '../../theme';
import { FormField } from '../form/FormField';
import { SegmentedControl } from '../form/SegmentedControl';
import { TextField } from '../form/TextField';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';

type ProfilePanelProps = {
  /** Shows a short confirmation or error at the bottom of the screen. */
  notify: (message: string) => void;
};

/** Display name and language, saved with the profile so they follow the user to other devices. */
export function ProfilePanel({ notify }: ProfilePanelProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const { me, meFailed, reloadMe } = useAuth();
  const copy = t.settingsPage.profile;
  const [retrying, setRetrying] = useState(false);
  const profile = me?.profile ?? null;

  const retry = async () => {
    setRetrying(true);
    await reloadMe();
    setRetrying(false);
  };

  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      {profile ? (
        // A new key whenever the saved profile changes, so the form starts again from it.
        <ProfileForm key={`${profile.id}:${profile.displayName}:${profile.locale}`} profile={profile} notify={notify} />
      ) : (
        <View className="items-center gap-3 py-6">
          {meFailed ? (
            <>
              <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{copy.loadError}</Text>
              <Button
                variant="secondary"
                icon="refresh"
                label={t.settingsPage.retry}
                loading={retrying}
                onPress={() => void retry()}
              />
            </>
          ) : (
            <ActivityIndicator color={palette.indigo} />
          )}
        </View>
      )}
    </Panel>
  );
}

function ProfileForm({ profile, notify }: { profile: Profile; notify: (message: string) => void }) {
  const { t } = useI18n();
  const { updateProfile } = useAuth();
  const copy = t.settingsPage.profile;
  const [name, setName] = useState(profile.displayName);
  const [locale, setLocale] = useState<Language>(profile.locale);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(copy.nameRequired);
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await updateProfile({ displayName: trimmed, locale });
      notify(copy.saved);
    } catch (error) {
      console.warn('[settings] Could not save the profile.', error);
      notify(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-4">
      <FormField label={copy.name} error={nameError}>
        <TextField value={name} onChangeText={setName} autoComplete="name" invalid={Boolean(nameError)} />
      </FormField>
      <FormField label={copy.email}>
        <Text className="text-sm text-slate-700 dark:text-slate-200">{profile.email}</Text>
      </FormField>
      <FormField label={copy.language}>
        <SegmentedControl
          options={LANGUAGES}
          value={locale}
          onChange={setLocale}
          labelFor={(language) => t.header.languageNames[language]}
          accessibilityLabel={copy.language}
        />
      </FormField>
      <Button icon="checkmark" label={copy.save} loading={saving} onPress={() => void save()} className="self-start" />
    </View>
  );
}
