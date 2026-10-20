import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type StatLineProps = {
  label: string;
  value: string;
  divider?: boolean;
  /** A control after the value, e.g. a copy button. */
  trailing?: ReactNode;
};

/** A label on the left and its figure on the right. */
export function StatLine({ label, value, divider, trailing }: StatLineProps) {
  return (
    <View
      accessible={!trailing}
      accessibilityLabel={trailing ? undefined : `${label}: ${value}`}
      className={`flex-row items-center justify-between gap-3 ${trailing ? 'py-0.5' : 'py-3'} ${divider ? 'border-b border-divider' : ''}`}>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View className="shrink flex-row items-center gap-1">
        <ThemedText
          type="none"
          className="shrink text-right font-sans-bold text-[15px] leading-[23px]"
          style={{ fontVariant: ['tabular-nums'] }}
          selectable={Boolean(trailing)}>
          {value}
        </ThemedText>
        {trailing}
      </View>
    </View>
  );
}
