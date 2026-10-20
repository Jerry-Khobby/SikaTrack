import { Pressable, View } from 'react-native';

import { CategoryGlyph, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { CounterpartyKind } from '@/services/categories';

export type CounterpartyRowProps = {
  kind: CounterpartyKind;
  name: string;
  /** E.g. `GHS 248.00`, or `+GHS 200.00` for money in. */
  amount: string;
  /** E.g. `Shop · 7 payments`. */
  detail: string;
  /** Length of the size bar as a fraction of the largest; left out for no bar. */
  barFraction?: number;
  /** The bar's chart colour: money out blue, money in orange. */
  barColor?: string;
  /** Money in shows its amount in the money-in colour. */
  moneyIn?: boolean;
  onPress: () => void;
  divider?: boolean;
};

/** A person or place: kind icon, name, amount, a line of detail and an optional size bar. */
export function CounterpartyRow({ kind, name, amount, detail, barFraction, barColor, moneyIn, onPress, divider }: CounterpartyRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${amount}, ${detail}`}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-unread-row ${divider ? 'border-b border-divider' : ''}`}>
      <View className="h-10 w-10 items-center justify-center rounded-[20px] bg-avatar">
        <CategoryGlyph kind={kind} color={theme.text} size={19} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row justify-between gap-2">
          <ThemedText type="none" className="shrink font-sans-bold text-[15px] leading-[21px]" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText
            type="none"
            themeColor="none"
            className={`font-sans-bold text-[15px] leading-[21px] ${moneyIn ? 'text-money-in' : 'text-content'}`}
            style={{ fontVariant: ['tabular-nums'] }}>
            {amount}
          </ThemedText>
        </View>
        <ThemedText type="fine" themeColor="textSecondary">
          {detail}
        </ThemedText>
        {barFraction !== undefined && (
          <View className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-chip">
            <View className="h-full rounded-sm" style={{ width: `${Math.max(1, barFraction * 100)}%`, backgroundColor: barColor }} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
