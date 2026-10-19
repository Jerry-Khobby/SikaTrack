import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, ThemedText, ThemedView } from '@/components/atoms';
import { MaxContentWidth, Spacing } from '@/theme';

type DetailTemplateProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
};

/** An inner page: back arrow and title in a header row, scrolling content under it. */
export function DetailTemplate({ title, onBack, children }: DetailTemplateProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <IconButton icon="chevron-left" accessibilityLabel="Back" onPress={onBack} />
          <ThemedText type="heading" accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
        </View>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: Spacing.five,
    gap: 12,
  },
});
