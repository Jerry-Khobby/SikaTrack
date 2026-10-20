import { Pressable, View } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import { formatMonthLong } from '@/utils/dates';

import { BottomSheet } from './bottom-sheet';

export type MonthPickerSheetProps = {
  /** `YYYY-MM`, newest first: the months that have data. */
  months: string[];
  selected: string;
  onSelect: (month: string) => void;
  onClose: () => void;
};

/** The months with data, to switch Home to another one. */
export function MonthPickerSheet({ months, selected, onSelect, onClose }: MonthPickerSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet title="Choose a month" onClose={onClose}>
      <View>
        {months.map((month, index) => {
          const active = month === selected;
          return (
            <Pressable
              key={month}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onSelect(month)}
              className={`min-h-button flex-row items-center justify-between ${index < months.length - 1 ? 'border-b border-divider' : ''}`}>
              <ThemedText
                type="none"
                className={`text-[16px] leading-[23px] ${active ? 'font-sans-extrabold' : 'font-sans-semibold'}`}>
                {formatMonthLong(month)}
              </ThemedText>
              {active && <Icon name="check" color={theme.link} size={20} />}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
