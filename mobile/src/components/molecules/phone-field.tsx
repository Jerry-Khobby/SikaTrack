import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
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
  const border = error
    ? 'border-2 border-error'
    : focused
      ? 'border-2 border-line-focus'
      : 'border-[1.5px] border-line-input';

  return (
    <View>
      <ThemedText type="label" className="mb-2">
        {label}
      </ThemedText>
      <View className={`h-input flex-row items-center overflow-hidden rounded-md bg-surface ${border}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country: ${country.name}, ${country.dialCode}. Change country`}
          onPress={onPressCountry}
          className="h-full flex-row items-center gap-1.5 border-r border-line pl-[14px] pr-2.5 active:bg-tint-blue">
          <Text className="text-[20px]">{country.flag}</Text>
          <ThemedText type="none" className="font-sans-bold text-[17px] leading-[22px]">
            {country.dialCode}
          </ThemedText>
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
          className={`h-full min-w-0 flex-1 px-[14px] font-sans-semibold text-[19px] tracking-[0.5px] text-content ${editable ? '' : 'opacity-40'}`}
        />
      </View>
      {(error || hint) && (
        <ThemedText
          type="caption"
          themeColor={error ? 'error' : 'textSecondary'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          className="mt-2.5">
          {error ?? hint}
        </ThemedText>
      )}
    </View>
  );
}
