import { StyleSheet, View } from 'react-native';

import { Card, DonutChart, ThemedText } from '@/components/atoms';
import { LegendRow, SectionHeader } from '@/components/molecules';
import { DataColors, FontFamily } from '@/theme';
import type { CategorySpending } from '@/services/summary';
import { formatMoney, formatMoneyWhole, formatShare } from '@/utils/format';
import { toPesewas } from '@/utils/money';

export type CategoryBreakdownCardProps = {
  spending: CategorySpending;
  currency: string;
  onPressCategory: (categoryId: string) => void;
  onSeeAll: () => void;
};

const TOP_IN_CHART = DataColors.categories.length;
const TOP_IN_LIST = 3;

/** A donut of the top five categories plus Other, and the top three as rows. */
export function CategoryBreakdownCard({ spending, currency, onPressCategory, onSeeAll }: CategoryBreakdownCardProps) {
  const top = spending.items.slice(0, TOP_IN_CHART);
  const rest = toPesewas(spending.total) - top.reduce((sum, item) => sum + toPesewas(item.amount), 0);
  const segments = [
    ...top.map((item, index) => ({ value: toPesewas(item.amount), color: DataColors.categories[index] })),
    ...(rest > 0 ? [{ value: rest, color: DataColors.categoryOther }] : []),
  ];
  const restShare = toPesewas(spending.total) ? rest / toPesewas(spending.total) : 0;
  const description = [
    ...top.map((item) => `${item.category.name} ${formatShare(item.share)}`),
    ...(rest > 0 ? [`Other ${Math.round(restShare * 100)}%`] : []),
  ].join(', ');

  return (
    <Card>
      <SectionHeader title="Spending by category" actionLabel="See all" onAction={onSeeAll} />
      <View style={styles.body}>
        <DonutChart segments={segments} accessibilityLabel={`Spending donut: ${description}`}>
          <ThemedText type="fine" themeColor="textSecondary" style={styles.centerLabel}>
            Total
          </ThemedText>
          <ThemedText style={styles.centerValue}>{formatMoneyWhole(spending.total, currency)}</ThemedText>
        </DonutChart>
        <View style={styles.legend}>
          {top.slice(0, TOP_IN_LIST).map((item, index) => (
            <LegendRow
              key={item.category.id}
              color={DataColors.categories[index]}
              title={item.category.name}
              detail={`${formatMoney(item.amount, currency)} · ${formatShare(item.share)}`}
              onPress={() => onPressCategory(item.category.id)}
            />
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  centerLabel: {
    fontSize: 11,
  },
  centerValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flex: 1,
    minWidth: 0,
  },
});
