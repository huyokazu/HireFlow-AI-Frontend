import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '../components/form/FormField';
import { TextField } from '../components/form/TextField';
import { BrandMark } from '../components/layout/BrandMark';
import { LanguageToggle } from '../components/layout/LanguageToggle';
import { ThemedBackdrop } from '../components/layout/ThemedBackdrop';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { useI18n } from '../i18n';
import { DEMO_ACCOUNT, demoLoginEnabled } from '../lib/config';
import { AuthFailure, useAuth } from '../state/AuthProvider';

type Mode = 'signIn' | 'signUp';
type Field = 'name' | 'email' | 'password';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** Email and password sign-in, with sign-up for a new team. The layout redirects once signed in. */
export function SignInScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const copy = t.auth;
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signUp';

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (signingUp && !name.trim()) next.name = copy.errors.name;
    if (!EMAIL_PATTERN.test(email.trim())) next.email = copy.errors.email;
    if (signingUp ? password.length < MIN_PASSWORD : password.length === 0) next.password = copy.errors.password;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setFailure(null);
    setNotice(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (!signingUp) {
        await signIn(email, password);
      } else if ((await signUp(name, email, password)) === 'confirmEmail') {
        setNotice(copy.checkEmail);
        setMode('signIn');
      }
    } catch (error) {
      setFailure(copy.errors[error instanceof AuthFailure ? error.reason : 'failed']);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(signingUp ? 'signIn' : 'signUp');
    setErrors({});
    setFailure(null);
  };

  const fillDemo = () => {
    setMode('signIn');
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setErrors({});
    setFailure(null);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-obsidian">
      <ThemedBackdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        >
          <View className="w-full max-w-[420px] gap-6 self-center">
            <View className="flex-row items-center justify-between gap-3">
              <BrandMark showTagline={false} />
              <View className="flex-row items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </View>
            </View>

            <Animated.View entering={FadeInDown.duration(450)}>
              <Panel
                title={signingUp ? copy.signUpTitle : copy.title}
                subtitle={signingUp ? copy.signUpSubtitle : copy.subtitle}
              >
                <View className="gap-4">
                  {signingUp && (
                    <FormField label={copy.name} error={errors.name}>
                      <TextField
                        value={name}
                        onChangeText={setName}
                        placeholder={copy.namePlaceholder}
                        autoComplete="name"
                        invalid={Boolean(errors.name)}
                      />
                    </FormField>
                  )}
                  <FormField label={copy.email} error={errors.email}>
                    <TextField
                      value={email}
                      onChangeText={setEmail}
                      placeholder={copy.emailPlaceholder}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      inputMode="email"
                      invalid={Boolean(errors.email)}
                    />
                  </FormField>
                  <FormField label={copy.password} error={errors.password}>
                    <TextField
                      value={password}
                      onChangeText={setPassword}
                      placeholder={copy.passwordPlaceholder}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete={signingUp ? 'new-password' : 'current-password'}
                      onSubmitEditing={() => void submit()}
                      invalid={Boolean(errors.password)}
                    />
                  </FormField>

                  {(failure || notice) && (
                    <Animated.Text
                      entering={FadeIn.duration(200)}
                      accessibilityLiveRegion="polite"
                      className={`text-sm ${failure ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}
                    >
                      {failure ?? notice}
                    </Animated.Text>
                  )}

                  <Button
                    label={signingUp ? copy.signUp : copy.signIn}
                    icon={signingUp ? 'person-add-outline' : 'log-in-outline'}
                    loading={busy}
                    onPress={() => void submit()}
                  />
                  <Button variant="ghost" label={signingUp ? copy.toSignIn : copy.toSignUp} onPress={switchMode} />
                </View>
              </Panel>
            </Animated.View>

            {demoLoginEnabled && (
              <View className="items-center gap-1">
                <Button variant="secondary" icon="flash-outline" label={copy.demo} onPress={fillDemo} />
                <Text className="text-center text-xs text-slate-500 dark:text-slate-400">{copy.demoHint}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },
});
