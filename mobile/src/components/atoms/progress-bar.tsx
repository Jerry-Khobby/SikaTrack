import { View } from 'react-native';

export type ProgressBarProps = {
  /** From 0 to 1; more than 1 shows a full bar. */
  progress: number;
  accessibilityLabel: string;
  height?: number;
  /** The filled part; the primary ink by default. */
  color?: string;
  trackColor?: string;
};

export function ProgressBar({ progress, accessibilityLabel, height = 10, color, trackColor }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const rounded = { height, borderRadius: height / 2 };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className="overflow-hidden bg-track"
      style={[rounded, trackColor ? { backgroundColor: trackColor } : null]}>
      <View
        className="h-full bg-primary"
        style={[{ width: `${percent}%`, borderRadius: height / 2 }, color ? { backgroundColor: color } : null]}
      />
    </View>
  );
}
