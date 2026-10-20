import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { niceTicks } from '@/utils/chart-scale';

import { Gridlines, XLabels, YAxis } from './chart-axis';

export type BarSeries = {
  key: string;
  /** Chart colours are data, so this stays a value. */
  color: string;
  values: number[];
};

export type BarChartProps = {
  /** One label per group along the bottom; `''` leaves a gap (e.g. on busy daily charts). */
  labels: string[];
  /** One or two series; each group gets a bar per series, side by side. */
  series: BarSeries[];
  /** The unit over the y-axis, e.g. `GHS`. */
  unit: string;
  /** Plot height in px. */
  height?: number;
  /** The tapped group; the others fade so it stands out. */
  selected?: number | null;
  onSelect?: (index: number) => void;
  /** The group drawn at full strength when none is tapped, e.g. this month. */
  emphasis?: number;
  /** A value over each bar (single series only), e.g. `21.30`. */
  capLabels?: string[];
  /** What a screen reader hears for each group, e.g. `October: out GHS 2,723.40`. */
  groupLabel: (index: number) => string;
  accessibilityLabel: string;
};

const MAX_BAR = 24;
const CAP_ROOM = 16;

/**
 * Columns from one baseline, with a y-axis of round values, gridlines and a
 * label under each group. Tap a group to select it.
 */
export function BarChart({
  labels,
  series,
  unit,
  height = 160,
  selected = null,
  onSelect,
  emphasis,
  capLabels,
  groupLabel,
  accessibilityLabel,
}: BarChartProps) {
  const [width, setWidth] = useState(0);
  const count = labels.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const { top, ticks } = niceTicks(max, 2.5);
  // Leave room over the tallest bar for its value.
  const plot = capLabels ? height - CAP_ROOM : height;
  const scale = (value: number) => (top ? (value / top) * plot : 0);
  const groupWidth = count ? width / count : 0;
  const barWidth = Math.max(2, Math.min(MAX_BAR, (groupWidth * 0.7 - (series.length - 1) * 2) / series.length));
  const focus = selected ?? emphasis;

  return (
    <View accessibilityLabel={accessibilityLabel}>
      {/* Bottom-aligned, so the tick labels sit level with the gridlines. */}
      <View className="flex-row items-end">
        <YAxis ticks={ticks} top={top} height={plot} unit={unit} />
        <View className="flex-1" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          <View style={{ height }}>
            <Gridlines ticks={ticks} top={top} height={plot} />
            <View className="absolute inset-0 flex-row items-end">
              {labels.map((_, index) => {
                const faded = focus !== undefined && focus !== null && focus !== index;
                return (
                  <Pressable
                    key={index}
                    accessibilityRole={onSelect ? 'button' : undefined}
                    accessibilityLabel={groupLabel(index)}
                    accessibilityState={onSelect ? { selected: selected === index } : undefined}
                    disabled={!onSelect}
                    onPress={() => onSelect?.(index)}
                    className={`h-full flex-1 items-center justify-end rounded-t-lg ${selected === index ? 'bg-surface-selected' : ''}`}>
                    {capLabels && (
                      <Text
                        numberOfLines={1}
                        className="mb-0.5 font-sans-semibold text-[10px] leading-[12px] text-content-secondary"
                        style={{ fontVariant: ['tabular-nums'] }}>
                        {capLabels[index]}
                      </Text>
                    )}
                    <View className={`flex-row items-end gap-0.5 ${faded ? 'opacity-45' : ''}`}>
                      {series.map((s) => (
                        <View
                          key={s.key}
                          // Bar heights are data, so they stay computed values.
                          style={{
                            width: barWidth,
                            height: Math.max(s.values[index] > 0 ? 2 : 0, scale(s.values[index])),
                            backgroundColor: s.color,
                            borderTopLeftRadius: Math.min(4, barWidth / 2),
                            borderTopRightRadius: Math.min(4, barWidth / 2),
                          }}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
      <XLabels labels={labels} emphasis={focus ?? undefined} />
    </View>
  );
}
