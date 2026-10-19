import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/atoms';
import { MaxContentWidth, Spacing } from '@/theme';

type ScreenTemplateProps = {
  children: ReactNode;
  /** Pinned under the content, e.g. the screen's main button. */
  footer?: ReactNode;
};

/** The page frame every screen sits in: themed background, safe area and side gutters. */
export function ScreenTemplate({ children, footer }: ScreenTemplateProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
          <View style={styles.spacer} />
          {footer}
        </ScrollView>
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
  content: {
    flexGrow: 1,
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.four,
  },
});
