import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type RadioCardProps = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

/** A choice in a short list, with a radio dot and a line about what it means. */
export function RadioCard({ title, description, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-[14px] ${
        selected ? 'border-2 border-line-focus' : 'border border-line'
      }`}>
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-[11px] border-2 ${
          selected ? 'border-line-focus' : 'border-line-input'
        }`}>
        {selected && <View className="h-2.5 w-2.5 rounded-[5px] bg-primary" />}
      </View>
      <View className="min-w-0 flex-1">
        <ThemedText type="none" className="font-sans-extrabold text-[15px] leading-[21px]">
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" className="mt-0.5">
          {description}
        </ThemedText>
      </View>
    </Pressable>
  );
}
