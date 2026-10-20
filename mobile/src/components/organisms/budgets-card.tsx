import { View } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import { BudgetProgress, NavigationRow } from '@/components/molecules';
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
      <View className="flex-row items-center justify-between">
        <ThemedText type="none" className="font-sans-extrabold text-[16px] leading-[22px]">
          Budgets
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary">
          {daysLeft} day{daysLeft === 1 ? '' : 's'} left
        </ThemedText>
      </View>
      <View className="mt-3 gap-3">
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
