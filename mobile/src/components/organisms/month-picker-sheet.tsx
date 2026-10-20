import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { ControlHeight, FontFamily } from '@/theme';
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
              style={[styles.row, index < months.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
              <ThemedText style={[styles.label, active && styles.active]}>{formatMonthLong(month)}</ThemedText>
              {active && <Icon name="check" color={theme.link} size={20} />}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ControlHeight.button,
  },
  label: {
    fontFamily: FontFamily.semiBold,
  },
  active: {
    fontFamily: FontFamily.extraBold,
  },
});
