import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatLineProps = {
  label: string;
  value: string;
  divider?: boolean;
  /** A control after the value, e.g. a copy button. */
  trailing?: ReactNode;
};

/** A label on the left and its figure on the right. */
export function StatLine({ label, value, divider, trailing }: StatLineProps) {
  const theme = useTheme();

  return (
    <View
      accessible={!trailing}
      accessibilityLabel={trailing ? undefined : `${label}: ${value}`}
      style={[
        styles.row,
        trailing ? styles.withTrailing : null,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.right}>
        <ThemedText type="bodySmall" style={styles.value} selectable={Boolean(trailing)}>
          {value}
        </ThemedText>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  withTrailing: {
    paddingVertical: 2,
  },
  right: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
});
