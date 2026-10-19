import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, ThemedText, ThemedView } from '@/components/atoms';
import { MaxContentWidth, Spacing } from '@/theme';

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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.back}>
              <IconButton icon="chevron-left" accessibilityLabel="Back" onPress={onBack} />
            </View>
            <ThemedText type="title" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText type="bodySmall" themeColor="textSecondary" style={styles.subtitle}>
                {subtitle}
              </ThemedText>
            )}
            {children}
            <View style={styles.spacer} />
            {footer}
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
    paddingTop: 12,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  back: {
    marginLeft: -12,
    alignSelf: 'flex-start',
  },
  title: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  subtitle: {
    marginBottom: 28,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.four,
  },
});
