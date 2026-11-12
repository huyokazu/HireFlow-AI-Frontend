import { Slot } from 'expo-router';

import { AppFrame } from '../../components/layout/AppFrame';

/**
 * The signed-in part of the app. The session check lives here rather than in the root layout, which
 * has to mount its navigator before any redirect can run.
 */
export default function AppLayout() {
  return (
    <AppFrame>
      <Slot />
    </AppFrame>
  );
}
