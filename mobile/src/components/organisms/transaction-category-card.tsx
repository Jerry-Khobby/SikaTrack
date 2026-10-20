import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, CategoryGlyph, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
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
    <Card radius={18} padding={0} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.avatar }]}>
          <CategoryGlyph categoryId={categoryId} kind={kind} color={theme.text} />
        </View>
        <View style={styles.text}>
          <ThemedText type="fine" themeColor="textSecondary">
            Category
          </ThemedText>
          <ThemedText style={styles.name}>{categoryName}</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change category, now ${categoryName}`}
          onPress={onChange}
          style={({ pressed }) => [styles.change, { borderColor: theme.primary }, pressed && { backgroundColor: theme.tintBlue }]}>
          <Text style={[styles.changeLabel, { color: theme.primary }]}>Change</Text>
        </Pressable>
      </View>
      {explanation && (
        <ThemedText type="fine" themeColor="textSecondary" style={styles.explanation}>
          {explanation}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
  },
  change: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  changeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },
  explanation: {
    marginTop: 10,
    marginLeft: 52,
  },
});
