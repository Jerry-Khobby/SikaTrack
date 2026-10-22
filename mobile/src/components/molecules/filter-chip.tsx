import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type FilterChipProps = {
  label: string;
  onPress: () => void;
  /** Filled in ink when a filter is on. */
  active?: boolean;
  /** Shows a × that clears this filter. */
  onClear?: () => void;
  /** A ▾ after the label, for chips that open a choice. */
  chevron?: boolean;
  icon?: IconName;
  size?: 'regular' | 'small';
};

/** A rounded filter button, as in the row under the transactions search. */
export function FilterChip({ label, onPress, active, onClear, chevron, icon, size = 'regular' }: FilterChipProps) {
  const theme = useTheme();
  const color = active ? theme.onPrimary : theme.text;

  return (
    <View
      className={`flex-row items-center ${size === 'small' ? 'h-8 rounded-2xl' : 'h-9 rounded-[18px]'} ${
        active ? 'bg-primary' : 'border border-line-input bg-surface'
      }`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        hitSlop={{ top: 6, bottom: 6 }}
        className={`h-full flex-row items-center gap-1.5 pl-3 ${active && onClear ? 'pr-1.5' : 'pr-3'}`}>
        {icon && <Icon name={icon} color={color} size={14} />}
        <Text className={`text-[13px] ${active ? 'font-sans-bold text-on-primary' : 'font-sans-semibold text-content'}`}>
          {label}
        </Text>
        {chevron && <Icon name="chevron-down" color={color} size={14} />}
      </Pressable>
      {active && onClear && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          onPress={onClear}
          hitSlop={8}
          className="pr-3">
          <Icon name="close" color={color} size={14} />
        </Pressable>
      )}
    </View>
  );
}
