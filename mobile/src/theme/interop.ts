import { remapProps } from 'nativewind';
import { SectionList } from 'react-native';

/**
 * NativeWind styles most React Native components out of the box (View, Text,
 * Pressable, ScrollView, FlatList, TextInput, SafeAreaView…). SectionList isn't
 * one of them, so tell it which props take classes.
 */
remapProps(SectionList, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
