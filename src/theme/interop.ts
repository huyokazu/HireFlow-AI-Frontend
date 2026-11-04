import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

// Lets Reanimated views take `className`, so animated wrappers keep their Tailwind layout
// (e.g. `xl:flex-[7]`) instead of needing a plain View around them. Imported once from App.tsx.
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
