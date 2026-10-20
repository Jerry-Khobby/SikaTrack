import { Pressable, Text } from 'react-native';

export type ChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
};

/** A small rounded choice, e.g. a suggested name. */
export function Chip({ label, onPress, selected }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[32px] items-center justify-center rounded-2xl px-3 active:opacity-70 ${selected ? 'bg-tint-blue' : 'bg-chip'}`}>
      <Text className={`text-[12px] ${selected ? 'font-sans-bold text-link' : 'font-sans-semibold text-content'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
