import { ScrollView, StyleSheet } from 'react-native';

import { FilterChip } from '@/components/molecules';
import { DEFAULT_FILTERS, type TransactionFilters } from '@/services/transactions';
import { DATE_PRESETS, formatWeekdayDate } from '@/utils/dates';

export type FilterBarProps = {
  filters: TransactionFilters;
  /** Category id → name, for the category chip's label. */
  categoryNames: Record<string, string>;
  /** Wallet id → label, for the wallet chip's label. */
  walletNames: Record<string, string>;
  /** Opens the filters sheet. */
  onOpenFilters: () => void;
  onChange: (filters: TransactionFilters) => void;
};

function dateLabel(filters: TransactionFilters) {
  if ('preset' in filters.date) {
    const preset = filters.date.preset;
    return DATE_PRESETS.find((p) => p.id === preset)?.label ?? 'Dates';
  }
  return `${formatWeekdayDate(filters.date.from)} – ${formatWeekdayDate(filters.date.to)}`;
}

/** The chips under the search: date range, Out / In, Category, Wallet and More filters. */
export function FilterBar({ filters, categoryNames, walletNames, onOpenFilters, onChange }: FilterBarProps) {
  const set = (changes: Partial<TransactionFilters>) => onChange({ ...filters, ...changes });
  const { categories } = filters;
  const moreActive = filters.minAmount !== null || filters.maxAmount !== null || filters.includeOwnTransfers;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterChip label={dateLabel(filters)} active chevron onPress={onOpenFilters} />
      {filters.counterparty && (
        <FilterChip
          label={filters.counterparty.name}
          active
          onPress={onOpenFilters}
          onClear={() => set({ counterparty: null })}
        />
      )}
      <FilterChip
        label={filters.direction === 'out' ? 'Money out' : filters.direction === 'in' ? 'Money in' : 'Out / In'}
        active={filters.direction !== null}
        onPress={onOpenFilters}
        onClear={() => set({ direction: null })}
      />
      <FilterChip
        label={
          categories.length === 1
            ? (categoryNames[categories[0]] ?? 'Category')
            : categories.length > 1
              ? `${categories.length} categories`
              : 'Category'
        }
        active={categories.length > 0}
        onPress={onOpenFilters}
        onClear={() => set({ categories: [] })}
      />
      <FilterChip
        label={filters.walletId ? (walletNames[filters.walletId] ?? 'Wallet') : 'Wallet'}
        active={filters.walletId !== null}
        onPress={onOpenFilters}
        onClear={() => set({ walletId: null })}
      />
      <FilterChip
        label="More filters"
        icon="sliders"
        active={moreActive}
        onPress={onOpenFilters}
        onClear={() =>
          set({
            minAmount: DEFAULT_FILTERS.minAmount,
            maxAmount: DEFAULT_FILTERS.maxAmount,
            includeOwnTransfers: DEFAULT_FILTERS.includeOwnTransfers,
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
});
