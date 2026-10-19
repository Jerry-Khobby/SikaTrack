import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText, ThemedView, type IconName } from '@/components/atoms';
import { IconCircle } from '@/components/molecules';
import { MaxContentWidth, Spacing } from '@/theme';

type MessageTemplateProps = {
  icon: IconName;
  title: string;
  message: string;
  action: ReactNode;
};

/** A full-screen message: illustration, title and one sentence in the middle, one action at the bottom. */
export function MessageTemplate({ icon, title, message, action }: MessageTemplateProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.body}>
          <IconCircle icon={icon} />
          <ThemedText type="headline" accessibilityRole="header" style={styles.center}>
            {title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.center, styles.message]}>
            {message}
          </ThemedText>
        </View>
        {action}
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
    padding: Spacing.four,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  center: {
    textAlign: 'center',
  },
  message: {
    maxWidth: 290,
    lineHeight: 24,
  },
});
