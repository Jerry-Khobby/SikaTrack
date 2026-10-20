import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
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
      style={[
        styles.chip,
        size === 'small' && styles.small,
        active
          ? { backgroundColor: theme.primary }
          : { backgroundColor: theme.surface, borderColor: theme.borderInput, borderWidth: 1 },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.main}>
        {icon && <Icon name={icon} color={color} size={14} />}
        <Text style={[styles.label, { color, fontFamily: active ? FontFamily.bold : FontFamily.semiBold }]}>
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
          style={styles.clear}>
          <Icon name="close" color={color} size={14} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  small: {
    height: 32,
    borderRadius: 16,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: '100%',
  },
  label: {
    fontSize: 13,
  },
  clear: {
    marginLeft: 6,
  },
});
