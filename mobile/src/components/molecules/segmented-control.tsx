import { Pressable, Text, View } from 'react-native';

export type SegmentedControlProps<Value extends string> = {
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  accessibilityLabel: string;
};

const SELECTED_LIFT = {
  elevation: 1,
  shadowColor: '#000000',
  shadowOpacity: 0.12,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
};

/** A row of mutually exclusive choices, e.g. All / Money out / Money in. */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<Value>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row rounded-md bg-chip p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            className={`h-[38px] flex-1 items-center justify-center rounded-[10px] ${selected ? 'bg-surface' : ''}`}
            // The lift moves with the selection, so it's an inline style: toggling a
            // shadow class after the first render makes NativeWind remount the view.
            style={selected ? SELECTED_LIFT : undefined}>
            <Text className={`text-[13px] ${selected ? 'font-sans-bold text-content' : 'font-sans-semibold text-content-body'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
