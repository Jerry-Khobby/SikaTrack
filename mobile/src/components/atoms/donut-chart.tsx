import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

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
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
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
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return circle;
            })}
        </G>
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
