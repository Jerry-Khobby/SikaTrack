import { useState } from 'react';
import { Modal, SectionList, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, ThemedText, ThemedView } from '@/components/atoms';
import { CountryRow, SearchField } from '@/components/molecules';
import type { Country } from '@/utils/countries';

export type CountryPickerProps = {
  visible: boolean;
  countries: Country[];
  /** Codes of the countries SikaTrack works in; these are listed first. */
  supportedCodes: string[];
  selectedCode: string;
  onSelect: (country: Country) => void;
  onClose: () => void;
};

function matches(country: Country, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    country.name.toLowerCase().includes(q) ||
    country.dialCode.includes(q.replace(/^\+?/, '+')) ||
    country.code.toLowerCase() === q
  );
}

/** A full-screen, searchable list of countries. */
export function CountryPicker({
  visible,
  countries,
  supportedCodes,
  selectedCode,
  onSelect,
  onClose,
}: CountryPickerProps) {
  const [query, setQuery] = useState('');
  const found = countries.filter((country) => matches(country, query));
  const sections = [
    {
      title: 'Available now',
      data: found.filter((country) => supportedCodes.includes(country.code)),
    },
    {
      title: 'Not available yet',
      data: found.filter((country) => !supportedCodes.includes(country.code)),
    },
  ].filter((section) => section.data.length > 0);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaProvider>
        <ThemedView className="flex-1">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center gap-1 px-3 pb-2 pt-3">
              <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
              <ThemedText type="heading" accessibilityRole="header">
                Choose your country
              </ThemedText>
            </View>
            <View className="px-6 pb-2">
              <SearchField value={query} onChangeText={setQuery} placeholder="Search by country or code" />
            </View>
            <SectionList
              sections={sections}
              keyExtractor={(country) => country.code}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <ThemedText type="label" themeColor="textSecondary" className="px-6 pb-2 pt-4">
                  {section.title}
                </ThemedText>
              )}
              renderItem={({ item }) => (
                <CountryRow
                  country={item}
                  selected={item.code === selectedCode}
                  onPress={() => {
                    setQuery('');
                    onSelect(item);
                  }}
                />
              )}
              ListEmptyComponent={
                <ThemedText themeColor="textSecondary" className="px-6 pt-6">
                  No country matches “{query}”.
                </ThemedText>
              }
              contentContainerClassName="pb-8"
            />
          </SafeAreaView>
        </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}
