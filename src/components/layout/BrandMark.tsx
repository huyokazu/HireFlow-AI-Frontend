import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

export function BrandMark({ showTagline = true }: { showTagline?: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="sparkles" size={18} color="#FFFFFF" />
      </View>
      <View>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-base font-bold text-slate-900">HireFlow AI</Text>
          <View className="rounded-md bg-indigo-50 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold text-indigo-700">2.0</Text>
          </View>
        </View>
        {showTagline && <Text className="text-xs text-slate-500">Recruitment Ops Manager</Text>}
      </View>
    </View>
  );
}
