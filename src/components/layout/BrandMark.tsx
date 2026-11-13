import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../i18n';

type BrandMarkProps = {
  showTagline?: boolean;
  /** Hides the wordmark on phone widths so the header controls fit; the logo stays. */
  collapseNameOnPhones?: boolean;
  /** Just the logo, e.g. on the tablet's icon rail. */
  markOnly?: boolean;
};

export function BrandMark({ showTagline = true, collapseNameOnPhones = false, markOnly = false }: BrandMarkProps) {
  const { t } = useI18n();
  return (
    <View className="flex-row items-center gap-2.5">
      <View
        className="h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
        style={{ boxShadow: '0px 6px 16px -6px rgba(79, 70, 229, 0.7)' }}
      >
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="sparkles" size={18} color="#FFFFFF" />
      </View>
      {!markOnly && (
        <View className={collapseNameOnPhones ? 'hidden sm:flex' : undefined}>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-base font-bold text-slate-900 dark:text-white">HireFlow AI</Text>
            <View className="rounded-md bg-indigo-50 px-1.5 py-0.5 dark:bg-indigo-500/20">
              <Text className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">2.0</Text>
            </View>
          </View>
          {showTagline && (
            <Text className="text-xs text-slate-500 dark:text-slate-400">{t.brand.tagline}</Text>
          )}
        </View>
      )}
    </View>
  );
}
