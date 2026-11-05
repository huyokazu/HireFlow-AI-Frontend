import { Redirect, useLocalSearchParams } from 'expo-router';

import { isNavKey } from '../components/layout/navigation';
import { NotFoundScreen } from '../screens/NotFoundScreen';
import { SectionPlaceholderScreen } from '../screens/SectionPlaceholderScreen';

/** Sidebar sections without a screen of their own yet (AI Agents, Analytics, Settings…). */
export default function SectionRoute() {
  const { section } = useLocalSearchParams<{ section: string }>();
  if (section === 'dashboard') return <Redirect href="/" />;
  if (!section || !isNavKey(section)) return <NotFoundScreen />;
  return <SectionPlaceholderScreen section={section} />;
}
