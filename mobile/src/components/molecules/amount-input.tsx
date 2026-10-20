import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type AmountInputProps = {
  currency: string;
  placeholder: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (text: string) => void;
};

/** A money field with the currency in front, e.g. the Min and Max amount filters. */
export function AmountInput({ currency, placeholder, accessibilityLabel, value, onChangeText }: AmountInputProps) {
  const theme = useTheme();

  return (
    <View className="h-12 flex-1 flex-row items-center gap-1.5 rounded-sm border-[1.5px] border-line-input bg-surface px-3">
      <Text className="font-sans text-[13px] text-content-secondary">{currency}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^\d.]/g, ''))}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.link}
        keyboardType="decimal-pad"
        className="h-full min-w-0 flex-1 font-sans text-[15px] text-content"
      />
    </View>
  );
}
