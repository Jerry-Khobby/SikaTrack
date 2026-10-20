import { Pressable, View } from 'react-native';

import { CategoryGlyph, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type CategorySpendRowProps = {
  categoryId: string;
  name: string;
  /** E.g. `GHS 612.50`. */
  amount: string;
  /** Fraction of the largest category, for the bar's length. */
  barFraction: number;
  /** The category's chart colour, the same as its donut segment. */
  color: string;
  /** E.g. `22% of spending · 44 payments`. */
  detail: string;
  /** When the category has a budget: how much of it is used. */
  budget?: { used: number; label: string };
  onPress: () => void;
  divider?: boolean;
};

/** One category on S17a: its amount, a bar for its size, its share, and its budget. */
export function CategorySpendRow({ categoryId, name, amount, barFraction, color, detail, budget, onPress, divider }: CategorySpendRowProps) {
  const theme = useTheme();
  const budgetTone = !budget ? null : budget.used > 1 ? 'over' : budget.used >= 0.8 ? 'warning' : 'good';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, amount, detail, budget?.label].filter(Boolean).join(', ')}
      onPress={onPress}
      className={`flex-row gap-3 px-4 py-[14px] active:bg-unread-row ${divider ? 'border-b border-divider' : ''}`}>
      <View className="h-10 w-10 items-center justify-center rounded-[20px] bg-avatar">
        <CategoryGlyph categoryId={categoryId} color={theme.text} size={19} />
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row justify-between gap-2">
          <ThemedText type="none" className="shrink font-sans-bold text-[15px] leading-[21px]" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="none" className="font-sans-bold text-[15px] leading-[21px]" style={{ fontVariant: ['tabular-nums'] }}>
            {amount}
          </ThemedText>
        </View>
        <View className="h-1.5 overflow-hidden rounded-sm bg-chip">
          <View className="h-full rounded-sm" style={{ width: `${Math.max(1, barFraction * 100)}%`, backgroundColor: color }} />
        </View>
        <ThemedText type="fine" themeColor="textSecondary">
          {detail}
        </ThemedText>
        {budget && (
          <View className="flex-row items-center gap-2">
            <View className="h-1 flex-1 overflow-hidden rounded-sm bg-chip">
              <View
                className={`h-full ${budgetTone === 'over' ? 'bg-status-bad' : budgetTone === 'warning' ? 'bg-status-warning' : 'bg-status-good'}`}
                style={{ width: `${Math.min(100, budget.used * 100)}%` }}
              />
            </View>
            <ThemedText
              type="none"
              themeColor="none"
              className={`font-sans-bold text-[12px] ${
                budgetTone === 'over' ? 'text-icon-red' : budgetTone === 'warning' ? 'text-icon-amber' : 'text-icon-success'
              }`}>
              {budget.label}
            </ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}
