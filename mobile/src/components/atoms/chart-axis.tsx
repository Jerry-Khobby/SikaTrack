import { Text, View } from 'react-native';

import { formatTick } from '@/utils/chart-scale';

/** How wide the y-axis labels column is, so x labels can line up with the plot. */
export const Y_AXIS_WIDTH = 34;

export type YAxisProps = {
  ticks: number[];
  top: number;
  /** Height of the plot the ticks measure, in px. */
  height: number;
  /** The unit over the axis, e.g. `GHS`. */
  unit?: string;
};

/** Tick values up the left of a chart, with the unit on top, e.g. GHS · 4K · 2K · 0. */
export function YAxis({ ticks, top, height, unit }: YAxisProps) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: Y_AXIS_WIDTH }}>
      {unit && <Text className="mb-1 font-sans-bold text-[10px] leading-[12px] text-content-secondary">{unit}</Text>}
      <View style={{ height }}>
        {ticks.map((tick) => (
          <Text
            key={tick}
            className="absolute left-0 right-1.5 text-right font-sans text-[10px] leading-[12px] text-content-secondary"
            style={{ bottom: (tick / top) * height - 6, fontVariant: ['tabular-nums'] }}>
            {formatTick(tick)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Hairline gridlines at each tick, the zero line a step darker as the baseline. */
export function Gridlines({ ticks, top, height }: Omit<YAxisProps, 'unit'>) {
  return (
    <View pointerEvents="none" className="absolute inset-x-0 bottom-0" style={{ height }}>
      {ticks.map((tick) => (
        <View
          key={tick}
          className={`absolute inset-x-0 h-px ${tick === 0 ? 'bg-line-input' : 'bg-divider'}`}
          style={{ bottom: (tick / top) * height }}
        />
      ))}
    </View>
  );
}

/** Labels under a chart, one per position; empty strings leave a gap. */
export function XLabels({ labels, emphasis }: { labels: string[]; emphasis?: number }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="mt-1.5 flex-row"
      style={{ marginLeft: Y_AXIS_WIDTH }}>
      {labels.map((label, index) => (
        <Text
          key={index}
          numberOfLines={1}
          className={`flex-1 text-center text-[10px] leading-[12px] ${
            index === emphasis ? 'font-sans-extrabold text-content' : 'font-sans text-content-secondary'
          }`}>
          {label}
        </Text>
      ))}
    </View>
  );
}
