import { Pressable, Text } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { Country } from '@/utils/countries';

export type CountryRowProps = {
  country: Country;
  selected: boolean;
  onPress: () => void;
};

export function CountryRow({ country, selected, onPress }: CountryRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${country.name}, ${country.dialCode}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-[56px] flex-row items-center gap-3 px-6 active:bg-tint-blue">
      <Text className="text-[22px]">{country.flag}</Text>
      <ThemedText className="flex-1" numberOfLines={1}>
        {country.name}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary">
        {country.dialCode}
      </ThemedText>
      {selected && <Icon name="check" color={theme.link} size={20} />}
    </Pressable>
  );
}
