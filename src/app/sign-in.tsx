import { Redirect } from 'expo-router';

import { SignInScreen } from '../screens/SignInScreen';
import { useAuth } from '../state/AuthProvider';

/** Signed-in users (and mock mode, which has no sign-in) go straight to the dashboard. */
export default function SignInRoute() {
  const { status } = useAuth();
  if (status === 'signedIn' || status === 'disabled') return <Redirect href="/" />;
  return <SignInScreen />;
}
