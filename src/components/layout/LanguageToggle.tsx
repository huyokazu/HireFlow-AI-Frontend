import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { LANGUAGES, useI18n } from '../../i18n';
import { useFluidSpan } from '../ui/motion';

const SEGMENT_WIDTH = 40;
const INSET = 3;

/** `EN | VI` pill. The highlight glides (and stretches) between the two; the switch itself is instant. */
export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  const index = LANGUAGES.indexOf(language);
  const { start, end } = useFluidSpan(index * SEGMENT_WIDTH, (index + 1) * SEGMENT_WIDTH);

  const highlightStyle = useAnimatedStyle(() => ({
    left: INSET + start.get(),
    width: end.get() - start.get(),
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.header.language}
      className="h-11 flex-row items-center rounded-full border border-slate-200 bg-white/80 dark:border-white/15 dark:bg-white/5"
      style={{ padding: INSET }}
    >
      <Animated.View
        className="absolute rounded-full bg-indigo-600 dark:bg-indigo-500"
        style={[
          {
            top: INSET,
            bottom: INSET,
            boxShadow: '0px 4px 12px -4px rgba(79, 70, 229, 0.6)',
          },
          highlightStyle,
        ]}
      />
      {LANGUAGES.map((code) => {
        const selected = code === language;
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityLabel={t.header.languageNames[code]}
            aria-checked={selected}
            onPress={() => setLanguage(code)}
            className="h-full items-center justify-center rounded-full"
            style={{ width: SEGMENT_WIDTH }}
          >
            <Text
              className={`text-xs font-bold tracking-wide ${
                selected ? 'text-white' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
