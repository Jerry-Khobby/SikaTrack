import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import {
  AmountInput,
  CategoryTile,
  FilterChip,
  SegmentedControl,
  TextField,
  ToggleRow,
} from '@/components/molecules';
import { FontFamily } from '@/theme';
import type { AccountWallet } from '@/services/balances';
import type { Category } from '@/services/categories';
import { DEFAULT_FILTERS, type TransactionFilters } from '@/services/transactions';
import { DATE_PRESETS, presetRange, validateRange } from '@/utils/dates';
import { isMoney, toPesewas } from '@/utils/money';

import { BottomSheet } from './bottom-sheet';

export type FiltersSheetProps = {
  initial: TransactionFilters;
  categories: Category[];
  wallets: AccountWallet[];
  providerNames: Record<string, string>;
  currency: string;
  onApply: (filters: TransactionFilters) => void;
  onClose: () => void;
};

const COLLAPSED_CATEGORIES = 7;

function Label({ children }: { children: string }) {
  return <ThemedText style={styles.label}>{children}</ThemedText>;
}

/** S14 · Filters: date, direction, categories, wallet, amount and own transfers. */
export function FiltersSheet({
  initial,
  categories,
  wallets,
  providerNames,
  currency,
  onApply,
  onClose,
}: FiltersSheetProps) {
  const [draft, setDraft] = useState(initial);
  const initialRange = 'preset' in initial.date ? presetRange(initial.date.preset) : initial.date;
  const [custom, setCustom] = useState(!('preset' in initial.date));
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [min, setMin] = useState(initial.minAmount ?? '');
  const [max, setMax] = useState(initial.maxAmount ?? '');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const set = (changes: Partial<TransactionFilters>) => setDraft({ ...draft, ...changes });

  const rangeError = custom ? validateRange(from, to) : null;
  const amountError =
    (min && !isMoney(min)) || (max && !isMoney(max))
      ? 'Enter amounts like 20 or 12.50.'
      : min && max && toPesewas(min) > toPesewas(max)
        ? 'The minimum must not be more than the maximum.'
        : null;

  const selectable = categories.filter((c) => c.userSelectable);
  const shown = showAllCategories ? selectable : selectable.slice(0, COLLAPSED_CATEGORIES);
  const hidden = selectable.length - shown.length;

  const toggleCategory = (id: string) =>
    set({
      categories: draft.categories.includes(id)
        ? draft.categories.filter((c) => c !== id)
        : [...draft.categories, id],
    });

  const apply = () =>
    onApply({
      ...draft,
      date: custom ? { from, to } : draft.date,
      minAmount: min || null,
      maxAmount: max || null,
    });

  const reset = () => {
    setDraft({ ...DEFAULT_FILTERS, q: draft.q });
    setCustom(false);
    setMin('');
    setMax('');
  };

  return (
    <BottomSheet
      title="Filters"
      tall
      onClose={onClose}
      footer={
        <>
          <View style={styles.reset}>
            <Button variant="secondary" label="Reset" onPress={reset} />
          </View>
          <View style={styles.apply}>
            <Button label="Show results" onPress={apply} disabled={Boolean(rangeError || amountError)} />
          </View>
        </>
      }>
      <View>
        <Label>Date</Label>
        <View style={styles.wrap}>
          {DATE_PRESETS.map((preset) => (
            <FilterChip
              key={preset.id}
              label={preset.label}
              active={!custom && 'preset' in draft.date && draft.date.preset === preset.id}
              onPress={() => {
                setCustom(false);
                set({ date: { preset: preset.id } });
              }}
            />
          ))}
          <FilterChip label="Custom" icon="calendar" active={custom} onPress={() => setCustom(true)} />
        </View>
        {custom && (
          <View style={styles.customRange}>
            <View style={styles.half}>
              <TextField label="From" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={styles.half}>
              <TextField label="To" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            </View>
          </View>
        )}
        {rangeError && (
          <ThemedText type="fine" themeColor="error" style={styles.error}>
            {rangeError}
          </ThemedText>
        )}
      </View>

      <View>
        <Label>Direction</Label>
        <SegmentedControl
          accessibilityLabel="Direction"
          options={[
            { value: 'all', label: 'All' },
            { value: 'out', label: 'Money out' },
            { value: 'in', label: 'Money in' },
          ]}
          value={draft.direction ?? 'all'}
          onChange={(value) => set({ direction: value === 'all' ? null : value })}
        />
      </View>

      <View>
        <Label>Categories</Label>
        <View style={styles.grid}>
          {shown.map((category) => (
            <CategoryTile
              key={category.id}
              categoryId={category.id}
              name={category.name}
              selected={draft.categories.includes(category.id)}
              onPress={() => toggleCategory(category.id)}
            />
          ))}
          {hidden > 0 && (
            <CategoryTile icon="dots" name={`${hidden} more`} onPress={() => setShowAllCategories(true)} />
          )}
        </View>
      </View>

      {wallets.length > 0 && (
        <View>
          <Label>Wallet</Label>
          <View style={styles.wrap}>
            {wallets.map((wallet) => (
              <FilterChip
                key={wallet.id}
                label={wallet.label ?? providerNames[wallet.provider] ?? wallet.provider}
                active={draft.walletId === wallet.id}
                onPress={() => set({ walletId: draft.walletId === wallet.id ? null : wallet.id })}
              />
            ))}
          </View>
        </View>
      )}

      <View>
        <Label>Amount</Label>
        <View style={styles.customRange}>
          <AmountInput currency={currency} placeholder="Min" accessibilityLabel="Minimum amount" value={min} onChangeText={setMin} />
          <AmountInput currency={currency} placeholder="Max" accessibilityLabel="Maximum amount" value={max} onChangeText={setMax} />
        </View>
        {amountError && (
          <ThemedText type="fine" themeColor="error" style={styles.error}>
            {amountError}
          </ThemedText>
        )}
      </View>

      <ToggleRow
        title="Show transfers between my wallets"
        description="Hidden by default, because they aren't spending."
        value={draft.includeOwnTransfers}
        onValueChange={(value) => set({ includeOwnTransfers: value })}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 10,
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    lineHeight: 18,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customRange: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  half: {
    flex: 1,
  },
  error: {
    marginTop: 6,
  },
  reset: {
    flex: 1,
  },
  apply: {
    flex: 2,
  },
});
