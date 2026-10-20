import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Card, LineChart, ThemedText } from '@/components/atoms';
import { FilterChip, SectionHeader } from '@/components/molecules';
import { useTheme } from '@/hooks/use-theme';

export type BalanceHistoryCardProps = {
  ranges: string[];
  range: string;
  onRangeChange: (range: string) => void;
  /** One line per wallet; `color` is a chart colour, `values` are amounts (null before its first SMS). */
  lines: { key: string; label: string; color: string; values: (number | null)[] }[];
  /** The day each point stands for, e.g. `Fri 16 Oct`, for the tapped-day readout. */
  days: string[];
  /** Labels spread under the chart, e.g. `['21 Sep', '6 Oct', 'Today']`. */
  xLabels: string[];
  /** The low-balance alert amount, drawn as a dashed red line. */
  threshold: number;
  /** E.g. `GHS 5.00`. */
  thresholdLabel: string;
  unit: string;
  formatAmount: (value: number) => string;
  /** E.g. `3 days below GHS 5.00 this month`. */
  footnote: string;
  loading?: boolean;
};

/**
 * S26's balance history: each wallet's end-of-day balance over 1, 3 or 6
 * months, with the amounts on the y-axis and the exact figures for any day tapped.
 */
export function BalanceHistoryCard({
  ranges,
  range,
  onRangeChange,
  lines,
  days,
  xLabels,
  threshold,
  thresholdLabel,
  unit,
  formatAmount,
  footnote,
  loading,
}: BalanceHistoryCardProps) {
  const theme = useTheme();
  const last = days.length - 1;
  const [selected, setSelected] = useState(last);
  // A new range starts on its latest day again.
  useEffect(() => setSelected(last), [last, range]);
  const day = Math.min(Math.max(0, selected), last);

  return (
    <Card>
      <SectionHeader title="Balance history" />
      <View className="mb-3 flex-row gap-2">
        {ranges.map((r) => (
          <FilterChip key={r} label={r} size="small" active={r === range} onPress={() => onRangeChange(r)} />
        ))}
      </View>
      <View className="mb-3 flex-row flex-wrap gap-x-4 gap-y-1">
        {lines.map((line) => (
          <View key={line.key} className="flex-row items-center gap-1.5">
            <View className="h-0.5 w-3.5 rounded-sm" style={{ backgroundColor: line.color }} />
            <ThemedText type="fine" themeColor="textSecondary">
              {line.label}
            </ThemedText>
          </View>
        ))}
        <View className="flex-row items-center gap-1.5">
          <View className="h-0.5 w-3.5 bg-status-bad" />
          <ThemedText type="fine" themeColor="textSecondary">
            Alert at {thresholdLabel}
          </ThemedText>
        </View>
      </View>
      {loading || days.length === 0 ? (
        <View className="h-[180px] rounded-sm bg-skeleton" />
      ) : (
        <>
          <LineChart
            series={lines.map((line) => ({ values: line.values, color: line.color }))}
            reference={{ value: threshold, color: theme.statusBad }}
            unit={unit}
            xLabels={xLabels}
            surfaceColor={theme.surface}
            crosshairColor={theme.textSecondary}
            selected={day}
            onSelect={setSelected}
            accessibilityLabel={`Balance history, ${range}. Showing ${days[day]}. Swipe up or down to move a day.`}
          />
          {/* The tapped day's figures, so no value is only a position on the chart. */}
          <View accessibilityLiveRegion="polite" className="mt-3 rounded-[14px] bg-background px-3.5 py-3">
            <ThemedText type="none" className="font-sans-extrabold text-[13px] leading-[18px]">
              {days[day]}
            </ThemedText>
            {lines.map((line) => (
              <View key={line.key} className="mt-1.5 flex-row items-center gap-2">
                <View className="h-0.5 w-3.5 rounded-sm" style={{ backgroundColor: line.color }} />
                <ThemedText type="caption" themeColor="textSecondary" className="flex-1">
                  {line.label}
                </ThemedText>
                <ThemedText
                  type="none"
                  themeColor="none"
                  className={`font-sans-bold text-[14px] ${(line.values[day] ?? Infinity) < threshold ? 'text-icon-red' : 'text-content'}`}
                  style={{ fontVariant: ['tabular-nums'] }}>
                  {line.values[day] === null || line.values[day] === undefined ? '—' : formatAmount(line.values[day]!)}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      )}
      <ThemedText type="caption" themeColor="textSecondary" className="mt-3">
        {footnote}
      </ThemedText>
    </Card>
  );
}
