import { View } from 'react-native';

import { Card, DonutChart, ThemedText } from '@/components/atoms';
import { LegendRow, SectionHeader } from '@/components/molecules';
import { useDataColors } from '@/hooks/use-data-colors';
import { DataColors } from '@/theme';
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
  const dataColors = useDataColors();
  const top = spending.items.slice(0, TOP_IN_CHART);
  const rest = toPesewas(spending.total) - top.reduce((sum, item) => sum + toPesewas(item.amount), 0);
  const segments = [
    ...top.map((item, index) => ({ value: toPesewas(item.amount), color: dataColors.categories[index] })),
    ...(rest > 0 ? [{ value: rest, color: dataColors.categoryOther }] : []),
  ];
  const restShare = toPesewas(spending.total) ? rest / toPesewas(spending.total) : 0;
  const description = [
    ...top.map((item) => `${item.category.name} ${formatShare(item.share)}`),
    ...(rest > 0 ? [`Other ${Math.round(restShare * 100)}%`] : []),
  ].join(', ');

  return (
    <Card>
      <SectionHeader title="Spending by category" actionLabel="See all" onAction={onSeeAll} />
      <View className="mt-1 flex-row items-center gap-4">
        <DonutChart segments={segments} accessibilityLabel={`Spending donut: ${description}`}>
          <ThemedText type="none" themeColor="textSecondary" className="font-sans text-[11px] leading-[18px]">
            Total
          </ThemedText>
          <ThemedText
            type="none"
            className="font-sans-extrabold text-[15px] leading-[20px]"
            style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoneyWhole(spending.total, currency)}
          </ThemedText>
        </DonutChart>
        <View className="min-w-0 flex-1">
          {top.slice(0, TOP_IN_LIST).map((item, index) => (
            <LegendRow
              key={item.category.id}
              color={dataColors.categories[index]}
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
