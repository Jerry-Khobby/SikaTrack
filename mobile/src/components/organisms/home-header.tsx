import { View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { BellButton, FilterChip } from '@/components/molecules';

export type HomeHeaderProps = {
  /** E.g. `Good evening, Jerry`. */
  greeting: string;
  /** The month being shown, e.g. `Oct 2026`. */
  monthLabel: string;
  onPressMonth: () => void;
  unread: number;
  onPressBell: () => void;
};

/** Greeting, month selector and notifications bell (docs/ui-spec.md S12). */
export function HomeHeader({ greeting, monthLabel, onPressMonth, unread, onPressBell }: HomeHeaderProps) {
  return (
    <View className="flex-row items-center gap-2.5 pb-2.5 pl-5 pr-4 pt-[18px]">
      <View className="min-w-0 flex-1">
        <ThemedText
          type="none"
          accessibilityRole="header"
          className="font-sans-extrabold text-[22px] leading-[28px] tracking-[-0.3px]"
          numberOfLines={1}>
          {greeting}
        </ThemedText>
        <View className="mt-1.5 self-start">
          <FilterChip label={monthLabel} chevron size="small" onPress={onPressMonth} />
        </View>
      </View>
      <BellButton unread={unread} onPress={onPressBell} />
    </View>
  );
}
