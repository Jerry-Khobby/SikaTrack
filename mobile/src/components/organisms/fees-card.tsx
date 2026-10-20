import { View } from 'react-native';

import { BarChart, Card, ThemedText } from '@/components/atoms';
import { ChangeBadge } from '@/components/molecules';
import { DataColors } from '@/theme/colors';

export type FeesCardProps = {
  /** E.g. `GHS 21.30`. */
  total: string;
  /** E.g. `30.6% vs September`; left out with nothing to compare. */
  change?: { text: string; down: boolean };
  unit: string;
  /** Month labels under the bars, oldest first. */
  labels: string[];
  amounts: number[];
  /** Each bar's amount over it, e.g. `21.30`. */
  capLabels: string[];
  /** The month on screen, drawn at full strength. */
  current: number;
  monthLabel: (index: number) => string;
};

/** S17e's hero: the month's fees and tax, the change, and six months of fees with every bar labelled. */
export function FeesCard({ total, change, unit, labels, amounts, capLabels, current, monthLabel }: FeesCardProps) {
  return (
    <Card radius={22} className="p-[18px]" padded={false}>
      <ThemedText type="none" themeColor="textSecondary" className="font-sans-semibold text-[13px] leading-[18px]">
        Fees and tax this month
      </ThemedText>
      <ThemedText
        type="none"
        className="mt-1 font-sans-extrabold text-[34px] leading-[42px] tracking-[-0.5px]"
        style={{ fontVariant: ['tabular-nums'] }}>
        {total}
      </ThemedText>
      {change && (
        // Fees going down is good.
        <ChangeBadge text={change.text} down={change.down} good={change.down} onSurface />
      )}
      <View className="mt-[18px]">
        <BarChart
          labels={labels}
          unit={unit}
          height={130}
          series={[{ key: 'fees', color: DataColors.moneyOut, values: amounts }]}
          capLabels={capLabels}
          emphasis={current}
          groupLabel={monthLabel}
          accessibilityLabel="Fees and tax by month"
        />
      </View>
    </Card>
  );
}
