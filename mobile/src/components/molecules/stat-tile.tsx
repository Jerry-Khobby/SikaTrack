import { StyleSheet, Text, View } from 'react-native';

import { BrandColors, FontFamily } from '@/theme';

export type StatTileProps = {
  label: string;
  value: string;
  /** The value's colour on brand ink; white by default. */
  valueColor?: string;
};

/** A small labelled figure inside the brand-ink hero card. */
export function StatTile({ label, value, valueColor = BrandColors.onInk }: StatTileProps) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BrandColors.inkTile,
  },
  label: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
    color: BrandColors.onInkMuted,
  },
  value: {
    marginTop: 3,
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
