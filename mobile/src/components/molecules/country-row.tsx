import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { Spacing } from '@/theme';
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
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.tintBlue }]}>
      <Text style={styles.flag}>{country.flag}</Text>
      <ThemedText style={styles.name} numberOfLines={1}>
        {country.name}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary">
        {country.dialCode}
      </ThemedText>
      {selected && <Icon name="check" color={theme.link} size={20} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: Spacing.four,
  },
  flag: {
    fontSize: 22,
  },
  name: {
    flex: 1,
  },
});
