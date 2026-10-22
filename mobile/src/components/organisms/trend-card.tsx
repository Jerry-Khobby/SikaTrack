import { Pressable, Text, View } from 'react-native';

import { BarChart, Card, Icon, ThemedText } from '@/components/atoms';
import { SegmentedControl } from '@/components/molecules';
import { useTheme } from '@/hooks/use-theme';
import { useDataColors } from '@/hooks/use-data-colors';
import type { Granularity } from '@/utils/periods';

export type TrendCardProps = {
  granularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
  unit: string;
  /** Under each pair of bars; `''` for a gap. */
  labels: string[];
  moneyOut: number[];
  moneyIn: number[];
  selected: number;
  onSelect: (index: number) => void;
  /** What a screen reader hears for each pair, e.g. `October 2026: out GHS 2,723.40, in GHS 1,480.00`. */
  groupLabel: (index: number) => string;
  /** The tapped period's exact figures. */
  readout: { title: string; moneyOut: string; moneyIn: string; fees: string };
  onSeeTransactions: () => void;
};

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

/**
 * S17b: money out and in per period as paired bars over a y-axis of amounts.
 * Tap a pair for its exact figures, fees included, and its transactions.
 */
export function TrendCard({
  granularity,
  onGranularityChange,
  unit,
  labels,
  moneyOut,
  moneyIn,
  selected,
  onSelect,
  groupLabel,
  readout,
  onSeeTransactions,
}: TrendCardProps) {
  const theme = useTheme();
  const dataColors = useDataColors();

  return (
    <Card radius={22}>
      <SegmentedControl options={OPTIONS} value={granularity} onChange={onGranularityChange} accessibilityLabel="Show by" />
      <View className="mb-2.5 mt-4 flex-row gap-[14px]">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: dataColors.moneyOut }} />
          <ThemedText type="fine">Money out</ThemedText>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: dataColors.moneyIn }} />
          <ThemedText type="fine">Money in</ThemedText>
        </View>
      </View>
      <BarChart
        labels={labels}
        unit={unit}
        height={180}
        series={[
          { key: 'out', color: dataColors.moneyOut, values: moneyOut },
          { key: 'in', color: dataColors.moneyIn, values: moneyIn },
        ]}
        selected={selected}
        onSelect={onSelect}
        groupLabel={groupLabel}
        accessibilityLabel="Money out and in over time"
      />
      <View accessibilityLiveRegion="polite" className="mt-[14px] rounded-[14px] bg-background px-3.5 py-3">
        <ThemedText type="none" className="font-sans-extrabold text-[13px] leading-[18px]">
          {readout.title}
        </ThemedText>
        <View className="mt-2 flex-row gap-1.5">
          {[
            { label: 'Out', value: readout.moneyOut, tone: 'text-content' },
            { label: 'In', value: readout.moneyIn, tone: 'text-money-in' },
            { label: 'Fees & tax', value: readout.fees, tone: 'text-content' },
          ].map((figure) => (
            <View key={figure.label} className="flex-1">
              <ThemedText type="fine" themeColor="textSecondary">
                {figure.label}
              </ThemedText>
              <Text className={`font-sans-bold text-[14px] ${figure.tone}`} style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
                {figure.value}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={onSeeTransactions}
          className="mt-1.5 h-9 flex-row items-center gap-1 self-start">
          <Text className="font-sans-bold text-[13px] text-link">See these transactions</Text>
          <Icon name="chevron-right" color={theme.link} size={14} />
        </Pressable>
      </View>
    </Card>
  );
}
