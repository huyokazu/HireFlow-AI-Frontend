import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Where Google's consent screen sends the native app back to (`hireflow://integrations/google`).
 * The auth session usually catches that link itself; when the OS opens the app with it instead,
 * this forwards the result to Settings.
 */
export default function GoogleReturnRoute() {
  const { google } = useLocalSearchParams<{ google?: string }>();
  return <Redirect href={{ pathname: '/settings', params: google ? { google } : {} }} />;
}
