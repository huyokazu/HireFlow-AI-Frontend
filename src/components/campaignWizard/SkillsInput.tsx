import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { useI18n } from '../../i18n';
import { useAppTheme } from '../../theme';
import { TextField } from '../form/TextField';
import { PressableScale } from '../ui/PressableScale';

const CHIP_LAYOUT = LinearTransition.springify().damping(18).stiffness(200);

type SkillsInputProps = {
  skills: string[];
  onChange: (skills: string[]) => void;
  /** AI suggestions, already without the skills that were added. */
  suggestions: string[];
  invalid: boolean;
};

/** Skill chips with a text box to add more (Enter or a comma adds one) and AI suggestions to tap. */
export function SkillsInput({ skills, onChange, suggestions, invalid }: SkillsInputProps) {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const copy = t.campaignForm.requirements;
  const [text, setText] = useState('');

  const addSkills = (raw: string) => {
    const taken = new Set(skills.map((skill) => skill.toLowerCase()));
    const added: string[] = [];
    for (const part of raw.split(',')) {
      const skill = part.trim().replace(/\s+/g, ' ');
      if (skill && !taken.has(skill.toLowerCase())) {
        taken.add(skill.toLowerCase());
        added.push(skill);
      }
    }
    if (added.length > 0) onChange([...skills, ...added]);
    setText('');
  };

  return (
    <View className="gap-3">
      {skills.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {skills.map((skill) => (
            <Animated.View
              key={skill}
              entering={ZoomIn.springify().damping(16)}
              exiting={ZoomOut.duration(140)}
              layout={CHIP_LAYOUT}
              className="h-8 flex-row items-center gap-0.5 rounded-full bg-indigo-50 pl-3 pr-1 dark:bg-indigo-500/15"
            >
              <Text className="text-sm font-medium text-indigo-800 dark:text-indigo-100">{skill}</Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={copy.removeSkill(skill)}
                onPress={() => onChange(skills.filter((item) => item !== skill))}
                hitSlop={6}
                className="h-6 w-6 items-center justify-center rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/25"
              >
                <Ionicons name="close" size={14} color={palette.indigo} />
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      )}

      <View className="flex-row gap-2">
        <TextField
          value={text}
          // Typing or pasting a comma adds everything before it.
          onChangeText={(value) => (value.includes(',') ? addSkills(value) : setText(value))}
          onSubmitEditing={() => addSkills(text)}
          // Stay focused after Enter so several skills can be typed in a row. Native reads
          // submitBehavior; react-native-web 0.21 only reads blurOnSubmit.
          submitBehavior="submit"
          blurOnSubmit={false}
          placeholder={copy.skillPlaceholder}
          accessibilityLabel={copy.skills}
          invalid={invalid}
          returnKeyType="done"
          maxLength={40}
          className="flex-1"
        />
        <PressableScale
          accessibilityRole="button"
          onPress={() => addSkills(text)}
          disabled={!text.trim()}
          className={`h-11 flex-row items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 dark:border-white/15 dark:bg-white/5 ${
            text.trim() ? 'hover:bg-slate-50 dark:hover:bg-white/10' : 'opacity-50'
          }`}
        >
          <Ionicons name="add" size={16} color={palette.icon.strong} />
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{copy.addSkill}</Text>
        </PressableScale>
      </View>

      {suggestions.length > 0 && (
        <Animated.View entering={FadeIn.duration(250)} className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="sparkles" size={13} color={palette.violet} />
            <Text className="text-xs font-semibold text-violet-700 dark:text-violet-300">{copy.suggestions}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((skill) => (
              <Animated.View
                key={skill}
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(120)}
                layout={CHIP_LAYOUT}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={copy.addSuggestion(skill)}
                  onPress={() => onChange([...skills, skill])}
                  className="h-8 flex-row items-center gap-1 rounded-full border border-dashed border-violet-300 bg-violet-50/60 px-3 hover:bg-violet-100 dark:border-violet-400/40 dark:bg-violet-500/10 dark:hover:bg-violet-500/20"
                >
                  <Ionicons name="add" size={14} color={palette.violet} />
                  <Text className="text-sm font-medium text-violet-800 dark:text-violet-200">{skill}</Text>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
