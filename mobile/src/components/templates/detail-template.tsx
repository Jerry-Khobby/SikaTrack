import type { ReactNode } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, ThemedText, ThemedView } from '@/components/atoms';
import { MaxContentWidth, Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

type DetailTemplateProps = {
  /** Leave out for a page whose content has its own big heading. */
  title?: string;
  onBack: () => void;
  /** A control at the right of the header, e.g. "Mark all as read". */
  action?: ReactNode;
  children: ReactNode;
  /** Side gutters for the content; 20 by default. */
  gutter?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** An inner page: back arrow and title in a header row, scrolling content under it. */
export function DetailTemplate({
  title,
  onBack,
  action,
  children,
  gutter = 20,
  refreshing,
  onRefresh,
}: DetailTemplateProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <IconButton icon="chevron-left" accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.title}>
            {title && (
              <ThemedText type="heading" accessibilityRole="header">
                {title}
              </ThemedText>
            )}
          </View>
          {action}
        </View>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.text} />
              ) : undefined
            }>
            {children}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: Spacing.two,
  },
  title: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    gap: 12,
  },
});
