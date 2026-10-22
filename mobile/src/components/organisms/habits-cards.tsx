import { View } from 'react-native';

import { BarChart, Card, Heatmap, HeatmapLegend, ThemedText } from '@/components/atoms';
import { SectionHeader } from '@/components/molecules';
import { useDataColors } from '@/hooks/use-data-colors';
import { formatTick } from '@/utils/chart-scale';

export type HabitsHeatmapCardProps = {
  weekdays: string[];
  dayParts: string[];
  /** `amounts[weekday][dayPart]` in cedis. */
  amounts: number[][];
  /** E.g. `GHS 0` and `GHS 393`, the ends of the shading. */
  lowLabel: string;
  highLabel: string;
  cellLabel: (weekday: number, dayPart: number) => string;
};

/** S17c's "When you spend": weekday by time of day, each cell shaded and labelled with its amount. */
export function HabitsHeatmapCard({ weekdays, dayParts, amounts, lowLabel, highLabel, cellLabel }: HabitsHeatmapCardProps) {
  const dataColors = useDataColors();
  return (
    <Card radius={22}>
      <SectionHeader title="When you spend" />
      <ThemedText type="fine" themeColor="textSecondary" className="mb-3">
        Amounts in cedis. Darker means more.
      </ThemedText>
      <Heatmap
        rows={weekdays}
        columns={dayParts}
        values={amounts}
        color={dataColors.moneyOut}
        formatValue={(value) => formatTick(Math.round(value))}
        cellLabel={cellLabel}
      />
      <HeatmapLegend color={dataColors.moneyOut} low={lowLabel} high={highLabel} />
    </Card>
  );
}

export type HourlyCardProps = {
  unit: string;
  /** 24 amounts, midnight first. */
  amounts: number[];
  selected: number;
  onSelect: (hour: number) => void;
  /** E.g. `13:00–14:00 · GHS 810.00`. */
  readout: string;
  hourLabel: (hour: number) => string;
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => (hour % 6 === 0 ? `${String(hour).padStart(2, '0')}:00` : ''));

/** S17c's "By hour": what was spent in each hour of the day, with a y-axis of amounts. */
export function HourlyCard({ unit, amounts, selected, onSelect, readout, hourLabel }: HourlyCardProps) {
  const dataColors = useDataColors();
  return (
    <Card radius={22}>
      <SectionHeader title="By hour" />
      <BarChart
        labels={HOUR_LABELS}
        unit={unit}
        height={110}
        series={[{ key: 'out', color: dataColors.moneyOut, values: amounts }]}
        selected={selected}
        onSelect={onSelect}
        groupLabel={hourLabel}
        accessibilityLabel="Spending by hour of the day"
      />
      <View accessibilityLiveRegion="polite" className="mt-3 rounded-[14px] bg-background px-3.5 py-2.5">
        <ThemedText type="none" className="font-sans-bold text-[13px] leading-[18px]" style={{ fontVariant: ['tabular-nums'] }}>
          {readout}
        </ThemedText>
      </View>
    </Card>
  );
}
