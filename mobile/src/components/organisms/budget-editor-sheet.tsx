import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, CategoryGlyph, ThemedText } from '@/components/atoms';
import { LimitInput, ToggleRow } from '@/components/molecules';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryRef } from '@/services/categories';
import { isMoney } from '@/utils/money';

import { BottomSheet } from './bottom-sheet';

export type BudgetEditorValues = { categoryId: string; limit: string; alertThresholds: string[] };

export type BudgetEditorSheetProps = {
  /** `edit` locks the category and offers Delete. */
  mode: 'add' | 'edit';
  /** The spending categories a budget can be set for. */
  categories: CategoryRef[];
  /** Categories that already have a budget this month, marked "Has budget". */
  budgeted: string[];
  initial: { categoryId: string | null; limit: string; alertThresholds: string[] };
  currency: string;
  /** "You usually spend GHS 540 a month on this", for the chosen category; null while unknown. */
  usualSpend: (categoryId: string) => string | null;
  /** The chosen category changed; lets the page fetch its usual spend. */
  onCategoryChange?: (categoryId: string) => void;
  /** Throw an Error with a message to show it in the sheet. */
  onSave: (values: BudgetEditorValues) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
};

const AT_80 = '0.8';
const AT_100 = '1.0';

/** S24 · New or edit budget: the category, a monthly limit and when to be told. */
export function BudgetEditorSheet({
  mode,
  categories,
  budgeted,
  initial,
  currency,
  usualSpend,
  onCategoryChange,
  onSave,
  onDelete,
  onClose,
}: BudgetEditorSheetProps) {
  const theme = useTheme();
  const editing = mode === 'edit';
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [limit, setLimit] = useState(initial.limit);
  const [at80, setAt80] = useState(initial.alertThresholds.includes(AT_80));
  const [at100, setAt100] = useState(initial.alertThresholds.some((t) => Number(t) === 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const validLimit = isMoney(limit) && Number(limit) > 0;
  const usual = categoryId ? usualSpend(categoryId) : null;
  const visible = editing ? categories.filter((c) => c.id === categoryId) : categories;

  const choose = (id: string) => {
    setCategoryId(id);
    onCategoryChange?.(id);
  };

  const save = async () => {
    if (!categoryId) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave({
        categoryId,
        limit,
        alertThresholds: [...(at80 ? [AT_80] : []), ...(at100 ? [AT_100] : [])],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      title={editing ? 'Edit budget' : 'New budget'}
      onClose={onClose}
      footer={
        <View className="flex-1 gap-2">
          <Button label="Save budget" onPress={save} disabled={!categoryId || !validLimit} loading={saving} />
          {editing && onDelete && (
            <Pressable accessibilityRole="button" onPress={onDelete} className="h-11 items-center justify-center">
              <Text className="font-sans-bold text-[15px] text-icon-red">Delete budget</Text>
            </Pressable>
          )}
        </View>
      }>
      <View>
        <ThemedText type="none" className="mb-2 font-sans-extrabold text-[13px] leading-[18px]">
          Category
        </ThemedText>
        <View className="flex-row flex-wrap gap-2">
          {visible.map((category) => {
            const selected = category.id === categoryId;
            const has = !editing && budgeted.includes(category.id);
            return (
              <Pressable
                key={category.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: editing }}
                accessibilityLabel={has ? `${category.name}, has a budget` : category.name}
                disabled={editing}
                onPress={() => choose(category.id)}
                className={`h-10 flex-row items-center gap-1.5 rounded-[20px] px-3 ${
                  selected ? 'border-2 border-line-focus bg-surface-selected' : 'border border-line bg-surface'
                }`}>
                <CategoryGlyph categoryId={category.id} color={theme.text} size={16} />
                <Text className={`text-[13px] text-content ${selected ? 'font-sans-bold' : 'font-sans-semibold'}`}>
                  {category.name}
                </Text>
                {has && <Text className="font-sans-semibold text-[11px] text-content-secondary">· Has budget</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>

      <LimitInput
        label="Monthly limit"
        currency={currency}
        value={limit}
        onChangeText={setLimit}
        error={error}
        hint={usual ? `You usually spend ${usual} a month on this.` : undefined}
      />

      <View>
        <ThemedText type="none" className="mb-1 font-sans-extrabold text-[13px] leading-[18px]">
          Tell me when I reach
        </ThemedText>
        <ToggleRow title="80%" description="A heads-up while there's still room." value={at80} onValueChange={setAt80} divider />
        <ToggleRow title="100%" description="When the limit is used up." value={at100} onValueChange={setAt100} />
      </View>
    </BottomSheet>
  );
}
