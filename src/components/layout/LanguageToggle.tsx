import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LANGUAGES, useI18n } from '../../i18n';

const SEGMENT_WIDTH = 40;
const INSET = 3;
const SPRING = { damping: 18, stiffness: 260, mass: 0.7 };

/** `EN | VI` pill. The highlight slides between the two; the switch itself is instant. */
export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  const reduceMotion = useReducedMotion();
  const index = LANGUAGES.indexOf(language);
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = reduceMotion ? withTiming(index, { duration: 0 }) : withSpring(index, SPRING);
  }, [index, reduceMotion, position]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * SEGMENT_WIDTH }],
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
            left: INSET,
            width: SEGMENT_WIDTH,
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
            accessibilityState={{ checked: selected }}
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
