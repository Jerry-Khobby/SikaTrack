import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, ThemedText, ThemedView } from '@/components/atoms';

type AuthStepTemplateProps = {
  title: string;
  subtitle?: ReactNode;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** One step of sign-in: back arrow, title and subtitle, the form, and a footer that rides above the keyboard. */
export function AuthStepTemplate({ title, subtitle, onBack, children, footer }: AuthStepTemplateProps) {
  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="max-w-content flex-1">
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            contentContainerClassName="grow px-6 pb-6 pt-3"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="-ml-3 self-start">
              <IconButton icon="chevron-left" accessibilityLabel="Back" onPress={onBack} />
            </View>
            <ThemedText type="title" accessibilityRole="header" className="mb-2 mt-6">
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-7">
                {subtitle}
              </ThemedText>
            )}
            {children}
            <View className="min-h-[24px] flex-1" />
            {footer}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
