import { SectionPlaceholderScreen } from '../../screens/SectionPlaceholderScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { useAuth } from '../../state/AuthProvider';

/** Account settings need the API; in mock mode the section stays a placeholder. */
export default function SettingsRoute() {
  const { status } = useAuth();
  return status === 'disabled' ? <SectionPlaceholderScreen section="settings" /> : <SettingsScreen />;
}
