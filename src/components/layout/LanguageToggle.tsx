import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { LANGUAGES, useI18n, type Language } from '../../i18n';
import { useFluidSpan, useMicroBounce } from '../ui/motion';
import { PressableScale } from '../ui/PressableScale';

const SEGMENT_WIDTH = 40;
const INSET = 3;

/**
 * `EN | VI` pill. The highlight glides between the two, stretching and overshooting a little, and the
 * chosen code pops as it lands; the switch itself is instant.
 */
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
      {LANGUAGES.map((code) => (
        <LanguageSegment
          key={code}
          code={code}
          label={t.header.languageNames[code]}
          selected={code === language}
          onPress={() => setLanguage(code)}
        />
      ))}
    </View>
  );
}

function LanguageSegment({
  code,
  label,
  selected,
  onPress,
}: {
  code: Language;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const bounce = useMicroBounce(selected);
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={selected}
      onPress={onPress}
      pressedScale={0.86}
      hoverScale={1.06}
      className="h-full items-center justify-center rounded-full"
      style={{ width: SEGMENT_WIDTH }}
    >
      <Animated.Text
        className={`text-xs font-bold tracking-wide ${selected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
        style={bounce}
      >
        {code.toUpperCase()}
      </Animated.Text>
    </PressableScale>
  );
}
