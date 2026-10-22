import { Pressable, View } from 'react-native';

import { CategoryGlyph, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { CounterpartyKind } from '@/services/categories';

export type FeeRowProps = {
  categoryId: string;
  kind: CounterpartyKind;
  name: string;
  /** E.g. `Cash Withdrawal · 8 Oct`. */
  detail: string;
  /** The payment itself, e.g. `GHS 300.00 payment`. */
  amount: string;
  /** Fee and tax together, e.g. `GHS 4.00`. */
  fee: string;
  onPress: () => void;
  divider?: boolean;
};

/** A payment that cost a fee, the fee on the right (S17e). */
export function FeeRow({ categoryId, kind, name, detail, amount, fee, onPress, divider }: FeeRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${detail}, ${amount}, ${fee} in fee and tax`}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-unread-row ${divider ? 'border-b border-divider' : ''}`}>
      <View className="h-10 w-10 items-center justify-center rounded-[20px] bg-avatar">
        <CategoryGlyph categoryId={categoryId} kind={kind} color={theme.text} size={19} />
      </View>
      <View className="min-w-0 flex-1">
        <ThemedText type="none" className="font-sans-bold text-[15px] leading-[21px]" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" className="mt-0.5">
          {detail}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {amount}
        </ThemedText>
      </View>
      <View className="items-end">
        <ThemedText type="none" className="font-sans-extrabold text-[15px] leading-[21px]" style={{ fontVariant: ['tabular-nums'] }}>
          {fee}
        </ThemedText>
        <ThemedText type="none" themeColor="textSecondary" className="font-sans text-[11px]">
          fee + tax
        </ThemedText>
      </View>
    </Pressable>
  );
}
