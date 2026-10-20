import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText, ThemedView, type IconName } from '@/components/atoms';
import { IconCircle } from '@/components/molecules';

type MessageTemplateProps = {
  icon: IconName;
  title: string;
  message: string;
  action: ReactNode;
};

/** A full-screen message: illustration, title and one sentence in the middle, one action at the bottom. */
export function MessageTemplate({ icon, title, message, action }: MessageTemplateProps) {
  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="max-w-content flex-1 p-6">
        <View className="flex-1 items-center justify-center gap-5">
          <IconCircle icon={icon} />
          <ThemedText type="headline" accessibilityRole="header" className="text-center">
            {title}
          </ThemedText>
          <ThemedText type="none" themeColor="textSecondary" className="max-w-[290px] text-center font-sans text-[16px] leading-[24px]">
            {message}
          </ThemedText>
        </View>
        {action}
      </SafeAreaView>
    </ThemedView>
  );
}
