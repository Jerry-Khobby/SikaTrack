import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, DonutChart, ThemedText } from '@/components/atoms';

export type DonutSlice = {
  key: string;
  name: string;
  color: string;
  value: number;
  /** E.g. `41%`. */
  share: string;
  /** E.g. `GHS 1,122`. */
  amount: string;
};

export type CategoryDonutCardProps = {
  /** The top five and Other, largest first. */
  slices: DonutSlice[];
  /** In the hole: e.g. `October`, `GHS 2,723`, `128 payments`. */
  caption: string;
  total: string;
  footnote: string;
  /** A control over the chart, e.g. Spending / Money in. */
  header?: ReactNode;
};

/**
 * S17a's donut: the month's total in the middle and, under it, a key that
 * gives every slice its amount and share, so no value is only an angle.
 */
export function CategoryDonutCard({ slices, caption, total, footnote, header }: CategoryDonutCardProps) {
  return (
    <Card radius={22}>
      {header}
      <View className="mt-[18px] items-center">
        <DonutChart
          size={200}
          thickness={26}
          segments={slices.map((slice) => ({ value: slice.value, color: slice.color }))}
          accessibilityLabel={`${caption}: ${total}. ${slices.map((s) => `${s.name} ${s.amount}, ${s.share}`).join('; ')}`}>
          <ThemedText type="fine" themeColor="textSecondary">
            {caption}
          </ThemedText>
          <ThemedText type="none" className="font-sans-extrabold text-[22px] leading-[28px]" style={{ fontVariant: ['tabular-nums'] }}>
            {total}
          </ThemedText>
          <ThemedText type="fine" themeColor="textSecondary">
            {footnote}
          </ThemedText>
        </DonutChart>
      </View>
      <View className="mt-4 gap-2" accessible={false} importantForAccessibility="no-hide-descendants">
        {slices.map((slice) => (
          <View key={slice.key} className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: slice.color }} />
            <ThemedText type="caption" className="flex-1" numberOfLines={1}>
              {slice.name}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" className="w-10 text-right" style={{ fontVariant: ['tabular-nums'] }}>
              {slice.share}
            </ThemedText>
            <ThemedText
              type="none"
              className="w-[92px] text-right font-sans-bold text-[13px] leading-[18px]"
              style={{ fontVariant: ['tabular-nums'] }}>
              {slice.amount}
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
}
