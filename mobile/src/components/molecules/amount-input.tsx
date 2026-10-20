import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FontFamily, Radius } from '@/theme';
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
    <View style={[styles.field, { borderColor: theme.borderInput, backgroundColor: theme.surface }]}>
      <Text style={[styles.currency, { color: theme.textSecondary }]}>{currency}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^\d.]/g, ''))}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.link}
        keyboardType="decimal-pad"
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  currency: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
});
