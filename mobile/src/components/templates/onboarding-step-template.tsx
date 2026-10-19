import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/atoms';
import { StepProgress } from '@/components/molecules';
import { MaxContentWidth, Spacing } from '@/theme';

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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <StepProgress step={step} total={totalSteps} showLabel={showStepLabel} />
            {centered ? (
              <View style={styles.centered}>{children}</View>
            ) : (
              <>
                {children}
                <View style={styles.spacer} />
              </>
            )}
            <View style={styles.footer}>{footer}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: Spacing.four,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.four,
  },
  footer: {
    gap: Spacing.two,
  },
});
