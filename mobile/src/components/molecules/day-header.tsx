import { View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type DayHeaderProps = {
  title: string;
  /** That day's money out, already formatted. */
  total: string;
};

/** A sticky day label over a group of transactions. */
export function DayHeader({ title, total }: DayHeaderProps) {
  return (
    <View accessibilityRole="header" className="flex-row justify-between bg-background px-5 pb-1.5 pt-[14px]">
      <ThemedText type="none" className="font-sans-bold text-[13px] leading-[18px]">
        {title}
      </ThemedText>
      <ThemedText
        type="none"
        themeColor="textSecondary"
        className="font-sans-bold text-[13px] leading-[18px]"
        style={{ fontVariant: ['tabular-nums'] }}>
        {total}
      </ThemedText>
    </View>
  );
}
