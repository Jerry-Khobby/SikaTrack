import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, TextLink, ThemedText } from '@/components/atoms';
import { CategoryTile, ToggleRow } from '@/components/molecules';
import { CATEGORY_GROUP_LABELS, type Category, type CategoryGroup } from '@/services/categories';

import { BottomSheet } from './bottom-sheet';

export type CategoryChoice = { category: string | null; applyToCounterparty: boolean };

export type CategoryPickerSheetProps = {
  categories: Category[];
  currentId: string;
  counterpartyName: string;
  /** The user set the current category, so they can go back to the automatic one. */
  userOverride: boolean;
  saving: boolean;
  error?: string;
  onSave: (choice: CategoryChoice) => void;
  onClose: () => void;
};

const GROUP_ORDER: CategoryGroup[] = ['spending', 'money_in', 'own_money'];

/** S16 · Change category: the selectable categories by group, the current one ticked. */
export function CategoryPickerSheet({
  categories,
  currentId,
  counterpartyName,
  userOverride,
  saving,
  error,
  onSave,
  onClose,
}: CategoryPickerSheetProps) {
  const [selected, setSelected] = useState(currentId);
  const [always, setAlways] = useState(false);
  const selectable = categories.filter((c) => c.userSelectable);

  return (
    <BottomSheet
      title="Change category"
      tall
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <ToggleRow
            title={`Always use this for ${counterpartyName}`}
            description="Also changes their past payments."
            value={always}
            onValueChange={setAlways}
          />
          {userOverride && (
            <ThemedText type="callout" style={styles.automatic}>
              <TextLink bold onPress={() => onSave({ category: null, applyToCounterparty: false })}>
                Go back to automatic
              </TextLink>
            </ThemedText>
          )}
          {error && (
            <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          )}
          <Button
            label="Save"
            loading={saving}
            disabled={selected === currentId && !always}
            onPress={() => onSave({ category: selected, applyToCounterparty: always })}
          />
        </View>
      }>
      {GROUP_ORDER.map((group) => {
        const items = selectable.filter((c) => c.group === group);
        if (!items.length) return null;
        return (
          <View key={group}>
            <ThemedText type="overline" themeColor="textSecondary" style={styles.group}>
              {CATEGORY_GROUP_LABELS[group]}
            </ThemedText>
            <View style={styles.grid}>
              {items.map((category) => (
                <CategoryTile
                  key={category.id}
                  categoryId={category.id}
                  name={category.name}
                  selected={selected === category.id}
                  tick
                  onPress={() => setSelected(category.id)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: {
    flex: 1,
    gap: 10,
  },
  automatic: {
    textAlign: 'center',
  },
  group: {
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
