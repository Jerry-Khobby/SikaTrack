import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type LegendRowProps = {
  /** The swatch colour; chart colours are data, so this stays a value. */
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
      className="min-h-touch flex-row gap-2.5 py-2 active:opacity-60">
      <View className="mt-[5px] h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      <View className="min-w-0 flex-1">
        <ThemedText type="none" className="font-sans-bold text-[14px] leading-[19px]" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {detail}
        </ThemedText>
      </View>
    </Pressable>
  );
}
