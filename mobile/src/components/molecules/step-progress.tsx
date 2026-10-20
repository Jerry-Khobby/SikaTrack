import { View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type StepProgressProps = {
  step: number;
  total: number;
  /** Also write "Step 1 of 5" under the bar. */
  showLabel?: boolean;
};

/** One segment per step; the steps done so far are filled in. */
export function StepProgress({ step, total, showLabel }: StepProgressProps) {
  const label = `Step ${step} of ${total}`;

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <View className="flex-row gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <View key={index} className={`h-[5px] flex-1 rounded-[3px] ${index < step ? 'bg-primary' : 'bg-track'}`} />
        ))}
      </View>
      {showLabel && (
        <ThemedText
          type="none"
          themeColor="textSecondary"
          className="mt-3 font-sans-semibold text-[13px] leading-[18px]">
          {label}
        </ThemedText>
      )}
    </View>
  );
}
