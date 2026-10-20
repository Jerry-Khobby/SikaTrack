import { Pressable, View } from 'react-native';

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
};

/** An on/off switch. */
export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      className={`h-8 w-[52px] flex-row rounded-2xl p-[3px] ${value ? 'justify-end bg-primary' : 'justify-start bg-toggle-off'}`}>
      <View className="h-[26px] w-[26px] rounded-[13px] bg-white shadow-sm shadow-black/25" style={{ elevation: 2 }} />
    </Pressable>
  );
}
