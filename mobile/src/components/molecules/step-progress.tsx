import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type StepProgressProps = {
  step: number;
  total: number;
  /** Also write "Step 1 of 5" under the bar. */
  showLabel?: boolean;
};

/** One segment per step; the steps done so far are filled in. */
export function StepProgress({ step, total, showLabel }: StepProgressProps) {
  const theme = useTheme();
  const label = `Step ${step} of ${total}`;

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, { backgroundColor: index < step ? theme.primary : theme.track }]}
          />
        ))}
      </View>
      {showLabel && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  label: {
    marginTop: 12,
    fontFamily: FontFamily.semiBold,
  },
});
