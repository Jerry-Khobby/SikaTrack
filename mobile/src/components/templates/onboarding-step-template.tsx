import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/atoms';
import { StepProgress } from '@/components/molecules';

type OnboardingStepTemplateProps = {
  step: number;
  totalSteps: number;
  /** Also write "Step 1 of 5" under the bar. */
  showStepLabel?: boolean;
  /** Centre the content in the space, e.g. for a message with an illustration. */
  centered?: boolean;
  children: ReactNode;
  /** The step's buttons, pinned at the bottom. */
  footer: ReactNode;
};

/** One onboarding step: the progress bar at the top, the step's content, its buttons at the bottom. */
export function OnboardingStepTemplate({
  step,
  totalSteps,
  showStepLabel,
  centered,
  children,
  footer,
}: OnboardingStepTemplateProps) {
  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="max-w-content flex-1">
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            contentContainerClassName="grow p-6"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <StepProgress step={step} total={totalSteps} showLabel={showStepLabel} />
            {centered ? (
              <View className="flex-1 items-center justify-center gap-[18px] py-6">{children}</View>
            ) : (
              <>
                {children}
                <View className="min-h-[24px] flex-1" />
              </>
            )}
            <View className="gap-2">{footer}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
