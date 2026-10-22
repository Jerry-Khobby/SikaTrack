import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type DonutSegment = { value: number; color: string };

export type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** What a screen reader hears for the whole chart. */
  accessibilityLabel: string;
  /** Shown in the hole, e.g. the total. */
  children?: ReactNode;
};

const GAP = 1;

/** A ring split into segments sized by value, starting at 12 o'clock. */
export function DonutChart({ segments, size = 132, thickness = 18, accessibilityLabel, children }: DonutChartProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        {/* A circle's stroke starts at 3 o'clock; a quarter turn of offset starts it at 12. No rotation, which web can't render. */}
          {total > 0 &&
            segments.map((segment, index) => {
              const length = (segment.value / total) * circumference;
              const dash = Math.max(0, length - (segments.length > 1 ? GAP : 0));
              const circle = (
                <Circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  // One dash per lap, so a segment that passes the starting point wraps round.
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={circumference / 4 - offset}
                />
              );
              offset += length;
              return circle;
            })}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">{children}</View>
    </View>
  );
}
