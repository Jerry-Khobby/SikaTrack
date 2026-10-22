import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { niceTicks } from '@/utils/chart-scale';

import { Gridlines, XLabels, YAxis } from './chart-axis';

export type LineSeries = {
  /** One value per point, oldest first, all on the same x positions; null where there's no figure (a gap). */
  values: (number | null)[];
  color: string;
};

export type LineChartProps = {
  series: LineSeries[];
  /** A dashed reference line, e.g. the low-balance alert amount. */
  reference?: { value: number; color: string };
  /** The unit over the y-axis, e.g. `GHS`. */
  unit: string;
  /** Labels spread evenly under the plot, e.g. `['20 Sep', '5 Oct', 'Today']`. */
  xLabels: string[];
  /** Surface colour, for the ring round the selected dots. */
  surfaceColor: string;
  /** Colour of the crosshair on the selected day. */
  crosshairColor: string;
  height?: number;
  /** The tapped point; a crosshair and dots mark it. */
  selected?: number | null;
  onSelect?: (index: number) => void;
  accessibilityLabel: string;
};

const WIDTH = 300;
/** Room each side of the plot for the selected dots (radius plus ring). */
const DOT_ROOM = 6;

/**
 * Lines over a y-axis of round values and gridlines. Tap anywhere on the plot
 * to pick the nearest day; the card shows its figures.
 */
export function LineChart({
  series,
  reference,
  unit,
  xLabels,
  surfaceColor,
  crosshairColor,
  height = 150,
  selected = null,
  onSelect,
  accessibilityLabel,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const length = Math.max(0, ...series.map((s) => s.values.length));
  const all = series
    .flatMap((s) => s.values)
    .filter((value): value is number => value !== null)
    .concat(reference ? [reference.value] : []);
  const { top, ticks } = niceTicks(Math.max(0, ...all), 2.5);
  const x = (index: number) => (length > 1 ? (index / (length - 1)) * WIDTH : WIDTH / 2);
  const y = (value: number) => height * (1 - value / top);
  /** Each unbroken run of values as its own polyline, so gaps stay gaps. */
  const runs = (values: (number | null)[]) => {
    const result: string[] = [];
    let run: string[] = [];
    values.forEach((value, index) => {
      if (value === null) {
        if (run.length) result.push(run.join(' '));
        run = [];
      } else run.push(`${x(index)},${y(value)}`);
    });
    if (run.length) result.push(run.join(' '));
    return result;
  };

  const pick = (locationX: number) => {
    if (!onSelect || width === 0 || length === 0) return;
    onSelect(Math.min(length - 1, Math.max(0, Math.round((locationX / width) * (length - 1)))));
  };

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <View className="flex-row items-end">
        <YAxis ticks={ticks} top={top} height={height} unit={unit} />
        <Pressable
          accessibilityRole={onSelect ? 'adjustable' : 'image'}
          accessibilityLabel={accessibilityLabel}
          accessibilityActions={onSelect ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
          onAccessibilityAction={(event) => {
            if (!onSelect || length === 0) return;
            const from = selected ?? length - 1;
            onSelect(Math.min(length - 1, Math.max(0, from + (event.nativeEvent.actionName === 'increment' ? 1 : -1))));
          }}
          onPress={(event) => pick(event.nativeEvent.locationX)}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className="flex-1"
          style={{ height }}>
          <Gridlines ticks={ticks} top={top} height={height} />
          <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none">
            {reference && (
              <Line
                x1={0}
                y1={y(reference.value)}
                x2={WIDTH}
                y2={y(reference.value)}
                stroke={reference.color}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {series.flatMap((s, index) =>
              runs(s.values).map((points, run) => (
              <Polyline
                key={`${index}-${run}`}
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              )),
            )}
            {selected !== null && (
              <Line
                x1={x(selected)}
                y1={0}
                x2={x(selected)}
                y2={height}
                stroke={crosshairColor}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </Svg>
          {/* Dots in px, so the stretched viewBox doesn't squash them into ovals. */}
          {selected !== null && width > 0 && (
            // A little wider than the plot, so a dot on the first or last day isn't cut in half.
            <Svg pointerEvents="none" width={width + DOT_ROOM * 2} height={height} style={{ position: 'absolute', left: -DOT_ROOM, top: 0 }}>
              {series.map((s, index) => {
                const value = s.values[selected];
                return value === null || value === undefined ? null : (
                  <Circle
                    key={index}
                    cx={(x(selected) / WIDTH) * width + DOT_ROOM}
                    cy={y(value)}
                    r={4}
                    fill={s.color}
                    stroke={surfaceColor}
                    strokeWidth={2}
                  />
                );
              })}
            </Svg>
          )}
        </Pressable>
      </View>
      <XLabels labels={xLabels} />
    </View>
  );
}
