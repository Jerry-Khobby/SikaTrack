import { Pressable, Text, View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** A card's title with an optional "See all" on the right. */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View className="min-h-touch flex-row items-center justify-between">
      <ThemedText type="none" accessibilityRole="header" className="font-sans-extrabold text-[16px] leading-[22px]">
        {title}
      </ThemedText>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          onPress={onAction}
          className="h-touch justify-center px-1">
          <Text className="font-sans-bold text-[13px] text-link">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
