import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type ProgressBarProps = {
  /** From 0 to 1. */
  progress: number;
  accessibilityLabel: string;
  height?: number;
};

export function ProgressBar({ progress, accessibilityLabel, height = 10 }: ProgressBarProps) {
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
        backgroundColor: theme.track,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: theme.primary,
        }}
      />
    </View>
  );
}
