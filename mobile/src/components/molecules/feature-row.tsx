import { StyleSheet, View } from 'react-native';

import { ThemedText, type IconName } from '@/components/atoms';
import { Spacing } from '@/theme';

import { IconTile, type IconTone } from './icon-tile';

export type FeatureRowProps = {
  icon: IconName;
  tone: IconTone;
  text: string;
};

export function FeatureRow({ icon, tone, text }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <IconTile icon={icon} tone={tone} />
      <ThemedText style={styles.text}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    paddingTop: Spacing.half,
  },
});
