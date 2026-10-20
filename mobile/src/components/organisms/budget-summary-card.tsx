import { Text, View } from 'react-native';

import { BrandColors } from '@/theme/colors';
import { ProgressBar } from '@/components/atoms';

export type BudgetSummaryCardProps = {
  /** E.g. `GHS 1,840.00`. */
  spent: string;
  /** E.g. `GHS 2,600.00`. */
  budgeted: string;
  /** Spent over budgeted, from 0 (more than 1 shows a full bar). */
  used: number;
  /** E.g. `11 days left in October`, or `October is over` for a past month. */
  footnote: string;
};

/** The ink card on top of S23: everything budgeted this month and how much of it is gone. */
export function BudgetSummaryCard({ spent, budgeted, used, footnote }: BudgetSummaryCardProps) {
  return (
    <View className="rounded-[22px] bg-brand-ink p-5">
      <Text className="font-sans-semibold text-[13px] leading-[18px] text-brand-on-ink-muted">Spent so far</Text>
      <Text
        className="mt-1 font-sans-extrabold text-[30px] leading-[38px] text-brand-on-ink"
        style={{ fontVariant: ['tabular-nums'] }}
        adjustsFontSizeToFit
        numberOfLines={1}>
        {spent}
        <Text className="font-sans-semibold text-[15px] text-brand-on-ink-muted"> of {budgeted} budgeted</Text>
      </Text>
      <View className="mt-[14px]">
        <ProgressBar
          progress={used}
          accessibilityLabel={`${Math.round(used * 100)}% of your budgets used`}
          color={BrandColors.gold}
          trackColor={BrandColors.inkSkeleton}
        />
      </View>
      <Text className="mt-2.5 font-sans text-[12px] leading-[17px] text-brand-on-ink-muted">{footnote}</Text>
    </View>
  );
}
