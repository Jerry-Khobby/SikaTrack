import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/atoms';

type ScreenTemplateProps = {
  children: ReactNode;
  /** Pinned under the content, e.g. the screen's main button. */
  footer?: ReactNode;
};

/** The page frame every screen sits in: themed background, safe area and side gutters. */
export function ScreenTemplate({ children, footer }: ScreenTemplateProps) {
  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="max-w-content flex-1">
        <ScrollView
          contentContainerClassName="grow px-6 pb-6 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
          <View className="min-h-[24px] flex-1" />
          {footer}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
