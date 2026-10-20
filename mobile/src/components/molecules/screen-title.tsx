import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';

export type ScreenTitleProps = {
  title: string;
};

/** A tab's big title, e.g. "Transactions". */
export function ScreenTitle({ title }: ScreenTitleProps) {
  return (
    <ThemedText accessibilityRole="header" style={styles.title}>
      {title}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    lineHeight: 30,
    marginLeft: 4,
    marginBottom: 12,
  },
});
