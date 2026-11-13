import { AppFrame } from '../components/layout/AppFrame';
import { NotFoundScreen } from '../screens/NotFoundScreen';

/** Unknown deeper paths, shown inside the app's shell like any other page. */
export default function NotFoundRoute() {
  return (
    <AppFrame>
      <NotFoundScreen />
    </AppFrame>
  );
}
