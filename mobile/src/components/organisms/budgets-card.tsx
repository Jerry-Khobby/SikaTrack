import { StyleSheet, View } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import { BudgetProgress, NavigationRow } from '@/components/molecules';
import { FontFamily } from '@/theme';
import type { Budget } from '@/services/budgets';
import { formatMoneyShort } from '@/utils/format';

export type BudgetsCardProps = {
  /** The budgets to show, already the ones closest to their limit. */
  budgets: Budget[];
  daysLeft: number;
  currency: string;
  onPress: () => void;
};

/** Budgets closest to their limit as bars, or a way to set the first one. */
export function BudgetsCard({ budgets, daysLeft, currency, onPress }: BudgetsCardProps) {
  if (budgets.length === 0) {
    return (
      <NavigationRow
        icon="target"
        title="Set a budget"
        subtitle="Get a heads-up before you overspend."
        onPress={onPress}
      />
    );
  }

  return (
    <Card onPress={onPress} accessibilityLabel="Budgets" radius={18}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Budgets</ThemedText>
        <ThemedText type="fine" themeColor="textSecondary">
          {daysLeft} day{daysLeft === 1 ? '' : 's'} left
        </ThemedText>
      </View>
      <View style={styles.list}>
        {budgets.map((budget) => (
          <BudgetProgress
            key={budget.id}
            name={budget.category.name}
            spent={`${formatMoneyShort(budget.spent, currency)} of ${formatMoneyShort(budget.limit, '').trim()}`}
            used={Number(budget.used)}
            state={budget.state}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    lineHeight: 22,
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
});
