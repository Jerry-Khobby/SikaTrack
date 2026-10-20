import { StyleSheet, Text, View } from 'react-native';

import { BrandColors, FontFamily } from '@/theme';

export type ChangeBadgeProps = {
  /** E.g. `30.5% vs September`. */
  text: string;
  down: boolean;
  /** Whether this direction is good news; for spending, down is good. */
  good: boolean;
};

/** `▼ 30.5% vs September` on brand ink, green when good and red when not. */
export function ChangeBadge({ text, down, good }: ChangeBadgeProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${down ? 'Down' : 'Up'} ${text}`}
      style={[styles.badge, { backgroundColor: good ? BrandColors.goodOnInkTint : BrandColors.badOnInkTint }]}>
      <Text style={[styles.text, { color: good ? BrandColors.goodOnInk : BrandColors.badOnInk }]}>
        {down ? '▼' : '▲'} {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  text: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
  },
});
