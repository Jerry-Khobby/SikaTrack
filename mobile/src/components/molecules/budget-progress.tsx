import { StyleSheet, View } from 'react-native';

import { ProgressBar, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type BudgetState = 'on_track' | 'warning' | 'over';

export type BudgetProgressProps = {
  name: string;
  /** E.g. `GHS 612.50 of 700`. */
  spent: string;
  /** Fraction of the limit used. */
  used: number;
  state: BudgetState;
};

/** A budget's name, how much of it is spent, and a bar coloured by its status. */
export function BudgetProgress({ name, spent, used, state }: BudgetProgressProps) {
  const theme = useTheme();
  const colors = {
    on_track: { bar: theme.statusGood, text: theme.iconSuccess },
    warning: { bar: theme.statusWarning, text: theme.iconAmber },
    over: { bar: theme.statusBad, text: theme.iconRed },
  }[state];

  return (
    <View style={styles.budget}>
      <View style={styles.line}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText style={[styles.spent, { color: colors.text }]}>{spent}</ThemedText>
      </View>
      <ProgressBar
        progress={used}
        height={8}
        color={colors.bar}
        trackColor={theme.divider}
        accessibilityLabel={`${name}: ${spent}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  budget: {
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  spent: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
