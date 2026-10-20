import { Pressable, Text, View } from 'react-native';

import { Card, CategoryGlyph, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { CounterpartyKind } from '@/services/categories';

export type TransactionCategoryCardProps = {
  categoryId: string;
  categoryName: string;
  kind: CounterpartyKind;
  /** Why it has this category, e.g. "Your reference mentions 'laundry'". */
  explanation: string | null;
  onChange: () => void;
};

/** S15's category row with its Change button and the reason it was chosen. */
export function TransactionCategoryCard({ categoryId, categoryName, kind, explanation, onChange }: TransactionCategoryCardProps) {
  const theme = useTheme();

  return (
    <Card radius={18} padded={false} className="px-4 py-[14px]">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-[20px] bg-avatar">
          <CategoryGlyph categoryId={categoryId} kind={kind} color={theme.text} />
        </View>
        <View className="min-w-0 flex-1">
          <ThemedText type="fine" themeColor="textSecondary">
            Category
          </ThemedText>
          <ThemedText type="none" className="font-sans-extrabold text-[15px]">
            {categoryName}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change category, now ${categoryName}`}
          onPress={onChange}
          className="h-9 justify-center rounded-[18px] border-[1.5px] border-primary px-[14px] active:bg-tint-blue">
          <Text className="font-sans-bold text-[13px] text-primary">Change</Text>
        </Pressable>
      </View>
      {explanation && (
        <ThemedText type="fine" themeColor="textSecondary" className="ml-[52px] mt-2.5">
          {explanation}
        </ThemedText>
      )}
    </Card>
  );
}
