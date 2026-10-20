import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type DayHeaderProps = {
  title: string;
  /** That day's money out, already formatted. */
  total: string;
};

/** A sticky day label over a group of transactions. */
export function DayHeader({ title, total }: DayHeaderProps) {
  const theme = useTheme();

  return (
    <View accessibilityRole="header" style={[styles.header, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.text}>{title}</ThemedText>
      <ThemedText style={[styles.text, styles.total]} themeColor="textSecondary">
        {total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
  text: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  total: {
    fontVariant: ['tabular-nums'],
  },
});
