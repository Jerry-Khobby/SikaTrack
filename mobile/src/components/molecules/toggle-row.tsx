import { View } from 'react-native';

import { ThemedText, Toggle } from '@/components/atoms';

export type ToggleRowProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
};

/** A setting with a title, one line about it, and a switch. */
export function ToggleRow({ title, description, value, onValueChange, divider }: ToggleRowProps) {
  return (
    <View className={`flex-row items-center gap-[14px] py-[14px] ${divider ? 'border-b border-divider' : ''}`}>
      <View className="min-w-0 flex-1">
        <ThemedText type="none" className="font-sans-bold text-[15px] leading-[21px]">
          {title}
        </ThemedText>
        <ThemedText type="none" themeColor="textSecondary" className="mt-[3px] font-sans text-[13px] leading-[19px]">
          {description}
        </ThemedText>
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}
