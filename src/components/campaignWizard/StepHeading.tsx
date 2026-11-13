import { Text, View } from 'react-native';

/** Title and one-line explanation at the top of a wizard step. */
export function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="mb-5">
      <Text accessibilityRole="header" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        {title}
      </Text>
      <Text className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</Text>
    </View>
  );
}
