import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatLineProps = {
  label: string;
  value: string;
  divider?: boolean;
};

/** A label on the left and its figure on the right. */
export function StatLine({ label, value, divider }: StatLineProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.row,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="bodySmall" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  value: {
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
});
