import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { ControlHeight, FontFamily, Radius, Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Country } from '@/utils/countries';

export type PhoneFieldProps = {
  label: string;
  country: Country;
  onPressCountry: () => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  editable?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

/** A phone number input with the chosen country's flag and dialling code in front. */
export function PhoneField({
  label,
  country,
  onPressCountry,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  editable = true,
  autoFocus,
  onSubmitEditing,
}: PhoneFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const highlighted = Boolean(error) || focused;

  return (
    <View>
      <ThemedText type="label" style={styles.label}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : focused ? theme.borderFocus : theme.borderInput,
            borderWidth: highlighted ? 2 : 1.5,
          },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country: ${country.name}, ${country.dialCode}. Change country`}
          onPress={onPressCountry}
          style={({ pressed }) => [
            styles.country,
            { borderRightColor: theme.border },
            pressed && { backgroundColor: theme.tintBlue },
          ]}>
          <Text style={styles.flag}>{country.flag}</Text>
          <ThemedText style={styles.dialCode}>{country.dialCode}</ThemedText>
          <Icon name="chevron-down" color={theme.textSecondary} size={16} />
        </Pressable>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          autoFocus={autoFocus}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.link}
          style={[styles.input, { color: theme.text }, !editable && styles.disabled]}
        />
      </View>
      {(error || hint) && (
        <ThemedText
          type="caption"
          themeColor={error ? 'error' : 'textSecondary'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={styles.hint}>
          {error ?? hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.two,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ControlHeight.input,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: '100%',
    paddingLeft: 14,
    paddingRight: 10,
    borderRightWidth: 1,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingHorizontal: 14,
    fontFamily: FontFamily.semiBold,
    fontSize: 19,
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.4,
  },
  hint: {
    marginTop: 10,
  },
});
