import { Pressable, Text, View } from 'react-native';

import { CategoryGlyph, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { CounterpartyKind } from '@/services/categories';

export type RecurringReviewItem = {
  id: string;
  categoryId: string;
  kind: CounterpartyKind;
  name: string;
  /** E.g. `GHS 50.00 every Friday · 6 payments`. */
  detail: string;
};

export type RecurringReviewCardProps = {
  items: RecurringReviewItem[];
  onExpected: (id: string) => void;
  onNotRecurring: (id: string) => void;
};

/** "Review these": series we spotted that the user hasn't confirmed yet. */
export function RecurringReviewCard({ items, onExpected, onNotRecurring }: RecurringReviewCardProps) {
  const theme = useTheme();

  return (
    <View className="rounded-[20px] border-[1.5px] border-line-gold bg-tint-gold p-4">
      <ThemedText type="none" accessibilityRole="header" className="font-sans-extrabold text-[15px] leading-[21px]">
        Review {items.length === 1 ? 'this' : 'these'}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" className="mt-0.5">
        We spotted {items.length === 1 ? 'a payment that looks' : 'payments that look'} regular. Is that right?
      </ThemedText>
      {items.map((item) => (
        <View key={item.id} className="mt-3 rounded-2xl bg-surface p-3">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-[18px] bg-avatar">
              <CategoryGlyph categoryId={item.categoryId} kind={item.kind} color={theme.text} size={17} />
            </View>
            <View className="min-w-0 flex-1">
              <ThemedText type="none" className="font-sans-extrabold text-[14px] leading-[20px]" numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText type="fine" themeColor="textSecondary">
                {item.detail}
              </ThemedText>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Yes, ${item.name} is expected`}
              onPress={() => onExpected(item.id)}
              className="h-10 flex-1 items-center justify-center rounded-sm bg-primary active:opacity-90">
              <Text className="font-sans-bold text-[13px] text-on-primary">Yes, expected</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} is not recurring`}
              onPress={() => onNotRecurring(item.id)}
              className="h-10 flex-1 items-center justify-center rounded-sm border border-line-input bg-surface active:bg-chip">
              <Text className="font-sans-bold text-[13px] text-content">Not recurring</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
