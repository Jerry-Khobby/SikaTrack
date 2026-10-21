import { Text, View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type NumberedStepProps = {
  number: number;
  text: string;
};

/** One line of "what happens next", with its number in an ink circle (S37). */
export function NumberedStep({ number, text }: NumberedStepProps) {
  return (
    <View className="flex-row gap-3">
      <View className="h-6 w-6 items-center justify-center rounded-xl bg-primary">
        <Text className="font-sans-extrabold text-[12px] text-on-primary">{number}</Text>
      </View>
      <ThemedText type="none" className="flex-1 font-sans text-[15px] leading-[22px]">
        {text}
      </ThemedText>
    </View>
  );
}
