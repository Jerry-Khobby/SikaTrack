import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/atoms';
import { EmptyState, ErrorState, ScreenTitle, SearchField } from '@/components/molecules';
import { FilterBar, FiltersSheet, TransactionList } from '@/components/organisms';
import { TabScreenTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useMe } from '@/hooks/use-me';
import { useProviderNames } from '@/hooks/use-provider-names';
import { useAccountWallets, useCategories, useTransactionList } from '@/hooks/queries';
import { DEFAULT_FILTERS, hasActiveFilters, type TransactionFilters } from '@/services/transactions';
import { groupByDay } from '@/utils/group-by-day';

const SEARCH_DELAY_MS = 300;

/** S13 · Transactions: every payment, searchable and filterable. */
export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    counterpartyId?: string;
    counterpartyName?: string;
    from?: string;
    to?: string;
    category?: string;
  }>();
  const me = useMe();
  const providerNames = useProviderNames();
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // "See all payments to …" on a transaction opens this tab filtered to that counterparty.
  useEffect(() => {
    if (params.counterpartyId) {
      setSearch('');
      setFilters({
        ...DEFAULT_FILTERS,
        counterparty: { id: params.counterpartyId, name: params.counterpartyName ?? 'This counterparty' },
      });
    }
  }, [params.counterpartyId, params.counterpartyName]);

  // Spending opens this tab on one period ("See these transactions") or one category.
  useEffect(() => {
    if (params.from && params.to) {
      setSearch('');
      setFilters({
        ...DEFAULT_FILTERS,
        date: { from: params.from, to: params.to },
        categories: params.category ? [params.category] : [],
      });
    }
  }, [params.from, params.to, params.category]);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.q === search ? current : { ...current, q: search })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useTransactionList(filters);
  const categories = useCategories();
  const wallets = useAccountWallets();

  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const sections = useMemo(() => groupByDay(items), [items]);
  const categoryNames = useMemo(
    () => Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );
  const walletNames = useMemo(
    () =>
      Object.fromEntries(
        (wallets.data ?? []).map((w) => [w.id, w.label ?? providerNames[w.provider] ?? w.provider]),
      ),
    [wallets.data, providerNames],
  );

  const clearFilters = () => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  };

  const refresh = async () => {
    setRefreshing(true);
    await list.refetch();
    setRefreshing(false);
  };

  const header = (
    <View className="pt-[18px]">
      <View className="px-4 pb-2">
        <ScreenTitle title="Transactions" />
        <SearchField value={search} onChangeText={setSearch} placeholder="Search people, shops, references" />
      </View>
      <FilterBar
        filters={filters}
        categoryNames={categoryNames}
        walletNames={walletNames}
        onOpenFilters={() => setSheetOpen(true)}
        onChange={setFilters}
      />
    </View>
  );

  return (
    <TabScreenTemplate header={header} scroll={false}>
      {list.isPending ? (
        <View accessible accessibilityLabel="Loading transactions" className="gap-2.5 px-4 pt-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={66} radius={18} />
          ))}
        </View>
      ) : list.isError ? (
        <View className="px-4 pt-2.5">
          <ErrorState
            title="We couldn't load your transactions"
            requestId={requestIdOf(list.error)}
            onRetry={() => list.refetch()}
          />
        </View>
      ) : (
        <TransactionList
          sections={sections}
          providerNames={providerNames}
          onPressTransaction={(id) => router.push(`/transactions/${id}`)}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          loadingMore={list.isFetchingNextPage}
          refreshing={refreshing}
          onRefresh={refresh}
          ListEmptyComponent={
            hasActiveFilters(filters) ? (
              <EmptyState
                icon="search"
                title="Nothing matches these filters"
                message="Try a wider date range or fewer filters."
                actionLabel="Clear filters"
                onAction={clearFilters}
              />
            ) : (
              <EmptyState
                icon="list"
                title="No transactions in the last 30 days"
                message="Payments show up here as soon as your MoMo SMS arrive."
              />
            )
          }
        />
      )}

      {sheetOpen && (
        <FiltersSheet
          initial={filters}
          categories={categories.data ?? []}
          wallets={wallets.data ?? []}
          providerNames={providerNames}
          currency={me?.settings.currency ?? ''}
          onApply={(next) => {
            setFilters(next);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </TabScreenTemplate>
  );
}

