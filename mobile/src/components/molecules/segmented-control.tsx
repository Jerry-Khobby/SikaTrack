import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedControlProps<Value extends string> = {
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  accessibilityLabel: string;
};

/** A row of mutually exclusive choices, e.g. All / Money out / Money in. */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<Value>) {
  const theme = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.track, { backgroundColor: theme.chip }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && [styles.selected, { backgroundColor: theme.surface }]]}>
            <Text
              style={[
                styles.label,
                {
                  color: selected ? theme.text : theme.textBody,
                  fontFamily: selected ? FontFamily.bold : FontFamily.semiBold,
                },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
  },
  segment: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  label: {
    fontSize: 13,
  },
});
