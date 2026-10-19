import { Pressable, StyleSheet, Text } from 'react-native';

import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
};

/** A small rounded choice, e.g. a suggested name. */
export function Chip({ label, onPress, selected }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.tintBlue : theme.chip },
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.label,
          {
            color: selected ? theme.link : theme.text,
            fontFamily: selected ? FontFamily.bold : FontFamily.semiBold,
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
