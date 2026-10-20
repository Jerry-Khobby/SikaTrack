import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor ?? theme.track,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.primary,
        }}
      />
    </View>
  );
}
