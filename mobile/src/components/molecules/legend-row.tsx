import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { ControlHeight, FontFamily } from '@/theme';

export type LegendRowProps = {
  color: string;
  title: string;
  /** E.g. `GHS 612.50 · 22%`. */
  detail: string;
  onPress?: () => void;
};

/** A chart's colour key with a name and its figure. */
export function LegendRow({ color, title, detail, onPress }: LegendRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}: ${detail}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" style={styles.detail}>
          {detail}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    minHeight: ControlHeight.touch,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginTop: 5,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  detail: {
    fontVariant: ['tabular-nums'],
  },
});
